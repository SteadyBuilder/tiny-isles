import { Island, Entity, Building, TerritoryCore } from '../types/game';

export const TILE_SIZE = 64;
export const TERRITORY_TILES = 10; // 10x10 tiles per territory (640x640 px)
export const ISLAND_TILES = TERRITORY_TILES;
export const TERRITORY_PX = TILE_SIZE * TERRITORY_TILES; // 640px
export const ISLAND_PX = TERRITORY_PX;
export const TERRITORY_GAP = 0; // Contiguous plains grid
export const ISLAND_GAP = TERRITORY_GAP;

// Central Territory Core definition (Heart of the kingdom)
export const CENTRAL_CORE: TerritoryCore = {
  x: 320,
  y: 350,
  level: 1,
  name: '영지 코어 (Territory Core)',
  islandId: 0,
};

export const INITIAL_ISLANDS: Island[] = [
  // 1. 시작 및 중앙 허브 (중심 마을)
  {
    id: 0,
    gridX: 0,
    gridY: 0,
    costWood: 0,
    costStone: 0,
    costGold: 0,
    unlocked: true,
    name: '중심 마을 (Capital Village & Core)',
  },

  // 2. 1차 확장 (기본 십자 방향)
  {
    id: 1,
    gridX: 1,
    gridY: 0,
    costWood: 12,
    costStone: 6,
    costGold: 0,
    unlocked: false,
    name: '동쪽 벌목 평원 (East Woodland Plains)',
  },
  {
    id: 2,
    gridX: 0,
    gridY: 1,
    costWood: 20,
    costStone: 15,
    costGold: 0,
    unlocked: false,
    name: '남쪽 채석 평원 (South Quarry Plains)',
  },
  {
    id: 3,
    gridX: -1,
    gridY: 0,
    costWood: 35,
    costStone: 25,
    costGold: 5,
    unlocked: false,
    name: '서쪽 황금 평원 (West Goldfields)',
  },
  {
    id: 4,
    gridX: 0,
    gridY: -1,
    costWood: 50,
    costStone: 40,
    costGold: 15,
    unlocked: false,
    name: '북쪽 수호탑 언덕 (North Citadel Hill)',
  },

  // 3. 2차 확장 (대각선 인접 영지 - 3x3 중심부 완성)
  {
    id: 5,
    gridX: 1,
    gridY: 1,
    costWood: 25,
    costStone: 18,
    costGold: 2,
    unlocked: false,
    name: '남동쪽 풍요의 과수원 (Southeast Orchard)',
  },
  {
    id: 6,
    gridX: -1,
    gridY: 1,
    costWood: 35,
    costStone: 30,
    costGold: 6,
    unlocked: false,
    name: '남서쪽 흑요석 광산 (Southwest Obsidian Mine)',
  },
  {
    id: 7,
    gridX: 1,
    gridY: -1,
    costWood: 40,
    costStone: 25,
    costGold: 8,
    unlocked: false,
    name: '북동쪽 에메랄드 숲 (Northeast Emerald Grove)',
  },
  {
    id: 8,
    gridX: -1,
    gridY: -1,
    costWood: 55,
    costStone: 42,
    costGold: 18,
    unlocked: false,
    name: '북서쪽 고대 유적지 (Northwest Ancient Ruins)',
  },

  // 4. 3차 확장 (거리 2 십자 방향)
  {
    id: 9,
    gridX: 2,
    gridY: 0,
    costWood: 55,
    costStone: 35,
    costGold: 8,
    unlocked: false,
    name: '극동의 거목림 평원 (Far East Redwood)',
  },
  {
    id: 10,
    gridX: 0,
    gridY: 2,
    costWood: 45,
    costStone: 60,
    costGold: 10,
    unlocked: false,
    name: '남쪽 화강암 절벽 (Deep South Granite)',
  },
  {
    id: 11,
    gridX: -2,
    gridY: 0,
    costWood: 60,
    costStone: 50,
    costGold: 20,
    unlocked: false,
    name: '극서 태양의 금광 (Far West Sunforge)',
  },
  {
    id: 12,
    gridX: 0,
    gridY: -2,
    costWood: 70,
    costStone: 55,
    costGold: 25,
    unlocked: false,
    name: '천공의 별빛 성소 (Celestial Star Altar)',
  },

  // 5. 4차 확장 (외곽 군도/영지 링)
  {
    id: 13,
    gridX: 2,
    gridY: 1,
    costWood: 55,
    costStone: 40,
    costGold: 12,
    unlocked: false,
    name: '동남쪽 밀수꾼의 평원 (Smuggler Plain)',
  },
  {
    id: 14,
    gridX: 1,
    gridY: 2,
    costWood: 50,
    costStone: 50,
    costGold: 12,
    unlocked: false,
    name: '남동 호수 암초 평원 (Lake Reef Plain)',
  },
  {
    id: 15,
    gridX: -1,
    gridY: 2,
    costWood: 52,
    costStone: 48,
    costGold: 15,
    unlocked: false,
    name: '남서 거북 언덕 (Turtle Hill Plain)',
  },
  {
    id: 16,
    gridX: -2,
    gridY: 1,
    costWood: 65,
    costStone: 55,
    costGold: 22,
    unlocked: false,
    name: '남서 국경 요새 (Frontier Fortress)',
  },
  {
    id: 17,
    gridX: 2,
    gridY: -1,
    costWood: 60,
    costStone: 40,
    costGold: 18,
    unlocked: false,
    name: '북동 바람개비 언덕 (Breeze Windmill Plain)',
  },
  {
    id: 18,
    gridX: 1,
    gridY: -2,
    costWood: 68,
    costStone: 50,
    costGold: 22,
    unlocked: false,
    name: '북동 오로라 관측지 (Aurora Observatory)',
  },
  {
    id: 19,
    gridX: -1,
    gridY: -2,
    costWood: 70,
    costStone: 55,
    costGold: 25,
    unlocked: false,
    name: '북서 달빛 계곡 (Moonlight Valley)',
  },
  {
    id: 20,
    gridX: -2,
    gridY: -1,
    costWood: 75,
    costStone: 60,
    costGold: 30,
    unlocked: false,
    name: '서북 그림자 봉우리 (Shadow Peak Plain)',
  },
];

export function getIslandOrigin(gridX: number, gridY: number): { x: number; y: number } {
  return {
    x: gridX * (TERRITORY_PX + TERRITORY_GAP),
    y: gridY * (TERRITORY_PX + TERRITORY_GAP),
  };
}

export function generateTerritoryBuildings(islandId: number, gridX: number, gridY: number): Building[] {
  const origin = getIslandOrigin(gridX, gridY);
  const buildings: Building[] = [];

  switch (islandId) {
    case 0: // 중심 마을 (Capital Village): 본성 + 주민 가옥들 + 수호 망루
      buildings.push({
        id: 'b_0_castle',
        type: 'castle',
        name: '왕국 본성 (Kingdom Castle)',
        x: origin.x + 160,
        y: origin.y + 40,
        width: 320,
        height: 256,
        islandId,
      });
      buildings.push({
        id: 'b_0_house1',
        type: 'house1',
        name: '주민 가옥 1',
        x: origin.x + 24,
        y: origin.y + 220,
        width: 128,
        height: 192,
        islandId,
      });
      buildings.push({
        id: 'b_0_house2',
        type: 'house2',
        name: '주민 가옥 2',
        x: origin.x + 24,
        y: origin.y + 420,
        width: 128,
        height: 192,
        islandId,
      });
      buildings.push({
        id: 'b_0_tower',
        type: 'tower',
        name: '동쪽 수호 망루',
        x: origin.x + 488,
        y: origin.y + 180,
        width: 128,
        height: 256,
        islandId,
      });
      break;

    case 1: // 동쪽 벌목 평원 (East Woods)
      buildings.push({
        id: 'b_1_lumberjack',
        type: 'house1',
        name: '벌목꾼 오두막',
        x: origin.x + 40,
        y: origin.y + 60,
        width: 128,
        height: 192,
        islandId,
      });
      buildings.push({
        id: 'b_1_storage',
        type: 'house2',
        name: '목재 저장소',
        x: origin.x + 40,
        y: origin.y + 360,
        width: 128,
        height: 192,
        islandId,
      });
      break;

    case 2: // 남쪽 채석 평원 (South Quarry)
      buildings.push({
        id: 'b_2_stonemason',
        type: 'house2',
        name: '석공 작업장',
        x: origin.x + 40,
        y: origin.y + 60,
        width: 128,
        height: 192,
        islandId,
      });
      buildings.push({
        id: 'b_2_tower',
        type: 'tower',
        name: '채석장 감시탑',
        x: origin.x + 460,
        y: origin.y + 80,
        width: 128,
        height: 256,
        islandId,
      });
      break;

    case 3: // 서쪽 황금 평원 (West Goldfields)
      buildings.push({
        id: 'b_3_smelter',
        type: 'barracks',
        name: '황금 제련소',
        x: origin.x + 160,
        y: origin.y + 60,
        width: 192,
        height: 256,
        islandId,
      });
      break;

    case 4: // 북쪽 수호탑 언덕 (North Citadel Hill)
      buildings.push({
        id: 'b_4_archery',
        type: 'archery',
        name: '북방 궁수 훈련소',
        x: origin.x + 60,
        y: origin.y + 60,
        width: 192,
        height: 256,
        islandId,
      });
      buildings.push({
        id: 'b_4_tower',
        type: 'tower',
        name: '북방 수호 대탑',
        x: origin.x + 460,
        y: origin.y + 60,
        width: 128,
        height: 256,
        islandId,
      });
      break;

    case 5: // 남동쪽 풍요의 과수원 (Southeast Orchard)
      buildings.push({
        id: 'b_5_farm',
        type: 'house3',
        name: '과수원 농가',
        x: origin.x + 60,
        y: origin.y + 60,
        width: 128,
        height: 192,
        islandId,
      });
      break;

    case 6: // 남서쪽 흑요석 광산 (Southwest Obsidian Mine)
      buildings.push({
        id: 'b_6_mine_camp',
        type: 'barracks',
        name: '흑요석 광산 주둔지',
        x: origin.x + 60,
        y: origin.y + 60,
        width: 192,
        height: 256,
        islandId,
      });
      break;

    case 7: // 북동쪽 에메랄드 숲 (Northeast Emerald Grove)
      buildings.push({
        id: 'b_7_lodge',
        type: 'archery',
        name: '에메랄드 순찰대 산장',
        x: origin.x + 60,
        y: origin.y + 60,
        width: 192,
        height: 256,
        islandId,
      });
      break;

    case 8: // 북서쪽 고대 유적지 (Northwest Ancient Ruins)
      buildings.push({
        id: 'b_8_monastery',
        type: 'monastery',
        name: '고대 성소 유적',
        x: origin.x + 140,
        y: origin.y + 40,
        width: 192,
        height: 320,
        islandId,
      });
      break;

    case 16: // 남서 국경 요새
      buildings.push({
        id: 'b_16_fortress',
        type: 'castle',
        name: '국경 요새 사령부',
        x: origin.x + 160,
        y: origin.y + 40,
        width: 320,
        height: 256,
        islandId,
      });
      break;

    default:
      if (islandId % 3 === 0) {
        buildings.push({
          id: `b_${islandId}_tower`,
          type: 'tower',
          name: '국경 수호탑',
          x: origin.x + 460,
          y: origin.y + 80,
          width: 128,
          height: 256,
          islandId,
        });
      } else if (islandId % 3 === 1) {
        buildings.push({
          id: `b_${islandId}_house`,
          type: 'house1',
          name: '개척민 주택',
          x: origin.x + 60,
          y: origin.y + 80,
          width: 128,
          height: 192,
          islandId,
        });
      }
      break;
  }

  return buildings;
}

export interface CollisionBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function getBuildingCollisionBox(b: Building): CollisionBox {
  switch (b.type) {
    case 'castle':
      // Solid walls on sides and back, leaving entrance step walkable
      return { x: b.x + 24, y: b.y + 110, w: b.width - 48, h: 100 };
    case 'house1':
    case 'house2':
    case 'house3':
      return { x: b.x + 16, y: b.y + 80, w: b.width - 32, h: 90 };
    case 'tower':
      return { x: b.x + 24, y: b.y + 140, w: b.width - 48, h: 90 };
    case 'barracks':
    case 'archery':
      return { x: b.x + 24, y: b.y + 120, w: b.width - 48, h: 110 };
    case 'monastery':
      return { x: b.x + 24, y: b.y + 150, w: b.width - 48, h: 130 };
    default:
      return { x: b.x + 16, y: b.y + 80, w: b.width - 32, h: 80 };
  }
}

export function generateIslandEntities(islandId: number, gridX: number, gridY: number): Entity[] {
  const origin = getIslandOrigin(gridX, gridY);
  const entities: Entity[] = [];

  const addTree = (idSuffix: string, relX: number, relY: number) => {
    entities.push({
      id: `t_${islandId}_${idSuffix}`,
      type: 'tree',
      x: origin.x + relX,
      y: origin.y + relY,
      hp: 3,
      maxHp: 3,
      islandId,
    });
  };

  const addRock = (idSuffix: string, relX: number, relY: number) => {
    entities.push({
      id: `r_${islandId}_${idSuffix}`,
      type: 'rock',
      x: origin.x + relX,
      y: origin.y + relY,
      hp: 4,
      maxHp: 4,
      islandId,
    });
  };

  const addGoldRock = (idSuffix: string, relX: number, relY: number) => {
    entities.push({
      id: `g_${islandId}_${idSuffix}`,
      type: 'gold_rock',
      x: origin.x + relX,
      y: origin.y + relY,
      hp: 5,
      maxHp: 5,
      islandId,
    });
  };

  const addSheep = (idSuffix: string, relX: number, relY: number) => {
    entities.push({
      id: `s_${islandId}_${idSuffix}`,
      type: 'sheep',
      x: origin.x + relX,
      y: origin.y + relY,
      hp: 3,
      maxHp: 3,
      islandId,
    });
  };

  switch (islandId) {
    case 0: // 중심 마을 (Capital Village): 균형 잡힌 자원 + 귀여운 양들
      addTree('1', 490, 480);
      addTree('2', 430, 530);
      addTree('3', 180, 530);
      addRock('1', 500, 80);
      addRock('2', 550, 130);
      addGoldRock('1', 180, 340);
      addSheep('1', 290, 490);
      addSheep('2', 360, 510);
      break;

    case 1: // 동쪽 벌목 평원 (East Woods): 풍부한 목재
      addTree('1', 220, 160);
      addTree('2', 360, 150);
      addTree('3', 500, 180);
      addTree('4', 220, 360);
      addTree('5', 380, 380);
      addTree('6', 520, 390);
      addTree('7', 350, 520);
      addRock('1', 220, 500);
      break;

    case 2: // 남쪽 채석 평원 (South Quarry): 풍부한 석재와 광석
      addRock('1', 220, 150);
      addRock('2', 350, 160);
      addRock('3', 200, 340);
      addRock('4', 350, 360);
      addRock('5', 500, 380);
      addGoldRock('1', 480, 500);
      addTree('1', 220, 500);
      addSheep('1', 350, 510);
      break;

    case 3: // 서쪽 황금 평원 (West Goldfields): 풍부한 황금 노드
      addGoldRock('1', 100, 180);
      addGoldRock('2', 480, 180);
      addGoldRock('3', 200, 420);
      addGoldRock('4', 380, 440);
      addRock('1', 480, 380);
      addTree('1', 120, 480);
      break;

    case 4: // 북쪽 수호탑 언덕 (North Citadel Hill)
      addGoldRock('1', 260, 240);
      addGoldRock('2', 380, 240);
      addRock('1', 260, 420);
      addTree('1', 140, 460);
      addTree('2', 480, 460);
      break;

    case 5: // 남동쪽 풍요의 과수원 (Southeast Orchard)
      addTree('1', 240, 160);
      addTree('2', 400, 160);
      addTree('3', 520, 180);
      addTree('4', 240, 360);
      addTree('5', 420, 380);
      addSheep('1', 260, 480);
      addSheep('2', 340, 520);
      addSheep('3', 440, 500);
      addGoldRock('1', 520, 500);
      break;

    case 6: // 남서쪽 흑요석 광산 (Southwest Obsidian Mine)
      addRock('1', 300, 140);
      addRock('2', 480, 160);
      addRock('3', 180, 360);
      addRock('4', 340, 380);
      addGoldRock('1', 500, 380);
      addGoldRock('2', 280, 500);
      addTree('1', 120, 500);
      break;

    case 7: // 북동쪽 에메랄드 숲 (Northeast Emerald Grove)
      addTree('1', 300, 160);
      addTree('2', 480, 160);
      addTree('3', 180, 360);
      addTree('4', 340, 380);
      addTree('5', 500, 390);
      addGoldRock('1', 260, 500);
      addRock('1', 420, 500);
      break;

    case 8: // 북서쪽 고대 유적지 (Northwest Ancient Ruins)
      addGoldRock('1', 80, 180);
      addGoldRock('2', 460, 180);
      addGoldRock('3', 140, 440);
      addRock('1', 340, 440);
      addRock('2', 480, 440);
      addTree('1', 240, 520);
      break;

    case 9: // 극동의 거목림 평원
      addTree('1', 160, 160);
      addTree('2', 320, 160);
      addTree('3', 480, 160);
      addTree('4', 180, 340);
      addTree('5', 360, 340);
      addTree('6', 500, 360);
      addTree('7', 240, 500);
      addRock('1', 420, 500);
      break;

    case 10: // 남쪽 화강암 절벽
      addRock('1', 160, 160);
      addRock('2', 340, 160);
      addRock('3', 500, 160);
      addRock('4', 180, 360);
      addRock('5', 460, 360);
      addGoldRock('1', 300, 360);
      addGoldRock('2', 320, 500);
      addTree('1', 160, 500);
      break;

    case 11: // 극서 태양의 금광
      addGoldRock('1', 160, 160);
      addGoldRock('2', 480, 160);
      addGoldRock('3', 200, 360);
      addGoldRock('4', 440, 360);
      addGoldRock('5', 320, 240);
      addRock('1', 180, 500);
      addTree('1', 460, 500);
      break;

    case 12: // 천공의 별빛 성소
      addGoldRock('1', 200, 200);
      addGoldRock('2', 440, 200);
      addGoldRock('3', 320, 460);
      addRock('1', 160, 360);
      addRock('2', 480, 360);
      addTree('1', 180, 500);
      addTree('2', 460, 500);
      break;

    default:
      // Fallback
      addTree('1', 180, 180);
      addTree('2', 460, 180);
      addRock('1', 180, 460);
      addGoldRock('1', 460, 460);
      addSheep('1', 320, 320);
      break;
  }

  return entities;
}
