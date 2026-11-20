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
import { isWallBuilding } from '../game/systems/WallRepairRules';
import { TerritoryWallRepairCard } from './TerritoryWallRepairCard';
import { canBuildInTerritory } from '../game/territoryAccessRules';
import { WoodModalFrame } from './ui/WoodModalFrame';
import { PixelSquareButton } from './ui/PixelSquareButton';
import { VillageBlueprintCard } from './village/VillageBlueprintCard';
import { useEscapeToClose } from '../hooks/useEscapeToClose';
import { useVillageBuildModalShortcuts } from '../hooks/useVillageBuildModalShortcuts';
import {
  cycleCategoryIndex,
  getBlueprintShortcutNumber,
} from '../game/utils/buildModalKeyboardUtils';

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
  onRepairBuilding?: (buildingId: string) => void;
  onTestDestroyCore?: (territoryId: number) => void;
}

const CATEGORIES: ReadonlyArray<{
  key: BuildingCategory;
  shortLabel: string;
  fullLabel: string;
  iconSrc: string;
}> = [
  { key: 'tower', shortLabel: '타워', fullLabel: '방어 타워 (외곽 배치)', iconSrc: '/assets/buildings/Tower.png' },
  { key: 'wall', shortLabel: '성벽', fullLabel: '성벽 · 방책 (방어선 배치)', iconSrc: '/assets/buildings/Wood_Palisade.png' },
  { key: 'basic', shortLabel: '기본', fullLabel: '기본건물 · 자원건물 (즉시 건설)', iconSrc: '/assets/buildings/House2.png' },
  { key: 'special', shortLabel: '특수', fullLabel: '특수건물 · 영지당 1개 제한 (즉시 건설)', iconSrc: '/assets/buildings/Barracks.png' },
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
  onRepairBuilding,
}) => {
  const [activeCategory, setActiveCategory] = useState<BuildingCategory>('tower');
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);

  const curTerritory = territories.find((t) => t.id === playerStandingTerritoryId);
  const access = canBuildInTerritory(curTerritory, playerId, playerStandingTerritoryId);

  const hasDamagedWall = Boolean(
    curTerritory &&
      constructedBuildings.some(
        (b) => b.territoryId === curTerritory.id && isWallBuilding(b) && b.hp < b.maxHp
      )
  );

  useEffect(() => {
    setSelectedSlotIndex(null);
  }, [playerStandingTerritoryId, isOpen]);

  const isModalVisible = isOpen && Boolean(curTerritory) && access.allowed;
  const blueprints = CONSTRUCTABLE_BLUEPRINTS.filter((b) => b.category === activeCategory);
  const maxSlots = curTerritory ? BuildingSystem.getMaxSlots(curTerritory.villageTier) : 0;
  const existingCount = curTerritory
    ? BuildingSystem.getOccupiedSlotCount(curTerritory.id, constructedBuildings)
    : 0;

  const handleBuild = (type: ConstructableType) => {
    if (!curTerritory) return;
    if (BuildingSystem.hasReachedTerritoryBuildingLimit(curTerritory.id, type, constructedBuildings)) {
      return;
    }

    const bp = blueprints.find((b) => b.type === type);
    const isPlacementCategory = bp?.category === 'tower' || bp?.category === 'wall';

    if (bp && isPlacementCategory && onSelectTowerPlacement) {
      const canAfford =
        inventory.wood >= bp.costWood &&
        inventory.stone >= bp.costStone &&
        inventory.gold >= bp.costGold;
      if (!canAfford) return;

      if (bp.category === 'wall') {
        const wallCheck = BuildingSystem.checkBuild(
          curTerritory,
          type,
          inventory,
          constructedBuildings,
          selectedSlotIndex ?? undefined
        );
        if (!wallCheck.canBuild) return;
      }

      onSelectTowerPlacement(curTerritory.id, type);
      onClose();
      return;
    }

    // 기본/특수건물은 클릭 즉시 빈 슬롯에 자동 건설
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

  useEscapeToClose(isModalVisible, onClose);
  useVillageBuildModalShortcuts({
    isActive: isModalVisible,
    onClose,
    onChangeCategory: (delta) => {
      setActiveCategory((prev) => {
        const curIdx = CATEGORIES.findIndex((c) => c.key === prev);
        const nextIdx = cycleCategoryIndex(curIdx === -1 ? 0 : curIdx, delta, CATEGORIES.length);
        return CATEGORIES[nextIdx].key;
      });
    },
    onSelectBlueprintIndex: (index) => {
      const target = blueprints[index];
      if (!target) return;
      handleBuild(target.type);
    },
  });

  if (!isModalVisible || !curTerritory) return null;

  const curTier = curTerritory.villageTier;
  const tierCfg = VILLAGE_TIER_CONFIGS[curTier];
  const upgrade = BuildingSystem.checkUpgrade(curTerritory, inventory);
  const slotStates = BuildingSystem.getSlotStates(curTerritory.id, curTier, constructedBuildings);
  const wallSlots = slotStates.filter((s) => s.role === 'wall');
  const innerSlots = slotStates.filter((s) => s.role === 'inner');

  const shortTerritoryName = curTerritory.name.split(' (')[0];
  const canRepairCore = curTerritory.coreHp < curTerritory.coreMaxHp && inventory.wood >= 5 && inventory.stone >= 5;

  return (
    <WoodModalFrame
      id="village-build-modal"
      title={`#${curTerritory.id} ${shortTerritoryName}`}
      ribbonVariant="blue"
      frameVariant="wood"
      maxWidthClass="max-w-2xl"
      onClose={onClose}
      headerRight={
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[#29150b]/85 border border-[#b89568] text-[11px] font-black text-[#fde68a] tabular-nums">
          <img src="/assets/buildings/Castle.png" alt="" className="w-4 h-4 object-contain pixel-art" />
          <span>
            Lv.{curTier} {tierCfg.name} · {existingCount}/{maxSlots}
          </span>
        </div>
      }
    >
      {/* Compact Territory Status + Mini Slot Strip */}
      <div className="ts-paper-sheet px-2.5 py-2 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Core HP + Repair Icon Button */}
          <div className="flex items-center gap-1.5 tabular-nums">
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#f3e2c7] border border-[#b89568] text-xs font-black text-[#166534]">
              <img src="/assets/ui/Icons/Icon_07.png" alt="코어" className="w-4 h-4 pixel-art" />
              <span>
                {curTerritory.coreHp}/{curTerritory.coreMaxHp}
              </span>
            </div>

            <div className="inline-flex items-center gap-1">
              <PixelSquareButton
                iconSrc="/assets/ui/Icons/Icon_Heart.png"
                alt="코어 수리"
                title={`코어 수리 (목재 5, 석재 5)`}
                variant="blue"
                size="xs"
                disabled={!canRepairCore}
                onClick={() => onRepairCore(curTerritory.id)}
              />
              <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#5c3c24]">
                <img src="/assets/ui/Icons/Icon_02.png" alt="목재" className="w-3 h-3 pixel-art" />5
                <img src="/assets/decorations/Rock2.png" alt="석재" className="w-3 h-3 pixel-art" />5
              </span>
            </div>

            {hasDamagedWall && (
              <PixelSquareButton
                iconSrc="/assets/buildings/Wood_Palisade.png"
                alt="방벽 손상 확인"
                title="손상된 방벽 확인 및 수리"
                variant="red"
                size="xs"
                onClick={() => setActiveCategory('wall')}
                className="animate-pulse"
              />
            )}
          </div>

          {/* Village Tier Upgrade Icon Button */}
          {upgrade.nextTier ? (
            <div className="inline-flex items-center gap-1.5 bg-[#f3e2c7] border border-[#b89568] rounded-lg px-2 py-0.5 tabular-nums">
              <PixelSquareButton
                id="upgrade-village-btn"
                iconSrc="/assets/ui/Icons/Icon_06.png"
                alt={`Lv.${upgrade.nextTier} 승급`}
                title={`Lv.${upgrade.nextTier} ${VILLAGE_TIER_CONFIGS[upgrade.nextTier].name} 승급`}
                variant="blue"
                size="xs"
                disabled={!upgrade.canUpgrade}
                onClick={() => onUpgradeVillage(curTerritory.id)}
              />
              <div className="flex flex-col leading-tight">
                <span className="text-[11px] font-black text-[#2b1810]">
                  Lv.{upgrade.nextTier} {VILLAGE_TIER_CONFIGS[upgrade.nextTier].name}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-black">
                  <span className={inventory.wood >= upgrade.costWood ? 'text-[#166534]' : 'text-[#b91c1c]'}>
                    <img src="/assets/ui/Icons/Icon_02.png" alt="" className="w-3 h-3 inline pixel-art mr-0.5" />
                    {upgrade.costWood}
                  </span>
                  <span className={inventory.stone >= upgrade.costStone ? 'text-[#334155]' : 'text-[#b91c1c]'}>
                    <img src="/assets/decorations/Rock2.png" alt="" className="w-3 h-3 inline pixel-art mr-0.5" />
                    {upgrade.costStone}
                  </span>
                  {upgrade.costGold > 0 && (
                    <span className={inventory.gold >= upgrade.costGold ? 'text-[#92400e]' : 'text-[#b91c1c]'}>
                      <img src="/assets/ui/Icons/Icon_03.png" alt="" className="w-3 h-3 inline pixel-art mr-0.5" />
                      {upgrade.costGold}
                    </span>
                  )}
                </span>
              </div>
            </div>
          ) : (
            <div
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#fde68a] border border-[#92400e] text-[#3a200f] text-[11px] font-black"
              title="최고 등급 도달"
            >
              <img src="/assets/ui/Icons/Icon_06.png" alt="MAX" className="w-3.5 h-3.5 pixel-art" />
              <span>MAX</span>
            </div>
          )}
        </div>

        {/* Compact Single-Row Slot Indicator Strip */}
        <div className="pt-1.5 border-t border-[#c7a97e]/70 flex items-center gap-1 overflow-x-auto">
          <span className="text-[10px] font-black text-[#6d4626] shrink-0 mr-0.5" title="방벽 슬롯 (0~3)">
            🛡️
          </span>
          {wallSlots.map((slot) => {
            const isSelected = selectedSlotIndex === slot.slotIndex;
            const isOcc = Boolean(slot.building);
            const isDamaged = Boolean(slot.building && slot.building.hp < slot.building.maxHp);
            return (
              <button
                key={slot.slotIndex}
                type="button"
                disabled={!slot.isUnlocked || (isOcc && !isDamaged)}
                onClick={() => {
                  setSelectedSlotIndex(isSelected ? null : slot.slotIndex);
                  setActiveCategory('wall');
                }}
                title={
                  slot.building
                    ? `#${slot.slotIndex} ${slot.building.name} (${slot.building.hp}/${slot.building.maxHp})`
                    : `방벽 슬롯 #${slot.slotIndex}`
                }
                className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 text-[9px] font-black transition ${
                  !slot.isUnlocked
                    ? 'bg-[#d8c5aa] border-[#c4b094] opacity-45 cursor-not-allowed'
                    : isDamaged
                      ? 'bg-[#dc2626] border-[#7f1d1d] text-white animate-pulse cursor-pointer'
                      : isOcc
                        ? 'bg-[#a18057] border-[#785937] text-[#fef5df] cursor-not-allowed'
                        : isSelected
                          ? 'bg-[#2563eb] border-[#1e40af] text-white shadow'
                          : 'bg-[#fff5e2] border-[#b89568] text-[#6d4626] hover:bg-[#ffeac4]'
                }`}
              >
                {isDamaged ? '!' : isOcc ? '✓' : ''}
              </button>
            );
          })}

          <span className="w-px h-4 bg-[#c7a97e] mx-0.5 shrink-0" />

          <span className="text-[10px] font-black text-[#6d4626] shrink-0 mr-0.5" title="내부 건물 슬롯 (4~15)">
            🏠
          </span>
          {innerSlots.map((slot) => {
            const isSelected = selectedSlotIndex === slot.slotIndex;
            const isOcc = Boolean(slot.building);
            const isDamaged = Boolean(slot.building && slot.building.hp < slot.building.maxHp);
            return (
              <button
                key={slot.slotIndex}
                type="button"
                disabled={!slot.isUnlocked || (isOcc && !isDamaged)}
                onClick={() => setSelectedSlotIndex(isSelected ? null : slot.slotIndex)}
                title={
                  !slot.isUnlocked
                    ? `잠긴 슬롯 #${slot.slotIndex}`
                    : slot.building
                      ? `#${slot.slotIndex} ${slot.building.name} (${slot.building.hp}/${slot.building.maxHp})`
                      : `빈 슬롯 #${slot.slotIndex}`
                }
                className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 text-[9px] font-black transition ${
                  !slot.isUnlocked
                    ? 'bg-[#d8c5aa] border-[#c4b094] opacity-45 cursor-not-allowed'
                    : isDamaged
                      ? 'bg-[#dc2626] border-[#7f1d1d] text-white animate-pulse cursor-pointer'
                      : isOcc
                        ? 'bg-[#a18057] border-[#785937] text-[#fef5df] cursor-not-allowed'
                        : isSelected
                          ? 'bg-[#2563eb] border-[#1e40af] text-white shadow'
                          : 'bg-[#fff5e2] border-[#b89568] text-[#6d4626] hover:bg-[#ffeac4]'
                }`}
              >
                {!slot.isUnlocked ? '·' : isDamaged ? '!' : isOcc ? '✓' : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sprite Icon Category Tabs */}
      <div className="grid grid-cols-4 gap-1.5">
        {CATEGORIES.map((cat) => {
          const active = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              title={cat.fullLabel}
              onClick={() => setActiveCategory(cat.key)}
              className={`relative py-1.5 px-2 rounded-lg text-xs font-black border-2 transition flex items-center justify-center gap-1.5 ${
                active
                  ? 'bg-[#fde68a] text-[#2b1810] border-[#92400e] shadow'
                  : 'bg-[#3d2314]/85 text-[#f3e4c7] border-[#85532a] hover:brightness-110'
              }`}
            >
              <img src={cat.iconSrc} alt={cat.fullLabel} className="w-5 h-5 object-contain pixel-art shrink-0" />
              <span>{cat.shortLabel}</span>
              {cat.key === 'wall' && hasDamagedWall && (
                <span className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* Wall Status & Direct Repair Section */}
      {activeCategory === 'wall' && (
        <TerritoryWallRepairCard
          territoryId={curTerritory.id}
          constructedBuildings={constructedBuildings}
          inventory={inventory}
          onRepairBuilding={(id) => onRepairBuilding?.(id)}
          selectedSlotIndex={selectedSlotIndex}
          onSelectSlot={(slotIdx) => setSelectedSlotIndex(slotIdx)}
        />
      )}

      {/* Blueprints Grid */}
      <div className="ts-paper-sheet p-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {blueprints.map((bp, index) => {
            const isPlacementMode =
              (bp.category === 'tower' || bp.category === 'wall') && Boolean(onSelectTowerPlacement);
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
            const isAlreadyBuilt = Boolean(check.alreadyBuilt);
            const isEnabled =
              !isAlreadyBuilt &&
              (bp.category === 'tower' && onSelectTowerPlacement
                ? canAfford
                : bp.category === 'wall' && onSelectTowerPlacement
                  ? canAfford && hasSlot && check.canBuild
                  : check.canBuild);

            return (
              <VillageBlueprintCard
                key={bp.type}
                blueprint={bp}
                inventory={inventory}
                isPlacementMode={isPlacementMode}
                isEnabled={isEnabled}
                isAlreadyBuilt={isAlreadyBuilt}
                shortcutKey={getBlueprintShortcutNumber(index) ?? undefined}
                onBuild={() => handleBuild(bp.type)}
              />
            );
          })}
        </div>
      </div>
    </WoodModalFrame>
  );
};
