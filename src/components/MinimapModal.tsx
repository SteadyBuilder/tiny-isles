import React, { useState } from 'react';
import { INITIAL_ISLANDS, VILLAGE_TIER_CONFIGS } from '../game/constants';
import { Inventory, Island, PlayerColor } from '../types/game';
import { CheckCircle, Lock, Compass, Sparkles, Hammer } from 'lucide-react';

interface MinimapModalProps {
  isOpen: boolean;
  onClose: () => void;
  territories?: Island[];
  unlockedIslandIds: number[];
  inventory: Inventory;
  playerGridPos: { gridX: number; gridY: number };
  playerColor: PlayerColor;
  playerName: string;
  onManageTerritory?: (territoryId: number) => void;
}

export const MinimapModal: React.FC<MinimapModalProps> = ({
  isOpen,
  onClose,
  territories = INITIAL_ISLANDS,
  unlockedIslandIds,
  inventory,
  playerGridPos,
  playerColor,
  onManageTerritory,
}) => {
  if (!isOpen) return null;

  const unlockedCount = unlockedIslandIds.length;
  const totalCount = territories.length;
  const progressPercent = Math.round((unlockedCount / totalCount) * 100);

  const currentIsland =
    territories.find(
      (isl) => isl.gridX === playerGridPos.gridX && isl.gridY === playerGridPos.gridY
    ) || territories[0];

  const [selectedId, setSelectedId] = useState<number>(currentIsland.id);
  const selectedIsland =
    territories.find((isl) => isl.id === selectedId) || currentIsland;

  const gridCoords = [-2, -1, 0, 1, 2];

  const isUnlocked = (id: number) => unlockedIslandIds.includes(id) || id === 0;

  const canAffordIsland = (isl: Island) => {
    return (
      inventory.wood >= isl.costWood &&
      inventory.stone >= isl.costStone &&
      inventory.gold >= isl.costGold
    );
  };

  const getIslandAt = (gx: number, gy: number) => {
    return territories.find((isl) => isl.gridX === gx && isl.gridY === gy);
  };

  const selectedTierCfg = VILLAGE_TIER_CONFIGS[selectedIsland.villageTier || 0];

  return (
    <div
      id="minimap-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[#14213d] border border-amber-500/40 rounded-3xl p-4 sm:p-6 shadow-2xl text-white flex flex-col max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-amber-300 tracking-wide">
                전체 마을 & 영지 전략 지도
              </h2>
              <p className="text-xs text-slate-400">
                점령한 땅: <span className="text-emerald-400 font-bold">{unlockedCount}</span> / {totalCount} ({progressPercent}%) · 외곽에서 마물 진입
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="relative w-8 h-8 active:scale-90 transition-transform flex items-center justify-center"
            aria-label="닫기"
          >
            <img
              src="/assets/ui/Buttons/SmallRedRoundButton_Regular.png"
              alt="close"
              className="w-full h-full pixel-art select-none"
            />
            <img
              src="/assets/ui/Icons/Icon_09.png"
              alt="x"
              className="absolute w-3.5 h-3.5 pixel-art"
            />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-800 h-2 rounded-full mt-3 overflow-hidden shrink-0 border border-white/5">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Interactive 5x5 Map Grid */}
        <div className="my-3 flex justify-center items-center overflow-auto p-2 bg-[#0d1627] rounded-2xl border border-white/10 shrink-0">
          <div className="grid grid-cols-5 gap-2 p-1 relative">
            {gridCoords.map((gy) =>
              gridCoords.map((gx) => {
                const island = getIslandAt(gx, gy);
                if (!island) {
                  return <div key={`${gx}_${gy}`} className="w-11 h-11 sm:w-12 sm:h-12 opacity-0" />;
                }

                const unlocked = isUnlocked(island.id);
                const affordable = canAffordIsland(island);
                const isPlayerHere = playerGridPos.gridX === gx && playerGridPos.gridY === gy;
                const isSelected = selectedIsland.id === island.id;
                const tCfg = VILLAGE_TIER_CONFIGS[island.villageTier || 0];

                let cardBg = 'bg-slate-800/80 border-slate-700 text-slate-400';
                if (unlocked) {
                  cardBg =
                    island.id === 0
                      ? 'bg-blue-600/40 border-blue-400 text-blue-200'
                      : 'bg-emerald-600/40 border-emerald-400 text-emerald-200';
                } else if (affordable) {
                  cardBg = 'bg-amber-500/30 border-amber-400 text-amber-200';
                }

                if (isSelected) {
                  cardBg += ' ring-2 ring-white ring-offset-2 ring-offset-slate-900';
                }

                return (
                  <button
                    key={island.id}
                    onClick={() => setSelectedId(island.id)}
                    className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl border flex flex-col items-center justify-center transition-all duration-150 transform hover:scale-105 active:scale-95 ${cardBg}`}
                    title={island.name}
                  >
                    <span className="text-xs font-black">
                      {island.id === 0
                        ? '🏰'
                        : unlocked
                        ? '🏘️'
                        : island.id === 11
                        ? '⛏️'
                        : affordable
                        ? '✨'
                        : '🔒'}
                    </span>
                    <span className="text-[9px] font-bold leading-none mt-0.5">
                      {unlocked ? tCfg.name : `#${island.id}`}
                    </span>
                    {!unlocked && (
                      <span
                        className={`text-[8px] font-bold ${
                          island.id === 11 ? 'text-yellow-300' : 'text-amber-300/80'
                        }`}
                      >
                        {island.id === 11 ? '황금광산' : '건설터'}
                      </span>
                    )}

                    {isPlayerHere && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                        <span
                          className={`relative inline-flex rounded-full h-4 w-4 border border-white items-center justify-center text-[8px] font-black ${
                            playerColor === 'blue' ? 'bg-cyan-500' : 'bg-red-500'
                          }`}
                        >
                          나
                        </span>
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Territory Detail Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3 sm:p-4 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">
                {selectedIsland.id === 0 ? '🏰' : isUnlocked(selectedIsland.id) ? '🏘️' : '🔒'}
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
              {isUnlocked(selectedIsland.id) ? (
                <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  <CheckCircle className="w-3.5 h-3.5" /> {selectedTierCfg.name}
                </span>
              ) : canAffordIsland(selectedIsland) ? (
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

          {isUnlocked(selectedIsland.id) ? (
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
                    onClose();
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
      </div>
    </div>
  );
};
