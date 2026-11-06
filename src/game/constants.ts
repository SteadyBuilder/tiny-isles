import { Island, Entity } from '../types/game';

export const TILE_SIZE = 64;
export const ISLAND_TILES = 8; // 8x8 tiles per island (512x512 px)
export const ISLAND_PX = TILE_SIZE * ISLAND_TILES;
export const ISLAND_GAP = 96; // Water gap between islands

export const INITIAL_ISLANDS: Island[] = [
  {
    id: 0,
    gridX: 0,
    gridY: 0,
    costWood: 0,
    costStone: 0,
    costGold: 0,
    unlocked: true,
    name: '시작의 섬 (Home Isle)',
  },
  {
    id: 1,
    gridX: 1,
    gridY: 0,
    costWood: 12,
    costStone: 6,
    costGold: 0,
    unlocked: false,
    name: '동쪽 삼림지대 (East Woods)',
  },
  {
    id: 2,
    gridX: 0,
    gridY: 1,
    costWood: 20,
    costStone: 15,
    costGold: 0,
    unlocked: false,
    name: '남쪽 채석장 (South Quarry)',
  },
  {
    id: 3,
    gridX: -1,
    gridY: 0,
    costWood: 35,
    costStone: 25,
    costGold: 5,
    unlocked: false,
    name: '서쪽 황금섬 (West Gold Isle)',
  },
  {
    id: 4,
    gridX: 0,
    gridY: -1,
    costWood: 50,
    costStone: 40,
    costGold: 15,
    unlocked: false,
    name: '북쪽 왕관섬 (Crown Sanctuary)',
  },
];

export function getIslandOrigin(gridX: number, gridY: number): { x: number; y: number } {
  return {
    x: gridX * (ISLAND_PX + ISLAND_GAP),
    y: gridY * (ISLAND_PX + ISLAND_GAP),
  };
}

export function generateIslandEntities(islandId: number, gridX: number, gridY: number): Entity[] {
  const origin = getIslandOrigin(gridX, gridY);
  const entities: Entity[] = [];

  if (islandId === 0) {
    // Starting Isle: balanced resources
    entities.push(
      { id: 't_0_1', type: 'tree', x: origin.x + 120, y: origin.y + 140, hp: 3, maxHp: 3, islandId: 0 },
      { id: 't_0_2', type: 'tree', x: origin.x + 360, y: origin.y + 160, hp: 3, maxHp: 3, islandId: 0 },
      { id: 't_0_3', type: 'tree', x: origin.x + 160, y: origin.y + 360, hp: 3, maxHp: 3, islandId: 0 },
      { id: 'r_0_1', type: 'rock', x: origin.x + 380, y: origin.y + 340, hp: 4, maxHp: 4, islandId: 0 },
      { id: 'r_0_2', type: 'rock', x: origin.x + 260, y: origin.y + 240, hp: 4, maxHp: 4, islandId: 0 }
    );
  } else if (islandId === 1) {
    // East Woods: Wood galore
    entities.push(
      { id: 't_1_1', type: 'tree', x: origin.x + 130, y: origin.y + 140, hp: 3, maxHp: 3, islandId: 1 },
      { id: 't_1_2', type: 'tree', x: origin.x + 260, y: origin.y + 150, hp: 3, maxHp: 3, islandId: 1 },
      { id: 't_1_3', type: 'tree', x: origin.x + 380, y: origin.y + 180, hp: 3, maxHp: 3, islandId: 1 },
      { id: 't_1_4', type: 'tree', x: origin.x + 180, y: origin.y + 340, hp: 3, maxHp: 3, islandId: 1 },
      { id: 't_1_5', type: 'tree', x: origin.x + 340, y: origin.y + 350, hp: 3, maxHp: 3, islandId: 1 },
      { id: 'r_1_1', type: 'rock', x: origin.x + 260, y: origin.y + 260, hp: 4, maxHp: 4, islandId: 1 }
    );
  } else if (islandId === 2) {
    // South Quarry: Stones and Gold
    entities.push(
      { id: 'r_2_1', type: 'rock', x: origin.x + 140, y: origin.y + 150, hp: 4, maxHp: 4, islandId: 2 },
      { id: 'r_2_2', type: 'rock', x: origin.x + 350, y: origin.y + 160, hp: 4, maxHp: 4, islandId: 2 },
      { id: 'r_2_3', type: 'rock', x: origin.x + 160, y: origin.y + 340, hp: 4, maxHp: 4, islandId: 2 },
      { id: 'g_2_1', type: 'gold_rock', x: origin.x + 360, y: origin.y + 350, hp: 5, maxHp: 5, islandId: 2 },
      { id: 't_2_1', type: 'tree', x: origin.x + 250, y: origin.y + 240, hp: 3, maxHp: 3, islandId: 2 }
    );
  } else if (islandId === 3) {
    // West Gold Isle: Gold rocks
    entities.push(
      { id: 'g_3_1', type: 'gold_rock', x: origin.x + 150, y: origin.y + 150, hp: 5, maxHp: 5, islandId: 3 },
      { id: 'g_3_2', type: 'gold_rock', x: origin.x + 350, y: origin.y + 150, hp: 5, maxHp: 5, islandId: 3 },
      { id: 'g_3_3', type: 'gold_rock', x: origin.x + 250, y: origin.y + 320, hp: 5, maxHp: 5, islandId: 3 },
      { id: 't_3_1', type: 'tree', x: origin.x + 140, y: origin.y + 320, hp: 3, maxHp: 3, islandId: 3 },
      { id: 'r_3_1', type: 'rock', x: origin.x + 360, y: origin.y + 320, hp: 4, maxHp: 4, islandId: 3 }
    );
  } else if (islandId === 4) {
    // Crown Sanctuary
    entities.push(
      { id: 'g_4_1', type: 'gold_rock', x: origin.x + 200, y: origin.y + 200, hp: 6, maxHp: 6, islandId: 4 },
      { id: 'g_4_2', type: 'gold_rock', x: origin.x + 320, y: origin.y + 200, hp: 6, maxHp: 6, islandId: 4 },
      { id: 't_4_1', type: 'tree', x: origin.x + 150, y: origin.y + 340, hp: 3, maxHp: 3, islandId: 4 },
      { id: 't_4_2', type: 'tree', x: origin.x + 360, y: origin.y + 340, hp: 3, maxHp: 3, islandId: 4 }
    );
  }

  return entities;
}
