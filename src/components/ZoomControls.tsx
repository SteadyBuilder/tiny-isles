import React from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  minZoom?: number;
  maxZoom?: number;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  minZoom = 0.5,
  maxZoom = 2.0,
}) => {
  const percentage = Math.round(zoom * 100);
  const isMin = zoom <= minZoom + 0.01;
  const isMax = zoom >= maxZoom - 0.01;
  const isDefault = Math.abs(zoom - 1.0) < 0.02;

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed z-30 flex flex-col items-center gap-1 bg-black/75 backdrop-blur-md p-1.5 rounded-2xl border border-white/15 shadow-2xl right-4 bottom-[268px] sm:bottom-[188px] select-none pointer-events-auto transition-all"
      aria-label="화면 줌 조절"
    >
      {/* Zoom In Button */}
      <button
        onClick={onZoomIn}
        disabled={isMax}
        className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 active:scale-90 text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
        title="줌인 (+ 또는 마우스 휠 업)"
        aria-label="줌인"
      >
        <ZoomIn className="w-4 h-4 text-emerald-300" />
      </button>

      {/* Percentage / Reset Button */}
      <button
        onClick={onResetZoom}
        className={`group relative min-w-[42px] px-1 py-1 rounded-lg text-center transition active:scale-95 ${
          isDefault
            ? 'bg-transparent text-white/70 hover:bg-white/10'
            : 'bg-amber-500/20 border border-amber-400/40 text-amber-300 hover:bg-amber-500/30'
        }`}
        title="기본 배율(100%)로 초기화 (0 키)"
        aria-label="배율 초기화"
      >
        <span className="text-[11px] font-black tracking-tight leading-none">
          {percentage}%
        </span>
        {!isDefault && (
          <span className="absolute -top-1 -right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
        )}
      </button>

      {/* Zoom Out Button */}
      <button
        onClick={onZoomOut}
        disabled={isMin}
        className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 active:scale-90 text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
        title="줌아웃 (- 또는 마우스 휠 다운)"
        aria-label="줌아웃"
      >
        <ZoomOut className="w-4 h-4 text-emerald-300" />
      </button>
    </div>
  );
};
