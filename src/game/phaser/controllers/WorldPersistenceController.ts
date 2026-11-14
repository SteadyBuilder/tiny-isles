import { storage } from '../../../lib/storage';
import {
  ConstructableType,
  ConstructedBuilding,
  Entity,
  Inventory,
  Island,
  Monster,
  VillageTier,
  WaveState,
} from '../../../types/game';
import { BuildingSystem } from '../../BuildingSystem';
import { INITIAL_ISLANDS, VILLAGE_TIER_CONFIGS } from '../../constants';
import { GameEvents } from '../../events/gameEvents';
import { WorldTerrainMap } from '../../world/MapTerrainGenerator';

export interface IWorldPersistenceContext {
  isSceneAlive: () => boolean;
  getPlayerName: () => string;
  getIslands: () => Island[];
  getConstructedBuildings: () => ConstructedBuilding[];
  getEntities: () => Entity[];
  getTerrainMap: () => WorldTerrainMap;
  getMonsters: () => Monster[];
  getWaveState: () => WaveState;
  getInventory: () => Inventory;
  setInventory: (inv: Inventory) => void;
  triggerRegularWave: () => void;
  triggerBossWave: () => void;
  damageTerritoryCore: (territoryId: number, dmg: number) => void;
  unlockTerritory: (territoryId: number, unlockedBy: string) => void;
  upgradeVillage: (territoryId: number) => void;
  constructBuilding: (territoryId: number, type: ConstructableType, slotIndex?: number) => void;
}

/**
 * 월드 초기 상태 로드, 디바운스 저장/React 동기화 및 디버그 테스트 훅 등록 컨트롤러
 */
export class WorldPersistenceController {
  private ctx: IWorldPersistenceContext;
  private saveWorldTimer: ReturnType<typeof setTimeout> | null = null;
  private emitWorldTimer: ReturnType<typeof setTimeout> | null = null;
  private hasPendingSaveWorld = false;

  constructor(ctx: IWorldPersistenceContext) {
    this.ctx = ctx;
  }

  public loadInitialWorldData(): {
    islands: Island[];
    constructedBuildings: ConstructedBuilding[];
  } {
    const savedUnlocked = storage.loadUnlockedIslands();
    const savedTiers = storage.loadVillageTiers();
    const savedCoreHps = storage.loadCoreHps();
    const constructedBuildings = storage.loadConstructedBuildings();

    const islands = INITIAL_ISLANDS.map((isl: Island) => {
      const isUnlocked = savedUnlocked.includes(isl.id) || isl.id === 0;
      const defaultTier: VillageTier = isl.id === 0 ? 2 : 0;
      const tier: VillageTier = isUnlocked
        ? savedTiers[isl.id] !== undefined
          ? savedTiers[isl.id]
          : defaultTier
        : 0;
      const maxHp = VILLAGE_TIER_CONFIGS[tier].coreMaxHp;
      const curHp =
        savedCoreHps[isl.id] !== undefined
          ? Math.min(maxHp, Math.max(1, savedCoreHps[isl.id]))
          : maxHp;

      return {
        ...isl,
        unlocked: isUnlocked,
        villageTier: tier,
        coreHp: curHp,
        coreMaxHp: maxHp,
      };
    }).map((isl: Island) => BuildingSystem.ensureCentralVillageState(isl));

    return { islands, constructedBuildings };
  }

  public emitWorldStateToReact(immediate = true): void {
    if (immediate) {
      if (this.emitWorldTimer) {
        clearTimeout(this.emitWorldTimer);
        this.emitWorldTimer = null;
      }
      this.emitWorldStateNow();
      return;
    }

    if (this.emitWorldTimer) return;
    this.emitWorldTimer = setTimeout(() => {
      this.emitWorldTimer = null;
      if (!this.ctx.isSceneAlive()) return;
      this.emitWorldStateNow();
    }, 350);
  }

  public saveWorldState(immediate = true): void {
    if (immediate) {
      if (this.saveWorldTimer) {
        clearTimeout(this.saveWorldTimer);
        this.saveWorldTimer = null;
      }
      this.persistWorldStateNow();
      return;
    }

    this.hasPendingSaveWorld = true;
    if (this.saveWorldTimer) return;
    this.saveWorldTimer = setTimeout(() => {
      this.saveWorldTimer = null;
      if (!this.ctx.isSceneAlive()) return;
      this.persistWorldStateNow();
    }, 1200);
  }

  public flushAndDestroy(): void {
    if (this.saveWorldTimer) {
      clearTimeout(this.saveWorldTimer);
      this.saveWorldTimer = null;
    }
    if (this.emitWorldTimer) {
      clearTimeout(this.emitWorldTimer);
      this.emitWorldTimer = null;
    }
    if (this.hasPendingSaveWorld) {
      this.persistWorldStateNow();
    }
  }

  public exposeTestHook(): void {
    if (typeof window === 'undefined') return;
    const terrainMap = this.ctx.getTerrainMap();
    (window as unknown as Record<string, unknown>).__GAME_DEBUG__ = {
      getIslands: () => this.ctx.getIslands(),
      getConstructedBuildings: () => this.ctx.getConstructedBuildings(),
      getEntities: () => this.ctx.getEntities(),
      getTerrainSummary: () => ({
        cols: terrainMap.cols,
        rows: terrainMap.rows,
        waterBodies: terrainMap.waterBodies.length,
        bridges: terrainMap.bridges.length,
      }),
      getMonsters: () => this.ctx.getMonsters(),
      getWaveState: () => this.ctx.getWaveState(),
      getInventory: () => this.ctx.getInventory(),
      triggerRegularWave: () => this.ctx.triggerRegularWave(),
      triggerBossWave: () => this.ctx.triggerBossWave(),
      damageTerritoryCore: (territoryId: number, dmg: number) =>
        this.ctx.damageTerritoryCore(territoryId, dmg),
      unlockTerritory: (territoryId: number) =>
        this.ctx.unlockTerritory(territoryId, this.ctx.getPlayerName()),
      upgradeVillage: (territoryId: number) => this.ctx.upgradeVillage(territoryId),
      constructBuilding: (territoryId: number, type: ConstructableType, slotIndex?: number) =>
        this.ctx.constructBuilding(territoryId, type, slotIndex),
      setInventory: (inv: Inventory) => this.ctx.setInventory(inv),
    };
  }

  private emitWorldStateNow(): void {
    const islands = this.ctx.getIslands();
    const unlockedIds = islands.filter((i) => i.unlocked).map((i) => i.id);
    GameEvents.emit('unlocked-islands', { ids: unlockedIds, total: islands.length });
    GameEvents.emit('territories-updated', [...islands]);
    GameEvents.emit('constructed-buildings-updated', [...this.ctx.getConstructedBuildings()]);
  }

  private persistWorldStateNow(): void {
    this.hasPendingSaveWorld = false;
    const islands = this.ctx.getIslands();
    const unlockedIds = islands.filter((i) => i.unlocked).map((i) => i.id);
    storage.saveUnlockedIslands(unlockedIds);

    const tiers: Record<number, VillageTier> = {};
    const coreHps: Record<number, number> = {};
    for (const isl of islands) {
      if (isl.unlocked) {
        tiers[isl.id] = isl.villageTier;
        coreHps[isl.id] = isl.coreHp;
      }
    }
    storage.saveVillageTiers(tiers);
    storage.saveCoreHps(coreHps);
    storage.saveConstructedBuildings(this.ctx.getConstructedBuildings());
  }
}
