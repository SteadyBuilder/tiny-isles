import { useCallback, useEffect, useRef, useState } from 'react';
import { MINIMAP_CONFIG } from '../data/minimapConfig';
import { GameEvents } from '../game/events/gameEvents';
import { shouldAutoCollapseMinimap } from '../game/utils/minimapProjectionUtils';
import { Island } from '../types/game';
import {
  MinimapDynamicSnapshot,
  MinimapTerrainBakePayload,
  MinimapViewMode,
} from '../types/minimap';
import {
  BakedMinimapTerrain,
  bakeTerrainToOffscreenCanvas,
  renderMinimapFrame,
} from '../components/minimap/minimapCanvasPainter';

interface UseMinimapStateParams {
  territories: Island[];
  unlockedIslandIds: number[];
}

/**
 * 실시간 미니맵 이벤트 구독, 오프스크린 지형 캐시, 반응형 접기/펼치기, 캔버스 직접 드로우를 관리하는 훅.
 * 스냅샷은 useRef로 관리해 10Hz 갱신 시 React 리렌더링 오버헤드를 발생시키지 않는다.
 */
export function useMinimapState({ territories, unlockedIslandIds }: UseMinimapStateParams) {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < MINIMAP_CONFIG.mobileBreakpointPx : false
  );
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return shouldAutoCollapseMinimap(
      window.innerWidth,
      window.innerHeight,
      MINIMAP_CONFIG.mobileBreakpointPx,
      MINIMAP_CONFIG.compactLandscapeMaxHeightPx
    );
  });
  const [viewMode, setViewMode] = useState<MinimapViewMode>('world');
  const [teammateCount, setTeammateCount] = useState<number>(0);

  const userToggledCollapseRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bakedTerrainRef = useRef<BakedMinimapTerrain | null>(null);
  const latestSnapshotRef = useRef<MinimapDynamicSnapshot | null>(null);
  const territoriesRef = useRef<Island[]>(territories);
  const unlockedIdsRef = useRef<number[]>(unlockedIslandIds);
  const viewModeRef = useRef<MinimapViewMode>(viewMode);
  const canvasSizeRef = useRef<number>(
    isMobile ? MINIMAP_CONFIG.mobileCanvasSize : MINIMAP_CONFIG.desktopCanvasSize
  );

  territoriesRef.current = territories;
  unlockedIdsRef.current = unlockedIslandIds;
  viewModeRef.current = viewMode;
  const canvasSize = isMobile ? MINIMAP_CONFIG.mobileCanvasSize : MINIMAP_CONFIG.desktopCanvasSize;
  canvasSizeRef.current = canvasSize;

  const drawNow = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;
    const logicalSize = canvasSizeRef.current;
    const targetPx = Math.round(logicalSize * dpr);
    if (canvas.width !== targetPx || canvas.height !== targetPx) {
      canvas.width = targetPx;
      canvas.height = targetPx;
    }

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderMinimapFrame(
      ctx,
      bakedTerrainRef.current,
      territoriesRef.current,
      unlockedIdsRef.current,
      latestSnapshotRef.current,
      viewModeRef.current,
      logicalSize,
      performance.now()
    );
    ctx.restore();
  }, []);

  // 반응형 리사이즈 및 모바일 저높이 가로모드 자동 접힘 감지
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setIsMobile(w < MINIMAP_CONFIG.mobileBreakpointPx);
      if (!userToggledCollapseRef.current) {
        setIsCollapsed(
          shouldAutoCollapseMinimap(
            w,
            h,
            MINIMAP_CONFIG.mobileBreakpointPx,
            MINIMAP_CONFIG.compactLandscapeMaxHeightPx
          )
        );
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // GameEvents 구독 (지형 베이크 1회 + 실시간 스냅샷)
  useEffect(() => {
    const handleTerrainReady = (payload: MinimapTerrainBakePayload) => {
      bakedTerrainRef.current = bakeTerrainToOffscreenCanvas(payload);
      drawNow();
    };
    const handleSnapshot = (snapshot: MinimapDynamicSnapshot) => {
      latestSnapshotRef.current = snapshot;
      setTeammateCount((prev) =>
        prev === snapshot.teammates.length ? prev : snapshot.teammates.length
      );
      drawNow();
    };

    GameEvents.on('minimap-terrain-ready', handleTerrainReady);
    GameEvents.on('minimap-snapshot', handleSnapshot);
    return () => {
      GameEvents.off('minimap-terrain-ready', handleTerrainReady);
      GameEvents.off('minimap-snapshot', handleSnapshot);
    };
  }, [drawNow]);

  // 영지/해금 상태, 뷰 모드, 접힘 해제, 크기 변경 시 즉시 재그리기
  useEffect(() => {
    if (!isCollapsed) {
      drawNow();
    }
  }, [territories, unlockedIslandIds, viewMode, isCollapsed, canvasSize, drawNow]);

  const toggleCollapsed = useCallback(() => {
    userToggledCollapseRef.current = true;
    setIsCollapsed((prev) => !prev);
  }, []);

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === 'world' ? 'radar' : 'world'));
  }, []);

  return {
    canvasRef,
    canvasSize,
    isMobile,
    isCollapsed,
    viewMode,
    teammateCount,
    toggleCollapsed,
    toggleViewMode,
  };
}
