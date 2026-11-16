import React from 'react';
import { MissionProgressState, RoomMode } from '../types/room';
import { PixelRoundButton } from './ui/PixelRoundButton';

interface MissionHudBannerProps {
  progress: MissionProgressState | null;
  roomMode: RoomMode;
  onTogglePause?: () => void;
}

function formatClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const MissionHudBanner: React.FC<MissionHudBannerProps> = ({
  progress,
  roomMode,
  onTogglePause,
}) => {
  if (!progress) return null;

  const remainingSec =
    progress.timeLimitSec !== null
      ? Math.max(0, progress.timeLimitSec - progress.elapsedSec)
      : progress.elapsedSec;
  const pct = Math.min(
    100,
    Math.round((progress.currentCount / Math.max(1, progress.targetCount)) * 100)
  );

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 sm:bottom-auto sm:top-16 sm:left-4 sm:translate-x-0 z-30 pointer-events-auto">
      <div className="wood-hud-panel flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#fef5df]">
        <img src="/assets/ui/Icons/Icon_05.png" alt="" className="w-5 h-5 pixel-art shrink-0" />
        <div className="text-xs font-bold leading-tight">
          <div className="text-[#fde68a] font-black">{progress.title}</div>
          <div className="text-[11px] text-[#f3e4c7]">
            {progress.goalLabel}: {progress.currentCount}/{progress.targetCount} ({pct}%)
          </div>
        </div>

        <div className="h-6 w-px bg-[#85532a]" />

        <div className="wood-hud-slot px-2 py-1 rounded-lg text-xs font-mono font-black text-[#fef3c7] tabular-nums">
          {formatClock(remainingSec)}
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
