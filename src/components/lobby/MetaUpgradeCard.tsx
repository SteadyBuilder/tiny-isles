import React from 'react';
import { MODE_ADVANTAGE_META, getTraitUpgradeCost } from '../../data/metaProgression';
import { TraitDefinition, TraitId } from '../../types/metaProgression';
import { PixelGameButton } from '../ui/PixelGameButton';

interface MetaUpgradeCardProps {
  trait: TraitDefinition;
  level: number;
  points: number;
  onUpgrade: (traitId: TraitId) => void;
}

export const MetaUpgradeCard: React.FC<MetaUpgradeCardProps> = ({
  trait,
  level,
  points,
  onUpgrade,
}) => {
  const isMax = level >= trait.maxLevel;
  const cost = getTraitUpgradeCost(trait, level);
  const canAfford = !isMax && points >= cost;
  const modeMeta = trait.modeTag ? MODE_ADVANTAGE_META[trait.modeTag] : null;

  return (
    <div className="p-2.5 rounded-lg bg-[#e6cfab] border-2 border-[#b89568] flex flex-col justify-between gap-2">
      <div>
        {modeMeta && (
          <div className="mb-1">
            <span
              className={`inline-block text-[10px] font-black px-1.5 py-0.5 rounded ${modeMeta.badgeClass}`}
            >
              {modeMeta.label}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <img src={trait.iconPath} alt="" className="w-4 h-4 pixel-art shrink-0" />
            <span className="text-xs font-black text-[#2b1810] truncate">{trait.name}</span>
          </div>
          <span className="text-[11px] font-black text-[#92400e] shrink-0">
            Lv.{level}/{trait.maxLevel}
          </span>
        </div>
        <p className="text-[11px] font-semibold text-[#5c3c24] mt-1 leading-snug">
          {trait.description}
        </p>
        <p className="text-[11px] font-black text-[#166534] mt-1">{trait.effectPerLevelLabel}</p>
      </div>

      <PixelGameButton
        label={isMax ? '최고 레벨' : `강화 (${cost}P)`}
        variant={isMax ? 'red' : 'blue'}
        size="sm"
        fullWidth
        disabled={!canAfford}
        onClick={() => onUpgrade(trait.id)}
      />
    </div>
  );
};
