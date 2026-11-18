import { LEVEL_PROGRESSION_CONFIG } from '../../data/classes';
import { computeActiveSetBonuses } from '../../data/itemSets';
import { PLAYER_COMBAT_CONFIG } from '../../data/worldRules';
import {
  ActiveSetBonusState,
  EquipmentStats,
  EquippedItemsMap,
  PlayerClassDefinition,
} from '../../types/hunting';
import { MetaBonusSummary } from '../../types/metaProgression';

export interface ComputedProgressionStats {
  totalAttack: number;
  totalMaxHp: number;
  totalSpeed: number;
  totalCritChance: number;
  totalCritDamagePercent: number;
  totalLifestealPercent: number;
  totalCooldownReductionPercent: number;
  totalAttackSpeedPercent: number;
  totalSkillDamagePercent: number;
  totalDamageReductionPercent: number;
  totalThornsDamage: number;
  totalHpRegenPerSec: number;
  totalAttackRangeBonus: number;
  activeSetBonuses: ActiveSetBonusState[];
}

function sumField(
  equipped: EquippedItemsMap,
  setBonuses: EquipmentStats,
  key: keyof EquipmentStats
): number {
  const fromItems =
    (equipped.weapon?.[key] ?? 0) +
    (equipped.armor?.[key] ?? 0) +
    (equipped.relic?.[key] ?? 0);
  return fromItems + (setBonuses[key] ?? 0);
}

/**
 * 레벨·전직 클래스·장착 장비·활성 세트 효과·메타(별의 파편) 보너스를 합산해 최종 전투 스탯을 산출하는 순수 함수
 */
export function computeProgressionStats(
  level: number,
  cls: PlayerClassDefinition,
  equipped: EquippedItemsMap,
  meta?: Partial<MetaBonusSummary>
): ComputedProgressionStats {
  const { activeSets, totalBonuses } = computeActiveSetBonuses(equipped);

  const levelAttack = (level - 1) * LEVEL_PROGRESSION_CONFIG.attackGainPerLevel;
  const levelHp = (level - 1) * LEVEL_PROGRESSION_CONFIG.hpGainPerLevel;

  return {
    totalAttack:
      PLAYER_COMBAT_CONFIG.meleeDamage +
      levelAttack +
      cls.baseAttackBonus +
      (meta?.combatDamageBonus ?? 0) +
      sumField(equipped, totalBonuses, 'bonusAttack'),
    totalMaxHp:
      PLAYER_COMBAT_CONFIG.maxHp +
      levelHp +
      cls.baseHpBonus +
      (meta?.bonusMaxHp ?? 0) +
      sumField(equipped, totalBonuses, 'bonusMaxHp'),
    totalSpeed:
      250 +
      cls.baseSpeedBonus +
      (meta?.bonusSpeed ?? 0) +
      sumField(equipped, totalBonuses, 'bonusSpeed'),
    totalCritChance: Math.min(
      80,
      5 + (meta?.bonusCritChance ?? 0) + sumField(equipped, totalBonuses, 'bonusCritChance')
    ),
    totalCritDamagePercent: Math.min(
      350,
      175 + sumField(equipped, totalBonuses, 'bonusCritDamagePercent')
    ),
    totalLifestealPercent: Math.min(
      35,
      (meta?.bonusLifestealPercent ?? 0) + sumField(equipped, totalBonuses, 'bonusLifestealPercent')
    ),
    totalCooldownReductionPercent: Math.min(
      55,
      (meta?.bonusCooldownReductionPercent ?? 0) +
        sumField(equipped, totalBonuses, 'bonusCooldownReductionPercent')
    ),
    totalAttackSpeedPercent: Math.min(
      60,
      sumField(equipped, totalBonuses, 'bonusAttackSpeedPercent')
    ),
    totalSkillDamagePercent:
      (meta?.bonusSkillDamagePercent ?? 0) +
      sumField(equipped, totalBonuses, 'bonusSkillDamagePercent'),
    totalDamageReductionPercent: Math.min(
      50,
      sumField(equipped, totalBonuses, 'bonusDamageReductionPercent')
    ),
    totalThornsDamage: sumField(equipped, totalBonuses, 'bonusThornsDamage'),
    totalHpRegenPerSec: sumField(equipped, totalBonuses, 'bonusHpRegenPerSec'),
    totalAttackRangeBonus: sumField(equipped, totalBonuses, 'bonusAttackRange'),
    activeSetBonuses: activeSets,
  };
}
