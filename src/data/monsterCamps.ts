import { MonsterCombatRole, MonsterType } from '../types/game';

export interface CampMonsterSpec {
  type: MonsterType;
  role: MonsterCombatRole;
  name: string;
  count: number;
  hp: number;
  attack: number;
  speed: number;
  expReward: number;
}

export interface CampRingTemplate {
  ring: 1 | 2 | 3 | 4;
  baseLevel: number;
  titlePrefix: string;
  coreMaxHp: number;
  buildingSprite: 'blackTower' | 'blackCastle' | 'purpleCastle';
  respawnSec: number;
  threatGainOnClear: number;
  clearBonusExp: number;
  clearResourceReward: { wood: number; stone: number; gold: number };
  garrisonSpecs: CampMonsterSpec[];
}

/**
 * 중심 마을(0,0)로부터의 맨해튼/체비쇼프 거리 기준 부락 링 등급 계산
 */
export function computeCampRing(gridX: number, gridY: number): 1 | 2 | 3 | 4 {
  const absX = Math.abs(gridX);
  const absY = Math.abs(gridY);
  const manhattan = absX + absY;
  const chebyshev = Math.max(absX, absY);

  if (manhattan === 1) return 1; // 동·서·남·북 인접 4곳
  if (chebyshev === 1 && manhattan === 2) return 2; // 대각선 인접 4곳
  if (chebyshev === 2 && (absX === 0 || absY === 0)) return 3; // 거리 2 십자 4곳
  return 4; // 최외곽 국경 8곳
}

/**
 * 몬스터 부락 링(1~4)별 본진 내구도, 주둔 병과(근거리/창병/원거리/마법사) 및 보상 설정
 */
export const CAMP_RING_TEMPLATES: Record<1 | 2 | 3 | 4, CampRingTemplate> = {
  1: {
    ring: 1,
    baseLevel: 2,
    titlePrefix: '초급 마물 전초기지',
    coreMaxHp: 360,
    buildingSprite: 'blackTower',
    respawnSec: 180,
    threatGainOnClear: 18,
    clearBonusExp: 55,
    clearResourceReward: { wood: 25, stone: 20, gold: 12 },
    garrisonSpecs: [
      {
        type: 'goblin',
        role: 'melee',
        name: '🗡️ 고블린 돌격병',
        count: 2,
        hp: 110,
        attack: 14,
        speed: 62,
        expReward: 22,
      },
      {
        type: 'skeleton',
        role: 'ranged',
        name: '🏹 해골 궁수',
        count: 1,
        hp: 85,
        attack: 16,
        speed: 56,
        expReward: 26,
      },
    ],
  },
  2: {
    ring: 2,
    baseLevel: 5,
    titlePrefix: '중급 흑기사 주둔지',
    coreMaxHp: 620,
    buildingSprite: 'blackTower',
    respawnSec: 180,
    threatGainOnClear: 22,
    clearBonusExp: 95,
    clearResourceReward: { wood: 40, stone: 35, gold: 22 },
    garrisonSpecs: [
      {
        type: 'lancer',
        role: 'lancer',
        name: '🔱 흑철 창기병',
        count: 2,
        hp: 165,
        attack: 22,
        speed: 74,
        expReward: 35,
      },
      {
        type: 'skeleton',
        role: 'ranged',
        name: '🏹 저주받은 명사수',
        count: 2,
        hp: 125,
        attack: 20,
        speed: 60,
        expReward: 32,
      },
    ],
  },
  3: {
    ring: 3,
    baseLevel: 8,
    titlePrefix: '상급 흑마법 제단',
    coreMaxHp: 980,
    buildingSprite: 'blackCastle',
    respawnSec: 180,
    threatGainOnClear: 28,
    clearBonusExp: 150,
    clearResourceReward: { wood: 65, stone: 55, gold: 38 },
    garrisonSpecs: [
      {
        type: 'lancer',
        role: 'lancer',
        name: '🔱 성소 수호 창병',
        count: 2,
        hp: 240,
        attack: 28,
        speed: 76,
        expReward: 48,
      },
      {
        type: 'skeleton',
        role: 'ranged',
        name: '🏹 암흑 석궁병',
        count: 1,
        hp: 180,
        attack: 26,
        speed: 62,
        expReward: 45,
      },
      {
        type: 'archmage',
        role: 'mage',
        name: '🔮 심연의 흑마법사',
        count: 1,
        hp: 210,
        attack: 34,
        speed: 52,
        expReward: 60,
      },
    ],
  },
  4: {
    ring: 4,
    baseLevel: 12,
    titlePrefix: '심연의 대군주 요새',
    coreMaxHp: 1450,
    buildingSprite: 'purpleCastle',
    respawnSec: 180,
    threatGainOnClear: 34,
    clearBonusExp: 240,
    clearResourceReward: { wood: 95, stone: 85, gold: 65 },
    garrisonSpecs: [
      {
        type: 'goblin',
        role: 'melee',
        name: '🗡️ 심연 중장갑 전사',
        count: 2,
        hp: 340,
        attack: 36,
        speed: 68,
        expReward: 65,
      },
      {
        type: 'lancer',
        role: 'lancer',
        name: '🔱 암흑룡 랜서',
        count: 1,
        hp: 320,
        attack: 40,
        speed: 82,
        expReward: 70,
      },
      {
        type: 'skeleton',
        role: 'ranged',
        name: '🏹 망자의 저격수',
        count: 1,
        hp: 250,
        attack: 34,
        speed: 64,
        expReward: 62,
      },
      {
        type: 'archmage',
        role: 'mage',
        name: '🔮 혈마법 대사제',
        count: 1,
        hp: 290,
        attack: 44,
        speed: 55,
        expReward: 80,
      },
    ],
  },
};

/**
 * 사냥 특화 모드에서 위협도 100% 도달 시 출현하는 '심연의 던전 게이트(100마리 대군 진격)' 설정
 */
export const DUNGEON_INVASION_CONFIG = {
  /** 총 진격 몬스터 수 (요구사항: 100마리) */
  totalMonsterCount: 100,
  /** 프레임 드랍 방지를 위한 분할 펄스 횟수 (20마리씩 5회 연속 출현) */
  pulseCount: 5,
  /** 각 펄스 간격 (ms) */
  pulseIntervalMs: 1350,
  /** 던전 스폰 진형 반경 (px) */
  portalSpreadRadiusPx: 260,
  /** 원거리 몬스터 사거리 (px) */
  rangedAttackRangePx: 265,
  /** 마법사 몬스터 사거리 (px) */
  mageAttackRangePx: 295,
  /** 마법사 주술 치유량 (주변 아군 마물/부락 본진 회복) */
  mageHealAmount: 18,
} as const;
