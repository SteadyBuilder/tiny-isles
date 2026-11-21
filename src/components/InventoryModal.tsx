import React, { useMemo, useState } from 'react';
import { PLAYER_CLASS_DEFINITIONS } from '../data/classes';
import { POTION_LIST } from '../data/potions';
import { GameEvents } from '../game/events/gameEvents';
import {
  EQUIPMENT_BAG_MAX_SIZE,
  pickBestUpgradeItemIds,
  pickInferiorSalvageIds,
  rankBagItemsWithComparison,
} from '../game/utils/equipmentScoreUtils';
import { useEscapeToClose } from '../hooks/useEscapeToClose';
import { EquipmentSlot, PlayerProgressionState } from '../types/game';
import { BagGridSlot } from './inventory/BagGridSlot';
import { EquipmentSlotCard } from './inventory/EquipmentSlotCard';
import { ItemComparisonPanel } from './inventory/ItemComparisonPanel';
import { PixelGameButton } from './ui/PixelGameButton';
import { WoodModalFrame } from './ui/WoodModalFrame';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  progression: PlayerProgressionState;
}

type CategoryFilter = 'all' | EquipmentSlot;

const CATEGORY_TABS: ReadonlyArray<{ id: CategoryFilter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 'weapon', label: '⚔️ 무기' },
  { id: 'armor', label: '🛡️ 방어구' },
  { id: 'relic', label: '💍 유물' },
];

export const InventoryModal: React.FC<InventoryModalProps> = ({
  isOpen,
  onClose,
  progression,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const rankedItems = useMemo(
    () =>
      rankBagItemsWithComparison(
        progression.bagItems,
        progression.equipped,
        progression.classId
      ),
    [progression.bagItems, progression.equipped, progression.classId]
  );

  const recommendedIds = useMemo(
    () =>
      pickBestUpgradeItemIds(
        progression.bagItems,
        progression.equipped,
        progression.classId
      ),
    [progression.bagItems, progression.equipped, progression.classId]
  );

  const inferiorIds = useMemo(
    () =>
      pickInferiorSalvageIds(
        progression.bagItems,
        progression.equipped,
        progression.classId,
        true
      ),
    [progression.bagItems, progression.equipped, progression.classId]
  );

  useEscapeToClose(isOpen, onClose);

  if (!isOpen) return null;

  const classDef = PLAYER_CLASS_DEFINITIONS[progression.classId];
  const slots: EquipmentSlot[] = ['weapon', 'armor', 'relic'];

  const countsBySlot: Record<CategoryFilter, number> = {
    all: rankedItems.length,
    weapon: rankedItems.filter((e) => e.item.slot === 'weapon').length,
    armor: rankedItems.filter((e) => e.item.slot === 'armor').length,
    relic: rankedItems.filter((e) => e.item.slot === 'relic').length,
  };

  const upgradeBySlot: Record<EquipmentSlot, boolean> = {
    weapon: rankedItems.some((e) => e.item.slot === 'weapon' && e.comparison.isUpgrade),
    armor: rankedItems.some((e) => e.item.slot === 'armor' && e.comparison.isUpgrade),
    relic: rankedItems.some((e) => e.item.slot === 'relic' && e.comparison.isUpgrade),
  };

  const filteredItems =
    categoryFilter === 'all'
      ? rankedItems
      : rankedItems.filter((entry) => entry.item.slot === categoryFilter);

  const selectedEntry =
    filteredItems.find((entry) => entry.item.instanceId === selectedItemId) ??
    filteredItems[0] ??
    null;

  const inferiorGoldPreview = progression.bagItems
    .filter((it) => inferiorIds.includes(it.instanceId))
    .reduce((acc, it) => acc + it.salvageGold, 0);

  const handleToggleSlotFilter = (slot: EquipmentSlot) => {
    setCategoryFilter((prev) => (prev === slot ? 'all' : slot));
  };

  return (
    <WoodModalFrame
      id="inventory-modal"
      title="개인 장비 & 전리품 가방"
      ribbonVariant="blue"
      frameVariant="wood"
      maxWidthClass="max-w-3xl"
      onClose={onClose}
      headerRight={
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#29150b]/85 border border-[#b89568] text-xs font-black text-[#fde68a]">
          <span>
            Lv.{progression.level} {classDef.name}
          </span>
          <span>·</span>
          <span>
            가방 {progression.bagItems.length}/{EQUIPMENT_BAG_MAX_SIZE}
          </span>
        </div>
      }
    >
      {/* Combat Summary Banner */}
      <div className="ts-paper-sheet p-2.5 space-y-1.5 text-xs font-black text-[#2b1810]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            ⚔️ 공격력: <strong className="text-[#b91c1c]">{progression.totalAttack}</strong>
          </span>
          <span>
            ❤️ 최대 체력: <strong className="text-[#15803d]">{progression.totalMaxHp}</strong>
          </span>
          <span>
            👟 이동속도: <strong className="text-[#1d4ed8]">{progression.totalSpeed}</strong>
          </span>
          <span>
            💥 치명: <strong className="text-[#d97706]">{progression.totalCritChance}%</strong>
            <span className="text-[10px] text-[#785e42]">
              ({progression.totalCritDamagePercent}%)
            </span>
          </span>
          <span>
            ⚡ 공속: <strong className="text-[#0284c7]">+{progression.totalAttackSpeedPercent}%</strong>
          </span>
          <span>
            🔥 스킬피해: <strong className="text-[#9333ea]">+{progression.totalSkillDamagePercent}%</strong>
          </span>
          <span>
            ⏱️ 쿨감: <strong className="text-[#7c3aed]">{progression.totalCooldownReductionPercent}%</strong>
          </span>
          <span>
            🩸 흡혈: <strong className="text-[#be123c]">{progression.totalLifestealPercent}%</strong>
          </span>
          {progression.totalDamageReductionPercent > 0 && (
            <span>
              🛡️ 피감: <strong className="text-[#0f766e]">{progression.totalDamageReductionPercent}%</strong>
            </span>
          )}
          {progression.totalThornsDamage > 0 && (
            <span>
              🌵 반사: <strong className="text-[#047857]">{progression.totalThornsDamage}</strong>
            </span>
          )}
          {progression.totalHpRegenPerSec > 0 && (
            <span>
              💚 재생: <strong className="text-[#15803d]">+{progression.totalHpRegenPerSec}/s</strong>
            </span>
          )}
          {progression.totalAttackRangeBonus > 0 && (
            <span>
              🎯 사거리: <strong className="text-[#0369a1]">+{progression.totalAttackRangeBonus}px</strong>
            </span>
          )}
        </div>

        {/* Active Diablo Emerald Set Effects */}
        {progression.activeSetBonuses && progression.activeSetBonuses.length > 0 && (
          <div className="p-2 rounded-lg bg-emerald-950/90 border border-emerald-400 text-[11px] space-y-1">
            {progression.activeSetBonuses.map((setInfo) => (
              <div key={setInfo.setId} className="space-y-0.5">
                <div className="font-black text-emerald-300">
                  💚 활성 세트: {setInfo.name} ({setInfo.equippedCount}/{setInfo.totalPieces})
                </div>
                {setInfo.activeTiers.length > 0 ? (
                  setInfo.activeTiers.map((t) => (
                    <div key={t.requiredPieces} className="text-[10px] font-bold text-emerald-100">
                      ✔ [{t.requiredPieces}세트 효과] {t.label}
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] font-bold text-emerald-400/80">
                    동일 세트 1개 더 장착 시 2세트 효과가 활성화됩니다!
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Healing Potions */}
      <div className="ts-paper-sheet p-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-black text-[#2b1810]">🧪 보유 물약 (단축키 1·2·3)</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {POTION_LIST.map((potion) => {
            const count = progression.potions?.[potion.id] ?? 0;
            const disabled = count <= 0 || (progression.potionCooldownRemainingMs ?? 0) > 0;
            return (
              <button
                key={potion.id}
                type="button"
                disabled={disabled}
                onClick={() => GameEvents.emit('use-potion', potion.id)}
                className={`px-2 py-1 rounded-md border text-[11px] font-black flex items-center gap-1.5 transition-transform active:scale-95 ${
                  disabled
                    ? 'bg-[#3b2a1c]/30 border-[#8c7051] text-[#6e4625] cursor-not-allowed opacity-60'
                    : 'bg-[#1e3a8a] border-[#60a5fa] text-white hover:brightness-110'
                }`}
              >
                <img
                  src={potion.spritePath}
                  alt={potion.name}
                  className="w-4 h-4 object-contain [image-rendering:pixelated]"
                />
                <span>
                  {potion.shortName} ×{count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Equipped 3 Slots (Compact 3-column row at a glance) */}
      <div className="space-y-1">
        <span className="text-[11px] font-black text-[#fef3c7] drop-shadow block">
          장착 장비 (클릭 시 해당 부위 필터)
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {slots.map((slot) => (
            <EquipmentSlotCard
              key={slot}
              slot={slot}
              equippedItem={progression.equipped[slot]}
              isFilterSelected={categoryFilter === slot}
              hasUpgradeAvailable={upgradeBySlot[slot]}
              onSelectSlotFilter={handleToggleSlotFilter}
            />
          ))}
        </div>
      </div>

      {/* Category Filter Tabs & Batch Actions */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            {CATEGORY_TABS.map((tab) => {
              const active = categoryFilter === tab.id;
              const hasUpgrade = tab.id !== 'all' && upgradeBySlot[tab.id];
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategoryFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-black flex items-center gap-1 transition-all ${
                    active
                      ? 'bg-[#fde047] border-[#78350f] text-[#2b1810] shadow'
                      : 'bg-[#29150b]/85 border-[#785e42] text-[#fde68a] hover:brightness-110'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="text-[10px] opacity-80">({countsBySlot[tab.id]})</span>
                  {hasUpgrade && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <PixelGameButton
              label={
                recommendedIds.length > 0
                  ? `✨ 일괄 장착 (${recommendedIds.length})`
                  : '✨ 최적 장착중'
              }
              variant="blue"
              size="sm"
              disabled={recommendedIds.length === 0}
              onClick={() => GameEvents.emit('equip-recommended-items')}
            />
            <button
              type="button"
              disabled={inferiorIds.length === 0}
              onClick={() => GameEvents.emit('salvage-inferior-items')}
              className={`px-2 py-1.5 rounded-md border text-[10px] font-black transition-all ${
                inferiorIds.length > 0
                  ? 'bg-[#fef3c7] border-[#b45309] text-[#92400e] hover:brightness-105 active:scale-95'
                  : 'bg-[#29150b]/40 border-[#5c422a] text-[#a8a29e] cursor-not-allowed'
              }`}
              title="하위 일반~전설 장비를 한 번에 분해합니다 (세트 아이템 보호)"
            >
              🔨 하위 분해 ({inferiorIds.length} · +{inferiorGoldPreview}🪙)
            </button>
          </div>
        </div>

        {/* Diablo-style Split: Bag Icon Grid + Selected Item Comparison Panel */}
        <div className="grid grid-cols-1 md:grid-cols-[1.05fr_1fr] gap-2.5 items-stretch">
          <div className="ts-paper-sheet p-2 max-h-72 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="py-10 text-center text-xs font-bold text-[#6e4625]">
                {progression.bagItems.length === 0
                  ? '가방이 비어 있습니다. 정예·보스 사냥 또는 몬스터 부락 본진을 파괴해 장비를 획득하세요!'
                  : '선택한 카테고리에 해당하는 장비가 가방에 없습니다.'}
              </div>
            ) : (
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5">
                {filteredItems.map((entry) => (
                  <BagGridSlot
                    key={entry.item.instanceId}
                    entry={entry}
                    isSelected={selectedEntry?.item.instanceId === entry.item.instanceId}
                    playerClassId={progression.classId}
                    onSelect={setSelectedItemId}
                  />
                ))}
              </div>
            )}
          </div>

          <ItemComparisonPanel
            selectedEntry={selectedEntry}
            equipped={progression.equipped}
            playerClassId={progression.classId}
          />
        </div>
      </div>
    </WoodModalFrame>
  );
};
