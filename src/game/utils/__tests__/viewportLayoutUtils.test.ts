import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveViewportLayoutMode,
  shouldShowTouchControls,
} from '../viewportLayoutUtils';

test('resolveViewportLayoutMode detects mobile-landscape for standard phone landscape viewports', () => {
  // iPhone 14/15 landscape (844x390)
  assert.equal(
    resolveViewportLayoutMode({
      width: 844,
      height: 390,
      hasCoarsePointer: true,
      maxTouchPoints: 5,
    }),
    'mobile-landscape'
  );

  // Galaxy S24 Ultra landscape (915x412)
  assert.equal(
    resolveViewportLayoutMode({
      width: 915,
      height: 412,
      hasCoarsePointer: true,
      maxTouchPoints: 5,
    }),
    'mobile-landscape'
  );

  // Desktop browser simulating mobile landscape (e.g. 800x400, fine pointer)
  assert.equal(
    resolveViewportLayoutMode({
      width: 800,
      height: 400,
      hasCoarsePointer: false,
      maxTouchPoints: 0,
    }),
    'mobile-landscape'
  );
});

test('resolveViewportLayoutMode detects mobile-portrait for vertical phones', () => {
  assert.equal(
    resolveViewportLayoutMode({
      width: 390,
      height: 844,
      hasCoarsePointer: true,
      maxTouchPoints: 5,
    }),
    'mobile-portrait'
  );
});

test('resolveViewportLayoutMode detects desktop for standard PC monitors', () => {
  assert.equal(
    resolveViewportLayoutMode({
      width: 1440,
      height: 900,
      hasCoarsePointer: false,
      maxTouchPoints: 0,
    }),
    'desktop'
  );

  // Touchscreen Windows laptop (fine primary pointer)
  const laptopEnv = {
    width: 1366,
    height: 768,
    hasCoarsePointer: false,
    maxTouchPoints: 10,
  };
  const mode = resolveViewportLayoutMode(laptopEnv);
  assert.equal(mode, 'desktop');
  assert.equal(shouldShowTouchControls(laptopEnv, mode), false);
});

test('shouldShowTouchControls enables touch controls in mobile-landscape even when width >= 768px', () => {
  const landscapePhone = {
    width: 932,
    height: 430,
    hasCoarsePointer: true,
    maxTouchPoints: 5,
  };
  const mode = resolveViewportLayoutMode(landscapePhone);
  assert.equal(mode, 'mobile-landscape');
  assert.equal(shouldShowTouchControls(landscapePhone, mode), true);
});
