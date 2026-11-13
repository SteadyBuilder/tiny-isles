import {
  GARRISON_CONFIG,
  WORLD_CLOCK_CONFIG,
} from '../../data/worldRules';
import {
  ConstructedBuilding,
  GarrisonUnit,
  Island,
  OfflineResolutionReport,
  PlayerColor,
  VillageTier,
  WorldSyncState,
} from '../../types/game';
import { storage } from '../../lib/storage';
import { worldStateSync } from '../../lib/worldStateSync';
import { resolveOfflinePeriod } from '../utils/offlineResolver';
import { EventBus } from '../phaser/EventBus';
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
  applyOfflineWorldUpdate: (
    updatedIslands: Island[],
    updatedBuildings: ConstructedBuilding[],
    passiveGain: { wood: number; stone: number; gold: number }
  ) => void;
}

/**
 * 리빙 아일즈(Living Isles) 오프라인 정산, 주기적 스냅샷 저장 및 비동기 수비대 조율기
 */
export class LivingWorldCoordinator {
  private ctx: ILivingWorldContext;
  private waveSystem: WaveSystem;
  private garrisonSystem: GarrisonSystem;
  private worldSnapshotAccumMs = 0;
  private garrisonSyncAccumMs = 0;
  private initialized = false;

  constructor(
    ctx: ILivingWorldContext,
    waveSystem: WaveSystem,
    garrisonSystem: GarrisonSystem
  ) {
    this.ctx = ctx;
    this.waveSystem = waveSystem;
    this.garrisonSystem = garrisonSystem;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    const localPlayerId = this.ctx.getPlayerId();
    const [savedWorld, garrisons] = await Promise.all([
      worldStateSync.fetchWorldState(),
      worldStateSync.fetchGarrisons(localPlayerId),
    ]);

    this.garrisonSystem.setGarrisons(garrisons);
    EventBus.emit('garrisons-updated', garrisons);

    if (savedWorld) {
      this.waveSystem.syncCountsFromWorldState(
        savedWorld.waveCount,
        savedWorld.bossWaveCount
      );

      const resolution = resolveOfflinePeriod({
        lastActiveAtIso: savedWorld.lastActiveAt,
        nowMs: Date.now(),
        baseWaveCount: savedWorld.waveCount,
        baseBossWaveCount: savedWorld.bossWaveCount,
        islands: this.ctx.getIslands(),
        constructedBuildings: this.ctx.getConstructedBuildings(),
        garrisons,
      });

      if (resolution.shouldReport && resolution.report) {
        this.ctx.applyOfflineWorldUpdate(
          resolution.updatedIslands,
          resolution.updatedBuildings,
          resolution.report.passiveGain
        );
        this.waveSystem.syncCountsFromWorldState(
          resolution.newWaveCount,
          resolution.newBossWaveCount
        );
        this.emitOfflineReport(resolution.report);
      }
    }

    await this.persistAllSnapshots();
  }

  private emitOfflineReport(report: OfflineResolutionReport) {
    EventBus.emit('offline-report-ready', report);
  }

  public update(delta: number) {
    if (!this.initialized) return;

    this.worldSnapshotAccumMs += delta;
    this.garrisonSyncAccumMs += delta;

    if (this.worldSnapshotAccumMs >= WORLD_CLOCK_CONFIG.worldSnapshotIntervalMs) {
      this.worldSnapshotAccumMs = 0;
      void this.saveWorldSnapshot();
    }

    if (this.garrisonSyncAccumMs >= WORLD_CLOCK_CONFIG.garrisonSyncIntervalMs) {
      this.garrisonSyncAccumMs = 0;
      void this.saveLocalGarrison();
    }
  }

  public async persistAllSnapshots(): Promise<void> {
    await Promise.all([this.saveWorldSnapshot(), this.saveLocalGarrison()]);
  }

  public saveWorldSnapshot(): Promise<boolean> {
    const islands = this.ctx.getIslands();
    const waveState = this.waveSystem.getWaveState();

    const unlockedIslandIds: number[] = [];
    const villageTiers: Record<number, VillageTier> = {};
    const coreHps: Record<number, number> = {};

    for (const isl of islands) {
      if (isl.unlocked) {
        unlockedIslandIds.push(isl.id);
        villageTiers[isl.id] = isl.villageTier;
        coreHps[isl.id] = isl.coreHp;
      }
    }

    const state: WorldSyncState = {
      worldId: 'main_world',
      lastActiveAt: new Date().toISOString(),
      waveCount: waveState.waveCount,
      bossWaveCount: waveState.bossWaveCount,
      unlockedIslandIds,
      villageTiers,
      coreHps,
      constructedBuildings: this.ctx.getConstructedBuildings(),
    };

    // 로컬 영지 스토리지에도 최신 상태 반영
    storage.saveUnlockedIslands(unlockedIslandIds);
    storage.saveVillageTiers(villageTiers);
    storage.saveCoreHps(coreHps);
    storage.saveConstructedBuildings(state.constructedBuildings);

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
