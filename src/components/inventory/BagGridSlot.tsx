import React from 'react';
import { RARITY_META } from '../../data/items';
import { BagItemWithComparison } from '../../game/utils/equipmentScoreUtils';
import { EquipmentSlot, PlayerClassId } from '../../types/hunting';

interface BagGridSlotProps {
  entry: BagItemWithComparison;
  isSelected: boolean;
  playerClassId: PlayerClassId;
  onSelect: (instanceId: string) => void;
}

const SLOT_ICON: Record<EquipmentSlot, string> = {
  weapon: '⚔️',
  armor: '🛡️',
  relic: '💍',
};

export const BagGridSlot: React.FC<BagGridSlotProps> = ({
  entry,
  isSelected,
  playerClassId,
  onSelect,
}) => {
  const { item, comparison } = entry;
  const rarity = RARITY_META[item.rarity];
  const isSet = item.rarity === 'set';
  const isClassMatch = item.preferredClass === playerClassId;

  return (
    <button
      type="button"
      onClick={() => onSelect(item.instanceId)}
      title={item.name}
      aria-label={`${rarity.label} ${item.name}`}
      aria-pressed={isSelected}
      className={`relative aspect-square w-full rounded-lg border-2 flex items-center justify-center p-1.5 transition-all cursor-pointer select-none ${
        isSet
          ? 'bg-emerald-950/90 ts-set-emerald-card'
          : 'bg-[#29150b]/85 hover:bg-[#3a2012]'
      } ${
        isSelected
          ? 'ring-2 ring-[#fde047] ring-offset-1 ring-offset-[#2b1810] scale-[1.04] z-10 shadow-lg'
          : 'hover:brightness-110'
      }`}
      style={{
        borderColor: isSet ? '#10b981' : rarity.colorHex,
      }}
    >
      <img
        src={item.spritePath}
        alt={item.name}
        className={`w-full h-full max-w-[36px] max-h-[36px] object-contain [image-rendering:pixelated] ${
          isSet ? 'ts-set-emerald-icon' : ''
        }`}
      />

      {/* Top-Left: Best Upgrade Star (Icon only) */}
      {comparison.isRecommendedBest && (
        <span
          className="absolute top-0.5 left-0.5 text-[10px] leading-none text-[#fde047] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
          aria-hidden="true"
        >
          ★
        </span>
      )}

      {/* Top-Right: Upgrade Arrow (Icon only) */}
      {comparison.isUpgrade && (
        <span
          className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-600 text-white text-[8px] font-black flex items-center justify-center shadow"
          aria-hidden="true"
        >
          ▲
        </span>
      )}

      {/* Bottom-Left: Slot Icon */}
      <span
        className="absolute bottom-0.5 left-0.5 text-[9px] leading-none opacity-85 drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]"
        aria-hidden="true"
      >
        {SLOT_ICON[item.slot]}
      </span>

      {/* Bottom-Right: Class Match Check */}
      {isClassMatch && (
        <span
          className="absolute bottom-0.5 right-0.5 px-0.5 rounded bg-amber-500/90 text-[#2b1810] text-[8px] font-black leading-tight"
          aria-hidden="true"
        >
          ✓
        </span>
      )}
    </button>
  );
};
