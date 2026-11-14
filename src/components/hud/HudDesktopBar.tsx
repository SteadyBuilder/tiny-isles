import React from 'react';
import { Check, Compass, Hammer, Share2, Users } from 'lucide-react';
import { Inventory, Island } from '../../types/game';
import { HUD_RESOURCE_SLOTS } from './hudUtils';

export interface HudDesktopBarProps {
  inventory: Inventory;
  onlineCount: number;
  unlockedCount: number;
  totalIslands: number;
  currentTerritory?: Island;
  tierName: string;
  isMuted: boolean;
  copied: boolean;
  onCopyLink: () => void;
  onToggleSound: () => void;
  onOpenMinimap?: () => void;
  onOpenVillageModal?: () => void;
  onOpenSettings: () => void;
}

export const HudDesktopBar: React.FC<HudDesktopBarProps> = ({
  inventory,
  onlineCount,
  unlockedCount,
  totalIslands,
  currentTerritory,
  tierName,
  isMuted,
  copied,
  onCopyLink,
  onToggleSound,
  onOpenMinimap,
  onOpenVillageModal,
  onOpenSettings,
}) => {
  return (
    <div className="flex items-center justify-between w-full">
      {/* Left: Wood Resource Bar + Village Territory Map + Village Build Button */}
      <div className="flex items-center gap-2.5 pointer-events-auto">
        <div className="wood-hud-panel px-3.5 py-2 rounded-2xl flex items-center gap-2.5">
          {HUD_RESOURCE_SLOTS.map((slot) => (
            <div key={slot.key} className="flex items-center gap-1.5 wood-hud-slot px-2.5 py-1 rounded-xl">
              <img
                src={slot.iconSrc}
                alt={slot.alt}
                className="w-5 h-5 pixel-art select-none drop-shadow"
              />
              <span
                id={slot.desktopSpanId}
                className={`font-black ${slot.textColorClass} text-base min-w-[26px] tabular-nums`}
              >
                {inventory[slot.key]}
              </span>
            </div>
          ))}
        </div>

        {/* Occupied Village Territory Count & Map Button (Single unified icon badge) */}
        <button
          id="open-minimap-btn"
          onClick={onOpenMinimap}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-900/90 border border-teal-400/60 rounded-2xl shadow-xl hover:bg-slate-800 active:scale-95 transition"
          title="5×5 전체 영지 전략 미니맵 열기"
        >
          <Compass className="w-4 h-4 text-teal-300" />
          <span id="hud-unlocked-count" className="font-extrabold text-white text-sm tabular-nums">
            <span className="text-teal-200">{unlockedCount}</span>
            <span className="text-white/40 mx-0.5">/</span>
            <span>{totalIslands}</span>
          </span>
        </button>

        {/* Village Development & Construction Button (Compact Icon + Lv + Core HP Badge) */}
        <button
          id="open-village-modal-btn"
          onClick={onOpenVillageModal}
          className="flex items-center gap-2 px-3 py-2 bg-amber-600/90 hover:bg-amber-500 border-2 border-amber-300 rounded-2xl shadow-xl active:scale-95 transition text-black"
          title={`마을 발전 및 건설 (${tierName} · 단축키 B)`}
        >
          <Hammer className="w-4 h-4 text-black shrink-0" />
          <div className="flex items-center gap-1.5 text-xs font-black text-black leading-none tabular-nums">
            <span>🏰 Lv.{currentTerritory?.villageTier ?? 2}</span>
            <span className="px-1.5 py-0.5 rounded-md bg-black/15 text-[11px] text-amber-950">
              💎{currentTerritory?.coreHp ?? 350}
            </span>
            <span className="text-[10px] px-1 py-0.5 rounded bg-amber-950/20 text-amber-950">[B]</span>
          </div>
        </button>
      </div>

      {/* Center: Co-op Multiplayer Status (Compact Icon + Count + Share Icon) */}
      <div className="flex items-center gap-2 pointer-events-auto bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/15 shadow-xl">
        <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-black tabular-nums" title="접속 중인 수호자 수">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <Users className="w-3.5 h-3.5" />
          <span>{onlineCount}</span>
        </div>
        <button
          onClick={onCopyLink}
          className="flex items-center justify-center w-7 h-7 bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 rounded-lg transition"
          title={copied ? '초대 링크 복사됨!' : '협동 멀티플레이 초대 링크 복사'}
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Share2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Right: Audio & Settings Icon Buttons */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <button
          onClick={onToggleSound}
          className="relative w-10 h-10 active:scale-90 transition-transform flex items-center justify-center group"
          title={isMuted ? '음소거 해제' : '음소거'}
        >
          <img
            src="/assets/ui/Buttons/SmallBlueRoundButton_Regular.png"
            alt="Sound button"
            className="w-full h-full pixel-art select-none"
          />
          <img
            src="/assets/ui/Icons/Icon_12.png"
            alt="Music"
            className={`absolute w-4 h-4 pixel-art ${isMuted ? 'opacity-35 grayscale' : ''}`}
          />
          {isMuted && (
            <span className="absolute text-red-500 font-black text-base select-none">✕</span>
          )}
        </button>

        <button
          onClick={onOpenSettings}
          className="relative w-10 h-10 active:scale-90 transition-transform flex items-center justify-center group"
          title="게임 설정 & 가이드"
        >
          <img
            src="/assets/ui/Buttons/SmallBlueRoundButton_Regular.png"
            alt="Settings button"
            className="w-full h-full pixel-art select-none"
          />
          <img
            src="/assets/ui/Icons/Icon_10.png"
            alt="Gear"
            className="absolute w-4 h-4 pixel-art"
          />
        </button>
      </div>
    </div>
  );
};
