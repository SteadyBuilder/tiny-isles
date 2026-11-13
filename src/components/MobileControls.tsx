import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Island } from '../types/game';
import { Sparkles, Swords } from 'lucide-react';
import { EventBus } from '../game/phaser/EventBus';
import {
  GESTURE_BLOCK_PROPS,
  attachGestureBlock,
  getPinchEligibleTouches,
  getTouchDistance,
  hasTouchId,
} from '../lib/touchGestureGuard';

interface MobileControlsProps {
  onAction: () => void;
  joystickRef?: React.MutableRefObject<{ x: number; y: number }>;
  nearIsland?: Island | null;
  onZoomChange?: (zoom: number) => void;
  currentZoom?: number;
}

const JOYSTICK_RADIUS = 46;

export const MobileControls: React.FC<MobileControlsProps> = ({
  onAction, joystickRef, nearIsland, onZoomChange, currentZoom = 1.0,
}) => {
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isActionActive, setIsActionActive] = useState(false);
  const joystickTouchIdRef = useRef<number | null>(null);
  const joystickCenterRef = useRef({ x: 0, y: 0 });
  const actionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const actionPointerIdRef = useRef<number | null>(null);

  const zoomRef = useRef(currentZoom);
  zoomRef.current = currentZoom;
  const pinchDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef(1.0);
  const joystickZoneRef = useRef<HTMLDivElement | null>(null);
  const actionZoneRef = useRef<HTMLDivElement | null>(null);

  // Control zones swallow their touches so Phaser never counts them toward a pinch gesture
  useEffect(() => {
    const cleanups = [joystickZoneRef.current, actionZoneRef.current]
      .filter((el): el is HTMLDivElement => el !== null)
      .map((el) => attachGestureBlock(el));
    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  const stopActionHold = useCallback(() => {
    actionPointerIdRef.current = null;
    setIsActionActive(false);
    if (actionIntervalRef.current) { clearInterval(actionIntervalRef.current); actionIntervalRef.current = null; }
    EventBus.emit('player-action-stop');
  }, []);

  const startActionHold = useCallback((e: React.PointerEvent | React.TouchEvent) => {
    e.preventDefault();
    actionPointerIdRef.current = 'pointerId' in e ? e.pointerId : null;
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(25);
    setIsActionActive(true);
    onAction();
    EventBus.emit('player-action-start');
    if (actionIntervalRef.current) clearInterval(actionIntervalRef.current);
    actionIntervalRef.current = setInterval(() => onAction(), 220);
  }, [onAction]);

  const resetJoystick = useCallback(() => {
    joystickTouchIdRef.current = null;
    setKnobPos({ x: 0, y: 0 });
    if (joystickRef) joystickRef.current = { x: 0, y: 0 };
  }, [joystickRef]);

  // Prevent input stuck on release or blur.
  // Each control is reset only when ITS OWN touch/pointer ends, so lifting the ACTION finger
  // doesn't kill joystick movement (and vice versa). Window blur still resets everything.
  useEffect(() => {
    const handleBlur = () => { resetJoystick(); stopActionHold(); };
    const handleTouchRelease = (e: TouchEvent) => {
      const joystickId = joystickTouchIdRef.current;
      if (joystickId !== null && hasTouchId(e.changedTouches, joystickId)) resetJoystick();
    };
    const handlePointerRelease = (e: PointerEvent) => {
      if (actionPointerIdRef.current !== null && e.pointerId === actionPointerIdRef.current) stopActionHold();
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
  }, [resetJoystick, stopActionHold]);

  // 2-Finger Pinch Zoom on Window (touches on joystick / ACTION zones are excluded)
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const touches = getPinchEligibleTouches(e.touches);
      if (touches.length === 2) {
        pinchDistRef.current = getTouchDistance(touches[0], touches[1]);
        pinchStartZoomRef.current = zoomRef.current;
      } else {
        pinchDistRef.current = null;
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      const touches = getPinchEligibleTouches(e.touches);
      if (touches.length === 2 && pinchDistRef.current && pinchDistRef.current > 0) {
        e.preventDefault();
        const dist = getTouchDistance(touches[0], touches[1]);
        const nextZoom = Math.min(2.0, Math.max(0.5, Number((pinchStartZoomRef.current * (dist / pinchDistRef.current)).toFixed(2))));
        EventBus.emit('set-zoom', nextZoom);
        onZoomChange?.(nextZoom);
      }
    };
    const handleTouchEnd = (e: TouchEvent) => { if (getPinchEligibleTouches(e.touches).length < 2) pinchDistRef.current = null; };
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [onZoomChange]);

  const handleJoystickTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.changedTouches[0];
    joystickTouchIdRef.current = touch.identifier;
    const rect = e.currentTarget.getBoundingClientRect();
    joystickCenterRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    handleJoystickMove(touch.clientX, touch.clientY);
  };

  const handleJoystickTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchIdRef.current) {
        handleJoystickMove(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
        break;
      }
    }
  };

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

  return (
    <div className="md:hidden pointer-events-none select-none fixed inset-0 z-40">
      {/* 1. Contextual Island Unlock Prompt Banner */}
      {nearIsland && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-28 pointer-events-auto animate-bounce">
          <button
            onClick={onAction}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-800 border-2 border-amber-300 shadow-2xl active:scale-95 text-white"
          >
            <Sparkles className="w-4 h-4 text-amber-200 fill-amber-200" />
            <div className="flex flex-col text-left text-xs font-black text-amber-100">
              <span>🚩 #{nearIsland.id} 영지 개척</span>
              <span className="text-[10px] text-amber-200/90 font-bold">🪵{nearIsland.costWood} 🪨{nearIsland.costStone}{nearIsland.costGold > 0 ? ` 🪙${nearIsland.costGold}` : ''}</span>
            </div>
          </button>
        </div>
      )}

      {/* 2. Virtual Joystick (Bottom Left) */}
      <div
        ref={joystickZoneRef}
        {...GESTURE_BLOCK_PROPS}
        className="absolute bottom-6 left-6 pointer-events-auto touch-none"
        onTouchStart={handleJoystickTouchStart}
        onTouchMove={handleJoystickTouchMove}
        onTouchEnd={resetJoystick}
        onTouchCancel={resetJoystick}
      >
        <div className="relative w-28 h-28 rounded-full bg-slate-950/60 backdrop-blur-sm border-2 border-amber-400/50 shadow-2xl flex items-center justify-center">
          <div className="absolute w-12 h-12 rounded-full border border-white/20 bg-white/5 pointer-events-none" />
          <div
            className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-xl border-2 border-white/80 transition-transform duration-75 flex items-center justify-center text-[10px] font-black text-amber-950"
            style={{ transform: `translate(${knobPos.x}px, ${knobPos.y}px)` }}
          >🕹️</div>
        </div>
      </div>

      {/* 3. Large Action Button with Hold Support (Bottom Right) */}
      <div ref={actionZoneRef} {...GESTURE_BLOCK_PROPS} className="absolute bottom-6 right-6 pointer-events-auto touch-none">
        <button
          onPointerDown={startActionHold}
          onPointerUp={stopActionHold}
          onPointerLeave={stopActionHold}
          onPointerCancel={stopActionHold}
          className={`relative w-20 h-20 rounded-full border-4 shadow-2xl flex flex-col items-center justify-center transition-transform active:scale-90 ${
            isActionActive
              ? 'bg-gradient-to-br from-red-600 to-amber-600 border-amber-200 scale-95 shadow-amber-500/50'
              : 'bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 border-amber-300'
          }`}
          aria-label="채집 및 공격 액션 버튼"
        >
          <Swords className={`w-8 h-8 text-white drop-shadow ${isActionActive ? 'animate-pulse' : ''}`} />
          <span className="text-[10px] font-black text-amber-100 tracking-wider mt-0.5">ACTION</span>
        </button>
      </div>
    </div>
  );
};
