import React, { useEffect, useState } from 'react';
import { Island } from '../types/game';
import { Sparkles } from 'lucide-react';

interface MobileControlsProps {
  onAction: () => void;
  joystickRef?: React.MutableRefObject<{ x: number; y: number }>;
  nearIsland?: Island | null;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  onAction,
  nearIsland,
}) => {
  const [showGuide, setShowGuide] = useState(() => {
    return !sessionStorage.getItem('touch_guide_seen');
  });

  useEffect(() => {
    if (showGuide) {
      const timer = setTimeout(() => {
        setShowGuide(false);
        sessionStorage.setItem('touch_guide_seen', '1');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showGuide]);

  return (
    <div className="md:hidden pointer-events-none select-none fixed inset-0 z-40">
      {/* 1. Contextual Island Unlock Prompt Banner (Tiny Swords Styled) */}
      {nearIsland && (
        <div
          className="absolute left-1/2 -translate-x-1/2 pointer-events-auto touch-manipulation animate-bounce"
          style={{
            bottom: 'max(1.8rem, env(safe-area-inset-bottom, 1.8rem))',
          }}
        >
          <button
            onClick={() => {
              if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(20);
              }
              onAction();
            }}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 border-2 border-amber-300 shadow-2xl active:scale-95 text-white transition-transform"
          >
            <Sparkles className="w-4 h-4 text-amber-200 fill-amber-200" />
            <div className="flex flex-col text-left leading-tight">
              <span className="text-xs font-black text-amber-100">
                🚩 #{nearIsland.id} 영지 개척 (터치)
              </span>
              <div className="flex items-center gap-2 text-[10px] text-amber-200/90 font-bold mt-0.5">
                <span className="flex items-center gap-0.5">
                  <img src="/assets/ui/Icons/Icon_02.png" alt="wood" className="w-3 h-3 pixel-art inline" />
                  {nearIsland.costWood}
                </span>
                <span className="flex items-center gap-0.5">
                  <img src="/assets/ui/Icons/Icon_01.png" alt="stone" className="w-3 h-3 pixel-art inline" />
                  {nearIsland.costStone}
                </span>
                {nearIsland.costGold > 0 && (
                  <span className="flex items-center gap-0.5">
                    <img src="/assets/ui/Icons/Icon_03.png" alt="gold" className="w-3 h-3 pixel-art inline" />
                    {nearIsland.costGold}
                  </span>
                )}
              </div>
            </div>
          </button>
        </div>
      )}

      {/* 2. Touch Navigation Floating Toast (Disappears after 5s) */}
      {showGuide && (
        <div
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none transition-opacity duration-500"
          style={{
            bottom: 'max(4.5rem, env(safe-area-inset-bottom, 4.5rem))',
          }}
        >
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/75 backdrop-blur-md border border-white/20 text-white/90 text-[11px] font-medium shadow-lg animate-fadeIn">
            <img src="/assets/ui/Cursors/Cursor_02.png" alt="touch" className="w-4 h-4 pixel-art" />
            <span>화면을 터치하여 이동 및 자원 채집!</span>
          </div>
        </div>
      )}
    </div>
  );
};
