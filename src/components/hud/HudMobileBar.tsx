import React from 'react';
import { Compass, Hammer } from 'lucide-react';
import { Inventory, Island, WaveState } from '../../types/game';
import { formatHudSeconds, HUD_RESOURCE_SLOTS } from './hudUtils';

export interface HudMobileBarProps {
  inventory: Inventory;
  unlockedCount: number;
  totalIslands: number;
  currentTerritory?: Island;
  waveState?: WaveState;
  alertMessage?: string | null;
  onOpenMinimap?: () => void;
  onOpenVillageModal?: () => void;
  onOpenSettings: () => void;
  onTriggerRegularWave?: () => void;
  onTriggerBossWave?: () => void;
}

export const HudMobileBar: React.FC<HudMobileBarProps> = ({
  inventory,
  unlockedCount,
  totalIslands,
  currentTerritory,
  waveState,
  alertMessage,
  onOpenMinimap,
  onOpenVillageModal,
  onOpenSettings,
  onTriggerRegularWave,
  onTriggerBossWave,
}) => {
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

          <button
            onClick={onOpenVillageModal}
            className="flex items-center gap-1 px-2 py-1 bg-amber-500 text-black rounded-xl text-[11px] font-black shadow border border-amber-200 tabular-nums"
            title="마을 발전 & 건설"
          >
            <Hammer className="w-3 h-3" />
            <span>Lv.{currentTerritory?.villageTier ?? 2}</span>
          </button>
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

      {/* Mobile Compact Icon Wave Bar */}
      {waveState && (
        <div className="flex items-center justify-between bg-slate-950/90 border border-red-500/40 px-2.5 py-1 rounded-xl text-[10px] text-white pointer-events-auto tabular-nums">
          <div className="flex items-center gap-2.5">
            <span>🧟 <b>{formatHudSeconds(waveState.regularWaveRemainingSec)}</b></span>
            <span>👹 <b className="text-red-300">{formatHudSeconds(waveState.bossWaveRemainingSec)}</b></span>
            <span>⚔️ <b className="text-amber-300">{waveState.activeMonstersCount}</b></span>
          </div>
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
