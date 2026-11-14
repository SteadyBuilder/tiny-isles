export const TILE_SIZE = 64;
export const TERRITORY_TILES = 10; // 10x10 tiles per territory (640x640 px)
export const ISLAND_TILES = TERRITORY_TILES;
export const TERRITORY_PX = TILE_SIZE * TERRITORY_TILES; // 640px
export const TERRITORY_GAP = TERRITORY_PX; // 640px gap between villages
export const ISLAND_GAP = TERRITORY_GAP;
export const TERRITORY_STEP = TERRITORY_PX + TERRITORY_GAP; // 1280px
export const ISLAND_STEP = TERRITORY_STEP;

export function getIslandOrigin(gridX: number, gridY: number): { x: number; y: number } {
  return {
    x: gridX * TERRITORY_STEP,
    y: gridY * TERRITORY_STEP,
  };
}

export function getTerritoryCorePos(gridX: number, gridY: number): { x: number; y: number } {
  const origin = getIslandOrigin(gridX, gridY);
  return {
    x: origin.x + 320,
    y: origin.y + 350,
  };
}
