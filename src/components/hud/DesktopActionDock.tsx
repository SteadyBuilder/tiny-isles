import React from 'react';
import { PLAYER_CLASS_DEFINITIONS } from '../../data/classes';
import { HUD_ACTION_SPRITES } from '../../data/hudIcons';
import { GameEvents } from '../../game/events/gameEvents';
import { DashCooldownState, PlayerProgressionState } from '../../types/game';
import { CooldownActionButton } from './CooldownActionButton';
import { PotionQuickSlot } from './PotionQuickSlot';

interface DesktopActionDockProps {
  progression: PlayerProgressionState;
  dashState?: DashCooldownState;
}

export const DesktopActionDock: React.FC<DesktopActionDockProps> = ({
  progression,
  dashState,
}) => {
  const classDef = PLAYER_CLASS_DEFINITIONS[progression.classId];
  const dashRemainingMs = dashState?.cooldownRemainingMs ?? 0;
  const dashMaxMs = dashState?.cooldownMaxMs ?? 1200;

  return (
    <div
      className="hidden md:flex fixed bottom-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto"
      aria-label="전투 사용 UI 퀵슬롯"
    >
      <div className="ts-hud-pill px-2.5 py-2 flex items-center gap-2 shadow-2xl">
        {/* Potions [1] [2] [3] */}
        <PotionQuickSlot
          potions={progression.potions}
          cooldownRemainingMs={progression.potionCooldownRemainingMs ?? 0}
        />

        <div className="w-[1px] h-9 bg-[#785e42]/70 mx-0.5" />

        {/* Active Skill [Q] */}
        <CooldownActionButton
          id="desktop-skill-btn"
          onClick={() => GameEvents.emit('cast-active-skill')}
          cooldownRemainingMs={progression.skillCooldownRemainingMs}
          cooldownMaxMs={progression.skillCooldownMaxMs}
          spritePath={classDef.skillSpritePath}
          alt={classDef.skillName}
          hotkey="Q"
          title={`${classDef.skillName} [Q] · ${classDef.skillDescription}`}
          accentTheme="blue"
          sizeClass="w-12 h-12"
          iconSizeClass="w-8 h-8"
        />

        {/* Dash [Shift] */}
        <CooldownActionButton
          id="desktop-dash-btn"
          onClick={() => GameEvents.emit('trigger-dash')}
          disabled={Boolean(dashState?.isDashing)}
          cooldownRemainingMs={dashRemainingMs}
          cooldownMaxMs={dashMaxMs}
          spritePath={HUD_ACTION_SPRITES.dash}
          alt="순간 대시"
          hotkey="Shift"
          title="순간 대시 회피기 [Shift] · 무적 판정 및 몬스터 통과"
          accentTheme="cyan"
          sizeClass="w-12 h-12"
          iconSizeClass="w-8 h-8"
        />
      </div>
    </div>
  );
};
