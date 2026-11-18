/**
 * 양(Sheep) 리스폰 지점 주변 배회(Wandering) AI 설정 (데이터 분리)
 */
export interface SheepWanderConfig {
  /** 리스폰 기준 좌표로부터 최대로 벗어날 수 있는 반경 (px) */
  wanderRadiusPx: number;
  /** 배회 이동 속도 (px/s) */
  moveSpeedPx: number;
  /** 제자리 휴식 최소/최대 시간 (ms) */
  idleMinMs: number;
  idleMaxMs: number;
  /** 이동 지속 최소/최대 시간 (ms) */
  walkMinMs: number;
  walkMaxMs: number;
}

export const SHEEP_WANDER_CONFIG: SheepWanderConfig = {
  wanderRadiusPx: 140,
  moveSpeedPx: 34,
  idleMinMs: 1400,
  idleMaxMs: 3600,
  walkMinMs: 1200,
  walkMaxMs: 2800,
};
