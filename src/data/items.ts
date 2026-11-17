import {
  EquipmentItem,
  FieldEliteTier,
  ItemRarity,
  ItemTemplate,
} from '../types/hunting';
import { HIGH_AND_SET_TIER_ITEMS } from './catalogs/highTierItems';
import { LOW_AND_MID_TIER_ITEMS } from './catalogs/lowTierItems';
import { applyRandomAffix } from './itemAffixes';

export interface RarityMetaInfo {
  label: string;
  colorHex: string;
  glowHex: string;
  badgeBg: string;
  borderClass: string;
}

export const RARITY_META: Record<ItemRarity, RarityMetaInfo> = {
  common: {
    label: '일반',
    colorHex: '#e2e8f0',
    glowHex: '#cbd5e1',
    badgeBg: 'bg-slate-600 text-white',
    borderClass: 'border-slate-400',
  },
  rare: {
    label: '희귀',
    colorHex: '#38bdf8',
    glowHex: '#0ea5e9',
    badgeBg: 'bg-sky-600 text-white',
    borderClass: 'border-sky-400',
  },
  epic: {
    label: '영웅',
    colorHex: '#c084fc',
    glowHex: '#a855f7',
    badgeBg: 'bg-purple-600 text-white',
    borderClass: 'border-purple-400',
  },
  legendary: {
    label: '전설',
    colorHex: '#fbbf24',
    glowHex: '#f59e0b',
    badgeBg: 'bg-amber-500 text-amber-950',
    borderClass: 'border-amber-400',
  },
  set: {
    label: '세트',
    colorHex: '#10b981',
    glowHex: '#34d399',
    badgeBg: 'bg-emerald-600 text-emerald-50 ring-1 ring-emerald-300',
    borderClass: 'border-emerald-400',
  },
};

/**
 * 전체 장비 아이템 도감 (일반 3 + 희귀 9 + 영웅 9 + 전설 9 + 에메랄드 세트 12 = 42종)
 */
export const ITEM_CATALOG: ItemTemplate[] = [
  ...LOW_AND_MID_TIER_ITEMS,
  ...HIGH_AND_SET_TIER_ITEMS,
];

export const SET_ITEM_CATALOG: ItemTemplate[] = ITEM_CATALOG.filter(
  (item) => item.rarity === 'set'
);

export const NON_SET_ITEM_CATALOG: ItemTemplate[] = ITEM_CATALOG.filter(
  (item) => item.rarity !== 'set'
);

function pickRandom<T>(arr: readonly T[], fallback: T): T {
  if (arr.length === 0) return fallback;
  return arr[Math.floor(Math.random() * arr.length)] ?? fallback;
}

/**
 * 부락 링 등급(1~4) 및 반복 토벌 횟수에 비례하여 개인 보상 장비를 추첨하는 순수 함수
 * - 2링 이상 부락 상자에서는 점진적 확률로 에메랄드 세트 아이템이 출현
 */
export function rollCampRewardItem(ring: 1 | 2 | 3 | 4, clearCount: number): EquipmentItem {
  const effectiveRing = Math.min(4, ring + Math.floor(clearCount / 2)) as 1 | 2 | 3 | 4;

  // 2링: 14%, 3링: 24%, 4링: 36% (+반복 토벌 보너스)
  const setChance =
    effectiveRing >= 2 ? Math.min(0.45, 0.06 + (effectiveRing - 1) * 0.1 + clearCount * 0.02) : 0;

  let picked: ItemTemplate;
  if (Math.random() < setChance && SET_ITEM_CATALOG.length > 0) {
    picked = pickRandom(SET_ITEM_CATALOG, ITEM_CATALOG[0]);
  } else {
    const candidates = NON_SET_ITEM_CATALOG.filter((item) => item.minRing <= effectiveRing);
    const highTierPool = candidates.filter(
      (item) => item.minRing >= Math.max(1, effectiveRing - 1)
    );
    picked = pickRandom(highTierPool.length > 0 ? highTierPool : candidates, ITEM_CATALOG[0]);
  }

  const clearScale = 1 + Math.min(5, Math.max(0, clearCount - 1)) * 0.15;
  const suffix = clearCount > 1 ? ` +${clearCount - 1}` : '';

  const baseItem: EquipmentItem = {
    ...picked,
    instanceId: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: `${picked.name}${suffix}`,
    bonusAttack: Math.round(picked.bonusAttack * clearScale),
    bonusMaxHp: Math.round(picked.bonusMaxHp * clearScale),
    obtainedAt: Date.now(),
  };
  return applyRandomAffix(baseItem, true);
}

/**
 * 일반·정예·보스 몬스터 처치 시 디아블로식 필드 장비 드랍을 추첨하는 순수 함수
 * - 2링~4링 정예/보스에서 점진적 확률로 에메랄드 세트 아이템 드랍
 */
export function rollMonsterDropItem(params: {
  ring: 1 | 2 | 3 | 4;
  isElite: boolean;
  isBoss: boolean;
  difficultyId: 'normal' | 'hard' | 'nightmare';
  eliteTier?: FieldEliteTier;
}): EquipmentItem | null {
  const diffBonus =
    params.difficultyId === 'nightmare' ? 0.2 : params.difficultyId === 'hard' ? 0.1 : 0;
  const eliteBaseChance =
    params.eliteTier === 'weakened'
      ? 0.38
      : params.eliteTier === 'empowered'
        ? 0.62
        : 0.45;
  const dropChance = params.isBoss
    ? 1.0
    : params.isElite
      ? eliteBaseChance + diffBonus
      : 0.12 + diffBonus * 0.25;

  if (Math.random() > dropChance) return null;

  const effectiveRing = params.isBoss
    ? 4
    : (Math.min(4, params.ring + (params.isElite && Math.random() < 0.4 ? 1 : 0)) as
        | 1
        | 2
        | 3
        | 4);

  // 세트 아이템 드랍 확률 (2링~4링 정예/보스)
  const setDropChance = params.isBoss
    ? 0.32 + diffBonus * 0.5
    : params.isElite && effectiveRing >= 2
      ? 0.08 + (effectiveRing - 2) * 0.07 + diffBonus * 0.25
      : 0;

  let picked: ItemTemplate;
  if (Math.random() < setDropChance && SET_ITEM_CATALOG.length > 0) {
    picked = pickRandom(SET_ITEM_CATALOG, ITEM_CATALOG[0]);
  } else {
    const candidates = NON_SET_ITEM_CATALOG.filter((item) => item.minRing <= effectiveRing);
    const minRarityFilter = params.isBoss
      ? candidates.filter((i) => i.rarity === 'epic' || i.rarity === 'legendary')
      : params.isElite
        ? candidates.filter((i) => i.rarity !== 'common')
        : candidates;
    picked = pickRandom(minRarityFilter.length > 0 ? minRarityFilter : candidates, ITEM_CATALOG[0]);
  }

  const baseItem: EquipmentItem = {
    ...picked,
    instanceId: `drop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    obtainedAt: Date.now(),
  };
  return applyRandomAffix(baseItem, params.isElite || params.isBoss);
}
