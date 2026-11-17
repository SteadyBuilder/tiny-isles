import React from 'react';
import { PLAYER_CLASS_DEFINITIONS } from '../data/classes';
import { RARITY_META } from '../data/items';
import { GameEvents } from '../game/events/gameEvents';
import { EquipmentItem, EquipmentSlot, PlayerProgressionState } from '../types/game';
import { PixelGameButton } from './ui/PixelGameButton';
import { WoodModalFrame } from './ui/WoodModalFrame';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  progression: PlayerProgressionState;
}

const SLOT_LABELS: Record<EquipmentSlot, { label: string; emptyHint: string }> = {
  weapon: { label: '⚔️ 무기 슬롯', emptyHint: '장착된 무기 없음' },
  armor: { label: '🛡️ 방어구 슬롯', emptyHint: '장착된 방어구 없음' },
  relic: { label: '💍 유물 슬롯', emptyHint: '장착된 유물 없음' },
};

function formatItemStats(item: EquipmentItem): string {
  const parts: string[] = [];
  if (item.bonusAttack) parts.push(`공격력 +${item.bonusAttack}`);
  if (item.bonusMaxHp) parts.push(`체력 +${item.bonusMaxHp}`);
  if (item.bonusSpeed) parts.push(`이속 +${item.bonusSpeed}`);
  if (item.bonusCritChance) parts.push(`치명타 +${item.bonusCritChance}%`);
  if (item.bonusLifestealPercent) parts.push(`흡혈 +${item.bonusLifestealPercent}%`);
  if (item.bonusCooldownReductionPercent) parts.push(`쿨감 +${item.bonusCooldownReductionPercent}%`);
  return parts.join(' · ');
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  isOpen,
  onClose,
  progression,
}) => {
  if (!isOpen) return null;

  const classDef = PLAYER_CLASS_DEFINITIONS[progression.classId];
  const slots: EquipmentSlot[] = ['weapon', 'armor', 'relic'];

  return (
    <WoodModalFrame
      id="inventory-modal"
      title="개인 장비 & 전리품 가방"
      ribbonVariant="blue"
      frameVariant="wood"
      maxWidthClass="max-w-lg"
      onClose={onClose}
      headerRight={
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#29150b]/85 border border-[#b89568] text-xs font-black text-[#fde68a]">
          <span>
            Lv.{progression.level} {classDef.name}
          </span>
          <span>·</span>
          <span>가방 {progression.bagItems.length}/16</span>
        </div>
      }
    >
      {/* Combat Summary Banner */}
      <div className="ts-paper-sheet p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-black text-[#2b1810]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            ⚔️ 총 공격력: <strong className="text-[#b91c1c]">{progression.totalAttack}</strong>
          </span>
          <span>
            ❤️ 최대 체력: <strong className="text-[#15803d]">{progression.totalMaxHp}</strong>
          </span>
          <span>
            👟 이동속도: <strong className="text-[#1d4ed8]">{progression.totalSpeed}</strong>
          </span>
          <span>
            💥 치명타: <strong className="text-[#d97706]">{progression.totalCritChance}%</strong>
          </span>
          <span>
            🩸 흡혈: <strong className="text-[#be123c]">{progression.totalLifestealPercent}%</strong>
          </span>
          <span>
            ⏱️ 쿨감: <strong className="text-[#7c3aed]">{progression.totalCooldownReductionPercent}%</strong>
          </span>
        </div>
        <span className="text-[11px] font-bold text-[#6e4625]">
          정예·보스 및 부락 본진 처치 시 랜덤 옵션 장비 드랍!
        </span>
      </div>

      {/* Equipped 3 Slots */}
      <div className="space-y-1.5">
        <div className="text-xs font-black text-[#fef3c7] drop-shadow">장착 중인 장비 (3슬롯)</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {slots.map((slot) => {
            const equipped = progression.equipped[slot];
            const meta = SLOT_LABELS[slot];
            const rarity = equipped ? RARITY_META[equipped.rarity] : null;

            return (
              <div
                key={slot}
                className="ts-paper-sheet p-2 flex flex-col justify-between gap-1.5 border-2"
                style={{
                  borderColor: rarity ? rarity.colorHex : '#a89070',
                }}
              >
                <div className="text-[10px] font-black text-[#5c422a]">{meta.label}</div>
                {equipped ? (
                  <>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-lg leading-none shrink-0">{equipped.icon}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-black truncate text-[#2b1810]">
                          <span
                            className={`px-1 py-0.5 rounded text-[9px] mr-1 ${rarity?.badgeBg || ''}`}
                          >
                            {rarity?.label}
                          </span>
                          {equipped.name}
                        </div>
                        <div className="text-[10px] font-bold text-[#3a200f] leading-tight">
                          {formatItemStats(equipped)}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => GameEvents.emit('unequip-slot', slot)}
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
          })}
        </div>
      </div>

      {/* Bag Items List */}
      <div className="space-y-1.5">
        <div className="text-xs font-black text-[#fef3c7] drop-shadow">
          보유 전리품 ({progression.bagItems.length} / 16)
        </div>
        <div className="ts-paper-sheet p-2 max-h-60 overflow-y-auto space-y-1.5">
          {progression.bagItems.length === 0 ? (
            <div className="py-6 text-center text-xs font-bold text-[#6e4625]">
              가방이 비어 있습니다. 주변 몬스터 부락의 본진을 파괴해 장비를 획득하세요!
            </div>
          ) : (
            progression.bagItems.map((item) => {
              const rarity = RARITY_META[item.rarity];
              return (
                <div
                  key={item.instanceId}
                  className="p-2 rounded-lg border-2 bg-[#f5e7cc] flex items-center justify-between gap-2"
                  style={{
                    borderColor: rarity.colorHex,
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl leading-none shrink-0">{item.icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-black truncate text-[#2b1810]">
                        <span className={`px-1 py-0.5 rounded text-[9px] mr-1 ${rarity.badgeBg}`}>
                          {rarity.label}
                        </span>
                        {item.name}
                      </div>
                      <div className="text-[10px] font-extrabold text-[#3a200f]">
                        {formatItemStats(item)}
                      </div>
                      <div className="text-[10px] font-bold text-[#6e4625] truncate">
                        {item.description}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <PixelGameButton
                      label="장착"
                      variant="blue"
                      size="sm"
                      onClick={() => GameEvents.emit('equip-item', item.instanceId)}
                    />
                    <button
                      type="button"
                      onClick={() => GameEvents.emit('salvage-item', item.instanceId)}
                      className="px-2 py-1.5 rounded border border-[#b45309] bg-[#fef3c7] text-[#92400e] text-[10px] font-black hover:brightness-105 active:scale-95"
                      title="아이템을 분해하여 금화를 획득합니다"
                    >
                      분해 (+{item.salvageGold}🪙)
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </WoodModalFrame>
  );
};
