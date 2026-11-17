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

export type PotionId = 'potion_small' | 'potion_medium' | 'potion_large';

export interface PotionDefinition {
  id: PotionId;
  name: string;
  shortName: string;
  icon: string;
  hotkey: '1' | '2' | '3';
  healAmount: number;
  costGold: number;
  cooldownMs: number;
  maxStack: number;
  description: string;
}

export type PotionInventory = Record<PotionId, number>;

export interface ResourceBundleDrop {
  wood: number;
  stone: number;
  gold: number;
  label: string;
  icon: string;
}

export type MonsterDropResult =
  | { kind: 'equipment'; item: EquipmentItem }
  | { kind: 'potion'; potionId: PotionId; count: number }
  | { kind: 'resource'; bundle: ResourceBundleDrop };

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
  potions: PotionInventory;
  potionCooldownRemainingMs: number;
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

export type FieldSpawnZone = 'near_village' | 'mid_field' | 'near_camp';

export type FieldEliteTier = 'none' | 'weakened' | 'standard' | 'empowered';

export interface FieldMonsterUnitSpec {
  type: import('./game').MonsterType;
  role: MonsterCombatRole;
  name: string;
  count: number;
  hp: number;
  attack: number;
  speed: number;
  expReward: number;
  eliteChance?: number;
}

export interface FieldMonsterPackTemplate {
  id: string;
  ring: 1 | 2 | 3 | 4;
  zone?: FieldSpawnZone;
  label: string;
  guaranteedElite: boolean;
  eliteTier?: FieldEliteTier;
  units: FieldMonsterUnitSpec[];
}

export interface HuntingScalingFactors {
  hpMult: number;
  atkMult: number;
  countMult: number;
  eliteChance: number;
  scalingLabel: string;
}

