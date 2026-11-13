import { WORLD_BOUNDS } from './worldBounds';

/**
 * Render depth layers.
 *
 * Layer order (low → high):
 *   static ground layers (negative) < Y-sorted world objects (positive) < FX < UI overlays
 *
 * Y-sorted objects use `ySortDepth()`, which shifts world Y by a positive offset so that
 * objects in negative-Y regions (north of the main village) never drop below ground layers.
 */

/** Safety margin below the lowest Y-sorted depth (keeps it well above ground layers) */
const Y_SORT_MARGIN = 1000;
/** Largest bias added to a Y-sorted object (e.g. monastery +290) plus headroom */
const Y_SORT_MAX_BIAS = 500;

/** Positive offset applied to every Y-sorted depth. Lowest world Y maps to Y_SORT_MARGIN. */
export const Y_SORT_OFFSET: number = -WORLD_BOUNDS.min + Y_SORT_MARGIN;

/** Highest depth any Y-sorted object can reach; overlay layers start above this. */
export const Y_SORT_MAX_DEPTH: number = Y_SORT_OFFSET + WORLD_BOUNDS.max + Y_SORT_MAX_BIAS;

const OVERLAY_BASE: number = Math.ceil(Y_SORT_MAX_DEPTH / 1000) * 1000 + 1000;

export const DEPTH = {
  BACKGROUND: -100,
  TERRAIN: -50,
  INVASION_OVERLAY: -40,
  ALTAR_CARDS: -20,
  CLOUDS: OVERLAY_BASE,
  FLOATING_TEXT: OVERLAY_BASE + 1000,
  PROJECTILE: OVERLAY_BASE + 1200,
  SPARK: OVERLAY_BASE + 1220,
  SLASH: OVERLAY_BASE + 1250,
  EXPLOSION: OVERLAY_BASE + 1500,
  TOUCH_INDICATOR: OVERLAY_BASE + 8000,
} as const;

/** Y-sorted depth for a world object at `y`, with optional per-object bias. Pure. */
export function ySortDepth(y: number, bias: number = 0): number {
  return Y_SORT_OFFSET + y + bias;
}
