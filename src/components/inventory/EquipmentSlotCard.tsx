import React from 'react';
import { RARITY_META } from '../../data/items';
import { GameEvents } from '../../game/events/gameEvents';
import { EquipmentItem, EquipmentSlot } from '../../types/hunting';

interface EquipmentSlotCardProps {
  slot: EquipmentSlot;
  equippedItem: EquipmentItem | null;
  isFilterSelected: boolean;
  hasUpgradeAvailable: boolean;
  onSelectSlotFilter: (slot: EquipmentSlot) => void;
}

const SLOT_LABELS: Record<EquipmentSlot, { icon: string; label: string }> = {
  weapon: { icon: '⚔️', label: '무기' },
  armor: { icon: '🛡️', label: '방어구' },
  relic: { icon: '💍', label: '유물' },
};

export const EquipmentSlotCard: React.FC<EquipmentSlotCardProps> = ({
  slot,
  equippedItem,
  isFilterSelected,
  hasUpgradeAvailable,
  onSelectSlotFilter,
}) => {
  const meta = SLOT_LABELS[slot];
  const rarity = equippedItem ? RARITY_META[equippedItem.rarity] : null;
  const isSet = equippedItem?.rarity === 'set';

  return (
    <div
      onClick={() => onSelectSlotFilter(slot)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelectSlotFilter(slot);
        }
      }}
      className={`ts-paper-sheet px-2 py-1.5 flex flex-col justify-between gap-1 border-2 cursor-pointer transition-all min-w-0 ${
        isSet ? 'ts-set-emerald-card' : ''
      } ${isFilterSelected ? 'ring-2 ring-[#fde047] ring-offset-1 ring-offset-[#2b1810]' : ''}`}
      style={{
        borderColor: isSet ? '#10b981' : rarity ? rarity.colorHex : '#a89070',
      }}
      title="클릭하면 아래 가방에서 해당 부위 장비만 필터링합니다"
    >
      <div className="flex items-center justify-between gap-1 min-w-0">
        <span className="text-[10px] font-black text-[#5c422a] truncate">
          {meta.icon} {meta.label}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {hasUpgradeAvailable && (
            <span
              className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white text-[9px] font-black inline-flex items-center justify-center shadow-sm"
              aria-label="상위 장비 보유"
            >
              ▲
            </span>
          )}
          {equippedItem && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                GameEvents.emit('unequip-slot', slot);
              }}
              className="px-1.5 py-0.5 rounded bg-[#5c422a] text-[#fef3c7] text-[9px] font-black hover:brightness-110 active:scale-95 leading-none"
              title="장착 해제"
            >
              해제
            </button>
          )}
        </div>
      </div>

      {equippedItem ? (
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-md border flex items-center justify-center p-0.5 shrink-0 ${
              isSet
                ? 'bg-emerald-950/85 border-emerald-400'
                : 'bg-[#2b1810]/10 border-[#a89070]'
            }`}
          >
            <img
              src={equippedItem.spritePath}
              alt={equippedItem.name}
              className={`w-6 h-6 object-contain [image-rendering:pixelated] ${
                isSet ? 'ts-set-emerald-icon' : ''
              }`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className={`text-[11px] font-black truncate leading-tight ${
                isSet ? 'text-emerald-900' : 'text-[#2b1810]'
              }`}
            >
              {equippedItem.name}
            </div>
            <span className={`inline-block px-1 py-0 rounded text-[8px] font-black ${rarity?.badgeBg || ''}`}>
              {rarity?.label}
            </span>
          </div>
        </div>
      ) : (
        <div className="h-8 flex items-center justify-center text-[10px] font-bold text-[#785e42] opacity-75">
          비어 있음
        </div>
      )}
    </div>
  );
};
