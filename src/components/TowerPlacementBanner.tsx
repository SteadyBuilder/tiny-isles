import React, { useEffect, useState } from 'react';
import { getBlueprint } from '../game/constants';
import { GameEvents } from '../game/events/gameEvents';
import { ConstructableType } from '../types/game';
import { PixelGameButton } from './ui/PixelGameButton';

interface PlacementBannerState {
  active: boolean;
  territoryId?: number;
  type?: ConstructableType;
  hasSelection?: boolean;
  isValid?: boolean;
  reason?: string;
}

export const TowerPlacementBanner: React.FC = () => {
  const [state, setState] = useState<PlacementBannerState>({ active: false });

  useEffect(() => {
    const handler = (payload: PlacementBannerState) => {
      setState(payload);
    };
    GameEvents.on('placement-state-changed', handler);
    return () => {
      GameEvents.off('placement-state-changed', handler);
    };
  }, []);

  if (!state.active || !state.type) return null;

  const bp = getBlueprint(state.type);
  const canConfirm = Boolean(state.hasSelection && state.isValid);

  const modeLabel =
    bp.category === 'tower'
      ? '외곽 배치'
      : bp.category === 'wall'
        ? '방어선 배치'
        : '위치 지정 배치';
  const promptText =
    bp.category === 'tower'
      ? '초록색 외곽 영역의 원하는 곳을 선택하세요 (성문 제외)'
      : bp.category === 'wall'
        ? '북·남·동·서 4방향 방어선 중 건설할 위치를 선택하세요'
        : '초록색 영지 내부 영역의 원하는 위치를 선택하세요';

  return (
    <div
      id="tower-placement-banner"
      className="fixed bottom-32 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92vw] max-w-md ts-wood-bar-tight text-[#fef5df]"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-[#fde68a] pixel-btn-shadow">
            <img src="/assets/ui/Icons/Tool_Hammer.png" alt="" className="w-4 h-4 pixel-art shrink-0" />
            <span className="truncate">{bp.name} {modeLabel}</span>
          </div>
          <p
            className={`text-[11px] font-bold mt-0.5 truncate pixel-btn-shadow ${
              !state.hasSelection
                ? 'text-[#f3e4c7]'
                : state.isValid
                  ? 'text-[#86efac]'
                  : 'text-[#fca5a5]'
            }`}
          >
            {!state.hasSelection
              ? promptText
              : state.isValid
                ? '배치 가능! 건설 확정 또는 해당 지점을 다시 탭하세요.'
                : state.reason || '배치할 수 없는 위치입니다.'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <PixelGameButton
            id="confirm-tower-placement-btn"
            label="건설"
            variant="blue"
            size="sm"
            disabled={!canConfirm}
            onClick={() => GameEvents.emit('confirm-tower-placement')}
          />
          <PixelGameButton
            id="cancel-tower-placement-btn"
            label="취소"
            variant="red"
            size="sm"
            onClick={() => GameEvents.emit('cancel-tower-placement')}
          />
        </div>
      </div>
    </div>
  );
};
