import React, { useState, useEffect } from 'react';
import { BuildingCategory, ConstructableType, ConstructedBuilding, Inventory, Island } from '../types/game';
import { CONSTRUCTABLE_BLUEPRINTS, VILLAGE_TIER_CONFIGS } from '../game/constants';
import { BuildingSystem } from '../game/BuildingSystem';
import { Hammer, Heart, ArrowUpCircle } from 'lucide-react';

interface VillageBuildModalProps {
  isOpen: boolean;
  onClose: () => void;
  territories: Island[];
  selectedTerritoryId: number;
  onSelectTerritory: (id: number) => void;
  constructedBuildings: ConstructedBuilding[];
  inventory: Inventory;
  onUpgradeVillage: (territoryId: number) => void;
  onConstructBuilding: (territoryId: number, type: ConstructableType, slotIndex?: number) => void;
  onRepairCore: (territoryId: number) => void;
  onTestDestroyCore?: (territoryId: number) => void;
}

const CATEGORIES: { key: BuildingCategory; label: string; icon: string }[] = [
  { key: 'tower', label: '방어 타워', icon: '🏹' },
  { key: 'wall', label: '성벽', icon: '🪵' },
  { key: 'basic', label: '기본 건물', icon: '🏠' },
  { key: 'special', label: '특수 건물', icon: '✨' },
];

const SPRITES: Record<string, string> = {
  woodPalisade: '/assets/buildings/Wood_Palisade.png',
  castle: '/assets/buildings/Castle.png',
  house1: '/assets/buildings/House1.png',
  house2: '/assets/buildings/House2.png',
  house3: '/assets/buildings/House3.png',
  tower: '/assets/buildings/Tower.png',
  barracks: '/assets/buildings/Barracks.png',
  archery: '/assets/buildings/Archery.png',
  monastery: '/assets/buildings/Monastery.png',
};

export const VillageBuildModal: React.FC<VillageBuildModalProps> = ({
  isOpen,
  onClose,
  territories,
  selectedTerritoryId,
  onSelectTerritory,
  constructedBuildings,
  inventory,
  onUpgradeVillage,
  onConstructBuilding,
  onRepairCore,
}) => {
  const [activeCategory, setActiveCategory] = useState<BuildingCategory>('tower');
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);

  const unlocked = territories.filter((t) => t.unlocked);
  const curTerritory = unlocked.find((t) => t.id === selectedTerritoryId) || unlocked[0] || territories[0];

  useEffect(() => {
    setSelectedSlotIndex(null);
  }, [selectedTerritoryId, isOpen]);

  if (!isOpen || !curTerritory) return null;

  const curTier = curTerritory.villageTier;
  const tierCfg = VILLAGE_TIER_CONFIGS[curTier];
  const upgrade = BuildingSystem.checkUpgrade(curTerritory, inventory);
  const slotStates = BuildingSystem.getSlotStates(curTerritory.id, curTier, constructedBuildings);
  const maxSlots = BuildingSystem.getMaxSlots(curTier);
  const blueprints = CONSTRUCTABLE_BLUEPRINTS.filter((b) => b.category === activeCategory);

  const handleBuild = (type: ConstructableType) => {
    const check = BuildingSystem.checkBuild(curTerritory, type, inventory, constructedBuildings, selectedSlotIndex ?? undefined);
    if (!check.canBuild) return;
    const finalSlot = check.slotIndex!;
    onConstructBuilding(curTerritory.id, type, finalSlot);
    setSelectedSlotIndex(null);
  };

  return (
    <div id="village-build-modal" className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/65 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-3xl bg-[#543d2b] border-4 border-[#322013] rounded-2xl p-3 sm:p-4 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto text-[#3a2211]" onClick={(e) => e.stopPropagation()}>
        {/* Header - Tiny Swords Wood Table Banner */}
        <div className="flex items-center justify-between pb-2 border-b-2 border-[#7c5a3f]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#b58750] text-[#2e1b0d] border border-[#d8aa6d]"><Hammer className="w-5 h-5" /></span>
            <h2 className="text-base sm:text-lg font-black text-[#faecd1] drop-shadow">
              🏰 #{curTerritory.id} Lv.{curTier} {tierCfg.name}
            </h2>
          </div>
          <button id="close-village-modal-btn" onClick={onClose} className="w-7 h-7 active:scale-95 transition-transform flex items-center justify-center">
            <img src="/assets/ui/Buttons/SmallRedRoundButton_Regular.png" alt="X" className="w-full h-full pixel-art" />
          </button>
        </div>

        {/* Territory Selector */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pb-1.5">
          {unlocked.map((t) => (
            <button key={t.id} onClick={() => onSelectTerritory(t.id)} className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition tabular-nums ${
              t.id === curTerritory.id ? 'bg-[#e2a85c] text-[#2b1708] border-[#ffe2a8] shadow' : 'bg-[#3b2719] text-[#c9ab8d] border-[#291a10] hover:bg-[#4a3221]'
            }`} title={t.name}>
              #{t.id} Lv.{t.villageTier}
            </button>
          ))}
        </div>

        {/* Paper Panel: Tier Tech & Core Status */}
        <div className="bg-[#faecd1] border-2 border-[#b89568] rounded-xl p-3 shadow-inner">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2.5 tabular-nums">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xs text-[#52331c]">💎</span>
                <span className="text-xs font-black text-[#1f4e1f]">{curTerritory.coreHp}/{curTerritory.coreMaxHp}</span>
                <button onClick={() => onRepairCore(curTerritory.id)} className="px-2 py-0.5 rounded bg-[#4f803b] hover:bg-[#436e31] text-[#fbf5e6] text-[10px] font-bold flex items-center gap-1 shadow" title="코어 및 방책 수리">
                  <Heart className="w-3 h-3" /> 🪵5 🪨5
                </button>
              </div>
              <span className="text-xs font-bold text-[#714d2e]">
                🏗️ <b className="text-[#322013]">{constructedBuildings.filter((b) => b.territoryId === curTerritory.id).length}</b>/{maxSlots}
              </span>
            </div>

            {/* Upgrade Button */}
            {upgrade.nextTier ? (
              <button id="upgrade-village-btn" onClick={() => onUpgradeVillage(curTerritory.id)} disabled={!upgrade.canUpgrade} className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 border transition tabular-nums ${
                upgrade.canUpgrade ? 'bg-[#3b82f6] hover:bg-[#2563eb] text-white border-[#93c5fd] shadow active:scale-95' : 'bg-[#9ca3af] text-[#4b5563] border-[#6b7280] cursor-not-allowed'
              }`}>
                <ArrowUpCircle className="w-4 h-4" />
                <span>Lv.{upgrade.nextTier} {VILLAGE_TIER_CONFIGS[upgrade.nextTier].name}</span>
                <span className="text-[10px] opacity-90">🪵{upgrade.costWood} 🪨{upgrade.costStone} 🪙{upgrade.costGold}</span>
              </button>
            ) : (
              <span className="px-2.5 py-1 rounded bg-[#eab308] text-[#422006] text-xs font-black">👑 MAX</span>
            )}
          </div>

          {/* Slot Grid Selector */}
          <div className="mt-2 pt-2 border-t border-[#d8be9a]">
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1">
              {slotStates.map((slot) => {
                const isSelected = selectedSlotIndex === slot.slotIndex;
                const isOcc = !!slot.building;
                const slotIcon = slot.role === 'wall' ? '🛡️' : '📍';
                return (
                  <button key={slot.slotIndex} disabled={!slot.isUnlocked || isOcc} onClick={() => setSelectedSlotIndex(isSelected ? null : slot.slotIndex)} className={`py-1 px-1 rounded text-[10px] font-bold border transition truncate tabular-nums ${
                    !slot.isUnlocked ? 'bg-[#d8c5aa] text-[#9c8973] border-[#c4b094] opacity-50 cursor-not-allowed' :
                    isOcc ? 'bg-[#c7aa83] text-[#4a3221] border-[#ad8f67] cursor-not-allowed' :
                    isSelected ? 'bg-[#2563eb] text-white border-[#93c5fd] shadow-md ring-2 ring-blue-300' :
                    'bg-[#fff5e2] text-[#6d4626] border-[#d8be9a] hover:bg-[#ffeac4]'
                  }`} title={slot.building ? `${slot.building.name} (HP ${slot.building.hp})` : `슬롯 #${slot.slotIndex} (${slot.role})`}>
                    #{slot.slotIndex} {isOcc ? '✓' : slotIcon}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 4 Category Tabs */}
        <div className="mt-2.5 flex gap-1.5 pb-1">
          {CATEGORIES.map((cat) => (
            <button key={cat.key} onClick={() => setActiveCategory(cat.key)} className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-black border transition flex items-center justify-center gap-1 ${
              activeCategory === cat.key ? 'bg-[#f4e2bb] text-[#3c2412] border-[#ffe8b8] shadow' : 'bg-[#432d1e] text-[#be9d7c] border-[#311f13] hover:bg-[#4f3624]'
            }`}>
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Blueprints Grid (Sprite + Stat Badges + Resource Costs) */}
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {blueprints.map((bp) => {
            const check = BuildingSystem.checkBuild(curTerritory, bp.type, inventory, constructedBuildings, selectedSlotIndex ?? undefined);
            return (
              <div key={bp.type} className="bg-[#faecd1] border-2 border-[#b89568] rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-sm" title={bp.description}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-11 h-11 rounded-lg bg-[#edd8b6] border border-[#c7a97e] flex items-center justify-center p-1 shrink-0 overflow-hidden">
                    {SPRITES[bp.spriteKey] ? (
                      <img src={SPRITES[bp.spriteKey]} alt={bp.name} className="w-full h-full object-contain pixel-art" />
                    ) : (
                      <span className="text-lg">{bp.icon}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-black text-xs text-[#3a2211] truncate">{bp.icon} {bp.name}</div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-[#785333] mt-0.5 tabular-nums">
                      <span>❤️{bp.maxHp}</span>
                      {bp.attack ? <span>⚔️{bp.attack}</span> : null}
                      {bp.range ? <span>🎯{bp.range}</span> : null}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-extrabold mt-1 tabular-nums">
                      <span className={inventory.wood >= bp.costWood ? 'text-[#386629]' : 'text-red-700'}>🪵{bp.costWood}</span>
                      <span className={inventory.stone >= bp.costStone ? 'text-[#445b6b]' : 'text-red-700'}>🪨{bp.costStone}</span>
                      {bp.costGold > 0 && <span className={inventory.gold >= bp.costGold ? 'text-[#b45309]' : 'text-red-700'}>🪙{bp.costGold}</span>}
                    </div>
                  </div>
                </div>

                <button disabled={!check.canBuild} onClick={() => handleBuild(bp.type)} className={`px-3 py-1.5 rounded-lg text-xs font-black border transition shrink-0 ${
                  check.canBuild ? 'bg-[#3b82f6] hover:bg-[#2563eb] text-white border-[#93c5fd] shadow active:scale-95' : 'bg-[#cbb597] text-[#735e47] border-[#b09a7d] cursor-not-allowed'
                }`}>
                  🔨
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
