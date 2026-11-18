import { useEffect, useRef } from 'react';

export interface EscapeKeyEventLike {
  key: string;
  repeat?: boolean;
  defaultPrevented?: boolean;
  preventDefault: () => void;
  stopPropagation: () => void;
  stopImmediatePropagation?: () => void;
}

/**
 * ESC 키 입력을 capture 단계에서 소비하고 모달 닫기 콜백을 실행한다.
 */
export function consumeEscapeKeyEvent(
  e: EscapeKeyEventLike,
  onClose: () => void
): boolean {
  if (e.key !== 'Escape') return false;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation?.();
  onClose();
  return true;
}

/**
 * 솔로 일시정지/종료 모달 토글을 허용해야 하는 ESC 키 입력인지 판별한다.
 * 모달이 이미 이벤트를 소비(defaultPrevented)했거나 키 반복(repeat)인 경우 무시한다.
 */
export function shouldTriggerSoloPauseOnEscape(
  e: Pick<EscapeKeyEventLike, 'key' | 'defaultPrevented' | 'repeat'>
): boolean {
  if (e.key !== 'Escape') return false;
  if (e.defaultPrevented || e.repeat) return false;
  return true;
}

/**
 * 모달이 열려 있을 때 ESC 키로 닫기를 처리하는 공용 훅.
 * capture 단계에서 이벤트를 소비해 하위 리스너(예: 솔로 일시정지)와 충돌하지 않도록 방지한다.
 */
export function useEscapeToClose(isActive: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isActive || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      consumeEscapeKeyEvent(e, () => onCloseRef.current());
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isActive]);
}
