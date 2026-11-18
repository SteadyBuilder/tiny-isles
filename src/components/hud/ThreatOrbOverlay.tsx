import React, { useEffect, useRef, useState } from 'react';
import { PERFORMANCE_CONFIG } from '../../data/performanceConfig';
import { GameEvents } from '../../game/events/gameEvents';
import { ThreatOrbFxPayload } from '../../types/game';

interface OrbSimulation {
  id: number;
  startX: number;
  startY: number;
  dropX: number;
  dropY: number;
  ctrlX: number;
  ctrlY: number;
  createdAt: number;
  dropDurationMs: number;
  flyDurationMs: number;
}

function getThreatTargetCenter(): { x: number; y: number } {
  const desktopBar = document.getElementById('threat-gauge-container');
  if (desktopBar) {
    const rect = desktopBar.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.5 };
    }
  }
  const mobileGauge =
    document.getElementById('threat-mobile-gauge-container') ??
    document.getElementById('threat-mobile-badge');
  if (mobileGauge) {
    const rect = mobileGauge.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.5 };
    }
  }
  return { x: 140, y: 76 };
}

export const ThreatOrbOverlay: React.FC = () => {
  const [orbIds, setOrbIds] = useState<number[]>([]);
  const simsRef = useRef<OrbSimulation[]>([]);
  const nodeRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const nextIdRef = useRef(1);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = (now: number) => {
      const remaining: OrbSimulation[] = [];
      let flyTarget: { x: number; y: number } | null = null;
      let listChanged = false;
      let arrivedThisFrame = false;

      for (const sim of simsRef.current) {
        const elapsed = now - sim.createdAt;
        const totalMs = sim.dropDurationMs + sim.flyDurationMs;

        if (elapsed >= totalMs) {
          listChanged = true;
          arrivedThisFrame = true;
          continue;
        }

        remaining.push(sim);
        const el = nodeRefs.current.get(sim.id);
        if (!el) continue;

        if (elapsed < 0) {
          el.style.opacity = '0';
          continue;
        }

        if (elapsed < sim.dropDurationMs) {
          const t = elapsed / sim.dropDurationMs;
          const ease = 1 - Math.pow(1 - t, 2);
          const bounceArc = Math.sin(t * Math.PI) * 14;
          const x = sim.startX + (sim.dropX - sim.startX) * ease;
          const y = sim.startY + (sim.dropY - sim.startY) * ease - bounceArc;
          const scale = 0.75 + 0.35 * Math.sin(t * Math.PI);
          el.style.transform = `translate3d(${x - 7}px, ${y - 7}px, 0) scale(${scale})`;
          el.style.opacity = '1';
        } else {
          if (!flyTarget) {
            flyTarget = getThreatTargetCenter();
          }
          const t = (elapsed - sim.dropDurationMs) / sim.flyDurationMs;
          const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          const inv = 1 - ease;
          const x = inv * inv * sim.dropX + 2 * inv * ease * sim.ctrlX + ease * ease * flyTarget.x;
          const y = inv * inv * sim.dropY + 2 * inv * ease * sim.ctrlY + ease * ease * flyTarget.y;
          const scale = 1.05 - 0.35 * ease;
          const opacity = t > 0.85 ? 1 - (t - 0.85) / 0.15 : 1;
          el.style.transform = `translate3d(${x - 7}px, ${y - 7}px, 0) scale(${scale})`;
          el.style.opacity = String(opacity);
        }
      }

      simsRef.current = remaining;
      if (arrivedThisFrame) {
        window.dispatchEvent(new CustomEvent('threat-orb-arrived'));
      }
      if (listChanged) {
        setOrbIds(remaining.map((s) => s.id));
      }

      if (remaining.length > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    const handleOrbFx = (payload: ThreatOrbFxPayload) => {
      const count = payload.amount >= 20 ? 3 : payload.amount >= 10 ? 2 : 1;
      const now = performance.now();
      const target = getThreatTargetCenter();

      for (let i = 0; i < count; i++) {
        const angle = (Math.random() - 0.5) * Math.PI * 1.1;
        const spread = 18 + Math.random() * 20;
        const dropX = payload.startX + Math.sin(angle) * spread;
        const dropY = payload.startY + 10 + Math.random() * 14;
        const midX = (dropX + target.x) * 0.5 + (Math.random() - 0.5) * 90;
        const midY = Math.min(dropY, target.y) - 50 - Math.random() * 60;

        simsRef.current.push({
          id: nextIdRef.current++,
          startX: payload.startX,
          startY: payload.startY,
          dropX,
          dropY,
          ctrlX: midX,
          ctrlY: midY,
          createdAt: now + i * 55,
          dropDurationMs: 180,
          flyDurationMs: 460 + i * 40,
        });
      }

      const maxOrbs = PERFORMANCE_CONFIG.maxConcurrentThreatOrbs;
      if (simsRef.current.length > maxOrbs) {
        simsRef.current.splice(0, simsRef.current.length - maxOrbs);
      }

      setOrbIds(simsRef.current.map((s) => s.id));

      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    GameEvents.on('threat-orb-fx', handleOrbFx);
    return () => {
      GameEvents.off('threat-orb-fx', handleOrbFx);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      simsRef.current = [];
      nodeRefs.current.clear();
    };
  }, []);

  if (orbIds.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden" aria-hidden="true">
      {orbIds.map((id) => (
        <div
          key={id}
          ref={(el) => {
            if (el) nodeRefs.current.set(id, el);
            else nodeRefs.current.delete(id);
          }}
          className="absolute w-3.5 h-3.5 rounded-full"
          style={{
            left: 0,
            top: 0,
            opacity: 0,
            willChange: 'transform, opacity',
            background:
              'radial-gradient(circle at 35% 35%, #fef08a 0%, #facc15 55%, #ca8a04 100%)',
            boxShadow:
              '0 0 10px 3px rgba(250, 204, 21, 0.85), 0 0 20px 6px rgba(234, 179, 8, 0.45)',
          }}
        />
      ))}
    </div>
  );
};
