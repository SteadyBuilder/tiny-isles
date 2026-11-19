import React, { useEffect, useState } from 'react';
import { Inventory, PlayerHpState, WaveState } from '../../types/game';
import { MissionProgressState, RoomMode } from '../../types/room';
import { HUD_STATUS_ICONS } from '../../data/hudIcons';
import { HUD_RESOURCE_SLOTS } from './hudUtils';
import { PixelRoundButton } from '../ui/PixelRoundButton';
import { PixelThreatGauge } from '../ui/PixelThreatGauge';
import { MissionHudBanner } from '../MissionHudBanner';

export interface HudMobileBarProps {
  inventory: Inventory;
  playerHp?: PlayerHpState;
  unlockedCount: number;
  totalIslands: number;
  waveState?: WaveState;
  alertMessage?: string | null;
  missionProgress?: MissionProgressState | null;
  roomMode?: RoomMode;
  onTogglePause?: () => void;
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
  missionProgress = null,
  roomMode = 'solo',
  onTogglePause,
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
  const isFainted = playerHp?.isFainted ?? false;
  const threat = waveState?.threatPercent ?? 0;
  const countdown = waveState?.countdownSecondsRemaining ?? null;
  const isCountingDown = countdown !== null;
  const isWarning = isCountingDown || threat >= (waveState?.warningThreshold ?? 80);

  return (
    <div
      className="sm:hidden absolute left-1.5 right-1.5 z-30 flex flex-col gap-1 pointer-events-none"
      style={{ top: 'max(0.35rem, env(safe-area-inset-top, 0.35rem))' }}
    >
      {/* Row 1: Resource Plaque + Territory Compass + Settings */}
      <div className="flex items-center justify-between gap-1">
        <div className="ts-wood-bar-compact flex items-center gap-1 pointer-events-auto">
          {HUD_RESOURCE_SLOTS.map((slot) => (
            <div
              key={slot.key}
              className="flex items-center gap-1 px-1 py-0 rounded bg-[#24160e]/75 border border-[#85532a]/60"
            >
              <img src={slot.iconSrc} alt={slot.alt} className="w-3 h-3 pixel-art shrink-0" />
              <span
                className={`font-black ${slot.textColorClass} text-[11px] leading-tight tabular-nums pixel-btn-shadow`}
              >
                {inventory[slot.key]}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1 pointer-events-auto shrink-0">
          <button
            id="open-minimap-mobile-btn"
            type="button"
            onClick={onOpenMinimap}
            className="ts-wood-bar-compact flex items-center gap-1 text-[#fef5df] text-[10px] font-black active:scale-95 tabular-nums hover:brightness-110 transition-[filter]"
            title="5×5 전체 영지 미니맵 열기"
          >
            <img src={HUD_STATUS_ICONS.compass} alt="" className="w-3 h-3 pixel-art" />
            <span className="pixel-btn-shadow">
              {unlockedCount}/{totalIslands}
            </span>
          </button>

          <PixelRoundButton
            size="xs"
            variant="blue"
            iconSrc={HUD_STATUS_ICONS.settings}
            alt="설정"
            title="게임 & 사운드 통합 설정"
            onClick={onOpenSettings}
          />
        </div>
      </div>

      {/* Row 2: Left-Aligned Compact HP & Threat Gauge & Wave Icons */}
      {waveState && (
        <div
          className={`ts-wood-bar-compact self-start w-fit max-w-full flex flex-col gap-0.5 pointer-events-auto tabular-nums transition-[filter] ${
            isWarning ? 'ring-1 ring-red-400/70' : ''
          }`}
        >
          <div className="flex items-center gap-2 text-[10px] text-[#fef5df]">
            <span
              className={`flex items-center gap-0.5 font-black shrink-0 pixel-btn-shadow ${
                isFainted ? 'text-red-300 animate-pulse' : 'text-rose-200'
              }`}
            >
              <img src={HUD_STATUS_ICONS.heart} alt="HP" className="w-3 h-3 pixel-art" />
              <span>{isFainted ? '기절' : hpValue}</span>
            </span>

            {/* Mobile Compact Pixel Liquid Threat Gauge */}
            <div id="threat-mobile-badge" className="flex items-center gap-1">
              <img
                src={HUD_STATUS_ICONS.threat}
                alt="위협도"
                className={`w-3 h-3 pixel-art shrink-0 transition-transform ${
                  isSurging ? 'scale-125 brightness-125' : isWarning ? 'animate-pulse' : ''
                }`}
              />
              <PixelThreatGauge
                containerId="threat-mobile-gauge-container"
                barId="threat-mobile-gauge-bar"
                threatPercent={threat}
                isWarning={isWarning}
                isSurging={isSurging}
                className="w-16 h-2.5"
              />
              {isCountingDown ? (
                <span className="px-1 py-0 rounded bg-red-700 border border-red-300/70 text-[#fef5df] font-black text-[9px] animate-pulse shrink-0 pixel-btn-shadow">
                  {countdown}s
                </span>
              ) : (
                <span
                  className={`font-mono font-black text-[9px] shrink-0 pixel-btn-shadow ${
                    isSurging
                      ? 'text-yellow-200 scale-110'
                      : isWarning
                        ? 'text-red-300 animate-pulse'
                        : 'text-[#fde68a]'
                  }`}
                >
                  {threat}%
                </span>
              )}
            </div>

            <span className="flex items-center gap-0.5 text-red-200 font-black shrink-0 pixel-btn-shadow">
              <img src={HUD_STATUS_ICONS.boss} alt="보스" className="w-3 h-3 pixel-art" />
              <span>{waveState.wavesUntilBoss <= 1 ? 'BOSS' : `${waveState.wavesUntilBoss}W`}</span>
            </span>

            <span className="flex items-center gap-0.5 font-black text-[#fde68a] shrink-0 pixel-btn-shadow">
              <img src={HUD_STATUS_ICONS.monsters} alt="마물" className="w-3 h-3 pixel-art" />
              <span>{waveState.activeMonstersCount}</span>
            </span>
          </div>

          {showTestMenu && (
            <div className="flex items-center gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={onTriggerRegularWave}
                className="px-2 py-0.5 rounded bg-[#4f803b] border border-[#a3e635]/50 text-[#fef5df] text-[10px] font-black"
              >
                +Wave
              </button>
              <button
                type="button"
                onClick={onTriggerBossWave}
                className="px-2 py-0.5 rounded bg-[#991b1b] border border-[#f87171]/50 text-[#fef5df] text-[10px] font-black"
              >
                +Boss
              </button>
            </div>
          )}
        </div>
      )}

      {/* Row 3: 1-Line Mobile Mission Banner (Zero bottom overlap) */}
      <MissionHudBanner
        progress={missionProgress}
        roomMode={roomMode}
        onTogglePause={onTogglePause}
        variant="mobile-inline"
      />

      {/* Row 4: Mobile Alert Toast Banner */}
      {alertMessage && (
        <div
          id="game-alert-banner-mobile"
          className="ts-wood-bar-compact mx-auto max-w-full flex items-center justify-center gap-1.5 text-[#fde68a] text-xs font-black pointer-events-auto text-center pixel-btn-shadow"
        >
          <img src={HUD_STATUS_ICONS.alert} alt="" className="w-3.5 h-3.5 pixel-art shrink-0" />
          <span>{alertMessage}</span>
        </div>
      )}
    </div>
  );
};

