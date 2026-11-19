import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APP_VERSION_CONFIG,
  StorageLike,
  buildCacheBustingUrl,
  canAttemptAutoReload,
  isVersionMismatch,
  parseVersionManifest,
  recordAutoReloadAttempt,
  stripCacheBusterFromUrl,
} from '../versionGuard';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

test('parseVersionManifest validates buildId and preserves builtAt', () => {
  assert.deepEqual(
    parseVersionManifest({ buildId: '20261119-abc123', builtAt: '2026-11-19T12:00:00.000Z' }),
    { buildId: '20261119-abc123', builtAt: '2026-11-19T12:00:00.000Z' }
  );
  assert.equal(parseVersionManifest(null), null);
  assert.equal(parseVersionManifest({ buildId: '   ' }), null);
  assert.equal(parseVersionManifest({}), null);
});

test('isVersionMismatch ignores dev builds and detects real build differences', () => {
  assert.equal(isVersionMismatch('dev', '20261119-abc123'), false);
  assert.equal(isVersionMismatch('20261119-abc123', 'dev'), false);
  assert.equal(isVersionMismatch('20261119-abc123', null), false);
  assert.equal(isVersionMismatch('20261119-abc123', '20261119-abc123'), false);
  assert.equal(isVersionMismatch('20261119-abc123', '20261119-def456'), true);
});

test('buildCacheBustingUrl preserves invite query parameters and hash while setting _v', () => {
  const inviteUrl =
    'https://tiny-isles-three.vercel.app/?room=AB12CD&mission=hunting_ground&diff=hard&v=old1#top';
  const next = buildCacheBustingUrl(inviteUrl, '20261119-new999');
  const parsed = new URL(next);

  assert.equal(parsed.searchParams.get('room'), 'AB12CD');
  assert.equal(parsed.searchParams.get('mission'), 'hunting_ground');
  assert.equal(parsed.searchParams.get('diff'), 'hard');
  assert.equal(parsed.searchParams.get(APP_VERSION_CONFIG.cacheBusterParam), '20261119-new999');
  assert.equal(parsed.hash, '#top');
});

test('stripCacheBusterFromUrl removes only _v while preserving invite parameters', () => {
  const cleaned = stripCacheBusterFromUrl(
    'https://tiny-isles-three.vercel.app/?room=AB12CD&_v=20261119-new999&diff=normal'
  );
  assert.equal(cleaned, '/?room=AB12CD&diff=normal');

  assert.equal(
    stripCacheBusterFromUrl('https://tiny-isles-three.vercel.app/?room=AB12CD'),
    null
  );
});

test('canAttemptAutoReload blocks duplicate reload loops within guard window and allows after expiry or new build', () => {
  const storage = createMemoryStorage();
  const t0 = 1_000_000;

  assert.equal(canAttemptAutoReload('build-v2', storage, t0), true);
  recordAutoReloadAttempt('build-v2', storage, t0);

  // 동일 타겟 빌드는 보호 시간 내 재시도 차단
  assert.equal(canAttemptAutoReload('build-v2', storage, t0 + 5_000), false);
  // 더 새로운 빌드가 배포되면 즉시 허용
  assert.equal(canAttemptAutoReload('build-v3', storage, t0 + 5_000), true);
  // 보호 시간 경과 후 다시 허용
  assert.equal(
    canAttemptAutoReload('build-v2', storage, t0 + APP_VERSION_CONFIG.reloadGuardWindowMs + 1),
    true
  );
});
