export interface LoadingStageLabel {
  readonly threshold: number;
  readonly label: string;
}

export const LOADING_BANNER_SRC = '/assets/ui/loading_banner.jpg';

export const LOADING_STAGE_WEIGHTS = {
  ASSETS_MAX_PERCENT: 90,
  ASSETS_COMPLETE_PERCENT: 95,
  SCENE_READY_PERCENT: 100,
  COMPLETE_HOLD_MS: 200,
} as const;

export const LOADING_STAGE_LABELS: readonly LoadingStageLabel[] = [
  { threshold: 100, label: '출항 준비 완료!' },
  { threshold: 90, label: '영지 및 방어 시스템 동기화 중...' },
  { threshold: 45, label: '마을 건물 및 병력 배치 준비 중...' },
  { threshold: 0, label: '섬과 유닛 스프라이트 불러오는 중...' },
];

export const LOADING_TIPS: readonly string[] = [
  '나무와 금광을 채집해 영지 성채를 업그레이드하고 방어 타워를 세워보세요.',
  '몬스터 웨이브가 시작되기 전에 다리 주변에 방어 타워를 배치하면 효과적입니다.',
  '미니맵(M)을 열어 점령한 섬과 다가오는 몬스터의 위치를 한눈에 확인할 수 있습니다.',
  '마을 등급이 오르면 새로운 방어 건물과 수비대 슬롯이 해금됩니다.',
];

export function clampLoadingPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function mapAssetProgressToPercent(rawRatio: number): number {
  if (!Number.isFinite(rawRatio)) return 0;
  const clampedRatio = Math.min(1, Math.max(0, rawRatio));
  return clampLoadingPercent(clampedRatio * LOADING_STAGE_WEIGHTS.ASSETS_MAX_PERCENT);
}

export function getLoadingStageLabel(percent: number): string {
  const clamped = clampLoadingPercent(percent);
  const matched = LOADING_STAGE_LABELS.find((stage) => clamped >= stage.threshold);
  return matched ? matched.label : LOADING_STAGE_LABELS[LOADING_STAGE_LABELS.length - 1].label;
}
