import Phaser from 'phaser';
import {
  LEVEL_PROGRESSION_CONFIG,
  PLAYER_CLASS_DEFINITIONS,
  getRequiredExpForLevel,
} from '../../data/classes';
import { RARITY_META } from '../../data/items';
import { INITIAL_POTION_INVENTORY, POTION_DEFINITIONS } from '../../data/potions';
import { sound } from '../../lib/sound';
import { SkillEffectContext } from '../../types/combat';
import {
  EquipmentItem,
  EquipmentSlot,
  EquippedItemsMap,
  PlayerClassDefinition,
  PlayerClassId,
  PlayerProgressionState,
  PotionId,
  PotionInventory,
} from '../../types/game';
import { GameEvents } from '../events/gameEvents';
import {
  EQUIPMENT_BAG_MAX_SIZE,
  pickBestUpgradeItemIds,
  pickInferiorSalvageIds,
} from '../utils/equipmentScoreUtils';
import {
  ComputedProgressionStats,
  computeProgressionStats,
} from '../utils/progressionStatsUtils';
import { MonsterVisual } from './MonsterVisualManager';
import { ProjectileSystem } from './ProjectileSystem';

export interface IPlayerProgressionContext {
  scene: Phaser.Scene;
  getPlayerId: () => string;
  getPlayerName: () => string;
  getPlayerPosition: () => { x: number; y: number };
  getPlayerDirection?: () => 'left' | 'right';
  isPlayerFainted?: () => boolean;
  getGold: () => number;
  spendGold: (amount: number) => void;
  addGold: (amount: number) => void;
  onMaxHpChanged: (newMaxHp: number, healDelta: number) => void;
  healPlayer: (amount: number) => void;
  onClassChangedVisual: (classId: PlayerClassId) => void;
  getMonsterVisuals: () => Map<string, MonsterVisual>;
  queryMonstersInRadius?: (x: number, y: number, radiusPx: number) => MonsterVisual[];
  damageMonster: (
    monsterId: string,
    damage: number,
    attackerName: string,
    attackerId: string,
    hitMeta?: { isSkill?: boolean; isCrit?: boolean }
  ) => void;
  tryDamageCampCoreInRadius?: (x: number, y: number, radius: number, damage: number) => boolean;
  projectileSystem: ProjectileSystem;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
  playExplosionAt: (x: number, y: number) => void;
  playSkillEffect?: (ctx: SkillEffectContext) => void;
  triggerSkillSurge?: (dirX: number, dirY: number, speedPx: number, durationMs: number) => void;
  getJobHallStatus?: () => { hasBuilt: boolean; isNear: boolean };
  getToolShopStatus?: () => { hasBuilt: boolean; isNear: boolean };
  getPlayerHpState?: () => { hp: number; maxHp: number; isFainted: boolean };
  playLevelUpEffect?: (x: number, y: number, level: number, delayMs?: number) => void;
  playClassAdvancementEffect?: (x: number, y: number, classId: PlayerClassId) => void;
}

/**
 * 사냥 특화 모드 개인별 경험치(EXP)·레벨업·전직(4클래스)·장비/세트 인벤토리·물약·액티브 스킬 전담 시스템
 */
export class PlayerProgressionSystem {
  private ctx: IPlayerProgressionContext;
  private level = 1;
  private exp = 0;
  private nextLevelExp = getRequiredExpForLevel(1);
  private jobPoints = 0;
  private classId: PlayerClassId = 'pawn';
  private skillCooldownRemainingMs = 0;
  private equipped: EquippedItemsMap = {
    weapon: null,
    armor: null,
    relic: null,
  };
  private bagItems: EquipmentItem[] = [];
  private potions: PotionInventory = { ...INITIAL_POTION_INVENTORY };
  private potionCooldownRemainingMs = 0;
  private hpRegenAccumulatorMs = 0;
  private cachedStats: ComputedProgressionStats | null = null;

  constructor(ctx: IPlayerProgressionContext) {
    this.ctx = ctx;
  }

  private invalidateStatsCache(): void {
    this.cachedStats = null;
  }

  public getClassDef(): PlayerClassDefinition {
    return PLAYER_CLASS_DEFINITIONS[this.classId];
  }

  public getClassId(): PlayerClassId {
    return this.classId;
  }

  public getLevel(): number {
    return this.level;
  }

  public getComputedStats(): ComputedProgressionStats {
    if (!this.cachedStats) {
      this.cachedStats = computeProgressionStats(this.level, this.getClassDef(), this.equipped);
    }
    return this.cachedStats;
  }

  public getTotalAttack(): number {
    return this.getComputedStats().totalAttack;
  }

  public getTotalMaxHp(): number {
    return this.getComputedStats().totalMaxHp;
  }

  public getTotalSpeed(): number {
    return this.getComputedStats().totalSpeed;
  }

  public getEffectiveAttackCooldownMs(): number {
    const cls = this.getClassDef();
    const atkSpd = this.getComputedStats().totalAttackSpeedPercent;
    return Math.max(120, Math.round(cls.attackCooldownMs / (1 + atkSpd / 100)));
  }

  public getEffectiveAttackRange(): number {
    const cls = this.getClassDef();
    return cls.attackRange + this.getComputedStats().totalAttackRangeBonus;
  }

  public getDamageReductionPercent(): number {
    return this.getComputedStats().totalDamageReductionPercent;
  }

  public getThornsDamage(): number {
    return this.getComputedStats().totalThornsDamage;
  }

  public rollDamageWithAffixes(baseDamage: number): {
    finalDamage: number;
    isCrit: boolean;
    lifestealHeal: number;
  } {
    const stats = this.getComputedStats();
    const isCrit = Math.random() * 100 < stats.totalCritChance;
    const critMult = stats.totalCritDamagePercent / 100;
    const finalDamage = isCrit ? Math.round(baseDamage * critMult) : baseDamage;
    const lifestealHeal =
      stats.totalLifestealPercent > 0
        ? Math.max(1, Math.round((finalDamage * stats.totalLifestealPercent) / 100))
        : 0;
    return { finalDamage, isCrit, lifestealHeal };
  }

  public getState(): PlayerProgressionState {
    const cls = this.getClassDef();
    const stats = this.getComputedStats();
    const cdrRatio = 1 - stats.totalCooldownReductionPercent / 100;
    return {
      level: this.level,
      exp: this.exp,
      nextLevelExp: this.nextLevelExp,
      jobPoints: this.jobPoints,
      classId: this.classId,
      skillCooldownRemainingMs: Math.max(0, Math.ceil(this.skillCooldownRemainingMs)),
      skillCooldownMaxMs: Math.round(cls.skillCooldownMs * cdrRatio),
      equipped: { ...this.equipped },
      bagItems: [...this.bagItems],
      potions: { ...this.potions },
      potionCooldownRemainingMs: Math.max(0, Math.ceil(this.potionCooldownRemainingMs)),
      ...stats,
    };
  }

  public emitState(): void {
    GameEvents.emit('player-progression-updated', this.getState());
  }

  public gainExp(amount: number): void {
    if (amount <= 0) return;
    this.exp += amount;
    const gainedLevels: number[] = [];
    let hpGainTotal = 0;

    while (this.level < LEVEL_PROGRESSION_CONFIG.maxLevel && this.exp >= this.nextLevelExp) {
      this.exp -= this.nextLevelExp;
      this.level += 1;
      this.nextLevelExp = getRequiredExpForLevel(this.level);
      hpGainTotal += LEVEL_PROGRESSION_CONFIG.hpGainPerLevel;
      gainedLevels.push(this.level);

      if (this.level === LEVEL_PROGRESSION_CONFIG.firstJobAdvancementLevel) {
        this.jobPoints += 1;
        GameEvents.emit(
          'game-alert',
          `🌟 Lv.${LEVEL_PROGRESSION_CONFIG.firstJobAdvancementLevel} 달성! 전직 포인트 획득! 마을에 [왕국 전직소]를 건설하고 전직소 앞으로 이동해 [E] 키로 전직하세요!`
        );
      }
    }

    if (gainedLevels.length > 0) {
      this.invalidateStatsCache();
      sound.playLevelUp();
      const pos = this.ctx.getPlayerPosition();
      this.ctx.onMaxHpChanged(this.getTotalMaxHp(), hpGainTotal + 35);
      gainedLevels.forEach((lv, idx) => {
        if (this.ctx.playLevelUpEffect) {
          this.ctx.playLevelUpEffect(pos.x, pos.y, lv, idx * 260);
        } else {
          this.ctx.showFloatingText(
            pos.x,
            pos.y - 62 - idx * 20,
            `🆙 LEVEL UP! Lv.${lv} (공격력 ${this.getTotalAttack()})`,
            '#fde047'
          );
        }
      });
    }
    this.emitState();
  }

  public grantRewardItem(item: EquipmentItem): void {
    if (this.bagItems.length >= EQUIPMENT_BAG_MAX_SIZE) {
      this.bagItems.shift();
    }
    this.bagItems.push(item);

    // 해당 슬롯이 비어 있으면 자동 장착하여 즉시 전투력 체감 제공
    if (!this.equipped[item.slot]) {
      this.equipItem(item.instanceId);
      return;
    }

    const rarityMeta = RARITY_META[item.rarity];
    const pos = this.ctx.getPlayerPosition();
    this.ctx.showFloatingText(
      pos.x,
      pos.y - 72,
      `🎁 [${rarityMeta.label}] ${item.name} 획득! ([I] 인벤토리)`,
      rarityMeta.colorHex
    );
    this.emitState();
  }

  public equipItem(instanceId: string): void {
    const idx = this.bagItems.findIndex((i) => i.instanceId === instanceId);
    if (idx === -1) return;

    const item = this.bagItems[idx];
    const prevMaxHp = this.getTotalMaxHp();
    const currentlyEquipped = this.equipped[item.slot];

    this.bagItems.splice(idx, 1);
    if (currentlyEquipped) {
      this.bagItems.push(currentlyEquipped);
    }
    this.equipped[item.slot] = item;
    this.invalidateStatsCache();

    const newMaxHp = this.getTotalMaxHp();
    this.ctx.onMaxHpChanged(newMaxHp, Math.max(0, newMaxHp - prevMaxHp));
    sound.playClick();
    this.emitState();
  }

  public unequipSlot(slot: EquipmentSlot): void {
    const current = this.equipped[slot];
    if (!current) return;
    if (this.bagItems.length >= EQUIPMENT_BAG_MAX_SIZE) {
      GameEvents.emit('game-alert', '🎒 가방이 가득 찼습니다! 불필요한 장비를 먼저 분해해 주세요.');
      return;
    }
    this.equipped[slot] = null;
    this.invalidateStatsCache();
    this.bagItems.push(current);
    this.ctx.onMaxHpChanged(this.getTotalMaxHp(), 0);
    sound.playClick();
    this.emitState();
  }

  public salvageItem(instanceId: string): void {
    const idx = this.bagItems.findIndex((i) => i.instanceId === instanceId);
    if (idx === -1) return;
    const [removed] = this.bagItems.splice(idx, 1);
    this.ctx.addGold(removed.salvageGold);
    sound.playMine();
    const pos = this.ctx.getPlayerPosition();
    this.ctx.showFloatingText(
      pos.x,
      pos.y - 45,
      `🔨 장비 분해 (+🪙${removed.salvageGold})`,
      '#fbbf24'
    );
    this.emitState();
  }

  public equipRecommendedItems(): void {
    let equippedCount = 0;
    // 세트 시너지 변화로 다른 슬롯 추천이 연쇄 갱신될 수 있으므로 최대 3회 순회
    for (let pass = 0; pass < 3; pass++) {
      const ids = pickBestUpgradeItemIds(this.bagItems, this.equipped, this.classId);
      if (ids.length === 0) break;
      for (const id of ids) {
        this.equipItem(id);
        equippedCount += 1;
      }
    }
    if (equippedCount > 0) {
      sound.playUnlock();
      GameEvents.emit('game-alert', `✨ 최적 추천 장비 ${equippedCount}종을 자동 장착했습니다!`);
    } else {
      GameEvents.emit('game-alert', '✅ 현재 장착 중인 장비가 이미 최고 효율입니다!');
    }
  }

  public salvageInferiorItems(): void {
    const ids = pickInferiorSalvageIds(this.bagItems, this.equipped, this.classId, true);
    if (ids.length === 0) {
      GameEvents.emit('game-alert', '🧹 분해할 하위 비추천 장비가 없습니다. (세트 장비는 보호됩니다)');
      return;
    }
    const idSet = new Set(ids);
    let totalGold = 0;
    const remaining: EquipmentItem[] = [];
    for (const item of this.bagItems) {
      if (idSet.has(item.instanceId)) {
        totalGold += item.salvageGold;
      } else {
        remaining.push(item);
      }
    }
    this.bagItems = remaining;
    this.ctx.addGold(totalGold);
    sound.playMine();
    const pos = this.ctx.getPlayerPosition();
    this.ctx.showFloatingText(
      pos.x,
      pos.y - 50,
      `🔨 하위 장비 ${ids.length}개 일괄 분해 (+🪙${totalGold})`,
      '#fbbf24'
    );
    GameEvents.emit(
      'game-alert',
      `🔨 비추천 하위 장비 ${ids.length}개를 일괄 분해하여 🪙${totalGold} 금화를 획득했습니다!`
    );
    this.emitState();
  }

  public selectClass(targetClassId: PlayerClassId): boolean {
    if (targetClassId === this.classId) return false;
    const def = PLAYER_CLASS_DEFINITIONS[targetClassId];
    if (!def) return false;

    const jobHallStatus = this.ctx.getJobHallStatus?.() ?? { hasBuilt: true, isNear: true };
    if (!jobHallStatus.hasBuilt) {
      GameEvents.emit(
        'game-alert',
        '⚠️ 먼저 마을에 [왕국 전직소] 건물을 건설해야 전직할 수 있습니다.'
      );
      return false;
    }
    if (!jobHallStatus.isNear) {
      GameEvents.emit(
        'game-alert',
        '⚠️ [왕국 전직소] 건물 앞으로 이동해야 전직할 수 있습니다.'
      );
      return false;
    }

    if (this.level < def.requiredLevel) {
      GameEvents.emit(
        'game-alert',
        `⚠️ 전직에는 최소 Lv.${def.requiredLevel} 이상이 필요합니다. (현재 Lv.${this.level})`
      );
      return false;
    }

    const isFirstAdvancement = this.classId === 'pawn' && this.jobPoints > 0;
    const goldCost = isFirstAdvancement ? 0 : def.costGold;

    if (this.ctx.getGold() < goldCost) {
      GameEvents.emit('game-alert', `⚠️ 클래스 전환에 금화 🪙${goldCost}개가 필요합니다.`);
      return false;
    }

    if (goldCost > 0) {
      this.ctx.spendGold(goldCost);
    }
    if (isFirstAdvancement) {
      this.jobPoints = Math.max(0, this.jobPoints - 1);
    }

    const prevMaxHp = this.getTotalMaxHp();
    this.classId = targetClassId;
    this.invalidateStatsCache();
    const newMaxHp = this.getTotalMaxHp();
    this.ctx.onMaxHpChanged(newMaxHp, Math.max(20, newMaxHp - prevMaxHp));
    this.ctx.onClassChangedVisual(targetClassId);

    sound.playClassAdvance();
    const pos = this.ctx.getPlayerPosition();
    if (this.ctx.playClassAdvancementEffect) {
      this.ctx.playClassAdvancementEffect(pos.x, pos.y, targetClassId);
    } else {
      this.ctx.playExplosionAt(pos.x, pos.y);
      this.ctx.showFloatingText(
        pos.x,
        pos.y - 65,
        `✨ [${def.name}] 전직 완료! ([Q] ${def.skillName})`,
        '#38bdf8'
      );
    }
    GameEvents.emit(
      'game-alert',
      `🎉 ${def.icon} [${def.name}] 클래스로 전직했습니다! [Q] 키로 전용 스킬 '${def.skillName}'을 사용할 수 있습니다!`
    );
    this.emitState();
    return true;
  }

  public castActiveSkill(): void {
    if (this.skillCooldownRemainingMs > 0 || this.ctx.isPlayerFainted?.()) return;
    const cls = this.getClassDef();
    const stats = this.getComputedStats();
    const cdrRatio = 1 - stats.totalCooldownReductionPercent / 100;
    this.skillCooldownRemainingMs = Math.round(cls.skillCooldownMs * cdrRatio);

    const pos = this.ctx.getPlayerPosition();
    const facingDir = this.ctx.getPlayerDirection?.() ?? 'right';
    const skillAmp = 1 + stats.totalSkillDamagePercent / 100;
    const baseSkillDmg = Math.round(stats.totalAttack * cls.skillDamageMultiplier * skillAmp);

    sound.playSkillCast(this.classId);
    this.ctx.showFloatingText(pos.x, pos.y - 58, `${cls.skillIcon} ${cls.skillName}!`, '#38bdf8');

    const dealSkillHit = (targetId: string, tx: number, ty: number) => {
      const rolled = this.rollDamageWithAffixes(baseSkillDmg);
      this.ctx.damageMonster(
        targetId,
        rolled.finalDamage,
        this.ctx.getPlayerName(),
        this.ctx.getPlayerId(),
        { isSkill: true, isCrit: rolled.isCrit }
      );
      if (rolled.isCrit) {
        this.ctx.showFloatingText(tx, ty - 42, '💥 치명타!', '#fde047');
      }
      if (rolled.lifestealHeal > 0) {
        this.ctx.healPlayer(rolled.lifestealHeal);
      }
    };

    const initialCandidates =
      this.ctx.queryMonstersInRadius?.(pos.x, pos.y, cls.skillRadius) ??
      this.ctx.getMonsterVisuals().values();
    const targetsInRange = Array.from(initialCandidates)
      .filter((mv) => mv.monster.hp > 0)
      .map((mv) => ({ mv, dist: Math.hypot(mv.monster.x - pos.x, mv.monster.y - pos.y) }))
      .filter((item) => item.dist <= cls.skillRadius)
      .sort((a, b) => a.dist - b.dist);

    if (cls.id === 'lancer') {
      const primary = targetsInRange[0]?.mv;
      const dirX = primary ? primary.monster.x - pos.x : facingDir === 'left' ? -1 : 1;
      const dirY = primary ? primary.monster.y - pos.y : 0;
      this.ctx.triggerSkillSurge?.(dirX, dirY, 920, 150);
    }

    const executeImpact = () => {
      const latestPos = this.ctx.getPlayerPosition();
      if (cls.id === 'ranger') {
        const chosen = targetsInRange.slice(0, 10);
        for (const { mv } of chosen) {
          if (mv.monster.hp <= 0) continue;
          dealSkillHit(mv.monster.id, mv.monster.x, mv.monster.y);
        }
        this.ctx.tryDamageCampCoreInRadius?.(latestPos.x, latestPos.y, cls.skillRadius, baseSkillDmg);
        return;
      }

      const impactCandidates =
        this.ctx.queryMonstersInRadius?.(latestPos.x, latestPos.y, cls.skillRadius) ??
        this.ctx.getMonsterVisuals().values();
      for (const mv of impactCandidates) {
        if (mv.monster.hp <= 0) continue;
        const d = Math.hypot(mv.monster.x - latestPos.x, mv.monster.y - latestPos.y);
        if (d <= cls.skillRadius) {
          dealSkillHit(mv.monster.id, mv.monster.x, mv.monster.y);
        }
      }
      this.ctx.tryDamageCampCoreInRadius?.(latestPos.x, latestPos.y, cls.skillRadius, baseSkillDmg);
    };

    if (this.ctx.playSkillEffect) {
      this.ctx.playSkillEffect({
        classId: cls.id,
        casterX: pos.x,
        casterY: pos.y,
        facingDir,
        radius: cls.skillRadius,
        targetPoints: targetsInRange.slice(0, 10).map((t) => ({
          x: t.mv.monster.x,
          y: t.mv.monster.y,
        })),
        onImpact: executeImpact,
      });
    } else {
      this.ctx.playExplosionAt(pos.x, pos.y);
      executeImpact();
    }

    if (cls.id === 'guardian') {
      this.ctx.healPlayer(25);
    } else if (cls.id === 'archmage') {
      this.ctx.healPlayer(40);
    }

    this.emitState();
  }

  public grantPotion(potionId: PotionId, count = 1): number {
    if (count <= 0) return 0;
    const def = POTION_DEFINITIONS[potionId];
    if (!def) return 0;
    const prev = this.potions[potionId] ?? 0;
    const next = Math.min(def.maxStack, prev + count);
    const added = next - prev;
    if (added > 0) {
      this.potions[potionId] = next;
      this.emitState();
    }
    return added;
  }

  public buyPotion(potionId: PotionId): boolean {
    const def = POTION_DEFINITIONS[potionId];
    if (!def) return false;

    const shopStatus = this.ctx.getToolShopStatus?.();
    if (shopStatus && !shopStatus.hasBuilt) {
      GameEvents.emit('game-alert', '🏗️ 먼저 영지에 [도구 상점]을 건설해야 물약을 구매할 수 있습니다!');
      return false;
    }
    if (shopStatus && !shopStatus.isNear) {
      GameEvents.emit('game-alert', '🚶 [도구 상점] 건물 앞으로 이동해야 구매할 수 있습니다!');
      return false;
    }

    const currentCount = this.potions[potionId] ?? 0;
    if (currentCount >= def.maxStack) {
      GameEvents.emit('game-alert', `🎒 ${def.name}은(는) 최대 ${def.maxStack}개까지 소지할 수 있습니다.`);
      return false;
    }

    if (this.ctx.getGold() < def.costGold) {
      GameEvents.emit('game-alert', `🪙 금화가 부족합니다! (필요: ${def.costGold} 금화)`);
      return false;
    }

    this.ctx.spendGold(def.costGold);
    this.potions[potionId] = currentCount + 1;
    sound.playUnlock();
    const pos = this.ctx.getPlayerPosition();
    this.ctx.showFloatingText(pos.x, pos.y - 45, `${def.icon} ${def.name} 구매!`, '#fde047');
    this.emitState();
    return true;
  }

  public usePotion(potionId: PotionId): boolean {
    if (this.ctx.isPlayerFainted?.()) return false;
    const def = POTION_DEFINITIONS[potionId];
    if (!def) return false;

    const count = this.potions[potionId] ?? 0;
    if (count <= 0) {
      GameEvents.emit('game-alert', `${def.icon} ${def.name}이(가) 없습니다. 도구 상점에서 구매하거나 사냥으로 획득하세요!`);
      return false;
    }

    if (this.potionCooldownRemainingMs > 0) {
      return false;
    }

    const hpState = this.ctx.getPlayerHpState?.();
    if (hpState && hpState.hp >= hpState.maxHp) {
      const pos = this.ctx.getPlayerPosition();
      this.ctx.showFloatingText(pos.x, pos.y - 40, '💚 이미 체력이 가득 찼습니다!', '#86efac');
      return false;
    }

    this.potions[potionId] = count - 1;
    this.potionCooldownRemainingMs = def.cooldownMs;
    this.ctx.healPlayer(def.healAmount);
    sound.playHeal();
    this.emitState();
    return true;
  }

  public update(deltaMs: number): void {
    let dirty = false;

    if (this.skillCooldownRemainingMs > 0) {
      const prevSec = Math.ceil(this.skillCooldownRemainingMs / 250);
      this.skillCooldownRemainingMs = Math.max(0, this.skillCooldownRemainingMs - deltaMs);
      const nextSec = Math.ceil(this.skillCooldownRemainingMs / 250);
      if (prevSec !== nextSec || this.skillCooldownRemainingMs === 0) {
        dirty = true;
      }
    }

    if (this.potionCooldownRemainingMs > 0) {
      const prevSec = Math.ceil(this.potionCooldownRemainingMs / 250);
      this.potionCooldownRemainingMs = Math.max(0, this.potionCooldownRemainingMs - deltaMs);
      const nextSec = Math.ceil(this.potionCooldownRemainingMs / 250);
      if (prevSec !== nextSec || this.potionCooldownRemainingMs === 0) {
        dirty = true;
      }
    }

    const hpRegen = this.getComputedStats().totalHpRegenPerSec;
    if (hpRegen > 0 && !this.ctx.isPlayerFainted?.()) {
      this.hpRegenAccumulatorMs += deltaMs;
      if (this.hpRegenAccumulatorMs >= 1000) {
        const ticks = Math.floor(this.hpRegenAccumulatorMs / 1000);
        this.hpRegenAccumulatorMs -= ticks * 1000;
        const hpState = this.ctx.getPlayerHpState?.();
        if (!hpState || hpState.hp < hpState.maxHp) {
          this.ctx.healPlayer(hpRegen * ticks);
        }
      }
    }

    if (dirty) {
      this.emitState();
    }
  }
}
