/**
 * Phaser 런타임 렌더링·컬링·AI 연산 경량화를 위한 데이터 설정
 */
export interface PerformanceConfig {
  /** 카메라 뷰포트 외곽 여유 컬링 마진 (px) - 대형 건물/나무 잘림 방지 */
  readonly cullingMarginPx: number;
  /** 뷰포트 컬링 최소 갱신 주기 (ms) */
  readonly cullingIntervalMs: number;
  /** 카메라 이동 시 즉시 컬링을 갱신할 거리 임계값 (px) */
  readonly cameraMoveThresholdPx: number;
  /** 마물 AI의 방해 건물/성벽 전체 탐색 캐시 유지 주기 (ms) */
  readonly monsterTargetSearchIntervalMs: number;
  /** 지형 청크 한 변의 타일 수 (16 * 64 = 1024px) */
  readonly terrainChunkTiles: number;
  /** 메모리에 유지할 최대 지형 청크 수 (LRU 캐시 상한) */
  readonly maxCachedTerrainChunks: number;
  /** 뷰포트 외곽 지형 청크 선행 베이킹 마진 (px) */
  readonly terrainChunkPrefetchMarginPx: number;
  /** 이동 중 프레임당 최대 신규 베이킹 청크 수 (프레임 드랍 방지) */
  readonly maxChunksBakedPerFrame: number;
  /** 화면 밖 비주얼 이펙트(폭발/스파크/플로팅 텍스트) 생성 스킵 마진 (px) */
  readonly fxViewportMarginPx: number;
  /** 공용 이펙트 스프라이트 풀 최대 보유 수 */
  readonly maxFxSpritePool: number;
  /** 공용 이펙트 이미지 풀 최대 보유 수 */
  readonly maxFxImagePool: number;
  /** 공용 이펙트 그래픽스 풀 최대 보유 수 */
  readonly maxFxGraphicsPool: number;
  /** 동시 재생 가능한 최대 폭발 이펙트 수 (대규모 동시 처치 시 필레이트/GC 방어) */
  readonly maxConcurrentExplosions: number;
  /** 동시 재생 가능한 최대 타격 버스트 이펙트 수 */
  readonly maxConcurrentHitBursts: number;
  /** HUD 위협 구슬 DOM 오버레이 최대 동시 개수 */
  readonly maxConcurrentThreatOrbs: number;
  /** 건설된 자원 건물 타이머 링 리드로우 양자화 단계 수 (50 = 2% 단위 갱신) */
  readonly resourceTimerQuantizationSteps: number;
  /** 쿨다운 HUD React 상태 방출 양자화 간격 (ms) */
  readonly cooldownUiBucketMs: number;
}

export interface TerrainCacheProfile {
  readonly maxCachedTerrainChunks: number;
  readonly terrainChunkPrefetchMarginPx: number;
}

export const PERFORMANCE_CONFIG: PerformanceConfig = {
  cullingMarginPx: 380,
  cullingIntervalMs: 120,
  cameraMoveThresholdPx: 48,
  monsterTargetSearchIntervalMs: 150,
  terrainChunkTiles: 16,
  maxCachedTerrainChunks: 20,
  terrainChunkPrefetchMarginPx: 384,
  maxChunksBakedPerFrame: 2,
  fxViewportMarginPx: 220,
  maxFxSpritePool: 48,
  maxFxImagePool: 48,
  maxFxGraphicsPool: 64,
  maxConcurrentExplosions: 10,
  maxConcurrentHitBursts: 12,
  maxConcurrentThreatOrbs: 16,
  resourceTimerQuantizationSteps: 50,
  cooldownUiBucketMs: 250,
};

export const CONSTRAINED_TERRAIN_CACHE_PROFILE: TerrainCacheProfile = {
  maxCachedTerrainChunks: 12,
  terrainChunkPrefetchMarginPx: 256,
};

/**
 * 저사양·모바일/좁은 뷰포트 게스트 브라우저에서는 지형 청크 캐시 상한과 프리페치 반경을 낮춰
 * Canvas2D/WebGL 텍스처 메모리 점유를 억제합니다.
 */
export function resolveTerrainCacheProfile(env?: {
  deviceMemory?: number;
  innerWidth?: number;
}): TerrainCacheProfile {
  const navMem =
    env?.deviceMemory ??
    (typeof navigator !== 'undefined'
      ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory
      : undefined);
  const width =
    env?.innerWidth ?? (typeof window !== 'undefined' ? window.innerWidth : undefined);

  const isLowMemory = typeof navMem === 'number' && Number.isFinite(navMem) && navMem <= 4;
  const isNarrowViewport =
    typeof width === 'number' && Number.isFinite(width) && width > 0 && width < 900;

  if (isLowMemory || isNarrowViewport) {
    return CONSTRAINED_TERRAIN_CACHE_PROFILE;
  }
  return {
    maxCachedTerrainChunks: PERFORMANCE_CONFIG.maxCachedTerrainChunks,
    terrainChunkPrefetchMarginPx: PERFORMANCE_CONFIG.terrainChunkPrefetchMarginPx,
  };
}
