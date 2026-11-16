import React, { useEffect, useState } from 'react';
import { Compass, Flame, Heart } from 'lucide-react';
import { Inventory, PlayerHpState, WaveState } from '../../types/game';
import { HUD_RESOURCE_SLOTS } from './hudUtils';

export interface HudMobileBarProps {
  inventory: Inventory;
  playerHp?: PlayerHpState;
  unlockedCount: number;
  totalIslands: number;
  waveState?: WaveState;
  alertMessage?: string | null;
  onOpenMinimap?: () => void;
  onOpenSettings: () => void;
  onTriggerRegularWave?: () => void;
  onTriggerBossWave?: () => void;
  showTestMenu?: boolean;
}

export const HudMobileBar: React.FC<HudMobileBarProps> = ({
  inventory,
  playerHp,
  unlockedCount,
  totalIslands,
  waveState,
  alertMessage,
  onOpenMinimap,
  onOpenSettings,
  onTriggerRegularWave,
  onTriggerBossWave,
  showTestMenu = false,
}) => {
  const [isSurging, setIsSurging] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    const handleArrived = () => {
      setIsSurging(true);
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setIsSurging(false), 320);
    };
    window.addEventListener('threat-orb-arrived', handleArrived);
    return () => {
      window.removeEventListener('threat-orb-arrived', handleArrived);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const hpValue = playerHp?.hp ?? 100;
  const hpMax = playerHp?.maxHp ?? 100;
  const isFainted = playerHp?.isFainted ?? false;
  const threat = waveState?.threatPercent ?? 0;
  const countdown = waveState?.countdownSecondsRemaining ?? null;
  const isCountingDown = countdown !== null;
  const isWarning = isCountingDown || threat >= (waveState?.warningThreshold ?? 80);

  return (
    <div
      className="sm:hidden absolute top-2 left-2 right-2 z-30 flex flex-col gap-1.5 pointer-events-none"
      style={{ top: 'max(0.5rem, env(safe-area-inset-top, 0.5rem))' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 pointer-events-auto">
          <div className="wood-hud-panel px-2 py-1 rounded-xl flex items-center gap-1.5 shadow-xl">
            {HUD_RESOURCE_SLOTS.map((slot) => (
              <div key={slot.key} className="flex items-center gap-0.5 wood-hud-slot px-1.5 py-0.5 rounded-lg">
                <img src={slot.iconSrc} alt={slot.alt} className="w-3.5 h-3.5 pixel-art" />
                <span className={`font-extrabold ${slot.textColorClass} text-xs tabular-nums`}>
                  {inventory[slot.key]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            id="open-minimap-mobile-btn"
            onClick={onOpenMinimap}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900/95 text-teal-200 rounded-xl text-[10px] font-black border border-teal-400/60 shadow active:scale-95 tabular-nums"
            title="5×5 전체 영지 미니맵 열기"
          >
            <Compass className="w-3.5 h-3.5 text-teal-300" />
            <span>{unlockedCount}/{totalIslands}</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="relative w-8 h-8 active:scale-90 flex items-center justify-center"
            title="게임 & 사운드 통합 설정"
          >
            <img
              src="/assets/ui/Buttons/SmallBlueRoundButton_Regular.png"
              alt="Settings"
              className="w-full h-full pixel-art"
            />
            <img src="/assets/ui/Icons/Icon_10.png" alt="Gear" className="absolute w-3.5 h-3.5 pixel-art" />
          </button>
        </div>
      </div>

      {/* Mobile Compact Icon Wave & Threat Liquid Bar */}
      {waveState && (
        <div
          className={`flex flex-wrap items-center justify-between gap-1.5 bg-slate-950/90 backdrop-blur-md border px-2.5 py-1.5 rounded-xl text-[11px] text-white pointer-events-auto tabular-nums shadow-lg transition-colors ${
            isWarning ? 'border-red-500/80' : 'border-red-500/40'
          }`}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className={`flex items-center gap-0.5 font-black shrink-0 ${isFainted ? 'text-red-300 animate-pulse' : 'text-rose-200'}`}>
              <Heart className="w-3 h-3 text-rose-400 fill-rose-500" />
              {isFainted ? '기절' : `${hpValue}`}
            </span>

            {/* Mobile Liquid Threat Gauge */}
            <div id="threat-mobile-badge" className="flex items-center gap-1.5 flex-1 min-w-[96px] max-w-[165px]">
              <Flame
                className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                  isSurging ? 'scale-125 text-yellow-300' : isWarning ? 'text-red-400 animate-pulse' : 'text-amber-400'
                }`}
              />
              <div
                id="threat-mobile-gauge-container"
                className={`flex-1 h-2.5 bg-slate-800/95 rounded-full overflow-hidden border transition-all duration-300 ${
                  isSurging
                    ? 'border-yellow-300 threat-liquid-surge scale-y-110'
                    : isWarning
                    ? 'border-red-400/70'
                    : 'border-slate-700'
                }`}
              >
                <div
                  id="threat-mobile-gauge-bar"
                  className="h-full threat-liquid-fill transition-all duration-700 ease-out rounded-full"
                  style={{
                    width: `${Math.min(100, Math.max(0, threat))}%`,
                    backgroundImage: isWarning
                      ? 'linear-gradient(90deg, #ea580c 0%, #ef4444 35%, #facc15 50%, #ef4444 65%, #ea580c 100%)'
                      : 'linear-gradient(90deg, #ca8a04 0%, #facc15 35%, #fef08a 50%, #f59e0b 65%, #ca8a04 100%)',
                  }}
                />
              </div>
              {isCountingDown ? (
                <span className="px-1.5 py-0.5 rounded bg-red-600/90 text-white font-black text-[10px] animate-pulse shrink-0">
                  ⏳{countdown}s
                </span>
              ) : (
                <span
                  className={`font-mono font-black text-[10px] shrink-0 ${
                    isSurging ? 'text-yellow-200 scale-110' : isWarning ? 'text-red-300 animate-pulse' : 'text-amber-200'
                  }`}
                >
                  {threat}%
                </span>
              )}
            </div>

            <span className="text-red-300 shrink-0">
              👹 <b>{waveState.wavesUntilBoss <= 1 ? '보스!' : `${waveState.wavesUntilBoss}W`}</b>
            </span>
            <span className="shrink-0">⚔️ <b className="text-amber-300">{waveState.activeMonstersCount}</b></span>
          </div>
          {showTestMenu && (
            <div className="flex items-center gap-1">
              <button
                onClick={onTriggerRegularWave}
                className="px-1.5 py-0.5 rounded bg-emerald-700 text-white font-bold"
                title="마물 웨이브 출현"
              >
                🧟⚡
              </button>
              <button
                onClick={onTriggerBossWave}
                className="px-1.5 py-0.5 rounded bg-red-700 text-white font-bold"
                title="보스 출현"
              >
                👹⚡
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mobile Alert Toast Banner */}
      {alertMessage && (
        <div
          id="game-alert-banner-mobile"
          className="mx-auto px-3.5 py-1.5 rounded-xl bg-slate-900/95 border border-amber-400/80 text-amber-200 text-xs font-extrabold shadow-2xl pointer-events-auto text-center"
        >
          {alertMessage}
        </div>
      )}
    </div>
  );
};
