import React from 'react';
import { ConstructedBuilding, Inventory } from '../types/game';
import {
  checkWallRepair,
  isWallBuilding,
  WALL_REPAIR_CONFIG,
} from '../game/systems/WallRepairRules';

export interface TerritoryWallRepairProps {
  territoryId: number;
  constructedBuildings: ConstructedBuilding[];
  inventory: Inventory;
  onRepairBuilding: (buildingId: string) => void;
  selectedSlotIndex?: number | null;
  onSelectSlot?: (slotIndex: number) => void;
}

const WALL_SLOT_DIRECTIONS: Record<number, { label: string; icon: string }> = {
  0: { label: '북쪽 방어선 (N)', icon: '⬆️' },
  1: { label: '남쪽 방어선 (S)', icon: '⬇️' },
  2: { label: '동쪽 방어선 (E)', icon: '➡️' },
  3: { label: '서쪽 방어선 (W)', icon: '⬅️' },
};

/**
 * 영지 내 4방향(북/남/동/서) 목책 및 성벽의 내구도 모니터링 및 개별 수리 컴포넌트
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

  const damagedWalls = territoryWalls.filter((w) => w.hp < w.maxHp);

  return (
    <div className="bg-[#2c180e]/90 border border-[#85532a] rounded-lg p-2.5 space-y-2 text-[#f3e4c7]">
      <div className="flex items-center justify-between gap-2 border-b border-[#85532a]/60 pb-1.5">
        <div className="flex items-center gap-1.5 text-xs font-black text-[#fde68a]">
          <span className="text-sm">🛡️</span>
          <span>외곽 4방향 목책 · 성벽 내구도 및 수리</span>
        </div>
        <div className="text-[11px] font-bold">
          {damagedWalls.length > 0 ? (
            <span className="text-[#f87171] bg-[#450a0a]/80 px-2 py-0.5 rounded border border-[#7f1d1d]">
              ⚠️ {damagedWalls.length}곳 손상됨
            </span>
          ) : territoryWalls.length === 4 ? (
            <span className="text-[#4ade80] bg-[#052e16]/80 px-2 py-0.5 rounded border border-[#14532d]">
              ✨ 4면 방어선 완벽
            </span>
          ) : (
            <span className="text-[#94a3b8] bg-[#0f172a]/60 px-2 py-0.5 rounded border border-[#334155]">
              방벽 {territoryWalls.length}/4 완료
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((slotIdx) => {
          const dir = WALL_SLOT_DIRECTIONS[slotIdx];
          const wall = wallMap.get(slotIdx);
          const isSelected = selectedSlotIndex === slotIdx;

          if (!wall) {
            return (
              <div
                key={slotIdx}
                onClick={() => onSelectSlot?.(slotIdx)}
                className={`p-2 rounded-lg border flex items-center justify-between gap-2 cursor-pointer transition ${
                  isSelected
                    ? 'bg-[#1e3a8a]/60 border-[#3b82f6]'
                    : 'bg-[#1a0f09]/60 border-[#5c3a21] hover:border-[#85532a]'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-sm">{dir.icon}</span>
                  <div>
                    <div className="font-bold text-[#d8c5aa] text-[11px]">#{slotIdx} {dir.label}</div>
                    <div className="text-[10px] text-[#9c8973]">미건설 (슬롯 비어있음)</div>
                  </div>
                </div>
                <span className="text-[10px] font-black text-[#38bdf8] bg-[#0369a1]/40 border border-[#0284c7] px-1.5 py-0.5 rounded">
                  건설 선택
                </span>
              </div>
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
              className={`p-2 rounded-lg border transition ${
                isDamaged
                  ? 'bg-[#3b1509]/80 border-[#b91c1c]/70'
                  : 'bg-[#1a0f09]/80 border-[#5c3a21]'
              } ${isSelected ? 'ring-2 ring-[#3b82f6]' : ''}`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1 text-xs font-black truncate">
                  <span>{dir.icon}</span>
                  <span className="text-[#fde68a] truncate">{wall.name}</span>
                </div>
                <span className="text-[10px] font-mono text-[#cbd5e1] shrink-0">
                  {wall.hp}/{wall.maxHp}
                </span>
              </div>

              {/* HP Progress Bar */}
              <div className="w-full bg-[#0f172a] h-2 rounded-full overflow-hidden border border-[#334155] mb-2">
                <div
                  className={`h-full ${barColor} transition-all duration-300`}
                  style={{ width: `${Math.round(ratio * 100)}%` }}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-[#85532a]/40">
                <div className="text-[10px] text-[#d8c5aa] flex items-center gap-1">
                  {isDamaged ? (
                    <>
                      <span>수리비:</span>
                      <span className="inline-flex items-center gap-0.5 text-[#86efac]">
                        🪵{cost.wood}
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-[#93c5fd]">
                        🪨{cost.stone}
                      </span>
                      {cost.gold > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[#fde047]">
                          🪙{cost.gold}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[#4ade80] font-bold">✨ 내구도 최대</span>
                  )}
                </div>

                {isDamaged ? (
                  <button
                    type="button"
                    disabled={!repairCheck.canRepair}
                    onClick={() => onRepairBuilding(wall.id)}
                    className={`px-2 py-1 rounded text-[11px] font-black inline-flex items-center gap-1 transition ${
                      repairCheck.canRepair
                        ? 'bg-[#15803d] hover:bg-[#166534] active:scale-95 text-white border border-[#22c55e] shadow'
                        : 'bg-[#475569]/60 text-[#94a3b8] border border-[#64748b]/40 cursor-not-allowed'
                    }`}
                    title={repairCheck.reason || `내구도 +${cost.healAmount} 회복`}
                  >
                    <span>🔨 수리</span>
                    <span className="text-[9px] opacity-80">(+{cost.healAmount})</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectSlot?.(slotIdx)}
                    className="px-1.5 py-0.5 rounded text-[10px] text-[#cbd5e1] hover:text-white bg-[#334155]/60 border border-[#475569]"
                  >
                    슬롯#{slotIdx}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
