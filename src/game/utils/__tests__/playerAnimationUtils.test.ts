import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canPlayHitAnimation,
  computeOneShotAnimTimeScale,
  isOneShotPlayerAction,
  resolvePostOneShotAction,
} from '../playerAnimationUtils';

test('isOneShotPlayerAction identifies one-shot actions vs looping states', () => {
  assert.equal(isOneShotPlayerAction('axe'), true);
  assert.equal(isOneShotPlayerAction('pickaxe'), true);
  assert.equal(isOneShotPlayerAction('cast'), true);
  assert.equal(isOneShotPlayerAction('hit'), true);
  assert.equal(isOneShotPlayerAction('idle'), false);
  assert.equal(isOneShotPlayerAction('run'), false);
  assert.equal(isOneShotPlayerAction('stun'), false);
});

test('canPlayHitAnimation protects active attack, gather, cast, and stun animations', () => {
  assert.equal(canPlayHitAnimation('idle'), true);
  assert.equal(canPlayHitAnimation('run'), true);
  assert.equal(canPlayHitAnimation('hit'), true);
  assert.equal(canPlayHitAnimation('axe'), false);
  assert.equal(canPlayHitAnimation('pickaxe'), false);
  assert.equal(canPlayHitAnimation('cast'), false);
  assert.equal(canPlayHitAnimation('stun'), false);
});

test('computeOneShotAnimTimeScale speeds up long animations to fit within cooldown', () => {
  // Pawn 500ms anim with 260ms gather cooldown -> speeds up to finish ~239.2ms
  const pawnGatherScale = computeOneShotAnimTimeScale(500, 260);
  assert.ok(pawnGatherScale > 2.0 && pawnGatherScale < 2.2);
  assert.ok(500 / pawnGatherScale < 260);

  // Ranger 533ms anim with 240ms attack cooldown -> speeds up to finish ~220.8ms
  const rangerScale = computeOneShotAnimTimeScale(533.33, 240);
  assert.ok(rangerScale > 2.3 && rangerScale < 2.5);
  assert.ok(533.33 / rangerScale < 240);

  // Lancer 200ms anim with 300ms attack cooldown -> stays at 1x
  assert.equal(computeOneShotAnimTimeScale(200, 300), 1);

  // Missing or invalid inputs default safely to 1x
  assert.equal(computeOneShotAnimTimeScale(500, undefined), 1);
  assert.equal(computeOneShotAnimTimeScale(0, 260), 1);
});

test('resolvePostOneShotAction returns stun, run, or idle based on player state', () => {
  assert.equal(resolvePostOneShotAction(true, true), 'stun');
  assert.equal(resolvePostOneShotAction(true, false), 'stun');
  assert.equal(resolvePostOneShotAction(false, true), 'run');
  assert.equal(resolvePostOneShotAction(false, false), 'idle');
});
