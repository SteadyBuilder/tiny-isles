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
}

export const PERFORMANCE_CONFIG: PerformanceConfig = {
  cullingMarginPx: 380,
  cullingIntervalMs: 120,
  cameraMoveThresholdPx: 48,
  monsterTargetSearchIntervalMs: 150,
};
