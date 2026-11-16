import React from 'react';
import { Target, Clock, Pause } from 'lucide-react';
import { MissionProgressState, RoomMode } from '../types/room';

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
      <div className="flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-slate-950/85 border border-emerald-500/40 shadow-xl backdrop-blur-sm text-white">
        <div className="flex items-center gap-1.5 text-emerald-300">
          <Target className="w-4 h-4 shrink-0" />
          <div className="text-xs font-bold leading-tight">
            <div className="text-amber-300">{progress.title}</div>
            <div className="text-[11px] text-slate-200">
              {progress.goalLabel}: {progress.currentCount}/{progress.targetCount} ({pct}%)
            </div>
          </div>
        </div>

        <div className="h-6 w-px bg-white/15" />

        <div className="flex items-center gap-1 text-xs font-mono font-bold text-slate-200">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{formatClock(remainingSec)}</span>
        </div>

        {roomMode === 'solo' && onTogglePause && (
          <button
            type="button"
            onClick={onTogglePause}
            title="일시정지 (ESC)"
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition"
          >
            <Pause className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
