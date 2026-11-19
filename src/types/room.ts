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

export interface MissionResultPayload {
  victory: boolean;
  missionId: string;
  missionTitle: string;
  difficulty: RoomDifficultyId;
  elapsedSec: number;
  earnedPoints: number;
  unlockedTitleId?: string;
  reason?: string;
}

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
