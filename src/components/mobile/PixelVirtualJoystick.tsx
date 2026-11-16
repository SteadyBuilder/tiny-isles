import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  GESTURE_BLOCK_PROPS,
  attachGestureBlock,
  hasTouchId,
} from '../../lib/touchGestureGuard';

export interface PixelVirtualJoystickProps {
  joystickRef?: React.MutableRefObject<{ x: number; y: number }>;
}

const JOYSTICK_RADIUS = 46;

export const PixelVirtualJoystick: React.FC<PixelVirtualJoystickProps> = ({ joystickRef }) => {
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const joystickTouchIdRef = useRef<number | null>(null);
  const joystickCenterRef = useRef({ x: 0, y: 0 });
  const joystickZoneRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = joystickZoneRef.current;
    if (!el) return;
    return attachGestureBlock(el);
  }, []);

  const resetJoystick = useCallback(() => {
    joystickTouchIdRef.current = null;
    setIsDragging(false);
    setKnobPos({ x: 0, y: 0 });
    if (joystickRef) joystickRef.current = { x: 0, y: 0 };
  }, [joystickRef]);

  useEffect(() => {
    const handleBlur = () => resetJoystick();
    const handleTouchRelease = (e: TouchEvent) => {
      const joystickId = joystickTouchIdRef.current;
      if (joystickId !== null && hasTouchId(e.changedTouches, joystickId)) {
        resetJoystick();
      }
    };
    window.addEventListener('blur', handleBlur);
    window.addEventListener('touchend', handleTouchRelease);
    window.addEventListener('touchcancel', handleTouchRelease);
    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('touchend', handleTouchRelease);
      window.removeEventListener('touchcancel', handleTouchRelease);
    };
  }, [resetJoystick]);

  const handleJoystickMove = (clientX: number, clientY: number) => {
    const dx = clientX - joystickCenterRef.current.x;
    const dy = clientY - joystickCenterRef.current.y;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, JOYSTICK_RADIUS);
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * clampedDist;
    const ky = Math.sin(angle) * clampedDist;
    setKnobPos({ x: kx, y: ky });
    if (joystickRef) {
      joystickRef.current = {
        x: Number((kx / JOYSTICK_RADIUS).toFixed(3)),
        y: Number((ky / JOYSTICK_RADIUS).toFixed(3)),
      };
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.changedTouches[0];
    joystickTouchIdRef.current = touch.identifier;
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    joystickCenterRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    handleJoystickMove(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchIdRef.current) {
        handleJoystickMove(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
        break;
      }
    }
  };

  return (
    <div
      ref={joystickZoneRef}
      {...GESTURE_BLOCK_PROPS}
      className="absolute pointer-events-auto touch-none"
      style={{
        bottom: 'max(1.25rem, env(safe-area-inset-bottom, 1.25rem))',
        left: 'max(1.25rem, env(safe-area-inset-left, 1.25rem))',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={resetJoystick}
      onTouchCancel={resetJoystick}
    >
      <div className="relative w-28 h-28 flex items-center justify-center">
        <img
          src="/assets/ui/joystick_compass_base.png"
          alt="이동 조이스틱"
          className={`w-full h-full pixel-art pointer-events-none transition-[filter] duration-100 ${
            isDragging
              ? 'brightness-110 drop-shadow-[0_6px_14px_rgba(250,204,21,0.35)]'
              : 'drop-shadow-[0_6px_12px_rgba(0,0,0,0.7)]'
          }`}
        />
        <div
          className="absolute w-14 h-14 flex items-center justify-center pointer-events-none transition-transform duration-75"
          style={{ transform: `translate(${knobPos.x}px, ${knobPos.y}px)` }}
        >
          <img
            src={isDragging ? '/assets/ui/round_red.png' : '/assets/ui/round_blue.png'}
            alt=""
            className="w-full h-full object-contain pixel-art drop-shadow-[0_4px_6px_rgba(0,0,0,0.75)]"
          />
          <img
            src="/assets/ui/Icons/Icon_Compass.png"
            alt=""
            className="absolute w-6 h-6 pixel-art -translate-y-[1px] drop-shadow-[0_1px_0_rgba(0,0,0,0.7)]"
          />
        </div>
      </div>
    </div>
  );
};
