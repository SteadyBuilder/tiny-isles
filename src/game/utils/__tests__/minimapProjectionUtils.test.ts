import assert from 'node:assert/strict';
import test from 'node:test';
import { WORLD_BOUNDS } from '../../worldBounds';
import {
  computeMinimapViewport,
  shouldAutoCollapseMinimap,
  worldRectToMinimapRect,
  worldToMinimapPoint,
} from '../minimapProjectionUtils';

test('computeMinimapViewport & worldToMinimapPoint map full world bounds in world mode', () => {
  const viewport = computeMinimapViewport('world', WORLD_BOUNDS, { x: 640, y: 640 }, 2900);
  assert.equal(viewport.minX, WORLD_BOUNDS.min);
  assert.equal(viewport.minY, WORLD_BOUNDS.min);
  assert.equal(viewport.width, WORLD_BOUNDS.width);

  const topLeft = worldToMinimapPoint(WORLD_BOUNDS.min, WORLD_BOUNDS.min, viewport, 168);
  assert.ok(Math.abs(topLeft.x - 0) < 1e-6);
  assert.ok(Math.abs(topLeft.y - 0) < 1e-6);
  assert.equal(topLeft.isClamped, false);

  const bottomRight = worldToMinimapPoint(WORLD_BOUNDS.max, WORLD_BOUNDS.max, viewport, 168);
  assert.ok(Math.abs(bottomRight.x - 168) < 1e-6);
  assert.ok(Math.abs(bottomRight.y - 168) < 1e-6);
  assert.equal(bottomRight.isClamped, false);
});

test('computeMinimapViewport centers on player and clamps to world edges in radar mode', () => {
  const centered = computeMinimapViewport('radar', WORLD_BOUNDS, { x: 640, y: 640 }, 2000);
  assert.equal(centered.minX, 640 - 2000);
  assert.equal(centered.minY, 640 - 2000);
  assert.equal(centered.width, 4000);

  const clampedMin = computeMinimapViewport(
    'radar',
    WORLD_BOUNDS,
    { x: WORLD_BOUNDS.min + 100, y: WORLD_BOUNDS.min + 100 },
    2000
  );
  assert.equal(clampedMin.minX, WORLD_BOUNDS.min);
  assert.equal(clampedMin.minY, WORLD_BOUNDS.min);

  const clampedMax = computeMinimapViewport(
    'radar',
    WORLD_BOUNDS,
    { x: WORLD_BOUNDS.max - 100, y: WORLD_BOUNDS.max - 100 },
    2000
  );
  assert.equal(clampedMax.minX, WORLD_BOUNDS.max - 4000);
  assert.equal(clampedMax.minY, WORLD_BOUNDS.max - 4000);
});

test('worldToMinimapPoint clamps offscreen teammates/bosses to edge padding in radar mode', () => {
  const viewport = computeMinimapViewport('radar', WORLD_BOUNDS, { x: 640, y: 640 }, 1500);
  const farEast = worldToMinimapPoint(5500, 640, viewport, 168, true, 6);
  assert.equal(farEast.x, 162);
  assert.ok(Math.abs(farEast.y - 84) < 1e-6);
  assert.equal(farEast.isClamped, true);
});

test('worldRectToMinimapRect projects world rectangles proportionally', () => {
  const viewport = { minX: 0, minY: 0, width: 1000, height: 1000 };
  const rect = worldRectToMinimapRect({ x: 250, y: 500, width: 200, height: 100 }, viewport, 100);
  assert.deepEqual(rect, { x: 25, y: 50, width: 20, height: 10 });
});

test('shouldAutoCollapseMinimap detects compact mobile landscape only', () => {
  assert.equal(shouldAutoCollapseMinimap(667, 375, 768, 430), true);
  assert.equal(shouldAutoCollapseMinimap(390, 844, 768, 430), false);
  assert.equal(shouldAutoCollapseMinimap(1280, 720, 768, 430), false);
  assert.equal(shouldAutoCollapseMinimap(1024, 400, 768, 430), false);
});
