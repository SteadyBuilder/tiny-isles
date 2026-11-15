import { Entity } from '../types/game';
import {
  TERRITORY_CORE_REL_X,
  TERRITORY_CORE_REL_Y,
  TERRITORY_PX,
  TERRITORY_STEP,
} from './world/territoryGrid';

/** Side length (px) of each territory's buildable/living village square */
export const TERRITORY_VILLAGE_PX = TERRITORY_PX;

/** Center-to-center step (px) between adjacent territories */
export const TERRITORY_GRID_STEP = TERRITORY_STEP;

/** Minimum clearance (px) outside the 0..TERRITORY_PX village border for resource spawns */
export const VILLAGE_OUTDOOR_MARGIN = 76;

/** Half-width clearance (px) around the N-S and W-E gate crossroads */
const ROAD_CLEARANCE = 56;
const ROAD_CENTER_X = TERRITORY_CORE_REL_X;
const ROAD_CENTER_Y = TERRITORY_CORE_REL_Y;

/**
 * Deterministic outdoor plains anchor slots around a 1280x1280 territory.
 * All coordinates lie strictly outside `[0, TERRITORY_PX]` (with >= 76px margin from walls)
 * and inside `[-460, TERRITORY_PX + 460]` so adjacent territories never overlap.
 * None of the slots sit on the N-S (`relX ≈ 640`) or W-E (`relY ≈ 700`) gate roads.
 */
export const OUTDOOR_RESOURCE_SLOTS: ReadonlyArray<{ readonly relX: number; readonly relY: number }> = [
  // North outdoor plains (relY in [-240, -110])
  { relX: 220, relY: -120 },
  { relX: 440, relY: -200 },
  { relX: 840, relY: -200 },
  { relX: 1060, relY: -120 },
  // South outdoor plains (relY in [1390, 1520])
  { relX: 220, relY: TERRITORY_PX + 120 },
  { relX: 440, relY: TERRITORY_PX + 200 },
  { relX: 840, relY: TERRITORY_PX + 200 },
  { relX: 1060, relY: TERRITORY_PX + 120 },
  // West outdoor plains (relX in [-240, -110])
  { relX: -130, relY: 240 },
  { relX: -210, relY: 480 },
  { relX: -210, relY: 920 },
  { relX: -130, relY: 1120 },
  // East outdoor plains (relX in [1390, 1520])
  { relX: TERRITORY_PX + 130, relY: 240 },
  { relX: TERRITORY_PX + 210, relY: 480 },
  { relX: TERRITORY_PX + 210, relY: 920 },
  { relX: TERRITORY_PX + 130, relY: 1120 },
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
