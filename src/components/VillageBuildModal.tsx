import React, { useState, useEffect } from 'react';
import {
  BuildingCategory,
  ConstructableType,
  ConstructedBuilding,
  Inventory,
  Island,
} from '../types/game';
import { CONSTRUCTABLE_BLUEPRINTS, VILLAGE_TIER_CONFIGS } from '../game/constants';
import { BuildingSystem } from '../game/BuildingSystem';
import { canBuildInTerritory } from '../game/territoryAccessRules';
import { WoodModalFrame } from './ui/WoodModalFrame';
import { PixelGameButton } from './ui/PixelGameButton';
import { VillageBlueprintCard } from './village/VillageBlueprintCard';

interface VillageBuildModalProps {
  isOpen: boolean;
  onClose: () => void;
  territories: Island[];
  playerId: string;
  playerStandingTerritoryId: number | null;
  constructedBuildings: ConstructedBuilding[];
  inventory: Inventory;
  onUpgradeVillage: (territoryId: number) => void;
  onConstructBuilding: (territoryId: number, type: ConstructableType, slotIndex?: number) => void;
  onSelectTowerPlacement?: (territoryId: number, type: ConstructableType) => void;
  onRepairCore: (territoryId: number) => void;
  onTestDestroyCore?: (territoryId: number) => void;
}

const CATEGORIES: ReadonlyArray<{ key: BuildingCategory; label: string; iconSrc: string }> = [
  { key: 'tower', label: '방어 타워', iconSrc: '/assets/buildings/Tower.png' },
  { key: 'wall', label: '성벽', iconSrc: '/assets/buildings/Wood_Palisade.png' },
  { key: 'basic', label: '기본 건물', iconSrc: '/assets/buildings/House1.png' },
  { key: 'special', label: '특수 건물', iconSrc: '/assets/ui/Icons/Icon_07.png' },
];

export const VillageBuildModal: React.FC<VillageBuildModalProps> = ({
  isOpen,
  onClose,
  territories,
  playerId,
  playerStandingTerritoryId,
  constructedBuildings,
  inventory,
  onUpgradeVillage,
  onConstructBuilding,
  onSelectTowerPlacement,
  onRepairCore,
}) => {
  const [activeCategory, setActiveCategory] = useState<BuildingCategory>('tower');
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);

  const curTerritory = territories.find((t) => t.id === playerStandingTerritoryId);
  const access = canBuildInTerritory(curTerritory, playerId, playerStandingTerritoryId);

  useEffect(() => {
    setSelectedSlotIndex(null);
  }, [playerStandingTerritoryId, isOpen]);

  if (!isOpen || !curTerritory || !access.allowed) return null;

  const curTier = curTerritory.villageTier;
  const tierCfg = VILLAGE_TIER_CONFIGS[curTier];
  const upgrade = BuildingSystem.checkUpgrade(curTerritory, inventory);
  const slotStates = BuildingSystem.getSlotStates(curTerritory.id, curTier, constructedBuildings);
  const maxSlots = BuildingSystem.getMaxSlots(curTier);
  const existingCount = BuildingSystem.getOccupiedSlotCount(curTerritory.id, constructedBuildings);
  const blueprints = CONSTRUCTABLE_BLUEPRINTS.filter((b) => b.category === activeCategory);

  const handleBuild = (type: ConstructableType) => {
    const bp = blueprints.find((b) => b.type === type);
    if (bp && onSelectTowerPlacement) {
      const canAfford =
        inventory.wood >= bp.costWood &&
        inventory.stone >= bp.costStone &&
        inventory.gold >= bp.costGold;
      if (!canAfford) return;
      if (bp.category !== 'tower') {
        const hasSlot = existingCount < maxSlots;
        if (!hasSlot) return;
      }
      onSelectTowerPlacement(curTerritory.id, type);
      onClose();
      return;
    }

    const check = BuildingSystem.checkBuild(
      curTerritory,
      type,
      inventory,
      constructedBuildings,
      selectedSlotIndex ?? undefined
    );
    if (!check.canBuild) return;
    onConstructBuilding(curTerritory.id, type, check.slotIndex!);
    setSelectedSlotIndex(null);
  };

  const shortTerritoryName = curTerritory.name.split(' (')[0];

  return (
    <WoodModalFrame
      id="village-build-modal"
      title={`#${curTerritory.id} ${shortTerritoryName} 건설`}
      ribbonVariant="blue"
      frameVariant="wood"
      maxWidthClass="max-w-3xl"
      onClose={onClose}
      headerRight={
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#29150b]/85 border border-[#b89568] text-xs font-black text-[#fde68a]">
          <img src="/assets/buildings/Castle.png" alt="" className="w-4 h-4 object-contain pixel-art" />
          <span>
            Lv.{curTier} {tierCfg.name} · 슬롯 {existingCount}/{maxSlots}
          </span>
        </div>
      }
    >
      {/* Tier Tech, Core Status & Slot Grid */}
      <div className="ts-paper-sheet p-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 tabular-nums">
            <div className="flex items-center gap-1.5 text-xs font-black text-[#166534]">
              <img src="/assets/ui/Icons/Icon_07.png" alt="" className="w-4 h-4 pixel-art" />
              <span>
                코어 {curTerritory.coreHp}/{curTerritory.coreMaxHp}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onRepairCore(curTerritory.id)}
              className="px-2 py-1 rounded-lg bg-[#4f803b] hover:bg-[#436e31] border border-[#2d4d21] text-[#fef5df] text-[10px] font-black inline-flex items-center gap-1 active:scale-95 transition"
              title="코어 및 방책 수리"
            >
              <img src="/assets/ui/Icons/Icon_Heart.png" alt="" className="w-3 h-3 pixel-art" />
              <span>수리</span>
              <img src="/assets/ui/Icons/Icon_02.png" alt="" className="w-3 h-3 pixel-art" />
              <span>5</span>
              <img src="/assets/decorations/Rock2.png" alt="" className="w-3 h-3 pixel-art" />
              <span>5</span>
            </button>
          </div>

          {upgrade.nextTier ? (
            <PixelGameButton
              id="upgrade-village-btn"
              label={`Lv.${upgrade.nextTier} ${VILLAGE_TIER_CONFIGS[upgrade.nextTier].name}`}
              subtitle={`목재${upgrade.costWood} · 석재${upgrade.costStone} · 금화${upgrade.costGold}`}
              iconSrc="/assets/ui/Icons/Icon_06.png"
              variant="blue"
              size="sm"
              disabled={!upgrade.canUpgrade}
              onClick={() => onUpgradeVillage(curTerritory.id)}
            />
          ) : (
            <span className="px-2.5 py-1 rounded-lg bg-[#fde68a] border-2 border-[#92400e] text-[#3a200f] text-xs font-black">
              👑 MAX 등급
            </span>
          )}
        </div>

        {/* Slot Grid Selector */}
        <div className="pt-2 border-t border-[#c7a97e]">
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1">
            {slotStates.map((slot) => {
              const isSelected = selectedSlotIndex === slot.slotIndex;
              const isOcc = Boolean(slot.building);
              const slotMark = slot.role === 'wall' ? '방벽' : '터';
              return (
                <button
                  key={slot.slotIndex}
                  type="button"
                  disabled={!slot.isUnlocked || isOcc}
                  onClick={() => setSelectedSlotIndex(isSelected ? null : slot.slotIndex)}
                  className={`py-1 px-1 rounded text-[10px] font-black border-2 transition truncate tabular-nums ${
                    !slot.isUnlocked
                      ? 'bg-[#d8c5aa] text-[#9c8973] border-[#c4b094] opacity-55 cursor-not-allowed'
                      : isOcc
                        ? 'bg-[#c7aa83] text-[#4a3221] border-[#ad8f67] cursor-not-allowed'
                        : isSelected
                          ? 'bg-[#2563eb] text-white border-[#1e40af] shadow'
                          : 'bg-[#fff5e2] text-[#6d4626] border-[#c4a479] hover:bg-[#ffeac4]'
                  }`}
                  title={
                    slot.building
                      ? `${slot.building.name} (HP ${slot.building.hp})`
                      : `슬롯 #${slot.slotIndex} (${slot.role})`
                  }
                >
                  #{slot.slotIndex} {isOcc ? '완료' : slotMark}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {CATEGORIES.map((cat) => {
          const active = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActiveCategory(cat.key)}
              className={`py-1.5 px-2 rounded-lg text-xs font-black border-2 transition flex items-center justify-center gap-1.5 ${
                active
                  ? 'bg-[#fde68a] text-[#2b1810] border-[#92400e] shadow'
                  : 'bg-[#3d2314]/85 text-[#f3e4c7] border-[#85532a] hover:brightness-110'
              }`}
            >
              <img src={cat.iconSrc} alt="" className="w-4 h-4 object-contain pixel-art shrink-0" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Blueprints Grid */}
      <div className="ts-paper-sheet p-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {blueprints.map((bp) => {
            const isTower = bp.category === 'tower' && Boolean(onSelectTowerPlacement);
            const hasSlot = existingCount < maxSlots;
            const canAfford =
              inventory.wood >= bp.costWood &&
              inventory.stone >= bp.costStone &&
              inventory.gold >= bp.costGold;
            const check = BuildingSystem.checkBuild(
              curTerritory,
              bp.type,
              inventory,
              constructedBuildings,
              selectedSlotIndex ?? undefined
            );
            const isEnabled = isTower ? canAfford : check.canBuild;
            const statusText = isTower
              ? canAfford
                ? '외곽 배치'
                : '자원 부족'
              : !hasSlot
                ? '슬롯 부족'
                : !canAfford
                  ? '자원 부족'
                  : check.canBuild
                    ? '건설 가능'
                    : bp.category === 'wall'
                      ? '4면 완료'
                      : '슬롯 부족';

            return (
              <VillageBlueprintCard
                key={bp.type}
                blueprint={bp}
                inventory={inventory}
                isTowerPlacement={isTower}
                isEnabled={isEnabled}
                statusText={statusText}
                onBuild={() => handleBuild(bp.type)}
              />
            );
          })}
        </div>
      </div>
    </WoodModalFrame>
  );
};
