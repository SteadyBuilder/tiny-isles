import React, { useState } from 'react';
import {
  MODE_ADVANTAGE_META,
  TRAIT_DEFINITIONS,
  calculateRefundableTraitPoints,
} from '../../data/metaProgression';
import {
  AuraEffectId,
  CostumeId,
  MetaProgressionState,
  ModeAdvantageTag,
  TraitId,
  UpgradeCategory,
} from '../../types/metaProgression';
import { WoodModalFrame } from '../ui/WoodModalFrame';
import { MetaCostumePanel } from './MetaCostumePanel';
import { MetaUpgradeCard } from './MetaUpgradeCard';

type MetaModalTab = UpgradeCategory | 'cosmetics';

interface MetaProgressionModalProps {
  isOpen: boolean;
  meta: MetaProgressionState;
  onClose: () => void;
  onUpgradeTrait: (traitId: TraitId) => void;
  onSelectOrUnlockTitle: (titleId: string) => void;
  onSelectOrUnlockCostume: (costumeId: CostumeId) => void;
  onSelectOrUnlockAura: (auraId: AuraEffectId) => void;
  onResetTraits: () => void;
}

const TAB_ITEMS: Array<{ id: MetaModalTab; label: string }> = [
  { id: 'base_stats', label: '기본 스탯' },
  { id: 'skills', label: '기본 스킬' },
  { id: 'mode_advantage', label: '모드 특화' },
  { id: 'cosmetics', label: '코스튬 · 칭호' },
];

const MODE_FILTER_OPTIONS: Array<{ id: 'all' | ModeAdvantageTag; label: string }> = [
  { id: 'all', label: '전체 보기' },
  { id: 'hunting_conquest', label: '🏹 사냥 & 던전' },
  { id: 'boss_slayer', label: '👑 대군주 토벌' },
  { id: 'territory_expansion', label: '🏝️ 섬 개척' },
  { id: 'sanctuary_defense', label: '🛡️ 성소 수호' },
];

export const MetaProgressionModal: React.FC<MetaProgressionModalProps> = ({
  isOpen,
  meta,
  onClose,
  onUpgradeTrait,
  onSelectOrUnlockTitle,
  onSelectOrUnlockCostume,
  onSelectOrUnlockAura,
  onResetTraits,
}) => {
  const [activeTab, setActiveTab] = useState<MetaModalTab>('base_stats');
  const [modeFilter, setModeFilter] = useState<'all' | ModeAdvantageTag>('all');

  if (!isOpen) return null;

  const refundablePoints = calculateRefundableTraitPoints(meta);
  const filteredTraits = TRAIT_DEFINITIONS.filter((t) => {
    if (t.category !== activeTab) return false;
    if (activeTab === 'mode_advantage' && modeFilter !== 'all') {
      return t.modeTag === modeFilter;
    }
    return true;
  });

  return (
    <WoodModalFrame
      title="별의 파편 성장소"
      ribbonVariant="red"
      frameVariant="wood"
      maxWidthClass="max-w-2xl"
      onClose={onClose}
      headerRight={
        <div className="flex items-center gap-1.5">
          {refundablePoints > 0 && (
            <button
              type="button"
              onClick={onResetTraits}
              title="투자한 스탯·스킬·모드 특화 별의 파편을 전액 무료 환급받습니다."
              className="px-2 py-1 rounded-lg bg-[#7f1d1d] hover:bg-[#991b1b] border border-[#fca5a5]/60 text-[11px] font-black text-[#fef2f2] transition"
            >
              무료 초기화 (+{refundablePoints}P)
            </button>
          )}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#29150b]/85 border border-[#b89568] text-xs font-black text-[#fde68a]">
            <img src="/assets/ui/Icons/Icon_07.png" alt="" className="w-4 h-4 pixel-art" />
            <span>{meta.points}P</span>
          </div>
        </div>
      }
    >
      {/* 카테고리 탭 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {TAB_ITEMS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-2.5 py-2 rounded-lg border-2 text-xs font-black transition ${
                active
                  ? 'bg-[#fde68a] border-[#92400e] text-[#2b1810] shadow-sm'
                  : 'bg-[#d9be94] border-[#a88659] text-[#4a2e16] hover:bg-[#e6cfab]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 탭 본문 */}
      {activeTab === 'cosmetics' ? (
        <MetaCostumePanel
          meta={meta}
          onSelectOrUnlockCostume={onSelectOrUnlockCostume}
          onSelectOrUnlockAura={onSelectOrUnlockAura}
          onSelectOrUnlockTitle={onSelectOrUnlockTitle}
        />
      ) : (
        <div className="ts-paper-sheet p-2.5 space-y-2.5">
          {activeTab === 'mode_advantage' && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-[#5c3c24]">
                즐길 모드에 맞춰 별의 파편을 집중 투자하세요. (상단 무료 초기화로 언제든 재분배 가능)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {MODE_FILTER_OPTIONS.map((opt) => {
                  const selected = modeFilter === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setModeFilter(opt.id)}
                      className={`px-2 py-1 rounded-md border text-[11px] font-black transition ${
                        selected
                          ? 'bg-[#2b1810] border-[#2b1810] text-[#fde68a]'
                          : 'bg-[#e6cfab] border-[#b89568] text-[#4a2e16] hover:bg-[#f0dec0]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {modeFilter !== 'all' && (
                <div className="text-[11px] font-black text-[#166534] bg-[#dcfce7] border border-[#86efac] rounded px-2 py-1">
                  {MODE_ADVANTAGE_META[modeFilter].summary}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredTraits.map((trait) => (
              <MetaUpgradeCard
                key={trait.id}
                trait={trait}
                level={meta.traitLevels[trait.id] ?? 0}
                points={meta.points}
                onUpgrade={onUpgradeTrait}
              />
            ))}
          </div>
        </div>
      )}
    </WoodModalFrame>
  );
};
