import React, { useEffect, useRef, useState } from 'react';
import { WAVE_INVASION_OVERLAY_CONFIG } from '../data/combatFeedbackConfig';
import { GameEvents, GameEventPayloads } from '../game/events/gameEvents';

interface InvasionFlashState {
  key: number;
  isBossWave: boolean;
}

/**
 * 몬스터 웨이브 침공 시 화면 전체를 붉게 점멸시켜 긴장감을 높이는 오버레이
 */
export const WaveInvasionOverlay: React.FC = () => {
  const [flash, setFlash] = useState<InvasionFlashState | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleWaveSpawned = (payload: GameEventPayloads['wave-spawned']) => {
      const isBossWave = Boolean(payload?.isBossWave);
      const pulseDurationMs = isBossWave
        ? WAVE_INVASION_OVERLAY_CONFIG.bossPulseDurationMs
        : WAVE_INVASION_OVERLAY_CONFIG.regularPulseDurationMs;
      const pulseCount = isBossWave
        ? WAVE_INVASION_OVERLAY_CONFIG.bossPulseCount
        : WAVE_INVASION_OVERLAY_CONFIG.regularPulseCount;
      const totalDurationMs = pulseDurationMs * pulseCount;

      setFlash((prev) => ({
        key: (prev?.key ?? 0) + 1,
        isBossWave,
      }));

      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
      clearTimerRef.current = setTimeout(() => {
        setFlash(null);
        clearTimerRef.current = null;
      }, totalDurationMs);
    };

    GameEvents.on('wave-spawned', handleWaveSpawned);
    return () => {
      GameEvents.off('wave-spawned', handleWaveSpawned);
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
    };
  }, []);

  if (!flash) return null;

  const pulseDurationMs = flash.isBossWave
    ? WAVE_INVASION_OVERLAY_CONFIG.bossPulseDurationMs
    : WAVE_INVASION_OVERLAY_CONFIG.regularPulseDurationMs;
  const pulseCount = flash.isBossWave
    ? WAVE_INVASION_OVERLAY_CONFIG.bossPulseCount
    : WAVE_INVASION_OVERLAY_CONFIG.regularPulseCount;
  const maxAlpha = flash.isBossWave
    ? WAVE_INVASION_OVERLAY_CONFIG.bossMaxAlpha
    : WAVE_INVASION_OVERLAY_CONFIG.regularMaxAlpha;

  return (
    <div
      key={flash.key}
      aria-hidden="true"
      className="fixed inset-0 z-40 pointer-events-none wave-invasion-vignette"
      style={
        {
          '--invasion-alpha': maxAlpha.toFixed(2),
          '--invasion-pulse-duration': `${pulseDurationMs}ms`,
          '--invasion-pulse-count': String(pulseCount),
        } as React.CSSProperties
      }
    />
  );
};
