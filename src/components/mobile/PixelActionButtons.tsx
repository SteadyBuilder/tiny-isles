import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PLAYER_CLASS_DEFINITIONS } from '../../data/classes';
import { GameEvents } from '../../game/events/gameEvents';
import { sound } from '../../lib/sound';
import { GESTURE_BLOCK_PROPS, attachGestureBlock } from '../../lib/touchGestureGuard';
import { PlayerProgressionState } from '../../types/game';

export interface PixelActionButtonsProps {
  onAction: () => void;
  onOpenVillageModal?: () => void;
  canBuild?: boolean;
  progression?: PlayerProgressionState;
}

export const PixelActionButtons: React.FC<PixelActionButtonsProps> = ({
  onAction,
  onOpenVillageModal,
  canBuild = false,
  progression,
}) => {
  const [isActionActive, setIsActionActive] = useState(false);
  const [isBuildPressed, setIsBuildPressed] = useState(false);
  const [isSkillPressed, setIsSkillPressed] = useState(false);
  const actionPointerIdRef = useRef<number | null>(null);
  const actionZoneRef = useRef<HTMLDivElement | null>(null);

  const classDef = progression ? PLAYER_CLASS_DEFINITIONS[progression.classId] : null;
  const skillCooldownSec = progression
    ? Math.max(0, Math.ceil(progression.skillCooldownRemainingMs / 1000))
    : 0;
  const isSkillOnCooldown = skillCooldownSec > 0;

  useEffect(() => {
    const el = actionZoneRef.current;
    if (!el) return;
    return attachGestureBlock(el);
  }, []);

  const stopActionHold = useCallback(() => {
    actionPointerIdRef.current = null;
    setIsActionActive(false);
    GameEvents.emit('player-action-stop');
  }, []);

  const startActionHold = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      actionPointerIdRef.current = e.pointerId;
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(25);
      setIsActionActive(true);
      onAction();
      GameEvents.emit('player-action-start');
    },
    [onAction]
  );

  useEffect(() => {
    const handleBlur = () => stopActionHold();
    const handlePointerRelease = (e: PointerEvent) => {
      if (actionPointerIdRef.current !== null && e.pointerId === actionPointerIdRef.current) {
        stopActionHold();
      }
    };
    window.addEventListener('blur', handleBlur);
    window.addEventListener('pointerup', handlePointerRelease);
    window.addEventListener('pointercancel', handlePointerRelease);
    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('pointerup', handlePointerRelease);
      window.removeEventListener('pointercancel', handlePointerRelease);
      stopActionHold();
    };
  }, [stopActionHold]);

  return (
    <div
      ref={actionZoneRef}
      {...GESTURE_BLOCK_PROPS}
      className="absolute pointer-events-auto touch-none flex flex-col items-center gap-2"
      style={{
        bottom: 'max(1.25rem, env(safe-area-inset-bottom, 1.25rem))',
        right: 'max(1.25rem, env(safe-area-inset-right, 1.25rem))',
      }}
    >
      {canBuild && onOpenVillageModal && (
        <button
          id="mobile-build-btn"
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsBuildPressed(true);
            sound.playClick();
            onOpenVillageModal();
          }}
          onPointerUp={() => setIsBuildPressed(false)}
          onPointerLeave={() => setIsBuildPressed(false)}
          onPointerCancel={() => setIsBuildPressed(false)}
          className="relative w-11 h-11 flex items-center justify-center select-none hover:brightness-110"
          aria-label="마을 건설 버튼"
          title="마을 발전 및 건설"
        >
          <img
            src={
              isBuildPressed
                ? '/assets/ui/square_red_pressed.png'
                : '/assets/ui/square_red.png'
            }
            alt=""
            className="w-full h-full object-contain pixel-art drop-shadow-[0_4px_6px_rgba(0,0,0,0.7)]"
          />
          <img
            src="/assets/ui/Icons/Tool_Hammer.png"
            alt="건설"
            className={`absolute w-5 h-5 pixel-art drop-shadow-[0_1px_0_rgba(0,0,0,0.7)] transition-transform duration-75 ${
              isBuildPressed ? 'translate-y-[2px]' : '-translate-y-[1px]'
            }`}
          />
        </button>
      )}

      {classDef && (
        <button
          id="mobile-skill-btn"
          type="button"
          disabled={isSkillOnCooldown}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isSkillOnCooldown) return;
            setIsSkillPressed(true);
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
            sound.playClick();
            GameEvents.emit('cast-active-skill');
          }}
          onPointerUp={() => setIsSkillPressed(false)}
          onPointerLeave={() => setIsSkillPressed(false)}
          onPointerCancel={() => setIsSkillPressed(false)}
          className={`relative w-12 h-12 rounded-full flex items-center justify-center select-none transition-[filter] ${
            isSkillOnCooldown
              ? 'cursor-not-allowed grayscale opacity-75'
              : 'hover:brightness-110'
          }`}
          aria-label={`${classDef.skillName} 스킬 버튼`}
          title={`${classDef.skillName}: ${classDef.skillDescription}`}
        >
          <img
            src={
              isSkillPressed && !isSkillOnCooldown
                ? '/assets/ui/round_blue_pressed.png'
                : '/assets/ui/round_blue.png'
            }
            alt=""
            className="w-full h-full object-contain pixel-art drop-shadow-[0_4px_6px_rgba(0,0,0,0.75)]"
          />
          <span
            className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-75 ${
              isSkillPressed && !isSkillOnCooldown ? 'translate-y-[2px]' : '-translate-y-[1px]'
            }`}
          >
            <span className="text-lg leading-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
              {classDef.skillIcon}
            </span>
          </span>
          {isSkillOnCooldown && (
            <span className="absolute inset-1 rounded-full bg-black/60 flex items-center justify-center text-[11px] font-black text-[#fca5a5] pixel-btn-shadow pointer-events-none">
              {skillCooldownSec}s
            </span>
          )}
        </button>
      )}

      <button
        type="button"
        onPointerDown={startActionHold}
        onPointerUp={stopActionHold}
        onPointerLeave={stopActionHold}
        onPointerCancel={stopActionHold}
        className="relative w-20 h-20 flex flex-col items-center justify-center select-none hover:brightness-110"
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
            className={`w-8 h-8 pixel-art drop-shadow-[0_2px_0_rgba(0,0,0,0.8)] ${
              isActionActive ? 'animate-pulse' : ''
            }`}
          />
          <span className="text-[10px] font-black text-[#fef5df] pixel-btn-shadow tracking-wider leading-none mt-0.5">
            ACTION
          </span>
        </span>
      </button>
    </div>
  );
};
