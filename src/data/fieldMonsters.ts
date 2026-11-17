import { FieldMonsterPackTemplate } from '../types/hunting';

/**
 * 사냥 특화 모드 야생 필드 몬스터 & 필드 엘리트 스폰/전투 설정 (데이터 순수 분리)
 */
export const FIELD_MONSTER_CONFIG = {
  /** 중심 마을(0,0) 안전 반경 (px) - 중앙 본진 주변에는 야생 몹이 스폰되지 않음 */
  centerSafeRadiusPx: 980,
  /** 영지(마을/부락) 외곽으로부터 최소 이격 거리 (px) */
  territoryExclusionMarginPx: 95,
  /** 야생 필드 몬스터 무리 간 최소 간격 (px) */
  minPackSpacingPx: 540,
  /** 솔로 플레이 기준 맵 전체에 유지되는 야생 몬스터 무리 수 */
  baseActivePackCount: 24,
  /** 1개 무리 전멸 후 재스폰까지 대기 시간 (ms) */
  packRespawnDelayMs: 42_000,
  /** 야생 필드 몬스터 1마리 처치 시 위협도 상승량 (%) */
  threatGainOnKill: 1,
  /** 야생 몬스터 순찰 반경 (px) */
  patrolRadiusPx: 140,
  /** 순찰 목표 지점 재선정 주기 (ms) */
  patrolStepIntervalMs: 2800,
  /** 플레이어 탐지(선공) 사거리 (px) */
  fieldAggroRadiusPx: 340,
  /** 최대 추격 이탈 거리 (px) */
  fieldLeashRadiusPx: 680,
} as const;

/**
 * 중심 마을로부터의 거리 링(1~4)별 야생 필드 몬스터 무리 및 필드 엘리트 템플릿
 */
export const FIELD_PACK_TEMPLATES: Record<1 | 2 | 3 | 4, FieldMonsterPackTemplate[]> = {
  1: [
    {
      id: 'field_r1_raiders',
      ring: 1,
      label: '들판 고블린 약탈조',
      guaranteedElite: false,
      units: [
        {
          type: 'goblin',
          role: 'melee',
          name: '👺 들판 고블린',
          count: 2,
          hp: 135,
          attack: 19,
          speed: 70,
          expReward: 18,
          eliteChance: 0.28,
        },
        {
          type: 'zombie',
          role: 'melee',
          name: '🧟 떠돌이 좀비',
          count: 2,
          hp: 145,
          attack: 17,
          speed: 58,
          expReward: 16,
        },
      ],
    },
    {
      id: 'field_r1_ambush',
      ring: 1,
      label: '초원 매복조',
      guaranteedElite: true,
      units: [
        {
          type: 'goblin',
          role: 'melee',
          name: '👺 우두머리 고블린',
          count: 1,
          hp: 155,
          attack: 22,
          speed: 74,
          expReward: 24,
        },
        {
          type: 'skeleton',
          role: 'ranged',
          name: '🏹 들판 해골사수',
          count: 2,
          hp: 110,
          attack: 20,
          speed: 62,
          expReward: 20,
        },
      ],
    },
  ],
  2: [
    {
      id: 'field_r2_patrol',
      ring: 2,
      label: '흑철 순찰대',
      guaranteedElite: true,
      units: [
        {
          type: 'lancer',
          role: 'lancer',
          name: '🔱 야생 흑철 창병',
          count: 2,
          hp: 230,
          attack: 29,
          speed: 82,
          expReward: 32,
        },
        {
          type: 'skeleton',
          role: 'ranged',
          name: '🏹 숲의 망령궁수',
          count: 2,
          hp: 170,
          attack: 26,
          speed: 66,
          expReward: 28,
        },
      ],
    },
    {
      id: 'field_r2_vanguard',
      ring: 2,
      label: '황야 마물 무리',
      guaranteedElite: false,
      units: [
        {
          type: 'goblin',
          role: 'melee',
          name: '🗡️ 황야 약탈병',
          count: 3,
          hp: 215,
          attack: 26,
          speed: 76,
          expReward: 28,
          eliteChance: 0.45,
        },
        {
          type: 'lancer',
          role: 'lancer',
          name: '🔱 황야 돌격창병',
          count: 1,
          hp: 240,
          attack: 30,
          speed: 82,
          expReward: 34,
        },
      ],
    },
  ],
  3: [
    {
      id: 'field_r3_coven',
      ring: 3,
      label: '암흑 주술사 호위대',
      guaranteedElite: true,
      units: [
        {
          type: 'lancer',
          role: 'lancer',
          name: '🔱 성소 호위 창기병',
          count: 2,
          hp: 330,
          attack: 37,
          speed: 86,
          expReward: 44,
        },
        {
          type: 'archmage',
          role: 'mage',
          name: '🔮 방랑 흑마법사',
          count: 1,
          hp: 285,
          attack: 44,
          speed: 60,
          expReward: 55,
        },
        {
          type: 'skeleton',
          role: 'ranged',
          name: '🏹 암흑 추적사수',
          count: 2,
          hp: 245,
          attack: 34,
          speed: 68,
          expReward: 40,
        },
      ],
    },
  ],
  4: [
    {
      id: 'field_r4_abyss_champions',
      ring: 4,
      label: '심연 외곽 정예 사냥대',
      guaranteedElite: true,
      units: [
        {
          type: 'goblin',
          role: 'melee',
          name: '🗡️ 심연 약탈 군주',
          count: 2,
          hp: 460,
          attack: 48,
          speed: 80,
          expReward: 62,
          eliteChance: 0.5,
        },
        {
          type: 'lancer',
          role: 'lancer',
          name: '🔱 폭풍 암흑 창기병',
          count: 2,
          hp: 450,
          attack: 52,
          speed: 90,
          expReward: 65,
        },
        {
          type: 'archmage',
          role: 'mage',
          name: '🔮 심연의 황야술사',
          count: 1,
          hp: 390,
          attack: 56,
          speed: 62,
          expReward: 74,
        },
      ],
    },
  ],
};
