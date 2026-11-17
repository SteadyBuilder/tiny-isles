import React from 'react';
import { ITEM_SET_DEFINITIONS } from '../../data/itemSets';
import { RARITY_META } from '../../data/items';
import { GameEvents } from '../../game/events/gameEvents';
import {
  BagItemWithComparison,
  formatEquipmentStatsTags,
} from '../../game/utils/equipmentScoreUtils';
import { EquippedItemsMap, PlayerClassId } from '../../types/hunting';
import { PixelGameButton } from '../ui/PixelGameButton';

interface BagItemCardProps {
  entry: BagItemWithComparison;
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

const SLOT_SHORT_LABEL: Record<'weapon' | 'armor' | 'relic', string> = {
  weapon: '무기',
  armor: '방어구',
  relic: '유물',
};

export const BagItemCard: React.FC<BagItemCardProps> = ({
  entry,
  equipped,
  playerClassId,
}) => {
  const { item, comparison } = entry;
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

  return (
    <div
      className={`p-2 rounded-lg border-2 flex flex-col gap-1.5 transition-all ${
        isSet
          ? 'ts-set-emerald-card'
          : comparison.isRecommendedBest
            ? 'bg-[#fefce8] ring-1 ring-amber-400'
            : 'bg-[#f5e7cc]'
      }`}
      style={{
        borderColor: isSet ? '#10b981' : rarity.colorHex,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <div
            className={`w-11 h-11 rounded-lg border flex items-center justify-center p-1 shrink-0 ${
              isSet
                ? 'bg-emerald-950/90 border-emerald-400'
                : 'bg-[#2b1810]/10 border-[#a89070]'
            }`}
          >
            <img
              src={item.spritePath}
              alt={item.name}
              className={`w-9 h-9 object-contain [image-rendering:pixelated] ${
                isSet ? 'ts-set-emerald-icon' : ''
              }`}
            />
          </div>

          <div className="min-w-0 flex-1 space-y-0.5">
            {/* Title + Badges */}
            <div className="flex flex-wrap items-center gap-1">
              <span className={`px-1 py-0.5 rounded text-[9px] font-black ${rarity.badgeBg}`}>
                {rarity.label}
              </span>
              <span className="px-1 py-0.5 rounded bg-[#2b1810]/10 text-[#5c422a] text-[9px] font-black">
                {SLOT_SHORT_LABEL[item.slot]}
              </span>
              {comparison.isRecommendedBest && (
                <span className="px-1.5 py-0.5 rounded bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[9px] font-black shadow-sm">
                  ⭐ 최적 추천
                </span>
              )}
              {comparison.scoreDelta !== 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                    comparison.isUpgrade
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-400'
                      : 'bg-stone-200 text-stone-600 border border-stone-300'
                  }`}
                >
                  {comparison.isUpgrade
                    ? `▲ +${Math.max(1, comparison.percentDelta)}% 효율`
                    : `▼ ${comparison.percentDelta}%`}
                </span>
              )}
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
              className={`text-xs font-black truncate ${
                isSet ? 'text-emerald-950' : 'text-[#2b1810]'
              }`}
            >
              {item.name}
            </div>

            {/* Stats */}
            <div className="text-[10px] font-extrabold text-[#3a200f] leading-snug">
              {formatEquipmentStatsTags(item).join(' · ')}
            </div>

            {/* Stat Delta Comparison vs Equipped */}
            {comparison.statDeltas.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                <span className="text-[9px] font-bold text-[#6e4625]">장착 대비:</span>
                {comparison.statDeltas.slice(0, 5).map((d) => (
                  <span
                    key={d.label}
                    className={`px-1 rounded text-[9px] font-black ${
                      d.delta > 0
                        ? 'bg-emerald-600/15 text-emerald-800'
                        : 'bg-rose-600/15 text-rose-800'
                    }`}
                  >
                    {d.label} {d.delta > 0 ? `+${d.delta}` : d.delta}
                    {d.suffix}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 shrink-0">
          <PixelGameButton
            label={comparison.isUpgrade ? '추천 장착' : '장착'}
            variant="blue"
            size="sm"
            onClick={() => GameEvents.emit('equip-item', item.instanceId)}
          />
          <button
            type="button"
            onClick={() => GameEvents.emit('salvage-item', item.instanceId)}
            className="px-2 py-1.5 rounded border border-[#b45309] bg-[#fef3c7] text-[#92400e] text-[10px] font-black hover:brightness-105 active:scale-95 whitespace-nowrap"
            title="아이템을 분해하여 금화를 획득합니다"
          >
            분해 (+{item.salvageGold}🪙)
          </button>
        </div>
      </div>

      {/* Diablo-style Set Effect Box */}
      {setDef && (
        <div className="px-2 py-1 rounded bg-emerald-950/90 border border-emerald-500/60 text-[10px] space-y-0.5">
          <div className="flex items-center justify-between font-black text-emerald-300">
            <span>
              💚 세트: {setDef.name} ({equippedSetCount}/{setDef.pieceIds.length} 장착)
            </span>
          </div>
          {setDef.tiers.map((tier) => {
            const active = equippedSetCount >= tier.requiredPieces;
            return (
              <div
                key={tier.requiredPieces}
                className={`text-[9px] font-bold ${
                  active ? 'text-emerald-200' : 'text-emerald-600/80'
                }`}
              >
                {active ? '✔ ' : '• '}({tier.requiredPieces}세트) {tier.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
