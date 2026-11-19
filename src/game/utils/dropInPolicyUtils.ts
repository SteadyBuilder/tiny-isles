import { DROP_IN_POLICY_CONFIG, DropInLockReason } from '../../data/dropInConfig';
import { MissionContributionSummary, RoomMode } from '../../types/room';

export interface LateGameLockoutEvaluationInput {
  currentPlayers: number;
  maxPlayers: number;
  currentCount: number;
  targetCount: number;
  elapsedSec: number;
  timeLimitSec: number | null;
  allowDropIn: boolean;
  ended?: boolean;
}

/**
 * 현재 방 진행 상태에 따른 중도 난입(Drop-in) 허용 여부 및 잠금 사유 평가 순수 함수
 */
export function evaluateDropInLockReason(
  input: LateGameLockoutEvaluationInput
): DropInLockReason {
  if (input.ended) return 'ended';
  if (input.currentPlayers >= input.maxPlayers) return 'room_full';
  if (!input.allowDropIn) return 'host_locked';

  const safeTarget = Math.max(1, input.targetCount);
  const progressRatio = Math.max(0, input.currentCount) / safeTarget;
  if (progressRatio >= DROP_IN_POLICY_CONFIG.lateGameLockoutProgressRatio) {
    return 'late_game_progress';
  }

  if (input.timeLimitSec !== null && input.timeLimitSec > 0) {
    const remainingSec = Math.max(0, input.timeLimitSec - Math.max(0, input.elapsedSec));
    if (remainingSec < DROP_IN_POLICY_CONFIG.lateGameLockoutRemainingSec) {
      return 'late_game_time';
    }
  }

  return 'open';
}

export function getDropInLockReasonLabel(reason: DropInLockReason): string {
  switch (reason) {
    case 'open':
      return '중도 합류 가능';
    case 'room_full':
      return '정원 초과 (4/4)';
    case 'late_game_progress':
      return '종반부 진입 (65%+ 진행 잠금)';
    case 'late_game_time':
      return '종반부 진입 (마감 임박 잠금)';
    case 'host_locked':
      return '방장 난입 잠금';
    case 'ended':
      return '종료된 원정';
  }
}

export interface RewardCalculationInput {
  mode: RoomMode;
  victory: boolean;
  baseRewardPoints: number;
  difficultyRewardMultiplier: number;
  totalElapsedSec: number;
  participatedSec: number;
  contributionScore: number;
  isDropIn: boolean;
  hadCoopPeers: boolean;
}

export interface RewardCalculationResult {
  earnedPoints: number;
  canUnlockTitle: boolean;
  summary: MissionContributionSummary;
}

/**
 * 참여 시간 비율 & 실질 활동 점수(전투/채집/건설) 기반 별의 파편 클리어 보상 계산 순수 함수
 * - 솔로 모드는 항상 100% 지급
 * - 협동(coop) 모드에서는 최소 활동 점수(minContributionScoreForReward) 미달 시 잠수/무임승차로 간주하여 0P 처리
 * - 중도 참여자는 참여 시간 비율(하한선 35% ~ 100%)에 비례하여 지급
 * - 처음부터(75% 이상 시간) 함께하여 협동 클리어한 파티원에게는 선구자 완주 보너스(+15%) 부여
 */
export function calculateContributionScaledReward(
  input: RewardCalculationInput
): RewardCalculationResult {
  const baseFullPoints = input.victory
    ? Math.round(input.baseRewardPoints * input.difficultyRewardMultiplier)
    : Math.round(input.baseRewardPoints * 0.2);

  const safeTotalSec = Math.max(1, Math.floor(input.totalElapsedSec));
  const safeParticipatedSec = Math.max(
    0,
    Math.min(safeTotalSec, Math.floor(input.participatedSec))
  );
  const participationRatio = Math.max(0, Math.min(1, safeParticipatedSec / safeTotalSec));
  const score = Math.max(0, Math.floor(input.contributionScore));

  if (input.mode === 'solo') {
    return {
      earnedPoints: baseFullPoints,
      canUnlockTitle: input.victory,
      summary: {
        participatedSec: safeTotalSec,
        participationRatio: 1,
        contributionScore: Math.max(score, DROP_IN_POLICY_CONFIG.minContributionScoreForReward),
        isQualified: true,
        baseFullPoints,
        appliedMultiplier: 1,
        hasPioneerBonus: false,
        isDropIn: false,
      },
    };
  }

  // 극초반(45초 미만) 빠른 종료 시에는 참여 시간 비례로 최소 기준 완화
  const effectiveMinScore =
    safeParticipatedSec < 45
      ? Math.max(10, Math.round(DROP_IN_POLICY_CONFIG.minContributionScoreForReward * 0.4))
      : DROP_IN_POLICY_CONFIG.minContributionScoreForReward;

  const isQualified = score >= effectiveMinScore;
  if (!isQualified) {
    return {
      earnedPoints: 0,
      canUnlockTitle: false,
      summary: {
        participatedSec: safeParticipatedSec,
        participationRatio,
        contributionScore: score,
        isQualified: false,
        baseFullPoints,
        appliedMultiplier: 0,
        hasPioneerBonus: false,
        isDropIn: input.isDropIn,
      },
    };
  }

  // 중도 난입이 아닌 초기 멤버이거나 90% 이상 함께한 경우 기본 비율 1.0 보장
  const baseTimeRatio =
    !input.isDropIn || participationRatio >= 0.9
      ? 1.0
      : Math.max(
          DROP_IN_POLICY_CONFIG.minActiveRewardRatio,
          Math.min(1.0, participationRatio * 1.1)
        );

  const hasPioneerBonus =
    input.victory &&
    input.hadCoopPeers &&
    !input.isDropIn &&
    participationRatio >= DROP_IN_POLICY_CONFIG.pioneerTimeRatioThreshold;

  const appliedMultiplier = Number(
    (
      baseTimeRatio *
      (hasPioneerBonus ? 1 + DROP_IN_POLICY_CONFIG.pioneerCompletionBonusRatio : 1)
    ).toFixed(2)
  );

  const earnedPoints = Math.max(1, Math.round(baseFullPoints * appliedMultiplier));
  const canUnlockTitle = input.victory && isQualified && baseTimeRatio >= 0.5;

  return {
    earnedPoints,
    canUnlockTitle,
    summary: {
      participatedSec: safeParticipatedSec,
      participationRatio,
      contributionScore: score,
      isQualified: true,
      baseFullPoints,
      appliedMultiplier,
      hasPioneerBonus,
      isDropIn: input.isDropIn,
    },
  };
}

export interface CatchUpSupportPackage {
  shouldApply: boolean;
  elapsedMinutes: number;
  bonusWood: number;
  bonusStone: number;
  bonusGold: number;
  bonusExp: number;
}

/**
 * 중도 참여자(Drop-in)가 이미 진행된 방에 합류했을 때 경과 시간에 비례해 지급하는 초기 보급/성장 패키지 계산 순수 함수
 */
export function calculateDropInCatchUpSupport(
  roomElapsedSec: number,
  isHuntingMode: boolean
): CatchUpSupportPackage {
  const cfg = DROP_IN_POLICY_CONFIG.catchUpConfig;
  if (roomElapsedSec < cfg.minElapsedSecForCatchUp) {
    return {
      shouldApply: false,
      elapsedMinutes: 0,
      bonusWood: 0,
      bonusStone: 0,
      bonusGold: 0,
      bonusExp: 0,
    };
  }

  const rawMinutes = roomElapsedSec / 60;
  const clampedMinutes = Math.min(cfg.maxCatchUpMinutes, Math.max(1, Math.floor(rawMinutes)));

  return {
    shouldApply: true,
    elapsedMinutes: clampedMinutes,
    bonusWood: Math.round(clampedMinutes * cfg.woodPerMinute),
    bonusStone: Math.round(clampedMinutes * cfg.stonePerMinute),
    bonusGold: Math.round(clampedMinutes * cfg.goldPerMinute),
    bonusExp: isHuntingMode ? Math.round(clampedMinutes * cfg.huntingExpPerMinute) : 0,
  };
}

export interface PeerScalingInput {
  playerId: string;
  joinedAtMs: number;
  lastActiveAtMs: number;
  isLocalHost?: boolean;
}

/**
 * 난입 유예 시간(45초) 및 잠수(AFK 75초 무활동) 필터링을 적용한 '유효 전투 인원(effectiveOnlineCount)' 계산 순수 함수
 */
export function computeEffectiveCombatPlayerCount(
  peers: ReadonlyArray<PeerScalingInput>,
  nowMs: number
): {
  effectiveCount: number;
  graceCount: number;
  afkCount: number;
} {
  if (peers.length <= 1) {
    return { effectiveCount: 1, graceCount: 0, afkCount: 0 };
  }

  let effectiveCount = 0;
  let graceCount = 0;
  let afkCount = 0;

  for (const peer of peers) {
    if (peer.isLocalHost) {
      effectiveCount += 1;
      continue;
    }

    const timeSinceJoin = Math.max(0, nowMs - peer.joinedAtMs);
    const timeSinceActive = Math.max(0, nowMs - peer.lastActiveAtMs);

    if (timeSinceJoin < DROP_IN_POLICY_CONFIG.scalingGracePeriodMs) {
      graceCount += 1;
      continue;
    }

    if (timeSinceActive > DROP_IN_POLICY_CONFIG.afkTimeoutMs) {
      afkCount += 1;
      continue;
    }

    effectiveCount += 1;
  }

  return {
    effectiveCount: Math.max(1, effectiveCount),
    graceCount,
    afkCount,
  };
}
