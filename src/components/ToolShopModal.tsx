import React from 'react';
import { POTION_LIST } from '../data/potions';
import { GameEvents } from '../game/events/gameEvents';
import { PlayerHpState, PlayerProgressionState } from '../types/game';
import { PixelGameButton } from './ui/PixelGameButton';
import { WoodModalFrame } from './ui/WoodModalFrame';

interface ToolShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  progression: PlayerProgressionState;
  playerHp: PlayerHpState;
  gold: number;
  hasToolShopBuilt: boolean;
  isNearToolShop: boolean;
}

export const ToolShopModal: React.FC<ToolShopModalProps> = ({
  isOpen,
  onClose,
  progression,
  playerHp,
  gold,
  hasToolShopBuilt,
  isNearToolShop,
}) => {
  if (!isOpen) return null;

  const canUseShop = hasToolShopBuilt && isNearToolShop;

  return (
    <WoodModalFrame
      id="tool-shop-modal"
      title="도구 상점 — 치유 물약"
      ribbonVariant="blue"
      frameVariant="wood"
      maxWidthClass="max-w-lg"
      onClose={onClose}
      headerRight={
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#29150b]/85 border border-[#b89568] text-xs font-black text-[#fde68a]">
          <span>🪙 {gold} 금화</span>
          <span>·</span>
          <span className="text-[#86efac]">
            ❤️ {playerHp.hp}/{playerHp.maxHp}
          </span>
        </div>
      }
    >
      {/* Status Banner */}
      <div className="ts-paper-sheet p-2.5 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-black text-[#2b1810]">
            🧪 사냥·전투 중 단축키 <strong className="text-[#1d4ed8]">[1 / 2 / 3]</strong> 또는 HUD 퀵슬롯으로 물약 사용
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-black border shrink-0 ${
              canUseShop
                ? 'bg-[#dcfce7] border-[#15803d] text-[#14532d]'
                : 'bg-[#fef3c7] border-[#b45309] text-[#78350f]'
            }`}
          >
            {canUseShop
              ? '🧪 상점 입장 중'
              : hasToolShopBuilt
                ? '🚶 도구 상점 앞으로 이동 필요'
                : '🏗️ 마을에 도구 상점 건설 필요'}
          </span>
        </div>
        <p className="text-[11px] font-bold text-[#6e4625]">
          물약은 몬스터 사냥 드랍으로도 획득할 수 있으며, 쿨타임(4초)마다 즉시 체력을 회복합니다.
        </p>
      </div>

      {/* Potion List */}
      <div className="space-y-2">
        {POTION_LIST.map((potion) => {
          const owned = progression.potions?.[potion.id] ?? 0;
          const isFull = owned >= potion.maxStack;
          const enoughGold = gold >= potion.costGold;
          const canBuy = canUseShop && !isFull && enoughGold;

          return (
            <div
              key={potion.id}
              className="ts-paper-sheet p-2.5 flex items-center justify-between gap-3 border-2 border-[#a89070]"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-[#2b1810]/10 border border-[#a89070] flex items-center justify-center text-2xl shrink-0">
                  {potion.icon}
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-black text-[#2b1810]">{potion.name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-[#15803d]/15 border border-[#15803d]/40 text-[10px] font-black text-[#15803d]">
                      +{potion.healAmount} HP
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-[#1e3a8a]/15 text-[10px] font-black text-[#1e3a8a]">
                      소지 {owned}/{potion.maxStack}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-[#5c422a] leading-snug">
                    {potion.description}
                  </p>
                </div>
              </div>

              <div className="shrink-0">
                <PixelGameButton
                  label={isFull ? '소지 최대' : `🪙 ${potion.costGold} 구매`}
                  variant="blue"
                  size="sm"
                  disabled={!canBuy}
                  onClick={() => GameEvents.emit('buy-potion', potion.id)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </WoodModalFrame>
  );
};
