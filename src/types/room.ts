import { PlayerColor } from './game';

export type RoomMode = 'solo' | 'coop';

export type RoomDifficultyId = 'normal' | 'hard' | 'nightmare';

export type MissionGoalType =
  | 'boss_slay'
  | 'territory_unlock'
  | 'survive_waves';

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
}

export interface RoomMember {
  playerId: string;
  name: string;
  color: PlayerColor;
  isHost: boolean;
  joinedAt: number;
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

export type TraitId =
  | 'starter_supplies'
  | 'gatherer_blessing'
  | 'guardian_might'
  | 'citadel_fortification';

export interface TraitDefinition {
  id: TraitId;
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costStep: number;
  effectPerLevelLabel: string;
}

export interface CosmeticTitleDefinition {
  id: string;
  label: string;
  description: string;
  costPoints: number;
}

export interface MetaProgressionState {
  points: number;
  totalClears: number;
  traitLevels: Record<TraitId, number>;
  unlockedTitleIds: string[];
  equippedTitleId: string | null;
  clearedMissionIds: string[];
}

export interface MetaBonusSummary {
  bonusWood: number;
  bonusStone: number;
  bonusGold: number;
  gatherDamageBonus: number;
  combatDamageBonus: number;
  coreHpBonusRatio: number;
}
