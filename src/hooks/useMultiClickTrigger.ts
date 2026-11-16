import { useCallback, useEffect, useRef } from 'react';

export interface UseMultiClickTriggerOptions {
  requiredClicks: number;
  clickWindowMs: number;
  isActive?: boolean;
  onTrigger: () => void;
}

export function useMultiClickTrigger({
  requiredClicks,
  clickWindowMs,
  isActive = true,
  onTrigger,
}: UseMultiClickTriggerOptions): () => void {
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    clickCountRef.current = 0;
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      reset();
    }
  }, [isActive, reset]);

  useEffect(() => reset, [reset]);

  return useCallback(() => {
    clickCountRef.current += 1;
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }

    if (clickCountRef.current >= requiredClicks) {
      reset();
      onTrigger();
      return;
    }

    clickTimerRef.current = setTimeout(() => {
      reset();
    }, clickWindowMs);
  }, [requiredClicks, clickWindowMs, onTrigger, reset]);
}
