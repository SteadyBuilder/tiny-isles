import { useCallback, useEffect, useRef, useState } from 'react';
import { MINIMAP_CONFIG } from '../data/minimapConfig';
import { GameEvents } from '../game/events/gameEvents';
import { hasBlockingModifier, isEditableDomTarget } from '../game/utils/keyboardInputUtils';
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

function computeExpandedCanvasSize(viewportW: number, viewportH: number): number {
  const isMobile = viewportW < MINIMAP_CONFIG.mobileBreakpointPx;
  const maxCap = isMobile
    ? MINIMAP_CONFIG.expandedMaxCanvasSizeMobile
    : MINIMAP_CONFIG.expandedMaxCanvasSizeDesktop;
  const maxByWidth = Math.floor(viewportW - (isMobile ? 56 : 96));
  const maxByHeight = Math.floor(viewportH - (isMobile ? 210 : 220));
  return Math.max(200, Math.min(maxCap, maxByWidth, maxByHeight));
}

/**
 * 실시간 미니맵 이벤트 구독, 오프스크린 지형 캐시, 반응형 접기/펼치기 및 확장 모달 캔버스 드로우를 관리하는 훅.
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
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [expandedCanvasSize, setExpandedCanvasSize] = useState<number>(() =>
    typeof window !== 'undefined'
      ? computeExpandedCanvasSize(window.innerWidth, window.innerHeight)
      : MINIMAP_CONFIG.expandedMaxCanvasSizeDesktop
  );
  const [viewMode, setViewMode] = useState<MinimapViewMode>('world');
  const [teammateCount, setTeammateCount] = useState<number>(0);

  const userToggledCollapseRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const expandedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bakedTerrainRef = useRef<BakedMinimapTerrain | null>(null);
  const latestSnapshotRef = useRef<MinimapDynamicSnapshot | null>(null);
  const territoriesRef = useRef<Island[]>(territories);
  const unlockedIdsRef = useRef<number[]>(unlockedIslandIds);
  const viewModeRef = useRef<MinimapViewMode>(viewMode);
  const isCollapsedRef = useRef<boolean>(isCollapsed);
  const isExpandedRef = useRef<boolean>(isExpanded);
  const canvasSize = isMobile ? MINIMAP_CONFIG.mobileCanvasSize : MINIMAP_CONFIG.desktopCanvasSize;
  const canvasSizeRef = useRef<number>(canvasSize);
  const expandedSizeRef = useRef<number>(expandedCanvasSize);

  territoriesRef.current = territories;
  unlockedIdsRef.current = unlockedIslandIds;
  viewModeRef.current = viewMode;
  isCollapsedRef.current = isCollapsed;
  isExpandedRef.current = isExpanded;
  canvasSizeRef.current = canvasSize;
  expandedSizeRef.current = expandedCanvasSize;

  const paintToCanvas = useCallback((canvas: HTMLCanvasElement | null, logicalSize: number) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;
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

  const drawNow = useCallback(() => {
    if (!isCollapsedRef.current) {
      paintToCanvas(canvasRef.current, canvasSizeRef.current);
    }
    if (isExpandedRef.current) {
      paintToCanvas(expandedCanvasRef.current, expandedSizeRef.current);
    }
  }, [paintToCanvas]);

  // 반응형 리사이즈 및 모바일 저높이 가로모드 자동 접힘 감지
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setIsMobile(w < MINIMAP_CONFIG.mobileBreakpointPx);
      setExpandedCanvasSize(computeExpandedCanvasSize(w, h));
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

  // 키보드 M 단축키로 확장 실시간 미니맵 토글
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (isEditableDomTarget(e.target) || isEditableDomTarget(document.activeElement)) return;
      if (hasBlockingModifier(e)) return;
      if (e.code === 'KeyM' || e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setIsExpanded((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

  // 영지/해금 상태, 뷰 모드, 접힘/확장 전환, 크기 변경 시 즉시 재그리기
  useEffect(() => {
    drawNow();
  }, [
    territories,
    unlockedIslandIds,
    viewMode,
    isCollapsed,
    isExpanded,
    canvasSize,
    expandedCanvasSize,
    drawNow,
  ]);

  const toggleCollapsed = useCallback(() => {
    userToggledCollapseRef.current = true;
    setIsCollapsed((prev) => !prev);
  }, []);

  const openExpanded = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const closeExpanded = useCallback(() => {
    setIsExpanded(false);
  }, []);

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === 'world' ? 'radar' : 'world'));
  }, []);

  return {
    canvasRef,
    expandedCanvasRef,
    canvasSize,
    expandedCanvasSize,
    isMobile,
    isCollapsed,
    isExpanded,
    viewMode,
    teammateCount,
    toggleCollapsed,
    openExpanded,
    closeExpanded,
    toggleViewMode,
  };
}
