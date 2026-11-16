import {
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
  TERRITORY_CENTER_X,
  TERRITORY_CENTER_Y,
  TERRITORY_CORE_REL_X,
  TERRITORY_CORE_REL_Y,
  getIslandOrigin,
  getTerritoryCorePos,
} from './world/territoryGrid';
import {
  CollisionBox,
  generateTerritoryBuildings,
  getBuildingCollisionBox,
  getTerritoryMainBuilding,
  isPointInCollisionBox,
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
  INITIAL_ISLANDS,
  TILE_SIZE,
  TERRITORY_TILES,
  ISLAND_TILES,
  TERRITORY_PX,
  TERRITORY_GAP,
  ISLAND_GAP,
  TERRITORY_STEP,
  ISLAND_STEP,
  TERRITORY_CENTER_X,
  TERRITORY_CENTER_Y,
  TERRITORY_CORE_REL_X,
  TERRITORY_CORE_REL_Y,
  getIslandOrigin,
  getTerritoryCorePos,
  generateTerritoryBuildings,
  getBuildingCollisionBox,
  getTerritoryMainBuilding,
  isPointInCollisionBox,
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
