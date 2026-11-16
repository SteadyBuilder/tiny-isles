import React from 'react';
import { ConstructableBlueprint, Inventory } from '../../types/game';
import { PixelGameButton } from '../ui/PixelGameButton';

export const BUILDING_SPRITE_MAP: Record<string, string> = {
  woodPalisade: '/assets/buildings/Wood_Palisade.png',
  stoneWall: '/assets/buildings/Stone_Wall.png',
  castle: '/assets/buildings/Castle.png',
  house1: '/assets/buildings/House1.png',
  house2: '/assets/buildings/House2.png',
  house3: '/assets/buildings/House3.png',
  tower: '/assets/buildings/Tower.png',
  magicTower: '/assets/buildings/Magic_Tower.png',
  barracks: '/assets/buildings/Barracks.png',
  archery: '/assets/buildings/Archery.png',
  monastery: '/assets/buildings/Monastery.png',
  lumberCamp: '/assets/buildings/Lumber_Camp.png',
  stoneWorks: '/assets/buildings/Stone_Works.png',
  alchemistLab: '/assets/buildings/Alchemist_Lab.png',
  woodOutpost: '/assets/buildings/Wood_Outpost.png',
  woodHut: '/assets/buildings/Wood_Hut.png',
  blacksmith: '/assets/buildings/Blacksmith.png',
  market: '/assets/buildings/Market.png',
  windmill: '/assets/buildings/Windmill.png',
};

export interface VillageBlueprintCardProps {
  blueprint: ConstructableBlueprint;
  inventory: Inventory;
  isTowerPlacement: boolean;
  isEnabled: boolean;
  statusText: string;
  onBuild: () => void;
}

export const VillageBlueprintCard: React.FC<VillageBlueprintCardProps> = ({
  blueprint: bp,
  inventory,
  isTowerPlacement,
  isEnabled,
  statusText,
  onBuild,
}) => {
  return (
    <div
      className="p-2 rounded-lg bg-[#e6cfab] border-2 border-[#b89568] flex flex-col gap-2"
      title={bp.description}
    >
      {/* Top row: Sprite + Full Name + Status Pill */}
      <div className="flex items-start gap-2 min-w-0">
        <div className="w-11 h-11 rounded-lg bg-[#f3e2c7] border border-[#b89568] flex items-center justify-center p-1 shrink-0 overflow-hidden">
          {BUILDING_SPRITE_MAP[bp.spriteKey] ? (
            <img
              src={BUILDING_SPRITE_MAP[bp.spriteKey]}
              alt={bp.name}
              className="w-full h-full object-contain pixel-art"
            />
          ) : (
            <span className="text-lg">{bp.icon}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5">
            <span className="font-black text-xs text-[#2b1810] leading-snug">{bp.name}</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-black shrink-0 border ${
                isEnabled
                  ? 'bg-[#dcfce7] text-[#166534] border-[#4f803b]/50'
                  : 'bg-[#fee2e2] text-[#991b1b] border-[#b91c1c]/40'
              }`}
            >
              {statusText}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-[#5c3c24] mt-0.5 tabular-nums">
            <span className="inline-flex items-center gap-0.5">
              <img src="/assets/ui/Icons/Icon_Heart.png" alt="HP" className="w-3 h-3 pixel-art" />
              {bp.maxHp}
            </span>
            {bp.attack ? (
              <span className="inline-flex items-center gap-0.5">
                <img src="/assets/ui/Icons/Icon_05.png" alt="공격" className="w-3 h-3 pixel-art" />
                {bp.attack}
              </span>
            ) : null}
            {bp.range ? (
              <span className="inline-flex items-center gap-0.5">
                <img src="/assets/ui/Icons/Icon_Compass.png" alt="사거리" className="w-3 h-3 pixel-art" />
                {bp.range}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Bottom row: Costs + Action Button */}
      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#c7a97e]">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-black tabular-nums">
          <span
            className={`inline-flex items-center gap-0.5 ${
              inventory.wood >= bp.costWood ? 'text-[#166534]' : 'text-[#b91c1c]'
            }`}
          >
            <img src="/assets/ui/Icons/Icon_02.png" alt="목재" className="w-3.5 h-3.5 pixel-art" />
            {bp.costWood}
          </span>
          <span
            className={`inline-flex items-center gap-0.5 ${
              inventory.stone >= bp.costStone ? 'text-[#334155]' : 'text-[#b91c1c]'
            }`}
          >
            <img src="/assets/decorations/Rock2.png" alt="석재" className="w-3.5 h-3.5 pixel-art" />
            {bp.costStone}
          </span>
          {bp.costGold > 0 && (
            <span
              className={`inline-flex items-center gap-0.5 ${
                inventory.gold >= bp.costGold ? 'text-[#92400e]' : 'text-[#b91c1c]'
              }`}
            >
              <img src="/assets/ui/Icons/Icon_03.png" alt="금화" className="w-3.5 h-3.5 pixel-art" />
              {bp.costGold}
            </span>
          )}
        </div>

        <PixelGameButton
          label={isTowerPlacement ? '외곽 배치' : '건설'}
          iconSrc="/assets/ui/Icons/Tool_Hammer.png"
          variant="blue"
          size="sm"
          disabled={!isEnabled}
          onClick={onBuild}
          className="shrink-0"
        />
      </div>
    </div>
  );
};
