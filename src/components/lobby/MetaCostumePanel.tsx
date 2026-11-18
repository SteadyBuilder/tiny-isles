import React from 'react';
import {
  AURA_DEFINITIONS,
  COSMETIC_TITLES,
  COSTUME_DEFINITIONS,
} from '../../data/metaProgression';
import { AuraEffectId, CostumeId, MetaProgressionState } from '../../types/metaProgression';

interface MetaCostumePanelProps {
  meta: MetaProgressionState;
  onSelectOrUnlockCostume: (costumeId: CostumeId) => void;
  onSelectOrUnlockAura: (auraId: AuraEffectId) => void;
  onSelectOrUnlockTitle: (titleId: string) => void;
}

export const MetaCostumePanel: React.FC<MetaCostumePanelProps> = ({
  meta,
  onSelectOrUnlockCostume,
  onSelectOrUnlockAura,
  onSelectOrUnlockTitle,
}) => {
  return (
    <div className="space-y-3">
      {/* 캐릭터 코스튬 (순수 외형) */}
      <div className="ts-paper-sheet p-2.5 space-y-2">
        <div className="text-xs font-black text-[#3a200f] flex items-center justify-between">
          <span>캐릭터 코스튬 (순수 외형 · 전직 포함 적용)</span>
          <span className="text-[10px] font-bold text-[#6b4423]">영구 해금</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {COSTUME_DEFINITIONS.map((costume) => {
            const unlocked = meta.unlockedCostumeIds.includes(costume.id);
            const equipped = meta.equippedCostumeId === costume.id;
            const canBuy = !unlocked && meta.points >= costume.costPoints;

            return (
              <button
                key={costume.id}
                type="button"
                disabled={!unlocked && !canBuy}
                onClick={() => onSelectOrUnlockCostume(costume.id)}
                className={`p-2 rounded-lg border-2 text-left transition flex items-center justify-between gap-2 ${
                  equipped
                    ? 'bg-[#fde68a] border-[#92400e]'
                    : unlocked
                      ? 'bg-[#e6cfab] border-[#b89568] hover:bg-[#f0dec0]'
                      : 'bg-[#dcc39c] border-[#bfa27a] opacity-85'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-6 h-6 rounded-md border-2 border-[#2b1810] shrink-0 shadow-inner"
                    style={{ backgroundColor: costume.previewColorHex }}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-black text-[#2b1810] truncate">
                      {costume.name}
                    </div>
                    <div className="text-[10px] font-semibold text-[#5c3c24] truncate">
                      {costume.description}
                    </div>
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
                  {equipped ? '장착 중' : unlocked ? '장착' : `${costume.costPoints}P`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 오라 이펙트 */}
      <div className="ts-paper-sheet p-2.5 space-y-2">
        <div className="text-xs font-black text-[#3a200f]">발밑 오라 이펙트</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {AURA_DEFINITIONS.map((aura) => {
            const unlocked = meta.unlockedAuraIds.includes(aura.id);
            const equipped = meta.equippedAuraId === aura.id;
            const canBuy = !unlocked && meta.points >= aura.costPoints;

            return (
              <button
                key={aura.id}
                type="button"
                disabled={!unlocked && !canBuy}
                onClick={() => onSelectOrUnlockAura(aura.id)}
                className={`p-2 rounded-lg border-2 text-left transition flex items-center justify-between gap-2 ${
                  equipped
                    ? 'bg-[#fde68a] border-[#92400e]'
                    : unlocked
                      ? 'bg-[#e6cfab] border-[#b89568] hover:bg-[#f0dec0]'
                      : 'bg-[#dcc39c] border-[#bfa27a] opacity-85'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-black text-[#2b1810] truncate">{aura.name}</div>
                  <div className="text-[10px] font-semibold text-[#5c3c24] truncate">
                    {aura.description}
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
                  {equipped ? '장착 중' : unlocked ? '장착' : `${aura.costPoints}P`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 수호자 칭호 */}
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
                      : 'bg-[#dcc39c] border-[#bfa27a] opacity-85'
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
    </div>
  );
};
