import { useEffect, useState } from 'react';
import {
  resolveViewportLayoutMode,
  shouldShowTouchControls,
  ViewportEnvironment,
  ViewportLayoutMode,
} from '../game/utils/viewportLayoutUtils';

export interface ViewportLayoutState {
  layoutMode: ViewportLayoutMode;
  isDesktop: boolean;
  isPortraitMobile: boolean;
  isLandscapeMobile: boolean;
  showTouchControls: boolean;
  width: number;
  height: number;
}

function readViewportEnvironment(): ViewportEnvironment {
  if (typeof window === 'undefined') {
    return {
      width: 1280,
      height: 720,
      hasCoarsePointer: false,
      maxTouchPoints: 0,
    };
  }
  const hasCoarsePointer =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : false;
  const maxTouchPoints =
    typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0;

  return {
    width: window.innerWidth,
    height: window.innerHeight,
    hasCoarsePointer,
    maxTouchPoints,
  };
}

function buildState(env: ViewportEnvironment): ViewportLayoutState {
  const layoutMode = resolveViewportLayoutMode(env);
  return {
    layoutMode,
    isDesktop: layoutMode === 'desktop',
    isPortraitMobile: layoutMode === 'mobile-portrait',
    isLandscapeMobile: layoutMode === 'mobile-landscape',
    showTouchControls: shouldShowTouchControls(env, layoutMode),
    width: env.width,
    height: env.height,
  };
}

/**
 * 현재 화면의 데스크톱 / 모바일 세로 / 모바일 가로 모드와 터치 조작 활성화 여부를 반응형으로 제공한다.
 */
export function useViewportLayout(): ViewportLayoutState {
  const [state, setState] = useState<ViewportLayoutState>(() =>
    buildState(readViewportEnvironment())
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const update = () => {
      const next = buildState(readViewportEnvironment());
      setState((prev) =>
        prev.layoutMode === next.layoutMode &&
        prev.showTouchControls === next.showTouchControls &&
        prev.width === next.width &&
        prev.height === next.height
          ? prev
          : next
      );
    };

    const mediaQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(pointer: coarse)')
        : null;

    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    mediaQuery?.addEventListener?.('change', update);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      mediaQuery?.removeEventListener?.('change', update);
    };
  }, []);

  return state;
}
