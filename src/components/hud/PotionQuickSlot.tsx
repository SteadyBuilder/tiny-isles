import React from 'react';
import { POTION_LIST } from '../../data/potions';
import { GameEvents } from '../../game/events/gameEvents';
import { PotionInventory } from '../../types/hunting';
import { CooldownActionButton } from './CooldownActionButton';

interface PotionQuickSlotProps {
  potions: PotionInventory;
  cooldownRemainingMs: number;
  compact?: boolean;
}

export const PotionQuickSlot: React.FC<PotionQuickSlotProps> = ({
  potions,
  cooldownRemainingMs,
  compact = false,
}) => {
  return (
    <div className={`flex items-center ${compact ? 'gap-1' : 'gap-1.5'}`}>
      {POTION_LIST.map((potion) => {
        const count = potions?.[potion.id] ?? 0;

        return (
          <CooldownActionButton
            key={potion.id}
            onClick={() => GameEvents.emit('use-potion', potion.id)}
            isOutOfStock={count <= 0}
            cooldownRemainingMs={count > 0 ? cooldownRemainingMs : 0}
            cooldownMaxMs={potion.cooldownMs}
            spritePath={potion.spritePath}
            alt={potion.name}
            hotkey={compact ? undefined : potion.hotkey}
            badgeText={`×${count}`}
            title={`${potion.name} (+${potion.healAmount} HP) · 단축키 [${potion.hotkey}]`}
            accentTheme="emerald"
            sizeClass={compact ? 'w-9 h-9' : 'w-12 h-12'}
            iconSizeClass={compact ? 'w-5 h-5' : 'w-7 h-7'}
          />
        );
      })}
    </div>
  );
};
