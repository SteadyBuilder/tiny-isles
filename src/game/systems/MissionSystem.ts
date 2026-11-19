import { getDifficultyConfig, getMissionById } from '../../data/missions';
import { Island, WaveState } from '../../types/game';
import { MissionProgressSyncPayload } from '../../types/monsterSync';
import {
  MissionDefinition,
  MissionDifficultyConfig,
  MissionProgressState,
  MissionResultPayload,
  RoomConfig,
} from '../../types/room';
import { GameEvents } from '../events/gameEvents';

export interface MissionSystemOptions {
  isHost?: () => boolean;
  onBroadcastProgress?: (payload: Omit<MissionProgressSyncPayload, 'hostEpoch'>) => void;
}

/**
 * 인스턴스 룸 미션 목표 진행도 추적 및 승리/패배 판정 시스템
 * - 협동 모드에서는 방장(Host)이 타이머(elapsedSec), 목표 달성 수(currentCount), 승패 판정을 권위 있게 동기화합니다.
 */
export class MissionSystem {
  private roomConfig: RoomConfig;
  private mission: MissionDefinition;
  private difficulty: MissionDifficultyConfig;
  private opts?: MissionSystemOptions;
  private elapsedMs = 0;
  private lastEmittedSec = -1;
  private lastBroadcastSec = -1;
  private lastBroadcastCount = -1;
  private ended = false;
  private currentCount = 0;
  private campConqueredCount = 0;

  constructor(roomConfig: RoomConfig, opts?: MissionSystemOptions) {
    this.roomConfig = roomConfig;
    this.mission = getMissionById(roomConfig.missionId);
    this.difficulty = getDifficultyConfig(roomConfig.difficulty);
    this.opts = opts;
  }

  public setOptions(opts: MissionSystemOptions): void {
    this.opts = opts;
  }

  private getIsHost(): boolean {
    if (this.roomConfig.mode !== 'coop') return true;
    return this.opts?.isHost ? this.opts.isHost() : true;
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

  public getSyncSnapshot(): Omit<MissionProgressSyncPayload, 'hostEpoch'> {
    return {
      elapsedSec: Math.floor(this.elapsedMs / 1000),
      currentCount: this.currentCount,
      targetCount: this.mission.goal.targetCount,
      completed: this.ended && this.currentCount >= this.mission.goal.targetCount,
      failed: this.ended && this.currentCount < this.mission.goal.targetCount,
    };
  }

  public applyRemoteSync(payload: MissionProgressSyncPayload): void {
    if (this.ended || this.getIsHost()) return;

    const remoteElapsedSec = Math.max(0, Math.floor(payload.elapsedSec ?? 0));
    const localElapsedSec = Math.floor(this.elapsedMs / 1000);
    // 방장 타이머와 1초 이상 벌어졌거나 역행했을 때 즉시 방장 시각으로 보정
    if (Math.abs(remoteElapsedSec - localElapsedSec) >= 1) {
      this.elapsedMs = remoteElapsedSec * 1000;
    }

    const remoteCount = Math.max(
      0,
      Math.min(this.mission.goal.targetCount, Math.floor(payload.currentCount ?? 0))
    );
    const countChanged = remoteCount !== this.currentCount;
    this.currentCount = remoteCount;

    if (payload.completed) {
      this.currentCount = this.mission.goal.targetCount;
      this.finishMission(true, payload.reason, false);
      return;
    }

    if (payload.failed) {
      this.finishMission(false, payload.reason || '제한 시간이 초과되었습니다.', false);
      return;
    }

    const nextSec = Math.floor(this.elapsedMs / 1000);
    if (countChanged || nextSec !== this.lastEmittedSec) {
      this.lastEmittedSec = nextSec;
      GameEvents.emit('mission-progress-updated', this.getProgressState());
    }
  }

  public update(deltaMs: number, waveState: WaveState, islands: Island[]): void {
    if (this.ended) return;

    this.elapsedMs += deltaMs;
    const elapsedSec = Math.floor(this.elapsedMs / 1000);
    const isHost = this.getIsHost();

    if (!isHost) {
      // 게스트는 방장 동기화 사이(1~2초)를 부드럽게 메우는 로컬 초시계 표시만 수행하고, 승패 종료 판정은 방장 권위 패킷을 따름
      if (elapsedSec !== this.lastEmittedSec) {
        this.lastEmittedSec = elapsedSec;
        GameEvents.emit('mission-progress-updated', this.getProgressState());
      }
      return;
    }

    const nextCount = this.evaluateGoalCount(waveState, islands);
    const countChanged = nextCount !== this.currentCount;
    this.currentCount = nextCount;

    if (this.currentCount >= this.mission.goal.targetCount) {
      this.finishMission(true, undefined, true);
      return;
    }

    if (this.mission.timeLimitSec !== null && elapsedSec >= this.mission.timeLimitSec) {
      this.finishMission(false, '제한 시간이 초과되었습니다.', true);
      return;
    }

    if (countChanged || elapsedSec !== this.lastEmittedSec) {
      this.lastEmittedSec = elapsedSec;
      GameEvents.emit('mission-progress-updated', this.getProgressState());
    }

    if (
      this.roomConfig.mode === 'coop' &&
      (countChanged ||
        this.lastBroadcastCount !== this.currentCount ||
        elapsedSec - this.lastBroadcastSec >= 2)
    ) {
      this.lastBroadcastSec = elapsedSec;
      this.lastBroadcastCount = this.currentCount;
      this.opts?.onBroadcastProgress?.(this.getSyncSnapshot());
    }
  }

  public failByCoreDestroyed(): void {
    if (this.ended) return;
    this.finishMission(false, '중심 마을 본진이 파괴되었습니다.', this.getIsHost());
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

  private finishMission(victory: boolean, reason?: string, broadcastIfCoop = true): void {
    if (this.ended) return;
    this.ended = true;

    if (broadcastIfCoop && this.roomConfig.mode === 'coop') {
      this.opts?.onBroadcastProgress?.({
        elapsedSec: Math.floor(this.elapsedMs / 1000),
        currentCount: this.currentCount,
        targetCount: this.mission.goal.targetCount,
        completed: victory,
        failed: !victory,
        reason,
      });
    }

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

