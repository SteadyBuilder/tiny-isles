import React, { useEffect, useState } from 'react';
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
  const [autoInteractEnabled, setAutoInteractEnabled] = useState(false);

  useEffect(() => {
    const handleAutoInteractChanged = (enabled: boolean) => {
      setAutoInteractEnabled(enabled);
    };
    GameEvents.on('auto-interact-changed', handleAutoInteractChanged);
    return () => {
      GameEvents.off('auto-interact-changed', handleAutoInteractChanged);
    };
  }, []);

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

        {/* Auto Attack / Gather Toggle [C] */}
        <button
          id="desktop-auto-interact-btn"
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            GameEvents.emit('toggle-auto-interact');
          }}
          aria-pressed={autoInteractEnabled}
          title={`자동 공격·채집 토글 [C] (${autoInteractEnabled ? '켜짐' : '꺼짐'}) · 대각선 방향키 이동 중에도 자동으로 공격 및 채집`}
          className={`relative w-12 h-12 rounded-xl border-2 flex flex-col items-center justify-center transition-all active:scale-95 ${
            autoInteractEnabled
              ? 'bg-[#365314] border-[#a3e635] shadow-[0_0_12px_rgba(163,230,53,0.45)]'
              : 'bg-[#2a1d14]/90 border-[#785e42] hover:border-[#d6b286]'
          }`}
        >
          <img
            src="/assets/ui/Icons/Icon_05.png"
            alt="자동 공격/채집"
            className={`w-6 h-6 object-contain pixel-art ${
              autoInteractEnabled ? 'brightness-110' : 'opacity-80'
            }`}
          />
          <span
            className={`text-[9px] font-black leading-none mt-0.5 ${
              autoInteractEnabled ? 'text-[#d9f99d]' : 'text-[#d6b286]'
            }`}
          >
            {autoInteractEnabled ? 'AUTO' : '수동'}
          </span>
          <span className="absolute -top-1.5 -right-1.5 px-1 py-0.2 rounded bg-[#1c130d] border border-[#a6845c] text-[9px] font-black text-[#fef3c7] leading-tight">
            C
          </span>
        </button>
      </div>
    </div>
  );
};
