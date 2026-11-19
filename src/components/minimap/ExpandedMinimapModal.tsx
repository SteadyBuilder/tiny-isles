import React from 'react';
import { Globe, Map as MapIcon, Radar, Users } from 'lucide-react';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { sound } from '../../lib/sound';
import { MinimapViewMode } from '../../types/minimap';
import { WoodModalFrame } from '../ui/WoodModalFrame';

export interface ExpandedMinimapModalProps {
  isOpen: boolean;
  onClose: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  canvasSize: number;
  viewMode: MinimapViewMode;
  onToggleViewMode: () => void;
  teammateCount: number;
  unlockedCount: number;
  totalCount: number;
  onOpenTerritoryMap: () => void;
}

/**
 * 실시간 미니맵을 큰 화면으로 확장해 지형·내 위치·팀원·마물·보스·부락을 정밀 확인하는 모달
 */
export const ExpandedMinimapModal: React.FC<ExpandedMinimapModalProps> = ({
  isOpen,
  onClose,
  canvasRef,
  canvasSize,
  viewMode,
  onToggleViewMode,
  teammateCount,
  unlockedCount,
  totalCount,
  onOpenTerritoryMap,
}) => {
  useEscapeToClose(isOpen, onClose);

  if (!isOpen) return null;

  const handleToggleMode = () => {
    sound.playClick();
    onToggleViewMode();
  };

  const handleSwitchToTerritoryMap = () => {
    sound.playClick();
    onClose();
    onOpenTerritoryMap();
  };

  return (
    <WoodModalFrame
      id="expanded-minimap-modal"
      title={viewMode === 'world' ? '실시간 월드 미니맵' : '실시간 주변 레이더'}
      ribbonVariant="blue"
      frameVariant="wood"
      maxWidthClass="max-w-xl"
      onClose={onClose}
      headerRight={
        <div className="flex items-center gap-1.5">
          {teammateCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-950/90 border border-emerald-400/50 text-[11px] font-black text-emerald-300 tabular-nums">
              <Users className="w-3.5 h-3.5" />
              <span>팀원 {teammateCount}</span>
            </span>
          )}
          <button
            type="button"
            onClick={handleToggleMode}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#29150b]/90 border border-[#b89568] text-[11px] font-black text-[#fde68a] hover:brightness-115 active:scale-95 transition"
            title={viewMode === 'world' ? '주변 레이더 모드로 전환' : '전체 월드 모드로 전환'}
          >
            {viewMode === 'world' ? <Radar className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
            <span>{viewMode === 'world' ? '레이더' : '전체'}</span>
          </button>
          <button
            type="button"
            onClick={handleSwitchToTerritoryMap}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#1e3a8a]/90 border border-[#60a5fa] text-[11px] font-black text-[#dbeafe] hover:brightness-115 active:scale-95 transition tabular-nums"
            title="5×5 영지 전략 지도(점령·건설 관리) 열기"
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>
              영지 {unlockedCount}/{totalCount}
            </span>
          </button>
        </div>
      }
    >
      {/* 확장 실시간 미니맵 캔버스 */}
      <div className="ts-paper-sheet p-2 flex justify-center items-center">
        <div
          className="rounded-lg overflow-hidden border-2 border-[#5c3d22] bg-[#162c1c] shadow-inner"
          style={{ width: canvasSize, height: canvasSize }}
        >
          <canvas
            ref={canvasRef}
            style={{ width: canvasSize, height: canvasSize }}
            className="block"
          />
        </div>
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-2 py-1.5 rounded-lg bg-[#24160e]/85 border border-[#85532a]/70 text-[11px] font-bold text-[#f3e4c7]">
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8] border border-white inline-block" />
          나
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-[#22d3ee] border border-[#fef08a] inline-block" />
          팀원
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-[#fb923c] inline-block" />
          침공 마물
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] border border-[#fde047] inline-block" />
          보스
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#dc2626]/60 border border-[#f87171] inline-block" />
          몬스터 부락
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-[#a855f7] border border-[#e9d5ff] inline-block" />
          던전 포탈
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#22c55e]/45 border border-[#4ade80] inline-block" />
          점령 영지
        </span>
      </div>
    </WoodModalFrame>
  );
};
