import React from 'react';
import { X, Sparkles, ArrowUpCircle, Award } from 'lucide-react';
import {
  COSMETIC_TITLES,
  TRAIT_DEFINITIONS,
  getTraitUpgradeCost,
} from '../../data/metaProgression';
import { MetaProgressionState, TraitId } from '../../types/room';

interface MetaProgressionModalProps {
  isOpen: boolean;
  meta: MetaProgressionState;
  onClose: () => void;
  onUpgradeTrait: (traitId: TraitId) => void;
  onSelectOrUnlockTitle: (titleId: string) => void;
}

export const MetaProgressionModal: React.FC<MetaProgressionModalProps> = ({
  isOpen,
  meta,
  onClose,
  onUpgradeTrait,
  onSelectOrUnlockTitle,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-3xl border border-amber-500/40 bg-slate-900 p-6 text-white shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-black text-amber-300">원정대 영구 성장 & 칭호</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-xs font-bold text-emerald-300">
              보유 포인트: {meta.points}P
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 영구 특성 */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            영구 특성 (모든 인스턴스 룸에 적용)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {TRAIT_DEFINITIONS.map((trait) => {
              const level = meta.traitLevels[trait.id] ?? 0;
              const isMax = level >= trait.maxLevel;
              const cost = getTraitUpgradeCost(trait, level);
              const canAfford = !isMax && meta.points >= cost;

              return (
                <div
                  key={trait.id}
                  className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex flex-col justify-between gap-2.5"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">{trait.name}</span>
                      <span className="text-xs font-black text-amber-300">
                        Lv.{level}/{trait.maxLevel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{trait.description}</p>
                    <p className="text-[11px] text-emerald-300 mt-1.5 font-semibold">
                      {trait.effectPerLevelLabel}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => onUpgradeTrait(trait.id)}
                    className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition ${
                      isMax
                        ? 'bg-slate-800 text-slate-500 cursor-default'
                        : canAfford
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-white/5 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <ArrowUpCircle className="w-4 h-4" />
                    <span>{isMax ? '최고 레벨 도달' : `강화 (${cost}P)`}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* 코스메틱 칭호 */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-400" />
            <span>칭호 코스메틱</span>
          </h3>
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
                  className={`p-3 rounded-2xl border text-left transition flex items-center justify-between gap-2 ${
                    equipped
                      ? 'bg-amber-500/20 border-amber-400'
                      : unlocked
                      ? 'bg-black/40 border-white/15 hover:border-white/30'
                      : 'bg-black/25 border-white/5 opacity-80'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-white">{title.label}</div>
                    <div className="text-[11px] text-slate-400">{title.description}</div>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0 ${
                      equipped
                        ? 'bg-amber-400 text-slate-950'
                        : unlocked
                        ? 'bg-white/10 text-slate-200'
                        : canBuy
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white/5 text-slate-500'
                    }`}
                  >
                    {equipped ? '장착 중' : unlocked ? '장착' : `${title.costPoints}P 해금`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
