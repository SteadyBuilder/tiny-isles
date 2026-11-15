import React, { useEffect, useState } from 'react';
import { Check, MapPin, X } from 'lucide-react';
import { getBlueprint } from '../game/constants';
import { GameEvents } from '../game/events/gameEvents';
import { ConstructableType } from '../types/game';

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

  return (
    <div
      id="tower-placement-banner"
      className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92vw] max-w-md bg-[#3b2719]/95 border-2 border-[#e2a85c] rounded-2xl px-3.5 py-2.5 shadow-2xl text-[#faecd1] backdrop-blur-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-[#fde68a]">
            <MapPin className="w-4 h-4 shrink-0 text-[#4ade80]" />
            <span className="truncate">
              {bp.icon} {bp.name} 외곽 배치
            </span>
          </div>
          <p
            className={`text-[11px] font-bold mt-0.5 truncate ${
              !state.hasSelection
                ? 'text-[#d6c2a5]'
                : state.isValid
                  ? 'text-[#4ade80]'
                  : 'text-[#f87171]'
            }`}
          >
            {!state.hasSelection
              ? '초록색 외곽 영역의 원하는 곳을 선택하세요 (성문 제외)'
              : state.isValid
                ? '✅ 배치 가능! 건설 확정 또는 해당 지점을 다시 탭하세요.'
                : `❌ ${state.reason || '배치할 수 없는 위치입니다.'}`}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            id="confirm-tower-placement-btn"
            disabled={!canConfirm}
            onClick={() => GameEvents.emit('confirm-tower-placement')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 border transition ${
              canConfirm
                ? 'bg-[#22c55e] hover:bg-[#16a34a] text-white border-[#86efac] shadow active:scale-95'
                : 'bg-[#5c4534] text-[#9e8973] border-[#473325] cursor-not-allowed'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>건설</span>
          </button>
          <button
            id="cancel-tower-placement-btn"
            onClick={() => GameEvents.emit('cancel-tower-placement')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 bg-[#7f1d1d] hover:bg-[#991b1b] text-[#fee2e2] border border-[#f87171]/60 transition active:scale-95"
          >
            <X className="w-3.5 h-3.5" />
            <span>취소</span>
          </button>
        </div>
      </div>
    </div>
  );
};
