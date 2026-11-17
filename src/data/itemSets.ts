import {
  ActiveSetBonusState,
  EquipmentStats,
  EquippedItemsMap,
  ItemSetDefinition,
  ItemSetId,
} from '../types/hunting';

/**
 * 디아블로식 에메랄드 세트 아이템 정의 (직업별 4대 세트 × 3부위)
 */
export const ITEM_SET_DEFINITIONS: Record<ItemSetId, ItemSetDefinition> = {
  set_bulwark: {
    id: 'set_bulwark',
    name: '불멸의 성벽 수호자',
    preferredClass: 'guardian',
    description: '난공불락의 성벽을 지키는 수호기사를 위한 에메랄드 중갑 세트입니다.',
    pieceIds: ['set_bulwark_wpn', 'set_bulwark_arm', 'set_bulwark_rel'],
    tiers: [
      {
        requiredPieces: 2,
        label: '피해감소 +12% · 최대 체력 +180',
        bonuses: {
          bonusDamageReductionPercent: 12,
          bonusMaxHp: 180,
        },
      },
      {
        requiredPieces: 3,
        label: '초당 재생 +14 · 반사 피해 +35 · 공격력 +30',
        bonuses: {
          bonusHpRegenPerSec: 14,
          bonusThornsDamage: 35,
          bonusAttack: 30,
        },
      },
    ],
  },
  set_stormdragon: {
    id: 'set_stormdragon',
    name: '폭풍용의 창기병',
    preferredClass: 'lancer',
    description: '전장을 번개처럼 꿰뚫는 드래곤 랜서를 위한 에메랄드 비늘 세트입니다.',
    pieceIds: ['set_stormdragon_wpn', 'set_stormdragon_arm', 'set_stormdragon_rel'],
    tiers: [
      {
        requiredPieces: 2,
        label: '이동속도 +45 · 공격속도 +18%',
        bonuses: {
          bonusSpeed: 45,
          bonusAttackSpeedPercent: 18,
        },
      },
      {
        requiredPieces: 3,
        label: '스킬 피해 +45% · 치명타 +14% · 공격력 +35',
        bonuses: {
          bonusSkillDamagePercent: 45,
          bonusCritChance: 14,
          bonusAttack: 35,
        },
      },
    ],
  },
  set_skywind: {
    id: 'set_skywind',
    name: '천공의 바람사수',
    preferredClass: 'ranger',
    description: '보이지 않는 거리에서 치명적 화살비를 퍼붓는 레인저용 에메랄드 세트입니다.',
    pieceIds: ['set_skywind_wpn', 'set_skywind_arm', 'set_skywind_rel'],
    tiers: [
      {
        requiredPieces: 2,
        label: '공격속도 +20% · 사거리 +55px',
        bonuses: {
          bonusAttackSpeedPercent: 20,
          bonusAttackRange: 55,
        },
      },
      {
        requiredPieces: 3,
        label: '치명타 +18% · 치명타 피해 +55% · 공격력 +28',
        bonuses: {
          bonusCritChance: 18,
          bonusCritDamagePercent: 55,
          bonusAttack: 28,
        },
      },
    ],
  },
  set_abyssalsage: {
    id: 'set_abyssalsage',
    name: '심연의 대현자',
    preferredClass: 'archmage',
    description: '끝없는 마력 순환과 광역 마법 폭격을 극대화하는 아크메이지용 에메랄드 세트입니다.',
    pieceIds: ['set_abyssalsage_wpn', 'set_abyssalsage_arm', 'set_abyssalsage_rel'],
    tiers: [
      {
        requiredPieces: 2,
        label: '쿨타임 감소 +16% · 스킬 피해 +35%',
        bonuses: {
          bonusCooldownReductionPercent: 16,
          bonusSkillDamagePercent: 35,
        },
      },
      {
        requiredPieces: 3,
        label: '스킬 피해 +60% · 흡혈 +10% · 공격력 +40',
        bonuses: {
          bonusSkillDamagePercent: 60,
          bonusLifestealPercent: 10,
          bonusAttack: 40,
        },
      },
    ],
  },
};

export const ITEM_SET_LIST: readonly ItemSetDefinition[] = Object.values(ITEM_SET_DEFINITIONS);

/**
 * 현재 장착 장비 맵으로부터 활성화된 세트 보너스 목록 및 합산 스탯을 계산하는 순수 함수
 */
export function computeActiveSetBonuses(equipped: EquippedItemsMap): {
  activeSets: ActiveSetBonusState[];
  totalBonuses: EquipmentStats;
} {
  const counts = new Map<ItemSetId, number>();
  const slots = [equipped.weapon, equipped.armor, equipped.relic];
  for (const item of slots) {
    if (item?.setId) {
      counts.set(item.setId, (counts.get(item.setId) ?? 0) + 1);
    }
  }

  const activeSets: ActiveSetBonusState[] = [];
  const totalBonuses: EquipmentStats = {
    bonusAttack: 0,
    bonusMaxHp: 0,
    bonusSpeed: 0,
    bonusCritChance: 0,
    bonusCritDamagePercent: 0,
    bonusLifestealPercent: 0,
    bonusCooldownReductionPercent: 0,
    bonusAttackSpeedPercent: 0,
    bonusSkillDamagePercent: 0,
    bonusDamageReductionPercent: 0,
    bonusThornsDamage: 0,
    bonusHpRegenPerSec: 0,
    bonusAttackRange: 0,
  };

  for (const [setId, count] of counts.entries()) {
    const def = ITEM_SET_DEFINITIONS[setId];
    if (!def) continue;
    const activeTiers = def.tiers.filter((t) => count >= t.requiredPieces);
    activeSets.push({
      setId,
      name: def.name,
      equippedCount: count,
      totalPieces: def.pieceIds.length,
      activeTiers,
    });

    for (const tier of activeTiers) {
      const b = tier.bonuses;
      totalBonuses.bonusAttack += b.bonusAttack ?? 0;
      totalBonuses.bonusMaxHp += b.bonusMaxHp ?? 0;
      totalBonuses.bonusSpeed += b.bonusSpeed ?? 0;
      totalBonuses.bonusCritChance = (totalBonuses.bonusCritChance ?? 0) + (b.bonusCritChance ?? 0);
      totalBonuses.bonusCritDamagePercent =
        (totalBonuses.bonusCritDamagePercent ?? 0) + (b.bonusCritDamagePercent ?? 0);
      totalBonuses.bonusLifestealPercent =
        (totalBonuses.bonusLifestealPercent ?? 0) + (b.bonusLifestealPercent ?? 0);
      totalBonuses.bonusCooldownReductionPercent =
        (totalBonuses.bonusCooldownReductionPercent ?? 0) +
        (b.bonusCooldownReductionPercent ?? 0);
      totalBonuses.bonusAttackSpeedPercent =
        (totalBonuses.bonusAttackSpeedPercent ?? 0) + (b.bonusAttackSpeedPercent ?? 0);
      totalBonuses.bonusSkillDamagePercent =
        (totalBonuses.bonusSkillDamagePercent ?? 0) + (b.bonusSkillDamagePercent ?? 0);
      totalBonuses.bonusDamageReductionPercent =
        (totalBonuses.bonusDamageReductionPercent ?? 0) +
        (b.bonusDamageReductionPercent ?? 0);
      totalBonuses.bonusThornsDamage =
        (totalBonuses.bonusThornsDamage ?? 0) + (b.bonusThornsDamage ?? 0);
      totalBonuses.bonusHpRegenPerSec =
        (totalBonuses.bonusHpRegenPerSec ?? 0) + (b.bonusHpRegenPerSec ?? 0);
      totalBonuses.bonusAttackRange =
        (totalBonuses.bonusAttackRange ?? 0) + (b.bonusAttackRange ?? 0);
    }
  }

  return { activeSets, totalBonuses };
}
