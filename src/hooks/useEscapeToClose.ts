import { useEffect, useRef } from 'react';

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
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      onCloseRef.current();
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isActive]);
}
