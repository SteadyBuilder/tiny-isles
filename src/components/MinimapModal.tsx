import React, { useState } from 'react';
import { INITIAL_ISLANDS } from '../game/constants';
import { Inventory, Island, PlayerColor } from '../types/game';
import { X, CheckCircle, Lock, Compass, Sparkles } from 'lucide-react';

interface MinimapModalProps {
  isOpen: boolean;
  onClose: () => void;
  unlockedIslandIds: number[];
  inventory: Inventory;
  playerGridPos: { gridX: number; gridY: number };
  playerColor: PlayerColor;
  playerName: string;
}

export const MinimapModal: React.FC<MinimapModalProps> = ({
  isOpen,
  onClose,
  unlockedIslandIds,
  inventory,
  playerGridPos,
  playerColor,
  playerName,
}) => {
  if (!isOpen) return null;

  const unlockedCount = unlockedIslandIds.length;
  const totalCount = INITIAL_ISLANDS.length;
  const progressPercent = Math.round((unlockedCount / totalCount) * 100);

  // Default selected island is current player's island or island 0
  const currentIsland =
    INITIAL_ISLANDS.find(
      (isl) => isl.gridX === playerGridPos.gridX && isl.gridY === playerGridPos.gridY
    ) || INITIAL_ISLANDS[0];

  const [selectedIsland, setSelectedIsland] = useState<Island>(currentIsland);

  // 5x5 grid coordinates: -2, -1, 0, 1, 2
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
    return INITIAL_ISLANDS.find((isl) => isl.gridX === gx && isl.gridY === gy);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[#14213d] border border-amber-500/40 rounded-3xl p-4 sm:p-6 shadow-2xl text-white flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
              <Compass className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-amber-300 tracking-wide flex items-center gap-1.5">
                왕국 영지 전체 지도
              </h2>
              <p className="text-xs text-slate-400">
                개척 현황: <span className="text-emerald-400 font-bold">{unlockedCount}</span> / {totalCount} ({progressPercent}%)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full text-slate-300 hover:text-white transition"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
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
        <div className="my-3 sm:my-4 flex justify-center items-center overflow-auto p-2 bg-[#0d1627] rounded-2xl border border-white/10 shrink-0">
          <div className="grid grid-cols-5 gap-2 sm:gap-2.5 p-1 relative">
            {gridCoords.map((gy) =>
              gridCoords.map((gx) => {
                const island = getIslandAt(gx, gy);
                if (!island) {
                  return <div key={`${gx}_${gy}`} className="w-10 h-10 sm:w-12 sm:h-12 opacity-0" />;
                }

                const unlocked = isUnlocked(island.id);
                const affordable = canAffordIsland(island);
                const isPlayerHere = playerGridPos.gridX === gx && playerGridPos.gridY === gy;
                const isSelected = selectedIsland.id === island.id;

                let cardBg = 'bg-slate-800/80 border-slate-700 text-slate-400';
                if (unlocked) {
                  cardBg = island.id === 0
                    ? 'bg-blue-600/40 border-blue-400 text-blue-200'
                    : 'bg-emerald-600/40 border-emerald-400 text-emerald-200';
                } else if (affordable) {
                  cardBg = 'bg-amber-500/30 border-amber-400 text-amber-200 animate-pulse';
                }

                if (isSelected) {
                  cardBg += ' ring-2 ring-white ring-offset-2 ring-offset-slate-900';
                }

                return (
                  <button
                    key={island.id}
                    onClick={() => setSelectedIsland(island)}
                    className={`relative w-11 h-11 sm:w-13 sm:h-13 rounded-xl border flex flex-col items-center justify-center transition-all duration-150 transform hover:scale-105 active:scale-95 ${cardBg}`}
                    title={island.name}
                  >
                    <span className="text-xs font-black">
                      {island.id === 0 ? '🏰' : unlocked ? '🚩' : affordable ? '✨' : '🔒'}
                    </span>
                    <span className="text-[9px] font-bold leading-none mt-0.5 opacity-80">
                      {island.id}
                    </span>

                    {/* Current Player Marker */}
                    {isPlayerHere && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          playerColor === 'blue' ? 'bg-cyan-400' : 'bg-red-400'
                        }`} />
                        <span className={`relative inline-flex rounded-full h-4 w-4 border border-white items-center justify-center text-[8px] font-black ${
                          playerColor === 'blue' ? 'bg-cyan-500' : 'bg-red-500'
                        }`}>
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
                {selectedIsland.id === 0 ? '🏰' : isUnlocked(selectedIsland.id) ? '🚩' : '🔒'}
              </span>
              <div>
                <h3 className="font-extrabold text-white text-sm sm:text-base">
                  #{selectedIsland.id} {selectedIsland.name}
                </h3>
                <p className="text-xs text-slate-400">
                  영지 그리드 좌표: ({selectedIsland.gridX}, {selectedIsland.gridY})
                </p>
              </div>
            </div>

            <div>
              {isUnlocked(selectedIsland.id) ? (
                <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  <CheckCircle className="w-3.5 h-3.5" /> 개척 완료
                </span>
              ) : canAffordIsland(selectedIsland) ? (
                <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold animate-pulse">
                  <Sparkles className="w-3.5 h-3.5" /> 개척 가능!
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-slate-700/60 text-slate-300 border border-slate-600 font-bold">
                  <Lock className="w-3.5 h-3.5" /> 자원 필요
                </span>
              )}
            </div>
          </div>

          {/* Cost breakdown for locked territories */}
          {!isUnlocked(selectedIsland.id) && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <div className="text-xs font-semibold text-slate-300 mb-1.5">영지 개척 필요 자원:</div>
              <div className="grid grid-cols-3 gap-2">
                <div className={`p-2 rounded-xl text-center border ${
                  inventory.wood >= selectedIsland.costWood
                    ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                    : 'bg-red-950/30 border-red-500/40 text-red-300'
                }`}>
                  <div className="text-xs">🪵 목재</div>
                  <div className="font-extrabold text-sm">
                    {inventory.wood} / {selectedIsland.costWood}
                  </div>
                </div>

                <div className={`p-2 rounded-xl text-center border ${
                  inventory.stone >= selectedIsland.costStone
                    ? 'bg-slate-800/60 border-slate-400/40 text-slate-200'
                    : 'bg-red-950/30 border-red-500/40 text-red-300'
                }`}>
                  <div className="text-xs">🪨 석재</div>
                  <div className="font-extrabold text-sm">
                    {inventory.stone} / {selectedIsland.costStone}
                  </div>
                </div>

                <div className={`p-2 rounded-xl text-center border ${
                  inventory.gold >= selectedIsland.costGold
                    ? 'bg-yellow-950/40 border-yellow-500/40 text-yellow-200'
                    : 'bg-red-950/30 border-red-500/40 text-red-300'
                }`}>
                  <div className="text-xs">🪙 금화</div>
                  <div className="font-extrabold text-sm">
                    {inventory.gold} / {selectedIsland.costGold}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-3 text-center">
          <p className="text-[11px] text-slate-400">
            💡 미개척 영지 제단 근처로 이동하면 <span className="text-amber-300 font-bold">🚩 [개척]</span> 버튼이나 <kbd className="px-1 py-0.5 bg-slate-700 rounded text-white">E</kbd> 키로 개척할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
};
