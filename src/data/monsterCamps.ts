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
    threatGainOnClear: 19,
    clearBonusExp: 55,
    clearResourceReward: { wood: 25, stone: 20, gold: 12 },
    garrisonSpecs: [
      {
        type: 'goblin',
        role: 'melee',
        name: '🗡️ 고블린 돌격병',
        count: 4,
        hp: 120,
        attack: 16,
        speed: 68,
        expReward: 22,
      },
      {
        type: 'skeleton',
        role: 'ranged',
        name: '🏹 해골 궁수',
        count: 2,
        hp: 90,
        attack: 18,
        speed: 60,
        expReward: 26,
      },
    ],
  },
  2: {
    ring: 2,
    baseLevel: 5,
    titlePrefix: '중급 흑기사 주둔지',
    coreMaxHp: 750,
    buildingSprite: 'blackTower',
    respawnSec: 180,
    threatGainOnClear: 24,
    clearBonusExp: 95,
    clearResourceReward: { wood: 40, stone: 35, gold: 22 },
    garrisonSpecs: [
      {
        type: 'goblin',
        role: 'melee',
        name: '🗡️ 흑기사 선봉대',
        count: 2,
        hp: 175,
        attack: 22,
        speed: 72,
        expReward: 32,
      },
      {
        type: 'lancer',
        role: 'lancer',
        name: '🔱 흑철 창기병',
        count: 3,
        hp: 185,
        attack: 25,
        speed: 78,
        expReward: 35,
      },
      {
        type: 'skeleton',
        role: 'ranged',
        name: '🏹 저주받은 명사수',
        count: 3,
        hp: 135,
        attack: 22,
        speed: 64,
        expReward: 32,
      },
    ],
  },
  3: {
    ring: 3,
    baseLevel: 8,
    titlePrefix: '상급 흑마법 제단',
    coreMaxHp: 1200,
    buildingSprite: 'blackCastle',
    respawnSec: 180,
    threatGainOnClear: 30,
    clearBonusExp: 150,
    clearResourceReward: { wood: 65, stone: 55, gold: 38 },
    garrisonSpecs: [
      {
        type: 'goblin',
        role: 'melee',
        name: '🗡️ 제단 광전사',
        count: 2,
        hp: 255,
        attack: 30,
        speed: 74,
        expReward: 46,
      },
      {
        type: 'lancer',
        role: 'lancer',
        name: '🔱 성소 수호 창병',
        count: 3,
        hp: 265,
        attack: 32,
        speed: 80,
        expReward: 48,
      },
      {
        type: 'skeleton',
        role: 'ranged',
        name: '🏹 암흑 석궁병',
        count: 3,
        hp: 195,
        attack: 28,
        speed: 66,
        expReward: 45,
      },
      {
        type: 'archmage',
        role: 'mage',
        name: '🔮 심연의 흑마법사',
        count: 2,
        hp: 230,
        attack: 38,
        speed: 56,
        expReward: 60,
      },
    ],
  },
  4: {
    ring: 4,
    baseLevel: 12,
    titlePrefix: '심연의 대군주 요새',
    coreMaxHp: 1800,
    buildingSprite: 'purpleCastle',
    respawnSec: 180,
    threatGainOnClear: 36,
    clearBonusExp: 240,
    clearResourceReward: { wood: 95, stone: 85, gold: 65 },
    garrisonSpecs: [
      {
        type: 'goblin',
        role: 'melee',
        name: '🗡️ 심연 중장갑 전사',
        count: 4,
        hp: 360,
        attack: 40,
        speed: 72,
        expReward: 65,
      },
      {
        type: 'lancer',
        role: 'lancer',
        name: '🔱 암흑룡 랜서',
        count: 3,
        hp: 345,
        attack: 44,
        speed: 86,
        expReward: 70,
      },
      {
        type: 'skeleton',
        role: 'ranged',
        name: '🏹 망자의 저격수',
        count: 3,
        hp: 270,
        attack: 38,
        speed: 68,
        expReward: 62,
      },
      {
        type: 'archmage',
        role: 'mage',
        name: '🔮 혈마법 대사제',
        count: 2,
        hp: 310,
        attack: 48,
        speed: 58,
        expReward: 80,
      },
    ],
  },
};

/**
 * 사냥 특화 모드 AI 어그로·추격 반경 및 난이도별 물량 배율 설정
 */
export const HUNTING_AI_CONFIG = {
  /** 부락 수비병의 플레이어 탐지 사거리 (px) */
  campAggroRadiusPx: 540,
  /** 부락 수비병의 최대 추격 이탈 거리 (px) */
  campLeashRadiusPx: 840,
  /** 웨이브/던전 진격 몹이 지나가는 플레이어를 발견하고 즉시 공격 전환하는 근접 어그로 반경 (px) */
  waveProximityAggroRadiusPx: 290,
  /** 근접 어그로로 추격 시 최대 이탈 허용 거리 (px) */
  waveProximityChaseMaxPx: 460,
  /** 부락 본진/동료 피격 시 부락 전체 어그로 유지 시간 (ms) */
  campAlertDurationMs: 12_000,
  /** 난이도별 부락 주둔군 추가 물량 배율 */
  campCountMultiplierByDifficulty: {
    normal: 1.0,
    hard: 1.25,
    nightmare: 1.5,
  },
} as const;

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
