export interface VersionManifest {
  buildId: string;
  builtAt: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export const APP_VERSION_CONFIG = {
  manifestPath: '/version.json',
  cacheBusterParam: '_v',
  reloadGuardStorageKey: 'tiny_isles_version_reload_guard',
  /** 동일 타겟 빌드에 대해 자동 리로드를 재시도하지 않는 보호 창 (ms) */
  reloadGuardWindowMs: 30_000,
  /** 포커스/가시성 복귀 시 중복 조회를 방지하는 최소 체크 간격 (ms) */
  minCheckIntervalMs: 10_000,
} as const;

interface ReloadGuardRecord {
  targetBuildId: string;
  attemptedAt: number;
}

export function getCurrentBuildId(): string {
  return typeof __APP_BUILD_ID__ === 'string' && __APP_BUILD_ID__.length > 0
    ? __APP_BUILD_ID__
    : 'dev';
}

export function getCurrentBuiltAt(): string {
  return typeof __APP_BUILT_AT__ === 'string' ? __APP_BUILT_AT__ : '';
}

export function isDevBuild(buildId: string = getCurrentBuildId()): boolean {
  return !buildId || buildId === 'dev';
}

export function parseVersionManifest(data: unknown): VersionManifest | null {
  if (!data || typeof data !== 'object') return null;
  const candidate = data as Record<string, unknown>;
  if (typeof candidate.buildId !== 'string' || candidate.buildId.trim().length === 0) {
    return null;
  }
  return {
    buildId: candidate.buildId.trim(),
    builtAt: typeof candidate.builtAt === 'string' ? candidate.builtAt : '',
  };
}

export function isVersionMismatch(
  currentBuildId: string,
  remoteBuildId: string | null | undefined
): boolean {
  if (isDevBuild(currentBuildId)) return false;
  if (!remoteBuildId || isDevBuild(remoteBuildId)) return false;
  return currentBuildId !== remoteBuildId;
}

/**
 * 현재 URL의 모든 쿼리(초대 코드 room/mission/diff 등)와 해시를 유지하면서
 * 캐시 버스터 파라미터(_v)만 교체한 URL을 생성합니다.
 */
export function buildCacheBustingUrl(currentHref: string, targetBuildId: string): string {
  const url = new URL(currentHref);
  url.searchParams.set(APP_VERSION_CONFIG.cacheBusterParam, targetBuildId);
  return url.toString();
}

/**
 * URL에서 캐시 버스터 파라미터(_v)가 존재하는 경우에만 제거한 깔끔한 경로를 반환합니다.
 */
export function stripCacheBusterFromUrl(currentHref: string): string | null {
  const url = new URL(currentHref);
  if (!url.searchParams.has(APP_VERSION_CONFIG.cacheBusterParam)) {
    return null;
  }
  url.searchParams.delete(APP_VERSION_CONFIG.cacheBusterParam);
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ''}${url.hash}`;
}

export function canAttemptAutoReload(
  targetBuildId: string,
  storage: StorageLike | null,
  nowMs: number = Date.now()
): boolean {
  if (!storage) return true;
  try {
    const raw = storage.getItem(APP_VERSION_CONFIG.reloadGuardStorageKey);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as Partial<ReloadGuardRecord>;
    if (
      parsed.targetBuildId === targetBuildId &&
      typeof parsed.attemptedAt === 'number' &&
      nowMs - parsed.attemptedAt < APP_VERSION_CONFIG.reloadGuardWindowMs
    ) {
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

export function recordAutoReloadAttempt(
  targetBuildId: string,
  storage: StorageLike | null,
  nowMs: number = Date.now()
): void {
  if (!storage) return;
  try {
    const record: ReloadGuardRecord = { targetBuildId, attemptedAt: nowMs };
    storage.setItem(APP_VERSION_CONFIG.reloadGuardStorageKey, JSON.stringify(record));
  } catch {
    // 프라이빗 브라우징 등에서 storage 접근 실패 시 무시
  }
}

function getSafeSessionStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export async function fetchLatestVersionManifest(
  fetchImpl: typeof fetch = fetch
): Promise<VersionManifest | null> {
  try {
    const url = `${APP_VERSION_CONFIG.manifestPath}?t=${Date.now()}`;
    const response = await fetchImpl(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return parseVersionManifest(data);
  } catch {
    return null;
  }
}

/**
 * 캐시를 우회해 최신 버전으로 페이지를 교체합니다.
 * - force=false(자동): sessionStorage 30초 가드로 무한 새로고침을 방지합니다.
 * - force=true(사용자 수동 클릭): 타임스탬프를 덧붙여 즉시 강제 갱신합니다.
 */
export function triggerCacheBustingReload(
  targetBuildId: string,
  options?: { force?: boolean }
): boolean {
  if (typeof window === 'undefined') return false;
  const force = options?.force === true;
  const storage = getSafeSessionStorage();
  const effectiveToken = force ? `${targetBuildId}-${Date.now().toString(36)}` : targetBuildId;

  if (!force && !canAttemptAutoReload(targetBuildId, storage)) {
    return false;
  }
  recordAutoReloadAttempt(targetBuildId, storage);

  const nextUrl = buildCacheBustingUrl(window.location.href, effectiveToken);
  window.location.replace(nextUrl);
  return true;
}

export function cleanupCacheBusterParamInHistory(): void {
  if (typeof window === 'undefined') return;
  const cleaned = stripCacheBusterFromUrl(window.location.href);
  if (cleaned) {
    window.history.replaceState({}, '', cleaned);
  }
}

/**
 * 구버전 index.html이 새 배포 후 삭제된 JS 청크를 불러오다 실패할 때(vite:preloadError)
 * 즉시 최신 버전으로 복구하는 전역 리스너를 등록합니다.
 */
export function installChunkLoadRecovery(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    triggerCacheBustingReload(`chunk-recovery-${Date.now().toString(36)}`);
  });
}
