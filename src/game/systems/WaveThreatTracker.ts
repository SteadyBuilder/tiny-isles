import { THREAT_WAVE_CONFIG } from '../../data/worldRules';
import type { WaveState } from '../../types/game';
import type { ThreatSyncPayload } from '../../types/monsterSync';

export function computeWavesUntilBoss(waveCount: number): number {
  const mod = waveCount % THREAT_WAVE_CONFIG.bossEveryNWaves;
  return THREAT_WAVE_CONFIG.bossEveryNWaves - mod;
}

export interface WaveThreatCallbacks {
  isHost: () => boolean;
  onWarningReached?: (message: string, fromRemoteSync: boolean) => void;
  onCountdownStarted?: (message: string, countdownSec: number, isBossWave: boolean) => void;
  onWaveTriggered?: (isBossWave: boolean, isEarlySummon: boolean, bonusMultiplier: number) => void;
  onBroadcastThreatAdded?: (amount: number) => void;
  onBroadcastThreatSync?: (payload: ThreatSyncPayload) => void;
  onBroadcastSummonRequest?: (isBossWave: boolean, isEarlySummon: boolean) => void;
  onStateChanged?: () => void;
}

const WARNING_MSG = '⚠️ 마물 위협도가 80%에 도달했습니다! 곧 마물 대군이 몰려옵니다!';
const countdownMsg = (sec: number, isBoss: boolean): string =>
  `⏳ 마물 위협도 100%! ${sec}초 후 ${isBoss ? '보스 군단' : '마물 웨이브'}이 침공합니다!`;

export class WaveThreatTracker {
  private threatPercent = 0;
  private waveCount = 0;
  private bossWaveCount = 0;
  private wavesUntilBoss: number = THREAT_WAVE_CONFIG.bossEveryNWaves;
  private countdownRemainingMs: number | null = null;
  private countdownSecondsRemaining: number | null = null;
  private nextWaveIsBoss = false;
  private warningIssuedForCurrentCycle = false;
  private activeBonusMultiplier = 1.0;

  constructor(private readonly callbacks: WaveThreatCallbacks) {}

  public getSyncPayload(): ThreatSyncPayload {
    return {
      threatPercent: this.threatPercent,
      waveCount: this.waveCount,
      bossWaveCount: this.bossWaveCount,
      countdownSecondsRemaining: this.countdownSecondsRemaining,
      nextWaveIsBoss: this.nextWaveIsBoss,
    };
  }

  public applyFieldsTo(state: WaveState): void {
    state.threatPercent = this.threatPercent;
    state.warningThreshold = THREAT_WAVE_CONFIG.warningThreshold;
    state.wavesUntilBoss = this.wavesUntilBoss;
    state.waveCount = this.waveCount;
    state.bossWaveCount = this.bossWaveCount;
    state.countdownSecondsRemaining = this.countdownSecondsRemaining;
    state.nextWaveIsBoss = this.nextWaveIsBoss;
  }

  public getWaveCount(): number { return this.waveCount; }
  public getBossWaveCount(): number { return this.bossWaveCount; }
  public getActiveBonusMultiplier(): number { return this.activeBonusMultiplier; }

  public resetGuestTransientState(): void {
    this.countdownRemainingMs = null;
    this.countdownSecondsRemaining = null;
    this.callbacks.onStateChanged?.();
  }

  public syncCountsFromWorldState(waveCount: number, bossWaveCount: number): void {
    this.applyWaveCountsFromSync(waveCount, bossWaveCount);
    this.callbacks.onStateChanged?.();
  }

  public applyWaveCountsFromSync(waveCount: number, bossWaveCount: number): void {
    this.waveCount = Math.max(this.waveCount, waveCount);
    this.bossWaveCount = Math.max(this.bossWaveCount, bossWaveCount);
    this.wavesUntilBoss = computeWavesUntilBoss(this.waveCount);
  }

  public recordWaveSpawn(isBossWave: boolean): void {
    if (isBossWave) this.bossWaveCount += 1;
    this.waveCount += 1;
    this.wavesUntilBoss = computeWavesUntilBoss(this.waveCount);
  }

  private resetCycleState(bonusMultiplier = 1.0): void {
    this.countdownRemainingMs = null;
    this.countdownSecondsRemaining = null;
    this.threatPercent = 0;
    this.warningIssuedForCurrentCycle = false;
    this.activeBonusMultiplier = bonusMultiplier;
  }

  private updateCountdownDisplay(): void {
    if (this.countdownRemainingMs === null) return;
    const nextSec = Math.max(1, Math.ceil(this.countdownRemainingMs / 1000));
    if (nextSec !== this.countdownSecondsRemaining) {
      this.countdownSecondsRemaining = nextSec;
      this.callbacks.onStateChanged?.();
    }
  }

  public addThreat(amount: number, isLocalTrigger = true): void {
    if (amount <= 0) return;
    if (!this.callbacks.isHost() && isLocalTrigger) {
      this.callbacks.onBroadcastThreatAdded?.(amount);
      return;
    }
    if (this.countdownRemainingMs !== null) return;

    const prevThreat = this.threatPercent;
    const nextThreat = Math.min(THREAT_WAVE_CONFIG.maxThreat, prevThreat + amount);
    this.threatPercent = nextThreat;

    if (
      !this.warningIssuedForCurrentCycle &&
      prevThreat < THREAT_WAVE_CONFIG.warningThreshold &&
      nextThreat >= THREAT_WAVE_CONFIG.warningThreshold &&
      nextThreat < THREAT_WAVE_CONFIG.maxThreat
    ) {
      this.warningIssuedForCurrentCycle = true;
      this.callbacks.onWarningReached?.(WARNING_MSG, false);
    }

    if (nextThreat >= THREAT_WAVE_CONFIG.maxThreat) {
      const isBossWave = (this.waveCount + 1) % THREAT_WAVE_CONFIG.bossEveryNWaves === 0;
      const countdownSec = THREAT_WAVE_CONFIG.imminentCountdownSec;
      this.countdownRemainingMs = countdownSec * 1000;
      this.countdownSecondsRemaining = countdownSec;
      this.nextWaveIsBoss = isBossWave;
      this.callbacks.onCountdownStarted?.(countdownMsg(countdownSec, isBossWave), countdownSec, isBossWave);
      this.callbacks.onStateChanged?.();
      this.callbacks.onBroadcastThreatSync?.(this.getSyncPayload());
      return;
    }

    this.callbacks.onStateChanged?.();
    if (this.callbacks.isHost()) this.callbacks.onBroadcastThreatSync?.(this.getSyncPayload());
  }

  public applyRemoteThreatSync(payload: ThreatSyncPayload): void {
    if (this.callbacks.isHost()) return;
    const prevThreat = this.threatPercent;
    const nextThreat = Math.max(0, Math.min(THREAT_WAVE_CONFIG.maxThreat, payload.threatPercent));
    this.threatPercent = nextThreat;
    this.applyWaveCountsFromSync(payload.waveCount, payload.bossWaveCount);
    this.nextWaveIsBoss = payload.nextWaveIsBoss ?? (this.waveCount + 1) % THREAT_WAVE_CONFIG.bossEveryNWaves === 0;

    if (typeof payload.countdownSecondsRemaining === 'number' && payload.countdownSecondsRemaining > 0) {
      const wasCountingDown = this.countdownRemainingMs !== null;
      const targetMs = payload.countdownSecondsRemaining * 1000;
      if (!wasCountingDown || Math.abs((this.countdownRemainingMs ?? 0) - targetMs) > 1500) {
        this.countdownRemainingMs = targetMs;
      }
      this.countdownSecondsRemaining = payload.countdownSecondsRemaining;
      if (!wasCountingDown) {
        const msg = countdownMsg(payload.countdownSecondsRemaining, this.nextWaveIsBoss);
        this.callbacks.onCountdownStarted?.(msg, payload.countdownSecondsRemaining, this.nextWaveIsBoss);
      }
    } else {
      this.countdownRemainingMs = null;
      this.countdownSecondsRemaining = null;
      if (
        prevThreat < THREAT_WAVE_CONFIG.warningThreshold &&
        nextThreat >= THREAT_WAVE_CONFIG.warningThreshold &&
        nextThreat < THREAT_WAVE_CONFIG.maxThreat
      ) {
        this.callbacks.onWarningReached?.(WARNING_MSG, true);
      }
    }
    this.callbacks.onStateChanged?.();
  }

  public tickCountdown(deltaMs: number): void {
    if (this.countdownRemainingMs === null) return;
    if (!this.callbacks.isHost()) {
      this.countdownRemainingMs = Math.max(500, this.countdownRemainingMs - deltaMs);
      this.updateCountdownDisplay();
      return;
    }

    this.countdownRemainingMs -= deltaMs;
    if (this.countdownRemainingMs <= 0) {
      const spawnBoss = this.nextWaveIsBoss;
      this.resetCycleState(1.0);
      this.callbacks.onWaveTriggered?.(spawnBoss, false, 1.0);
      this.callbacks.onBroadcastThreatSync?.(this.getSyncPayload());
    } else {
      this.updateCountdownDisplay();
    }
  }

  public summonEarlyWave(isBossWave: boolean): void {
    if (!this.callbacks.isHost()) {
      this.callbacks.onBroadcastSummonRequest?.(isBossWave, true);
      return;
    }
    const mult = THREAT_WAVE_CONFIG.earlySummonRewardMultiplier;
    this.resetCycleState(mult);
    this.callbacks.onWaveTriggered?.(isBossWave, true, mult);
    this.callbacks.onBroadcastThreatSync?.(this.getSyncPayload());
  }

  public triggerManualWave(isBossWave: boolean): void {
    if (!this.callbacks.isHost()) {
      this.callbacks.onBroadcastSummonRequest?.(isBossWave, false);
      return;
    }
    this.activeBonusMultiplier = 1.0;
    this.callbacks.onWaveTriggered?.(isBossWave, false, 1.0);
  }

  public handleRemoteWaveSummonRequest(isBossWave: boolean, isEarlySummon: boolean): void {
    if (!this.callbacks.isHost()) return;
    if (isEarlySummon) { this.summonEarlyWave(isBossWave); return; }
    this.activeBonusMultiplier = 1.0;
    this.callbacks.onWaveTriggered?.(isBossWave, false, 1.0);
  }
}
