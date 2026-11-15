export const TILE_SIZE = 64;
export const TERRITORY_TILES = 20; // 20x20 tiles per territory (1280x1280 px)
export const ISLAND_TILES = TERRITORY_TILES;
export const TERRITORY_PX = TILE_SIZE * TERRITORY_TILES; // 1280px
export const TERRITORY_GAP = TERRITORY_PX; // 1280px gap between villages
export const ISLAND_GAP = TERRITORY_GAP;
export const TERRITORY_STEP = TERRITORY_PX + TERRITORY_GAP; // 2560px
export const ISLAND_STEP = TERRITORY_STEP;

export const TERRITORY_CENTER_X = TERRITORY_PX / 2; // 640px
export const TERRITORY_CENTER_Y = TERRITORY_PX / 2; // 640px
export const TERRITORY_CORE_REL_X = TERRITORY_CENTER_X; // 640px
export const TERRITORY_CORE_REL_Y = Math.round(TERRITORY_PX * (350 / 640)); // 700px

export function getIslandOrigin(gridX: number, gridY: number): { x: number; y: number } {
  return {
    x: gridX * TERRITORY_STEP,
    y: gridY * TERRITORY_STEP,
  };
}

export function getTerritoryCorePos(gridX: number, gridY: number): { x: number; y: number } {
  const origin = getIslandOrigin(gridX, gridY);
  return {
    x: origin.x + TERRITORY_CORE_REL_X,
    y: origin.y + TERRITORY_CORE_REL_Y,
  };
}
