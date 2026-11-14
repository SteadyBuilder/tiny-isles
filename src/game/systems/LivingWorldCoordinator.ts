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
    const [savedWorld, garrisons] = await Promise.all([
      worldStateSync.fetchWorldState(),
      worldStateSync.fetchGarrisons(localPlayerId),
    ]);

    if (this.disposed) return;

    this.garrisonSystem.setGarrisons(garrisons);
    EventBus.emit('garrisons-updated', garrisons);

    if (savedWorld) {
      this.waveSystem.syncCountsFromWorldState(
        savedWorld.waveCount,
        savedWorld.bossWaveCount
      );

      let baseIslands = this.ctx.getIslands();
      let baseBuildings = this.ctx.getConstructedBuildings();

      // 서버 DB(world_state)를 단일 진실 공급원(SSOT)으로 사용하여 영지 및 건물 상태 동기화
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
          return { ...isl, unlocked: isUnlocked, villageTier: tier, coreMaxHp: maxHp, coreHp };
        });
        if (Array.isArray(savedWorld.constructedBuildings)) {
          baseBuildings = savedWorld.constructedBuildings;
        }
        this.ctx.applyOfflineWorldUpdate(baseIslands, baseBuildings, {
          wood: 0,
          stone: 0,
          gold: 0,
        });
      }

      const savedMonsters = Array.isArray(savedWorld.activeMonsters)
        ? savedWorld.activeMonsters.filter((m) => m.hp > 0)
        : [];
      const hasBossActive = savedMonsters.some((m) => m.isBoss);

      const resolution = resolveOfflinePeriod({
        lastActiveAtIso: savedWorld.lastActiveAt,
        nowMs: Date.now(),
        baseWaveCount: savedWorld.waveCount,
        baseBossWaveCount: savedWorld.bossWaveCount,
        islands: baseIslands,
        constructedBuildings: baseBuildings,
        garrisons,
        activeMonstersCount: savedMonsters.length,
        hasBossActive,
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
      } else if (savedMonsters.length > 0) {
        // 5분 미만 재접속 등 오프라인 정산 대상이 아닌 경우 진행 중이던 몬스터 복원
        this.waveSystem.restoreMonsters(savedMonsters);
      }
    }

    if (this.disposed) return;
    if (this.waveSystem.getIsHost()) {
      await this.persistAllSnapshots();
    } else {
      await this.saveLocalGarrison();
    }
  }

  private emitOfflineReport(report: OfflineResolutionReport) {
    EventBus.emit('offline-report-ready', report);
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
      activeMonsters: this.waveSystem.getMonsters(),
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
