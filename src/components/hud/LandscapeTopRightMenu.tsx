import React from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { HUD_ACTION_SPRITES, HUD_STATUS_ICONS } from '../../data/hudIcons';
import { GameEvents } from '../../game/events/gameEvents';
import { PlayerProgressionState } from '../../types/game';
import { MissionProgressState } from '../../types/room';
import { formatHudSeconds } from './hudUtils';

export interface LandscapeTopRightMenuProps {
  progression?: PlayerProgressionState;
  hasJobHallBuilt: boolean;
  isNearJobHall: boolean;
  hasToolShopBuilt: boolean;
  isNearToolShop: boolean;
  isMenuOpen: boolean;
  isMissionCollapsed: boolean;
  missionProgress: MissionProgressState | null;
  onToggleMenu: () => void;
  onToggleMissionCollapsed: () => void;
  onOpenInventory?: () => void;
  onOpenToolShop?: () => void;
  onOpenJobHall?: () => void;
}

/**
 * 모바일 가로모드 우상단(미니맵 좌측) 원형 스프라이트 버튼 행과 미니맵 하단 접이식 미션 트래커.
 */
export const LandscapeTopRightMenu: React.FC<LandscapeTopRightMenuProps> = ({
  progression,
  hasJobHallBuilt,
  isNearJobHall,
  hasToolShopBuilt,
  isNearToolShop,
  isMenuOpen,
  isMissionCollapsed,
  missionProgress,
  onToggleMenu,
  onToggleMissionCollapsed,
  onOpenInventory,
  onOpenToolShop,
  onOpenJobHall,
}) => {
  const canEnterToolShop = hasToolShopBuilt && isNearToolShop;
  const canEnterJobHall = hasJobHallBuilt && isNearJobHall;

  const handleToolShopPress = () => {
    if (!hasToolShopBuilt) {
      GameEvents.emit(
        'game-alert',
        '🏗️ 먼저 영지 [건설]에서 [도구 상점]을 지은 뒤 상점 앞으로 이동하세요!'
      );
      return;
    }
    if (!isNearToolShop) {
      GameEvents.emit('game-alert', '🚶 [도구 상점] 건물 앞으로 이동해야 이용할 수 있습니다!');
      return;
    }
    onOpenToolShop?.();
  };

  const handleJobHallPress = () => {
    if (!hasJobHallBuilt) {
      GameEvents.emit(
        'game-alert',
        '🏗️ 먼저 중앙 마을 [건설]에서 [왕국 전직소]를 지은 뒤 이동하세요!'
      );
      return;
    }
    if (!isNearJobHall) {
      GameEvents.emit('game-alert', '🚶 [왕국 전직소] 건물 앞으로 이동해야 전직할 수 있습니다!');
      return;
    }
    onOpenJobHall?.();
  };

  const missionRemainingSec = missionProgress
    ? missionProgress.timeLimitSec !== null
      ? Math.max(0, missionProgress.timeLimitSec - missionProgress.elapsedSec)
      : missionProgress.elapsedSec
    : 0;
  const missionPct = missionProgress
    ? Math.min(
        100,
        Math.round((missionProgress.currentCount / Math.max(1, missionProgress.targetCount)) * 100)
      )
    : 0;

  return (
    <>
      {/* TOP-RIGHT (Left of Minimap): Circular Sprite Button Row */}
      <div
        className="absolute flex items-start gap-1.5 pointer-events-auto"
        style={{
          top: 'max(0.3rem, env(safe-area-inset-top, 0.3rem))',
          right: 'max(6.75rem, calc(env(safe-area-inset-right, 0px) + 6.5rem))',
        }}
      >
        {progression && onOpenInventory && (
          <button
            id="landscape-bag-btn"
            type="button"
            onClick={onOpenInventory}
            className="group flex flex-col items-center gap-0.5 active:scale-95 transition"
            aria-label="가방 열기"
            title="가방 및 장비"
          >
            <span className="relative w-9 h-9 rounded-full border-2 border-[#d97706] bg-[#2a190e]/90 shadow-[0_3px_8px_rgba(0,0,0,0.75)] flex items-center justify-center group-hover:brightness-110">
              <img
                src={HUD_ACTION_SPRITES.bag}
                alt="가방"
                className="w-5 h-5 pixel-art object-contain drop-shadow"
              />
              <span className="absolute -top-1 -right-1 min-w-[16px] px-1 rounded-full bg-[#b45309] border border-[#fde68a] text-[8px] font-black text-[#fef3c7] tabular-nums leading-tight text-center">
                {progression.bagItems.length}
              </span>
            </span>
            <span className="text-[9px] font-black text-[#fef3c7] pixel-btn-shadow leading-none">
              가방
            </span>
          </button>
        )}

        {onOpenToolShop && (
          <button
            id="landscape-shop-btn"
            type="button"
            onClick={handleToolShopPress}
            className="group flex flex-col items-center gap-0.5 active:scale-95 transition"
            aria-label="도구 상점"
            title={canEnterToolShop ? '도구 상점 입장' : '도구 상점 앞에서 이용 가능'}
          >
            <span
              className={`relative w-9 h-9 rounded-full border-2 shadow-[0_3px_8px_rgba(0,0,0,0.75)] flex items-center justify-center transition ${
                canEnterToolShop
                  ? 'border-[#34d399] bg-[#064e3b]/92 ring-2 ring-emerald-400/40'
                  : 'border-[#6b472a] bg-[#221710]/85 opacity-80'
              }`}
            >
              <img
                src={HUD_ACTION_SPRITES.shop}
                alt="상점"
                className={`w-5 h-5 pixel-art object-contain drop-shadow ${
                  canEnterToolShop ? '' : 'opacity-70'
                }`}
              />
            </span>
            <span className="text-[9px] font-black text-[#fef3c7] pixel-btn-shadow leading-none">
              상점
            </span>
          </button>
        )}

        {progression && onOpenJobHall && (
          <button
            id="landscape-job-btn"
            type="button"
            onClick={handleJobHallPress}
            className="group flex flex-col items-center gap-0.5 active:scale-95 transition"
            aria-label="왕국 전직소"
            title={canEnterJobHall ? '왕국 전직소 입장' : '전직소 앞에서 이용 가능'}
          >
            <span
              className={`relative w-9 h-9 rounded-full border-2 shadow-[0_3px_8px_rgba(0,0,0,0.75)] flex items-center justify-center transition ${
                canEnterJobHall && progression.jobPoints > 0 && progression.classId === 'pawn'
                  ? 'border-[#c084fc] bg-[#581c87]/92 animate-pulse'
                  : canEnterJobHall
                    ? 'border-[#fde047] bg-[#3b2313]/92'
                    : 'border-[#6b472a] bg-[#221710]/85 opacity-80'
              }`}
            >
              <img
                src={HUD_ACTION_SPRITES.jobHall}
                alt="전직"
                className={`w-5 h-5 pixel-art object-contain drop-shadow ${
                  canEnterJobHall ? '' : 'opacity-70'
                }`}
              />
              {progression.jobPoints > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] px-1 rounded-full bg-[#a855f7] border border-[#f3e8ff] text-[8px] font-black text-white leading-tight text-center">
                  +{progression.jobPoints}
                </span>
              )}
            </span>
            <span className="text-[9px] font-black text-[#fef3c7] pixel-btn-shadow leading-none">
              전직
            </span>
          </button>
        )}

        <button
          id="landscape-more-menu-btn"
          type="button"
          onClick={onToggleMenu}
          className="group flex flex-col items-center gap-0.5 active:scale-95 transition"
          aria-label="추가 메뉴 열기"
          title="메뉴 (사운드 · 초대 · 영지 지도 · 설정)"
        >
          <span
            className={`relative w-9 h-9 rounded-full border-2 shadow-[0_3px_8px_rgba(0,0,0,0.75)] flex items-center justify-center transition ${
              isMenuOpen
                ? 'border-[#fde68a] bg-[#1d4ed8]/95 text-[#fef3c7] rotate-45'
                : 'border-[#93c5fd]/80 bg-[#1e3a8a]/90 text-[#fef3c7]'
            }`}
          >
            <Plus className="w-5 h-5 stroke-[2.75]" />
          </span>
          <span className="text-[9px] font-black text-[#fef3c7] pixel-btn-shadow leading-none">
            메뉴
          </span>
        </button>
      </div>

      {/* RIGHT-EDGE (Below Minimap): Collapsible Slim Mission Tracker */}
      {missionProgress && (
        <div
          className="absolute flex items-center pointer-events-auto"
          style={{
            top: 'max(7.1rem, calc(env(safe-area-inset-top, 0px) + 6.9rem))',
            right: 'max(0.35rem, env(safe-area-inset-right, 0.35rem))',
          }}
        >
          {isMissionCollapsed ? (
            <button
              type="button"
              onClick={onToggleMissionCollapsed}
              className="flex items-center gap-0.5 px-1.5 py-1 rounded-l-lg bg-[#1d130d]/90 border border-r-0 border-[#c08a4b]/75 text-[#fde68a] text-[10px] font-black shadow-lg active:scale-95"
              title="미션 펼치기"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <img src="/assets/ui/Icons/Icon_05.png" alt="" className="w-3 h-3 pixel-art" />
            </button>
          ) : (
            <div className="flex items-stretch rounded-lg bg-[#1a120c]/88 border border-[#c08a4b]/75 shadow-lg backdrop-blur-sm overflow-hidden max-w-[162px]">
              <div className="px-2 py-1 flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-1">
                  <img
                    src="/assets/ui/Icons/Icon_05.png"
                    alt=""
                    className="w-3 h-3 pixel-art shrink-0"
                  />
                  <span className="text-[10px] font-black text-[#fde68a] truncate pixel-btn-shadow">
                    {missionProgress.title}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1.5 text-[9px] font-bold text-[#fef5df] tabular-nums">
                  <span>
                    {missionProgress.currentCount}/{missionProgress.targetCount} ({missionPct}%)
                  </span>
                  <span className="flex items-center gap-0.5 text-[#fcd34d] font-mono">
                    <img
                      src={HUD_STATUS_ICONS.clock}
                      alt=""
                      className="w-2.5 h-2.5 pixel-art shrink-0"
                    />
                    {formatHudSeconds(missionRemainingSec)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleMissionCollapsed}
                className="px-1 bg-[#2c1c12]/90 border-l border-[#85532a]/60 text-[#fde68a] flex items-center justify-center hover:bg-[#3a2518] active:scale-95"
                title="미션 접기"
                aria-label="미션 접기"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};
