import React from 'react';
import {
  COSMETIC_TITLES,
  TRAIT_DEFINITIONS,
  getTraitUpgradeCost,
} from '../../data/metaProgression';
import { MetaProgressionState, TraitId } from '../../types/room';
import { PixelGameButton } from '../ui/PixelGameButton';
import { WoodModalFrame } from '../ui/WoodModalFrame';

interface MetaProgressionModalProps {
  isOpen: boolean;
  meta: MetaProgressionState;
  onClose: () => void;
  onUpgradeTrait: (traitId: TraitId) => void;
  onSelectOrUnlockTitle: (titleId: string) => void;
}

const TRAIT_ICON_MAP: Record<TraitId, string> = {
  starter_supplies: '/assets/ui/Icons/Icon_01.png',
  gatherer_blessing: '/assets/ui/Icons/Icon_07.png',
  guardian_might: '/assets/ui/Icons/Icon_05.png',
  citadel_fortification: '/assets/ui/Icons/Icon_06.png',
};

export const MetaProgressionModal: React.FC<MetaProgressionModalProps> = ({
  isOpen,
  meta,
  onClose,
  onUpgradeTrait,
  onSelectOrUnlockTitle,
}) => {
  if (!isOpen) return null;

  return (
    <WoodModalFrame
      title="원정대 특성 & 칭호"
      ribbonVariant="red"
      frameVariant="wood"
      maxWidthClass="max-w-2xl"
      onClose={onClose}
      headerRight={
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#29150b]/85 border border-[#b89568] text-xs font-black text-[#fde68a]">
          <img src="/assets/ui/Icons/Icon_07.png" alt="" className="w-4 h-4 pixel-art" />
          <span>보유 별의 파편: {meta.points}P</span>
        </div>
      }
    >
      {/* 영구 특성 */}
      <div className="ts-paper-sheet p-2.5 space-y-2">
        <div className="text-xs font-black text-[#3a200f]">
          영구 특성 (모든 인스턴스 룸에 적용)
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TRAIT_DEFINITIONS.map((trait) => {
            const level = meta.traitLevels[trait.id] ?? 0;
            const isMax = level >= trait.maxLevel;
            const cost = getTraitUpgradeCost(trait, level);
            const canAfford = !isMax && meta.points >= cost;

            return (
              <div
                key={trait.id}
                className="p-2.5 rounded-lg bg-[#e6cfab] border-2 border-[#b89568] flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <img
                        src={TRAIT_ICON_MAP[trait.id]}
                        alt=""
                        className="w-4 h-4 pixel-art shrink-0"
                      />
                      <span className="text-xs font-black text-[#2b1810] truncate">
                        {trait.name}
                      </span>
                    </div>
                    <span className="text-[11px] font-black text-[#92400e] shrink-0">
                      Lv.{level}/{trait.maxLevel}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-[#5c3c24] mt-1 leading-snug">
                    {trait.description}
                  </p>
                  <p className="text-[11px] font-black text-[#166534] mt-1">
                    {trait.effectPerLevelLabel}
                  </p>
                </div>

                <PixelGameButton
                  label={isMax ? '최고 레벨' : `강화 (${cost}P)`}
                  variant={isMax ? 'red' : 'blue'}
                  size="sm"
                  fullWidth
                  disabled={!canAfford}
                  onClick={() => onUpgradeTrait(trait.id)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* 칭호 코스메틱 */}
      <div className="ts-paper-sheet p-2.5 space-y-2">
        <div className="text-xs font-black text-[#3a200f] flex items-center gap-1.5">
          <img src="/assets/ui/Icons/Icon_03.png" alt="" className="w-4 h-4 pixel-art" />
          <span>수호자 칭호</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {COSMETIC_TITLES.map((title) => {
            const unlocked = meta.unlockedTitleIds.includes(title.id);
            const equipped = meta.equippedTitleId === title.id;
            const canBuy = !unlocked && meta.points >= title.costPoints;

            return (
              <button
                key={title.id}
                type="button"
                disabled={!unlocked && !canBuy}
                onClick={() => onSelectOrUnlockTitle(title.id)}
                className={`p-2 rounded-lg border-2 text-left transition flex items-center justify-between gap-2 ${
                  equipped
                    ? 'bg-[#fde68a] border-[#92400e]'
                    : unlocked
                      ? 'bg-[#e6cfab] border-[#b89568] hover:bg-[#f0dec0]'
                      : 'bg-[#dcc39c] border-[#bfa27a] opacity-80'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-black text-[#2b1810] truncate">{title.label}</div>
                  <div className="text-[10px] font-semibold text-[#5c3c24] truncate">
                    {title.description}
                  </div>
                </div>
                <span
                  className={`text-[10px] font-black px-2 py-1 rounded shrink-0 ${
                    equipped
                      ? 'bg-[#92400e] text-[#fef3c7]'
                      : unlocked
                        ? 'bg-[#4f803b] text-[#fef5df]'
                        : canBuy
                          ? 'bg-[#2563eb] text-white'
                          : 'bg-[#a89070] text-[#4a301e]'
                  }`}
                >
                  {equipped ? '장착 중' : unlocked ? '장착' : `${title.costPoints}P`}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </WoodModalFrame>
  );
};
