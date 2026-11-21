import React from 'react';
import { useViewportLayout } from '../hooks/useViewportLayout';
import { MissionProgressState, RoomMode } from '../types/room';
import { PixelRoundButton } from './ui/PixelRoundButton';
import { formatHudSeconds } from './hud/hudUtils';

export interface MissionHudBannerProps {
  progress: MissionProgressState | null;
  roomMode: RoomMode;
  onTogglePause?: () => void;
  variant?: 'desktop-floating' | 'mobile-inline';
}

function getMissionMetrics(progress: MissionProgressState): {
  remainingSec: number;
  pct: number;
} {
  const remainingSec =
    progress.timeLimitSec !== null
      ? Math.max(0, progress.timeLimitSec - progress.elapsedSec)
      : progress.elapsedSec;
  const pct = Math.min(
    100,
    Math.round((progress.currentCount / Math.max(1, progress.targetCount)) * 100)
  );
  return { remainingSec, pct };
}

export const MissionHudBanner: React.FC<MissionHudBannerProps> = ({
  progress,
  roomMode,
  onTogglePause,
  variant = 'desktop-floating',
}) => {
  const { isDesktop } = useViewportLayout();

  if (!progress) return null;

  const { remainingSec, pct } = getMissionMetrics(progress);

  if (variant === 'mobile-inline') {
    return (
      <div className="ts-wood-bar-compact w-full flex items-center justify-between gap-1.5 text-[#fef5df] pointer-events-auto">
        <div className="flex items-center gap-1 min-w-0">
          <img src="/assets/ui/Icons/Icon_05.png" alt="" className="w-3.5 h-3.5 pixel-art shrink-0" />
          <span className="text-[10px] font-black text-[#fde68a] pixel-btn-shadow truncate">
            {progress.title}
          </span>
          <span className="text-[10px] font-extrabold text-[#fef5df] pixel-btn-shadow shrink-0 tabular-nums">
            · {progress.currentCount}/{progress.targetCount} ({pct}%)
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center gap-1 px-1 py-0 rounded bg-[#24160e]/85 border border-[#85532a] text-[10px] font-mono font-black text-[#fef3c7] tabular-nums">
            <img src="/assets/ui/Icons/Icon_Clock.png" alt="" className="w-2.5 h-2.5 pixel-art shrink-0" />
            <span>{formatHudSeconds(remainingSec)}</span>
          </div>

          {roomMode === 'solo' && onTogglePause && (
            <PixelRoundButton
              size="xs"
              variant="blue"
              label="II"
              alt="일시정지"
              title="일시정지 (ESC)"
              onClick={onTogglePause}
            />
          )}
        </div>
      </div>
    );
  }

  if (!isDesktop) return null;

  return (
    <div className="fixed top-[6.25rem] left-3 z-30 pointer-events-auto">
      <div className="ts-wood-bar-tight flex items-center gap-2.5 text-[#fef5df]">
        <img src="/assets/ui/Icons/Icon_05.png" alt="" className="w-5 h-5 pixel-art shrink-0" />
        <div className="text-xs font-bold leading-tight">
          <div className="text-[#fde68a] font-black pixel-btn-shadow">{progress.title}</div>
          <div className="text-[11px] text-[#f3e4c7] pixel-btn-shadow">
            {progress.goalLabel}: {progress.currentCount}/{progress.targetCount} ({pct}%)
          </div>
        </div>

        <div className="h-6 w-px bg-[#85532a]" />

        <div className="wood-hud-slot px-2 py-1 rounded-lg flex items-center gap-1.5 text-xs font-mono font-black text-[#fef3c7] tabular-nums">
          <img src="/assets/ui/Icons/Icon_Clock.png" alt="" className="w-3.5 h-3.5 pixel-art" />
          <span>{formatHudSeconds(remainingSec)}</span>
        </div>

        {roomMode === 'solo' && onTogglePause && (
          <PixelRoundButton
            size="sm"
            variant="blue"
            label="II"
            alt="일시정지"
            title="일시정지 (ESC)"
            onClick={onTogglePause}
          />
        )}
      </div>
    </div>
  );
};
