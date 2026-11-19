import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_META_PROGRESSION } from '../../data/metaProgression';
import { AccountSaveSnapshot } from '../../types/auth';
import {
  areAccountSnapshotsEquivalent,
  hasMeaningfulProgress,
  mergeAccountSnapshots,
  mergeMetaProgressions,
  normalizeMetaProgression,
  summarizeAccountSnapshot,
} from '../accountMergeUtils';
import { planAccountReconciliation } from '../accountSyncCoordinator';

test('hasMeaningfulProgress returns false for fresh default meta progression', () => {
  assert.equal(hasMeaningfulProgress(DEFAULT_META_PROGRESSION), false);
});

test('hasMeaningfulProgress detects points, traits, clears, or cosmetics', () => {
  assert.equal(
    hasMeaningfulProgress({ ...DEFAULT_META_PROGRESSION, points: 50 }),
    true
  );
  assert.equal(
    hasMeaningfulProgress({
      ...DEFAULT_META_PROGRESSION,
      traitLevels: { ...DEFAULT_META_PROGRESSION.traitLevels, guardian_might: 1 },
    }),
    true
  );
  assert.equal(
    hasMeaningfulProgress({
      ...DEFAULT_META_PROGRESSION,
      unlockedCostumeIds: ['costume_blue', 'costume_red'],
    }),
    true
  );
});

test('mergeMetaProgressions preserves max stats and union of unlocks without loss', () => {
  const local = normalizeMetaProgression({
    points: 120,
    totalClears: 2,
    traitLevels: {
      ...DEFAULT_META_PROGRESSION.traitLevels,
      vitality_training: 3,
      guardian_might: 1,
    },
    unlockedTitleIds: ['title_recruit', 'title_pioneer'],
    equippedTitleId: 'title_pioneer',
    unlockedCostumeIds: ['costume_blue', 'costume_red'],
    equippedCostumeId: 'costume_red',
    unlockedAuraIds: ['aura_none'],
    equippedAuraId: 'aura_none',
    clearedMissionIds: ['mission_1'],
  });

  const cloud = normalizeMetaProgression({
    points: 300,
    totalClears: 5,
    traitLevels: {
      ...DEFAULT_META_PROGRESSION.traitLevels,
      vitality_training: 1,
      guardian_might: 4,
    },
    unlockedTitleIds: ['title_recruit', 'title_slayer'],
    equippedTitleId: 'title_slayer',
    unlockedCostumeIds: ['costume_blue', 'costume_yellow'],
    equippedCostumeId: 'costume_yellow',
    unlockedAuraIds: ['aura_none', 'aura_ember'],
    equippedAuraId: 'aura_ember',
    clearedMissionIds: ['mission_1', 'mission_2'],
  });

  const merged = mergeMetaProgressions(local, cloud);
  assert.equal(merged.points, 300);
  assert.equal(merged.totalClears, 5);
  assert.equal(merged.traitLevels.vitality_training, 3);
  assert.equal(merged.traitLevels.guardian_might, 4);
  assert.deepEqual(new Set(merged.unlockedTitleIds), new Set(['title_recruit', 'title_pioneer', 'title_slayer']));
  assert.deepEqual(new Set(merged.unlockedCostumeIds), new Set(['costume_blue', 'costume_red', 'costume_yellow']));
  assert.deepEqual(new Set(merged.unlockedAuraIds), new Set(['aura_none', 'aura_ember']));
  assert.deepEqual(new Set(merged.clearedMissionIds), new Set(['mission_1', 'mission_2']));
  assert.equal(merged.equippedTitleId, 'title_pioneer');
  assert.equal(merged.equippedAuraId, 'aura_ember');
});

test('mergeAccountSnapshots prefers custom nickname over generated guest name', () => {
  const local: AccountSaveSnapshot = {
    profile: { name: '불꽃기사', color: 'red' },
    meta: DEFAULT_META_PROGRESSION,
    updatedAt: '2026-11-18T00:00:00.000Z',
    legacyGuestId: 'p_local1',
  };
  const cloud: AccountSaveSnapshot = {
    profile: { name: '수호자_482', color: 'blue' },
    meta: { ...DEFAULT_META_PROGRESSION, points: 250 },
    updatedAt: '2026-11-17T00:00:00.000Z',
  };

  const merged = mergeAccountSnapshots(local, cloud, '2026-11-18T12:00:00.000Z');
  assert.equal(merged.profile.name, '불꽃기사');
  assert.equal(merged.profile.color, 'red');
  assert.equal(merged.meta.points, 250);
  assert.equal(merged.legacyGuestId, 'p_local1');
});

test('areAccountSnapshotsEquivalent and summarizeAccountSnapshot work accurately', () => {
  const snapA: AccountSaveSnapshot = {
    profile: { name: '기사단장', color: 'blue' },
    meta: {
      ...DEFAULT_META_PROGRESSION,
      points: 90,
      totalClears: 3,
      traitLevels: {
        ...DEFAULT_META_PROGRESSION.traitLevels,
        vitality_training: 2,
        swift_footwork: 1,
      },
      clearedMissionIds: ['m1', 'm2'],
      unlockedCostumeIds: ['costume_blue', 'costume_red'],
    },
    updatedAt: '2026-11-18T01:00:00.000Z',
  };
  const snapB: AccountSaveSnapshot = {
    ...snapA,
    updatedAt: '2026-11-18T02:00:00.000Z',
  };

  assert.equal(areAccountSnapshotsEquivalent(snapA, snapB), true);
  const summary = summarizeAccountSnapshot(snapA);
  assert.equal(summary.points, 90);
  assert.equal(summary.totalClears, 3);
  assert.equal(summary.totalTraitLevels, 3);
  assert.equal(summary.clearedMissionCount, 2);
  assert.equal(summary.unlockedCosmeticCount, 1);
});

test('planAccountReconciliation uploads local guest data when cloud save does not exist', () => {
  const local: AccountSaveSnapshot = {
    profile: { name: '게스트용사', color: 'blue' },
    meta: { ...DEFAULT_META_PROGRESSION, points: 150 },
    updatedAt: '2026-11-18T00:00:00.000Z',
  };
  const action = planAccountReconciliation({
    userId: 'user-1',
    guestPlayerId: 'p_abc',
    syncedUserId: null,
    local,
    cloud: null,
    nowIso: '2026-11-18T10:00:00.000Z',
  });
  assert.equal(action.type, 'upload_initial');
  if (action.type === 'upload_initial') {
    assert.equal(action.snapshot.legacyGuestId, 'p_abc');
    assert.equal(action.snapshot.meta.points, 150);
  }
});

test('planAccountReconciliation downloads cloud save automatically on a fresh device', () => {
  const local: AccountSaveSnapshot = {
    profile: { name: '수호자_101', color: 'blue' },
    meta: DEFAULT_META_PROGRESSION,
    updatedAt: '2026-11-18T05:00:00.000Z',
  };
  const cloud: AccountSaveSnapshot = {
    profile: { name: '기존유저', color: 'red' },
    meta: { ...DEFAULT_META_PROGRESSION, points: 400, totalClears: 4 },
    updatedAt: '2026-11-17T05:00:00.000Z',
  };
  const action = planAccountReconciliation({
    userId: 'user-1',
    guestPlayerId: 'p_new',
    syncedUserId: null,
    local,
    cloud,
    nowIso: '2026-11-18T10:00:00.000Z',
  });
  assert.equal(action.type, 'apply_cloud');
});

test('planAccountReconciliation triggers conflict when both guest and cloud have distinct progress', () => {
  const local: AccountSaveSnapshot = {
    profile: { name: '로컬기사', color: 'blue' },
    meta: { ...DEFAULT_META_PROGRESSION, points: 120, totalClears: 1 },
    updatedAt: '2026-11-18T05:00:00.000Z',
  };
  const cloud: AccountSaveSnapshot = {
    profile: { name: '클라우드기사', color: 'red' },
    meta: { ...DEFAULT_META_PROGRESSION, points: 320, totalClears: 3 },
    updatedAt: '2026-11-17T05:00:00.000Z',
  };
  const action = planAccountReconciliation({
    userId: 'user-1',
    guestPlayerId: 'p_guest',
    syncedUserId: null,
    local,
    cloud,
    nowIso: '2026-11-18T10:00:00.000Z',
  });
  assert.equal(action.type, 'conflict');
  if (action.type === 'conflict') {
    assert.equal(action.mergedPreview.meta.points, 320);
  }
});

test('planAccountReconciliation silently syncs returning user based on latest timestamp', () => {
  const local: AccountSaveSnapshot = {
    profile: { name: '유저A', color: 'blue' },
    meta: { ...DEFAULT_META_PROGRESSION, points: 200 },
    updatedAt: '2026-11-18T08:00:00.000Z',
  };
  const cloud: AccountSaveSnapshot = {
    profile: { name: '유저A', color: 'blue' },
    meta: { ...DEFAULT_META_PROGRESSION, points: 260 },
    updatedAt: '2026-11-18T09:00:00.000Z',
  };
  const action = planAccountReconciliation({
    userId: 'user-1',
    guestPlayerId: 'p_guest',
    syncedUserId: 'user-1',
    local,
    cloud,
    nowIso: '2026-11-18T10:00:00.000Z',
  });
  assert.equal(action.type, 'apply_cloud');
});

