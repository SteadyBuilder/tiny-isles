import React, { useMemo } from 'react';
import {
  clampLoadingPercent,
  getLoadingStageLabel,
  LOADING_BANNER_SRC,
  LOADING_TIPS,
} from '../../data/loadingConfig';

export interface GameLoadingOverlayProps {
  percent: number;
}

export const GameLoadingOverlay: React.FC<GameLoadingOverlayProps> = ({ percent }) => {
  const displayPercent = clampLoadingPercent(percent);
  const stageLabel = getLoadingStageLabel(displayPercent);

  const tipText = useMemo(() => {
    const index = Math.floor(Math.random() * LOADING_TIPS.length);
    return LOADING_TIPS[index];
  }, []);

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0f2537] px-4 py-6 text-white select-none"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={displayPercent}
      aria-label="게임 월드 로딩 진행률"
    >
      <div className="w-full max-w-lg flex flex-col items-center gap-4">
        {/* Framed Pixel Art Loading Illustration */}
        <div className="ts-wood-frame w-full overflow-hidden bg-[#1e3d59]">
          <div className="relative w-full aspect-video overflow-hidden rounded-sm bg-[#1e3d59]">
            <img
              src={LOADING_BANNER_SRC}
              alt="Tiny Isles 게임 로딩 일러스트"
              className="w-full h-full object-cover"
              draggable={false}
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#100904]/85 via-[#100904]/35 to-transparent px-4 py-2.5 flex items-end justify-between">
              <span className="font-pixel-display text-lg sm:text-xl font-bold tracking-wider text-[#fde68a] pixel-title-outline leading-none">
                TINY ISLES
              </span>
              <span className="text-[11px] sm:text-xs font-bold text-[#fef5df] pixel-btn-shadow">
                실시간 섬 방어 원정
              </span>
            </div>
          </div>
        </div>

        {/* Synchronized Progress Bar & Status */}
        <div className="w-full max-w-md flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold px-0.5">
            <span className="text-[#fef5df] pixel-btn-shadow truncate pr-2">
              {stageLabel}
            </span>
            <span className="font-pixel-display text-[#fde68a] tabular-nums pixel-btn-shadow shrink-0">
              {displayPercent}%
            </span>
          </div>

          <div className="ts-bar-track w-full h-5 overflow-hidden">
            <div className="w-full h-full bg-[#24160e] rounded-[2px] overflow-hidden">
              <div
                className="h-full rounded-[2px]"
                style={{
                  width: `${displayPercent}%`,
                  background:
                    'linear-gradient(90deg, #10b981 0%, #34d399 60%, #fde047 100%)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Gameplay Tip */}
        <p className="max-w-md text-center text-[11px] sm:text-xs text-[#cbd5e1] leading-relaxed px-2">
          <span className="text-[#fde68a] font-bold mr-1.5">TIP</span>
          {tipText}
        </p>
      </div>
    </div>
  );
};
