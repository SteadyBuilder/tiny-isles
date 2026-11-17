import {
  MissionDefinition,
  MissionDifficultyConfig,
  RoomDifficultyId,
} from '../types/room';

export const INSTANCE_ROOM_DEFAULTS = {
  maxPlayers: 4,
  inviteCodeLength: 6,
  defaultMissionId: 'boss_slayer',
  defaultDifficulty: 'normal' as RoomDifficultyId,
} as const;

export const MISSION_CATALOG: MissionDefinition[] = [
  {
    id: 'hunting_conquest',
    title: '🏹 사냥 & 던전 디펜스 (NEW)',
    subtitle: '단일 본진을 수호하며 몬스터 부락을 토벌하고 전직하라!',
    description:
      '중앙 마을 1곳을 수호하며 주변 20개 몬스터 부락(근거리·창병·원거리·마법사)을 사냥해 레벨업·전직·장비 파밍을 진행합니다. 위협도 100% 시 출현하는 심연의 던전 게이트(100마리 대군 진격)를 막아내고 부락 본진 8곳을 초회 토벌하면 승리합니다!',
    estimatedMinutes: '25~40분',
    timeLimitSec: 45 * 60,
    goal: {
      type: 'camp_conquest',
      targetCount: 8,
      label: '몬스터 부락 초회 토벌',
    },
    baseRewardPoints: 180,
    rewardTitleId: 'title_boss_slayer',
    isHuntingMode: true,
  },
  {
    id: 'boss_slayer',
    title: '대군주 토벌전',
    subtitle: '보스 군단을 격파하고 섬을 해방하라',
    description:
      '빠르게 자원을 모아 방어선을 구축하고, 침공해 오는 보스 군단(3회)을 모두 토벌하면 승리합니다.',
    estimatedMinutes: '30~45분',
    timeLimitSec: 45 * 60,
    goal: {
      type: 'boss_slay',
      targetCount: 3,
      label: '보스 웨이브 격파',
    },
    baseRewardPoints: 120,
    rewardTitleId: 'title_boss_slayer',
  },
  {
    id: 'territory_expansion',
    title: '섬 개척 원정',
    subtitle: '황무지를 개척하여 5개 영지를 번영시켜라',
    description:
      '마물의 침공을 막아내며 중심 마을 포함 총 5개 영지를 해금하고 Lv.2 이상으로 발전시키세요.',
    estimatedMinutes: '35~50분',
    timeLimitSec: 50 * 60,
    goal: {
      type: 'territory_unlock',
      targetCount: 5,
      requiredMinTier: 2,
      label: 'Lv.2+ 영지 확보',
    },
    baseRewardPoints: 140,
    rewardTitleId: 'title_pioneer',
  },
  {
    id: 'sanctuary_defense',
    title: '성소 수호전',
    subtitle: '끝없는 침공 속에서 9웨이브를 버텨내라',
    description:
      '몰려오는 마물 웨이브 9회를 모두 막아내고 중심 마을 코어를 지켜내면 승리합니다.',
    estimatedMinutes: '40~60분',
    timeLimitSec: 60 * 60,
    goal: {
      type: 'survive_waves',
      targetCount: 9,
      label: '웨이브 방어 완료',
    },
    baseRewardPoints: 160,
    rewardTitleId: 'title_guardian',
  },
];

export const MISSION_DIFFICULTIES: Record<RoomDifficultyId, MissionDifficultyConfig> = {
  normal: {
    id: 'normal',
    label: '보통',
    description: '1~4인 표준 밸런스. 입문 및 협동 플레이에 적합합니다.',
    threatGainMultiplier: 1.25,
    monsterHpMultiplier: 1.0,
    monsterAttackMultiplier: 1.0,
    rewardMultiplier: 1.0,
    unlockCostDiscount: 0.75,
  },
  hard: {
    id: 'hard',
    label: '어려움',
    description: '위협도가 더 빠르게 쌓이며 마물이 강해집니다. 보상 +40%.',
    threatGainMultiplier: 1.5,
    monsterHpMultiplier: 1.35,
    monsterAttackMultiplier: 1.25,
    rewardMultiplier: 1.4,
    unlockCostDiscount: 0.85,
  },
  nightmare: {
    id: 'nightmare',
    label: '악몽',
    description: '숙련된 수호자 파티를 위한 극한 난이도. 보상 +100%.',
    threatGainMultiplier: 1.85,
    monsterHpMultiplier: 1.8,
    monsterAttackMultiplier: 1.55,
    rewardMultiplier: 2.0,
    unlockCostDiscount: 1.0,
  },
};

export function getMissionById(missionId: string): MissionDefinition {
  return (
    MISSION_CATALOG.find((m) => m.id === missionId) ?? MISSION_CATALOG[0]
  );
}

export function getDifficultyConfig(difficulty: RoomDifficultyId): MissionDifficultyConfig {
  return MISSION_DIFFICULTIES[difficulty] ?? MISSION_DIFFICULTIES.normal;
}
