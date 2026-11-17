import { EquipmentItem, PlayerClassId } from '../types/hunting';

export interface ItemAffixSpec {
  id: string;
  label: string;
  classAffinity: PlayerClassId | 'all';
  attackRange?: [number, number];
  hpRange?: [number, number];
  speedRange?: [number, number];
  critChanceRange?: [number, number];
  critDamageRange?: [number, number];
  lifestealRange?: [number, number];
  cdrRange?: [number, number];
  attackSpeedRange?: [number, number];
  skillDamageRange?: [number, number];
  damageReductionRange?: [number, number];
  thornsRange?: [number, number];
  hpRegenRange?: [number, number];
  rangeBonusRange?: [number, number];
}

export const ITEM_AFFIX_POOL: readonly ItemAffixSpec[] = [
  // Guardian (가디언 - 탱킹/반사/재생)
  {
    id: 'ironwall',
    label: '철벽의',
    classAffinity: 'guardian',
    hpRange: [30, 60],
    damageReductionRange: [4, 8],
  },
  {
    id: 'thorned',
    label: '가시돋친',
    classAffinity: 'guardian',
    hpRange: [25, 45],
    thornsRange: [8, 16],
  },
  {
    id: 'undying',
    label: '불굴의',
    classAffinity: 'guardian',
    hpRegenRange: [3, 7],
    damageReductionRange: [3, 6],
  },
  {
    id: 'bulwark',
    label: '수호자의',
    classAffinity: 'guardian',
    hpRange: [45, 85],
    attackRange: [3, 6],
  },

  // Lancer (랜서 - 기동/공속/관통돌격)
  {
    id: 'gale',
    label: '질풍의',
    classAffinity: 'lancer',
    speedRange: [14, 26],
    attackSpeedRange: [6, 12],
  },
  {
    id: 'piercing',
    label: '관통하는',
    classAffinity: 'lancer',
    attackRange: [6, 12],
    critChanceRange: [5, 10],
  },
  {
    id: 'thunder',
    label: '뇌전의',
    classAffinity: 'lancer',
    attackSpeedRange: [7, 13],
    skillDamageRange: [8, 16],
  },
  {
    id: 'charger',
    label: '돌격하는',
    classAffinity: 'lancer',
    speedRange: [12, 22],
    cdrRange: [5, 10],
  },

  // Ranger (레인저 - 치명타/치피/연사/사거리)
  {
    id: 'deadly',
    label: '치명의',
    classAffinity: 'ranger',
    critChanceRange: [7, 15],
    critDamageRange: [14, 28],
  },
  {
    id: 'hawkeye',
    label: '매의 눈',
    classAffinity: 'ranger',
    rangeBonusRange: [22, 42],
    critChanceRange: [5, 9],
  },
  {
    id: 'rapid',
    label: '연사의',
    classAffinity: 'ranger',
    attackSpeedRange: [9, 17],
    attackRange: [3, 6],
  },
  {
    id: 'skybow',
    label: '천궁의',
    classAffinity: 'ranger',
    critDamageRange: [18, 36],
    rangeBonusRange: [16, 30],
  },

  // Archmage (아크메이지 - 스킬증폭/쿨감/흡혈)
  {
    id: 'arcane',
    label: '비전의',
    classAffinity: 'archmage',
    skillDamageRange: [12, 22],
    cdrRange: [6, 12],
  },
  {
    id: 'haste',
    label: '신속한',
    classAffinity: 'archmage',
    cdrRange: [8, 14],
    speedRange: [8, 14],
  },
  {
    id: 'soul_siphon',
    label: '마력흡수의',
    classAffinity: 'archmage',
    lifestealRange: [4, 7],
    skillDamageRange: [8, 15],
  },
  {
    id: 'archsage',
    label: '대현자의',
    classAffinity: 'archmage',
    skillDamageRange: [14, 25],
    cdrRange: [5, 10],
    attackRange: [4, 8],
  },

  // 범용 전투 접사
  {
    id: 'ruin',
    label: '파멸의',
    classAffinity: 'all',
    attackRange: [6, 11],
    critChanceRange: [5, 11],
    critDamageRange: [12, 22],
  },
  {
    id: 'vampiric',
    label: '흡혈의',
    classAffinity: 'all',
    lifestealRange: [3, 7],
    attackRange: [3, 6],
  },
  {
    id: 'transcendent',
    label: '초월의',
    classAffinity: 'all',
    attackRange: [5, 9],
    cdrRange: [5, 10],
    attackSpeedRange: [5, 10],
  },
];

function randInt(min: number, max: number): number {
  if (max <= min) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

function rollScaled(range: [number, number] | undefined, mult: number): number {
  if (!range) return 0;
  return Math.max(1, Math.round(randInt(range[0], range[1]) * mult));
}

function addOpt(base: number | undefined, delta: number): number | undefined {
  const sum = (base ?? 0) + delta;
  return sum > 0 ? sum : undefined;
}

function pickAffixForItem(item: EquipmentItem): ItemAffixSpec {
  const preferred = item.preferredClass;
  if (preferred && preferred !== 'all' && Math.random() < 0.7) {
    const matching = ITEM_AFFIX_POOL.filter(
      (a) => a.classAffinity === preferred || a.classAffinity === 'all'
    );
    if (matching.length > 0) {
      return matching[Math.floor(Math.random() * matching.length)];
    }
  }
  return ITEM_AFFIX_POOL[Math.floor(Math.random() * ITEM_AFFIX_POOL.length)];
}

/**
 * 장비 등급 및 선호 직업에 맞춰 랜덤 옵션(접사)을 부여하는 순수 함수
 */
export function applyRandomAffix(item: EquipmentItem, guaranteeAffix: boolean): EquipmentItem {
  const shouldRoll = guaranteeAffix || item.rarity !== 'common' || Math.random() < 0.45;
  if (!shouldRoll) return item;

  const affix = pickAffixForItem(item);
  const rarityBoost =
    item.rarity === 'set'
      ? 1.35
      : item.rarity === 'legendary'
        ? 1.4
        : item.rarity === 'epic'
          ? 1.2
          : 1.0;

  return {
    ...item,
    affixLabel: affix.label,
    name: `${affix.label} ${item.name}`,
    bonusAttack: item.bonusAttack + rollScaled(affix.attackRange, rarityBoost),
    bonusMaxHp: item.bonusMaxHp + rollScaled(affix.hpRange, rarityBoost),
    bonusSpeed: item.bonusSpeed + rollScaled(affix.speedRange, rarityBoost),
    bonusCritChance: addOpt(item.bonusCritChance, rollScaled(affix.critChanceRange, rarityBoost)),
    bonusCritDamagePercent: addOpt(
      item.bonusCritDamagePercent,
      rollScaled(affix.critDamageRange, rarityBoost)
    ),
    bonusLifestealPercent: addOpt(
      item.bonusLifestealPercent,
      rollScaled(affix.lifestealRange, rarityBoost)
    ),
    bonusCooldownReductionPercent: addOpt(
      item.bonusCooldownReductionPercent,
      rollScaled(affix.cdrRange, rarityBoost)
    ),
    bonusAttackSpeedPercent: addOpt(
      item.bonusAttackSpeedPercent,
      rollScaled(affix.attackSpeedRange, rarityBoost)
    ),
    bonusSkillDamagePercent: addOpt(
      item.bonusSkillDamagePercent,
      rollScaled(affix.skillDamageRange, rarityBoost)
    ),
    bonusDamageReductionPercent: addOpt(
      item.bonusDamageReductionPercent,
      rollScaled(affix.damageReductionRange, rarityBoost)
    ),
    bonusThornsDamage: addOpt(item.bonusThornsDamage, rollScaled(affix.thornsRange, rarityBoost)),
    bonusHpRegenPerSec: addOpt(
      item.bonusHpRegenPerSec,
      rollScaled(affix.hpRegenRange, rarityBoost)
    ),
    bonusAttackRange: addOpt(
      item.bonusAttackRange,
      rollScaled(affix.rangeBonusRange, rarityBoost)
    ),
  };
}
