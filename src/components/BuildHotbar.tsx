import React from 'react';
import { BuildingType, Inventory } from '../types/game';
import { BUILDING_DEFS } from '../game/constants';
import { Shield, Castle, Crosshair, Flame, X, Hammer } from 'lucide-react';

interface BuildHotbarProps {
  selectedBuilding: BuildingType | null;
  onSelectBuilding: (type: BuildingType | null) => void;
  inventory: Inventory;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const BuildHotbar: React.FC<BuildHotbarProps> = ({
  selectedBuilding,
  onSelectBuilding,
  inventory,
  isOpen,
  onToggleOpen,
}) => {
  const getIcon = (type: BuildingType) => {
    switch (type) {
      case 'fence':
        return <Shield className="w-5 h-5 text-amber-400" />;
      case 'wall':
        return <Castle className="w-5 h-5 text-stone-300" />;
      case 'arrow_tower':
        return <Crosshair className="w-5 h-5 text-emerald-400" />;
      case 'cannon_tower':
        return <Flame className="w-5 h-5 text-rose-400" />;
    }
  };

  const buildingTypes: BuildingType[] = ['fence', 'wall', 'arrow_tower', 'cannon_tower'];

  return (
    <div className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center pointer-events-none select-none">
      {/* 토글된 핫바 컨테이너 */}
      {isOpen && (
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-amber-500/30 rounded-2xl p-2.5 sm:p-3 shadow-2xl flex flex-col items-center gap-2 max-w-[92vw] sm:max-w-none animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center justify-between w-full px-1">
            <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Hammer className="w-3.5 h-3.5" />
              건설 핫바 (탭하여 전방에 배치)
            </span>
            <button
              onClick={onToggleOpen}
              className="text-slate-400 hover:text-white p-1 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto py-1 px-0.5">
            {buildingTypes.map((type) => {
              const def = BUILDING_DEFS[type];
              const isSelected = selectedBuilding === type;
              const canAfford =
                inventory.wood >= def.costWood &&
                inventory.stone >= def.costStone &&
                inventory.gold >= def.costGold;

              return (
                <button
                  key={type}
                  onClick={() => {
                    if (isSelected) {
                      onSelectBuilding(null);
                    } else if (canAfford) {
                      onSelectBuilding(type);
                    }
                  }}
                  disabled={!canAfford && !isSelected}
                  className={`relative flex flex-col items-center p-2.5 sm:p-3 rounded-xl min-w-[76px] sm:min-w-[88px] transition-all border ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-105'
                      : canAfford
                      ? 'bg-slate-800/80 border-slate-700 hover:border-slate-500 active:scale-95'
                      : 'bg-slate-850/50 border-slate-800 opacity-45 cursor-not-allowed'
                  }`}
                >
                  {/* 아이콘 */}
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-slate-950/60 flex items-center justify-center mb-1 shadow-inner">
                    {getIcon(type)}
                  </div>

                  {/* 건물 이름 */}
                  <span className="text-xs font-semibold text-slate-100 whitespace-nowrap mb-1">
                    {def.name}
                  </span>

                  {/* 비용 표시 */}
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-300">
                    {def.costWood > 0 && (
                      <span className="flex items-center text-amber-300">
                        🪵{def.costWood}
                      </span>
                    )}
                    {def.costStone > 0 && (
                      <span className="flex items-center text-stone-300">
                        🪨{def.costStone}
                      </span>
                    )}
                    {def.costGold > 0 && (
                      <span className="flex items-center text-yellow-400">
                        🪙{def.costGold}
                      </span>
                    )}
                  </div>

                  {isSelected && (
                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center text-[10px] text-slate-950 font-black animate-pulse">
                      ✓
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {selectedBuilding && (
            <div className="text-[11px] text-amber-200/90 font-medium bg-amber-950/40 px-3 py-1 rounded-full border border-amber-500/20">
              💡 캐릭터 전방 유효 위치에 설치됩니다. 모바일에서는 [설치하기] 버튼을 누르세요.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
