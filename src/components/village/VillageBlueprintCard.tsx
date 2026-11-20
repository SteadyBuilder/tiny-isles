import React from 'react';
import { ConstructableBlueprint, ConstructableType, Inventory } from '../../types/game';
import { PixelSquareButton } from '../ui/PixelSquareButton';

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

interface CompactEffectStat {
  iconSrc: string;
  text: string;
  toneClass?: string;
}

function getCompactEffectStat(type: ConstructableType): CompactEffectStat | null {
  switch (type) {
    case 'basic_house':
      return { iconSrc: '/assets/ui/Icons/Icon_07.png', text: '+6/30s', toneClass: 'text-[#166534]' };
    case 'lumber_camp':
      return { iconSrc: '/assets/ui/Icons/Icon_02.png', text: '+2/30s', toneClass: 'text-[#166534]' };
    case 'stone_works':
      return { iconSrc: '/assets/decorations/Rock2.png', text: '+2/30s', toneClass: 'text-[#334155]' };
    case 'special_goldmine':
      return { iconSrc: '/assets/ui/Icons/Icon_03.png', text: '+2/30s', toneClass: 'text-[#92400e]' };
    case 'special_barracks':
      return { iconSrc: '/assets/ui/Icons/Icon_05.png', text: '+25%', toneClass: 'text-[#991b1b]' };
    case 'special_sanctuary':
      return { iconSrc: '/assets/ui/Icons/Icon_Heart.png', text: '+20/30s', toneClass: 'text-[#166534]' };
    case 'job_hall':
      return { iconSrc: '/assets/ui/skills/menu_job_hall.png', text: '전직', toneClass: 'text-[#1e40af]' };
    case 'tool_shop':
      return { iconSrc: '/assets/ui/skills/menu_shop.png', text: '물약', toneClass: 'text-[#0f766e]' };
    case 'mercenary_guild':
      return { iconSrc: '/assets/ui/Icons/Icon_06.png', text: '×4', toneClass: 'text-[#92400e]' };
    default:
      return null;
  }
}

export interface VillageBlueprintCardProps {
  blueprint: ConstructableBlueprint;
  inventory: Inventory;
  isPlacementMode: boolean;
  isEnabled: boolean;
  isAlreadyBuilt?: boolean;
  shortcutKey?: number;
  onBuild: () => void;
}

export const VillageBlueprintCard: React.FC<VillageBlueprintCardProps> = ({
  blueprint: bp,
  inventory,
  isPlacementMode,
  isEnabled,
  isAlreadyBuilt = false,
  shortcutKey,
  onBuild,
}) => {
  const effectStat = getCompactEffectStat(bp.type);
  const actionTitle = isAlreadyBuilt
    ? `${bp.name} (건설됨)`
    : isPlacementMode
      ? `${bp.name} 위치 지정`
      : `${bp.name} 즉시 건설`;

  return (
    <div
      className={`p-2 rounded-lg border-2 flex items-center gap-2 transition ${
        isAlreadyBuilt
          ? 'bg-[#e3d2b6]/80 border-[#c49a52]'
          : isEnabled
            ? 'bg-[#e6cfab] border-[#b89568]'
            : 'bg-[#dfd1bb] border-[#bba88e]'
      }`}
      title={`${bp.name} — ${bp.shortEffect}`}
    >
      {/* Building Sprite */}
      <div className="relative w-12 h-12 rounded-lg bg-[#f3e2c7] border border-[#b89568] flex items-center justify-center p-1 shrink-0 overflow-hidden">
        {BUILDING_SPRITE_MAP[bp.spriteKey] ? (
          <img
            src={BUILDING_SPRITE_MAP[bp.spriteKey]}
            alt={bp.name}
            className={`w-full h-full object-contain pixel-art ${isAlreadyBuilt ? 'opacity-70' : ''}`}
          />
        ) : (
          <span className="text-lg">{bp.icon}</span>
        )}
        {shortcutKey !== undefined && (
          <kbd
            className={`hidden sm:inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded text-[9px] font-black border absolute top-0.5 left-0.5 tabular-nums ${
              isEnabled
                ? 'bg-[#29150b]/90 text-[#fde68a] border-[#92400e]'
                : 'bg-[#78634d]/75 text-[#e7d8c1] border-[#8c745a]'
            }`}
          >
            {shortcutKey}
          </kbd>
        )}
      </div>

      {/* Name + Icon Stats + Costs */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-black text-xs text-[#2b1810] leading-tight truncate">
            {bp.name}
          </span>
          {bp.maxPerTerritory === 1 && (
            <span
              className="inline-flex items-center justify-center px-1 py-0.5 rounded bg-[#fef3c7] border border-[#d97706]/60 text-[9px] font-black text-[#92400e] shrink-0"
              title="영지당 1개 제한"
            >
              1/1
            </span>
          )}
        </div>

        {/* Compact Icon Stats */}
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-black text-[#5c3c24] tabular-nums">
          <span className="inline-flex items-center gap-0.5" title={`내구도 ${bp.maxHp}`}>
            <img src="/assets/ui/Icons/Icon_Heart.png" alt="HP" className="w-3 h-3 pixel-art" />
            {bp.maxHp}
          </span>
          {bp.attack ? (
            <span className="inline-flex items-center gap-0.5" title={`공격력 ${bp.attack}`}>
              <img src="/assets/ui/Icons/Icon_05.png" alt="공격" className="w-3 h-3 pixel-art" />
              {bp.attack}
            </span>
          ) : null}
          {bp.range ? (
            <span className="inline-flex items-center gap-0.5" title={`사거리 ${bp.range}`}>
              <img src="/assets/ui/Icons/Icon_Compass.png" alt="사거리" className="w-3 h-3 pixel-art" />
              {bp.range}
            </span>
          ) : null}
          {effectStat && (
            <span
              className={`inline-flex items-center gap-0.5 ${effectStat.toneClass ?? 'text-[#4a2e19]'}`}
              title={bp.shortEffect}
            >
              <img src={effectStat.iconSrc} alt="" className="w-3 h-3 pixel-art object-contain" />
              {effectStat.text}
            </span>
          )}
        </div>

        {/* Costs */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-black tabular-nums pt-0.5 border-t border-[#c7a97e]/70">
          {bp.costWood > 0 && (
            <span
              className={`inline-flex items-center gap-0.5 ${
                inventory.wood >= bp.costWood ? 'text-[#166534]' : 'text-[#b91c1c]'
              }`}
            >
              <img src="/assets/ui/Icons/Icon_02.png" alt="목재" className="w-3.5 h-3.5 pixel-art" />
              {bp.costWood}
            </span>
          )}
          {bp.costStone > 0 && (
            <span
              className={`inline-flex items-center gap-0.5 ${
                inventory.stone >= bp.costStone ? 'text-[#334155]' : 'text-[#b91c1c]'
              }`}
            >
              <img src="/assets/decorations/Rock2.png" alt="석재" className="w-3.5 h-3.5 pixel-art" />
              {bp.costStone}
            </span>
          )}
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
      </div>

      {/* Sprite Icon Action Button */}
      <PixelSquareButton
        iconSrc={
          isAlreadyBuilt
            ? '/assets/ui/Icons/Icon_06.png'
            : isPlacementMode
              ? '/assets/ui/Icons/Icon_Compass.png'
              : '/assets/ui/Icons/Tool_Hammer.png'
        }
        alt={actionTitle}
        title={actionTitle}
        variant="blue"
        size="md"
        disabled={!isEnabled}
        onClick={onBuild}
      />
    </div>
  );
};
