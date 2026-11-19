import React from 'react';
import { Check, Share2, Users } from 'lucide-react';
import { Inventory, PlayerHpState } from '../../types/game';
import { HUD_STATUS_ICONS } from '../../data/hudIcons';
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
      {/* Left: Compact Wood Resource Bar + Player HP + Territory Map */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <div className="wood-hud-panel px-2.5 py-1.5 rounded-xl flex items-center gap-1.5">
          {HUD_RESOURCE_SLOTS.map((slot) => (
            <div key={slot.key} className="flex items-center gap-1 wood-hud-slot px-2 py-0.5 rounded-lg">
              <img
                src={slot.iconSrc}
                alt={slot.alt}
                className="w-4 h-4 pixel-art select-none drop-shadow"
              />
              <span
                id={slot.desktopSpanId}
                className={`font-black ${slot.textColorClass} text-sm min-w-[22px] tabular-nums pixel-btn-shadow`}
              >
                {inventory[slot.key]}
              </span>
            </div>
          ))}
        </div>

        {/* Player HP Badge */}
        <div
          id="hud-player-hp"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border shadow-xl text-xs font-black tabular-nums ${
            isFainted
              ? 'bg-red-950/95 border-red-400 text-red-200 animate-pulse'
              : hpValue <= 30
              ? 'bg-slate-900/95 border-red-500/70 text-red-300'
              : 'wood-hud-panel text-rose-200'
          }`}
          title="내 체력 (HP 0이 되면 기절 후 중심 마을에서 부활)"
        >
          <img
            src={HUD_STATUS_ICONS.heart}
            alt="HP"
            className="w-4 h-4 pixel-art select-none shrink-0"
          />
          <span className="pixel-btn-shadow">{isFainted ? '기절!' : `${hpValue}/${hpMax}`}</span>
        </div>

        {/* Occupied Village Territory Count & Map Button */}
        <button
          id="open-minimap-btn"
          onClick={onOpenMinimap}
          className="wood-hud-panel flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:brightness-110 active:scale-95 transition"
          title="5×5 전체 영지 전략 미니맵 열기"
        >
          <img
            src={HUD_STATUS_ICONS.compass}
            alt="영지 미니맵"
            className="w-4 h-4 pixel-art select-none shrink-0"
          />
          <span id="hud-unlocked-count" className="font-extrabold text-white text-xs tabular-nums pixel-btn-shadow">
            <span className="text-teal-200">{unlockedCount}</span>
            <span className="text-white/40 mx-0.5">/</span>
            <span>{totalIslands}</span>
          </span>
        </button>
      </div>

      {/* Right: Compact Co-op Status + Audio & Settings Icon Buttons (상단 중앙 시야 개방) */}
      <div className="flex items-center gap-1.5 pointer-events-auto">
        <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/15 shadow-lg">
          <div className="flex items-center gap-1 text-emerald-400 text-xs font-black tabular-nums" title="접속 중인 수호자 수">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <Users className="w-3.5 h-3.5" />
            <span>{onlineCount}</span>
          </div>
          <button
            onClick={onCopyLink}
            className="flex items-center justify-center w-6 h-6 bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 rounded-md transition"
            title={copied ? '초대 링크 복사됨!' : '협동 멀티플레이 초대 링크 복사'}
          >
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Share2 className="w-3 h-3" />}
          </button>
        </div>

        <button
          onClick={onToggleSound}
          className="relative w-9 h-9 active:scale-90 transition-transform flex items-center justify-center group"
          title={isMuted ? '음소거 해제' : '음소거'}
        >
          <img
            src="/assets/ui/Buttons/SmallBlueRoundButton_Regular.png"
            alt="Sound button"
            className="w-full h-full pixel-art select-none"
          />
          <img
            src={HUD_STATUS_ICONS.sound}
            alt="Music"
            className={`absolute w-4 h-4 pixel-art ${isMuted ? 'opacity-35 grayscale' : ''}`}
          />
          {isMuted && (
            <span className="absolute text-red-500 font-black text-base select-none">✕</span>
          )}
        </button>

        <button
          onClick={onOpenSettings}
          className="relative w-9 h-9 active:scale-90 transition-transform flex items-center justify-center group"
          title="게임 설정 & 가이드"
        >
          <img
            src="/assets/ui/Buttons/SmallBlueRoundButton_Regular.png"
            alt="Settings button"
            className="w-full h-full pixel-art select-none"
          />
          <img
            src={HUD_STATUS_ICONS.settings}
            alt="Gear"
            className="absolute w-4 h-4 pixel-art"
          />
        </button>
      </div>
    </div>
  );
};

