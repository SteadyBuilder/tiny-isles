import assert from 'node:assert/strict';
import test from 'node:test';
import { SHEEP_WANDER_CONFIG } from '../../../data/sheepWanderConfig';
import {
  createInitialSheepWanderState,
  pickSheepWanderTarget,
  stepSheepWander,
} from '../sheepWanderUtils';

test('pickSheepWanderTarget stays within wanderRadiusPx from home', () => {
  const homeX = 500;
  const homeY = 600;
  for (let i = 0; i < 30; i++) {
    const pt = pickSheepWanderTarget(homeX, homeY);
    const dist = Math.hypot(pt.x - homeX, pt.y - homeY);
    assert.ok(
      dist <= SHEEP_WANDER_CONFIG.wanderRadiusPx + 2,
      `Expected dist <= ${SHEEP_WANDER_CONFIG.wanderRadiusPx}, got ${dist}`
    );
  }
});

test('stepSheepWander transitions to walk and moves toward target', () => {
  const state = createInitialSheepWanderState(300, 300, 0);
  state.nextDecisionAt = 100;
  const res = stepSheepWander(300, 300, state, 200, 0.5);
  assert.equal(state.mode, 'walk');
  assert.equal(res.moved, true);
  const movedDist = Math.hypot(res.x - 300, res.y - 300);
  assert.ok(movedDist > 0);
});
