import React from 'react';
import { ConstructedBuilding, Inventory } from '../types/game';
import {
  checkWallRepair,
  isWallBuilding,
  WALL_REPAIR_CONFIG,
} from '../game/systems/WallRepairRules';
import { PixelSquareButton } from './ui/PixelSquareButton';

export interface TerritoryWallRepairProps {
  territoryId: number;
  constructedBuildings: ConstructedBuilding[];
  inventory: Inventory;
  onRepairBuilding: (buildingId: string) => void;
  selectedSlotIndex?: number | null;
  onSelectSlot?: (slotIndex: number) => void;
}

const WALL_SLOT_DIRECTIONS: Record<number, { label: string; short: string; icon: string }> = {
  0: { label: '북쪽 방어선', short: 'N', icon: '⬆️' },
  1: { label: '남쪽 방어선', short: 'S', icon: '⬇️' },
  2: { label: '동쪽 방어선', short: 'E', icon: '➡️' },
  3: { label: '서쪽 방어선', short: 'W', icon: '⬅️' },
};

/**
 * 영지 내 4방향(북/남/동/서) 목책 및 성벽 내구도 모니터링 및 아이콘 기반 수리 카드
 */
export const TerritoryWallRepairCard: React.FC<TerritoryWallRepairProps> = ({
  territoryId,
  constructedBuildings,
  inventory,
  onRepairBuilding,
  selectedSlotIndex,
  onSelectSlot,
}) => {
  const territoryWalls = constructedBuildings.filter(
    (b) => b.territoryId === territoryId && isWallBuilding(b) && b.slotIndex >= 0 && b.slotIndex <= 3
  );

  const wallMap = new Map<number, ConstructedBuilding>();
  territoryWalls.forEach((w) => wallMap.set(w.slotIndex, w));

  return (
    <div className="bg-[#2c180e]/90 border border-[#85532a] rounded-lg p-2 text-[#f3e4c7]">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {[0, 1, 2, 3].map((slotIdx) => {
          const dir = WALL_SLOT_DIRECTIONS[slotIdx];
          const wall = wallMap.get(slotIdx);
          const isSelected = selectedSlotIndex === slotIdx;

          if (!wall) {
            return (
              <button
                key={slotIdx}
                type="button"
                onClick={() => onSelectSlot?.(slotIdx)}
                title={`${dir.label} (미건설)`}
                className={`p-1.5 rounded-lg border flex items-center justify-between gap-1 text-left transition ${
                  isSelected
                    ? 'bg-[#1e3a8a]/60 border-[#3b82f6]'
                    : 'bg-[#1a0f09]/60 border-[#5c3a21] hover:border-[#85532a]'
                }`}
              >
                <span className="text-xs font-black text-[#d8c5aa]">
                  {dir.icon} {dir.short}
                </span>
                <span className="text-[10px] font-bold text-[#9c8973]">미건설</span>
              </button>
            );
          }

          const ratio = Math.max(0, Math.min(1, wall.hp / wall.maxHp));
          const isDamaged = wall.hp < wall.maxHp;
          const repairCheck = checkWallRepair(wall, inventory);
          const cost = repairCheck.cost || WALL_REPAIR_CONFIG[wall.type as 'wood_wall' | 'stone_wall'] || {
            wood: 2,
            stone: 1,
            gold: 0,
            healAmount: 100,
          };

          const barColor =
            ratio > 0.5 ? 'bg-[#22c55e]' : ratio > 0.25 ? 'bg-[#eab308]' : 'bg-[#ef4444]';

          return (
            <div
              key={slotIdx}
              className={`p-1.5 rounded-lg border flex items-center justify-between gap-1.5 transition ${
                isDamaged
                  ? 'bg-[#3b1509]/80 border-[#b91c1c]/70'
                  : 'bg-[#1a0f09]/80 border-[#5c3a21]'
              } ${isSelected ? 'ring-2 ring-[#3b82f6]' : ''}`}
              title={`${dir.label} - ${wall.name} (${wall.hp}/${wall.maxHp})`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 text-[10px] font-black mb-1">
                  <span className="text-[#fde68a]">
                    {dir.icon} {dir.short}
                  </span>
                  <span className="font-mono text-[#cbd5e1] tabular-nums">
                    {wall.hp}/{wall.maxHp}
                  </span>
                </div>
                <div className="w-full bg-[#0f172a] h-1.5 rounded-full overflow-hidden border border-[#334155]">
                  <div
                    className={`h-full ${barColor} transition-all duration-300`}
                    style={{ width: `${Math.round(ratio * 100)}%` }}
                  />
                </div>
                {isDamaged && (
                  <div className="flex items-center gap-1.5 mt-1 text-[9px] font-black tabular-nums">
                    <span className={inventory.wood >= cost.wood ? 'text-[#86efac]' : 'text-[#fca5a5]'}>
                      <img src="/assets/ui/Icons/Icon_02.png" alt="" className="w-2.5 h-2.5 inline pixel-art mr-0.5" />
                      {cost.wood}
                    </span>
                    <span className={inventory.stone >= cost.stone ? 'text-[#93c5fd]' : 'text-[#fca5a5]'}>
                      <img src="/assets/decorations/Rock2.png" alt="" className="w-2.5 h-2.5 inline pixel-art mr-0.5" />
                      {cost.stone}
                    </span>
                  </div>
                )}
              </div>

              {isDamaged && (
                <PixelSquareButton
                  iconSrc="/assets/ui/Icons/Tool_Hammer.png"
                  alt="성벽 수리"
                  title={repairCheck.reason || `수리 (+${cost.healAmount} HP)`}
                  variant="blue"
                  size="xs"
                  disabled={!repairCheck.canRepair}
                  onClick={() => onRepairBuilding(wall.id)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
