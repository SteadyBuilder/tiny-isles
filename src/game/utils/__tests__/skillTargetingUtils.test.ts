import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampTargetToCastRange,
  computeEffectiveSkillCastRange,
  isGroundTargetedClass,
} from '../skillTargetingUtils';

test('isGroundTargetedClass identifies ground vs instant skills', () => {
  assert.equal(isGroundTargetedClass({ skillTargetingMode: 'ground' }), true);
  assert.equal(isGroundTargetedClass({ skillTargetingMode: 'instant' }), false);
  assert.equal(isGroundTargetedClass({}), false);
});

test('computeEffectiveSkillCastRange falls back to skillRadius and adds non-negative bonus', () => {
  assert.equal(computeEffectiveSkillCastRange({ skillCastRange: 440, skillRadius: 240 }, 20), 460);
  assert.equal(computeEffectiveSkillCastRange({ skillRadius: 280 }, 15), 295);
  assert.equal(computeEffectiveSkillCastRange({ skillCastRange: 400, skillRadius: 260 }, -50), 400);
});

test('clampTargetToCastRange preserves coordinates within maxCastRange', () => {
  const res = clampTargetToCastRange(100, 200, 250, 200, 400);
  assert.equal(res.x, 250);
  assert.equal(res.y, 200);
  assert.equal(res.distance, 150);
  assert.equal(res.isClamped, false);
});

test('clampTargetToCastRange clamps coordinates exceeding maxCastRange along direction vector', () => {
  const res = clampTargetToCastRange(100, 100, 700, 900, 500);
  assert.equal(res.isClamped, true);
  assert.ok(Math.abs(res.distance - 500) < 1e-6);
  // dx=600, dy=800 -> unit=(0.6, 0.8) -> clamped=(100+300, 100+400)=(400, 500)
  assert.ok(Math.abs(res.x - 400) < 1e-6);
  assert.ok(Math.abs(res.y - 500) < 1e-6);
});

test('clampTargetToCastRange handles zero-distance pointer equal to caster', () => {
  const res = clampTargetToCastRange(320, 480, 320, 480, 400);
  assert.equal(res.x, 320);
  assert.equal(res.y, 480);
  assert.equal(res.distance, 0);
  assert.equal(res.isClamped, false);
});
