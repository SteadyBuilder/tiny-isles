import { TERRITORY_PX, TERRITORY_STEP } from './constants';

/**
 * World bounds for the expanded territory map (5x5 grid minus corners = 21 territories).
 * Single source of truth shared by physics bounds, camera bounds and depth sorting.
 */
export interface WorldBounds {
  /** Minimum X/Y coordinate (map is square) */
  min: number;
  /** Maximum X/Y coordinate */
  max: number;
  /** Side length (max - min) */
  width: number;
}

/** Number of territory steps from the center territory to the outermost ring */
export const WORLD_TERRITORY_RADIUS = 2;
/** Extra walkable/visible margin outside the outermost territories (px) */
export const WORLD_EDGE_PADDING = 200;

export function getWorldBounds(
  radius: number = WORLD_TERRITORY_RADIUS,
  padding: number = WORLD_EDGE_PADDING
): WorldBounds {
  const min = -radius * TERRITORY_STEP - padding;
  const max = radius * TERRITORY_STEP + TERRITORY_PX + padding;
  return { min, max, width: max - min };
}

export const WORLD_BOUNDS: WorldBounds = getWorldBounds();
