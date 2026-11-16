/**
 * 월드 상공 구름 레이어 비주얼·패럴랙스 설정
 * [AI Guideline]: 구름 크기, 투명도, 시차(scrollFactor), 이동 속도 등 수치 변경은 이 데이터 파일에서 수행합니다.
 */
export interface WorldCloudItemConfig {
  readonly x: number;
  readonly y: number;
  readonly speed: number;
  readonly scale: number;
  readonly alpha: number;
  readonly scrollFactor: number;
  readonly type: 'cloud1' | 'cloud2';
}

export interface WorldCloudBoundsConfig {
  readonly wrapMinX: number;
  readonly wrapMaxX: number;
  readonly wrapMinY: number;
  readonly wrapMaxY: number;
}

export const WORLD_CLOUD_BOUNDS: WorldCloudBoundsConfig = {
  wrapMinX: -6200,
  wrapMaxX: 7600,
  wrapMinY: -5400,
  wrapMaxY: 6600,
};

export const WORLD_CLOUD_CONFIGS: readonly WorldCloudItemConfig[] = [
  { x: -3200, y: -2800, speed: 0.38, scale: 1.75, alpha: 0.26, scrollFactor: 1, type: 'cloud1' },
  { x: -1200, y: -900, speed: 0.45, scale: 1.95, alpha: 0.3, scrollFactor: 1, type: 'cloud2' },
  { x: 450, y: -200, speed: 0.42, scale: 1.85, alpha: 0.26, scrollFactor: 1, type: 'cloud1' },
  { x: 2600, y: -1800, speed: 0.34, scale: 1.65, alpha: 0.24, scrollFactor: 1, type: 'cloud2' },
  { x: -2400, y: 1200, speed: 0.4, scale: 2.05, alpha: 0.28, scrollFactor: 1, type: 'cloud2' },
  { x: 800, y: 1900, speed: 0.36, scale: 1.8, alpha: 0.25, scrollFactor: 1, type: 'cloud1' },
  { x: 3400, y: 2400, speed: 0.32, scale: 2.15, alpha: 0.3, scrollFactor: 1, type: 'cloud2' },
  { x: -4600, y: 3600, speed: 0.37, scale: 1.7, alpha: 0.24, scrollFactor: 1, type: 'cloud1' },
  { x: 1400, y: 4600, speed: 0.44, scale: 1.9, alpha: 0.28, scrollFactor: 1, type: 'cloud1' },
];
