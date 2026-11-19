import { PlayerColor } from './game';

export type RoomMode = 'solo' | 'coop';

export type RoomDifficultyId = 'normal' | 'hard' | 'nightmare';

export type MissionGoalType =
  | 'boss_slay'
  | 'territory_unlock'
  | 'survive_waves'
  | 'camp_conquest';

export interface MissionGoalSpec {
  type: MissionGoalType;
  targetCount: number;
  /** territory_unlock 목표 시 요구되는 최소 마을 티어 (선택) */
  requiredMinTier?: number;
  label: string;
}

export interface MissionDefinition {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  estimatedMinutes: string;
  /** 제한 시간(초). null이면 시간 제한 없음 */
  timeLimitSec: number | null;
  goal: MissionGoalSpec;
  /** 기본 클리어 보상(별의 파편 / 메타 포인트) */
  baseRewardPoints: number;
  /** 클리어 시 해금되는 칭호 ID (선택) */
  rewardTitleId?: string;
  /** 사냥/던전 디펜스 특화 모드 여부 (단일 마을 수호 + 20개 몬스터 부락 + 전직/인벤토리/100마리 던전 침공) */
  isHuntingMode?: boolean;
}

export interface MissionDifficultyConfig {
  id: RoomDifficultyId;
  label: string;
  description: string;
  threatGainMultiplier: number;
  monsterHpMultiplier: number;
  monsterAttackMultiplier: number;
  rewardMultiplier: number;
  unlockCostDiscount: number;
}

export interface RoomConfig {
  roomId: string;
  mode: RoomMode;
  missionId: string;
  difficulty: RoomDifficultyId;
  maxPlayers: number;
  hostPlayerId: string;
  inviteCode?: string;
  hostAppVersion?: string;
  /** 중도 참여(Drop-in)로 이미 진행 중인 방에 입장했는지 여부 */
  isDropInJoin?: boolean;
  /** 호스트가 중도 난입을 허용하는지 여부 (기본 true) */
  allowDropIn?: boolean;
}

export interface RoomMember {
  playerId: string;
  name: string;
  color: PlayerColor;
  isHost: boolean;
  joinedAt: number;
  isBackground?: boolean;
  claimedEpoch?: number;
  appVersion?: string;
}

export type RoomSessionStatus = 'lobby' | 'waiting' | 'playing' | 'paused' | 'ended';

export interface MissionProgressState {
  missionId: string;
  title: string;
  goalLabel: string;
  currentCount: number;
  targetCount: number;
  elapsedSec: number;
  timeLimitSec: number | null;
  completed: boolean;
  failed: boolean;
}

export interface MissionContributionSummary {
  /** 로컬 플레이어가 실제 방에 머무른 시간 (초) */
  participatedSec: number;
  /** 방 전체 경과 시간 대비 참여 시간 비율 (0~1) */
  participationRatio: number;
  /** 전투/채집/건설 누적 기여도 점수 */
  contributionScore: number;
  /** 최소 활동 자격(잠수 방지) 통과 여부 */
  isQualified: boolean;
  /** 기본 만점 보상 (100% 기준) */
  baseFullPoints: number;
  /** 최종 지급 배율 (0 ~ 1.15) */
  appliedMultiplier: number;
  /** 선구자 완주 보너스 적용 여부 */
  hasPioneerBonus: boolean;
  /** 중도 참여자 여부 */
  isDropIn: boolean;
}

export interface MissionResultPayload {
  victory: boolean;
  missionId: string;
  missionTitle: string;
  difficulty: RoomDifficultyId;
  elapsedSec: number;
  earnedPoints: number;
  unlockedTitleId?: string;
  reason?: string;
  contribution?: MissionContributionSummary;
}

export type {
  DropInLockReason,
  PublicRoomListing,
} from '../data/dropInConfig';

export type {
  AuraDefinition,
  AuraEffectId,
  CosmeticTitleDefinition,
  CostumeColorKey,
  CostumeDefinition,
  CostumeId,
  MetaBonusSummary,
  MetaProgressionState,
  ModeAdvantageTag,
  TraitDefinition,
  TraitId,
  UpgradeCategory,
} from './metaProgression';

