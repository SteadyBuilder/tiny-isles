import {
  BIOME_CONFIGS,
  GOLD_MINE_BIOME_CONFIG,
  RESOURCE_DISTRIBUTION_CONFIG,
  TERRAIN_GENERATION_CONFIG,
} from '../../data/biomes';
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
  bounds: WorldBounds,
  allowGoldMine: boolean
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
    [24, 14],
    [-14, -14],
    [24, -10],
    [-14, 24],
  ];
  for (const [dx, dy] of probeOffsets) {
    const cell = getTerrainCellAtWorld(terrain, wx + dx, wy + dy);
    if (!cell || cell.biome === 'water' || cell.isRoad || cell.isBridge || cell.isVillagePlot) {
      return false;
    }
    if (!allowGoldMine && cell.biome === 'gold_mine') {
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

      let validSamples = 0;
      const weightSum: Record<EntityType, number> = { tree: 0, rock: 0, gold_rock: 0, sheep: 0 };

      for (let py = 0; py < 4; py++) {
        for (let px = 0; px < 4; px++) {
          const wx = minX + ((px + 0.5) / 4) * (maxX - minX);
          const wy = minY + ((py + 0.5) / 4) * (maxY - minY);
          if (isSpotClearOfTerrainObstacles(wx, wy, terrain, territories, bounds, false)) {
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

function rebalanceGeneralGoldCount(entities: Entity[], targetGoldCount: number): void {
  const cfg = RESOURCE_DISTRIBUTION_CONFIG;
  const goldIndices: number[] = [];
  for (let i = 0; i < entities.length; i++) {
    if (entities[i].type === 'gold_rock') goldIndices.push(i);
  }

  if (goldIndices.length > targetGoldCount) {
    const excess = goldIndices.length - targetGoldCount;
    const stride = goldIndices.length / excess;
    for (let k = 0; k < excess; k++) {
      const idx = goldIndices[Math.min(goldIndices.length - 1, Math.floor(k * stride))];
      const replacementType: EntityType = k % 2 === 0 ? 'rock' : 'tree';
      const maxHp = cfg.entityMaxHp[replacementType];
      entities[idx] = {
        ...entities[idx],
        type: replacementType,
        hp: maxHp,
        maxHp,
      };
    }
  }
}

/**
 * Generates clustered gold_rock veins inside the sealed/unlocked gold_mine biome zone.
 * Only spawned once its governing territory (#11) is unlocked. Pure function.
 */
export function generateGoldMineClusterEntities(
  terrain: WorldTerrainMap,
  territories: ReadonlyArray<TerritoryGridRef> = INITIAL_ISLANDS,
  bounds: WorldBounds = WORLD_BOUNDS,
  existingEntities: ReadonlyArray<Pick<Entity, 'x' | 'y'>> = [],
  buildings: ReadonlyArray<Pick<ConstructedBuilding, 'x' | 'y'>> = []
): Entity[] {
  const gm = GOLD_MINE_BIOME_CONFIG;
  const cfg = RESOURCE_DISTRIBUTION_CONFIG;
  const seed = TERRAIN_GENERATION_CONFIG.seed;
  const mineCells = terrain.cells.filter(
    (c) => c.biome === 'gold_mine' && !c.isRoad && !c.isBridge && !c.isVillagePlot
  );
  if (mineCells.length === 0) return [];

  const spawned: Entity[] = [];
  const occupied: Array<{ x: number; y: number }> = [...existingEntities];
  const maxAttempts = gm.clusterNodeCount * 24;

  for (let attempt = 0; attempt < maxAttempts && spawned.length < gm.clusterNodeCount; attempt++) {
    const cellPick = Math.floor(
      hash2D(attempt * 13, attempt * 29, seed + 8101) * mineCells.length
    );
    const cell = mineCells[Math.min(mineCells.length - 1, cellPick)];
    const jx = (hash2D(attempt * 17, cell.gx, seed + 8209) - 0.5) * 40;
    const jy = (hash2D(cell.gy, attempt * 19, seed + 8311) - 0.5) * 40;
    const wx = Math.round(cell.worldX + 32 + jx);
    const wy = Math.round(cell.worldY + 32 + jy);

    const probed = getTerrainCellAtWorld(terrain, wx, wy);
    if (!probed || probed.biome !== 'gold_mine') continue;
    if (!isSpotClearOfTerrainObstacles(wx, wy, terrain, territories, bounds, true)) continue;
    if (!isSpotFreeOfCollisions(wx, wy, occupied, buildings, gm.clusterMinSpacingPx)) continue;

    const maxHp = cfg.entityMaxHp.gold_rock;
    const ent: Entity = {
      id: `res_gm_${spawned.length}_gold_rock`,
      type: 'gold_rock',
      x: wx,
      y: wy,
      hp: maxHp,
      maxHp,
      islandId: -1,
      zoneTag: 'gold_mine',
    };
    spawned.push(ent);
    occupied.push(ent);
  }

  return spawned;
}

/**
 * Generates initial map-wide resource entities evenly distributed across every outdoor sector
 * with dense wood & stone, preserved general-world gold counts, and optional unlocked gold mine cluster.
 */
export function generateWorldResourceEntities(
  terrain: WorldTerrainMap,
  territories: ReadonlyArray<TerritoryGridRef> = INITIAL_ISLANDS,
  bounds: WorldBounds = WORLD_BOUNDS,
  buildings: ReadonlyArray<Pick<ConstructedBuilding, 'x' | 'y'>> = [],
  goldMineUnlocked: boolean = false
): Entity[] {
  const cfg = RESOURCE_DISTRIBUTION_CONFIG;
  const seed = TERRAIN_GENERATION_CONFIG.seed;
  const sectors = buildSectors(terrain, territories, bounds);
  const entities: Entity[] = [];
  let seq = 0;

  for (const sector of sectors) {
    let spawnedInSector = 0;
    const maxAttempts = sector.capacity * 14;

    for (let attempt = 0; attempt < maxAttempts && spawnedInSector < sector.capacity; attempt++) {
      const rx = hash2D(sector.sx * 31 + attempt, sector.sy * 17 + 3, seed + 2011);
      const ry = hash2D(sector.sx * 19 + 7, sector.sy * 37 + attempt, seed + 3037);
      const wx = Math.round(sector.minX + rx * (sector.maxX - sector.minX));
      const wy = Math.round(sector.minY + ry * (sector.maxY - sector.minY));

      if (!isSpotClearOfTerrainObstacles(wx, wy, terrain, territories, bounds, false)) continue;
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
        islandId: -1,
        zoneTag: 'wilderness',
      });
      spawnedInSector++;
    }
  }

  rebalanceGeneralGoldCount(entities, cfg.generalGoldTargetCount);

  if (goldMineUnlocked) {
    const mineNodes = generateGoldMineClusterEntities(
      terrain,
      territories,
      bounds,
      entities,
      buildings
    );
    entities.push(...mineNodes);
  }

  return entities;
}

export interface RespawnSpotOptions {
  goldMineUnlocked?: boolean;
  zoneTag?: 'wilderness' | 'gold_mine';
}

/**
 * Selects a new evenly-distributed map-wide respawn location for a depleted resource.
 * Gold mine nodes respawn inside the unlocked gold mine cluster; general nodes balance across low-density sectors.
 */
export function pickRespawnSpot(
  targetType: EntityType,
  activeEntities: Iterable<Entity>,
  terrain: WorldTerrainMap,
  territories: ReadonlyArray<TerritoryGridRef> = INITIAL_ISLANDS,
  bounds: WorldBounds = WORLD_BOUNDS,
  buildings: ReadonlyArray<Pick<ConstructedBuilding, 'x' | 'y'>> = [],
  options: RespawnSpotOptions = {}
): { x: number; y: number; type: EntityType; hp: number; maxHp: number; zoneTag: 'wilderness' | 'gold_mine' } | null {
  const cfg = RESOURCE_DISTRIBUTION_CONFIG;
  const activeList = Array.from(activeEntities);

  // Respawn inside the clustered gold mine zone if this node belonged to it
  if (options.zoneTag === 'gold_mine' && options.goldMineUnlocked) {
    const gm = GOLD_MINE_BIOME_CONFIG;
    const mineCells = terrain.cells.filter(
      (c) => c.biome === 'gold_mine' && !c.isRoad && !c.isBridge && !c.isVillagePlot
    );
    for (let attempt = 0; attempt < 32 && mineCells.length > 0; attempt++) {
      const cell = mineCells[Math.floor(Math.random() * mineCells.length)];
      const wx = Math.round(cell.worldX + 12 + Math.random() * 40);
      const wy = Math.round(cell.worldY + 12 + Math.random() * 40);
      const probed = getTerrainCellAtWorld(terrain, wx, wy);
      if (!probed || probed.biome !== 'gold_mine') continue;
      if (!isSpotClearOfTerrainObstacles(wx, wy, terrain, territories, bounds, true)) continue;
      if (!isSpotFreeOfCollisions(wx, wy, activeList, buildings, gm.clusterMinSpacingPx)) continue;
      const maxHp = cfg.entityMaxHp[targetType];
      return { x: wx, y: wy, type: targetType, hp: maxHp, maxHp, zoneTag: 'gold_mine' };
    }
  }

  const sectors = buildSectors(terrain, territories, bounds);
  if (sectors.length === 0) return null;

  const sectorCounts = new Map<string, number>();
  for (const ent of activeList) {
    if (ent.zoneTag === 'gold_mine') continue;
    const sx = Math.floor(ent.x / cfg.sectorSizePx);
    const sy = Math.floor(ent.y / cfg.sectorSizePx);
    const key = `${sx},${sy}`;
    sectorCounts.set(key, (sectorCounts.get(key) || 0) + 1);
  }

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

  const candidateLimit = Math.min(scored.length, 18);
  for (let i = 0; i < candidateLimit; i++) {
    const { sector } = scored[i];
    for (let attempt = 0; attempt < 18; attempt++) {
      const wx = Math.round(sector.minX + Math.random() * (sector.maxX - sector.minX));
      const wy = Math.round(sector.minY + Math.random() * (sector.maxY - sector.minY));

      if (!isSpotClearOfTerrainObstacles(wx, wy, terrain, territories, bounds, false)) continue;
      if (!isSpotFreeOfCollisions(wx, wy, activeList, buildings, cfg.minEntitySpacingPx)) continue;

      const maxHp = cfg.entityMaxHp[targetType];
      return { x: wx, y: wy, type: targetType, hp: maxHp, maxHp, zoneTag: 'wilderness' };
    }
  }

  return null;
}
