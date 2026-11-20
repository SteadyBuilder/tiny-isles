import React, { useEffect, useState } from 'react';
import { getBlueprint } from '../game/constants';
import { GameEvents } from '../game/events/gameEvents';
import { ConstructableType } from '../types/game';
import { PixelSquareButton } from './ui/PixelSquareButton';
import { BUILDING_SPRITE_MAP } from './village/VillageBlueprintCard';

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
  const spriteSrc = BUILDING_SPRITE_MAP[bp.spriteKey] || '/assets/ui/Icons/Tool_Hammer.png';

  const promptText =
    bp.category === 'tower'
      ? '초록색 외곽을 탭하세요'
      : bp.category === 'wall'
        ? '방어선 위치를 탭하세요'
        : '초록색 영역을 탭하세요';

  return (
    <div
      id="tower-placement-banner"
      className="fixed bottom-32 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[90vw] max-w-sm ts-wood-bar-tight text-[#fef5df]"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <img src={spriteSrc} alt={bp.name} className="w-7 h-7 object-contain pixel-art shrink-0" />
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-black text-[#fde68a] pixel-btn-shadow truncate">
              {bp.name}
            </div>
            <p
              className={`text-[11px] font-bold truncate pixel-btn-shadow ${
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
                  ? '배치 가능 · 다시 탭하여 확정'
                  : state.reason || '배치 불가'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <PixelSquareButton
            id="confirm-tower-placement-btn"
            iconSrc="/assets/ui/Icons/Tool_Hammer.png"
            alt="건설 확정"
            title="건설 확정"
            variant="blue"
            size="sm"
            disabled={!canConfirm}
            onClick={() => GameEvents.emit('confirm-tower-placement')}
          />
          <PixelSquareButton
            id="cancel-tower-placement-btn"
            label="✕"
            alt="배치 취소"
            title="배치 취소"
            variant="red"
            size="sm"
            onClick={() => GameEvents.emit('cancel-tower-placement')}
          />
        </div>
      </div>
    </div>
  );
};
