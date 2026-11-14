import confetti from 'canvas-confetti';
import { GOLD_MINE_BIOME_CONFIG } from '../../../data/biomes';
import { ACTIVE_WAVE_ACCELERATION_CONFIG } from '../../../data/worldRules';
import { serverSync } from '../../../lib/serverSync';
import { sound } from '../../../lib/sound';
import {
  ConstructableType,
  ConstructedBuilding,
  Inventory,
  Island,
  VillageTier,
} from '../../../types/game';
import { BuildingSystem } from '../../BuildingSystem';
import {
  VILLAGE_TIER_CONFIGS,
  getIslandOrigin,
  getTerritoryCorePos,
} from '../../constants';
import { GameEvents } from '../../events/gameEvents';

export interface ITerritoryActionContext {
  getIslands: () => Island[];
  getConstructedBuildings: () => ConstructedBuilding[];
  getInventory: () => Inventory;
  spendInventory: (wood: number, stone: number, gold: number) => void;
  saveWorldState: (immediate?: boolean) => void;
  emitWorldStateToReact: (immediate?: boolean) => void;
  drawTerrainDecorations: () => void;
  drawExpansionAltars: () => void;
  spawnAllBuildings: () => void;
  createTerritoryCoreForIsland: (isl: Island) => void;
  updateCoreGemVisual: (territoryId: number) => void;
  spawnConstructedBuildingVisual: (cb: ConstructedBuilding) => void;
  updateConstructedBuildingHpBar: (buildingId: string) => void;
  hasConstructedBuildingContainer: (buildingId: string) => boolean;
  removeConstructedBuildingVisual: (buildingId: string) => void;
  spawnGoldMineClusterAndAnnounce: () => void;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
  playExplosionAt: (x: number, y: number) => void;
  reduceWaveCooldown: (seconds: number) => void;
  broadcastUnlock: (islandId: number, unlockedBy: string) => void;
  broadcastVillageUpgrade: (territoryId: number, nextTier: VillageTier) => void;
  broadcastBuildingConstructed: (cb: ConstructedBuilding) => void;
}

/**
 * 영지 개척, 마을 승급, 건물 건설/파괴, 코어 보석 및 방책 수리를 담당하는 컨트롤러
 */
export class TerritoryActionController {
  private ctx: ITerritoryActionContext;

  constructor(ctx: ITerritoryActionContext) {
    this.ctx = ctx;
  }

  /**
   * 마을 발전 처리:
   * 점령지(0) -> 개척마을(1) -> 중소마을(2) -> 큰마을(3) -> 소도시(4) -> 중소도시(5) -> 대도시(6)
   */
  public handleUpgradeVillage(territoryId: number, isLocalTrigger = true): boolean {
    const isl = this.ctx.getIslands().find((i) => i.id === territoryId);
    if (!isl || !isl.unlocked) return false;

    if (isl.villageTier >= 6) {
      if (isLocalTrigger) {
        const cPos = getTerritoryCorePos(isl.gridX, isl.gridY);
        this.ctx.showFloatingText(cPos.x, cPos.y - 60, '이미 최고 단계(대도시)에 도달했습니다.', '#f87171');
      }
      return false;
    }

    let nextTier = (isl.villageTier + 1) as VillageTier;
    if (isLocalTrigger) {
      const check = BuildingSystem.checkUpgrade(isl, this.ctx.getInventory());
      if (!check.canUpgrade || !check.nextTier) {
        const cPos = getTerritoryCorePos(isl.gridX, isl.gridY);
        this.ctx.showFloatingText(cPos.x, cPos.y - 60, check.reason || '마을 승급 불가', '#f87171');
        return false;
      }
      nextTier = check.nextTier;
      this.ctx.spendInventory(check.costWood, check.costStone, check.costGold);
    }

    const nextCfg = VILLAGE_TIER_CONFIGS[nextTier];

    isl.villageTier = nextTier;
    isl.coreMaxHp = nextCfg.coreMaxHp;
    isl.coreHp = nextCfg.coreMaxHp; // 발전 시 코어 보석 완전 회복!

    this.ctx.saveWorldState();
    this.ctx.drawTerrainDecorations();
    this.ctx.spawnAllBuildings();
    this.ctx.updateCoreGemVisual(isl.id);
    this.ctx.emitWorldStateToReact();

    sound.playUnlock();
    confetti({ particleCount: 70, spread: 65, origin: { y: 0.6 } });

    const cPos = getTerritoryCorePos(isl.gridX, isl.gridY);
    const msg =
      nextTier === 1
        ? `🏡 [${isl.name}]에 새로운 '개척마을'을 세웠습니다!`
        : `🎉 [${isl.name}]이(가) '${nextCfg.name}'(으)로 발전했습니다! (코어 HP ${isl.coreMaxHp}, 슬롯 ${nextCfg.maxBuildings}개)`;
    this.ctx.showFloatingText(cPos.x, cPos.y - 75, msg, '#4ade80');
    GameEvents.emit('game-alert', msg);

    if (isLocalTrigger) {
      this.ctx.broadcastVillageUpgrade(territoryId, nextTier);
    }
    return true;
  }

  /**
   * 점령한 땅에 방어 타워, 성벽, 기본건물, 특수건물 건설
   */
  public handleConstructBuilding(
    territoryId: number,
    type: ConstructableType,
    preferredSlotIndex?: number | boolean,
    isLocalTrigger = true
  ): boolean {
    const isl = this.ctx.getIslands().find((i) => i.id === territoryId);
    if (!isl || !isl.unlocked) return false;

    const slotIdx = typeof preferredSlotIndex === 'number' ? preferredSlotIndex : undefined;
    const isLocal = typeof preferredSlotIndex === 'boolean' ? preferredSlotIndex : isLocalTrigger;
    const constructedBuildings = this.ctx.getConstructedBuildings();

    const check = BuildingSystem.checkBuild(
      isl,
      type,
      this.ctx.getInventory(),
      constructedBuildings,
      slotIdx
    );

    if (!check.canBuild || check.slotIndex === undefined) {
      const cPos = getTerritoryCorePos(isl.gridX, isl.gridY);
      this.ctx.showFloatingText(cPos.x, cPos.y - 60, check.reason || '건설 불가', '#f87171');
      return false;
    }

    const bp = check.blueprint;
    const finalSlotIndex = check.slotIndex;

    if (isLocal) {
      this.ctx.spendInventory(bp.costWood, bp.costStone, bp.costGold);
    }

    const newBuilding = BuildingSystem.createConstructedBuilding(isl, type, finalSlotIndex);
    constructedBuildings.push(newBuilding);
    this.ctx.spawnConstructedBuildingVisual(newBuilding);
    this.ctx.saveWorldState();
    this.ctx.emitWorldStateToReact();

    sound.playUnlock();
    this.ctx.showFloatingText(
      newBuilding.x,
      newBuilding.y - 45,
      `🏗️ [${bp.categoryLabel}] ${bp.name} 건설 완료! (#${finalSlotIndex} 슬롯)`,
      '#38bdf8'
    );

    if (isLocal) {
      this.ctx.broadcastBuildingConstructed(newBuilding);
      this.ctx.reduceWaveCooldown(ACTIVE_WAVE_ACCELERATION_CONFIG.buildCooldownReductionSec);
    }
    return true;
  }

  public handleRepairCore(territoryId: number): void {
    const isl = this.ctx.getIslands().find((i) => i.id === territoryId);
    if (!isl || !isl.unlocked) return;

    const constructedBuildings = this.ctx.getConstructedBuildings();
    const hasDamagedBuilding = constructedBuildings.some(
      (cb) => cb.territoryId === territoryId && cb.hp < cb.maxHp
    );
    const cPos = getTerritoryCorePos(isl.gridX, isl.gridY);

    if (isl.coreHp >= isl.coreMaxHp && !hasDamagedBuilding) {
      this.ctx.showFloatingText(
        cPos.x,
        cPos.y - 60,
        '💎 코어 보석과 방책이 이미 최대 체력입니다!',
        '#38bdf8'
      );
      return;
    }

    const inv = this.ctx.getInventory();
    if (inv.wood < 5 || inv.stone < 5) {
      this.ctx.showFloatingText(cPos.x, cPos.y - 60, '수리 자원 부족 (🪵5 🪨5 필요)', '#f87171');
      return;
    }

    this.ctx.spendInventory(5, 5, 0);

    isl.coreHp = Math.min(isl.coreMaxHp, isl.coreHp + 100);
    // 영지 내 성벽/방책도 함께 수리
    for (const cb of constructedBuildings) {
      if (cb.territoryId === territoryId) {
        cb.hp = Math.min(cb.maxHp, cb.hp + 80);
        this.ctx.updateConstructedBuildingHpBar(cb.id);
      }
    }

    this.ctx.updateCoreGemVisual(territoryId);
    this.ctx.saveWorldState();
    this.ctx.emitWorldStateToReact();
    sound.playUnlock();
    this.ctx.showFloatingText(cPos.x, cPos.y - 60, '✨ 코어 보석 및 방책 수리 완료! (+100 HP)', '#4ade80');
  }

  public unlockIslandLocally(islandId: number, unlockedBy: string, isLocalTrigger: boolean): void {
    const target = this.ctx.getIslands().find((i) => i.id === islandId);
    if (!target || target.unlocked) return;

    target.unlocked = true;
    target.villageTier = 0; // 새로 점령한 땅은 '점령지(0)'로 시작하며 이후 마을->중소마을->큰마을->소도시->중소도시->대도시로 발전 가능!
    target.coreMaxHp = VILLAGE_TIER_CONFIGS[0].coreMaxHp;
    target.coreHp = target.coreMaxHp;

    this.ctx.saveWorldState();
    this.ctx.drawTerrainDecorations();
    this.ctx.drawExpansionAltars();

    // 새 점령지에 코어 보석 생성 (마을 점령은 건물 건설 및 방어 거점 구축용)
    this.ctx.createTerritoryCoreForIsland(target);
    this.ctx.spawnAllBuildings();
    this.ctx.emitWorldStateToReact();

    sound.playUnlock();
    confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });

    const origin = getIslandOrigin(target.gridX, target.gridY);
    const msg = `🚩 ${unlockedBy}님이 '${target.name}' 영지를 점령했습니다! 건물을 세우고 마을로 발전시키세요!`;
    this.ctx.showFloatingText(origin.x + 320, origin.y + 240, msg, '#ffd700');

    if (islandId === GOLD_MINE_BIOME_CONFIG.unlockTerritoryId) {
      this.ctx.spawnGoldMineClusterAndAnnounce();
    } else {
      GameEvents.emit('game-alert', msg);
    }

    if (isLocalTrigger) {
      serverSync.saveUnlockedIsland(islandId, target.name, unlockedBy);
      this.ctx.broadcastUnlock(islandId, unlockedBy);
    }
  }

  public destroyConstructedBuilding(buildingId: string): void {
    const constructedBuildings = this.ctx.getConstructedBuildings();
    const idx = constructedBuildings.findIndex((b) => b.id === buildingId);
    if (idx === -1) return;
    const removed = constructedBuildings[idx];
    constructedBuildings.splice(idx, 1);

    if (this.ctx.hasConstructedBuildingContainer(buildingId)) {
      this.ctx.playExplosionAt(removed.x, removed.y);
      this.ctx.removeConstructedBuildingVisual(buildingId);
    }

    sound.playBreak();
    this.ctx.showFloatingText(removed.x, removed.y - 40, `💥 ${removed.name} 파괴됨!`, '#ef4444');
    this.ctx.saveWorldState(false);
    this.ctx.emitWorldStateToReact(false);
  }
}
