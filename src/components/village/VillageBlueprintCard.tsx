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
  mercenaryGuild: '/assets/buildings/Mercenary_Guild.png',
};

export interface VillageBlueprintCardProps {
  blueprint: ConstructableBlueprint;
  inventory: Inventory;
  isTowerPlacement: boolean;
  isEnabled: boolean;
  isAlreadyBuilt?: boolean;
  statusText: string;
  shortcutKey?: number;
  onBuild: () => void;
}

export const VillageBlueprintCard: React.FC<VillageBlueprintCardProps> = ({
  blueprint: bp,
  inventory,
  isTowerPlacement,
  isEnabled,
  isAlreadyBuilt = false,
  statusText,
  shortcutKey,
  onBuild,
}) => {
  return (
    <div
      className={`p-2 rounded-lg border-2 flex flex-col gap-2 ${
        isAlreadyBuilt
          ? 'bg-[#e3d2b6] border-[#c49a52]'
          : 'bg-[#e6cfab] border-[#b89568]'
      }`}
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
            <div className="flex items-center gap-1 min-w-0">
              {shortcutKey !== undefined && (
                <kbd
                  className={`hidden sm:inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded text-[10px] font-black border shrink-0 tabular-nums ${
                    isEnabled
                      ? 'bg-[#29150b] text-[#fde68a] border-[#92400e]'
                      : 'bg-[#78634d]/60 text-[#e7d8c1] border-[#8c745a]'
                  }`}
                  title={`단축키 [${shortcutKey}]`}
                >
                  {shortcutKey}
                </kbd>
              )}
              <span className="font-black text-xs text-[#2b1810] leading-snug truncate">
                {bp.name}
              </span>
            </div>
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-black shrink-0 border ${
                isAlreadyBuilt
                  ? 'bg-[#fef3c7] text-[#92400e] border-[#d97706]/60'
                  : isEnabled
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

          <p className="mt-1 px-1.5 py-0.5 rounded bg-[#f3e2c7]/85 border border-[#c7a97e]/70 text-[10px] font-bold text-[#4a2e19] leading-snug">
            {bp.shortEffect}
          </p>
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
          label={isAlreadyBuilt ? '건설됨' : isTowerPlacement ? '외곽 배치' : '건설'}
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
