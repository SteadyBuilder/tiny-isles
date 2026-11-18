import test from 'node:test';
import assert from 'node:assert/strict';
import { THREAT_WAVE_CONFIG } from '../../../data/worldRules';
import type { ThreatSyncPayload } from '../../../types/monsterSync';
import { WaveThreatTracker, computeWavesUntilBoss } from '../WaveThreatTracker';

function createTracker(isHost = true) {
  const warnings: Array<{ message: string; fromRemoteSync: boolean }> = [];
  const countdowns: Array<{ message: string; countdownSec: number; isBossWave: boolean }> = [];
  const triggered: Array<{ isBossWave: boolean; isEarlySummon: boolean; bonusMultiplier: number }> = [];
  const threatAdded: number[] = [];
  const threatSyncs: ThreatSyncPayload[] = [];
  const summonRequests: Array<{ isBossWave: boolean; isEarlySummon: boolean }> = [];
  let stateChanges = 0;

  const tracker = new WaveThreatTracker({
    isHost: () => isHost,
    onWarningReached: (message, fromRemoteSync) => warnings.push({ message, fromRemoteSync }),
    onCountdownStarted: (message, countdownSec, isBossWave) =>
      countdowns.push({ message, countdownSec, isBossWave }),
    onWaveTriggered: (isBossWave, isEarlySummon, bonusMultiplier) =>
      triggered.push({ isBossWave, isEarlySummon, bonusMultiplier }),
    onBroadcastThreatAdded: (amount) => threatAdded.push(amount),
    onBroadcastThreatSync: (payload) => threatSyncs.push(payload),
    onBroadcastSummonRequest: (isBossWave, isEarlySummon) =>
      summonRequests.push({ isBossWave, isEarlySummon }),
    onStateChanged: () => {
      stateChanges += 1;
    },
  });

  return {
    tracker,
    warnings,
    countdowns,
    triggered,
    threatAdded,
    threatSyncs,
    summonRequests,
    getStateChanges: () => stateChanges,
  };
}

test('guest local addThreat forwards via onBroadcastThreatAdded without mutating local threat', () => {
  const ctx = createTracker(false);
  ctx.tracker.addThreat(25, true);

  assert.deepEqual(ctx.threatAdded, [25]);
  assert.equal(ctx.tracker.getSyncPayload().threatPercent, 0);
  assert.equal(ctx.threatSyncs.length, 0);
  assert.equal(ctx.getStateChanges(), 0);
});

test('host addThreat triggers 80% warning once per cycle and starts 15s countdown + boss prediction at 100%', () => {
  const ctx = createTracker(true);
  ctx.tracker.syncCountsFromWorldState(2, 0);

  ctx.tracker.addThreat(80);
  ctx.tracker.addThreat(10);
  assert.equal(ctx.warnings.length, 1);
  assert.equal(ctx.warnings[0]?.fromRemoteSync, false);
  assert.equal(ctx.threatSyncs.length, 2);

  ctx.tracker.addThreat(15);
  assert.equal(ctx.countdowns.length, 1);
  assert.equal(ctx.countdowns[0]?.countdownSec, THREAT_WAVE_CONFIG.imminentCountdownSec);
  assert.equal(ctx.countdowns[0]?.isBossWave, true);

  const payload = ctx.tracker.getSyncPayload();
  assert.equal(payload.threatPercent, 100);
  assert.equal(payload.countdownSecondsRemaining, 15);
  assert.equal(payload.nextWaveIsBoss, true);
  assert.equal(ctx.threatSyncs.length, 3);

  ctx.tracker.addThreat(20);
  assert.equal(ctx.threatSyncs.length, 3);
});

test('host tickCountdown decrements and triggers wave + reset at 0 while guest clamps at 500ms/1s', () => {
  const host = createTracker(true);
  host.tracker.addThreat(100);
  host.threatSyncs.length = 0;

  host.tracker.tickCountdown(1400);
  assert.equal(host.tracker.getSyncPayload().countdownSecondsRemaining, 14);
  assert.equal(host.triggered.length, 0);

  host.tracker.tickCountdown(13600);
  assert.deepEqual(host.triggered, [{ isBossWave: false, isEarlySummon: false, bonusMultiplier: 1.0 }]);
  assert.equal(host.tracker.getSyncPayload().threatPercent, 0);
  assert.equal(host.tracker.getSyncPayload().countdownSecondsRemaining, null);
  assert.equal(host.threatSyncs.length, 1);

  const guest = createTracker(false);
  guest.tracker.applyRemoteThreatSync({
    threatPercent: 100,
    waveCount: 0,
    bossWaveCount: 0,
    countdownSecondsRemaining: 2,
    nextWaveIsBoss: false,
  });
  guest.tracker.tickCountdown(5000);
  assert.equal(guest.tracker.getSyncPayload().countdownSecondsRemaining, 1);
  assert.equal(guest.triggered.length, 0);
});

test('applyRemoteThreatSync preserves >1500ms drift check, avoids duplicate countdown alerts, and clears on reset', () => {
  const guest = createTracker(false);

  guest.tracker.applyRemoteThreatSync({
    threatPercent: 85,
    waveCount: 1,
    bossWaveCount: 0,
    countdownSecondsRemaining: null,
    nextWaveIsBoss: false,
  });
  assert.equal(guest.warnings.length, 1);
  assert.equal(guest.warnings[0]?.fromRemoteSync, true);

  guest.tracker.applyRemoteThreatSync({
    threatPercent: 100,
    waveCount: 1,
    bossWaveCount: 0,
    countdownSecondsRemaining: 15,
    nextWaveIsBoss: false,
  });
  assert.equal(guest.countdowns.length, 1);

  guest.tracker.tickCountdown(500);
  guest.tracker.applyRemoteThreatSync({
    threatPercent: 100,
    waveCount: 1,
    bossWaveCount: 0,
    countdownSecondsRemaining: 14,
    nextWaveIsBoss: false,
  });
  assert.equal(guest.countdowns.length, 1);

  guest.tracker.tickCountdown(2000);
  guest.tracker.applyRemoteThreatSync({
    threatPercent: 0,
    waveCount: 2,
    bossWaveCount: 0,
    countdownSecondsRemaining: null,
    nextWaveIsBoss: true,
  });
  assert.equal(guest.tracker.getSyncPayload().countdownSecondsRemaining, null);
  assert.equal(guest.tracker.getSyncPayload().threatPercent, 0);
});

test('summonEarlyWave forwards summon request on guest and resets threat with earlySummonRewardMultiplier on host', () => {
  const guest = createTracker(false);
  guest.tracker.summonEarlyWave(true);
  assert.deepEqual(guest.summonRequests, [{ isBossWave: true, isEarlySummon: true }]);

  const host = createTracker(true);
  host.tracker.addThreat(100);
  host.threatSyncs.length = 0;

  host.tracker.summonEarlyWave(true);
  assert.deepEqual(host.triggered, [
    {
      isBossWave: true,
      isEarlySummon: true,
      bonusMultiplier: THREAT_WAVE_CONFIG.earlySummonRewardMultiplier,
    },
  ]);
  assert.equal(host.tracker.getActiveBonusMultiplier(), THREAT_WAVE_CONFIG.earlySummonRewardMultiplier);
  assert.equal(host.tracker.getSyncPayload().threatPercent, 0);
  assert.equal(host.tracker.getSyncPayload().countdownSecondsRemaining, null);
  assert.equal(host.threatSyncs.length, 1);
});

test('syncCountsFromWorldState and recordWaveSpawn track counts and wavesUntilBoss monotonically', () => {
  const ctx = createTracker(true);
  assert.equal(computeWavesUntilBoss(0), 3);

  ctx.tracker.syncCountsFromWorldState(2, 0);
  assert.equal(ctx.tracker.getWaveCount(), 2);
  ctx.tracker.syncCountsFromWorldState(1, 0);
  assert.equal(ctx.tracker.getWaveCount(), 2);

  ctx.tracker.recordWaveSpawn(true);
  assert.equal(ctx.tracker.getWaveCount(), 3);
  assert.equal(ctx.tracker.getBossWaveCount(), 1);
  assert.equal(computeWavesUntilBoss(3), 3);
});
