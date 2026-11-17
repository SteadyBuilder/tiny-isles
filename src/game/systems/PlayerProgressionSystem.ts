import Phaser from 'phaser';
import {
  LEVEL_PROGRESSION_CONFIG,
  PLAYER_CLASS_DEFINITIONS,
  getRequiredExpForLevel,
} from '../../data/classes';
import { RARITY_META } from '../../data/items';
import { PLAYER_COMBAT_CONFIG } from '../../data/worldRules';
import { sound } from '../../lib/sound';
import {
  EquipmentItem,
  EquipmentSlot,
  EquippedItemsMap,
  PlayerClassDefinition,
  PlayerClassId,
  PlayerProgressionState,
} from '../../types/game';
import { GameEvents } from '../events/gameEvents';
import { MonsterVisual } from './MonsterVisualManager';
import { ProjectileSystem } from './ProjectileSystem';

export interface IPlayerProgressionContext {
  scene: Phaser.Scene;
  getPlayerId: () => string;
  getPlayerName: () => string;
  getPlayerPosition: () => { x: number; y: number };
  getGold: () => number;
  spendGold: (amount: number) => void;
  addGold: (amount: number) => void;
  onMaxHpChanged: (newMaxHp: number, healDelta: number) => void;
  healPlayer: (amount: number) => void;
  onClassChangedVisual: (classId: PlayerClassId) => void;
  getMonsterVisuals: () => Map<string, MonsterVisual>;
  damageMonster: (
    monsterId: string,
    damage: number,
    attackerName: string,
    attackerId: string
  ) => void;
  tryDamageCampCoreInRadius?: (x: number, y: number, radius: number, damage: number) => void;
  projectileSystem: ProjectileSystem;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
  playExplosionAt: (x: number, y: number) => void;
  getJobHallStatus?: () => { hasBuilt: boolean; isNear: boolean };
  playLevelUpEffect?: (x: number, y: number, level: number, delayMs?: number) => void;
  playClassAdvancementEffect?: (x: number, y: number, classId: PlayerClassId) => void;
}

/**
 * 사냥 특화 모드 개인별 경험치(EXP)·레벨업·전직(4클래스)·장비 인벤토리·액티브 스킬 전담 시스템
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

  constructor(ctx: IPlayerProgressionContext) {
    this.ctx = ctx;
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

  public getTotalAttack(): number {
    const cls = this.getClassDef();
    const levelBonus = (this.level - 1) * LEVEL_PROGRESSION_CONFIG.attackGainPerLevel;
    const eqBonus =
      (this.equipped.weapon?.bonusAttack ?? 0) +
      (this.equipped.armor?.bonusAttack ?? 0) +
      (this.equipped.relic?.bonusAttack ?? 0);
    return PLAYER_COMBAT_CONFIG.meleeDamage + levelBonus + cls.baseAttackBonus + eqBonus;
  }

  public getTotalMaxHp(): number {
    const cls = this.getClassDef();
    const levelBonus = (this.level - 1) * LEVEL_PROGRESSION_CONFIG.hpGainPerLevel;
    const eqBonus =
      (this.equipped.weapon?.bonusMaxHp ?? 0) +
      (this.equipped.armor?.bonusMaxHp ?? 0) +
      (this.equipped.relic?.bonusMaxHp ?? 0);
    return PLAYER_COMBAT_CONFIG.maxHp + levelBonus + cls.baseHpBonus + eqBonus;
  }

  public getTotalSpeed(): number {
    const cls = this.getClassDef();
    const eqBonus =
      (this.equipped.weapon?.bonusSpeed ?? 0) +
      (this.equipped.armor?.bonusSpeed ?? 0) +
      (this.equipped.relic?.bonusSpeed ?? 0);
    return 250 + cls.baseSpeedBonus + eqBonus;
  }

  public getState(): PlayerProgressionState {
    const cls = this.getClassDef();
    return {
      level: this.level,
      exp: this.exp,
      nextLevelExp: this.nextLevelExp,
      jobPoints: this.jobPoints,
      classId: this.classId,
      skillCooldownRemainingMs: Math.max(0, Math.ceil(this.skillCooldownRemainingMs)),
      skillCooldownMaxMs: cls.skillCooldownMs,
      equipped: { ...this.equipped },
      bagItems: [...this.bagItems],
      totalAttack: this.getTotalAttack(),
      totalMaxHp: this.getTotalMaxHp(),
      totalSpeed: this.getTotalSpeed(),
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
      sound.playUnlock();
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
    if (this.bagItems.length >= 24) {
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
      `🎁 [${rarityMeta.label}] ${item.icon} ${item.name} 획득! ([I] 인벤토리)`,
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

    const newMaxHp = this.getTotalMaxHp();
    this.ctx.onMaxHpChanged(newMaxHp, Math.max(0, newMaxHp - prevMaxHp));
    sound.playClick();
    this.emitState();
  }

  public unequipSlot(slot: EquipmentSlot): void {
    const current = this.equipped[slot];
    if (!current) return;
    this.equipped[slot] = null;
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
    const newMaxHp = this.getTotalMaxHp();
    this.ctx.onMaxHpChanged(newMaxHp, Math.max(20, newMaxHp - prevMaxHp));
    this.ctx.onClassChangedVisual(targetClassId);

    sound.playUnlock();
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
    if (this.skillCooldownRemainingMs > 0) return;
    const cls = this.getClassDef();
    this.skillCooldownRemainingMs = cls.skillCooldownMs;

    const pos = this.ctx.getPlayerPosition();
    const skillDmg = Math.round(this.getTotalAttack() * cls.skillDamageMultiplier);
    const monsters = this.ctx.getMonsterVisuals();

    sound.playUnlock();
    this.ctx.showFloatingText(pos.x, pos.y - 58, `${cls.skillIcon} ${cls.skillName}!`, '#38bdf8');

    if (cls.id === 'ranger') {
      let fired = 0;
      for (const mv of monsters.values()) {
        if (fired >= 10) break;
        const d = Math.hypot(mv.monster.x - pos.x, mv.monster.y - pos.y);
        if (d <= cls.skillRadius) {
          fired++;
          const targetId = mv.monster.id;
          this.ctx.projectileSystem.fireProjectile({
            startX: pos.x,
            startY: pos.y - 20,
            targetX: mv.monster.x,
            targetY: mv.monster.y,
            durationMs: 170,
            tint: 0x38bdf8,
            size: 40,
            onArrive: () => {
              this.ctx.damageMonster(
                targetId,
                skillDmg,
                this.ctx.getPlayerName(),
                this.ctx.getPlayerId()
              );
            },
          });
        }
      }
      this.ctx.tryDamageCampCoreInRadius?.(pos.x, pos.y, cls.skillRadius, skillDmg);
    } else {
      this.ctx.projectileSystem.spawnTelegraphZone({
        x: pos.x,
        y: pos.y,
        radius: cls.skillRadius,
        durationMs: 220,
        color: cls.id === 'archmage' ? 0xc084fc : 0xfbbf24,
        onDetonate: () => {
          this.ctx.playExplosionAt(pos.x, pos.y);
          for (const mv of monsters.values()) {
            const d = Math.hypot(mv.monster.x - pos.x, mv.monster.y - pos.y);
            if (d <= cls.skillRadius) {
              this.ctx.damageMonster(
                mv.monster.id,
                skillDmg,
                this.ctx.getPlayerName(),
                this.ctx.getPlayerId()
              );
            }
          }
          this.ctx.tryDamageCampCoreInRadius?.(pos.x, pos.y, cls.skillRadius, skillDmg);
        },
      });

      if (cls.id === 'guardian') {
        this.ctx.healPlayer(25);
      } else if (cls.id === 'archmage') {
        this.ctx.healPlayer(40);
      }
    }

    this.emitState();
  }

  public update(deltaMs: number): void {
    if (this.skillCooldownRemainingMs > 0) {
      const prevSec = Math.ceil(this.skillCooldownRemainingMs / 250);
      this.skillCooldownRemainingMs = Math.max(0, this.skillCooldownRemainingMs - deltaMs);
      const nextSec = Math.ceil(this.skillCooldownRemainingMs / 250);
      if (prevSec !== nextSec || this.skillCooldownRemainingMs === 0) {
        this.emitState();
      }
    }
  }
}
