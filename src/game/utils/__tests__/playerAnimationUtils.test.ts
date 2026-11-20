import assert from 'node:assert/strict';
import test from 'node:test';
import { computePlayerSpriteMetrics } from '../playerAnimationUtils';

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
