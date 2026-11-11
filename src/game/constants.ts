import { Island, Entity, BuildingType, VillageTier, Building } from '../types/game';

export const TILE_SIZE = 64;
export const ISLAND_TILES = 8; // 8x8 tiles per territory (512x512 px)
export const ISLAND_PX = TILE_SIZE * ISLAND_TILES;
export const ISLAND_GAP = 0; // 광활하게 이어지는 육지 영토 (바다 섬이 아닌 대륙 마을 단위)

// 건물 정의 (방책, 성벽, 화살타워, 대포타워)
export interface BuildingDef {
  type: BuildingType;
  name: string;
  costWood: number;
  costStone: number;
  costGold: number;
  hp: number;
  range: number;
  damage: number;
  attackCooldown: number;
  description: string;
}

export const BUILDING_DEFS: Record<BuildingType, BuildingDef> = {
  fence: {
    type: 'fence',
    name: '나무 방책',
    costWood: 5,
    costStone: 0,
    costGold: 0,
    hp: 80,
    range: 0,
    damage: 0,
    attackCooldown: 0,
    description: '적의 이동을 막는 기초 목재 방책',
  },
  wall: {
    type: 'wall',
    name: '석재 성벽',
    costWood: 0,
    costStone: 12,
    costGold: 0,
    hp: 250,
    range: 0,
    damage: 0,
    attackCooldown: 0,
    description: '단단하여 마물의 공격을 오래 버티는 성벽',
  },
  arrow_tower: {
    type: 'arrow_tower',
    name: '화살 타워',
    costWood: 15,
    costStone: 10,
    costGold: 0,
    hp: 120,
    range: 200,
    damage: 18,
    attackCooldown: 900,
    description: '접근하는 마물에게 자동으로 화살을 난사',
  },
  cannon_tower: {
    type: 'cannon_tower',
    name: '대포 타워',
    costWood: 5,
    costStone: 30,
    costGold: 8,
    hp: 200,
    range: 260,
    damage: 55,
    attackCooldown: 2200,
    description: '강력한 포탄으로 광역 피해를 주는 방어 포탑',
  },
};

// 마을 등급 설정 (이름, 승급비용, 설명)
export const VILLAGE_TIER_CONFIG: Record<
  VillageTier,
  {
    name: string;
    nextTier?: VillageTier;
    upgradeCost?: { wood: number; stone: number; gold: number };
    maxCoreHp: number;
    buffDescription: string;
  }
> = {
  outpost: {
    name: '전초 야영지',
    nextTier: 'small_village',
    upgradeCost: { wood: 20, stone: 15, gold: 0 },
    maxCoreHp: 300,
    buffDescription: '기초적인 방어 타워 배치 가능',
  },
  small_village: {
    name: '중소마을 (기본 수도)',
    nextTier: 'large_village',
    upgradeCost: { wood: 45, stone: 35, gold: 5 },
    maxCoreHp: 500,
    buffDescription: '체력 재생 및 기본 목재 방책 지원',
  },
  large_village: {
    name: '큰마을',
    nextTier: 'small_city',
    upgradeCost: { wood: 80, stone: 70, gold: 15 },
    maxCoreHp: 750,
    buffDescription: '주변 타워 공격력 +15% 증가',
  },
  small_city: {
    name: '소도시',
    nextTier: 'mid_city',
    upgradeCost: { wood: 130, stone: 120, gold: 30 },
    maxCoreHp: 1100,
    buffDescription: '주변 타워 사거리 +20% 증가',
  },
  mid_city: {
    name: '중소도시',
    nextTier: 'metropolis',
    upgradeCost: { wood: 200, stone: 180, gold: 50 },
    maxCoreHp: 1600,
    buffDescription: '마을 방어막(Shield) 활성화',
  },
  metropolis: {
    name: '대도시 (최종)',
    maxCoreHp: 2500,
    buffDescription: '전 구역 공격력 +30% 및 공성 대포 해금',
  },
};

export const INITIAL_ISLANDS: Island[] = [
  // 1. 시작 및 중앙 허브 (중심 수도 마을: 중소마을 등급, 코어 보석 활성화, 방책 보유)
  {
    id: 0,
    gridX: 0,
    gridY: 0,
    costWood: 0,
    costStone: 0,
    costGold: 0,
    unlocked: true,
    isCoreActive: true,
    coreHp: 500,
    maxCoreHp: 500,
    tier: 'small_village',
    isCapital: true,
    name: '중심 수도 마을 (Capital Village)',
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
    isCoreActive: false,
    coreHp: 300,
    maxCoreHp: 300,
    tier: 'outpost',
    isCapital: false,
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

  // 3. 2차 확장 (대각선 인접 섬 - 3x3 중심부 완성)
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
    name: '극동의 거목림 (Far East Redwood)',
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
    name: '천공의 별빛 제단 (Celestial Star Altar)',
  },

  // 5. 4차 확장 (외곽 군도 링)
  {
    id: 13,
    gridX: 2,
    gridY: 1,
    costWood: 55,
    costStone: 40,
    costGold: 12,
    unlocked: false,
    name: '동남쪽 밀수꾼의 코브 (Smuggler Cove)',
  },
  {
    id: 14,
    gridX: 1,
    gridY: 2,
    costWood: 50,
    costStone: 50,
    costGold: 12,
    unlocked: false,
    name: '남동 산호 암초섬 (Coral Reef Isle)',
  },
  {
    id: 15,
    gridX: -1,
    gridY: 2,
    costWood: 52,
    costStone: 48,
    costGold: 15,
    unlocked: false,
    name: '남서 거북 바위섬 (Turtle Shell Isle)',
  },
  {
    id: 16,
    gridX: -2,
    gridY: 1,
    costWood: 65,
    costStone: 55,
    costGold: 22,
    unlocked: false,
    name: '남서 해적 요새 (Pirate Fortress)',
  },
  {
    id: 17,
    gridX: 2,
    gridY: -1,
    costWood: 60,
    costStone: 40,
    costGold: 18,
    unlocked: false,
    name: '북동 바람개비 언덕 (Breeze Windmill Isle)',
  },
  {
    id: 18,
    gridX: 1,
    gridY: -2,
    costWood: 68,
    costStone: 50,
    costGold: 22,
    unlocked: false,
    name: '북동 오로라 관측소 (Aurora Observatory)',
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
    name: '서북 그림자 봉우리 (Shadow Peak Isle)',
  },
].map((item): Island => {
  const isCapital = item.id === 0;
  return {
    ...item,
    tier: isCapital ? 'small_village' : ((item.tier as VillageTier) || 'outpost'),
    isCapital,
    isCoreActive: isCapital ? true : (item.isCoreActive ?? false),
    coreHp: isCapital ? 500 : (item.coreHp ?? 300),
    maxCoreHp: isCapital ? 500 : (item.maxCoreHp ?? 300),
  };
});

// 초기 중심 마을(Capital) 외곽 둘레에 설치되는 목재 성벽 방책들 (기획안: 중심 마을 외곽에 나무 방책 배치)
export const INITIAL_CAPITAL_BUILDINGS: Building[] = (() => {
  const buildings: Building[] = [];
  const coords: { x: number; y: number }[] = [];

  // 북쪽 외곽선 (y = 48) - 중앙 256 부근은 출입구로 개방
  for (let x = 48; x <= 464; x += 32) {
    if (x >= 224 && x <= 288) continue; // 북문 개방
    coords.push({ x, y: 48 });
  }

  // 남쪽 외곽선 (y = 464) - 남문 개방
  for (let x = 48; x <= 464; x += 32) {
    if (x >= 224 && x <= 288) continue; // 남문 개방
    coords.push({ x, y: 464 });
  }

  // 서쪽 외곽선 (x = 48) - 서문 개방
  for (let y = 80; y <= 432; y += 32) {
    if (y >= 224 && y <= 288) continue; // 서문 개방
    coords.push({ x: 48, y });
  }

  // 동쪽 외곽선 (x = 464) - 동문 개방
  for (let y = 80; y <= 432; y += 32) {
    if (y >= 224 && y <= 288) continue; // 동문 개방
    coords.push({ x: 464, y });
  }

  coords.forEach((c, idx) => {
    buildings.push({
      id: `cap_fence_${idx}`,
      type: 'fence',
      x: c.x,
      y: c.y,
      hp: 120,
      maxHp: 120,
      territoryId: 0,
      range: 0,
      damage: 0,
      attackCooldown: 0,
      lastAttackTime: 0,
    });
  });

  // 4개 모서리에 초기 목재 화살 타워 2개 기본 배치 (방어선 구축)
  buildings.push({
    id: 'cap_tower_nw',
    type: 'arrow_tower',
    x: 80,
    y: 80,
    hp: 150,
    maxHp: 150,
    territoryId: 0,
    range: 220,
    damage: 18,
    attackCooldown: 900,
    lastAttackTime: 0,
  });

  buildings.push({
    id: 'cap_tower_se',
    type: 'arrow_tower',
    x: 432,
    y: 432,
    hp: 150,
    maxHp: 150,
    territoryId: 0,
    range: 220,
    damage: 18,
    attackCooldown: 900,
    lastAttackTime: 0,
  });

  return buildings;
})();

export function getIslandOrigin(gridX: number, gridY: number): { x: number; y: number } {
  return {
    x: gridX * (ISLAND_PX + ISLAND_GAP),
    y: gridY * (ISLAND_PX + ISLAND_GAP),
  };
}

export function generateIslandEntities(islandId: number, gridX: number, gridY: number): Entity[] {
  const origin = getIslandOrigin(gridX, gridY);
  const entities: Entity[] = [];

  // Helper function to push entity safely within the island (margin 100~400)
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

  // 각 영토의 중심에 수호 코어 보석 배치 (256, 256)
  entities.push({
    id: `c_${islandId}_core`,
    type: 'core_gem',
    x: origin.x + 256,
    y: origin.y + 256,
    hp: islandId === 0 ? 500 : 300,
    maxHp: islandId === 0 ? 500 : 300,
    islandId,
  });

  switch (islandId) {
    case 0: // Starting Isle: Balanced
      addTree('1', 120, 140);
      addTree('2', 360, 160);
      addTree('3', 160, 360);
      addRock('1', 380, 340);
      addRock('2', 260, 240);
      break;

    case 1: // East Woods: Tree galore
      addTree('1', 130, 140);
      addTree('2', 260, 150);
      addTree('3', 380, 180);
      addTree('4', 180, 340);
      addTree('5', 340, 350);
      addRock('1', 260, 260);
      break;

    case 2: // South Quarry: Stone & Gold
      addRock('1', 140, 150);
      addRock('2', 350, 160);
      addRock('3', 160, 340);
      addGoldRock('1', 360, 350);
      addTree('1', 250, 240);
      break;

    case 3: // West Gold Isle: Gold rocks
      addGoldRock('1', 150, 150);
      addGoldRock('2', 350, 150);
      addGoldRock('3', 250, 320);
      addTree('1', 140, 320);
      addRock('1', 360, 320);
      break;

    case 4: // Crown Sanctuary
      addGoldRock('1', 200, 200);
      addGoldRock('2', 320, 200);
      addRock('1', 260, 140);
      addTree('1', 150, 340);
      addTree('2', 360, 340);
      break;

    case 5: // Southeast Orchard: Dense wood & small gold
      addTree('1', 140, 140);
      addTree('2', 260, 140);
      addTree('3', 370, 150);
      addTree('4', 160, 340);
      addTree('5', 350, 340);
      addRock('1', 260, 250);
      addGoldRock('1', 260, 350);
      break;

    case 6: // Southwest Obsidian Mine: Heavy stone & gold
      addRock('1', 140, 140);
      addRock('2', 360, 150);
      addRock('3', 260, 220);
      addRock('4', 150, 350);
      addGoldRock('1', 350, 340);
      addGoldRock('2', 260, 360);
      addTree('1', 140, 240);
      break;

    case 7: // Northeast Emerald Grove: Dense wood & gold
      addTree('1', 130, 130);
      addTree('2', 260, 150);
      addTree('3', 380, 140);
      addTree('4', 160, 350);
      addTree('5', 360, 360);
      addGoldRock('1', 250, 250);
      addRock('1', 360, 250);
      break;

    case 8: // Northwest Ancient Ruins: Rich gold & stone
      addGoldRock('1', 150, 150);
      addGoldRock('2', 350, 150);
      addGoldRock('3', 250, 340);
      addRock('1', 150, 330);
      addRock('2', 350, 330);
      addRock('3', 260, 200);
      addTree('1', 140, 240);
      addTree('2', 370, 240);
      break;

    case 9: // Far East Redwood Forest: Giant lumberjack haven
      addTree('1', 120, 130);
      addTree('2', 240, 140);
      addTree('3', 360, 140);
      addTree('4', 140, 260);
      addTree('5', 360, 270);
      addTree('6', 180, 370);
      addTree('7', 330, 370);
      addRock('1', 250, 360);
      break;

    case 10: // Deep South Granite Cliffs: Heavy stone
      addRock('1', 130, 140);
      addRock('2', 260, 140);
      addRock('3', 370, 150);
      addRock('4', 140, 340);
      addRock('5', 360, 340);
      addGoldRock('1', 260, 250);
      addGoldRock('2', 260, 360);
      addTree('1', 140, 240);
      break;

    case 11: // Far West Sunforge: Pure gold motherlode
      addGoldRock('1', 140, 140);
      addGoldRock('2', 360, 140);
      addGoldRock('3', 180, 340);
      addGoldRock('4', 330, 340);
      addGoldRock('5', 260, 240);
      addRock('1', 150, 240);
      addTree('1', 360, 240);
      break;

    case 12: // Celestial Star Altar: Sacred balance & high gold
      addGoldRock('1', 180, 180);
      addGoldRock('2', 330, 180);
      addGoldRock('3', 260, 350);
      addRock('1', 140, 280);
      addRock('2', 370, 280);
      addTree('1', 140, 140);
      addTree('2', 370, 140);
      addTree('3', 260, 130);
      break;

    case 13: // Smuggler's Cove: Mixed high tier
      addTree('1', 140, 140);
      addTree('2', 360, 150);
      addTree('3', 150, 340);
      addTree('4', 350, 350);
      addGoldRock('1', 260, 170);
      addGoldRock('2', 260, 330);
      addRock('1', 260, 250);
      break;

    case 14: // Coral Reef Isle: Sea rocks & coral
      addRock('1', 140, 140);
      addRock('2', 360, 140);
      addRock('3', 150, 350);
      addRock('4', 360, 350);
      addGoldRock('1', 260, 200);
      addGoldRock('2', 260, 320);
      addTree('1', 140, 240);
      addTree('2', 370, 240);
      break;

    case 15: // Turtle Shell Isle: Durable stones
      addRock('1', 150, 150);
      addRock('2', 260, 140);
      addRock('3', 360, 150);
      addRock('4', 160, 330);
      addRock('5', 350, 330);
      addGoldRock('1', 260, 250);
      addTree('1', 140, 240);
      addTree('2', 370, 240);
      break;

    case 16: // Pirate Fortress: Massive gold stockpile
      addGoldRock('1', 150, 150);
      addGoldRock('2', 350, 150);
      addGoldRock('3', 200, 260);
      addGoldRock('4', 310, 260);
      addRock('1', 150, 350);
      addRock('2', 360, 350);
      addTree('1', 260, 350);
      break;

    case 17: // Breeze Windmill Isle: Wind trees & gold
      addTree('1', 140, 140);
      addTree('2', 260, 130);
      addTree('3', 370, 140);
      addTree('4', 160, 340);
      addTree('5', 360, 340);
      addGoldRock('1', 260, 240);
      addGoldRock('2', 260, 350);
      addRock('1', 140, 240);
      break;

    case 18: // Aurora Observatory: Mysterious crystals & trees
      addGoldRock('1', 150, 160);
      addGoldRock('2', 360, 160);
      addGoldRock('3', 260, 260);
      addRock('1', 160, 340);
      addRock('2', 360, 340);
      addTree('1', 260, 140);
      addTree('2', 140, 250);
      addTree('3', 370, 250);
      break;

    case 19: // Moonlight Valley: Hidden valley
      addRock('1', 140, 140);
      addRock('2', 360, 140);
      addRock('3', 260, 180);
      addGoldRock('1', 160, 330);
      addGoldRock('2', 350, 330);
      addGoldRock('3', 260, 340);
      addTree('1', 140, 240);
      addTree('2', 370, 240);
      break;

    case 20: // Shadow Peak Isle: Grand finale isle
      addGoldRock('1', 150, 150);
      addGoldRock('2', 360, 150);
      addGoldRock('3', 180, 330);
      addGoldRock('4', 330, 330);
      addRock('1', 260, 160);
      addRock('2', 260, 340);
      addTree('1', 140, 240);
      addTree('2', 370, 240);
      break;

    default:
      // Fallback procedural placement
      addTree('1', 150, 150);
      addTree('2', 350, 150);
      addRock('1', 150, 350);
      addGoldRock('1', 350, 350);
      addRock('2', 256, 256);
      break;
  }

  return entities;
}
