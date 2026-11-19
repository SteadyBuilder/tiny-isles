import { FieldMonsterPackTemplate } from '../types/hunting';

/**
 * 사냥 특화 모드 야생 필드 몬스터 & 필드 엘리트 스폰/전투 설정 (데이터 순수 분리)
 */
export const FIELD_MONSTER_CONFIG = {
  /** 중심 마을(0,0) 코어 기준 최소 안전 반경 (px) - 방어타워 사거리 밖 유지 */
  centerSafeRadiusPx: 1120,
  /** 중심 마을(0,0) 영지 외곽 경계로부터 최소 스폰 이격 거리 (px) */
  centerTerritoryExclusionMarginPx: 260,
  /** 추격 중 중심 마을 외곽 경계 접근 시 즉시 어그로를 끊고 복귀하는 경계 여유 거리 (px) */
  centerReturnTriggerMarginPx: 220,
  /** 일반 몬스터 부락 외곽으로부터 최소 이격 거리 (px) */
  territoryExclusionMarginPx: 110,
  /** 야생 필드 몬스터 무리 간 최소 간격 (px) */
  minPackSpacingPx: 400,
  /** 영지 근처 존 최소/최대 스폰 반경 (중심 마을 코어 기준 px) */
  nearVillageMinRadiusPx: 1140,
  nearVillageMaxRadiusPx: 1850,
  /** 부락 인접 존 최소/최대 스폰 반경 (부락 코어 기준 px) */
  nearCampMinRadiusPx: 820,
  nearCampMaxRadiusPx: 1380,
  /** 솔로 플레이 기준 존별 유지 무리 수 */
  nearVillagePackCount: 12,
  midFieldPackCount: 12,
  nearCampPackCount: 16,
  /** 영지 근처 소규모 몹 전멸 후 재스폰 대기 시간 (ms) */
  nearVillageRespawnDelayMs: 22_000,
  /** 일반/부락 인접 무리 전멸 후 재스폰 대기 시간 (ms) */
  packRespawnDelayMs: 36_000,
  /** 야생 필드 몬스터 1마리 처치 시 위협도 상승량 (%) */
  threatGainOnKill: 1,
  /** 야생 몬스터 순찰 반경 (px) */
  patrolRadiusPx: 145,
  /** 순찰(배회) AI를 가동하는 최소 플레이어 근접 반경 (px) - 원거리 비활성 몹 패킷 낭비 방지 */
  patrolActivePlayerRadiusPx: 880,
  /** 순찰 목표 지점 재선정 주기 (ms) */
  patrolStepIntervalMs: 2600,
  /** 플레이어 탐지(선공) 사거리 (px) */
  fieldAggroRadiusPx: 350,
  /** 최대 추격 이탈 거리 (px) */
  fieldLeashRadiusPx: 680,
  /** 추격 이탈 한계 도달 후 거점 복귀 시 이동 속도 배율 */
  fieldReturnSpeedMultiplier: 2.25,
  /** 거점 복귀 완료 판정 반경 (px) */
  fieldReturnArrivalRadiusPx: 42,
} as const;

/**
 * 플레이어 영지(0,0) 근처 전용: 1마리 단독 배회 / 2마리 소규모 그룹 / 약화된 엘리트(희귀템 파밍용)
 */
export const FIELD_NEAR_VILLAGE_PACK_TEMPLATES: FieldMonsterPackTemplate[] = [
  {
    id: 'nv_solo_goblin',
    ring: 1,
    zone: 'near_village',
    label: '외곽 정찰 고블린',
    guaranteedElite: false,
    eliteTier: 'none',
    units: [
      {
        type: 'goblin',
        role: 'melee',
        name: '👺 떠돌이 고블린',
        count: 1,
        hp: 135,
        attack: 19,
        speed: 70,
        expReward: 22,
        eliteChance: 0,
      },
    ],
  },
  {
    id: 'nv_solo_zombie',
    ring: 1,
    zone: 'near_village',
    label: '외곽 배회 좀비',
    guaranteedElite: false,
    eliteTier: 'none',
    units: [
      {
        type: 'zombie',
        role: 'melee',
        name: '🧟 들판 좀비',
        count: 1,
        hp: 150,
        attack: 17,
        speed: 58,
        expReward: 20,
        eliteChance: 0,
      },
    ],
  },
  {
    id: 'nv_solo_slime',
    ring: 1,
    zone: 'near_village',
    label: '외곽 통통 슬라임',
    guaranteedElite: false,
    eliteTier: 'none',
    units: [
      {
        type: 'slime',
        role: 'melee',
        name: '💧 들판 슬라임',
        count: 2,
        hp: 110,
        attack: 15,
        speed: 64,
        expReward: 18,
        eliteChance: 0,
      },
    ],
  },
  {
    id: 'nv_duo_goblins',
    ring: 1,
    zone: 'near_village',
    label: '고블린 2인 약탈조',
    guaranteedElite: false,
    eliteTier: 'none',
    units: [
      {
        type: 'goblin',
        role: 'melee',
        name: '👺 들판 고블린',
        count: 2,
        hp: 140,
        attack: 20,
        speed: 72,
        expReward: 21,
        eliteChance: 0,
      },
    ],
  },
  {
    id: 'nv_duo_mixed',
    ring: 1,
    zone: 'near_village',
    label: '들판 2인 척후조',
    guaranteedElite: false,
    eliteTier: 'none',
    units: [
      {
        type: 'zombie',
        role: 'melee',
        name: '🧟 떠돌이 좀비',
        count: 1,
        hp: 150,
        attack: 18,
        speed: 60,
        expReward: 20,
        eliteChance: 0,
      },
      {
        type: 'skeleton',
        role: 'ranged',
        name: '🏹 외곽 해골사수',
        count: 1,
        hp: 120,
        attack: 20,
        speed: 64,
        expReward: 23,
        eliteChance: 0,
      },
    ],
  },
  {
    id: 'nv_weak_elite_solo',
    ring: 1,
    zone: 'near_village',
    label: '약화된 야생 정예',
    guaranteedElite: true,
    eliteTier: 'weakened',
    units: [
      {
        type: 'goblin',
        role: 'melee',
        name: '고블린 척후대장',
        count: 1,
        hp: 205,
        attack: 23,
        speed: 74,
        expReward: 42,
      },
    ],
  },
  {
    id: 'nv_weak_elite_duo',
    ring: 1,
    zone: 'near_village',
    label: '약화된 정예와 졸개',
    guaranteedElite: true,
    eliteTier: 'weakened',
    units: [
      {
        type: 'lancer',
        role: 'lancer',
        name: '초원 창기병',
        count: 1,
        hp: 215,
        attack: 24,
        speed: 78,
        expReward: 46,
      },
      {
        type: 'goblin',
        role: 'melee',
        name: '👺 고블린 졸개',
        count: 1,
        hp: 135,
        attack: 19,
        speed: 70,
        expReward: 20,
        eliteChance: 0,
      },
    ],
  },
];

/**
 * 거리 링(1~4)별 야생 필드 몬스터 무리 및 부락 인접 강화 필드 엘리트 템플릿
 */
export const FIELD_PACK_TEMPLATES: Record<1 | 2 | 3 | 4, FieldMonsterPackTemplate[]> = {
  1: [
    {
      id: 'field_r1_raiders',
      ring: 1,
      zone: 'mid_field',
      label: '들판 고블린 약탈조',
      guaranteedElite: false,
      eliteTier: 'weakened',
      units: [
        {
          type: 'goblin',
          role: 'melee',
          name: '👺 들판 고블린',
          count: 2,
          hp: 155,
          attack: 22,
          speed: 72,
          expReward: 22,
          eliteChance: 0.35,
        },
        {
          type: 'zombie',
          role: 'melee',
          name: '🧟 떠돌이 좀비',
          count: 1,
          hp: 165,
          attack: 19,
          speed: 60,
          expReward: 20,
          eliteChance: 0,
        },
      ],
    },
    {
      id: 'field_r1_ambush',
      ring: 1,
      zone: 'near_camp',
      label: '부락 외곽 정예 매복조',
      guaranteedElite: true,
      eliteTier: 'empowered',
      units: [
        {
          type: 'goblin',
          role: 'melee',
          name: '고블린 돌격대장',
          count: 1,
          hp: 210,
          attack: 26,
          speed: 76,
          expReward: 34,
        },
        {
          type: 'goblin',
          role: 'melee',
          name: '👺 부락 정찰 고블린',
          count: 2,
          hp: 155,
          attack: 22,
          speed: 72,
          expReward: 22,
          eliteChance: 0,
        },
        {
          type: 'skeleton',
          role: 'ranged',
          name: '🏹 들판 해골사수',
          count: 1,
          hp: 135,
          attack: 23,
          speed: 64,
          expReward: 24,
          eliteChance: 0,
        },
      ],
    },
  ],
  2: [
    {
      id: 'field_r2_patrol',
      ring: 2,
      zone: 'mid_field',
      label: '흑철 순찰대',
      guaranteedElite: true,
      eliteTier: 'standard',
      units: [
        {
          type: 'lancer',
          role: 'lancer',
          name: '🔱 야생 흑철 창병',
          count: 3,
          hp: 380,
          attack: 42,
          speed: 85,
          expReward: 42,
          eliteChance: 0.35,
        },
        {
          type: 'skeleton',
          role: 'ranged',
          name: '🏹 숲의 망령궁수',
          count: 2,
          hp: 280,
          attack: 38,
          speed: 68,
          expReward: 36,
        },
      ],
    },
    {
      id: 'field_r2_vanguard',
      ring: 2,
      zone: 'near_camp',
      label: '황야 마물 무리',
      guaranteedElite: true,
      eliteTier: 'empowered',
      units: [
        {
          type: 'lizardman',
          role: 'melee',
          name: '🦎 황야 리자드맨',
          count: 3,
          hp: 360,
          attack: 40,
          speed: 78,
          expReward: 40,
          eliteChance: 0.5,
        },
        {
          type: 'lancer',
          role: 'lancer',
          name: '🔱 황야 돌격창병',
          count: 2,
          hp: 390,
          attack: 44,
          speed: 85,
          expReward: 44,
        },
      ],
    },
  ],
  3: [
    {
      id: 'field_r3_coven',
      ring: 3,
      zone: 'near_camp',
      label: '암흑 주술사 호위대',
      guaranteedElite: true,
      eliteTier: 'empowered',
      units: [
        {
          type: 'lancer',
          role: 'lancer',
          name: '🔱 성소 호위 창기병',
          count: 3,
          hp: 680,
          attack: 62,
          speed: 88,
          expReward: 65,
          eliteChance: 0.45,
        },
        {
          type: 'archmage',
          role: 'mage',
          name: '🔮 방랑 흑마법사',
          count: 2,
          hp: 560,
          attack: 70,
          speed: 62,
          expReward: 78,
        },
        {
          type: 'skeleton',
          role: 'ranged',
          name: '🏹 암흑 추적사수',
          count: 2,
          hp: 490,
          attack: 56,
          speed: 70,
          expReward: 58,
        },
      ],
    },
  ],
  4: [
    {
      id: 'field_r4_abyss_champions',
      ring: 4,
      zone: 'near_camp',
      label: '심연 외곽 정예 사냥대',
      guaranteedElite: true,
      eliteTier: 'empowered',
      units: [
        {
          type: 'goblin',
          role: 'melee',
          name: '🗡️ 심연 약탈 군주',
          count: 3,
          hp: 1120,
          attack: 88,
          speed: 84,
          expReward: 95,
          eliteChance: 0.6,
        },
        {
          type: 'lancer',
          role: 'lancer',
          name: '🔱 폭풍 암흑 창기병',
          count: 3,
          hp: 1080,
          attack: 94,
          speed: 94,
          expReward: 100,
          eliteChance: 0.45,
        },
        {
          type: 'archmage',
          role: 'mage',
          name: '🔮 심연의 황야술사',
          count: 2,
          hp: 880,
          attack: 98,
          speed: 65,
          expReward: 115,
        },
      ],
    },
  ],
};
