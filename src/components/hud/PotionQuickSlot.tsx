import React from 'react';
import { POTION_LIST } from '../../data/potions';
import { GameEvents } from '../../game/events/gameEvents';
import { PotionInventory } from '../../types/hunting';

interface PotionQuickSlotProps {
  potions: PotionInventory;
  cooldownRemainingMs: number;
}

export const PotionQuickSlot: React.FC<PotionQuickSlotProps> = ({
  potions,
  cooldownRemainingMs,
}) => {
  const isCoolingDown = cooldownRemainingMs > 0;
  const cdSec = isCoolingDown ? (cooldownRemainingMs / 1000).toFixed(1) : null;

  return (
    <div className="flex items-center gap-1">
      {POTION_LIST.map((potion) => {
        const count = potions?.[potion.id] ?? 0;
        const disabled = count <= 0 || isCoolingDown;

        return (
          <button
            key={potion.id}
            type="button"
            disabled={disabled}
            onClick={() => GameEvents.emit('use-potion', potion.id)}
            title={`${potion.name} (+${potion.healAmount} HP) · 단축키 [${potion.hotkey}]`}
            className={`relative px-1.5 py-0.5 md:px-2 md:py-1 rounded-md border text-[10px] md:text-[11px] font-black flex items-center gap-1 transition-transform active:scale-95 ${
              count <= 0
                ? 'bg-[#1c130d]/80 border-[#4a3525] text-[#78716c] cursor-not-allowed'
                : isCoolingDown
                  ? 'bg-[#291d14] border-[#785e42] text-[#cbd5e1] cursor-not-allowed'
                  : 'bg-[#14532d]/90 border-[#4ade80] text-[#dcfce7] hover:brightness-110'
            }`}
          >
            <span className="hidden md:inline px-1 rounded bg-black/45 text-[9px] text-[#86efac]">
              {potion.hotkey}
            </span>
            <span className="leading-none">{potion.icon}</span>
            <span className="tabular-nums">×{count}</span>
            {cdSec && count > 0 && (
              <span className="text-[9px] text-[#fca5a5] tabular-nums">{cdSec}s</span>
            )}
          </button>
        );
      })}
    </div>
  );
};
