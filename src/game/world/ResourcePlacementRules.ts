import {
  BIOME_CONFIGS,
  RESOURCE_DISTRIBUTION_CONFIG,
} from '../../data/biomes';
import { ConstructedBuilding, Entity, EntityType } from '../../types/game';
import { TERRITORY_PX, TERRITORY_STEP } from '../constants';
import { WorldBounds } from '../worldBounds';
import {
  getTerrainCellAtWorld,
  TerritoryGridRef,
  WorldTerrainMap,
} from './MapTerrainGenerator';

export interface SectorInfo {
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

export const ENTITY_TYPES: readonly EntityType[] = ['tree', 'rock', 'gold_rock', 'sheep'];

const sectorCache = new WeakMap<WorldTerrainMap, { key: string; sectors: SectorInfo[] }>();

export function isInsideAnyTerritory(
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

export function isSpotClearOfTerrainObstacles(
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

export function isSpotFreeOfCollisions(
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

export function pickEntityTypeByBiome(
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

export function getOrBuildSectors(
  terrain: WorldTerrainMap,
  territories: ReadonlyArray<TerritoryGridRef>,
  bounds: WorldBounds
): SectorInfo[] {
  const key = `${bounds.min}:${bounds.max}:${territories.map((t) => `${t.gridX},${t.gridY}`).join(';')}`;
  const cached = sectorCache.get(terrain);
  if (cached && cached.key === key) {
    return cached.sectors;
  }
  const sectors = buildSectors(terrain, territories, bounds);
  sectorCache.set(terrain, { key, sectors });
  return sectors;
}

export function rebalanceGeneralGoldCount(entities: Entity[], targetGoldCount: number): void {
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
