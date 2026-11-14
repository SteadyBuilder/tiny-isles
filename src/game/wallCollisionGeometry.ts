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

/**
 * Computes a single solid collision box for monsters (`wood_wall` or `stone_wall`).
 * Unlike player colliders, the central gate is treated as closed for monsters,
 * forcing them to break through the wall/gate before entering.
 */
export function getMonsterWallCollisionBox(cb: ConstructedBuilding): CollisionBox | null {
  if (cb.category !== 'wall') {
    return null;
  }

  const thickness = WALL_COLLIDER_THICKNESS;
  const halfThick = thickness / 2;

  if (cb.slotIndex === 0 || cb.slotIndex === 1) {
    return {
      x: cb.x - 300,
      y: cb.y + 4 - halfThick,
      w: 600,
      h: thickness,
    };
  }

  if (cb.slotIndex === 2 || cb.slotIndex === 3) {
    return {
      x: cb.x - halfThick,
      y: cb.y - 298,
      w: thickness,
      h: 536,
    };
  }

  const innerW = 88;
  const innerH = 40;
  return {
    x: cb.x - innerW / 2,
    y: cb.y + 8 - innerH / 2,
    w: innerW,
    h: innerH,
  };
}

/**
 * Computes the foot-level static physics collision box for constructed non-wall buildings
 * (towers, basic buildings, special buildings) so the player cannot walk through them.
 */
export function getConstructedBuildingFootprintBox(cb: ConstructedBuilding): CollisionBox {
  if (cb.category === 'tower') {
    const w = 64;
    const h = 34;
    return {
      x: cb.x - w / 2,
      y: cb.y - 8,
      w,
      h,
    };
  }

  const w = 76;
  const h = 38;
  return {
    x: cb.x - w / 2,
    y: cb.y - 10,
    w,
    h,
  };
}

export interface MonsterWallClampResult {
  x: number;
  y: number;
  blockedBy: ConstructedBuilding | null;
}

/**
 * Prevents a moving monster from tunneling through any alive wall across all territories.
 * Expands each wall box by `radius` and pushes the monster back outside on overlap/crossing.
 */
export function resolveMonsterWallClamping(
  prevX: number,
  prevY: number,
  nextX: number,
  nextY: number,
  radius: number,
  walls: ConstructedBuilding[]
): MonsterWallClampResult {
  let x = nextX;
  let y = nextY;
  let blockedBy: ConstructedBuilding | null = null;

  for (const wall of walls) {
    if (wall.hp <= 0 || wall.category !== 'wall') continue;
    const box = getMonsterWallCollisionBox(wall);
    if (!box) continue;

    const minX = box.x - radius;
    const maxX = box.x + box.w + radius;
    const minY = box.y - radius;
    const maxY = box.y + box.h + radius;

    // 1) Check direct overlap at (x, y)
    const insideNow = x > minX && x < maxX && y > minY && y < maxY;

    // 2) Check segment crossing for high speed / large dt tunneling
    const crossesHoriz =
      (prevY <= minY && y >= maxY) || (prevY >= maxY && y <= minY);
    const crossesVert =
      (prevX <= minX && x >= maxX) || (prevX >= maxX && x <= minX);
    const withinX = Math.max(prevX, x) > minX && Math.min(prevX, x) < maxX;
    const withinY = Math.max(prevY, y) > minY && Math.min(prevY, y) < maxY;
    const tunneled = (crossesHoriz && withinX) || (crossesVert && withinY);

    if (!insideNow && !tunneled) continue;

    blockedBy = wall;

    // Push out toward the side prevX/prevY came from, or nearest edge
    const dLeft = Math.abs(x - minX);
    const dRight = Math.abs(maxX - x);
    const dTop = Math.abs(y - minY);
    const dBottom = Math.abs(maxY - y);

    if (prevX <= minX) {
      x = minX;
    } else if (prevX >= maxX) {
      x = maxX;
    } else if (prevY <= minY) {
      y = minY;
    } else if (prevY >= maxY) {
      y = maxY;
    } else {
      const minEdge = Math.min(dLeft, dRight, dTop, dBottom);
      if (minEdge === dLeft) x = minX;
      else if (minEdge === dRight) x = maxX;
      else if (minEdge === dTop) y = minY;
      else y = maxY;
    }
  }

  return { x, y, blockedBy };
}
