import React from 'react';
import { CheckCircle, Hammer, Lock, Sparkles } from 'lucide-react';
import { VILLAGE_TIER_CONFIGS } from '../../game/constants';
import { Inventory, Island } from '../../types/game';

export interface TerritoryDetailCardProps {
  selectedIsland: Island;
  isUnlocked: boolean;
  canAfford: boolean;
  inventory: Inventory;
  onCloseModal: () => void;
  onManageTerritory?: (territoryId: number) => void;
}

export const TerritoryDetailCard: React.FC<TerritoryDetailCardProps> = ({
  selectedIsland,
  isUnlocked,
  canAfford,
  inventory,
  onCloseModal,
  onManageTerritory,
}) => {
  const selectedTierCfg = VILLAGE_TIER_CONFIGS[selectedIsland.villageTier || 0];

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-3 sm:p-4 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">
            {selectedIsland.id === 0 ? '🏰' : isUnlocked ? '🏘️' : '🔒'}
          </span>
          <div>
            <h3 className="font-extrabold text-white text-sm sm:text-base">
              #{selectedIsland.id} {selectedIsland.name}
            </h3>
            <p className="text-xs text-emerald-300 font-semibold">
              {selectedIsland.resourceRichLabel || '마을 영지'}
            </p>
          </div>
        </div>

        <div>
          {isUnlocked ? (
            <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
              <CheckCircle className="w-3.5 h-3.5" /> {selectedTierCfg.name}
            </span>
          ) : canAfford ? (
            <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
              <Sparkles className="w-3.5 h-3.5" /> 점령 가능!
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-slate-700/60 text-slate-300 border border-slate-600 font-bold">
              <Lock className="w-3.5 h-3.5" /> 미점령
            </span>
          )}
        </div>
      </div>

      {isUnlocked ? (
        <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between">
          <div className="text-xs text-slate-300">
            💎 코어 보석 체력:{' '}
            <span className="font-black text-cyan-300">
              {selectedIsland.coreHp} / {selectedIsland.coreMaxHp} HP
            </span>
          </div>
          {onManageTerritory && (
            <button
              onClick={() => {
                onCloseModal();
                onManageTerritory(selectedIsland.id);
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black flex items-center gap-1 transition"
            >
              <Hammer className="w-3.5 h-3.5" />
              <span>마을 발전 & 건물 건설</span>
            </button>
          )}
        </div>
      ) : (
        <div className="mt-2 pt-2 border-t border-white/10">
          <div className="text-xs font-semibold text-slate-300 mb-1.5">땅 점령 필요 자원:</div>
          <div className="grid grid-cols-3 gap-2">
            <div
              className={`p-2 rounded-xl text-center border ${
                inventory.wood >= selectedIsland.costWood
                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                  : 'bg-red-950/30 border-red-500/40 text-red-300'
              }`}
            >
              <div className="text-xs">🪵 목재</div>
              <div className="font-extrabold text-sm">
                {inventory.wood} / {selectedIsland.costWood}
              </div>
            </div>

            <div
              className={`p-2 rounded-xl text-center border ${
                inventory.stone >= selectedIsland.costStone
                  ? 'bg-slate-800/60 border-slate-400/40 text-slate-200'
                  : 'bg-red-950/30 border-red-500/40 text-red-300'
              }`}
            >
              <div className="text-xs">🪨 석재</div>
              <div className="font-extrabold text-sm">
                {inventory.stone} / {selectedIsland.costStone}
              </div>
            </div>

            <div
              className={`p-2 rounded-xl text-center border ${
                inventory.gold >= selectedIsland.costGold
                  ? 'bg-yellow-950/40 border-yellow-500/40 text-yellow-200'
                  : 'bg-red-950/30 border-red-500/40 text-red-300'
              }`}
            >
              <div className="text-xs">🪙 금화</div>
              <div className="font-extrabold text-sm">
                {inventory.gold} / {selectedIsland.costGold}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
