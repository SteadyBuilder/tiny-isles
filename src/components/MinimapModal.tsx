import React, { useEffect, useState } from 'react';
import { INITIAL_ISLANDS, VILLAGE_TIER_CONFIGS } from '../game/constants';
import { Inventory, Island, PlayerColor } from '../types/game';
import { TerritoryDetailCard } from './minimap/TerritoryDetailCard';
import { WoodModalFrame } from './ui/WoodModalFrame';

interface MinimapModalProps {
  isOpen: boolean;
  onClose: () => void;
  territories?: Island[];
  unlockedIslandIds: number[];
  inventory: Inventory;
  playerGridPos: { gridX: number; gridY: number };
  playerId: string;
  playerStandingTerritoryId: number | null;
  playerColor: PlayerColor;
  playerName: string;
  onManageTerritory?: (territoryId: number) => void;
}

const GRID_COORDS = [-2, -1, 0, 1, 2] as const;

export const MinimapModal: React.FC<MinimapModalProps> = ({
  isOpen,
  onClose,
  territories = INITIAL_ISLANDS,
  unlockedIslandIds,
  inventory,
  playerGridPos,
  playerId,
  playerStandingTerritoryId,
  playerColor,
  onManageTerritory,
}) => {
  const currentIsland =
    territories.find(
      (isl) => isl.gridX === playerGridPos.gridX && isl.gridY === playerGridPos.gridY
    ) || territories[0];

  const [selectedId, setSelectedId] = useState<number>(currentIsland.id);

  useEffect(() => {
    if (isOpen) {
      setSelectedId(currentIsland.id);
    }
  }, [isOpen, currentIsland.id]);

  if (!isOpen) return null;

  const unlockedCount = unlockedIslandIds.length;
  const totalCount = territories.length;
  const progressPercent = Math.round((unlockedCount / totalCount) * 100);
  const selectedIsland = territories.find((isl) => isl.id === selectedId) || currentIsland;

  const isUnlocked = (id: number) => unlockedIslandIds.includes(id) || id === 0;

  const canAffordIsland = (isl: Island) =>
    inventory.wood >= isl.costWood &&
    inventory.stone >= isl.costStone &&
    inventory.gold >= isl.costGold;

  const getIslandAt = (gx: number, gy: number) =>
    territories.find((isl) => isl.gridX === gx && isl.gridY === gy);

  const playerAvatarSrc =
    playerColor === 'red'
      ? '/assets/ui/Human Avatars/Avatars_06.png'
      : '/assets/ui/Human Avatars/Avatars_01.png';

  return (
    <WoodModalFrame
      id="minimap-modal"
      title="영지 전략 지도"
      ribbonVariant="blue"
      frameVariant="wood"
      maxWidthClass="max-w-lg"
      onClose={onClose}
      headerRight={
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#29150b]/85 border border-[#b89568] text-xs font-black text-[#fde68a]">
          <img src="/assets/ui/Icons/Icon_Compass.png" alt="" className="w-4 h-4 pixel-art" />
          <span>
            점령 {unlockedCount}/{totalCount} ({progressPercent}%)
          </span>
        </div>
      }
    >
      {/* Progress Gauge Track */}
      <div className="ts-bar-track w-full h-4 overflow-hidden">
        <div className="w-full h-full bg-[#24160e] rounded-[2px] overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${progressPercent}%`,
              backgroundImage: 'linear-gradient(90deg, #16a34a 0%, #eab308 100%)',
            }}
          />
        </div>
      </div>

      {/* Interactive 5x5 Territory Map Parchment */}
      <div className="ts-paper-sheet p-2.5 flex justify-center items-center overflow-auto">
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2 p-0.5">
          {GRID_COORDS.map((gy) =>
            GRID_COORDS.map((gx) => {
              const island = getIslandAt(gx, gy);
              if (!island) {
                return <div key={`${gx}_${gy}`} className="w-12 h-12 sm:w-14 sm:h-14 opacity-0" />;
              }

              const unlocked = isUnlocked(island.id);
              const affordable = canAffordIsland(island);
              const isPlayerHere = playerGridPos.gridX === gx && playerGridPos.gridY === gy;
              const isSelected = selectedIsland.id === island.id;
              const tCfg = VILLAGE_TIER_CONFIGS[island.villageTier || 0];

              let tileClass = 'bg-[#d8be98] border-[#9e815b] text-[#5c422a]';
              if (unlocked) {
                tileClass =
                  island.id === 0
                    ? 'bg-[#dbeafe] border-[#2563eb] text-[#1e3a8a]'
                    : 'bg-[#dcfce7] border-[#15803d] text-[#14532d]';
              } else if (affordable) {
                tileClass = 'bg-[#fef3c7] border-[#b45309] text-[#78350f]';
              }

              const iconSrc =
                island.id === 0
                  ? '/assets/buildings/Castle.png'
                  : unlocked
                    ? '/assets/buildings/House1.png'
                    : island.id === 11
                      ? '/assets/resources/Gold_Stone_5.png'
                      : affordable
                        ? '/assets/ui/Icons/Icon_07.png'
                        : '/assets/ui/Icons/Icon_06.png';

              return (
                <button
                  key={island.id}
                  type="button"
                  onClick={() => setSelectedId(island.id)}
                  className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-lg border-2 flex flex-col items-center justify-center transition-transform active:scale-95 hover:brightness-105 ${tileClass} ${
                    isSelected ? 'ring-2 ring-[#92400e] ring-offset-2 ring-offset-[#f1dfc3] scale-[1.03]' : ''
                  }`}
                  title={island.name}
                >
                  <img
                    src={iconSrc}
                    alt=""
                    className={`w-5 h-5 object-contain pixel-art ${
                      !unlocked && !affordable && island.id !== 11 ? 'opacity-50 grayscale' : ''
                    }`}
                  />
                  <span className="text-[9px] font-black leading-none mt-0.5 truncate max-w-full px-0.5">
                    {unlocked ? tCfg.name : `#${island.id}`}
                  </span>
                  {!unlocked && (
                    <span className="text-[8px] font-extrabold opacity-80 leading-none mt-0.5">
                      {island.id === 11 ? '금광' : '미점령'}
                    </span>
                  )}

                  {isPlayerHere && (
                    <img
                      src={playerAvatarSrc}
                      alt="내 위치"
                      className="absolute -top-2 -right-2 w-5 h-5 object-contain pixel-art drop-shadow"
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Selected Territory Detail Card */}
      <TerritoryDetailCard
        selectedIsland={selectedIsland}
        isUnlocked={isUnlocked(selectedIsland.id)}
        canAfford={canAffordIsland(selectedIsland)}
        inventory={inventory}
        playerId={playerId}
        playerStandingTerritoryId={playerStandingTerritoryId}
        onCloseModal={onClose}
        onManageTerritory={onManageTerritory}
      />
    </WoodModalFrame>
  );
};
