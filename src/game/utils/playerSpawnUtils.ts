import { PLAYER_COMBAT_CONFIG } from '../../data/worldRules';
import { WaterRect } from '../world/MapTerrainGenerator';
import { WORLD_BOUNDS, WorldBounds } from '../worldBounds';

export interface SpawnPositionCandidate {
  x: number;
  y: number;
  direction?: 'left' | 'right';
}

export interface ResolvedSpawnPosition {
  x: number;
  y: number;
  direction: 'left' | 'right';
  usedFallback: boolean;
}

const DEFAULT_EDGE_MARGIN_PX = 24;
const DEFAULT_WATER_PADDING_PX = 8;

export function isPositionWithinWorldBounds(
  x: number,
  y: number,
  bounds: WorldBounds = WORLD_BOUNDS,
  margin: number = DEFAULT_EDGE_MARGIN_PX
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return (
    x >= bounds.min + margin &&
    x <= bounds.max - margin &&
    y >= bounds.min + margin &&
    y <= bounds.max - margin
  );
}

export function isPositionInWater(
  x: number,
  y: number,
  waterBodies: ReadonlyArray<WaterRect>,
  padding: number = DEFAULT_WATER_PADDING_PX
): boolean {
  for (const rect of waterBodies) {
    if (
      x >= rect.x - padding &&
      x <= rect.x + rect.w + padding &&
      y >= rect.y - padding &&
      y <= rect.y + rect.h + padding
    ) {
      return true;
    }
  }
  return false;
}

/**
 * 저장된 플레이어 위치가 맵 경계 내이면서 물 영역 위가 아닌 안전한 좌표인지 검증하고,
 * 유효하지 않으면 기본 시작 지점(mainVillageSpawn)으로 폴백합니다.
 */
export function resolveSafeSpawnPosition(
  candidate: SpawnPositionCandidate | null | undefined,
  waterBodies: ReadonlyArray<WaterRect>,
  bounds: WorldBounds = WORLD_BOUNDS
): ResolvedSpawnPosition {
  const fallback = PLAYER_COMBAT_CONFIG.mainVillageSpawn;

  if (!candidate || !Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) {
    return {
      x: fallback.x,
      y: fallback.y,
      direction: 'right',
      usedFallback: true,
    };
  }

  const x = Math.round(candidate.x);
  const y = Math.round(candidate.y);
  const direction: 'left' | 'right' = candidate.direction === 'left' ? 'left' : 'right';

  if (!isPositionWithinWorldBounds(x, y, bounds) || isPositionInWater(x, y, waterBodies)) {
    return {
      x: fallback.x,
      y: fallback.y,
      direction: 'right',
      usedFallback: true,
    };
  }

  return {
    x,
    y,
    direction,
    usedFallback: false,
  };
}
