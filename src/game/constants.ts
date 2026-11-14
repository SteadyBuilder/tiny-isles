import {
  Island,
  TerritoryCore,
  ConstructedBuilding,
} from '../types/game';
import {
  CONSTRUCTABLE_BLUEPRINTS,
  getBlueprint,
  TERRITORY_BUILD_SLOTS,
  VILLAGE_PROGRESSION_TEXT,
  VILLAGE_TIER_CONFIG,
  VILLAGE_TIER_CONFIGS,
} from '../data/buildings';
import {
  BOSS_WAVE_INTERVAL_SEC,
  REGULAR_WAVE_INTERVAL_SEC,
} from '../data/waves';
import { INITIAL_ISLANDS } from '../data/territories';
import {
  TILE_SIZE,
  TERRITORY_TILES,
  ISLAND_TILES,
  TERRITORY_PX,
  TERRITORY_GAP,
  ISLAND_GAP,
  TERRITORY_STEP,
  ISLAND_STEP,
  getIslandOrigin,
  getTerritoryCorePos,
} from './world/territoryGrid';
import {
  CollisionBox,
  generateTerritoryBuildings,
  getBuildingCollisionBox,
} from './world/TerritoryContentGenerator';
import { generateIslandEntities } from './world/TerritoryEntitySpawner';

export type { CollisionBox };

export {
  CONSTRUCTABLE_BLUEPRINTS,
  getBlueprint,
  TERRITORY_BUILD_SLOTS,
  VILLAGE_PROGRESSION_TEXT,
  VILLAGE_TIER_CONFIG,
  VILLAGE_TIER_CONFIGS,
  REGULAR_WAVE_INTERVAL_SEC,
  BOSS_WAVE_INTERVAL_SEC,
  INITIAL_ISLANDS,
  TILE_SIZE,
  TERRITORY_TILES,
  ISLAND_TILES,
  TERRITORY_PX,
  TERRITORY_GAP,
  ISLAND_GAP,
  TERRITORY_STEP,
  ISLAND_STEP,
  getIslandOrigin,
  getTerritoryCorePos,
  generateTerritoryBuildings,
  getBuildingCollisionBox,
  generateIslandEntities,
};

// 중심 마을은 처음부터 중소마을이며 나무 방책이 있음!
export function getInitialConstructedBuildings(): ConstructedBuilding[] {
  const origin0 = getIslandOrigin(0, 0);
  const wallBp = getBlueprint('wood_wall');
  const towerBp = getBlueprint('arrow_tower');

  return [
    {
      id: 'init_wall_0_n',
      territoryId: 0,
      type: 'wood_wall',
      category: 'wall',
      name: '중심 마을 북쪽 나무 방책',
      x: origin0.x + TERRITORY_BUILD_SLOTS[0].relX,
      y: origin0.y + TERRITORY_BUILD_SLOTS[0].relY,
      hp: wallBp.maxHp,
      maxHp: wallBp.maxHp,
      slotIndex: 0,
    },
    {
      id: 'init_wall_0_s',
      territoryId: 0,
      type: 'wood_wall',
      category: 'wall',
      name: '중심 마을 남쪽 나무 방책',
      x: origin0.x + TERRITORY_BUILD_SLOTS[1].relX,
      y: origin0.y + TERRITORY_BUILD_SLOTS[1].relY,
      hp: wallBp.maxHp,
      maxHp: wallBp.maxHp,
      slotIndex: 1,
    },
    {
      id: 'init_wall_0_e',
      territoryId: 0,
      type: 'wood_wall',
      category: 'wall',
      name: '중심 마을 동쪽 나무 방책',
      x: origin0.x + TERRITORY_BUILD_SLOTS[2].relX,
      y: origin0.y + TERRITORY_BUILD_SLOTS[2].relY,
      hp: wallBp.maxHp,
      maxHp: wallBp.maxHp,
      slotIndex: 2,
    },
    {
      id: 'init_wall_0_w',
      territoryId: 0,
      type: 'wood_wall',
      category: 'wall',
      name: '중심 마을 서쪽 나무 방책',
      x: origin0.x + TERRITORY_BUILD_SLOTS[3].relX,
      y: origin0.y + TERRITORY_BUILD_SLOTS[3].relY,
      hp: wallBp.maxHp,
      maxHp: wallBp.maxHp,
      slotIndex: 3,
    },
    {
      id: 'init_tower_0_ne',
      territoryId: 0,
      type: 'arrow_tower',
      category: 'tower',
      name: '중심 마을 수호 방어타워',
      x: origin0.x + TERRITORY_BUILD_SLOTS[4].relX,
      y: origin0.y + TERRITORY_BUILD_SLOTS[4].relY,
      hp: towerBp.maxHp,
      maxHp: towerBp.maxHp,
      slotIndex: 4,
    },
  ];
}

// Central Territory Core definition (Heart of the central village)
export const CENTRAL_CORE: TerritoryCore = {
  x: 320,
  y: 350,
  level: 2,
  name: '중심 마을 코어 보석 (Core Gem)',
  islandId: 0,
};

/**
 * 점령한 땅 외곽 영지 및 외곽 진입 좌표 계산
 * 몬스터 웨이브는 점령한 땅의 가장 바깥쪽 외곽 경계에서 진입하여 중심부를 향해 진격합니다.
 */
export function getOuterPerimeterSpawns(islands: Island[]): {
  territory: Island;
  spawnX: number;
  spawnY: number;
}[] {
  const unlocked = islands.filter((i) => i.unlocked);
  if (unlocked.length === 0) {
    const center = islands[0];
    const origin = getIslandOrigin(0, 0);
    return [{ territory: center, spawnX: origin.x + 320, spawnY: origin.y + 20 }];
  }

  const unlockedSet = new Set(unlocked.map((i) => `${i.gridX},${i.gridY}`));
  const spawns: { territory: Island; spawnX: number; spawnY: number }[] = [];

  const dirs = [
    { dx: 0, dy: -1, relX: 320, relY: 20 },  // 북쪽 외곽 경계
    { dx: 0, dy: 1, relX: 320, relY: 620 },  // 남쪽 외곽 경계
    { dx: 1, dy: 0, relX: 620, relY: 350 },  // 동쪽 외곽 경계
    { dx: -1, dy: 0, relX: 20, relY: 350 },  // 서쪽 외곽 경계
  ];

  let maxDist = 0;
  for (const isl of unlocked) {
    const d = Math.abs(isl.gridX) + Math.abs(isl.gridY);
    if (d > maxDist) maxDist = d;
  }

  for (const isl of unlocked) {
    const origin = getIslandOrigin(isl.gridX, isl.gridY);
    for (const dir of dirs) {
      const nx = isl.gridX + dir.dx;
      const ny = isl.gridY + dir.dy;
      if (!unlockedSet.has(`${nx},${ny}`)) {
        if (unlocked.length === 1 || isl.id !== 0 || maxDist === 0) {
          spawns.push({
            territory: isl,
            spawnX: origin.x + dir.relX,
            spawnY: origin.y + dir.relY,
          });
        }
      }
    }
  }

  if (spawns.length === 0) {
    const first = unlocked[unlocked.length - 1];
    const origin = getIslandOrigin(first.gridX, first.gridY);
    spawns.push({ territory: first, spawnX: origin.x + 320, spawnY: origin.y + 20 });
  }

  return spawns;
}
