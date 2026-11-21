import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PLAYER_CLASS_DEFINITIONS } from '../../data/classes';
import { HUD_ACTION_SPRITES } from '../../data/hudIcons';
import { GameEvents } from '../../game/events/gameEvents';
import { sound } from '../../lib/sound';
import { GESTURE_BLOCK_PROPS, attachGestureBlock } from '../../lib/touchGestureGuard';
import { DashCooldownState, PlayerProgressionState } from '../../types/game';
import { CooldownActionButton } from '../hud/CooldownActionButton';
import { PotionQuickSlot } from '../hud/PotionQuickSlot';

export interface PixelActionButtonsProps {
  onAction: () => void;
  onOpenVillageModal?: () => void;
  canBuild?: boolean;
  progression?: PlayerProgressionState;
  dashState?: DashCooldownState;
  isLandscapeMobile?: boolean;
}

export const PixelActionButtons: React.FC<PixelActionButtonsProps> = ({
  onAction,
  onOpenVillageModal,
  canBuild = false,
  progression,
  dashState,
  isLandscapeMobile = false,
}) => {
  const [isActionActive, setIsActionActive] = useState(false);
  const [isBuildPressed, setIsBuildPressed] = useState(false);
  const [isSkillPressed, setIsSkillPressed] = useState(false);
  const [isDashPressed, setIsDashPressed] = useState(false);
  const actionPointerIdRef = useRef<number | null>(null);
  const actionTouchIdRef = useRef<number | null>(null);
  const actionZoneRef = useRef<HTMLDivElement | null>(null);

  const classDef = progression ? PLAYER_CLASS_DEFINITIONS[progression.classId] : null;
  const skillCooldownMs = progression?.skillCooldownRemainingMs ?? 0;
  const skillCooldownMaxMs = progression?.skillCooldownMaxMs ?? classDef?.skillCooldownMs ?? 7000;
  const isSkillOnCooldown = skillCooldownMs > 0;

  const dashCooldownMs = dashState?.cooldownRemainingMs ?? 0;
  const dashCooldownMaxMs = dashState?.cooldownMaxMs ?? 1200;
  const isDashDisabled = dashCooldownMs > 0 || Boolean(dashState?.isDashing);

  useEffect(() => {
    const el = actionZoneRef.current;
    if (!el) return;
    return attachGestureBlock(el);
  }, []);

  const stopActionHold = useCallback(() => {
    actionPointerIdRef.current = null;
    actionTouchIdRef.current = null;
    setIsActionActive(false);
    GameEvents.emit('player-action-stop');
  }, []);

  const triggerActionHold = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(25);
    setIsActionActive(true);
    onAction();
    GameEvents.emit('player-action-start');
  }, [onAction]);

  const startActionHold = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === 'touch') return;
      e.preventDefault();
      actionPointerIdRef.current = e.pointerId;
      triggerActionHold();
    },
    [triggerActionHold]
  );

  const handleActionTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.changedTouches[0];
      if (!touch) return;
      actionTouchIdRef.current = touch.identifier;
      triggerActionHold();
    },
    [triggerActionHold]
  );

  const handleActionTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const activeId = actionTouchIdRef.current;
      if (activeId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeId) {
          stopActionHold();
          break;
        }
      }
    },
    [stopActionHold]
  );

  const triggerBuildPress = useCallback(() => {
    if (!canBuild || !onOpenVillageModal) return;
    setIsBuildPressed(true);
    sound.playClick();
    onOpenVillageModal();
  }, [canBuild, onOpenVillageModal]);

  const triggerSkillPress = useCallback(() => {
    if (isSkillOnCooldown) return;
    setIsSkillPressed(true);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
    sound.playClick();
    GameEvents.emit('cast-active-skill');
  }, [isSkillOnCooldown]);

  const triggerDashPress = useCallback(() => {
    if (isDashDisabled) return;
    setIsDashPressed(true);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(18);
    GameEvents.emit('trigger-dash');
  }, [isDashDisabled]);

  useEffect(() => {
    const handleBlur = () => stopActionHold();
    const handlePointerRelease = (e: PointerEvent) => {
      if (actionPointerIdRef.current !== null && e.pointerId === actionPointerIdRef.current) {
        stopActionHold();
      }
    };
    const handleTouchRelease = (e: TouchEvent) => {
      const activeId = actionTouchIdRef.current;
      if (activeId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeId) {
          stopActionHold();
          break;
        }
      }
    };
    window.addEventListener('blur', handleBlur);
    window.addEventListener('pointerup', handlePointerRelease);
    window.addEventListener('pointercancel', handlePointerRelease);
    window.addEventListener('touchend', handleTouchRelease);
    window.addEventListener('touchcancel', handleTouchRelease);
    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('pointerup', handlePointerRelease);
      window.removeEventListener('pointercancel', handlePointerRelease);
      window.removeEventListener('touchend', handleTouchRelease);
      window.removeEventListener('touchcancel', handleTouchRelease);
      stopActionHold();
    };
  }, [stopActionHold]);

  return (
    <div
      ref={actionZoneRef}
      {...GESTURE_BLOCK_PROPS}
      className="absolute pointer-events-auto touch-none flex items-end gap-2"
      style={{
        bottom: isLandscapeMobile
          ? 'max(0.55rem, env(safe-area-inset-bottom, 0.55rem))'
          : 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))',
        right: isLandscapeMobile
          ? 'max(0.55rem, env(safe-area-inset-right, 0.55rem))'
          : 'max(0.75rem, env(safe-area-inset-right, 0.75rem))',
      }}
    >
      {/* Landscape Bottom-Right Potion Quick-Slots (M Classic style right-thumb zone) */}
      {isLandscapeMobile && progression && (
        <div className="mb-1.5 px-1.5 py-1 rounded-xl bg-[#18110c]/75 border border-[#85532a]/70 backdrop-blur-[2px] shadow-lg">
          <PotionQuickSlot
            potions={progression.potions}
            cooldownRemainingMs={progression.potionCooldownRemainingMs ?? 0}
            compact
          />
        </div>
      )}

      <div className="flex flex-col items-end gap-1.5">
        <div className={`flex flex-col items-center gap-1.5 ${isLandscapeMobile ? 'mr-2' : 'mr-3'}`}>
          {onOpenVillageModal && (
          <button
            id="mobile-build-btn"
            type="button"
            disabled={!canBuild}
            onTouchStart={(e) => {
              e.stopPropagation();
              triggerBuildPress();
            }}
            onTouchEnd={() => setIsBuildPressed(false)}
            onTouchCancel={() => setIsBuildPressed(false)}
            onPointerDown={(e) => {
              if (e.pointerType === 'touch') return;
              e.preventDefault();
              e.stopPropagation();
              triggerBuildPress();
            }}
            onPointerUp={() => setIsBuildPressed(false)}
            onPointerLeave={() => setIsBuildPressed(false)}
            onPointerCancel={() => setIsBuildPressed(false)}
            className={`relative w-9 h-9 flex items-center justify-center select-none touch-none transition-[filter] ${
              canBuild
                ? 'hover:brightness-110'
                : 'cursor-not-allowed grayscale opacity-60'
            }`}
            aria-label="마을 건설 버튼"
            title={canBuild ? '마을 발전 및 건설' : '내 영지 안에서만 건설할 수 있습니다'}
          >
            <img
              src={
                isBuildPressed && canBuild
                  ? '/assets/ui/square_red_pressed.png'
                  : '/assets/ui/square_red.png'
              }
              alt=""
              className="w-full h-full object-contain pixel-art drop-shadow-[0_4px_6px_rgba(0,0,0,0.7)]"
            />
            <img
              src="/assets/ui/Icons/Tool_Hammer.png"
              alt="건설"
              className={`absolute w-4 h-4 pixel-art drop-shadow-[0_1px_0_rgba(0,0,0,0.7)] transition-transform duration-75 ${
                isBuildPressed && canBuild ? 'translate-y-[2px]' : '-translate-y-[1px]'
              }`}
            />
          </button>
        )}

        {classDef && progression && (
          <CooldownActionButton
            id="mobile-skill-btn"
            cooldownRemainingMs={skillCooldownMs}
            cooldownMaxMs={skillCooldownMaxMs}
            spritePath={classDef.skillSpritePath}
            alt={classDef.skillName}
            ariaLabel={`${classDef.skillName} 스킬 버튼`}
            title={`${classDef.skillName}: ${classDef.skillDescription}`}
            accentTheme="blue"
            shape="round"
            sizeClass="w-10 h-10 shadow-[0_4px_6px_rgba(0,0,0,0.75)]"
            iconSizeClass="w-6 h-6"
            isPressed={isSkillPressed}
            onTouchStart={(e) => {
              e.stopPropagation();
              triggerSkillPress();
            }}
            onTouchEnd={() => setIsSkillPressed(false)}
            onTouchCancel={() => setIsSkillPressed(false)}
            onPointerDown={(e) => {
              if (e.pointerType === 'touch') return;
              e.preventDefault();
              e.stopPropagation();
              triggerSkillPress();
            }}
            onPointerUp={() => setIsSkillPressed(false)}
            onPointerLeave={() => setIsSkillPressed(false)}
            onPointerCancel={() => setIsSkillPressed(false)}
          />
        )}
      </div>

      <div className="flex items-end gap-2">
        <div className="mb-1">
          <CooldownActionButton
            id="mobile-dash-btn"
            disabled={Boolean(dashState?.isDashing)}
            cooldownRemainingMs={dashCooldownMs}
            cooldownMaxMs={dashCooldownMaxMs}
            spritePath={HUD_ACTION_SPRITES.dash}
            alt="순간 대시"
            ariaLabel="순간 대시 버튼"
            title="순간 대시 회피기 (무적 판정)"
            accentTheme="cyan"
            shape="round"
            sizeClass="w-11 h-11 shadow-[0_4px_6px_rgba(0,0,0,0.75)]"
            iconSizeClass="w-6 h-6"
            isPressed={isDashPressed}
            onTouchStart={(e) => {
              e.stopPropagation();
              triggerDashPress();
            }}
            onTouchEnd={() => setIsDashPressed(false)}
            onTouchCancel={() => setIsDashPressed(false)}
            onPointerDown={(e) => {
              if (e.pointerType === 'touch') return;
              e.preventDefault();
              e.stopPropagation();
              triggerDashPress();
            }}
            onPointerUp={() => setIsDashPressed(false)}
            onPointerLeave={() => setIsDashPressed(false)}
            onPointerCancel={() => setIsDashPressed(false)}
          />
        </div>

        <button
          type="button"
          onTouchStart={handleActionTouchStart}
          onTouchEnd={handleActionTouchEnd}
          onTouchCancel={handleActionTouchEnd}
          onPointerDown={startActionHold}
          onPointerUp={stopActionHold}
          onPointerLeave={stopActionHold}
          onPointerCancel={stopActionHold}
          className="relative w-16 h-16 flex flex-col items-center justify-center select-none touch-none hover:brightness-110"
          aria-label="채집 및 공격 액션 버튼"
        >
          <img
            src={
              isActionActive
                ? '/assets/ui/round_red_pressed.png'
                : '/assets/ui/round_blue.png'
            }
            alt=""
            className={`w-full h-full object-contain pixel-art transition-[filter] duration-75 ${
              isActionActive
                ? 'drop-shadow-[0_2px_10px_rgba(239,68,68,0.7)]'
                : 'drop-shadow-[0_6px_10px_rgba(0,0,0,0.75)]'
            }`}
          />
          <span
            className={`absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-transform duration-75 ${
              isActionActive ? 'translate-y-[3px]' : '-translate-y-[1px]'
            }`}
          >
            <img
              src="/assets/ui/Icons/Icon_05.png"
              alt=""
              className={`w-6 h-6 pixel-art drop-shadow-[0_2px_0_rgba(0,0,0,0.8)] ${
                isActionActive ? 'animate-pulse' : ''
              }`}
            />
            <span className="text-[9px] font-black text-[#fef5df] pixel-btn-shadow tracking-wider leading-none mt-0.5">
              ACTION
            </span>
          </span>
        </button>
      </div>
      </div>
    </div>
  );
};
