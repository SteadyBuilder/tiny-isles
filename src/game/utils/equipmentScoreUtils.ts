import { computeActiveSetBonuses } from '../../data/itemSets';
import {
  EquipmentItem,
  EquipmentSlot,
  EquipmentStats,
  EquippedItemsMap,
  PlayerClassId,
} from '../../types/hunting';

export const EQUIPMENT_BAG_MAX_SIZE = 32;

interface ClassStatWeights {
  attack: number;
  hp: number;
  speed: number;
  critChance: number;
  critDamage: number;
  lifesteal: number;
  cdr: number;
  attackSpeed: number;
  skillDamage: number;
  damageReduction: number;
  thorns: number;
  hpRegen: number;
  attackRange: number;
}

const CLASS_WEIGHTS: Record<PlayerClassId, ClassStatWeights> = {
  pawn: {
    attack: 2.2,
    hp: 0.45,
    speed: 0.8,
    critChance: 2.0,
    critDamage: 0.6,
    lifesteal: 2.2,
    cdr: 1.5,
    attackSpeed: 1.8,
    skillDamage: 1.2,
    damageReduction: 2.5,
    thorns: 0.9,
    hpRegen: 2.2,
    attackRange: 0.5,
  },
  guardian: {
    attack: 1.8,
    hp: 0.65,
    speed: 0.6,
    critChance: 1.4,
    critDamage: 0.45,
    lifesteal: 2.8,
    cdr: 1.6,
    attackSpeed: 1.4,
    skillDamage: 1.2,
    damageReduction: 5.5,
    thorns: 1.6,
    hpRegen: 4.5,
    attackRange: 0.3,
  },
  lancer: {
    attack: 2.6,
    hp: 0.42,
    speed: 1.4,
    critChance: 2.4,
    critDamage: 0.8,
    lifesteal: 2.0,
    cdr: 2.2,
    attackSpeed: 3.0,
    skillDamage: 2.0,
    damageReduction: 2.2,
    thorns: 0.7,
    hpRegen: 1.8,
    attackRange: 1.0,
  },
  ranger: {
    attack: 2.6,
    hp: 0.35,
    speed: 1.1,
    critChance: 3.6,
    critDamage: 1.4,
    lifesteal: 1.8,
    cdr: 1.6,
    attackSpeed: 3.4,
    skillDamage: 1.4,
    damageReduction: 1.8,
    thorns: 0.4,
    hpRegen: 1.4,
    attackRange: 1.6,
  },
  archmage: {
    attack: 2.3,
    hp: 0.4,
    speed: 0.85,
    critChance: 2.0,
    critDamage: 0.7,
    lifesteal: 3.0,
    cdr: 3.8,
    attackSpeed: 1.3,
    skillDamage: 3.4,
    damageReduction: 2.0,
    thorns: 0.5,
    hpRegen: 1.8,
    attackRange: 1.1,
  },
};

export function scoreEquipmentStats(
  stats: Partial<EquipmentStats>,
  classId: PlayerClassId
): number {
  const w = CLASS_WEIGHTS[classId] ?? CLASS_WEIGHTS.pawn;
  return (
    (stats.bonusAttack ?? 0) * w.attack +
    (stats.bonusMaxHp ?? 0) * w.hp +
    (stats.bonusSpeed ?? 0) * w.speed +
    (stats.bonusCritChance ?? 0) * w.critChance +
    (stats.bonusCritDamagePercent ?? 0) * w.critDamage +
    (stats.bonusLifestealPercent ?? 0) * w.lifesteal +
    (stats.bonusCooldownReductionPercent ?? 0) * w.cdr +
    (stats.bonusAttackSpeedPercent ?? 0) * w.attackSpeed +
    (stats.bonusSkillDamagePercent ?? 0) * w.skillDamage +
    (stats.bonusDamageReductionPercent ?? 0) * w.damageReduction +
    (stats.bonusThornsDamage ?? 0) * w.thorns +
    (stats.bonusHpRegenPerSec ?? 0) * w.hpRegen +
    (stats.bonusAttackRange ?? 0) * w.attackRange
  );
}

/**
 * 특정 슬롯에 candidate를 장착했을 때 전체 장착 세팅(아이템 + 세트 보너스)의 총 효율 점수를 계산
 */
export function evaluateLoadoutScoreWithItem(
  candidate: EquipmentItem | null,
  slot: EquipmentSlot,
  equipped: EquippedItemsMap,
  classId: PlayerClassId
): number {
  const simulated: EquippedItemsMap = {
    ...equipped,
    [slot]: candidate,
  };
  let total = 0;
  for (const s of ['weapon', 'armor', 'relic'] as const) {
    const it = simulated[s];
    if (it) {
      total += scoreEquipmentStats(it, classId);
      if (it.preferredClass === classId) {
        total += 12;
      }
    }
  }
  const { totalBonuses } = computeActiveSetBonuses(simulated);
  total += scoreEquipmentStats(totalBonuses, classId);
  return Math.round(total);
}

export interface StatDeltaEntry {
  label: string;
  delta: number;
  suffix: string;
}

export interface ItemComparisonResult {
  candidateScore: number;
  equippedScore: number;
  scoreDelta: number;
  percentDelta: number;
  isUpgrade: boolean;
  isRecommendedBest: boolean;
  statDeltas: StatDeltaEntry[];
}

const STAT_META: ReadonlyArray<{
  key: keyof EquipmentStats;
  label: string;
  suffix: string;
}> = [
  { key: 'bonusAttack', label: '공격력', suffix: '' },
  { key: 'bonusMaxHp', label: '체력', suffix: '' },
  { key: 'bonusSpeed', label: '이속', suffix: '' },
  { key: 'bonusCritChance', label: '치명타', suffix: '%' },
  { key: 'bonusCritDamagePercent', label: '치피', suffix: '%' },
  { key: 'bonusAttackSpeedPercent', label: '공속', suffix: '%' },
  { key: 'bonusSkillDamagePercent', label: '스킬피해', suffix: '%' },
  { key: 'bonusCooldownReductionPercent', label: '쿨감', suffix: '%' },
  { key: 'bonusLifestealPercent', label: '흡혈', suffix: '%' },
  { key: 'bonusDamageReductionPercent', label: '피감', suffix: '%' },
  { key: 'bonusThornsDamage', label: '반사', suffix: '' },
  { key: 'bonusHpRegenPerSec', label: '재생', suffix: '/s' },
  { key: 'bonusAttackRange', label: '사거리', suffix: 'px' },
];

export function formatEquipmentStatsTags(stats: Partial<EquipmentStats>): string[] {
  const tags: string[] = [];
  for (const m of STAT_META) {
    const val = stats[m.key] ?? 0;
    if (val > 0) {
      tags.push(`${m.label} +${val}${m.suffix}`);
    }
  }
  return tags;
}

export interface BagItemWithComparison {
  item: EquipmentItem;
  comparison: ItemComparisonResult;
}

/**
 * 가방 아이템들을 현재 장착 장비 및 직업 효율과 비교하여
 * 카테고리별 최상위 추천 아이템을 표시하고 우선 정렬해 반환하는 순수 함수
 */
export function rankBagItemsWithComparison(
  bagItems: readonly EquipmentItem[],
  equipped: EquippedItemsMap,
  classId: PlayerClassId
): BagItemWithComparison[] {
  const baselineLoadoutScore = evaluateLoadoutScoreWithItem(
    equipped.weapon,
    'weapon',
    equipped,
    classId
  );

  // 각 슬롯별 최고 점수 찾기 (가방 내 최고 효율)
  const bestScoreBySlot: Record<EquipmentSlot, number> = {
    weapon: -Infinity,
    armor: -Infinity,
    relic: -Infinity,
  };
  const bestIdBySlot: Record<EquipmentSlot, string | null> = {
    weapon: null,
    armor: null,
    relic: null,
  };

  const results: BagItemWithComparison[] = bagItems.map((item) => {
    const currentInSlot = equipped[item.slot];
    const candidateLoadoutScore = evaluateLoadoutScoreWithItem(
      item,
      item.slot,
      equipped,
      classId
    );
    const scoreDelta = candidateLoadoutScore - baselineLoadoutScore;
    const itemSelfScore = Math.round(scoreEquipmentStats(item, classId));
    const currentSelfScore = currentInSlot
      ? Math.round(scoreEquipmentStats(currentInSlot, classId))
      : 0;
    const denom = Math.max(20, currentInSlot ? baselineLoadoutScore : 50);
    const percentDelta = Math.round((scoreDelta / denom) * 100);

    const statDeltas: StatDeltaEntry[] = [];
    for (const m of STAT_META) {
      const nextVal = item[m.key] ?? 0;
      const prevVal = currentInSlot?.[m.key] ?? 0;
      const diff = nextVal - prevVal;
      if (diff !== 0) {
        statDeltas.push({ label: m.label, delta: diff, suffix: m.suffix });
      }
    }

    if (candidateLoadoutScore > bestScoreBySlot[item.slot]) {
      bestScoreBySlot[item.slot] = candidateLoadoutScore;
      bestIdBySlot[item.slot] = item.instanceId;
    }

    return {
      item,
      comparison: {
        candidateScore: itemSelfScore,
        equippedScore: currentSelfScore,
        scoreDelta,
        percentDelta,
        isUpgrade: scoreDelta > 0,
        isRecommendedBest: false,
        statDeltas,
      },
    };
  });

  // 슬롯별 1등 중 실제로 현재 장착보다 좋거나 슬롯이 비어있는 경우 '최적 추천' 뱃지 부여
  for (const entry of results) {
    const slot = entry.item.slot;
    if (
      bestIdBySlot[slot] === entry.item.instanceId &&
      (entry.comparison.isUpgrade || !equipped[slot])
    ) {
      entry.comparison.isRecommendedBest = true;
    }
  }

  // 정렬: 1) 최적 추천 우선 2) 현재 장비 대비 업그레이드(+delta) 내림차순 3) 아이템 자체 점수 내림차순
  results.sort((a, b) => {
    if (a.comparison.isRecommendedBest !== b.comparison.isRecommendedBest) {
      return a.comparison.isRecommendedBest ? -1 : 1;
    }
    if (a.comparison.isUpgrade !== b.comparison.isUpgrade) {
      return a.comparison.isUpgrade ? -1 : 1;
    }
    if (b.comparison.scoreDelta !== a.comparison.scoreDelta) {
      return b.comparison.scoreDelta - a.comparison.scoreDelta;
    }
    return b.comparison.candidateScore - a.comparison.candidateScore;
  });

  return results;
}

/**
 * 현재 가방에서 각 부위별 가장 효율이 높은 업그레이드 장비 ID 목록 추출
 */
export function pickBestUpgradeItemIds(
  bagItems: readonly EquipmentItem[],
  equipped: EquippedItemsMap,
  classId: PlayerClassId
): string[] {
  const ranked = rankBagItemsWithComparison(bagItems, equipped, classId);
  const pickedIds: string[] = [];
  const usedSlots = new Set<EquipmentSlot>();
  for (const entry of ranked) {
    if (entry.comparison.isRecommendedBest && !usedSlots.has(entry.item.slot)) {
      pickedIds.push(entry.item.instanceId);
      usedSlots.add(entry.item.slot);
    }
  }
  return pickedIds;
}

/**
 * 추천 장비 외의 하위(비업그레이드) 장비 ID 목록 추출 (세트 아이템은 보호 옵션 가능)
 */
export function pickInferiorSalvageIds(
  bagItems: readonly EquipmentItem[],
  equipped: EquippedItemsMap,
  classId: PlayerClassId,
  protectSetItems = true
): string[] {
  const ranked = rankBagItemsWithComparison(bagItems, equipped, classId);
  return ranked
    .filter((entry) => {
      if (entry.comparison.isRecommendedBest || entry.comparison.isUpgrade) return false;
      if (protectSetItems && entry.item.rarity === 'set') return false;
      return true;
    })
    .map((entry) => entry.item.instanceId);
}
