import { useCallback, useEffect, useRef, useState } from 'react';
import {
  APP_VERSION_CONFIG,
  cleanupCacheBusterParamInHistory,
  fetchLatestVersionManifest,
  getCurrentBuildId,
  isDevBuild,
  isVersionMismatch,
  triggerCacheBustingReload,
} from '../lib/versionGuard';
import { RoomSessionStatus } from '../types/room';

export interface AppVersionGuardState {
  currentBuildId: string;
  latestBuildId: string | null;
  updateAvailable: boolean;
  isUpdating: boolean;
  checkNow: (options?: { forceCheck?: boolean }) => Promise<boolean>;
  applyUpdateNow: () => void;
}

export function useAppVersionGuard(sessionStatus: RoomSessionStatus): AppVersionGuardState {
  const currentBuildId = getCurrentBuildId();
  const [latestBuildId, setLatestBuildId] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const sessionStatusRef = useRef<RoomSessionStatus>(sessionStatus);
  sessionStatusRef.current = sessionStatus;

  const lastCheckedAtRef = useRef<number>(0);
  const inFlightRef = useRef<boolean>(false);

  const canAutoReloadInCurrentState = useCallback((status: RoomSessionStatus): boolean => {
    return status === 'lobby' || status === 'waiting';
  }, []);

  const attemptAutoReloadIfSafe = useCallback(
    (targetBuildId: string) => {
      if (!canAutoReloadInCurrentState(sessionStatusRef.current)) return;
      const triggered = triggerCacheBustingReload(targetBuildId, { force: false });
      if (triggered) {
        setIsUpdating(true);
      }
    },
    [canAutoReloadInCurrentState]
  );

  const checkNow = useCallback(
    async (options?: { forceCheck?: boolean }): Promise<boolean> => {
      if (isDevBuild(currentBuildId)) return false;
      const now = Date.now();
      if (
        !options?.forceCheck &&
        now - lastCheckedAtRef.current < APP_VERSION_CONFIG.minCheckIntervalMs
      ) {
        return false;
      }
      if (inFlightRef.current) return false;
      inFlightRef.current = true;
      lastCheckedAtRef.current = now;

      try {
        const manifest = await fetchLatestVersionManifest();
        if (!manifest) return false;
        setLatestBuildId(manifest.buildId);

        if (isVersionMismatch(currentBuildId, manifest.buildId)) {
          setUpdateAvailable(true);
          attemptAutoReloadIfSafe(manifest.buildId);
          return true;
        }
        return false;
      } finally {
        inFlightRef.current = false;
      }
    },
    [attemptAutoReloadIfSafe, currentBuildId]
  );

  const applyUpdateNow = useCallback(() => {
    const target = latestBuildId || currentBuildId || 'latest';
    setIsUpdating(true);
    triggerCacheBustingReload(target, { force: true });
  }, [currentBuildId, latestBuildId]);

  // 최초 진입 시 캐시 버스터 쿼리 정리 및 즉시 버전 확인
  useEffect(() => {
    cleanupCacheBusterParamInHistory();
    void checkNow({ forceCheck: true });
  }, [checkNow]);

  // bfcache 복귀(pageshow), 탭 복귀(visibilitychange), 창 포커스 시 최신 버전 확인
  useEffect(() => {
    if (isDevBuild(currentBuildId)) return;

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        void checkNow({ forceCheck: true });
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkNow();
      }
    };
    const handleFocus = () => {
      void checkNow();
    };

    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkNow, currentBuildId]);

  // 게임 진행 중 새 배포가 감지된 경우, 로비로 복귀하면 자동으로 최신화
  useEffect(() => {
    if (updateAvailable && latestBuildId && sessionStatus === 'lobby') {
      attemptAutoReloadIfSafe(latestBuildId);
    }
  }, [attemptAutoReloadIfSafe, latestBuildId, sessionStatus, updateAvailable]);

  return {
    currentBuildId,
    latestBuildId,
    updateAvailable,
    isUpdating,
    checkNow,
    applyUpdateNow,
  };
}
