import {
  FieldEliteTier,
  MonsterDropResult,
  PotionDefinition,
  PotionId,
  PotionInventory,
  ResourceBundleDrop,
} from '../types/hunting';
import { rollMonsterDropItem } from './items';

/**
 * 도구상점 판매 및 몬스터 드랍 치유 물약 데이터 (순수 데이터 분리)
 * [AI Guideline]: 수치·가격·쿨타임 밸런스 조정은 이 파일에서만 수행하세요.
 */
export const POTION_DEFINITIONS: Record<PotionId, PotionDefinition> = {
  potion_small: {
    id: 'potion_small',
    name: '소형 치유 물약',
    shortName: '소형',
    icon: '🧪',
    spritePath: '/assets/items/potions/potion_small.png',
    textureKey: 'item_potion_small',
    hotkey: '1',
    healAmount: 45,
    costGold: 6,
    cooldownMs: 4000,
    maxStack: 15,
    description: '체력을 즉시 +45 회복합니다. 초반 사냥에 부담 없이 사용하기 좋습니다.',
  },
  potion_medium: {
    id: 'potion_medium',
    name: '중형 치유 물약',
    shortName: '중형',
    icon: '⚗️',
    spritePath: '/assets/items/potions/potion_medium.png',
    textureKey: 'item_potion_medium',
    hotkey: '2',
    healAmount: 110,
    costGold: 14,
    cooldownMs: 4000,
    maxStack: 10,
    description: '체력을 즉시 +110 회복합니다. 정예 몬스터 및 부락 공략에 적합합니다.',
  },
  potion_large: {
    id: 'potion_large',
    name: '대형 치유 물약',
    shortName: '대형',
    icon: '🏺',
    spritePath: '/assets/items/potions/potion_large.png',
    textureKey: 'item_potion_large',
    hotkey: '3',
    healAmount: 240,
    costGold: 28,
    cooldownMs: 4000,
    maxStack: 8,
    description: '체력을 즉시 +240 회복합니다. 보스전 및 위기 상황의 생명줄입니다.',
  },
};

export const POTION_LIST: PotionDefinition[] = [
  POTION_DEFINITIONS.potion_small,
  POTION_DEFINITIONS.potion_medium,
  POTION_DEFINITIONS.potion_large,
];

export const INITIAL_POTION_INVENTORY: PotionInventory = {
  potion_small: 2,
  potion_medium: 0,
  potion_large: 0,
};

/**
 * 신성 치유 성소(special_sanctuary) 주변 플레이어 지속 치유 오라 설정
 */
export const SANCTUARY_HEAL_CONFIG = {
  /** 플레이어 치유 오라 발동 주기 (ms) */
  healIntervalMs: 5000,
  /** 성소 중심 기준 플레이어 치유 반경 (px) */
  healRadiusPx: 300,
  /** 기본 고정 회복량 (HP) */
  flatHealAmount: 12,
  /** 최대 체력 비례 추가 회복 비율 (8%) */
  maxHpHealRatio: 0.08,
} as const;

/**
 * 몬스터 등급별 전리품 드랍 밸런스 테이블
 * - 일반/정예는 장비, 물약, 자원 꾸러미 중 최대 1종을 가중치 확률로 드랍
 * - 보스는 장비 100% 확정 + 보너스 물약/자원 꾸러미 추가 드랍
 */
export const MONSTER_DROP_BALANCE_CONFIG = {
  normal: {
    equipmentChance: 0.10,
    potionChance: 0.08,
    resourceChance: 0.18,
  },
  elite: {
    weakenedEquipmentChance: 0.36,
    standardEquipmentChance: 0.44,
    empoweredEquipmentChance: 0.54,
    potionChance: 0.18,
    resourceChance: 0.24,
  },
  boss: {
    bonusPotionChance: 0.65,
    bonusResourceChance: 0.85,
  },
} as const;

export const RESOURCE_BUNDLE_SPRITES = [
  { textureKey: 'item_bundle_wood', spritePath: '/assets/items/bundles/bundle_wood.png' },
  { textureKey: 'item_bundle_stone', spritePath: '/assets/items/bundles/bundle_stone.png' },
  { textureKey: 'item_bundle_gold', spritePath: '/assets/items/bundles/bundle_gold.png' },
  { textureKey: 'item_bundle_elite', spritePath: '/assets/items/bundles/bundle_elite.png' },
  { textureKey: 'item_bundle_boss', spritePath: '/assets/items/bundles/bundle_boss.png' },
] as const;

function randInt(min: number, max: number): number {
  if (max <= min) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

function rollResourceBundle(
  ring: 1 | 2 | 3 | 4,
  tier: 'normal' | 'elite' | 'boss'
): ResourceBundleDrop {
  if (tier === 'boss') {
    const wood = randInt(4, 6);
    const stone = randInt(3, 5);
    const gold = randInt(4, 7);
    return {
      wood,
      stone,
      gold,
      label: '보스 전리품 꾸러미',
      icon: '🎒',
      spritePath: '/assets/items/bundles/bundle_boss.png',
      textureKey: 'item_bundle_boss',
    };
  }

  if (tier === 'elite') {
    const roll = Math.random();
    if (roll < 0.45) {
      const wood = randInt(2, 3 + Math.floor(ring / 2));
      const stone = randInt(1, 2);
      return {
        wood,
        stone,
        gold: 0,
        label: '정예 보급 꾸러미',
        icon: '🎒',
        spritePath: '/assets/items/bundles/bundle_elite.png',
        textureKey: 'item_bundle_elite',
      };
    }
    const gold = randInt(2, 3 + Math.floor(ring / 2));
    return {
      wood: 1,
      stone: 1,
      gold,
      label: '정예 금화 주머니',
      icon: '💰',
      spritePath: '/assets/items/bundles/bundle_gold.png',
      textureKey: 'item_bundle_gold',
    };
  }

  // 일반 몬스터: 기존 채집/생산 경제(벌목장 30초당 +2 등)를 해치지 않는 소량 꾸러미
  const pick = Math.random();
  if (pick < 0.4) {
    return {
      wood: randInt(1, 2),
      stone: 0,
      gold: 0,
      label: '목재 꾸러미',
      icon: '🪵',
      spritePath: '/assets/items/bundles/bundle_wood.png',
      textureKey: 'item_bundle_wood',
    };
  }
  if (pick < 0.75) {
    return {
      wood: 0,
      stone: randInt(1, 2),
      gold: 0,
      label: '석재 꾸러미',
      icon: '🪨',
      spritePath: '/assets/items/bundles/bundle_stone.png',
      textureKey: 'item_bundle_stone',
    };
  }
  return {
    wood: 0,
    stone: 0,
    gold: randInt(1, 2),
    label: '작은 금화 주머니',
    icon: '🪙',
    spritePath: '/assets/items/bundles/bundle_gold.png',
    textureKey: 'item_bundle_gold',
  };
}

function rollPotionId(tier: 'normal' | 'elite' | 'boss', ring: 1 | 2 | 3 | 4): PotionId {
  const r = Math.random();
  if (tier === 'boss') {
    return r < 0.55 ? 'potion_large' : 'potion_medium';
  }
  if (tier === 'elite') {
    if (ring >= 3 && r < 0.25) return 'potion_large';
    if (r < 0.65) return 'potion_medium';
    return 'potion_small';
  }
  return r < 0.15 && ring >= 2 ? 'potion_medium' : 'potion_small';
}

/**
 * 몬스터 처치 시 장비·물약·자원 꾸러미 드랍을 밸런스에 맞춰 추첨하는 순수 함수
 */
export function rollMonsterLoot(params: {
  ring: 1 | 2 | 3 | 4;
  isElite: boolean;
  isBoss: boolean;
  isHuntingMode: boolean;
  difficultyId: 'normal' | 'hard' | 'nightmare';
  eliteTier?: FieldEliteTier;
}): MonsterDropResult[] {
  const results: MonsterDropResult[] = [];
  const diffBonus =
    params.difficultyId === 'nightmare' ? 0.12 : params.difficultyId === 'hard' ? 0.06 : 0;

  if (params.isBoss) {
    if (params.isHuntingMode) {
      const equip = rollMonsterDropItem({
        ring: params.ring,
        isElite: false,
        isBoss: true,
        difficultyId: params.difficultyId,
        eliteTier: params.eliteTier,
      });
      if (equip) results.push({ kind: 'equipment', item: equip });
    }
    if (Math.random() < MONSTER_DROP_BALANCE_CONFIG.boss.bonusPotionChance) {
      results.push({ kind: 'potion', potionId: rollPotionId('boss', params.ring), count: 1 });
    }
    if (Math.random() < MONSTER_DROP_BALANCE_CONFIG.boss.bonusResourceChance) {
      results.push({ kind: 'resource', bundle: rollResourceBundle(params.ring, 'boss') });
    }
    return results;
  }

  const equipChance = !params.isHuntingMode
    ? 0
    : params.isElite
    ? (params.eliteTier === 'empowered'
        ? MONSTER_DROP_BALANCE_CONFIG.elite.empoweredEquipmentChance
        : params.eliteTier === 'weakened'
        ? MONSTER_DROP_BALANCE_CONFIG.elite.weakenedEquipmentChance
        : MONSTER_DROP_BALANCE_CONFIG.elite.standardEquipmentChance) + diffBonus
    : MONSTER_DROP_BALANCE_CONFIG.normal.equipmentChance + diffBonus * 0.25;

  const potionChance = params.isElite
    ? MONSTER_DROP_BALANCE_CONFIG.elite.potionChance
    : MONSTER_DROP_BALANCE_CONFIG.normal.potionChance;

  const resourceChance = params.isElite
    ? MONSTER_DROP_BALANCE_CONFIG.elite.resourceChance
    : MONSTER_DROP_BALANCE_CONFIG.normal.resourceChance;

  const roll = Math.random();
  if (roll < equipChance) {
    const equip = rollMonsterDropItem({
      ring: params.ring,
      isElite: params.isElite,
      isBoss: false,
      difficultyId: params.difficultyId,
      eliteTier: params.eliteTier,
    });
    if (equip) {
      results.push({ kind: 'equipment', item: equip });
      return results;
    }
  } else if (roll < equipChance + potionChance) {
    results.push({
      kind: 'potion',
      potionId: rollPotionId(params.isElite ? 'elite' : 'normal', params.ring),
      count: 1,
    });
    return results;
  } else if (roll < equipChance + potionChance + resourceChance) {
    results.push({
      kind: 'resource',
      bundle: rollResourceBundle(params.ring, params.isElite ? 'elite' : 'normal'),
    });
    return results;
  }

  return results;
}
