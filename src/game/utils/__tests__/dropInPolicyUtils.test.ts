import assert from 'node:assert/strict';
import test from 'node:test';
import { DROP_IN_POLICY_CONFIG } from '../../../data/dropInConfig';
import {
  calculateContributionScaledReward,
  calculateDropInCatchUpSupport,
  computeEffectiveCombatPlayerCount,
  evaluateDropInLockReason,
} from '../dropInPolicyUtils';

test('evaluateDropInLockReason allows drop-in when room is under capacity and before late-game threshold', () => {
  const reason = evaluateDropInLockReason({
    currentPlayers: 2,
    maxPlayers: 4,
    currentCount: 3,
    targetCount: 8,
    elapsedSec: 600,
    timeLimitSec: 2700,
    allowDropIn: true,
  });
  assert.equal(reason, 'open');
});

test('evaluateDropInLockReason locks drop-in when progress reaches 65% or more (late_game_progress)', () => {
  const reason = evaluateDropInLockReason({
    currentPlayers: 2,
    maxPlayers: 4,
    currentCount: 6, // 6/8 = 75%
    targetCount: 8,
    elapsedSec: 1200,
    timeLimitSec: 2700,
    allowDropIn: true,
  });
  assert.equal(reason, 'late_game_progress');
});

test('evaluateDropInLockReason locks drop-in when remaining time is under 8 minutes (late_game_time)', () => {
  const reason = evaluateDropInLockReason({
    currentPlayers: 2,
    maxPlayers: 4,
    currentCount: 2,
    targetCount: 8,
    elapsedSec: 2300, // 400s remaining (< 480s)
    timeLimitSec: 2700,
    allowDropIn: true,
  });
  assert.equal(reason, 'late_game_time');
});

test('evaluateDropInLockReason locks drop-in when room is full or locked by host', () => {
  assert.equal(
    evaluateDropInLockReason({
      currentPlayers: 4,
      maxPlayers: 4,
      currentCount: 1,
      targetCount: 8,
      elapsedSec: 100,
      timeLimitSec: 2700,
      allowDropIn: true,
    }),
    'room_full'
  );

  assert.equal(
    evaluateDropInLockReason({
      currentPlayers: 2,
      maxPlayers: 4,
      currentCount: 1,
      targetCount: 8,
      elapsedSec: 100,
      timeLimitSec: 2700,
      allowDropIn: false,
    }),
    'host_locked'
  );
});

test('calculateContributionScaledReward grants 0 points and no title to AFK/free-riding players in coop mode', () => {
  const res = calculateContributionScaledReward({
    mode: 'coop',
    victory: true,
    baseRewardPoints: 180,
    difficultyRewardMultiplier: 1.0,
    totalElapsedSec: 1200,
    participatedSec: 300,
    contributionScore: 5, // below 40 threshold
    isDropIn: true,
    hadCoopPeers: true,
  });

  assert.equal(res.earnedPoints, 0);
  assert.equal(res.canUnlockTitle, false);
  assert.equal(res.summary.isQualified, false);
});

test('calculateContributionScaledReward scales reward proportionally for active mid-game drop-in players', () => {
  const res = calculateContributionScaledReward({
    mode: 'coop',
    victory: true,
    baseRewardPoints: 200,
    difficultyRewardMultiplier: 1.0,
    totalElapsedSec: 1000,
    participatedSec: 500, // 50% time -> 55% reward multiplier
    contributionScore: 120,
    isDropIn: true,
    hadCoopPeers: true,
  });

  assert.equal(res.summary.isQualified, true);
  assert.equal(res.earnedPoints, 110);
  assert.equal(res.canUnlockTitle, true);
});

test('calculateContributionScaledReward grants pioneer completion bonus (+15%) to founding coop players', () => {
  const res = calculateContributionScaledReward({
    mode: 'coop',
    victory: true,
    baseRewardPoints: 200,
    difficultyRewardMultiplier: 1.0,
    totalElapsedSec: 1000,
    participatedSec: 1000,
    contributionScore: 350,
    isDropIn: false,
    hadCoopPeers: true,
  });

  assert.equal(res.summary.hasPioneerBonus, true);
  assert.equal(res.earnedPoints, 230);
});

test('calculateDropInCatchUpSupport does not grant catch-up before 60 seconds', () => {
  const pkg = calculateDropInCatchUpSupport(45, true);
  assert.equal(pkg.shouldApply, false);
  assert.equal(pkg.bonusExp, 0);
});

test('calculateDropInCatchUpSupport grants proportional resources and hunting EXP for mid-game joiners', () => {
  const pkg = calculateDropInCatchUpSupport(600, true); // 10 minutes
  assert.equal(pkg.shouldApply, true);
  assert.equal(pkg.elapsedMinutes, 10);
  assert.equal(pkg.bonusWood, 120);
  assert.equal(pkg.bonusGold, 140);
  assert.equal(pkg.bonusExp, 850);
});

test('computeEffectiveCombatPlayerCount excludes newly joined players during 45s grace period and AFK peers after 75s', () => {
  const now = 200_000;
  const result = computeEffectiveCombatPlayerCount(
    [
      { playerId: 'host', joinedAtMs: 0, lastActiveAtMs: now, isLocalHost: true },
      {
        playerId: 'active_peer',
        joinedAtMs: 10_000,
        lastActiveAtMs: now - 5_000,
      },
      {
        playerId: 'new_dropin',
        joinedAtMs: now - (DROP_IN_POLICY_CONFIG.scalingGracePeriodMs - 5_000),
        lastActiveAtMs: now,
      },
      {
        playerId: 'afk_peer',
        joinedAtMs: 10_000,
        lastActiveAtMs: now - (DROP_IN_POLICY_CONFIG.afkTimeoutMs + 10_000),
      },
    ],
    now
  );

  assert.equal(result.effectiveCount, 2); // host + active_peer
  assert.equal(result.graceCount, 1); // new_dropin
  assert.equal(result.afkCount, 1); // afk_peer
});
