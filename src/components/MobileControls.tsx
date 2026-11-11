import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Island } from '../types/game';
import { Sparkles } from 'lucide-react';

interface MobileControlsProps {
  onAction: () => void;
  joystickRef: React.MutableRefObject<{ x: number; y: number }>;
  nearIsland?: Island | null;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  onAction,
  joystickRef,
  nearIsland,
}) => {
  // Joystick State
  const baseRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);
  const activeJoystickPointerId = useRef<number | null>(null);

  // Action Button State (Continuous hold)
  const [isActionActive, setIsActionActive] = useState(false);
  const actionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const actionPointerIdRef = useRef<number | null>(null);

  const handleJoystickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeJoystickPointerId.current !== null) return;
    activeJoystickPointerId.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    updateJoystick(e.clientX, e.clientY);
  };

  const handleJoystickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeJoystickPointerId.current !== e.pointerId) return;
    updateJoystick(e.clientX, e.clientY);
  };

  const handleJoystickPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeJoystickPointerId.current !== e.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    activeJoystickPointerId.current = null;
    resetJoystick();
  };

  const updateJoystick = (clientX: number, clientY: number) => {
    if (!baseRef.current || !knobRef.current) return;
    const rect = baseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);
    const maxRadius = 40;

    let knobX = dx;
    let knobY = dy;

    if (dist > maxRadius) {
      knobX = (dx / dist) * maxRadius;
      knobY = (dy / dist) * maxRadius;
    }

    knobRef.current.style.transform = `translate3d(${knobX}px, ${knobY}px, 0)`;

    // Deadzone check
    if (dist < 6) {
      joystickRef.current = { x: 0, y: 0 };
    } else {
      joystickRef.current = {
        x: Number((knobX / maxRadius).toFixed(3)),
        y: Number((knobY / maxRadius).toFixed(3)),
      };
    }
  };

  const resetJoystick = () => {
    if (knobRef.current) {
      knobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
    }
    joystickRef.current = { x: 0, y: 0 };
  };

  // Continuous Attack / Gathering Action handlers
  const executeActionOnce = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15);
    }
    onAction();
  }, [onAction]);

  const handleActionPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (actionPointerIdRef.current !== null) return;
    actionPointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setIsActionActive(true);

    // Immediate initial action
    executeActionOnce();

    // Clear previous interval if any
    if (actionIntervalRef.current) {
      clearInterval(actionIntervalRef.current);
    }

    // Continuous execution while held down (every 220ms)
    actionIntervalRef.current = setInterval(() => {
      executeActionOnce();
    }, 220);
  };

  const stopActionHold = (e?: React.PointerEvent<HTMLDivElement>) => {
    if (e && actionPointerIdRef.current !== null && e.pointerId !== actionPointerIdRef.current) {
      return;
    }
    if (e) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    actionPointerIdRef.current = null;
    setIsActionActive(false);

    if (actionIntervalRef.current) {
      clearInterval(actionIntervalRef.current);
      actionIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      joystickRef.current = { x: 0, y: 0 };
      if (actionIntervalRef.current) {
        clearInterval(actionIntervalRef.current);
      }
    };
  }, [joystickRef]);

  return (
    <div className="md:hidden pointer-events-none select-none fixed inset-0 z-40">
      {/* 1. Left: Virtual Joystick (Movement) */}
      <div
        className="absolute bottom-6 left-6 pointer-events-auto touch-none"
        style={{
          bottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))',
          left: 'max(1.5rem, env(safe-area-inset-left, 1.5rem))',
        }}
      >
        <div
          ref={baseRef}
          onPointerDown={handleJoystickPointerDown}
          onPointerMove={handleJoystickPointerMove}
          onPointerUp={handleJoystickPointerUp}
          onPointerCancel={handleJoystickPointerUp}
          className="relative w-28 h-28 rounded-full bg-slate-900/60 backdrop-blur-md border-2 border-white/20 shadow-2xl flex items-center justify-center cursor-pointer active:border-amber-400/60 transition-colors"
          role="button"
          aria-label="이동 조이스틱"
        >
          {/* Directional Guides */}
          <div className="absolute inset-2 rounded-full border border-dashed border-white/10 pointer-events-none" />
          <span className="absolute top-1 text-[10px] text-white/30 font-bold pointer-events-none">▲</span>
          <span className="absolute bottom-1 text-[10px] text-white/30 font-bold pointer-events-none">▼</span>
          <span className="absolute left-1.5 text-[10px] text-white/30 font-bold pointer-events-none">◀</span>
          <span className="absolute right-1.5 text-[10px] text-white/30 font-bold pointer-events-none">▶</span>

          {/* Joystick Stick / Knob */}
          <div
            ref={knobRef}
            className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 border-2 border-white/80 shadow-lg flex items-center justify-center will-change-transform pointer-events-none"
          >
            <div className="w-4 h-4 rounded-full bg-white/40 shadow-inner" />
          </div>
        </div>
      </div>

      {/* 2. Right: Action Controls (Attack / Harvest - matching movement button) */}
      <div
        className="absolute bottom-6 right-6 pointer-events-auto flex flex-col items-end gap-3 touch-none"
        style={{
          bottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))',
          right: 'max(1.5rem, env(safe-area-inset-right, 1.5rem))',
        }}
      >
        {/* Contextual Island Unlock Prompt Button */}
        {nearIsland && (
          <button
            onClick={executeActionOnce}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 active:scale-95 text-white font-extrabold text-xs shadow-2xl border-2 border-emerald-300 animate-bounce"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
            <span>🏝️ #{nearIsland.id} 개척</span>
          </button>
        )}

        {/* Primary Action Button - matches joystick base and knob design, with continuous action on hold */}
        <div
          onPointerDown={handleActionPointerDown}
          onPointerUp={stopActionHold}
          onPointerCancel={stopActionHold}
          onLostPointerCapture={stopActionHold}
          className={`relative w-28 h-28 rounded-full bg-slate-900/60 backdrop-blur-md border-2 shadow-2xl flex items-center justify-center cursor-pointer transition-all select-none ${
            isActionActive ? 'border-amber-400 bg-slate-900/80 scale-95' : 'border-white/20 active:border-amber-400/60'
          }`}
          role="button"
          aria-label="공격 및 채집 (누르고 있으면 연속 공격)"
        >
          {/* Matching Dashed Circle Guide */}
          <div
            className={`absolute inset-2 rounded-full border border-dashed transition-colors pointer-events-none ${
              isActionActive ? 'border-amber-400/40' : 'border-white/10'
            }`}
          />

          {/* Action Center Knob (matches joystick knob style & size) */}
          <div
            className={`w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 border-2 border-white/80 shadow-lg flex items-center justify-center text-2xl will-change-transform pointer-events-none transition-transform ${
              isActionActive ? 'scale-90 shadow-inner brightness-110' : 'scale-100'
            }`}
          >
            <span className="select-none leading-none">⚔️</span>
          </div>

          {/* Hold guidance label */}
          <span className="absolute bottom-1 text-[9px] text-white/50 font-bold tracking-tight pointer-events-none">
            {isActionActive ? '연속 공격 중' : '누르고 있기'}
          </span>
        </div>
      </div>
    </div>
  );
};
