import { ConstructedBuilding } from '../types/game';
import { CollisionBox } from './constants';

/**
 * Half-size (px) of the passable gate opening at the center of each perimeter wall.
 * Player physics body is 36x24, so an 88px opening (-44..+44) allows smooth movement
 * through the gate along the crossroads while blocking all wall wings and corner posts.
 */
export const WALL_GATE_HALF_OPENING = 44;

/** Thickness (px) of the impassable wall collider strips */
export const WALL_COLLIDER_THICKNESS = 34;

/**
 * Computes the static physics collision boxes (`CollisionBox[]`, top-left `x, y, w, h`)
 * for a constructed wall (`wood_wall` or `stone_wall`).
 *
 * - Perimeter horizontal walls (`slotIndex` 0 North, 1 South):
 *   Splits into Left Wing `[-300, -GATE]` and Right Wing `[+GATE, +300]`, leaving
 *   the central gate `[-GATE, +GATE]` open for passage.
 * - Perimeter vertical walls (`slotIndex` 2 East, 3 West):
 *   Splits into Top Wing `[-298, -GATE]` and Bottom Wing `[+GATE, +238]`, leaving
 *   the central gate `[-GATE, +GATE]` open for passage.
 * - Inner-slot standalone barricade (`slotIndex >= 4`):
 *   Single solid barricade box (no gate).
 */
export function getWallCollisionBoxes(cb: ConstructedBuilding): CollisionBox[] {
  if (cb.category !== 'wall') {
    return [];
  }

  const gate = WALL_GATE_HALF_OPENING;
  const thickness = WALL_COLLIDER_THICKNESS;
  const halfThick = thickness / 2;

  // North (0) or South (1) horizontal perimeter wall
  if (cb.slotIndex === 0 || cb.slotIndex === 1) {
    const leftMinX = cb.x - 300;
    const leftMaxX = cb.x - gate;
    const rightMinX = cb.x + gate;
    const rightMaxX = cb.x + 300;
    const topY = cb.y + 4 - halfThick;

    return [
      {
        x: leftMinX,
        y: topY,
        w: leftMaxX - leftMinX,
        h: thickness,
      },
      {
        x: rightMinX,
        y: topY,
        w: rightMaxX - rightMinX,
        h: thickness,
      },
    ];
  }

  // East (2) or West (3) vertical perimeter wall
  if (cb.slotIndex === 2 || cb.slotIndex === 3) {
    const topMinY = cb.y - 298;
    const topMaxY = cb.y - gate;
    const bottomMinY = cb.y + gate;
    const bottomMaxY = cb.y + 238;
    const leftX = cb.x - halfThick;

    return [
      {
        x: leftX,
        y: topMinY,
        w: thickness,
        h: topMaxY - topMinY,
      },
      {
        x: leftX,
        y: bottomMinY,
        w: thickness,
        h: bottomMaxY - bottomMinY,
      },
    ];
  }

  // Standalone inner barricade
  const innerW = 88;
  const innerH = 40;
  return [
    {
      x: cb.x - innerW / 2,
      y: cb.y + 8 - innerH / 2,
      w: innerW,
      h: innerH,
    },
  ];
}

/**
 * Shortest Euclidean distance from a point `(px, py)` to an axis-aligned `CollisionBox`.
 * Returns 0 if the point is inside the box. Pure.
 */
export function distanceToCollisionBox(px: number, py: number, box: CollisionBox): number {
  const clampedX = Math.max(box.x, Math.min(px, box.x + box.w));
  const clampedY = Math.max(box.y, Math.min(py, box.y + box.h));
  return Math.hypot(px - clampedX, py - clampedY);
}

/**
 * Nearest point on (or inside) an axis-aligned `CollisionBox` from `(px, py)` and distance.
 */
export function nearestPointOnCollisionBox(
  px: number,
  py: number,
  box: CollisionBox
): { x: number; y: number; dist: number } {
  const x = Math.max(box.x, Math.min(px, box.x + box.w));
  const y = Math.max(box.y, Math.min(py, box.y + box.h));
  return { x, y, dist: Math.hypot(px - x, py - y) };
}
