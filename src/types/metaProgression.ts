export type CostumeColorKey = 'blue' | 'red' | 'yellow' | 'purple' | 'black';

export type CostumeId =
  | 'costume_blue'
  | 'costume_red'
  | 'costume_yellow'
  | 'costume_purple'
  | 'costume_black';

export type AuraEffectId =
  | 'aura_none'
  | 'aura_starlight'
  | 'aura_ember'
  | 'aura_sanctuary';

export type UpgradeCategory = 'base_stats' | 'skills' | 'mode_advantage';

export type ModeAdvantageTag =
  | 'hunting_conquest'
  | 'boss_slayer'
  | 'territory_expansion'
  | 'sanctuary_defense';

export type TraitId =
  // 기본 스탯
  | 'vitality_training'
  | 'guardian_might'
  | 'swift_footwork'
  | 'lethal_precision'
  | 'gatherer_blessing'
  // 기본 스킬 & 전투 테크닉
  | 'skill_power_mastery'
  | 'skill_haste_mastery'
  | 'skill_reach_mastery'
  | 'battle_vampirism'
  // 모드별 전략 어드밴티지
  | 'hunting_exp_boost'
  | 'hunting_loot_fortune'
  | 'boss_slayer_instinct'
  | 'starter_supplies'
  | 'pioneer_efficiency'
  | 'citadel_fortification'
  | 'tower_overclock';

export interface TraitDefinition {
  id: TraitId;
  category: UpgradeCategory;
  modeTag?: ModeAdvantageTag;
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costStep: number;
  effectPerLevelLabel: string;
  iconPath: string;
}

export interface CostumeDefinition {
  id: CostumeId;
  colorKey: CostumeColorKey;
  name: string;
  description: string;
  costPoints: number;
  previewColorHex: string;
  avatarPath: string;
}

export interface AuraDefinition {
  id: AuraEffectId;
  name: string;
  description: string;
  costPoints: number;
  ringColorHex: number;
  badgeColorClass: string;
}

export interface CosmeticTitleDefinition {
  id: string;
  label: string;
  description: string;
  costPoints: number;
}

export interface MetaProgressionState {
  points: number;
  totalClears: number;
  traitLevels: Record<TraitId, number>;
  unlockedTitleIds: string[];
  equippedTitleId: string | null;
  unlockedCostumeIds: CostumeId[];
  equippedCostumeId: CostumeId;
  unlockedAuraIds: AuraEffectId[];
  equippedAuraId: AuraEffectId;
  clearedMissionIds: string[];
}

export interface MetaBonusSummary {
  // 기본 스탯
  bonusMaxHp: number;
  combatDamageBonus: number;
  bonusSpeed: number;
  bonusCritChance: number;
  gatherDamageBonus: number;
  // 기본 스킬 & 전투 테크닉
  bonusSkillDamagePercent: number;
  bonusCooldownReductionPercent: number;
  bonusSkillRadiusPx: number;
  bonusLifestealPercent: number;
  // 모드별 전략 어드밴티지
  expGainBonusRatio: number;
  lootDropBonusChance: number;
  goldGainBonusRatio: number;
  bossDamageBonusRatio: number;
  bonusWood: number;
  bonusStone: number;
  bonusGold: number;
  costDiscountRatio: number;
  coreHpBonusRatio: number;
  towerDamageBonusRatio: number;
  // 순수 외형 코스튬 & 오라
  equippedCostumeColor: CostumeColorKey;
  equippedAuraId: AuraEffectId;
}
