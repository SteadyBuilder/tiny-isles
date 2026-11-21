import React from 'react';
import { Maximize2, Minimize2, Radar, Globe, Users } from 'lucide-react';
import { HUD_STATUS_ICONS } from '../../data/hudIcons';
import { useMinimapState } from '../../hooks/useMinimapState';
import { useViewportLayout } from '../../hooks/useViewportLayout';
import { sound } from '../../lib/sound';
import { GESTURE_BLOCK_PROPS } from '../../lib/touchGestureGuard';
import { Island } from '../../types/game';
import { ExpandedMinimapModal } from './ExpandedMinimapModal';

export interface LiveMinimapWidgetProps {
  territories: Island[];
  unlockedIslandIds: number[];
  onOpenFullMap: () => void;
}

/**
 * 플레이 화면 우측 상단 상시 노출형 실시간 미니맵 위젯.
 * - PC: 168×168px, 전체/레이더 전환 + 실시간 미니맵 크게 확대 + 접기 + 팀원 수 배지
 * - 모바일 가로: 84×84px, 우상단 코너 밀착(M Classic 스타일) + 스프라이트 메뉴 행 우측 배치
 * - 모바일 세로: 96×96px, HudMobileBar 하단 배치
 */
export const LiveMinimapWidget: React.FC<LiveMinimapWidgetProps> = ({
  territories,
  unlockedIslandIds,
  onOpenFullMap,
}) => {
  const { isLandscapeMobile, isPortraitMobile } = useViewportLayout();
  const {
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
  } = useMinimapState({ territories, unlockedIslandIds });

  const handleOpenExpanded = () => {
    sound.playClick();
    openExpanded();
  };

  const handleToggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    sound.playClick();
    toggleCollapsed();
  };

  const handleToggleViewMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    sound.playClick();
    toggleViewMode();
  };

  const positionClass = isLandscapeMobile
    ? 'fixed z-40'
    : isPortraitMobile
      ? 'fixed right-1.5 z-40'
      : 'fixed right-3 top-[3.75rem] z-40';

  const positionStyle = isLandscapeMobile
    ? {
        top: 'max(0.3rem, env(safe-area-inset-top, 0.3rem))',
        right: 'max(0.35rem, env(safe-area-inset-right, 0.35rem))',
      }
    : isPortraitMobile
      ? { top: 'max(6.25rem, calc(env(safe-area-inset-top, 0px) + 5.9rem))' }
      : undefined;

  const btnSizeClass = isLandscapeMobile ? 'w-5 h-5' : isMobile ? 'w-6 h-6' : 'w-5 h-5';

  return (
    <>
      {isCollapsed ? (
        <div
          {...GESTURE_BLOCK_PROPS}
          className={`${positionClass} pointer-events-auto select-none touch-manipulation`}
          style={positionStyle}
        >
          <button
            id="live-minimap-expand-btn"
            type="button"
            onClick={handleToggleCollapse}
            className="wood-hud-panel flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[#fef5df] text-[11px] font-black hover:brightness-110 active:scale-95 transition shadow-xl touch-manipulation"
            title="실시간 미니맵 펼치기"
            aria-label="실시간 미니맵 펼치기"
          >
            <img src={HUD_STATUS_ICONS.compass} alt="" className="w-3.5 h-3.5 pixel-art shrink-0" />
            <span className="pixel-btn-shadow">MAP</span>
            {teammateCount > 0 && (
              <span className="inline-flex items-center gap-0.5 px-1 rounded bg-emerald-950/90 border border-emerald-400/50 text-emerald-300 text-[9px] tabular-nums">
                <Users className="w-2.5 h-2.5" />
                {teammateCount}
              </span>
            )}
          </button>
        </div>
      ) : (
        <div
          {...GESTURE_BLOCK_PROPS}
          id="live-minimap-widget"
          className={`${positionClass} pointer-events-auto select-none touch-manipulation`}
          style={positionStyle}
        >
          <div className="wood-hud-panel p-1.5 rounded-xl shadow-2xl flex flex-col gap-1">
            {/* 상단 컨트롤 헤더 */}
            <div className="flex items-center justify-between gap-1 px-0.5">
              <div className="flex items-center gap-1 min-w-0">
                <img
                  src={HUD_STATUS_ICONS.compass}
                  alt=""
                  className="w-3 h-3 pixel-art shrink-0"
                />
                {!isMobile && (
                  <span className="text-[10px] font-black text-[#fde68a] pixel-btn-shadow truncate">
                    {viewMode === 'world' ? '전체 지도' : '주변 레이더'}
                  </span>
                )}
                {teammateCount > 0 && (
                  <span
                    className="inline-flex items-center gap-0.5 px-1 py-0 rounded bg-emerald-950/85 border border-emerald-400/40 text-[9px] font-black text-emerald-300 tabular-nums shrink-0"
                    title={`미니맵에 표시 중인 협동 팀원 ${teammateCount}명`}
                  >
                    <Users className="w-2.5 h-2.5" />
                    {teammateCount}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {!isMobile && (
                  <button
                    id="live-minimap-mode-btn"
                    type="button"
                    onClick={handleToggleViewMode}
                    className={`${btnSizeClass} rounded bg-[#24160e]/85 border border-[#85532a] text-[#fde68a] hover:brightness-125 active:scale-95 flex items-center justify-center transition touch-manipulation`}
                    title={viewMode === 'world' ? '주변 레이더 모드로 전환' : '전체 월드 모드로 전환'}
                    aria-label="미니맵 뷰 모드 전환"
                  >
                    {viewMode === 'world' ? (
                      <Radar className="w-3 h-3" />
                    ) : (
                      <Globe className="w-3 h-3" />
                    )}
                  </button>
                )}

                <button
                  id="live-minimap-modal-btn"
                  type="button"
                  onClick={handleOpenExpanded}
                  className={`${btnSizeClass} rounded bg-[#24160e]/85 border border-[#85532a] text-[#fef5df] hover:brightness-125 active:scale-95 flex items-center justify-center transition touch-manipulation`}
                  title="실시간 미니맵 크게 확장 [M]"
                  aria-label="실시간 미니맵 크게 확장"
                >
                  <Maximize2 className="w-3 h-3" />
                </button>

                <button
                  id="live-minimap-collapse-btn"
                  type="button"
                  onClick={handleToggleCollapse}
                  className={`${btnSizeClass} rounded bg-[#24160e]/85 border border-[#85532a] text-[#d6b286] hover:brightness-125 active:scale-95 flex items-center justify-center transition touch-manipulation`}
                  title="미니맵 접기"
                  aria-label="미니맵 접기"
                >
                  <Minimize2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* 실시간 2D 미니맵 캔버스 (클릭/탭 시 실시간 미니맵 크게 확장) */}
            <button
              type="button"
              onClick={handleOpenExpanded}
              className="relative block rounded-lg overflow-hidden border border-[#85532a] bg-[#162c1c] cursor-pointer hover:brightness-105 active:scale-[0.99] transition focus:outline-none focus:ring-1 focus:ring-[#fde68a] touch-manipulation"
              style={{ width: canvasSize, height: canvasSize }}
              title="클릭하여 실시간 미니맵 크게 보기 [M]"
              aria-label="실시간 미니맵 (클릭 시 크게 확장)"
            >
              <canvas
                ref={canvasRef}
                style={{ width: canvasSize, height: canvasSize }}
                className="block"
              />
            </button>

            {/* PC 전용 간략 범례 */}
            {!isMobile && (
              <div className="flex items-center justify-between px-0.5 text-[9px] font-bold text-[#e7d3b3]">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#38bdf8] border border-white inline-block" />
                  나
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#22d3ee] border border-[#fef08a] inline-block" />
                  팀원
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#ef4444] border border-[#fde047] inline-block" />
                  적/보스
                </span>
                <span className="text-[#a89070] font-mono">[M]</span>
              </div>
            )}
          </div>
        </div>
      )}

      <ExpandedMinimapModal
        isOpen={isExpanded}
        onClose={closeExpanded}
        canvasRef={expandedCanvasRef}
        canvasSize={expandedCanvasSize}
        viewMode={viewMode}
        onToggleViewMode={toggleViewMode}
        teammateCount={teammateCount}
        unlockedCount={unlockedIslandIds.length}
        totalCount={territories.length}
        onOpenTerritoryMap={onOpenFullMap}
      />
    </>
  );
};
