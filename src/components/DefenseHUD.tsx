import React from 'react';
import { Inventory, DefenseSession } from '../types/game';
import { Shield, Gem, Heart, Skull, Zap, Map, Hammer, AlertTriangle } from 'lucide-react';

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
  // 포맷 시간 (mm:ss)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const corePercent = Math.max(0, Math.min(100, Math.round((capitalCoreHp / maxCapitalCoreHp) * 100)));
  const playerPercent = Math.max(0, Math.min(100, Math.round((playerHp / maxPlayerHp) * 100)));

  return (
    <div className="fixed inset-0 pointer-events-none select-none z-20 flex flex-col justify-between p-2 sm:p-4 font-sans safe-top safe-bottom">
      {/* 1. 상단 바 (헤더) */}
      <div className="flex items-start justify-between w-full gap-2">
        {/* 좌측: 코어 체력 & 플레이어 체력 */}
        <div className="pointer-events-auto flex flex-col gap-1.5 bg-slate-900/85 backdrop-blur-md p-2.5 sm:p-3 rounded-2xl border border-slate-700/60 shadow-xl max-w-[200px] sm:max-w-xs">
          {/* 수도 코어 체력 */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] sm:text-xs font-bold">
              <span className="flex items-center gap-1.5 text-cyan-300">
                <Gem className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                수도 코어 보석
              </span>
              <span className="text-cyan-200 font-mono text-[10px] sm:text-xs">
                {capitalCoreHp}/{maxCapitalCoreHp}
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-950/80 rounded-full overflow-hidden p-0.5 border border-cyan-500/30">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  corePercent > 50
                    ? 'bg-gradient-to-r from-cyan-500 to-emerald-400'
                    : corePercent > 20
                    ? 'bg-gradient-to-r from-yellow-500 to-amber-500'
                    : 'bg-gradient-to-r from-rose-600 to-red-500 animate-pulse'
                }`}
                style={{ width: `${corePercent}%` }}
              />
            </div>
          </div>

          {/* 플레이어 체력 */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] sm:text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-rose-300">
                <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-500/40" />
                플레이어
              </span>
              <span className="text-rose-200 font-mono text-[10px] sm:text-xs">
                {playerHp}/{maxPlayerHp}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-950/80 rounded-full overflow-hidden p-0.5 border border-rose-500/30">
              <div
                className="h-full rounded-full bg-gradient-to-r from-rose-500 to-red-400 transition-all duration-200"
                style={{ width: `${playerPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* 중앙: 세션 타이머 & 웨이브 카운트다운 */}
        <div className="pointer-events-auto flex flex-col items-center bg-slate-900/90 backdrop-blur-md px-3 py-2 sm:px-5 sm:py-2.5 rounded-2xl border border-amber-500/40 shadow-2xl">
          <div className="flex items-center gap-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-500/30">
              {session.modeMinutes}분 모드
            </span>
            <span className="text-xs sm:text-sm font-mono font-bold text-slate-200">
              ⏱️ {formatTime(session.elapsedSeconds)}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1.5">
              <Skull className={`w-4 h-4 ${session.waveIncoming ? 'text-red-500 animate-bounce' : 'text-slate-400'}`} />
              <span className="text-xs sm:text-sm font-black text-white">
                {session.isBossWave ? '👑 보스 웨이브!' : `웨이브 ${session.waveIndex + 1}`}
              </span>
            </div>

            <span className="text-slate-400 font-mono text-xs">|</span>

            {session.waveIncoming ? (
              <span className="text-xs font-black text-rose-400 animate-pulse">
                침공 중! ({incomingMonsterCount}마리)
              </span>
            ) : (
              <span className="text-xs font-mono font-bold text-amber-300">
                다음 침공: {Math.max(0, Math.ceil(session.timeToNextWave))}초
              </span>
            )}
          </div>

          {/* 웨이브 조기 호출 버튼 (조기 준비 완료 시 클릭) */}
          {!session.waveIncoming && (
            <button
              onClick={onCallWaveEarly}
              className="mt-1.5 flex items-center gap-1 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 text-amber-300 text-[10px] sm:text-xs font-bold rounded-lg border border-amber-500/40 transition-all shadow-sm"
              title="준비가 완료되었다면 즉시 침공을 시작하고 보너스 자원을 획득합니다"
            >
              <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
              즉시 소환
            </button>
          )}
        </div>

        {/* 우측: 자원 표시 & 퀵 메뉴 */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* 자원 바 */}
          <div className="flex items-center gap-2 sm:gap-3 bg-slate-900/85 backdrop-blur-md px-3 py-2 rounded-2xl border border-slate-700/60 shadow-xl font-mono text-xs sm:text-sm font-bold">
            <div className="flex items-center gap-1 text-amber-300" title="목재">
              <span>🪵</span>
              <span>{inventory.wood}</span>
            </div>
            <div className="flex items-center gap-1 text-stone-300" title="석재">
              <span>🪨</span>
              <span>{inventory.stone}</span>
            </div>
            <div className="flex items-center gap-1 text-yellow-400" title="골드">
              <span>🪙</span>
              <span>{inventory.gold}</span>
            </div>
          </div>

          {/* 미니맵 버튼 */}
          <button
            onClick={onOpenMinimap}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-slate-900/85 backdrop-blur-md border border-slate-700/60 hover:border-slate-500 active:scale-95 flex items-center justify-center text-slate-200 shadow-xl"
            title="미니맵 열기"
          >
            <Map className="w-5 h-5 text-indigo-400" />
          </button>

          {/* 건축 핫바 토글 버튼 (PC/모바일 공용 퀵 토글) */}
          <button
            onClick={onToggleBuildHotbar}
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl backdrop-blur-md border flex items-center justify-center shadow-xl transition-all active:scale-95 ${
              isBuildHotbarOpen
                ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                : 'bg-slate-900/85 text-amber-400 border-amber-500/40 hover:border-amber-400'
            }`}
            title="건축 모드 토글"
          >
            <Hammer className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 2. 침공 방향 경고 오프스크린 인디케이터 (화면 가장자리 경고) */}
      {warningDirection && session.waveIncoming && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="flex items-center gap-2 bg-red-600/90 text-white font-black text-xs sm:text-sm px-4 py-2 rounded-full shadow-[0_0_30px_rgba(220,38,38,0.8)] border border-red-300 animate-pulse">
            <AlertTriangle className="w-4 h-4 text-yellow-300 animate-bounce" />
            <span>외곽 {warningDirection} 방향에서 마물 대규모 침공 중!</span>
          </div>
        </div>
      )}
    </div>
  );
};
