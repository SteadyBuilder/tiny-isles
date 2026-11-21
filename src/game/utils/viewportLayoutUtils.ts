export type ViewportLayoutMode = 'desktop' | 'mobile-portrait' | 'mobile-landscape';

export interface ViewportEnvironment {
  width: number;
  height: number;
  hasCoarsePointer: boolean;
  maxTouchPoints: number;
}

export const VIEWPORT_LAYOUT_CONFIG = {
  /** 세로 모바일 최대 너비 (Tailwind md 미만 기준) */
  portraitMobileMaxWidthPx: 767,
  /** 가로 모바일 판정 최대 높이 (iPhone/Galaxy 가로모드 360~480px 포함) */
  landscapeMobileMaxHeightPx: 540,
  /** 가로 모바일 판정 최대 너비 */
  landscapeMobileMaxWidthPx: 1080,
  /** 터치 기기 가로모드 확장 판정 최대 높이 */
  coarseLandscapeMaxHeightPx: 600,
  /** 터치 기기 가로모드 확장 판정 최대 너비 */
  coarseLandscapeMaxWidthPx: 1180,
} as const;

/**
 * 현재 뷰포트 크기와 포인터 특성을 바탕으로 HUD/조작 레이아웃 모드를 판별하는 순수 함수.
 * - mobile-landscape: 스마트폰 가로모드(낮은 높이 + 가로 비율)
 * - mobile-portrait: 스마트폰 세로모드(좁은 너비)
 * - desktop: PC 및 대형 태블릿
 */
export function resolveViewportLayoutMode(env: ViewportEnvironment): ViewportLayoutMode {
  const { width, height, hasCoarsePointer, maxTouchPoints } = env;
  const isLandscape = width > height;

  if (isLandscape) {
    if (
      height <= VIEWPORT_LAYOUT_CONFIG.landscapeMobileMaxHeightPx &&
      width <= VIEWPORT_LAYOUT_CONFIG.landscapeMobileMaxWidthPx
    ) {
      return 'mobile-landscape';
    }
    const isTouchDevice = hasCoarsePointer || maxTouchPoints > 0;
    if (
      isTouchDevice &&
      height <= VIEWPORT_LAYOUT_CONFIG.coarseLandscapeMaxHeightPx &&
      width <= VIEWPORT_LAYOUT_CONFIG.coarseLandscapeMaxWidthPx
    ) {
      return 'mobile-landscape';
    }
    return 'desktop';
  }

  if (width <= VIEWPORT_LAYOUT_CONFIG.portraitMobileMaxWidthPx) {
    return 'mobile-portrait';
  }

  return 'desktop';
}

/**
 * 가상 조이스틱 및 터치 액션 버튼 노출 여부를 판별한다.
 * 데스크톱 터치스크린 노트북(fine pointer)에서는 오노출을 막기 위해 coarse pointer 또는 모바일 모드를 기준으로 삼는다.
 */
export function shouldShowTouchControls(
  env: ViewportEnvironment,
  layoutMode: ViewportLayoutMode
): boolean {
  return layoutMode !== 'desktop' || env.hasCoarsePointer;
}
