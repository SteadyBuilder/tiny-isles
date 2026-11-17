import React, { useEffect, useRef, useState } from 'react';
import { PLAYER_DAMAGED_OVERLAY_CONFIG } from '../data/combatFeedbackConfig';
import { GameEvents } from '../game/events/gameEvents';
import { PlayerDamagedFxPayload } from '../types/game';

/**
 * 플레이어 피격 시 전체 화면 가장자리를 붉게 점멸시키는 전투 피드백 오버레이
 */
export const CombatDamageOverlay: React.FC = () => {
  const [flashKey, setFlashKey] = useState(0);
  const [intensity, setIntensity] = useState(0);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleDamagedFx = (payload: PlayerDamagedFxPayload) => {
      const clamped = Math.max(0.35, Math.min(1, payload.intensity));
      setIntensity(clamped);
      setFlashKey((prev) => prev + 1);

      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
      clearTimerRef.current = setTimeout(() => {
        setIntensity(0);
        clearTimerRef.current = null;
      }, PLAYER_DAMAGED_OVERLAY_CONFIG.flashDurationMs);
    };

    GameEvents.on('player-damaged-fx', handleDamagedFx);
    return () => {
      GameEvents.off('player-damaged-fx', handleDamagedFx);
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
    };
  }, []);

  if (intensity <= 0) return null;

  return (
    <div
      key={flashKey}
      aria-hidden="true"
      className="fixed inset-0 z-50 pointer-events-none combat-damage-vignette"
      style={
        {
          '--damage-alpha': (0.58 * intensity).toFixed(2),
          '--damage-duration': `${PLAYER_DAMAGED_OVERLAY_CONFIG.flashDurationMs}ms`,
        } as React.CSSProperties
      }
    />
  );
};
