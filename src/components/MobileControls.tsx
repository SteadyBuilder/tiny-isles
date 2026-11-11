import React, { useRef, useEffect } from 'react';
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
  const baseRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== null) return;
    activePointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateJoystick(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    updateJoystick(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    activePointerId.current = null;
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

  const handleActionClick = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
    onAction();
  };

  useEffect(() => {
    return () => {
      joystickRef.current = { x: 0, y: 0 };
    };
  }, [joystickRef]);

  return (
    <div className="md:hidden pointer-events-none select-none fixed inset-0 z-40">
      {/* 1. Left: Virtual Joystick */}
      <div
        className="absolute bottom-6 left-6 pointer-events-auto touch-none"
        style={{
          bottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))',
          left: 'max(1.5rem, env(safe-area-inset-left, 1.5rem))',
        }}
      >
        <div
          ref={baseRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative w-28 h-28 rounded-full bg-slate-900/60 backdrop-blur-md border-2 border-white/20 shadow-2xl flex items-center justify-center cursor-pointer active:border-amber-400/60 transition-colors"
        >
          {/* Subtle Directional Guides */}
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

      {/* 2. Right: Action Controls Cluster */}
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
            onClick={handleActionClick}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 active:scale-95 text-white font-extrabold text-sm shadow-2xl border-2 border-emerald-300 animate-bounce"
          >
            <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300" />
            <span>🏝️ #{nearIsland.id} 개척하기</span>
          </button>
        )}

        {/* Primary Action Button (Chop / Mine / Attack) */}
        <button
          onClick={handleActionClick}
          className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-amber-500 via-amber-600 to-yellow-600 active:scale-90 text-white font-black text-3xl shadow-2xl border-2 border-white/60 flex items-center justify-center transition-transform"
          aria-label="행동 및 채집"
        >
          ⚔️
        </button>
      </div>
    </div>
  );
};
