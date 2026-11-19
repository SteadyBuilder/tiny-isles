import { DROP_IN_POLICY_CONFIG } from '../../data/dropInConfig';
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
import { calculateContributionScaledReward } from '../utils/dropInPolicyUtils';

export interface MissionSystemOptions {
  isHost?: () => boolean;
  getOnlineCount?: () => number;
  onBroadcastProgress?: (payload: Omit<MissionProgressSyncPayload, 'hostEpoch'>) => void;
}

/**
 * 인스턴스 룸 미션 목표 진행도 추적, 기여도 점수 누적 및 승리/패배 보상 정산 시스템
 * - 협동 모드에서는 방장(Host)이 타이머(elapsedSec), 목표 달성 수(currentCount), 승패 판정을 권위 있게 동기화합니다.
 * - 로컬 클라이언트는 실제 참여 시간(participatedMs)과 전투/채집/건설 기여 점수를 추적하여 무임승차를 방지합니다.
 */
export class MissionSystem {
  private roomConfig: RoomConfig;
  private mission: MissionDefinition;
  private difficulty: MissionDifficultyConfig;
  private opts?: MissionSystemOptions;
  private elapsedMs = 0;
  private participatedMs = 0;
  private contributionScore = 0;
  private isDropInSession = false;
  private hadCoopPeers = false;
  private hasSyncedInitialElapsed = false;
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
    this.isDropInSession = Boolean(roomConfig.isDropInJoin);
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

  public recordDamageContribution(damage: number): void {
    if (this.ended || damage <= 0) return;
    const gain = Math.max(
      1,
      Math.round(damage / DROP_IN_POLICY_CONFIG.scoreWeights.damageDivisor)
    );
    this.contributionScore += gain;
  }

  public recordMonsterKillContribution(isBossOrObjective = false): void {
    if (this.ended) return;
    this.contributionScore += isBossOrObjective
      ? DROP_IN_POLICY_CONFIG.scoreWeights.objectiveBonusPoints
      : DROP_IN_POLICY_CONFIG.scoreWeights.monsterKillPoints;
  }

  public recordGatherContribution(): void {
    if (this.ended) return;
    this.contributionScore += DROP_IN_POLICY_CONFIG.scoreWeights.gatherActionPoints;
  }

  public recordBuildOrUnlockContribution(): void {
    if (this.ended) return;
    this.contributionScore += DROP_IN_POLICY_CONFIG.scoreWeights.buildOrUnlockPoints;
  }

  public getContributionScore(): number {
    return this.contributionScore;
  }

  public getParticipatedSec(): number {
    return Math.floor(this.participatedMs / 1000);
  }

  public isDropIn(): boolean {
    return this.isDropInSession;
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

    // 게스트 첫 동기화 시점에 방 경과 시간이 이미 30초 이상이면 중도 참여(Drop-in)로 자동 감지
    if (!this.hasSyncedInitialElapsed) {
      this.hasSyncedInitialElapsed = true;
      if (remoteElapsedSec >= 30 && this.participatedMs < 15_000) {
        this.isDropInSession = true;
      }
    }

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
    this.participatedMs += deltaMs;
    if ((this.opts?.getOnlineCount?.() ?? 1) > 1) {
      this.hadCoopPeers = true;
    }

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

    const totalElapsedSec = Math.floor(this.elapsedMs / 1000);
    const participatedSec = Math.floor(this.participatedMs / 1000);

    if (broadcastIfCoop && this.roomConfig.mode === 'coop') {
      this.opts?.onBroadcastProgress?.({
        elapsedSec: totalElapsedSec,
        currentCount: this.currentCount,
        targetCount: this.mission.goal.targetCount,
        completed: victory,
        failed: !victory,
        reason,
      });
    }

    GameEvents.emit('mission-progress-updated', this.getProgressState());

    const rewardCalc = calculateContributionScaledReward({
      mode: this.roomConfig.mode,
      victory,
      baseRewardPoints: this.mission.baseRewardPoints,
      difficultyRewardMultiplier: this.difficulty.rewardMultiplier,
      totalElapsedSec,
      participatedSec,
      contributionScore: this.contributionScore,
      isDropIn: this.isDropInSession,
      hadCoopPeers: this.hadCoopPeers,
    });

    const payload: MissionResultPayload = {
      victory,
      missionId: this.mission.id,
      missionTitle: this.mission.title,
      difficulty: this.roomConfig.difficulty,
      elapsedSec: totalElapsedSec,
      earnedPoints: rewardCalc.earnedPoints,
      unlockedTitleId: rewardCalc.canUnlockTitle ? this.mission.rewardTitleId : undefined,
      reason,
      contribution: rewardCalc.summary,
    };

    GameEvents.emit('mission-ended', payload);
  }
}


