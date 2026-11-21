import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computePlayerSpriteMetrics,
  normalizePlayerClassId,
  resolveRemotePlayerAnimKey,
} from '../playerAnimationUtils';

test('computePlayerSpriteMetrics keeps standard 192x192 sheets at 128px with 24x16 world body', () => {
  const m = computePlayerSpriteMetrics(192, 192);
  assert.equal(m.displayWidth, 128);
  assert.equal(m.displayHeight, 128);

  const scaleX = m.displayWidth / 192;
  const scaleY = m.displayHeight / 192;
  assert.ok(Math.abs(m.bodyWidth * scaleX - 24) < 1e-6);
  assert.ok(Math.abs(m.bodyHeight * scaleY - 16) < 1e-6);
  assert.ok(Math.abs(m.offsetX - 78) < 1e-6);
  assert.ok(Math.abs(m.offsetY - 96) < 1e-6);
});

test('computePlayerSpriteMetrics scales 320x320 lancer sheet to 164px while preserving 24x16 centered world body', () => {
  const m = computePlayerSpriteMetrics(320, 320);
  assert.equal(m.displayWidth, 164);
  assert.equal(m.displayHeight, 164);

  const scaleX = m.displayWidth / 320;
  const scaleY = m.displayHeight / 320;
  assert.ok(Math.abs(m.bodyWidth * scaleX - 24) < 1e-6);
  assert.ok(Math.abs(m.bodyHeight * scaleY - 16) < 1e-6);
  assert.ok(Math.abs(m.offsetX + m.bodyWidth / 2 - 160) < 1e-6);
  assert.ok(Math.abs(m.offsetY + m.bodyHeight / 2 - 180) < 1e-6);
});

test('normalizePlayerClassId returns valid classId or falls back to pawn', () => {
  assert.equal(normalizePlayerClassId('lancer'), 'lancer');
  assert.equal(normalizePlayerClassId('archmage'), 'archmage');
  assert.equal(normalizePlayerClassId(undefined), 'pawn');
  assert.equal(normalizePlayerClassId('unknown_job'), 'pawn');
});

test('resolveRemotePlayerAnimKey prefers class animation and falls back cleanly', () => {
  const anims = new Set([
    'blue_idle',
    'blue_run',
    'blue_cast',
    'blue_lancer_idle',
    'blue_lancer_run',
  ]);
  const hasAnim = (k: string) => anims.has(k);

  assert.equal(resolveRemotePlayerAnimKey('blue', 'lancer', 'run', hasAnim), 'blue_lancer_run');
  assert.equal(resolveRemotePlayerAnimKey('blue', 'lancer', 'cast', hasAnim), 'blue_cast');
  assert.equal(resolveRemotePlayerAnimKey('blue', 'lancer', 'stun', hasAnim), 'blue_lancer_idle');
  assert.equal(resolveRemotePlayerAnimKey('blue', 'guardian', 'run', hasAnim), 'blue_run');
  assert.equal(resolveRemotePlayerAnimKey('blue', 'pawn', 'run', hasAnim), 'blue_run');
});
