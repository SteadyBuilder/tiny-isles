import { useCallback, useEffect, useRef, useState } from 'react';
import { ACCOUNT_SYNC_STORAGE_KEYS } from '../data/authProviders';
import { mergeAccountSnapshots } from '../lib/accountMergeUtils';
import {
  getSnapshotSignature,
  markAccountSyncedLocally,
  planAccountReconciliation,
  readSyncStorage,
  removeSyncStorage,
  writeSyncStorage,
} from '../lib/accountSyncCoordinator';
import { authService } from '../lib/auth/SupabaseAuthService';
import { cloudSaveRepository } from '../lib/repositories/SupabaseCloudSaveRepository';
import { SavedProfile } from '../lib/storage';
import {
  AccountConflictResolution,
  AccountConflictState,
  AccountSaveSnapshot,
  AccountSyncStatus,
  AuthUserSummary,
  SocialAuthProvider,
} from '../types/auth';
import { MetaProgressionState } from '../types/metaProgression';

interface UseAccountSyncParams {
  guestPlayerId: string;
  profile: SavedProfile;
  meta: MetaProgressionState;
  onApplyProfile: (profile: SavedProfile) => void;
  onApplyMeta: (meta: MetaProgressionState) => void;
}

/**
 * 구글/카카오 소셜 계정 연동 및 게스트-클라우드 세이브 동기화 훅
 */
export function useAccountSync({
  guestPlayerId,
  profile,
  meta,
  onApplyProfile,
  onApplyMeta,
}: UseAccountSyncParams) {
  const [user, setUser] = useState<AuthUserSummary | null>(null);
  const [syncStatus, setSyncStatus] = useState<AccountSyncStatus>('loading');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState<AccountConflictState | null>(null);

  const latestProfileRef = useRef<SavedProfile>(profile);
  const latestMetaRef = useRef<MetaProgressionState>(meta);
  latestProfileRef.current = profile;
  latestMetaRef.current = meta;

  const isApplyingRemoteRef = useRef<boolean>(false);
  const reconciledUserIdRef = useRef<string | null>(null);
  const lastUploadedSignatureRef = useRef<string>('');
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildLocalSnapshot = useCallback((): AccountSaveSnapshot => {
    const localUpdatedAt =
      readSyncStorage(ACCOUNT_SYNC_STORAGE_KEYS.LOCAL_UPDATED_AT) || new Date().toISOString();
    return {
      profile: latestProfileRef.current,
      meta: latestMetaRef.current,
      updatedAt: localUpdatedAt,
      legacyGuestId: guestPlayerId,
    };
  }, [guestPlayerId]);

  const applySnapshotLocally = useCallback(
    (snapshot: AccountSaveSnapshot, userId: string) => {
      isApplyingRemoteRef.current = true;
      onApplyProfile(snapshot.profile);
      onApplyMeta(snapshot.meta);
      markAccountSyncedLocally(userId, snapshot.updatedAt);
      lastUploadedSignatureRef.current = getSnapshotSignature(snapshot);
      setLastSyncedAt(snapshot.updatedAt);
      setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 0);
    },
    [onApplyMeta, onApplyProfile]
  );

  const reconcileUserAccount = useCallback(
    async (nextUser: AuthUserSummary) => {
      setSyncStatus('syncing');
      setErrorMessage(null);
      try {
        const cloud = await cloudSaveRepository.loadAccountSave(nextUser.userId);
        const action = planAccountReconciliation({
          userId: nextUser.userId,
          guestPlayerId,
          syncedUserId: readSyncStorage(ACCOUNT_SYNC_STORAGE_KEYS.SYNCED_USER_ID),
          local: buildLocalSnapshot(),
          cloud,
          nowIso: new Date().toISOString(),
        });

        if (action.type === 'upload_initial') {
          await cloudSaveRepository.saveAccountSave(nextUser.userId, action.snapshot);
          markAccountSyncedLocally(nextUser.userId, action.snapshot.updatedAt);
          lastUploadedSignatureRef.current = getSnapshotSignature(action.snapshot);
          reconciledUserIdRef.current = nextUser.userId;
          setLastSyncedAt(action.snapshot.updatedAt);
          setSyncStatus('idle');
          setStatusMessage('기존 게스트 진행 데이터가 계정에 안전하게 연동되었습니다.');
          return;
        }

        if (action.type === 'already_synced') {
          markAccountSyncedLocally(nextUser.userId, action.syncedAt);
          lastUploadedSignatureRef.current = getSnapshotSignature(buildLocalSnapshot());
          reconciledUserIdRef.current = nextUser.userId;
          setLastSyncedAt(action.syncedAt);
          setSyncStatus('idle');
          return;
        }

        if (action.type === 'apply_cloud') {
          applySnapshotLocally(action.snapshot, nextUser.userId);
          reconciledUserIdRef.current = nextUser.userId;
          setSyncStatus('idle');
          if (action.message) setStatusMessage(action.message);
          return;
        }

        if (action.type === 'push_local') {
          await cloudSaveRepository.saveAccountSave(nextUser.userId, action.snapshot);
          markAccountSyncedLocally(nextUser.userId, action.snapshot.updatedAt);
          lastUploadedSignatureRef.current = getSnapshotSignature(action.snapshot);
          reconciledUserIdRef.current = nextUser.userId;
          setLastSyncedAt(action.snapshot.updatedAt);
          setSyncStatus('idle');
          return;
        }

        setConflict({
          local: action.local,
          cloud: action.cloud,
          mergedPreview: action.mergedPreview,
        });
        setSyncStatus('conflict');
      } catch (e) {
        setSyncStatus('error');
        setErrorMessage(
          e instanceof Error
            ? `클라우드 동기화에 실패했습니다: ${e.message}`
            : '클라우드 동기화 중 오류가 발생했습니다.'
        );
      }
    },
    [applySnapshotLocally, buildLocalSnapshot, guestPlayerId]
  );

  useEffect(() => {
    let active = true;
    const handleUser = (nextUser: AuthUserSummary | null) => {
      if (!active) return;
      setUser(nextUser);
      if (!nextUser) {
        reconciledUserIdRef.current = null;
        setConflict(null);
        setSyncStatus('idle');
        return;
      }
      if (reconciledUserIdRef.current !== nextUser.userId) {
        void reconcileUserAccount(nextUser);
      }
    };

    authService
      .getCurrentUser()
      .then(handleUser)
      .catch(() => {
        if (active) setSyncStatus('idle');
      });

    const unsubscribe = authService.onAuthStateChange(handleUser);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [reconcileUserAccount]);

  useEffect(() => {
    if (isApplyingRemoteRef.current) return;

    const signature = getSnapshotSignature({ profile, meta });
    if (signature === lastUploadedSignatureRef.current) return;

    const nowIso = new Date().toISOString();
    writeSyncStorage(ACCOUNT_SYNC_STORAGE_KEYS.LOCAL_UPDATED_AT, nowIso);

    if (!user || reconciledUserIdRef.current !== user.userId || conflict) return;

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      setSyncStatus('syncing');
      try {
        await cloudSaveRepository.saveAccountSave(user.userId, {
          profile,
          meta,
          updatedAt: nowIso,
          legacyGuestId: guestPlayerId,
        });
        lastUploadedSignatureRef.current = signature;
        setLastSyncedAt(nowIso);
        setSyncStatus('idle');
      } catch (e) {
        setSyncStatus('error');
        setErrorMessage(
          e instanceof Error
            ? `자동 저장 실패: ${e.message}`
            : '클라우드 자동 저장 중 오류가 발생했습니다.'
        );
      }
    }, 800);

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [conflict, guestPlayerId, meta, profile, user]);

  const isAccountLinked = user !== null;

  const connectProvider = useCallback(
    async (provider: SocialAuthProvider) => {
      if (user?.providers.includes(provider)) {
        setStatusMessage('이미 연동되어 있는 소셜 계정입니다.');
        return;
      }
      setErrorMessage(null);
      setStatusMessage(null);
      setSyncStatus('loading');
      const result = user
        ? await authService.linkProvider(provider)
        : await authService.signInWithProvider(provider);

      if (!result.ok) {
        setSyncStatus('error');
        setErrorMessage(result.error ?? '소셜 계정 연동에 실패했습니다.');
      }
    },
    [user]
  );

  const signOut = useCallback(async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    setSyncStatus('loading');
    const result = await authService.signOut();
    if (!result.ok) {
      setSyncStatus('error');
      setErrorMessage(result.error ?? '로그아웃에 실패했습니다.');
      return;
    }
    removeSyncStorage(ACCOUNT_SYNC_STORAGE_KEYS.SYNCED_USER_ID);
    reconciledUserIdRef.current = null;
    lastUploadedSignatureRef.current = '';
    setConflict(null);
    setLastSyncedAt(null);
    setSyncStatus('idle');
    setStatusMessage('로그아웃되었습니다. 현재 기기의 데이터는 그대로 유지됩니다.');
  }, []);

  const syncNow = useCallback(async () => {
    if (!user) return;
    setErrorMessage(null);
    setStatusMessage(null);
    setSyncStatus('syncing');
    try {
      const nowIso = new Date().toISOString();
      const snapshot: AccountSaveSnapshot = {
        profile: latestProfileRef.current,
        meta: latestMetaRef.current,
        updatedAt: nowIso,
        legacyGuestId: guestPlayerId,
      };
      await cloudSaveRepository.saveAccountSave(user.userId, snapshot);
      writeSyncStorage(ACCOUNT_SYNC_STORAGE_KEYS.LOCAL_UPDATED_AT, nowIso);
      lastUploadedSignatureRef.current = getSnapshotSignature(snapshot);
      setLastSyncedAt(nowIso);
      setSyncStatus('idle');
      setStatusMessage('클라우드 저장이 완료되었습니다.');
    } catch (e) {
      setSyncStatus('error');
      setErrorMessage(
        e instanceof Error ? `동기화 실패: ${e.message}` : '동기화 중 오류가 발생했습니다.'
      );
    }
  }, [guestPlayerId, user]);

  const resolveConflict = useCallback(
    async (choice: AccountConflictResolution) => {
      if (!user || !conflict) return;
      setSyncStatus('syncing');
      setErrorMessage(null);
      try {
        const nowIso = new Date().toISOString();
        if (choice === 'use_local') {
          const chosen: AccountSaveSnapshot = {
            ...conflict.local,
            updatedAt: nowIso,
            legacyGuestId: conflict.cloud.legacyGuestId ?? guestPlayerId,
          };
          await cloudSaveRepository.saveAccountSave(user.userId, chosen);
          applySnapshotLocally(chosen, user.userId);
          setStatusMessage('현재 기기 데이터로 계정을 연동했습니다.');
        } else if (choice === 'use_cloud') {
          applySnapshotLocally(conflict.cloud, user.userId);
          setStatusMessage('클라우드 계정 데이터를 불러왔습니다.');
        } else {
          const merged = mergeAccountSnapshots(conflict.local, conflict.cloud, nowIso);
          await cloudSaveRepository.saveAccountSave(user.userId, merged);
          applySnapshotLocally(merged, user.userId);
          setStatusMessage('현재 기기와 클라우드 데이터를 손실 없이 병합했습니다.');
        }
        reconciledUserIdRef.current = user.userId;
        setConflict(null);
        setSyncStatus('idle');
      } catch (e) {
        setSyncStatus('error');
        setErrorMessage(
          e instanceof Error
            ? `데이터 연동 처리 실패: ${e.message}`
            : '데이터 연동 처리 중 오류가 발생했습니다.'
        );
      }
    },
    [applySnapshotLocally, conflict, guestPlayerId, user]
  );

  const clearMessages = useCallback(() => {
    setErrorMessage(null);
    setStatusMessage(null);
  }, []);

  return {
    user,
    isAccountLinked,
    syncStatus,
    lastSyncedAt,
    errorMessage,
    statusMessage,
    conflict,
    connectProvider,
    signOut,
    syncNow,
    resolveConflict,
    clearMessages,
  };
}
