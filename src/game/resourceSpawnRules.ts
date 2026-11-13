import { Entity } from '../types/game';

/** Side length (px) of each territory's buildable/living village square (10 tiles * 64px) */
export const TERRITORY_VILLAGE_PX = 640;

/** Center-to-center step (px) between adjacent territories (640px village + 640px outdoor gap) */
export const TERRITORY_GRID_STEP = 1280;

/** Minimum clearance (px) outside the 0..TERRITORY_PX village border for resource spawns */
export const VILLAGE_OUTDOOR_MARGIN = 76;

/** Half-width clearance (px) around the N-S (x=320) and W-E (y=350) gate crossroads */
const ROAD_CLEARANCE = 56;
const ROAD_CENTER_X = 320;
const ROAD_CENTER_Y = 350;

/**
 * Deterministic outdoor plains anchor slots around a 640x640 territory.
 * All coordinates lie strictly outside `[0, TERRITORY_PX]` (with >= 76px margin from walls)
 * and inside `[-230, TERRITORY_PX + 230]` so adjacent territories never overlap.
 * None of the slots sit on the N-S (`relX ≈ 320`) or W-E (`relY ≈ 350`) gate roads.
 */
export const OUTDOOR_RESOURCE_SLOTS: ReadonlyArray<{ readonly relX: number; readonly relY: number }> = [
  // North outdoor plains (relY in [-210, -85])
  { relX: 110, relY: -110 },
  { relX: 220, relY: -155 },
  { relX: 430, relY: -155 },
  { relX: 540, relY: -110 },
  // South outdoor plains (relY in [725, 850])
  { relX: 110, relY: 745 },
  { relX: 225, relY: 790 },
  { relX: 425, relY: 790 },
  { relX: 540, relY: 745 },
  // West outdoor plains (relX in [-210, -85])
  { relX: -120, relY: 120 },
  { relX: -175, relY: 235 },
  { relX: -175, relY: 465 },
  { relX: -120, relY: 560 },
  // East outdoor plains (relX in [725, 850])
  { relX: 750, relY: 120 },
  { relX: 805, relY: 235 },
  { relX: 805, relY: 465 },
  { relX: 750, relY: 560 },
];

/**
 * Returns true if `(relX, relY)` (relative to a territory origin) falls inside
 * the village build/living square `[0, TERRITORY_PX]` plus `margin`. Pure.
 */
export function isInsideVillageSquare(
  relX: number,
  relY: number,
  margin: number = VILLAGE_OUTDOOR_MARGIN
): boolean {
  return (
    relX > -margin &&
    relX < TERRITORY_VILLAGE_PX + margin &&
    relY > -margin &&
    relY < TERRITORY_VILLAGE_PX + margin
  );
}

/**
 * Returns true if world coordinate `(worldX, worldY)` is inside ANY territory's
 * `[origin, origin + TERRITORY_PX]` village square (with optional margin). Pure.
 */
export function isWorldPosInsideAnyVillage(
  worldX: number,
  worldY: number,
  margin: number = VILLAGE_OUTDOOR_MARGIN
): boolean {
  const nearestGridX = Math.round((worldX - TERRITORY_VILLAGE_PX / 2) / TERRITORY_GRID_STEP);
  const nearestGridY = Math.round((worldY - TERRITORY_VILLAGE_PX / 2) / TERRITORY_GRID_STEP);
  const relX = worldX - nearestGridX * TERRITORY_GRID_STEP;
  const relY = worldY - nearestGridY * TERRITORY_GRID_STEP;
  return isInsideVillageSquare(relX, relY, margin);
}

/**
 * Maps any territory-relative `(relX, relY)` into a guaranteed outdoor plains coordinate
 * outside `[0, TERRITORY_PX]` and off the gate crossroads. Pure.
 */
export function resolveOutdoorRelPos(
  relX: number,
  relY: number,
  slotHint: number = 0
): { relX: number; relY: number } {
  if (!isInsideVillageSquare(relX, relY, VILLAGE_OUTDOOR_MARGIN)) {
    let outX = relX;
    let outY = relY;
    if (Math.abs(outX - ROAD_CENTER_X) < ROAD_CLEARANCE) {
      outX = outX < ROAD_CENTER_X ? ROAD_CENTER_X - ROAD_CLEARANCE : ROAD_CENTER_X + ROAD_CLEARANCE;
    }
    if (Math.abs(outY - ROAD_CENTER_Y) < ROAD_CLEARANCE) {
      outY = outY < ROAD_CENTER_Y ? ROAD_CENTER_Y - ROAD_CLEARANCE : ROAD_CENTER_Y + ROAD_CLEARANCE;
    }
    return { relX: outX, relY: outY };
  }

  const slot = OUTDOOR_RESOURCE_SLOTS[Math.abs(slotHint) % OUTDOOR_RESOURCE_SLOTS.length];
  return { relX: slot.relX, relY: slot.relY };
}

/**
 * Ensures an entity's world `(x, y)` lies in the outdoor plains outside every village square.
 * Used on both initial spawn and post-harvest respawn. Pure.
 */
export function ensureOutdoorEntityCoords(
  entity: Entity,
  origin: { x: number; y: number },
  slotHint: number = 0
): { x: number; y: number } {
  const relX = entity.x - origin.x;
  const relY = entity.y - origin.y;
  const resolved = resolveOutdoorRelPos(relX, relY, slotHint);
  return {
    x: origin.x + resolved.relX,
    y: origin.y + resolved.relY,
  };
}
