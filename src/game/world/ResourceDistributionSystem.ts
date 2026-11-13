import { BIOME_CONFIGS, RESOURCE_DISTRIBUTION_CONFIG, TERRAIN_GENERATION_CONFIG } from '../../data/biomes';
import { ConstructedBuilding, Entity, EntityType } from '../../types/game';
import { INITIAL_ISLANDS, TERRITORY_PX, TERRITORY_STEP } from '../constants';
import { WORLD_BOUNDS, WorldBounds } from '../worldBounds';
import {
  getTerrainCellAtWorld,
  TerritoryGridRef,
  WorldTerrainMap,
} from './MapTerrainGenerator';
import { hash2D } from './TerrainNoise';

interface SectorInfo {
  key: string;
  sx: number;
  sy: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  capacity: number;
  dominantBiomeWeights: Record<EntityType, number>;
}

const ENTITY_TYPES: readonly EntityType[] = ['tree', 'rock', 'gold_rock', 'sheep'];

function isInsideAnyTerritory(
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

function isSpotClearOfTerrainObstacles(
  wx: number,
  wy: number,
  terrain: WorldTerrainMap,
  territories: ReadonlyArray<TerritoryGridRef>,
  bounds: WorldBounds
): boolean {
  const cfg = RESOURCE_DISTRIBUTION_CONFIG;
  const edgePad = 76;
  if (
    wx < bounds.min + edgePad ||
    wx > bounds.max - edgePad ||
    wy < bounds.min + edgePad ||
    wy > bounds.max - edgePad
  ) {
    return false;
  }

  // Keep village squares and perimeter wall margins strictly clear for buildings
  if (isInsideAnyTerritory(wx, wy, territories, cfg.villageExclusionMarginPx)) {
    return false;
  }

  // Check entity center and footprint corners so sprites never overlap water/roads
  const probeOffsets = [
    [0, 0],
    [28, 16],
    [-16, -16],
    [32, -12],
    [-16, 28],
  ];
  for (const [dx, dy] of probeOffsets) {
    const cell = getTerrainCellAtWorld(terrain, wx + dx, wy + dy);
    if (!cell || cell.biome === 'water' || cell.isRoad || cell.isBridge || cell.isVillagePlot) {
      return false;
    }
  }

  return true;
}

function isSpotFreeOfCollisions(
  wx: number,
  wy: number,
  existingEntities: Iterable<{ x: number; y: number }>,
  buildings: ReadonlyArray<Pick<ConstructedBuilding, 'x' | 'y'>>,
  minSpacing: number
): boolean {
  for (const ent of existingEntities) {
    if (Math.hypot(wx - ent.x, wy - ent.y) < minSpacing) {
      return false;
    }
  }
  for (const b of buildings) {
    if (Math.hypot(wx - b.x, wy - b.y) < 96) {
      return false;
    }
  }
  return true;
}

function pickEntityTypeByBiome(
  weights: Record<EntityType, number>,
  roll: number
): EntityType {
  let total = 0;
  for (const t of ENTITY_TYPES) total += weights[t];
  if (total <= 0) return 'tree';

  let acc = 0;
  const target = roll * total;
  for (const t of ENTITY_TYPES) {
    acc += weights[t];
    if (target <= acc) return t;
  }
  return 'tree';
}

function buildSectors(
  terrain: WorldTerrainMap,
  territories: ReadonlyArray<TerritoryGridRef>,
  bounds: WorldBounds
): SectorInfo[] {
  const cfg = RESOURCE_DISTRIBUTION_CONFIG;
  const step = cfg.sectorSizePx;
  const minSx = Math.floor(bounds.min / step);
  const maxSx = Math.floor(bounds.max / step);
  const minSy = Math.floor(bounds.min / step);
  const maxSy = Math.floor(bounds.max / step);

  const sectors: SectorInfo[] = [];

  for (let sy = minSy; sy <= maxSy; sy++) {
    for (let sx = minSx; sx <= maxSx; sx++) {
      const minX = Math.max(bounds.min + 76, sx * step);
      const maxX = Math.min(bounds.max - 76, (sx + 1) * step);
      const minY = Math.max(bounds.min + 76, sy * step);
      const maxY = Math.min(bounds.max - 76, (sy + 1) * step);
      if (maxX - minX < 96 || maxY - minY < 96) continue;

      // Sample 4x4 grid within sector to estimate outdoor walkable fraction & biome mix
      let validSamples = 0;
      const weightSum: Record<EntityType, number> = { tree: 0, rock: 0, gold_rock: 0, sheep: 0 };

      for (let py = 0; py < 4; py++) {
        for (let px = 0; px < 4; px++) {
          const wx = minX + ((px + 0.5) / 4) * (maxX - minX);
          const wy = minY + ((py + 0.5) / 4) * (maxY - minY);
          if (isSpotClearOfTerrainObstacles(wx, wy, terrain, territories, bounds)) {
            validSamples++;
            const cell = getTerrainCellAtWorld(terrain, wx, wy);
            if (cell) {
              const bw = BIOME_CONFIGS[cell.biome].resourceWeights;
              for (const t of ENTITY_TYPES) weightSum[t] += bw[t];
            }
          }
        }
      }

      if (validSamples === 0) continue;
      const outdoorRatio = validSamples / 16;
      const capacity = Math.max(1, Math.round(cfg.targetResourcesPerSector * outdoorRatio));

      sectors.push({
        key: `${sx},${sy}`,
        sx,
        sy,
        minX,
        maxX,
        minY,
        maxY,
        capacity,
        dominantBiomeWeights: weightSum,
      });
    }
  }

  return sectors;
}

/**
 * Generates initial map-wide resource entities evenly distributed across every outdoor sector
 * according to Necesse-style biome weights. Pure function.
 */
export function generateWorldResourceEntities(
  terrain: WorldTerrainMap,
  territories: ReadonlyArray<TerritoryGridRef> = INITIAL_ISLANDS,
  bounds: WorldBounds = WORLD_BOUNDS,
  buildings: ReadonlyArray<Pick<ConstructedBuilding, 'x' | 'y'>> = []
): Entity[] {
  const cfg = RESOURCE_DISTRIBUTION_CONFIG;
  const seed = TERRAIN_GENERATION_CONFIG.seed;
  const sectors = buildSectors(terrain, territories, bounds);
  const entities: Entity[] = [];
  let seq = 0;

  for (const sector of sectors) {
    let spawnedInSector = 0;
    const maxAttempts = sector.capacity * 10;

    for (let attempt = 0; attempt < maxAttempts && spawnedInSector < sector.capacity; attempt++) {
      const rx = hash2D(sector.sx * 31 + attempt, sector.sy * 17 + 3, seed + 2011);
      const ry = hash2D(sector.sx * 19 + 7, sector.sy * 37 + attempt, seed + 3037);
      const wx = Math.round(sector.minX + rx * (sector.maxX - sector.minX));
      const wy = Math.round(sector.minY + ry * (sector.maxY - sector.minY));

      if (!isSpotClearOfTerrainObstacles(wx, wy, terrain, territories, bounds)) continue;
      if (!isSpotFreeOfCollisions(wx, wy, entities, buildings, cfg.minEntitySpacingPx)) continue;

      const cell = getTerrainCellAtWorld(terrain, wx, wy);
      const weights = cell ? BIOME_CONFIGS[cell.biome].resourceWeights : BIOME_CONFIGS.plains.resourceWeights;
      const typeRoll = hash2D(wx, wy, seed + 4099 + attempt);
      const type = pickEntityTypeByBiome(weights, typeRoll);
      const maxHp = cfg.entityMaxHp[type];

      entities.push({
        id: `res_${seq++}_${type}`,
        type,
        x: wx,
        y: wy,
        hp: maxHp,
        maxHp,
        islandId: -1, // Wilderness global resource (no village unlock required)
      });
      spawnedInSector++;
    }
  }

  return entities;
}

/**
 * Selects a new evenly-distributed map-wide respawn location for a depleted resource.
 * Prioritizes sectors with the lowest current resource density relative to their capacity
 * while preferring biomes that match the resource type.
 */
export function pickRespawnSpot(
  targetType: EntityType,
  activeEntities: Iterable<Entity>,
  terrain: WorldTerrainMap,
  territories: ReadonlyArray<TerritoryGridRef> = INITIAL_ISLANDS,
  bounds: WorldBounds = WORLD_BOUNDS,
  buildings: ReadonlyArray<Pick<ConstructedBuilding, 'x' | 'y'>> = []
): { x: number; y: number; type: EntityType; hp: number; maxHp: number } | null {
  const cfg = RESOURCE_DISTRIBUTION_CONFIG;
  const sectors = buildSectors(terrain, territories, bounds);
  if (sectors.length === 0) return null;

  const activeList = Array.from(activeEntities);
  const sectorCounts = new Map<string, number>();
  for (const ent of activeList) {
    const sx = Math.floor(ent.x / cfg.sectorSizePx);
    const sy = Math.floor(ent.y / cfg.sectorSizePx);
    const key = `${sx},${sy}`;
    sectorCounts.set(key, (sectorCounts.get(key) || 0) + 1);
  }

  // Score sectors by capacity deficit + mild biome affinity for targetType
  const scored = sectors.map((sector) => {
    const count = sectorCounts.get(sector.key) || 0;
    const deficit = sector.capacity - count;
    const totalW =
      sector.dominantBiomeWeights.tree +
      sector.dominantBiomeWeights.rock +
      sector.dominantBiomeWeights.gold_rock +
      sector.dominantBiomeWeights.sheep;
    const affinity = totalW > 0 ? sector.dominantBiomeWeights[targetType] / totalW : 0.25;
    const score = deficit * 2.0 + affinity * 0.9 + Math.random() * 0.65;
    return { sector, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Try top candidate sectors in order
  const candidateLimit = Math.min(scored.length, 18);
  for (let i = 0; i < candidateLimit; i++) {
    const { sector } = scored[i];
    for (let attempt = 0; attempt < 16; attempt++) {
      const wx = Math.round(sector.minX + Math.random() * (sector.maxX - sector.minX));
      const wy = Math.round(sector.minY + Math.random() * (sector.maxY - sector.minY));

      if (!isSpotClearOfTerrainObstacles(wx, wy, terrain, territories, bounds)) continue;
      if (!isSpotFreeOfCollisions(wx, wy, activeList, buildings, cfg.minEntitySpacingPx)) continue;

      const maxHp = cfg.entityMaxHp[targetType];
      return { x: wx, y: wy, type: targetType, hp: maxHp, maxHp };
    }
  }

  return null;
}
