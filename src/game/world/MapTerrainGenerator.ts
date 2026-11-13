import {
  BIOME_CONFIGS,
  BiomeId,
  GOLD_MINE_BIOME_CONFIG,
  LandBiomeId,
  TERRAIN_GENERATION_CONFIG,
} from '../../data/biomes';
import { INITIAL_ISLANDS, TERRITORY_PX, TERRITORY_STEP } from '../constants';
import { WORLD_BOUNDS, WorldBounds } from '../worldBounds';
import { fbm2D, hash2D } from './TerrainNoise';
import { Island } from '../../types/game';

export type DecorationType = 'bush1' | 'bush2' | 'pebble' | 'water_rock';

export interface TerrainCell {
  gx: number;
  gy: number;
  worldX: number;
  worldY: number;
  biome: BiomeId;
  isVillagePlot: boolean;
  isRoad: boolean;
  isBridge: boolean;
  decoration: DecorationType | null;
}

export interface WaterRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BridgeSegment {
  gx: number;
  gy: number;
  x: number;
  y: number;
  w: number;
  h: number;
  orientation: 'h' | 'v';
}

export interface GoldMineZoneMeta {
  unlockTerritoryId: number;
  centerX: number;
  centerY: number;
  radiusPx: number;
}

export interface WorldTerrainMap {
  tileSize: number;
  minGx: number;
  maxGx: number;
  minGy: number;
  maxGy: number;
  cols: number;
  rows: number;
  cells: TerrainCell[];
  waterBodies: WaterRect[];
  bridges: BridgeSegment[];
  goldMineZone: GoldMineZoneMeta;
}

export type TerritoryGridRef = Pick<Island, 'gridX' | 'gridY'>;

function isPointInTerritoryBox(
  wx: number,
  wy: number,
  territories: ReadonlyArray<TerritoryGridRef>,
  margin: number
): boolean {
  for (const t of territories) {
    const ox = t.gridX * TERRITORY_STEP;
    const oy = t.gridY * TERRITORY_STEP;
    if (
      wx >= ox - margin &&
      wx <= ox + TERRITORY_PX + margin &&
      wy >= oy - margin &&
      wy <= oy + TERRITORY_PX + margin
    ) {
      return true;
    }
  }
  return false;
}

function getRoadOrientationAt(
  wx: number,
  wy: number,
  territories: ReadonlyArray<TerritoryGridRef>,
  halfWidth: number
): 'h' | 'v' | null {
  for (const t of territories) {
    const ox = t.gridX * TERRITORY_STEP;
    const oy = t.gridY * TERRITORY_STEP;
    const roadY = oy + 350;
    const roadX = ox + 320;

    // Horizontal road segment connecting through territory gap
    if (
      Math.abs(wy - roadY) <= halfWidth &&
      wx >= ox - TERRITORY_STEP / 2 &&
      wx <= ox + TERRITORY_PX + TERRITORY_STEP / 2
    ) {
      return 'h';
    }
    // Vertical road segment connecting through territory gap
    if (
      Math.abs(wx - roadX) <= halfWidth &&
      wy >= oy - TERRITORY_STEP / 2 &&
      wy <= oy + TERRITORY_PX + TERRITORY_STEP / 2
    ) {
      return 'v';
    }
  }
  return null;
}

function isGoldMineBiomeCell(
  cx: number,
  cy: number,
  gx: number,
  gy: number,
  seed: number
): boolean {
  const gm = GOLD_MINE_BIOME_CONFIG;
  const dist = Math.hypot(cx - gm.centerX, cy - gm.centerY);
  const edgeNoise = fbm2D(gx * 0.22, gy * 0.22, seed + 511, 2);
  const organicRadius = gm.radiusPx * (0.84 + 0.32 * edgeNoise);
  return dist <= organicRadius;
}

function resolveLandBiome(elevation: number, moisture: number): LandBiomeId {
  if (elevation > 0.6) return 'highland';
  if (moisture > 0.62) return elevation < 0.44 ? 'mystic' : 'forest';
  if (moisture > 0.48) return 'forest';
  return 'plains';
}

/**
 * Generates a deterministic Necesse-style overworld terrain grid across the entire world bounds.
 * Village plots stay flat and clear for building construction; the surrounding wilderness features
 * lakes/streams, automatic road bridges, multi-biome patches, and the clustered gold mine biome. Pure function.
 */
export function generateWorldTerrain(
  bounds: WorldBounds = WORLD_BOUNDS,
  territories: ReadonlyArray<TerritoryGridRef> = INITIAL_ISLANDS
): WorldTerrainMap {
  const cfg = TERRAIN_GENERATION_CONFIG;
  const gm = GOLD_MINE_BIOME_CONFIG;
  const tileSize = cfg.tileSize;
  const minGx = Math.floor(bounds.min / tileSize);
  const maxGx = Math.ceil(bounds.max / tileSize);
  const minGy = Math.floor(bounds.min / tileSize);
  const maxGy = Math.ceil(bounds.max / tileSize);
  const cols = maxGx - minGx;
  const rows = maxGy - minGy;

  const cells: TerrainCell[] = new Array(cols * rows);
  const rawWater = new Uint8Array(cols * rows);
  const roadOrientations: Array<'h' | 'v' | null> = new Array(cols * rows);

  // Pass 1: Sample noise for biomes, roads, village clearings, gold mine biome, and raw lakes
  for (let ry = 0; ry < rows; ry++) {
    const gy = minGy + ry;
    const worldY = gy * tileSize;
    const cy = worldY + tileSize / 2;

    for (let rx = 0; rx < cols; rx++) {
      const gx = minGx + rx;
      const worldX = gx * tileSize;
      const cx = worldX + tileSize / 2;
      const idx = ry * cols + rx;

      const isVillagePlot = isPointInTerritoryBox(cx, cy, territories, 0);
      const isVillageDryZone = isPointInTerritoryBox(cx, cy, territories, cfg.villageDryBufferPx);
      const roadDir = getRoadOrientationAt(cx, cy, territories, cfg.roadHalfWidthPx);
      const isRoad = roadDir !== null;
      roadOrientations[idx] = roadDir;

      const inGoldMine =
        !isVillageDryZone &&
        !isRoad &&
        isGoldMineBiomeCell(cx, cy, gx, gy, cfg.seed);

      const elev = fbm2D(gx * cfg.elevationScale, gy * cfg.elevationScale, cfg.seed + 101, 3);
      const moist = fbm2D(gx * cfg.moistureScale, gy * cfg.moistureScale, cfg.seed + 307, 3);
      const lakeVal = fbm2D(gx * cfg.waterScale, gy * cfg.waterScale, cfg.seed + 709, 3);

      const wantsWater = !isVillageDryZone && !inGoldMine && lakeVal > cfg.waterThreshold;
      rawWater[idx] = wantsWater ? 1 : 0;

      const landBiome: LandBiomeId = isVillagePlot
        ? 'plains'
        : inGoldMine
        ? 'gold_mine'
        : resolveLandBiome(elev, moist);

      cells[idx] = {
        gx,
        gy,
        worldX,
        worldY,
        biome: landBiome,
        isVillagePlot,
        isRoad,
        isBridge: false,
        decoration: null,
      };
    }
  }

  // Pass 2: Smooth isolated 1-tile water puddles & determine final water vs bridge cells
  const isWaterFinal = new Uint8Array(cols * rows);
  for (let ry = 0; ry < rows; ry++) {
    for (let rx = 0; rx < cols; rx++) {
      const idx = ry * cols + rx;
      if (rawWater[idx] !== 1) continue;

      let waterNeighbors = 0;
      if (rx > 0 && rawWater[idx - 1] === 1) waterNeighbors++;
      if (rx < cols - 1 && rawWater[idx + 1] === 1) waterNeighbors++;
      if (ry > 0 && rawWater[idx - cols] === 1) waterNeighbors++;
      if (ry < rows - 1 && rawWater[idx + cols] === 1) waterNeighbors++;

      if (waterNeighbors >= 2) {
        isWaterFinal[idx] = 1;
      }
    }
  }

  const bridges: BridgeSegment[] = [];
  for (let ry = 0; ry < rows; ry++) {
    for (let rx = 0; rx < cols; rx++) {
      const idx = ry * cols + rx;
      const cell = cells[idx];

      if (isWaterFinal[idx] === 1) {
        if (cell.isRoad) {
          // Road crossing water automatically becomes a walkable wooden bridge!
          cell.isBridge = true;
          bridges.push({
            gx: cell.gx,
            gy: cell.gy,
            x: cell.worldX,
            y: cell.worldY,
            w: tileSize,
            h: tileSize,
            orientation: roadOrientations[idx] || 'h',
          });
        } else {
          cell.biome = 'water';
        }
      }

      // Deterministic ground decorations (never on roads, bridges, or inside village plots)
      if (!cell.isVillagePlot && !cell.isRoad && !cell.isBridge) {
        const roll = hash2D(cell.gx, cell.gy, cfg.seed + 991);
        const decoChance = BIOME_CONFIGS[cell.biome].decorationChance;
        if (roll < decoChance) {
          if (cell.biome === 'water') {
            cell.decoration = 'water_rock';
          } else if (
            (cell.biome === 'highland' || cell.biome === 'gold_mine') &&
            roll < decoChance * 0.65
          ) {
            cell.decoration = 'pebble';
          } else if (cell.biome !== 'gold_mine') {
            cell.decoration = roll < decoChance * 0.5 ? 'bush1' : 'bush2';
          }
        }
      }
    }
  }

  // Pass 3: Merge horizontal runs of water cells into efficient physics collision rects
  const waterBodies: WaterRect[] = [];
  for (let ry = 0; ry < rows; ry++) {
    let runStart = -1;
    for (let rx = 0; rx <= cols; rx++) {
      const isWater = rx < cols && cells[ry * cols + rx].biome === 'water';
      if (isWater && runStart === -1) {
        runStart = rx;
      } else if (!isWater && runStart !== -1) {
        const startCell = cells[ry * cols + runStart];
        waterBodies.push({
          x: startCell.worldX,
          y: startCell.worldY,
          w: (rx - runStart) * tileSize,
          h: tileSize,
        });
        runStart = -1;
      }
    }
  }

  return {
    tileSize,
    minGx,
    maxGx,
    minGy,
    maxGy,
    cols,
    rows,
    cells,
    waterBodies,
    bridges,
    goldMineZone: {
      unlockTerritoryId: gm.unlockTerritoryId,
      centerX: gm.centerX,
      centerY: gm.centerY,
      radiusPx: gm.radiusPx,
    },
  };
}

/** O(1) lookup of the terrain cell at a world `(wx, wy)` position. Pure. */
export function getTerrainCellAtWorld(
  terrain: WorldTerrainMap,
  wx: number,
  wy: number
): TerrainCell | null {
  const gx = Math.floor(wx / terrain.tileSize);
  const gy = Math.floor(wy / terrain.tileSize);
  const rx = gx - terrain.minGx;
  const ry = gy - terrain.minGy;
  if (rx < 0 || rx >= terrain.cols || ry < 0 || ry >= terrain.rows) {
    return null;
  }
  return terrain.cells[ry * terrain.cols + rx];
}

/** Returns true if world coordinate `(wx, wy)` is impassable water. Pure. */
export function isWaterAtWorld(terrain: WorldTerrainMap, wx: number, wy: number): boolean {
  const cell = getTerrainCellAtWorld(terrain, wx, wy);
  return cell ? cell.biome === 'water' : false;
}
