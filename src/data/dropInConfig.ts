import { RoomDifficultyId, RoomSessionStatus } from '../types/room';

/**
 * 실시간 공개 협동 방 브라우저 및 중도 참여(Drop-in) 정책 설정
 */
export const DROP_IN_POLICY_CONFIG = {
  /** 공용 방 디렉토리 Supabase Realtime 채널명 */
  publicDirectoryChannelName: 'tiny_isles_public_rooms_v1',
  /** 호스트가 공용 디렉토리 Presence 상태를 갱신하는 주기 (ms) */
  directoryBroadcastIntervalMs: 4000,
  /** 초대 코드 직접 합류 시 로비/인게임 채널 탐색 타임아웃 (ms) */
  roomProbeTimeoutMs: 2600,
  /** 종반부 신규 난입 자동 잠금 목표 진행률 임계치 (0.65 = 65% 이상 진행 시 신규 난입 차단) */
  lateGameLockoutProgressRatio: 0.65,
  /** 종반부 신규 난입 자동 잠금 남은 제한시간 임계치 (초) - 8분 미만 남았을 때 잠금 */
  lateGameLockoutRemainingSec: 8 * 60,
  /** 클리어 보상(별의 파편) 및 칭호 획득을 위한 최소 활동 점수 (잠수/무임승차 방지) */
  minContributionScoreForReward: 40,
  /** 최소 활동 자격 충족 시 보장되는 기본 보상 비율 하한선 (35%) */
  minActiveRewardRatio: 0.35,
  /** 처음부터 참여하거나 중도 합류자와 함께 완주한 선구자 보너스 배율 (+15%) */
  pioneerCompletionBonusRatio: 0.15,
  /** 선구자 보너스를 받기 위한 최소 참여 시간 비율 (75% 이상 참여) */
  pioneerTimeRatioThreshold: 0.75,
  /** 중도 난입 직후 몬스터 스탯/마릿수 스케일링 유예 시간 (ms) - 45초 */
  scalingGracePeriodMs: 45_000,
  /** 원격 플레이어가 잠수(AFK)로 판정되어 유효 전투 인원 스케일링에서 제외되는 무활동 시간 (ms) - 75초 */
  afkTimeoutMs: 75_000,
  /** 활동 점수 가중치 */
  scoreWeights: {
    /** 몬스터/부락 타격 데미지 20당 1점 */
    damageDivisor: 20,
    /** 몬스터 처치 1마리당 점수 */
    monsterKillPoints: 12,
    /** 보스/부락 코어 파괴 기여 보너스 */
    objectiveBonusPoints: 45,
    /** 자원 채집 1회당 점수 */
    gatherActionPoints: 5,
    /** 건물 건설/수리/영지 해금 1회당 점수 */
    buildOrUnlockPoints: 25,
  },
  /** 중도 합류자(Drop-in) 경과 시간 대비 초기 보정(Catch-up) 설정 */
  catchUpConfig: {
    /** 보정이 발동되는 최소 방 경과 시간 (초) - 60초 이후 합류 시부터 적용 */
    minElapsedSecForCatchUp: 60,
    /** 경과 1분당 추가 보급 목재 */
    woodPerMinute: 12,
    /** 경과 1분당 추가 보급 석재 */
    stonePerMinute: 9,
    /** 경과 1분당 추가 보급 금화 */
    goldPerMinute: 14,
    /** 사냥 모드: 경과 1분당 초기 지원 경험치(EXP) */
    huntingExpPerMinute: 85,
    /** 중도 보급 상한 시간 (분) - 최대 25분치까지 비례 지급 */
    maxCatchUpMinutes: 25,
  },
} as const;

export type DropInLockReason =
  | 'open'
  | 'room_full'
  | 'late_game_progress'
  | 'late_game_time'
  | 'host_locked'
  | 'ended';

export interface PublicRoomListing {
  roomId: string;
  inviteCode: string;
  hostPlayerId: string;
  hostName: string;
  missionId: string;
  missionTitle: string;
  difficulty: RoomDifficultyId;
  status: Extract<RoomSessionStatus, 'waiting' | 'playing'>;
  currentPlayers: number;
  maxPlayers: number;
  currentCount: number;
  targetCount: number;
  elapsedSec: number;
  timeLimitSec: number | null;
  allowDropIn: boolean;
  lockReason: DropInLockReason;
  hostAppVersion?: string;
  updatedAt: number;
}
