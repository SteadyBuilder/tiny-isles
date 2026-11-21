import React from 'react';
import { ITEM_SET_DEFINITIONS } from '../../data/itemSets';
import { RARITY_META } from '../../data/items';
import { GameEvents } from '../../game/events/gameEvents';
import { formatEquipmentStatsTags } from '../../game/utils/equipmentScoreUtils';
import { EquipmentItem, EquipmentSlot, EquippedItemsMap } from '../../types/hunting';

interface EquipmentSlotCardProps {
  slot: EquipmentSlot;
  equippedItem: EquipmentItem | null;
  allEquipped: EquippedItemsMap;
  isFilterSelected: boolean;
  hasUpgradeAvailable: boolean;
  onSelectSlotFilter: (slot: EquipmentSlot) => void;
}

const SLOT_LABELS: Record<EquipmentSlot, { label: string; emptyHint: string }> = {
  weapon: { label: '⚔️ 무기 슬롯', emptyHint: '장착된 무기 없음' },
  armor: { label: '🛡️ 방어구 슬롯', emptyHint: '장착된 방어구 없음' },
  relic: { label: '💍 유물 슬롯', emptyHint: '장착된 유물 없음' },
};

export const EquipmentSlotCard: React.FC<EquipmentSlotCardProps> = ({
  slot,
  equippedItem,
  allEquipped,
  isFilterSelected,
  hasUpgradeAvailable,
  onSelectSlotFilter,
}) => {
  const meta = SLOT_LABELS[slot];
  const rarity = equippedItem ? RARITY_META[equippedItem.rarity] : null;
  const isSet = equippedItem?.rarity === 'set';
  const setDef = equippedItem?.setId ? ITEM_SET_DEFINITIONS[equippedItem.setId] : null;
  const equippedSetCount = setDef
    ? [allEquipped.weapon, allEquipped.armor, allEquipped.relic].filter(
        (it) => it?.setId === setDef.id
      ).length
    : 0;

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
      className={`ts-paper-sheet p-2 flex flex-col justify-between gap-1.5 border-2 cursor-pointer transition-all ${
        isSet ? 'ts-set-emerald-card' : ''
      } ${isFilterSelected ? 'ring-2 ring-[#fde047] ring-offset-1 ring-offset-[#2b1810]' : ''}`}
      style={{
        borderColor: isSet ? '#10b981' : rarity ? rarity.colorHex : '#a89070',
      }}
      title="클릭하면 아래 가방에서 해당 부위 장비만 필터링합니다"
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-black text-[#5c422a]">{meta.label}</span>
        {hasUpgradeAvailable && (
          <span
            className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] font-black inline-flex items-center justify-center shadow-sm"
            aria-label="상위 장비 보유"
          >
            ▲
          </span>
        )}
      </div>

      {equippedItem ? (
        <>
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-10 h-10 rounded-lg border flex items-center justify-center p-1 shrink-0 ${
                isSet
                  ? 'bg-emerald-950/85 border-emerald-400'
                  : 'bg-[#2b1810]/10 border-[#a89070]'
              }`}
            >
              <img
                src={equippedItem.spritePath}
                alt={equippedItem.name}
                className={`w-8 h-8 object-contain [image-rendering:pixelated] ${
                  isSet ? 'ts-set-emerald-icon' : ''
                }`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black truncate text-[#2b1810]">
                <span className={`px-1 py-0.5 rounded text-[9px] mr-1 ${rarity?.badgeBg || ''}`}>
                  {rarity?.label}
                </span>
                <span className={isSet ? 'text-emerald-900' : ''}>{equippedItem.name}</span>
              </div>
              {setDef && (
                <div className="text-[9px] font-black text-emerald-700 truncate">
                  ✨ {setDef.name} ({equippedSetCount}/{setDef.pieceIds.length})
                </div>
              )}
              <div className="text-[10px] font-bold text-[#3a200f] leading-tight line-clamp-2 mt-0.5">
                {formatEquipmentStatsTags(equippedItem).join(' · ')}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              GameEvents.emit('unequip-slot', slot);
            }}
            className="w-full py-1 rounded bg-[#5c422a] text-[#fef3c7] text-[10px] font-black hover:brightness-110 active:scale-95"
          >
            장착 해제
          </button>
        </>
      ) : (
        <div className="py-3 text-center text-[11px] font-bold text-[#785e42]">
          {meta.emptyHint}
        </div>
      )}
    </div>
  );
};
