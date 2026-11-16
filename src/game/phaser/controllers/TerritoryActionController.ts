import type Phaser from 'phaser';
import confetti from 'canvas-confetti';
import { GOLD_MINE_BIOME_CONFIG } from '../../../data/biomes';
import { THREAT_WAVE_CONFIG } from '../../../data/worldRules';
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
import { canBuildInTerritory } from '../../territoryAccessRules';
import {
  VILLAGE_TIER_CONFIGS,
  getIslandOrigin,
  getTerritoryCorePos,
} from '../../constants';
import { GameEvents } from '../../events/gameEvents';

export interface ITerritoryActionContext {
  getPlayerId: () => string;
  getPlayerStandingTerritoryId: () => number | null;
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
  addThreat: (amount: number) => void;
  emitThreatOrb?: (worldX: number, worldY: number, amount: number) => void;
  broadcastUnlock: (islandId: number, unlockedBy: string, ownerId?: string) => void;
  broadcastVillageUpgrade: (territoryId: number, nextTier: VillageTier) => void;
  broadcastBuildingConstructed: (cb: ConstructedBuilding) => void;
  isHost?: () => boolean;
  getConstructedVisualContainer?: (buildingId: string) => Phaser.GameObjects.Container | undefined;
  shakeObject?: (target: Phaser.GameObjects.Container) => void;
  broadcastBuildingHpSync?: (
    buildingId: string,
    hp: number,
    maxHp: number,
    damageDelta?: number
  ) => void;
  broadcastBuildingDestroyed?: (buildingId: string) => void;
  broadcastCoreHpSync?: (
    territoryId: number,
    coreHp: number,
    coreMaxHp: number,
    damageDelta?: number
  ) => void;
  broadcastRepairTerritoryRequest?: (territoryId: number) => void;
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

    if (isLocalTrigger) {
      const access = canBuildInTerritory(
        isl,
        this.ctx.getPlayerId(),
        this.ctx.getPlayerStandingTerritoryId()
      );
      if (!access.allowed) {
        const cPos = getTerritoryCorePos(isl.gridX, isl.gridY);
        const reason = access.reason || '이 마을에서는 발전시킬 수 없습니다.';
        this.ctx.showFloatingText(cPos.x, cPos.y - 60, reason, '#f87171');
        GameEvents.emit('game-alert', reason);
        return false;
      }
    }

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
      this.ctx.emitThreatOrb?.(cPos.x, cPos.y, THREAT_WAVE_CONFIG.upgradeThreatGain);
      this.ctx.addThreat(THREAT_WAVE_CONFIG.upgradeThreatGain);
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
    isLocalTrigger = true,
    customPos?: { x: number; y: number }
  ): boolean {
    const isl = this.ctx.getIslands().find((i) => i.id === territoryId);
    if (!isl || !isl.unlocked) return false;

    const slotIdx = typeof preferredSlotIndex === 'number' ? preferredSlotIndex : undefined;
    const isLocal = typeof preferredSlotIndex === 'boolean' ? preferredSlotIndex : isLocalTrigger;

    if (isLocal) {
      const access = canBuildInTerritory(
        isl,
        this.ctx.getPlayerId(),
        this.ctx.getPlayerStandingTerritoryId()
      );
      if (!access.allowed) {
        const cPos = getTerritoryCorePos(isl.gridX, isl.gridY);
        const reason = access.reason || '이 마을에서는 건설할 수 없습니다.';
        this.ctx.showFloatingText(cPos.x, cPos.y - 60, reason, '#f87171');
        GameEvents.emit('game-alert', reason);
        return false;
      }
    }

    const constructedBuildings = this.ctx.getConstructedBuildings();

    const check = BuildingSystem.checkBuild(
      isl,
      type,
      this.ctx.getInventory(),
      constructedBuildings,
      slotIdx,
      customPos
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

    const newBuilding = BuildingSystem.createConstructedBuilding(
      isl,
      type,
      finalSlotIndex,
      check.customPos
    );
    constructedBuildings.push(newBuilding);
    this.ctx.spawnConstructedBuildingVisual(newBuilding);
    this.ctx.saveWorldState();
    this.ctx.emitWorldStateToReact();

    sound.playUnlock();
    const slotLabel = finalSlotIndex >= 0 ? `#${finalSlotIndex} 슬롯` : '외곽 자유 배치';
    this.ctx.showFloatingText(
      newBuilding.x,
      newBuilding.y - 45,
      `🏗️ [${bp.categoryLabel}] ${bp.name} 건설 완료! (${slotLabel})`,
      '#38bdf8'
    );

    if (isLocal) {
      this.ctx.broadcastBuildingConstructed(newBuilding);
      this.ctx.emitThreatOrb?.(newBuilding.x, newBuilding.y, THREAT_WAVE_CONFIG.buildThreatGain);
      this.ctx.addThreat(THREAT_WAVE_CONFIG.buildThreatGain);
    }
    return true;
  }

  public handleRepairCore(territoryId: number): void {
    const isl = this.ctx.getIslands().find((i) => i.id === territoryId);
    if (!isl || !isl.unlocked) return;

    const access = canBuildInTerritory(
      isl,
      this.ctx.getPlayerId(),
      this.ctx.getPlayerStandingTerritoryId()
    );
    if (!access.allowed) {
      const cPos = getTerritoryCorePos(isl.gridX, isl.gridY);
      const reason = access.reason || '이 마을에서는 수리할 수 없습니다.';
      this.ctx.showFloatingText(cPos.x, cPos.y - 60, reason, '#f87171');
      GameEvents.emit('game-alert', reason);
      return;
    }

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

    const isHost = this.ctx.isHost ? this.ctx.isHost() : true;
    if (!isHost) {
      // 게스트는 즉각적인 피드백만 낙관적으로 표시하고 권위 회복 연산은 호스트에 위임
      isl.coreHp = Math.min(isl.coreMaxHp, isl.coreHp + 100);
      for (const cb of constructedBuildings) {
        if (cb.territoryId === territoryId) {
          cb.hp = Math.min(cb.maxHp, cb.hp + 80);
          this.ctx.updateConstructedBuildingHpBar(cb.id);
        }
      }
      this.ctx.updateCoreGemVisual(territoryId);
      sound.playUnlock();
      this.ctx.showFloatingText(cPos.x, cPos.y - 60, '✨ 코어 보석 및 방책 수리 완료! (+100 HP)', '#4ade80');
      this.ctx.broadcastRepairTerritoryRequest?.(territoryId);
      return;
    }

    this.applyTerritoryRepairAndBroadcast(isl, constructedBuildings, true);
  }

  public handleRemoteRepairTerritoryRequest(territoryId: number): void {
    const isHost = this.ctx.isHost ? this.ctx.isHost() : true;
    if (!isHost) return;
    const isl = this.ctx.getIslands().find((i) => i.id === territoryId);
    if (!isl || !isl.unlocked) return;
    this.applyTerritoryRepairAndBroadcast(isl, this.ctx.getConstructedBuildings(), false);
  }

  private applyTerritoryRepairAndBroadcast(
    isl: Island,
    constructedBuildings: ConstructedBuilding[],
    playFeedback: boolean
  ): void {
    const cPos = getTerritoryCorePos(isl.gridX, isl.gridY);
    if (isl.coreHp < isl.coreMaxHp) {
      isl.coreHp = Math.min(isl.coreMaxHp, isl.coreHp + 100);
      this.ctx.updateCoreGemVisual(isl.id);
      this.ctx.broadcastCoreHpSync?.(isl.id, isl.coreHp, isl.coreMaxHp);
    }

    for (const cb of constructedBuildings) {
      if (cb.territoryId === isl.id && cb.hp < cb.maxHp) {
        cb.hp = Math.min(cb.maxHp, cb.hp + 80);
        this.ctx.updateConstructedBuildingHpBar(cb.id);
        this.ctx.broadcastBuildingHpSync?.(cb.id, cb.hp, cb.maxHp);
      }
    }

    this.ctx.saveWorldState();
    this.ctx.emitWorldStateToReact();
    if (playFeedback) {
      sound.playUnlock();
      this.ctx.showFloatingText(cPos.x, cPos.y - 60, '✨ 코어 보석 및 방책 수리 완료! (+100 HP)', '#4ade80');
    }
  }

  public unlockIslandLocally(
    islandId: number,
    unlockedBy: string,
    isLocalTrigger: boolean,
    ownerId?: string
  ): void {
    const target = this.ctx.getIslands().find((i) => i.id === islandId);
    if (!target) return;

    if (target.unlocked) {
      // 동시 점령 경합 시 결정론적 소유권 통일 (사전순으로 앞선 ownerId 우선)
      if (
        !isLocalTrigger &&
        islandId !== 0 &&
        ownerId &&
        target.ownerId &&
        ownerId !== target.ownerId &&
        ownerId.localeCompare(target.ownerId) < 0
      ) {
        target.ownerId = ownerId;
        target.ownerName = unlockedBy;
        this.ctx.saveWorldState();
        this.ctx.emitWorldStateToReact();
        GameEvents.emit(
          'game-alert',
          `🚩 '${target.name}' 영지 소유권이 ${unlockedBy}님으로 확정되었습니다.`
        );
      }
      return;
    }

    const resolvedOwnerId = isLocalTrigger ? ownerId ?? this.ctx.getPlayerId() : ownerId;
    target.unlocked = true;
    target.ownerId = target.id === 0 ? undefined : resolvedOwnerId;
    target.ownerName = target.id === 0 ? undefined : unlockedBy;
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

    const corePos = getTerritoryCorePos(target.gridX, target.gridY);
    const msg = `🚩 ${unlockedBy}님이 '${target.name}' 영지를 점령했습니다! 건물을 세우고 마을로 발전시키세요!`;
    this.ctx.showFloatingText(corePos.x, corePos.y - 110, msg, '#ffd700');

    if (islandId === GOLD_MINE_BIOME_CONFIG.unlockTerritoryId) {
      this.ctx.spawnGoldMineClusterAndAnnounce();
    } else {
      GameEvents.emit('game-alert', msg);
    }

    if (isLocalTrigger) {
      serverSync.saveUnlockedIsland(islandId, target.name, unlockedBy);
      this.ctx.broadcastUnlock(islandId, unlockedBy, resolvedOwnerId);
      this.ctx.emitThreatOrb?.(corePos.x, corePos.y, THREAT_WAVE_CONFIG.unlockThreatGain);
      this.ctx.addThreat(THREAT_WAVE_CONFIG.unlockThreatGain);
    }
  }

  public handleRemoteBuildingConstructed(cb: ConstructedBuilding): void {
    if (!cb) return;
    const constructedBuildings = this.ctx.getConstructedBuildings();
    if (constructedBuildings.some((b) => b.id === cb.id)) return;

    // 동시 건설 경합 체크: 동일 영지의 동일 슬롯(>=0) 또는 근접 자유 배치(-1)
    const conflict = constructedBuildings.find((b) => {
      if (b.territoryId !== cb.territoryId) return false;
      if (cb.slotIndex >= 0 && b.slotIndex === cb.slotIndex) return true;
      if (cb.slotIndex < 0 && b.slotIndex < 0) {
        return Math.hypot(b.x - cb.x, b.y - cb.y) < 40;
      }
      return false;
    });

    if (conflict) {
      // 결정론적 타이브레이크: id가 사전순으로 앞선 건물만 유지
      if (conflict.id.localeCompare(cb.id) <= 0) {
        return;
      }
      this.destroyConstructedBuilding(conflict.id, false);
    }

    constructedBuildings.push(cb);
    this.ctx.spawnConstructedBuildingVisual(cb);
    this.ctx.saveWorldState();
    this.ctx.emitWorldStateToReact();
  }

  public applyRemoteBuildingHpSync(
    buildingId: string,
    hp: number,
    maxHp: number,
    damageDelta?: number
  ): void {
    const cb = this.ctx.getConstructedBuildings().find((b) => b.id === buildingId);
    if (!cb) return;

    cb.maxHp = Math.max(1, maxHp);
    cb.hp = Math.max(0, Math.min(cb.maxHp, hp));
    this.ctx.updateConstructedBuildingHpBar(buildingId);

    if (damageDelta && damageDelta > 0) {
      const bCont = this.ctx.getConstructedVisualContainer?.(buildingId);
      if (bCont) this.ctx.shakeObject?.(bCont);
      this.ctx.showFloatingText(cb.x, cb.y - 30, `🛡️ -${damageDelta}`, '#fb923c');
    }

    this.ctx.saveWorldState(false);
    this.ctx.emitWorldStateToReact(false);
  }

  public destroyConstructedBuilding(buildingId: string, isLocalTrigger = true): void {
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

    if (isLocalTrigger && (this.ctx.isHost ? this.ctx.isHost() : true)) {
      this.ctx.broadcastBuildingDestroyed?.(buildingId);
    }
  }
}
