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
}

export const PERFORMANCE_CONFIG: PerformanceConfig = {
  cullingMarginPx: 380,
  cullingIntervalMs: 120,
  cameraMoveThresholdPx: 48,
  monsterTargetSearchIntervalMs: 150,
  terrainChunkTiles: 16,
  maxCachedTerrainChunks: 24,
  terrainChunkPrefetchMarginPx: 512,
  maxChunksBakedPerFrame: 2,
};
