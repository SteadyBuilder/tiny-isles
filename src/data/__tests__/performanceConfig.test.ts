import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONSTRAINED_TERRAIN_CACHE_PROFILE,
  PERFORMANCE_CONFIG,
  resolveTerrainCacheProfile,
} from '../performanceConfig';

test('resolveTerrainCacheProfile returns default profile in Node / desktop and constrained profile on low-memory or narrow viewports', () => {
  const nodeDefault = resolveTerrainCacheProfile();
  assert.equal(nodeDefault.maxCachedTerrainChunks, PERFORMANCE_CONFIG.maxCachedTerrainChunks);
  assert.equal(
    nodeDefault.terrainChunkPrefetchMarginPx,
    PERFORMANCE_CONFIG.terrainChunkPrefetchMarginPx
  );

  const desktop = resolveTerrainCacheProfile({ deviceMemory: 16, innerWidth: 1920 });
  assert.equal(desktop.maxCachedTerrainChunks, PERFORMANCE_CONFIG.maxCachedTerrainChunks);

  const lowMem = resolveTerrainCacheProfile({ deviceMemory: 4, innerWidth: 1440 });
  assert.deepEqual(lowMem, CONSTRAINED_TERRAIN_CACHE_PROFILE);

  const narrowViewport = resolveTerrainCacheProfile({ deviceMemory: 8, innerWidth: 720 });
  assert.deepEqual(narrowViewport, CONSTRAINED_TERRAIN_CACHE_PROFILE);
});
