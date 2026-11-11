import React from 'react';
import { Inventory, DefenseSession } from '../types/game';
import { Gem, Heart, Skull, Zap, Map, Hammer, AlertTriangle } from 'lucide-react';

interface DefenseHUDProps {
  inventory: Inventory;
  session: DefenseSession;
  capitalCoreHp: number;
  maxCapitalCoreHp: number;
  playerHp: number;
  maxPlayerHp: number;
  onCallWaveEarly: () => void;
  onOpenMinimap: () => void;
  onToggleBuildHotbar: () => void;
  isBuildHotbarOpen: boolean;
  incomingMonsterCount: number;
  warningDirection?: 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW' | null;
}

export const DefenseHUD: React.FC<DefenseHUDProps> = ({
  inventory,
  session,
  capitalCoreHp,
  maxCapitalCoreHp,
  playerHp,
  maxPlayerHp,
  onCallWaveEarly,
  onOpenMinimap,
  onToggleBuildHotbar,
  isBuildHotbarOpen,
  incomingMonsterCount,
  warningDirection,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const corePercent = Math.max(0, Math.min(100, Math.round((capitalCoreHp / maxCapitalCoreHp) * 100)));
  const playerPercent = Math.max(0, Math.min(100, Math.round((playerHp / maxPlayerHp) * 100)));

  return (
    <div className="fixed top-0 left-0 right-0 pointer-events-none select-none z-20 flex flex-col items-center p-1 sm:p-2.5 font-sans safe-top">
      {/* ──────────────────────────────────────────────────────────── */}
      {/* 초슬림 컴팩트 상단 게임 바 (높이 36px, 한 줄 플랫 HUD) */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="pointer-events-auto flex items-center justify-between w-full max-w-4xl px-2.5 py-1.5 rounded-full bg-slate-950/85 backdrop-blur-md border border-slate-700/60 shadow-lg text-xs gap-1 sm:gap-3">
        {/* 1. 좌측: 코어 게이지 & 플레이어 체력 */}
        <div className="flex items-center gap-2 whitespace-nowrap">
          {/* 수도 코어 HP 바 */}
          <div className="flex items-center gap-1 bg-slate-900/90 px-2 py-0.5 rounded-full border border-cyan-500/30" title="수도 코어 보석 체력">
            <Gem className="w-3.5 h-3.5 text-cyan-400 animate-pulse shrink-0" />
            <div className="w-14 sm:w-20 h-2 bg-slate-950 rounded-full overflow-hidden border border-cyan-900">
              <div
                className={`h-full transition-all duration-300 ${
                  corePercent > 35 ? 'bg-cyan-400' : 'bg-red-500 animate-pulse'
                }`}
                style={{ width: `${corePercent}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-cyan-200 font-bold hidden sm:inline">
              {capitalCoreHp}
            </span>
          </div>

          {/* 플레이어 체력 */}
          <div className="flex items-center gap-1 bg-slate-900/90 px-2 py-0.5 rounded-full border border-rose-500/30" title="플레이어 체력">
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 shrink-0" />
            <div className="w-10 sm:w-16 h-2 bg-slate-950 rounded-full overflow-hidden border border-rose-900">
              <div
                className="h-full bg-rose-500 transition-all duration-200"
                style={{ width: `${playerPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* 2. 중앙: 세션 타이머 & 웨이브 카운트다운 */}
        <div className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap bg-slate-900/90 px-2.5 py-0.5 rounded-full border border-amber-500/30">
          <span className="text-[11px] font-mono font-bold text-slate-200">
            {formatTime(session.elapsedSeconds)}
          </span>

          <span className="text-slate-600 text-[10px]">|</span>

          {session.waveIncoming ? (
            <span className="flex items-center gap-1 text-[11px] font-black text-rose-400 animate-pulse">
              <Skull className="w-3.5 h-3.5 shrink-0" />
              <span>침공 중! ({incomingMonsterCount})</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-mono text-amber-300">
              <Skull className="w-3 h-3 text-slate-400 shrink-0" />
              <span>W{session.waveIndex + 1}: {Math.max(0, Math.ceil(session.timeToNextWave))}초</span>
            </span>
          )}

          {!session.waveIncoming && (
            <button
              onClick={onCallWaveEarly}
              className="ml-1 p-0.5 px-1.5 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 text-[10px] font-black rounded-md border border-amber-400/40 active:scale-90 transition-all flex items-center gap-0.5"
              title="다음 웨이브 즉시 소환"
            >
              <Zap className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
              소환
            </button>
          )}
        </div>

        {/* 3. 우측: 자원 & 미니맵 & 건축 버튼 */}
        <div className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap">
          {/* 자원 바 */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 font-mono text-[11px] font-bold text-slate-200 bg-slate-900/90 px-2 py-0.5 rounded-full border border-slate-700/60">
            <span className="flex items-center gap-0.5 text-amber-300">🪵{inventory.wood}</span>
            <span className="flex items-center gap-0.5 text-stone-300">🪨{inventory.stone}</span>
            <span className="flex items-center gap-0.5 text-yellow-400">🪙{inventory.gold}</span>
          </div>

          {/* 건축 버튼 */}
          <button
            onClick={onToggleBuildHotbar}
            className={`p-1.5 rounded-full border transition-all active:scale-90 ${
              isBuildHotbarOpen
                ? 'bg-amber-500 text-slate-950 border-amber-300'
                : 'bg-slate-900 text-amber-400 border-amber-500/40'
            }`}
            title="건축 모드 토글"
          >
            <Hammer className="w-3.5 h-3.5" />
          </button>

          {/* 미니맵 토글 버튼 */}
          <button
            onClick={onOpenMinimap}
            className="p-1.5 rounded-full bg-slate-900 border border-slate-700 text-indigo-300 active:scale-90 hover:text-white"
            title="전체 지도 보기"
          >
            <Map className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 오프스크린 침공 경고 배너 (마물 침공 시 상단에 컴팩트하게 노출) */}
      {warningDirection && session.waveIncoming && (
        <div className="mt-1 flex items-center gap-1.5 bg-red-600/90 text-white font-bold text-[11px] px-3 py-1 rounded-full shadow-lg border border-red-300 animate-pulse">
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-300 animate-bounce" />
          <span>외곽 {warningDirection} 방향에서 마물 침공 중!</span>
        </div>
      )}
    </div>
  );
};
