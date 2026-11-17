import { EquipmentItem, ItemRarity, ItemTemplate } from '../types/hunting';

export const RARITY_META: Record<
  ItemRarity,
  { label: string; colorHex: string; badgeBg: string; borderClass: string }
> = {
  common: {
    label: '일반',
    colorHex: '#e2e8f0',
    badgeBg: 'bg-slate-600 text-white',
    borderClass: 'border-slate-400',
  },
  rare: {
    label: '희귀',
    colorHex: '#38bdf8',
    badgeBg: 'bg-sky-600 text-white',
    borderClass: 'border-sky-400',
  },
  epic: {
    label: '영웅',
    colorHex: '#c084fc',
    badgeBg: 'bg-purple-600 text-white',
    borderClass: 'border-purple-400',
  },
  legendary: {
    label: '전설',
    colorHex: '#fbbf24',
    badgeBg: 'bg-amber-500 text-amber-950',
    borderClass: 'border-amber-400',
  },
};

/**
 * 몬스터 부락 본진 파괴 시 개인별로 획득 가능한 장비 아이템 도감
 */
export const ITEM_CATALOG: ItemTemplate[] = [
  // 1링 (초급 부락 보상 - 일반/희귀)
  {
    id: 'wpn_militia_blade',
    name: '수비대 강철검',
    icon: '🗡️',
    slot: 'weapon',
    rarity: 'common',
    minRing: 1,
    bonusAttack: 12,
    bonusMaxHp: 0,
    bonusSpeed: 0,
    salvageGold: 6,
    description: '전초기지 토벌로 획득한 튼튼한 제식 검입니다.',
  },
  {
    id: 'arm_leather_cuirass',
    name: '사냥꾼의 가죽 흉갑',
    icon: '🦺',
    slot: 'armor',
    rarity: 'common',
    minRing: 1,
    bonusAttack: 0,
    bonusMaxHp: 45,
    bonusSpeed: 8,
    salvageGold: 6,
    description: '가볍고 질긴 가죽 갑옷으로 생명력과 기동력을 높여줍니다.',
  },
  {
    id: 'rel_swift_boots',
    name: '바람길 행군 장화',
    icon: '🥾',
    slot: 'relic',
    rarity: 'rare',
    minRing: 1,
    bonusAttack: 6,
    bonusMaxHp: 20,
    bonusSpeed: 28,
    salvageGold: 12,
    description: '부락 사이를 빠르게 누빌 수 있는 마법 깃든 군화입니다.',
  },

  // 2링 (중급 부락 보상 - 희귀/영웅)
  {
    id: 'wpn_knight_halberd',
    name: '흑기사의 파쇄 미늘창',
    icon: '🪓',
    slot: 'weapon',
    rarity: 'rare',
    minRing: 2,
    bonusAttack: 24,
    bonusMaxHp: 25,
    bonusSpeed: 0,
    salvageGold: 15,
    description: '중급 부락 지휘관이 사용하던 묵직한 파쇄 무기입니다.',
  },
  {
    id: 'arm_chainmail_plate',
    name: '미스릴 사슬 판금갑',
    icon: '🛡️',
    slot: 'armor',
    rarity: 'rare',
    minRing: 2,
    bonusAttack: 5,
    bonusMaxHp: 90,
    bonusSpeed: 0,
    salvageGold: 15,
    description: '원거리 화살과 마법 파편을 효과적으로 튕겨내는 판금 갑옷입니다.',
  },
  {
    id: 'rel_blood_pendant',
    name: '붉은 결의의 휘장',
    icon: '🎖️',
    slot: 'relic',
    rarity: 'epic',
    minRing: 2,
    bonusAttack: 18,
    bonusMaxHp: 50,
    bonusSpeed: 18,
    salvageGold: 22,
    description: '착용자의 투지를 끌어올려 공·방·이속을 고루 강화합니다.',
  },

  // 3링 (상급 부락 보상 - 영웅)
  {
    id: 'wpn_arcane_archbow',
    name: '별빛 성소의 마궁',
    icon: '🏹',
    slot: 'weapon',
    rarity: 'epic',
    minRing: 3,
    bonusAttack: 42,
    bonusMaxHp: 30,
    bonusSpeed: 15,
    salvageGold: 30,
    description: '응축된 마력으로 적의 갑옷을 꿰뚫는 상급 부락의 보물입니다.',
  },
  {
    id: 'arm_guardian_aegis',
    name: '성전의 불멸 성갑',
    icon: '🥋',
    slot: 'armor',
    rarity: 'epic',
    minRing: 3,
    bonusAttack: 12,
    bonusMaxHp: 160,
    bonusSpeed: 10,
    salvageGold: 30,
    description: '고대 성소의 축복이 깃들어 막대한 체력을 부여하는 성갑입니다.',
  },

  // 4링 (최외곽 심연 요새 보상 - 전설)
  {
    id: 'wpn_abyss_slayer',
    name: '심연절단자 칼라드볼그',
    icon: '⚔️',
    slot: 'weapon',
    rarity: 'legendary',
    minRing: 4,
    bonusAttack: 75,
    bonusMaxHp: 60,
    bonusSpeed: 20,
    salvageGold: 55,
    description: '최외곽 대군주 부락을 평정한 영웅에게만 허락되는 전설의 신검입니다.',
  },
  {
    id: 'arm_dragonlord_mail',
    name: '고룡 군주의 비늘 갑주',
    icon: '👑',
    slot: 'armor',
    rarity: 'legendary',
    minRing: 4,
    bonusAttack: 25,
    bonusMaxHp: 260,
    bonusSpeed: 20,
    salvageGold: 55,
    description: '100마리 마물 대군의 집중 포화 속에서도 끄떡없는 전설의 갑주입니다.',
  },
  {
    id: 'rel_heart_of_eternity',
    name: '태양왕의 영원한 심장',
    icon: '💎',
    slot: 'relic',
    rarity: 'legendary',
    minRing: 4,
    bonusAttack: 45,
    bonusMaxHp: 140,
    bonusSpeed: 40,
    salvageGold: 55,
    description: '찬란한 태양의 마력으로 착용자의 모든 한계를 초월하게 만듭니다.',
  },
];

/**
 * 부락 링 등급(1~4) 및 반복 토벌 횟수에 비례하여 개인 보상 장비를 추첨하는 순수 함수
 */
export function rollCampRewardItem(ring: 1 | 2 | 3 | 4, clearCount: number): EquipmentItem {
  const effectiveRing = Math.min(4, ring + Math.floor(clearCount / 2)) as 1 | 2 | 3 | 4;
  const candidates = ITEM_CATALOG.filter((item) => item.minRing <= effectiveRing);
  const highTierPool = candidates.filter((item) => item.minRing >= Math.max(1, effectiveRing - 1));
  const pool = highTierPool.length > 0 ? highTierPool : candidates;
  const picked = pool[Math.floor(Math.random() * pool.length)] || ITEM_CATALOG[0];

  const clearScale = 1 + Math.min(5, Math.max(0, clearCount - 1)) * 0.15;
  const suffix = clearCount > 1 ? ` +${clearCount - 1}` : '';

  return {
    ...picked,
    instanceId: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: `${picked.name}${suffix}`,
    bonusAttack: Math.round(picked.bonusAttack * clearScale),
    bonusMaxHp: Math.round(picked.bonusMaxHp * clearScale),
    obtainedAt: Date.now(),
  };
}
