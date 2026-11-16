import React from 'react';
import { Check, Compass, Heart, Share2, Users } from 'lucide-react';
import { Inventory, PlayerHpState } from '../../types/game';
import { HUD_RESOURCE_SLOTS } from './hudUtils';

export interface HudDesktopBarProps {
  inventory: Inventory;
  onlineCount: number;
  playerHp?: PlayerHpState;
  unlockedCount: number;
  totalIslands: number;
  isMuted: boolean;
  copied: boolean;
  onCopyLink: () => void;
  onToggleSound: () => void;
  onOpenMinimap?: () => void;
  onOpenSettings: () => void;
}

export const HudDesktopBar: React.FC<HudDesktopBarProps> = ({
  inventory,
  onlineCount,
  playerHp,
  unlockedCount,
  totalIslands,
  isMuted,
  copied,
  onCopyLink,
  onToggleSound,
  onOpenMinimap,
  onOpenSettings,
}) => {
  const hpValue = playerHp?.hp ?? 100;
  const hpMax = playerHp?.maxHp ?? 100;
  const isFainted = playerHp?.isFainted ?? false;

  return (
    <div className="flex items-center justify-between w-full">
      {/* Left: Wood Resource Bar + Player HP + Village Territory Map */}
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

        {/* Player HP Badge */}
        <div
          id="hud-player-hp"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border shadow-xl text-sm font-black tabular-nums ${
            isFainted
              ? 'bg-red-950/95 border-red-400 text-red-200 animate-pulse'
              : hpValue <= 30
              ? 'bg-slate-900/95 border-red-500/70 text-red-300'
              : 'bg-slate-900/90 border-rose-400/50 text-rose-200'
          }`}
          title="내 체력 (HP 0이 되면 기절 후 중심 마을에서 부활)"
        >
          <Heart className="w-4 h-4 text-rose-400 fill-rose-500 shrink-0" />
          <span>{isFainted ? '기절!' : `${hpValue}/${hpMax}`}</span>
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
