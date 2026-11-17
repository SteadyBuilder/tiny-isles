import React, { useEffect, useRef } from 'react';
import { Island, PlayerProgressionState } from '../types/game';
import { GameEvents } from '../game/events/gameEvents';
import { getPinchEligibleTouches, getTouchDistance } from '../lib/touchGestureGuard';
import { PixelVirtualJoystick } from './mobile/PixelVirtualJoystick';
import { PixelActionButtons } from './mobile/PixelActionButtons';

interface MobileControlsProps {
  onAction: () => void;
  onOpenVillageModal?: () => void;
  canBuild?: boolean;
  joystickRef?: React.MutableRefObject<{ x: number; y: number }>;
  nearIsland?: Island | null;
  onZoomChange?: (zoom: number) => void;
  currentZoom?: number;
  progression?: PlayerProgressionState;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  onAction,
  onOpenVillageModal,
  canBuild = false,
  joystickRef,
  nearIsland,
  onZoomChange,
  currentZoom = 1.0,
  progression,
}) => {
  const zoomRef = useRef(currentZoom);
  zoomRef.current = currentZoom;
  const pinchDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef(1.0);

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
        const nextZoom = Math.min(
          2.0,
          Math.max(0.5, Number((pinchStartZoomRef.current * (dist / pinchDistRef.current)).toFixed(2)))
        );
        GameEvents.emit('set-zoom', nextZoom);
        onZoomChange?.(nextZoom);
      }
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (getPinchEligibleTouches(e.touches).length < 2) pinchDistRef.current = null;
    };
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

  return (
    <div className="md:hidden pointer-events-none select-none fixed inset-0 z-40">
      {/* Contextual Island Unlock Prompt Banner (Tiny Swords 9-Slice Pixel Button) */}
      {nearIsland && (
        <div
          className="absolute left-1/2 -translate-x-1/2 pointer-events-auto animate-bounce"
          style={{ bottom: 'max(6.5rem, calc(env(safe-area-inset-bottom, 0px) + 5.75rem))' }}
        >
          <button
            type="button"
            onClick={onAction}
            className="ts-btn-blue active:ts-btn-blue-pressed flex items-center gap-2 px-2 py-0.5 text-[#fef5df] text-xs font-black tabular-nums whitespace-nowrap hover:brightness-110"
          >
            <img src="/assets/ui/Icons/Icon_07.png" alt="" className="w-4 h-4 pixel-art shrink-0" />
            <span className="pixel-btn-shadow">#{nearIsland.id} 해금</span>
            <span className="flex items-center gap-1.5 text-[#fde68a] pixel-btn-shadow">
              <span className="inline-flex items-center gap-0.5">
                <img src="/assets/ui/Icons/Icon_02.png" alt="" className="w-3.5 h-3.5 pixel-art" />
                {nearIsland.costWood}
              </span>
              <span className="inline-flex items-center gap-0.5">
                <img src="/assets/decorations/Rock2.png" alt="" className="w-3.5 h-3.5 pixel-art" />
                {nearIsland.costStone}
              </span>
              {nearIsland.costGold > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <img src="/assets/ui/Icons/Icon_03.png" alt="" className="w-3.5 h-3.5 pixel-art" />
                  {nearIsland.costGold}
                </span>
              )}
            </span>
          </button>
        </div>
      )}

      <PixelVirtualJoystick joystickRef={joystickRef} />

      <PixelActionButtons
        onAction={onAction}
        onOpenVillageModal={onOpenVillageModal}
        canBuild={canBuild}
        progression={progression}
      />
    </div>
  );
};
