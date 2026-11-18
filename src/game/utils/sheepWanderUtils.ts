import { SHEEP_WANDER_CONFIG } from '../../data/sheepWanderConfig';

export interface SheepWanderState {
  homeX: number;
  homeY: number;
  mode: 'idle' | 'walk';
  targetX: number;
  targetY: number;
  nextDecisionAt: number;
}

export function createInitialSheepWanderState(
  x: number,
  y: number,
  now: number,
  seedOffset = 0
): SheepWanderState {
  const { idleMinMs, idleMaxMs } = SHEEP_WANDER_CONFIG;
  const jitter = ((Math.abs(Math.sin(seedOffset * 12.9898)) * 43758.5453) % 1);
  const waitMs = idleMinMs + jitter * (idleMaxMs - idleMinMs);
  return {
    homeX: x,
    homeY: y,
    mode: 'idle',
    targetX: x,
    targetY: y,
    nextDecisionAt: now + waitMs,
  };
}

export function pickSheepWanderTarget(
  homeX: number,
  homeY: number,
  wanderRadiusPx: number = SHEEP_WANDER_CONFIG.wanderRadiusPx
): { x: number; y: number } {
  const angle = Math.random() * Math.PI * 2;
  const radius = (0.35 + Math.random() * 0.65) * wanderRadiusPx;
  return {
    x: Math.round(homeX + Math.cos(angle) * radius),
    y: Math.round(homeY + Math.sin(angle) * radius),
  };
}

export function stepSheepWander(
  currentX: number,
  currentY: number,
  state: SheepWanderState,
  now: number,
  dtSec: number,
  isWalkable?: (x: number, y: number) => boolean
): { x: number; y: number; dx: number; moved: boolean } {
  if (now >= state.nextDecisionAt) {
    if (state.mode === 'idle') {
      const target = pickSheepWanderTarget(state.homeX, state.homeY);
      if (!isWalkable || isWalkable(target.x, target.y)) {
        state.mode = 'walk';
        state.targetX = target.x;
        state.targetY = target.y;
        const { walkMinMs, walkMaxMs } = SHEEP_WANDER_CONFIG;
        state.nextDecisionAt = now + walkMinMs + Math.random() * (walkMaxMs - walkMinMs);
      } else {
        state.nextDecisionAt = now + 800;
      }
    } else {
      state.mode = 'idle';
      const { idleMinMs, idleMaxMs } = SHEEP_WANDER_CONFIG;
      state.nextDecisionAt = now + idleMinMs + Math.random() * (idleMaxMs - idleMinMs);
    }
  }

  if (state.mode !== 'walk') {
    return { x: currentX, y: currentY, dx: 0, moved: false };
  }

  const dx = state.targetX - currentX;
  const dy = state.targetY - currentY;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) {
    state.mode = 'idle';
    const { idleMinMs, idleMaxMs } = SHEEP_WANDER_CONFIG;
    state.nextDecisionAt = now + idleMinMs + Math.random() * (idleMaxMs - idleMinMs);
    return { x: currentX, y: currentY, dx: 0, moved: false };
  }

  const stepDist = Math.min(dist, SHEEP_WANDER_CONFIG.moveSpeedPx * dtSec);
  const nextX = currentX + (dx / dist) * stepDist;
  const nextY = currentY + (dy / dist) * stepDist;

  if (isWalkable && !isWalkable(nextX, nextY)) {
    state.mode = 'idle';
    state.nextDecisionAt = now + 1000;
    return { x: currentX, y: currentY, dx: 0, moved: false };
  }

  return { x: nextX, y: nextY, dx, moved: true };
}
