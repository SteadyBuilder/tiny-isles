import React, { useEffect, useState } from 'react';
import { GameEvents } from '../game/events/gameEvents';
import { SkillTargetingState } from '../types/combat';
import { PixelGameButton } from './ui/PixelGameButton';

/**
 * 지점 지정형 액티브 스킬(메테오 노바, 화살비 등) 조준 모드 안내 및 취소 배너
 */
export const SkillTargetingBanner: React.FC = () => {
  const [state, setState] = useState<SkillTargetingState>({ active: false });

  useEffect(() => {
    const handler = (payload: SkillTargetingState) => {
      setState(payload);
    };
    GameEvents.on('skill-targeting-state-changed', handler);
    return () => {
      GameEvents.off('skill-targeting-state-changed', handler);
    };
  }, []);

  if (!state.active || !state.skillName) return null;

  return (
    <div
      id="skill-targeting-banner"
      className="fixed bottom-32 sm:bottom-20 left-1/2 -translate-x-1/2 z-40 w-[92vw] max-w-md ts-wood-bar-tight text-[#fef5df]"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-[#fde68a] pixel-btn-shadow">
            <span className="shrink-0">{state.skillIcon ?? '🎯'}</span>
            <span className="truncate">{state.skillName} 위치 지정 중</span>
          </div>
          <p className="text-[11px] font-bold mt-0.5 truncate text-[#f3e4c7] pixel-btn-shadow">
            원하는 지점을 클릭·터치해 발동 (우클릭 / ESC 취소)
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <PixelGameButton
            id="cancel-skill-targeting-btn"
            label="취소"
            variant="red"
            size="sm"
            onClick={() => GameEvents.emit('cancel-skill-targeting')}
          />
        </div>
      </div>
    </div>
  );
};
