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

export interface CampFortificationConfig {
  wallHp: number;
  wallSprite: 'woodPalisade' | 'stoneWall';
  towerCount: number;
  towerHp: number;
  towerAttack: number;
  towerRangePx: number;
  towerFireRateMs: number;
  outerPatrolCount: number;
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
  fortification: CampFortificationConfig;
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
 * 몬스터 부락 링(1~4)별 본진 내구도(3배), 주둔 병과(3배), 방어 타워·방어벽·외곽 순찰 설정
 */
export const CAMP_RING_TEMPLATES: Record<1 | 2 | 3 | 4, CampRingTemplate> = {
  1: {
    ring: 1,
    baseLevel: 2,
    titlePrefix: '초급 마물 전초기지',
    coreMaxHp: 1560,
    buildingSprite: 'blackTower',
    respawnSec: 180,
    threatGainOnClear: 19,
    clearBonusExp: 55,
    clearResourceReward: { wood: 25, stone: 20, gold: 12 },
    fortification: {
      wallHp: 420,
      wallSprite: 'woodPalisade',
      towerCount: 0,
      towerHp: 0,
      towerAttack: 0,
      towerRangePx: 0,
      towerFireRateMs: 0,
      outerPatrolCount: 6,
    },
    garrisonSpecs: [
      {
        type: 'goblin',
        role: 'melee',
        name: '🗡️ 고블린 돌격병',
        count: 15,
        hp: 175,
        attack: 22,
        speed: 74,
        expReward: 22,
      },
      {
        type: 'skeleton',
        role: 'ranged',
        name: '🏹 해골 궁수',
        count: 9,
        hp: 140,
        attack: 23,
        speed: 64,
        expReward: 26,
      },
    ],
  },
  2: {
    ring: 2,
    baseLevel: 5,
    titlePrefix: '중급 흑기사 주둔지',
    coreMaxHp: 3150,
    buildingSprite: 'blackTower',
    respawnSec: 180,
    threatGainOnClear: 24,
    clearBonusExp: 95,
    clearResourceReward: { wood: 40, stone: 35, gold: 22 },
    fortification: {
      wallHp: 780,
      wallSprite: 'stoneWall',
      towerCount: 2,
      towerHp: 820,
      towerAttack: 38,
      towerRangePx: 300,
      towerFireRateMs: 1300,
      outerPatrolCount: 8,
    },
    garrisonSpecs: [
      {
        type: 'goblin',
        role: 'melee',
        name: '🗡️ 흑기사 선봉대',
        count: 9,
        hp: 390,
        attack: 42,
        speed: 78,
        expReward: 38,
      },
      {
        type: 'lancer',
        role: 'lancer',
        name: '🔱 흑철 창기병',
        count: 9,
        hp: 420,
        attack: 46,
        speed: 86,
        expReward: 42,
      },
      {
        type: 'skeleton',
        role: 'ranged',
        name: '🏹 저주받은 명사수',
        count: 9,
        hp: 310,
        attack: 40,
        speed: 68,
        expReward: 38,
      },
    ],
  },
  3: {
    ring: 3,
    baseLevel: 8,
    titlePrefix: '상급 흑마법 제단',
    coreMaxHp: 5100,
    buildingSprite: 'blackCastle',
    respawnSec: 180,
    threatGainOnClear: 30,
    clearBonusExp: 150,
    clearResourceReward: { wood: 65, stone: 55, gold: 38 },
    fortification: {
      wallHp: 1250,
      wallSprite: 'stoneWall',
      towerCount: 4,
      towerHp: 1350,
      towerAttack: 56,
      towerRangePx: 325,
      towerFireRateMs: 1200,
      outerPatrolCount: 10,
    },
    garrisonSpecs: [
      {
        type: 'goblin',
        role: 'melee',
        name: '🗡️ 제단 광전사',
        count: 9,
        hp: 760,
        attack: 66,
        speed: 82,
        expReward: 58,
      },
      {
        type: 'lancer',
        role: 'lancer',
        name: '🔱 성소 수호 창병',
        count: 9,
        hp: 800,
        attack: 70,
        speed: 88,
        expReward: 62,
      },
      {
        type: 'skeleton',
        role: 'ranged',
        name: '🏹 암흑 석궁병',
        count: 9,
        hp: 580,
        attack: 62,
        speed: 72,
        expReward: 56,
      },
      {
        type: 'archmage',
        role: 'mage',
        name: '🔮 심연의 흑마법사',
        count: 6,
        hp: 660,
        attack: 76,
        speed: 62,
        expReward: 74,
      },
    ],
  },
  4: {
    ring: 4,
    baseLevel: 12,
    titlePrefix: '심연의 대군주 요새',
    coreMaxHp: 7800,
    buildingSprite: 'purpleCastle',
    respawnSec: 180,
    threatGainOnClear: 36,
    clearBonusExp: 240,
    clearResourceReward: { wood: 95, stone: 85, gold: 65 },
    fortification: {
      wallHp: 1900,
      wallSprite: 'stoneWall',
      towerCount: 4,
      towerHp: 2100,
      towerAttack: 82,
      towerRangePx: 350,
      towerFireRateMs: 1100,
      outerPatrolCount: 12,
    },
    garrisonSpecs: [
      {
        type: 'goblin',
        role: 'melee',
        name: '🗡️ 심연 중장갑 전사',
        count: 12,
        hp: 1350,
        attack: 96,
        speed: 82,
        expReward: 88,
      },
      {
        type: 'lancer',
        role: 'lancer',
        name: '🔱 암흑룡 랜서',
        count: 12,
        hp: 1300,
        attack: 102,
        speed: 94,
        expReward: 94,
      },
      {
        type: 'skeleton',
        role: 'ranged',
        name: '🏹 망자의 저격수',
        count: 12,
        hp: 980,
        attack: 88,
        speed: 74,
        expReward: 84,
      },
      {
        type: 'archmage',
        role: 'mage',
        name: '🔮 혈마법 대사제',
        count: 9,
        hp: 1150,
        attack: 108,
        speed: 64,
        expReward: 108,
      },
    ],
  },
};

/**
 * 사냥 특화 모드 AI 어그로·추격 반경 및 난이도별 물량 배율 설정
 */
export const HUNTING_AI_CONFIG = {
  /** 부락 수비병의 플레이어 탐지 사거리 (px) */
  campAggroRadiusPx: 560,
  /** 부락 수비병의 최대 추격 이탈 거리 (px) */
  campLeashRadiusPx: 880,
  /** 추격 이탈 한계 도달 후 부락 복귀 시 이동 속도 배율 */
  campReturnSpeedMultiplier: 2.25,
  /** 부락 복귀 완료로 판정하는 스폰 지점 도착 반경 (px) */
  campReturnArrivalRadiusPx: 42,
  /** 웨이브/던전 진격 몹이 지나가는 플레이어를 발견하고 즉시 공격 전환하는 근접 어그로 반경 (px) */
  waveProximityAggroRadiusPx: 320,
  /** 근접 어그로로 추격 시 최대 이탈 허용 거리 (px) */
  waveProximityChaseMaxPx: 490,
  /** 부락 본진/동료 피격 시 부락 전체 어그로 유지 시간 (ms) */
  campAlertDurationMs: 14_000,
  /** 난이도별 부락 주둔군 추가 물량 배율 */
  campCountMultiplierByDifficulty: {
    normal: 1.0,
    hard: 1.25,
    nightmare: 1.5,
  },
} as const;

/**
 * 사냥 특화 모드에서 위협도 100% 도달 시 출현하는 '심연의 던전 게이트(100마리+ 대군 진격)' 설정
 */
export const DUNGEON_INVASION_CONFIG = {
  /** 기본 진격 몬스터 수 (솔플 기준 100마리, 다인 협동 시 인원 배율 적용) */
  totalMonsterCount: 100,
  /** 프레임 드랍 방지를 위한 분할 펄스 횟수 (5회 연속 출현) */
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
  mageHealAmount: 28,
} as const;
