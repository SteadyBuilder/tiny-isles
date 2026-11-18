import { useEffect, useRef } from 'react';
import { GameEvents } from '../game/events/gameEvents';
import { resolveBuildModalKeyAction } from '../game/utils/buildModalKeyboardUtils';
import { isEditableDomTarget } from '../game/utils/keyboardInputUtils';

export interface UseVillageBuildModalShortcutsOptions {
  isActive: boolean;
  onClose: () => void;
  onChangeCategory: (delta: -1 | 1) => void;
  onSelectBlueprintIndex: (index: number) => void;
}

/**
 * 건설 모달이 열려 있는 동안 PC 키보드 단축키(B 토글, Q/E·←→·Tab 탭 전환, 1~8 빠른 건물 선택)를 처리하고,
 * Phaser 게임 입력 및 물약 단축키와의 충돌을 방지하는 전용 훅.
 */
export function useVillageBuildModalShortcuts({
  isActive,
  onClose,
  onChangeCategory,
  onSelectBlueprintIndex,
}: UseVillageBuildModalShortcutsOptions): void {
  const callbacksRef = useRef({
    onClose,
    onChangeCategory,
    onSelectBlueprintIndex,
  });

  useEffect(() => {
    callbacksRef.current = {
      onClose,
      onChangeCategory,
      onSelectBlueprintIndex,
    };
  }, [onClose, onChangeCategory, onSelectBlueprintIndex]);

  useEffect(() => {
    if (!isActive || typeof window === 'undefined') return;

    GameEvents.emit('ui-modal-keyboard-lock', true);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
      if (isEditableDomTarget(e.target) || isEditableDomTarget(activeEl)) {
        return;
      }

      const action = resolveBuildModalKeyAction(e);
      if (!action) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();

      switch (action.type) {
        case 'close':
          callbacksRef.current.onClose();
          break;
        case 'prev_category':
          callbacksRef.current.onChangeCategory(-1);
          break;
        case 'next_category':
          callbacksRef.current.onChangeCategory(1);
          break;
        case 'select_blueprint':
          callbacksRef.current.onSelectBlueprintIndex(action.index);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      GameEvents.emit('ui-modal-keyboard-lock', false);
    };
  }, [isActive]);
}
