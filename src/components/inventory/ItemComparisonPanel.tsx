import React from 'react';
import { ITEM_SET_DEFINITIONS } from '../../data/itemSets';
import { RARITY_META } from '../../data/items';
import { GameEvents } from '../../game/events/gameEvents';
import {
  BagItemWithComparison,
  buildStatComparisonRows,
  formatEquipmentStatsTags,
} from '../../game/utils/equipmentScoreUtils';
import { EquipmentSlot, EquippedItemsMap, PlayerClassId } from '../../types/hunting';
import { PixelGameButton } from '../ui/PixelGameButton';

interface ItemComparisonPanelProps {
  selectedEntry: BagItemWithComparison | null;
  equipped: EquippedItemsMap;
  playerClassId: PlayerClassId;
}

const CLASS_BADGE_META: Record<
  Exclude<PlayerClassId, 'pawn'>,
  { label: string; style: string }
> = {
  guardian: { label: '🛡️ 가디언', style: 'bg-amber-900/15 text-amber-900 border-amber-700/40' },
  lancer: { label: '🔱 랜서', style: 'bg-cyan-900/15 text-cyan-900 border-cyan-700/40' },
  ranger: { label: '🏹 레인저', style: 'bg-lime-900/15 text-lime-900 border-lime-700/40' },
  archmage: { label: '🔮 메이지', style: 'bg-purple-900/15 text-purple-900 border-purple-700/40' },
};

const SLOT_LABEL: Record<EquipmentSlot, string> = {
  weapon: '무기',
  armor: '방어구',
  relic: '유물',
};

export const ItemComparisonPanel: React.FC<ItemComparisonPanelProps> = ({
  selectedEntry,
  equipped,
  playerClassId,
}) => {
  if (!selectedEntry) {
    return (
      <div className="ts-paper-sheet p-4 h-full flex items-center justify-center text-center text-xs font-bold text-[#6e4625]">
        가방에서 아이템을 선택하면
        <br />
        착용 중인 장비와 스탯을 비교할 수 있습니다.
      </div>
    );
  }

  const { item } = selectedEntry;
  const equippedItem = equipped[item.slot];
  const rarity = RARITY_META[item.rarity];
  const isSet = item.rarity === 'set';
  const setDef = item.setId ? ITEM_SET_DEFINITIONS[item.setId] : null;
  const equippedSetCount = setDef
    ? [equipped.weapon, equipped.armor, equipped.relic].filter((it) => it?.setId === setDef.id)
        .length
    : 0;

  const classBadge =
    item.preferredClass && item.preferredClass !== 'all' && item.preferredClass !== 'pawn'
      ? CLASS_BADGE_META[item.preferredClass]
      : null;
  const isClassMatch = item.preferredClass === playerClassId;

  const comparisonRows = buildStatComparisonRows(item, equippedItem);
  const equippedRarity = equippedItem ? RARITY_META[equippedItem.rarity] : null;
  const isEquippedSet = equippedItem?.rarity === 'set';

  return (
    <div className="ts-paper-sheet p-2.5 flex flex-col gap-2.5 h-full justify-between">
      {/* Selected Item Detail */}
      <div
        className={`p-2.5 rounded-lg border-2 space-y-2 ${
          isSet ? 'ts-set-emerald-card' : 'bg-[#fef9ec]'
        }`}
        style={{ borderColor: isSet ? '#10b981' : rarity.colorHex }}
      >
        <div className="flex items-start gap-2.5">
          <div
            className={`w-12 h-12 rounded-lg border flex items-center justify-center p-1 shrink-0 ${
              isSet
                ? 'bg-emerald-950/90 border-emerald-400'
                : 'bg-[#2b1810]/10 border-[#a89070]'
            }`}
          >
            <img
              src={item.spritePath}
              alt={item.name}
              className={`w-10 h-10 object-contain [image-rendering:pixelated] ${
                isSet ? 'ts-set-emerald-icon' : ''
              }`}
            />
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1">
              <span className={`px-1 py-0.5 rounded text-[9px] font-black ${rarity.badgeBg}`}>
                {rarity.label}
              </span>
              <span className="px-1 py-0.5 rounded bg-[#2b1810]/10 text-[#5c422a] text-[9px] font-black">
                {SLOT_LABEL[item.slot]}
              </span>
              {classBadge && (
                <span
                  className={`px-1 py-0.5 rounded border text-[9px] font-black ${classBadge.style} ${
                    isClassMatch ? 'ring-1 ring-amber-500' : ''
                  }`}
                >
                  {classBadge.label}
                  {isClassMatch ? ' ✓' : ''}
                </span>
              )}
            </div>
            <div
              className={`text-sm font-black leading-tight ${
                isSet ? 'text-emerald-950' : 'text-[#2b1810]'
              }`}
            >
              {item.name}
            </div>
          </div>
        </div>

        {/* Stat Rows with Up/Down Arrows Only */}
        <div className="border-t border-[#d6c2a5] pt-1.5 space-y-1">
          {comparisonRows.map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between text-[11px] font-extrabold text-[#3a200f]"
            >
              <span>{row.label}</span>
              <div className="flex items-center gap-1.5">
                <span className={row.candidateValue === 0 ? 'text-[#8c7051]' : 'text-[#2b1810]'}>
                  {row.candidateValue > 0 ? `+${row.candidateValue}${row.suffix}` : '0'}
                </span>
                <span className="w-3 text-center font-black">
                  {row.direction === 'up' && (
                    <span className="text-emerald-600" aria-label="상승">
                      ▲
                    </span>
                  )}
                  {row.direction === 'down' && (
                    <span className="text-rose-600" aria-label="하락">
                      ▼
                    </span>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Set Bonus Info */}
        {setDef && (
          <div className="px-2 py-1.5 rounded bg-emerald-950/90 border border-emerald-500/60 text-[10px] space-y-0.5">
            <div className="font-black text-emerald-300">
              💚 {setDef.name} ({equippedSetCount}/{setDef.pieceIds.length})
            </div>
            {setDef.tiers.map((tier) => {
              const active = equippedSetCount >= tier.requiredPieces;
              return (
                <div
                  key={tier.requiredPieces}
                  className={`text-[9px] font-bold ${
                    active ? 'text-emerald-200' : 'text-emerald-500/80'
                  }`}
                >
                  {active ? '✔ ' : '• '}({tier.requiredPieces}세트) {tier.label}
                </div>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5 pt-1">
          <PixelGameButton
            label={equippedItem ? '교체 장착' : '장착'}
            variant="blue"
            size="sm"
            className="flex-1"
            onClick={() => GameEvents.emit('equip-item', item.instanceId)}
          />
          <button
            type="button"
            onClick={() => GameEvents.emit('salvage-item', item.instanceId)}
            className="px-2.5 py-1.5 rounded border border-[#b45309] bg-[#fef3c7] text-[#92400e] text-[11px] font-black hover:brightness-105 active:scale-95 whitespace-nowrap"
          >
            분해 (+{item.salvageGold}🪙)
          </button>
        </div>
      </div>

      {/* Currently Equipped Item Comparison Box */}
      <div className="p-2 rounded-lg border border-[#b89568] bg-[#e9d7b8]/70 space-y-1.5">
        <div className="text-[10px] font-black text-[#5c422a] flex items-center justify-between">
          <span>현재 착용 중 ({SLOT_LABEL[item.slot]})</span>
        </div>

        {equippedItem && equippedRarity ? (
          <div className="flex items-start gap-2">
            <div
              className={`w-9 h-9 rounded border flex items-center justify-center p-0.5 shrink-0 ${
                isEquippedSet
                  ? 'bg-emerald-950/85 border-emerald-400'
                  : 'bg-[#2b1810]/10 border-[#a89070]'
              }`}
            >
              <img
                src={equippedItem.spritePath}
                alt={equippedItem.name}
                className={`w-7 h-7 object-contain [image-rendering:pixelated] ${
                  isEquippedSet ? 'ts-set-emerald-icon' : ''
                }`}
              />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="text-xs font-black truncate text-[#2b1810]">
                <span className={`px-1 py-0.5 rounded text-[9px] mr-1 ${equippedRarity.badgeBg}`}>
                  {equippedRarity.label}
                </span>
                <span>{equippedItem.name}</span>
              </div>
              <div className="text-[10px] font-bold text-[#3a200f] leading-snug">
                {formatEquipmentStatsTags(equippedItem).join(' · ')}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-1.5 text-center text-[11px] font-bold text-[#785e42]">
            착용 중인 {SLOT_LABEL[item.slot]} 없음
          </div>
        )}
      </div>
    </div>
  );
};
