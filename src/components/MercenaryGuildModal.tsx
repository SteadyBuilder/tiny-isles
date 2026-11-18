import React from 'react';
import { MERCENARY_CATALOG, MERCENARY_GUILD_CONFIG } from '../data/mercenaries';
import { GameEvents } from '../game/events/gameEvents';
import { MercenaryUnit } from '../types/game';
import { PixelGameButton } from './ui/PixelGameButton';
import { WoodModalFrame } from './ui/WoodModalFrame';

interface MercenaryGuildModalProps {
  isOpen: boolean;
  onClose: () => void;
  meat: number;
  gold: number;
  hasGuildBuilt: boolean;
  isNearGuild: boolean;
  mercenaries: MercenaryUnit[];
}

export const MercenaryGuildModal: React.FC<MercenaryGuildModalProps> = ({
  isOpen,
  onClose,
  meat,
  gold,
  hasGuildBuilt,
  isNearGuild,
  mercenaries,
}) => {
  if (!isOpen) return null;

  const canUseGuild = hasGuildBuilt && isNearGuild;
  const activeCount = mercenaries.filter((m) => m.hp > 0).length;
  const maxTotal = MERCENARY_GUILD_CONFIG.maxMercenariesPerGuild;
  const isFull = activeCount >= maxTotal;

  return (
    <WoodModalFrame
      id="mercenary-guild-modal"
      title="용병 길드 — 용병 고용"
      ribbonVariant="red"
      frameVariant="wood"
      maxWidthClass="max-w-lg"
      onClose={onClose}
      headerRight={
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#29150b]/85 border border-[#b89568] text-xs font-black text-[#fde68a]">
          <span className="text-rose-300">🍖 {meat} 고기</span>
          <span>·</span>
          <span>🪙 {gold} 금화</span>
        </div>
      }
    >
      {/* Status Banner */}
      <div className="ts-paper-sheet p-2.5 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-black text-[#2b1810]">
            🛡️ 길드 소속 용병: <strong className="text-[#b91c1c]">{activeCount} / {maxTotal}명</strong>
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-black border shrink-0 ${
              canUseGuild
                ? 'bg-[#dcfce7] border-[#15803d] text-[#14532d]'
                : 'bg-[#fef3c7] border-[#b45309] text-[#78350f]'
            }`}
          >
            {canUseGuild
              ? '🛡️ 길드 입장 중'
              : hasGuildBuilt
                ? '🚶 용병 길드 앞으로 이동 필요'
                : '🏗️ 마을에 용병 길드 건설 필요'}
          </span>
        </div>
        <p className="text-[11px] font-bold text-[#6e4625]">
          고용된 용병은 길드와 영지 주변을 순찰하며 침입 마물을 자동 요격합니다. 전투 중 쓰러지면 다시 고용할 수 있습니다.
        </p>
      </div>

      {/* Active Mercenaries */}
      {activeCount > 0 && (
        <div className="ts-paper-sheet p-2 space-y-1.5">
          <div className="text-[11px] font-black text-[#4a301e]">현재 배치된 용병</div>
          <div className="grid grid-cols-2 gap-1.5">
            {mercenaries
              .filter((m) => m.hp > 0)
              .map((m) => {
                const hpPct = Math.max(0, Math.min(100, Math.round((m.hp / m.maxHp) * 100)));
                return (
                  <div
                    key={m.id}
                    className="px-2 py-1 rounded bg-[#f5ead6] border border-[#c7ab85] flex items-center justify-between gap-2 text-[11px] font-bold text-[#2b1810]"
                  >
                    <span className="truncate">{m.name}</span>
                    <span className="text-[10px] font-black text-[#15803d] shrink-0">
                      HP {m.hp}/{m.maxHp} ({hpPct}%)
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Hire Catalog */}
      <div className="space-y-2">
        {MERCENARY_CATALOG.map((merc) => {
          const enoughRes = meat >= merc.costMeat && gold >= merc.costGold;
          const canHire = canUseGuild && !isFull && enoughRes;

          return (
            <div
              key={merc.id}
              className="ts-paper-sheet p-2.5 flex items-center justify-between gap-3 border-2 border-[#a89070]"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-11 h-11 rounded-lg bg-[#2b1810]/10 border border-[#a89070] flex items-center justify-center text-2xl shrink-0">
                  {merc.icon}
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-black text-[#2b1810]">{merc.name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-[#b91c1c]/15 border border-[#b91c1c]/35 text-[10px] font-black text-[#991b1b]">
                      {merc.roleLabel}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-[#15803d]/15 text-[10px] font-black text-[#15803d]">
                      HP {merc.maxHp} · 공격 {merc.attack}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-[#5c422a] leading-snug">
                    {merc.description}
                  </p>
                </div>
              </div>

              <div className="shrink-0">
                <PixelGameButton
                  label={isFull ? '정원 가득' : `🍖${merc.costMeat} 🪙${merc.costGold} 고용`}
                  variant="red"
                  size="sm"
                  disabled={!canHire}
                  onClick={() => GameEvents.emit('hire-mercenary', merc.id)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </WoodModalFrame>
  );
};
