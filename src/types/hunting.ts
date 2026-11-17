/**
 * 사냥 특화 모드(Hunting & Dungeon Defense) 전용 타입 계약 정의
 */

export type PlayerClassId = 'pawn' | 'guardian' | 'lancer' | 'ranger' | 'archmage';

export type MonsterCombatRole = 'melee' | 'lancer' | 'ranged' | 'mage';

export type EliteAffixId = 'berserker' | 'swift' | 'vampiric' | 'arcane_nova' | 'fortified';

export type EquipmentSlot = 'weapon' | 'armor' | 'relic';

export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface ItemTemplate {
  id: string;
  name: string;
  icon: string;
  slot: EquipmentSlot;
  rarity: ItemRarity;
  minRing: 1 | 2 | 3 | 4;
  bonusAttack: number;
  bonusMaxHp: number;
  bonusSpeed: number;
  salvageGold: number;
  description: string;
}

export interface EquipmentItem extends ItemTemplate {
  instanceId: string;
  obtainedAt: number;
  bonusCritChance?: number;
  bonusLifestealPercent?: number;
  bonusCooldownReductionPercent?: number;
  affixLabel?: string;
}

export interface EquippedItemsMap {
  weapon: EquipmentItem | null;
  armor: EquipmentItem | null;
  relic: EquipmentItem | null;
}

export interface PlayerClassDefinition {
  id: PlayerClassId;
  name: string;
  title: string;
  icon: string;
  requiredLevel: number;
  costGold: number;
  baseHpBonus: number;
  baseAttackBonus: number;
  baseSpeedBonus: number;
  attackRange: number;
  attackCooldownMs: number;
  isRanged: boolean;
  isSplash: boolean;
  isPiercing: boolean;
  skillName: string;
  skillIcon: string;
  skillDescription: string;
  skillCooldownMs: number;
  skillDamageMultiplier: number;
  skillRadius: number;
  passiveDescription: string;
}

export interface PlayerProgressionState {
  level: number;
  exp: number;
  nextLevelExp: number;
  jobPoints: number;
  classId: PlayerClassId;
  skillCooldownRemainingMs: number;
  skillCooldownMaxMs: number;
  equipped: EquippedItemsMap;
  bagItems: EquipmentItem[];
  totalAttack: number;
  totalMaxHp: number;
  totalSpeed: number;
  totalCritChance: number;
  totalLifestealPercent: number;
  totalCooldownReductionPercent: number;
}

export interface MonsterCampState {
  territoryId: number;
  gridX: number;
  gridY: number;
  name: string;
  ring: 1 | 2 | 3 | 4;
  level: number;
  coreHp: number;
  coreMaxHp: number;
  destroyed: boolean;
  respawnRemainingSec: number | null;
  firstCleared: boolean;
  clearCount: number;
}

export interface DungeonPortalState {
  active: boolean;
  x: number;
  y: number;
  directionLabel: string;
  remainingSpawns: number;
  totalSpawns: number;
}
