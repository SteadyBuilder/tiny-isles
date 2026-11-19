import { ACCOUNT_SYNC_STORAGE_KEYS } from '../data/authProviders';
import { AccountSaveSnapshot } from '../types/auth';
import {
  areAccountSnapshotsEquivalent,
  hasMeaningfulProgress,
  mergeAccountSnapshots,
} from './accountMergeUtils';

export type ReconcileAction =
  | { type: 'upload_initial'; snapshot: AccountSaveSnapshot }
  | { type: 'already_synced'; syncedAt: string }
  | { type: 'apply_cloud'; snapshot: AccountSaveSnapshot; message?: string }
  | { type: 'push_local'; snapshot: AccountSaveSnapshot }
  | { type: 'conflict'; local: AccountSaveSnapshot; cloud: AccountSaveSnapshot; mergedPreview: AccountSaveSnapshot };

export function readSyncStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSyncStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage quota errors
  }
}

export function removeSyncStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function getSnapshotSignature(snapshot: Pick<AccountSaveSnapshot, 'profile' | 'meta'>): string {
  return JSON.stringify({ profile: snapshot.profile, meta: snapshot.meta });
}

function parseTimestamp(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * 로그인/연동 직후 로컬 게스트 데이터와 클라우드 데이터를 비교해 수행할 동기화 액션을 결정하는 순수 함수
 */
export function planAccountReconciliation(params: {
  userId: string;
  guestPlayerId: string;
  syncedUserId: string | null;
  local: AccountSaveSnapshot;
  cloud: AccountSaveSnapshot | null;
  nowIso: string;
}): ReconcileAction {
  const { userId, guestPlayerId, syncedUserId, local, cloud, nowIso } = params;

  if (!cloud) {
    return {
      type: 'upload_initial',
      snapshot: { ...local, updatedAt: nowIso, legacyGuestId: guestPlayerId },
    };
  }

  if (areAccountSnapshotsEquivalent(local, cloud)) {
    return { type: 'already_synced', syncedAt: cloud.updatedAt };
  }

  if (syncedUserId === userId) {
    if (parseTimestamp(cloud.updatedAt) >= parseTimestamp(local.updatedAt)) {
      return { type: 'apply_cloud', snapshot: cloud };
    }
    return {
      type: 'push_local',
      snapshot: {
        ...local,
        updatedAt: nowIso,
        legacyGuestId: cloud.legacyGuestId ?? guestPlayerId,
      },
    };
  }

  if (!hasMeaningfulProgress(local.meta)) {
    return {
      type: 'apply_cloud',
      snapshot: cloud,
      message: '계정에 저장된 기존 진행 데이터를 불러왔습니다.',
    };
  }

  return {
    type: 'conflict',
    local,
    cloud,
    mergedPreview: mergeAccountSnapshots(local, cloud, nowIso),
  };
}

export function markAccountSyncedLocally(userId: string, updatedAt: string): void {
  writeSyncStorage(ACCOUNT_SYNC_STORAGE_KEYS.SYNCED_USER_ID, userId);
  writeSyncStorage(ACCOUNT_SYNC_STORAGE_KEYS.LOCAL_UPDATED_AT, updatedAt);
}
