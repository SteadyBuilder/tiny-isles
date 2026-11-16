import {
  GARRISON_CONFIG,
  WORLD_CLOCK_CONFIG,
} from '../../data/worldRules';
import {
  ConstructedBuilding,
  GarrisonUnit,
  Island,
  PlayerColor,
  VillageTier,
  WorldSyncState,
} from '../../types/game';
import { storage } from '../../lib/storage';
import { worldStateSync } from '../../lib/worldStateSync';
import { GameEvents } from '../events/gameEvents';
import { GarrisonSystem } from './GarrisonSystem';
import { WaveSystem } from './WaveSystem';

export interface ILivingWorldContext {
  getPlayerId: () => string;
  getPlayerName: () => string;
  getPlayerColor: () => PlayerColor;
  getPlayerPosition: () => { x: number; y: number };
  getCurrentTerritoryId: () => number;
  getIslands: () => Island[];
  getConstructedBuildings: () => ConstructedBuilding[];
  applySyncedWorldState: (
    updatedIslands: Island[],
    updatedBuildings: ConstructedBuilding[]
  ) => void;
  applyRestoredPlayerPosition?: (x: number, y: number) => void;
}

/**
 * 리빙 아일즈(Living Isles) 주기적 스냅샷 저장 및 비동기 수비대 조율기
 */
export class LivingWorldCoordinator {
  private ctx: ILivingWorldContext;
  private waveSystem: WaveSystem;
  private garrisonSystem: GarrisonSystem;
  private worldSnapshotAccumMs = 0;
  private garrisonSyncAccumMs = 0;
  private immediateSnapshotTimer: ReturnType<typeof setTimeout> | null = null;
  private initialized = false;
  private disposed = false;

  constructor(
    ctx: ILivingWorldContext,
    waveSystem: WaveSystem,
    garrisonSystem: GarrisonSystem
  ) {
    this.ctx = ctx;
    this.waveSystem = waveSystem;
    this.garrisonSystem = garrisonSystem;
  }

  public destroy(): void {
    this.disposed = true;
    if (this.immediateSnapshotTimer) {
      clearTimeout(this.immediateSnapshotTimer);
      this.immediateSnapshotTimer = null;
    }
  }

  public async initialize(): Promise<void> {
    if (this.initialized || this.disposed) return;
    this.initialized = true;

    const localPlayerId = this.ctx.getPlayerId();
    const hasLocalPos = storage.loadPlayerPosition() !== null;
    const [savedWorld, garrisons, myGarrison] = await Promise.all([
      worldStateSync.fetchWorldState(),
      worldStateSync.fetchGarrisons(localPlayerId),
      hasLocalPos ? Promise.resolve(null) : worldStateSync.fetchPlayerGarrison(localPlayerId),
    ]);

    if (this.disposed) return;

    if (!hasLocalPos && myGarrison) {
      this.ctx.applyRestoredPlayerPosition?.(myGarrison.x, myGarrison.y);
    }

    this.garrisonSystem.setGarrisons(garrisons);
    GameEvents.emit('garrisons-updated', garrisons);

    if (savedWorld) {
      this.waveSystem.syncCountsFromWorldState(
        savedWorld.waveCount,
        savedWorld.bossWaveCount
      );

      let baseIslands = this.ctx.getIslands();
      let baseBuildings = this.ctx.getConstructedBuildings();

      if (Array.isArray(savedWorld.unlockedIslandIds) && savedWorld.unlockedIslandIds.length > 0) {
        baseIslands = baseIslands.map((isl) => {
          const isUnlocked = savedWorld.unlockedIslandIds.includes(isl.id) || isl.id === 0;
          const tier = isUnlocked
            ? (savedWorld.villageTiers?.[isl.id] ?? isl.villageTier)
            : 0;
          const maxHp = isl.id === 0 && tier < 2 ? 350 : isl.coreMaxHp;
          const coreHp =
            isUnlocked && savedWorld.coreHps?.[isl.id] !== undefined
              ? savedWorld.coreHps[isl.id]
              : isl.coreHp;
          const ownerInfo = isUnlocked && isl.id !== 0 ? savedWorld.islandOwners?.[isl.id] : undefined;
          return {
            ...isl,
            unlocked: isUnlocked,
            ownerId: ownerInfo?.ownerId ?? isl.ownerId,
            ownerName: ownerInfo?.ownerName ?? isl.ownerName,
            villageTier: tier,
            coreMaxHp: maxHp,
            coreHp,
          };
        });
        if (Array.isArray(savedWorld.constructedBuildings)) {
          baseBuildings = savedWorld.constructedBuildings;
        }
        this.ctx.applySyncedWorldState(baseIslands, baseBuildings);
      }
    }

    if (this.disposed) return;
    if (this.waveSystem.getIsHost()) {
      await this.persistAllSnapshots();
    } else {
      await this.saveLocalGarrison();
    }
  }

  public update(delta: number) {
    if (!this.initialized || this.disposed) return;

    this.worldSnapshotAccumMs += delta;
    this.garrisonSyncAccumMs += delta;

    if (this.worldSnapshotAccumMs >= WORLD_CLOCK_CONFIG.worldSnapshotIntervalMs) {
      this.worldSnapshotAccumMs = 0;
      if (this.waveSystem.getIsHost()) {
        void this.saveWorldSnapshot();
      }
    }

    if (this.garrisonSyncAccumMs >= WORLD_CLOCK_CONFIG.garrisonSyncIntervalMs) {
      this.garrisonSyncAccumMs = 0;
      void this.saveLocalGarrison();
    }
  }

  public requestImmediateSnapshot(): void {
    if (!this.initialized || this.disposed || !this.waveSystem.getIsHost()) return;
    if (this.immediateSnapshotTimer) {
      clearTimeout(this.immediateSnapshotTimer);
    }
    this.immediateSnapshotTimer = setTimeout(() => {
      this.immediateSnapshotTimer = null;
      if (!this.disposed && this.waveSystem.getIsHost()) {
        void this.saveWorldSnapshot();
      }
    }, 800);
  }

  public async persistAllSnapshots(): Promise<void> {
    if (this.waveSystem.getIsHost()) {
      await Promise.all([this.saveWorldSnapshot(), this.saveLocalGarrison()]);
    } else {
      await this.saveLocalGarrison();
    }
  }

  public saveWorldSnapshot(): Promise<boolean> {
    const islands = this.ctx.getIslands();
    const waveState = this.waveSystem.getWaveState();

    const unlockedIslandIds: number[] = [];
    const islandOwners: Record<number, { ownerId: string; ownerName: string }> = {};
    const villageTiers: Record<number, VillageTier> = {};
    const coreHps: Record<number, number> = {};

    for (const isl of islands) {
      if (isl.unlocked) {
        unlockedIslandIds.push(isl.id);
        villageTiers[isl.id] = isl.villageTier;
        coreHps[isl.id] = isl.coreHp;
        if (isl.id !== 0 && isl.ownerId) {
          islandOwners[isl.id] = {
            ownerId: isl.ownerId,
            ownerName: isl.ownerName || '탐험가',
          };
        }
      }
    }

    const state: WorldSyncState = {
      worldId: 'main_world',
      lastActiveAt: new Date().toISOString(),
      waveCount: waveState.waveCount,
      bossWaveCount: waveState.bossWaveCount,
      unlockedIslandIds,
      islandOwners,
      villageTiers,
      coreHps,
      constructedBuildings: this.ctx.getConstructedBuildings(),
      activeMonsters: [],
    };

    return worldStateSync.saveWorldState(state);
  }

  public saveLocalGarrison(): Promise<boolean> {
    const pos = this.ctx.getPlayerPosition();
    const unit: GarrisonUnit = {
      playerId: this.ctx.getPlayerId(),
      name: this.ctx.getPlayerName(),
      color: this.ctx.getPlayerColor(),
      territoryId: this.ctx.getCurrentTerritoryId(),
      x: Math.round(pos.x),
      y: Math.round(pos.y),
      power: GARRISON_CONFIG.offlineDefensePowerPerGarrison,
      updatedAt: new Date().toISOString(),
    };
    return worldStateSync.saveGarrison(unit);
  }
}
