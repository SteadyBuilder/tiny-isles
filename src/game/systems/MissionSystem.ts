import { getDifficultyConfig, getMissionById } from '../../data/missions';
import { Island, WaveState } from '../../types/game';
import {
  MissionDefinition,
  MissionDifficultyConfig,
  MissionProgressState,
  MissionResultPayload,
  RoomConfig,
} from '../../types/room';
import { GameEvents } from '../events/gameEvents';

/**
 * 인스턴스 룸 미션 목표 진행도 추적 및 승리/패배 판정 시스템
 */
export class MissionSystem {
  private roomConfig: RoomConfig;
  private mission: MissionDefinition;
  private difficulty: MissionDifficultyConfig;
  private elapsedMs = 0;
  private lastEmittedSec = -1;
  private ended = false;
  private currentCount = 0;
  private campConqueredCount = 0;

  constructor(roomConfig: RoomConfig) {
    this.roomConfig = roomConfig;
    this.mission = getMissionById(roomConfig.missionId);
    this.difficulty = getDifficultyConfig(roomConfig.difficulty);
  }

  public isHuntingMode(): boolean {
    return Boolean(this.mission.isHuntingMode);
  }

  public setCampConqueredCount(count: number): void {
    this.campConqueredCount = count;
  }

  public getMission(): MissionDefinition {
    return this.mission;
  }

  public getDifficulty(): MissionDifficultyConfig {
    return this.difficulty;
  }

  public isEnded(): boolean {
    return this.ended;
  }

  public getProgressState(): MissionProgressState {
    return {
      missionId: this.mission.id,
      title: this.mission.title,
      goalLabel: this.mission.goal.label,
      currentCount: this.currentCount,
      targetCount: this.mission.goal.targetCount,
      elapsedSec: Math.floor(this.elapsedMs / 1000),
      timeLimitSec: this.mission.timeLimitSec,
      completed: this.ended && this.currentCount >= this.mission.goal.targetCount,
      failed: this.ended && this.currentCount < this.mission.goal.targetCount,
    };
  }

  public update(deltaMs: number, waveState: WaveState, islands: Island[]): void {
    if (this.ended) return;

    this.elapsedMs += deltaMs;
    const elapsedSec = Math.floor(this.elapsedMs / 1000);

    const nextCount = this.evaluateGoalCount(waveState, islands);
    const countChanged = nextCount !== this.currentCount;
    this.currentCount = nextCount;

    if (this.currentCount >= this.mission.goal.targetCount) {
      this.finishMission(true);
      return;
    }

    if (this.mission.timeLimitSec !== null && elapsedSec >= this.mission.timeLimitSec) {
      this.finishMission(false, '제한 시간이 초과되었습니다.');
      return;
    }

    if (countChanged || elapsedSec !== this.lastEmittedSec) {
      this.lastEmittedSec = elapsedSec;
      GameEvents.emit('mission-progress-updated', this.getProgressState());
    }
  }

  public failByCoreDestroyed(): void {
    if (this.ended) return;
    this.finishMission(false, '중심 마을 본진이 파괴되었습니다.');
  }

  private evaluateGoalCount(waveState: WaveState, islands: Island[]): number {
    const goal = this.mission.goal;
    switch (goal.type) {
      case 'boss_slay': {
        const activeBossAlive = waveState.activeBoss !== null;
        const completedBosses = activeBossAlive
          ? Math.max(0, waveState.bossWaveCount - 1)
          : waveState.bossWaveCount;
        return Math.min(goal.targetCount, completedBosses);
      }
      case 'territory_unlock': {
        const minTier = goal.requiredMinTier ?? 1;
        const qualified = islands.filter(
          (isl) => isl.unlocked && isl.villageTier >= minTier
        ).length;
        return Math.min(goal.targetCount, qualified);
      }
      case 'survive_waves': {
        const completedWaves =
          waveState.activeMonstersCount > 0
            ? Math.max(0, waveState.waveCount - 1)
            : waveState.waveCount;
        return Math.min(goal.targetCount, completedWaves);
      }
      case 'camp_conquest': {
        return Math.min(goal.targetCount, this.campConqueredCount);
      }
      default:
        return 0;
    }
  }

  private finishMission(victory: boolean, reason?: string): void {
    if (this.ended) return;
    this.ended = true;

    GameEvents.emit('mission-progress-updated', this.getProgressState());

    const earnedPoints = victory
      ? Math.round(this.mission.baseRewardPoints * this.difficulty.rewardMultiplier)
      : Math.round(this.mission.baseRewardPoints * 0.2);

    const payload: MissionResultPayload = {
      victory,
      missionId: this.mission.id,
      missionTitle: this.mission.title,
      difficulty: this.roomConfig.difficulty,
      elapsedSec: Math.floor(this.elapsedMs / 1000),
      earnedPoints,
      unlockedTitleId: victory ? this.mission.rewardTitleId : undefined,
      reason,
    };

    GameEvents.emit('mission-ended', payload);
  }
}
