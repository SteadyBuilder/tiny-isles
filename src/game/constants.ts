import {
  Island,
  Entity,
  Building,
  TerritoryCore,
  VillageTier,
  VillageTierConfig,
  ConstructableBlueprint,
  ConstructedBuilding,
  ConstructableType,
} from '../types/game';

export const TILE_SIZE = 64;
export const TERRITORY_TILES = 10; // 10x10 tiles per territory (640x640 px)
export const ISLAND_TILES = TERRITORY_TILES;
export const TERRITORY_PX = TILE_SIZE * TERRITORY_TILES; // 640px
export const TERRITORY_GAP = TERRITORY_PX; // 640px gap between villages (doubles center-to-center distance to 1280px)
export const ISLAND_GAP = TERRITORY_GAP;
export const TERRITORY_STEP = TERRITORY_PX + TERRITORY_GAP; // 1280px (2x distance between villages)
export const ISLAND_STEP = TERRITORY_STEP;

// 현실 시간 기준 웨이브 주기
export const REGULAR_WAVE_INTERVAL_SEC = 30 * 60; // 30분 (1,800초) 마다 좀비, 스켈레톤 등 마물 침공
export const BOSS_WAVE_INTERVAL_SEC = 60 * 60; // 60분 (3,600초) 마다 보스몬스터 출현

// 마을 발전 단계 정의 (점령지 -> 마을 -> 중소마을 -> 큰마을 -> 소도시 -> 중소도시 -> 대도시)
export const VILLAGE_TIER_CONFIGS: Record<VillageTier, VillageTierConfig> = {
  0: {
    tier: 0,
    name: '점령지',
    badge: '🚩 점령지 (마을 미건설)',
    coreMaxHp: 120,
    maxBuildings: 3,
    costWood: 0,
    costStone: 0,
    costGold: 0,
    passiveWood: 0,
    passiveStone: 0,
    passiveGold: 0,
    description: '새로 점령한 영지입니다. 마을을 세워 거점을 구축하세요.',
  },
  1: {
    tier: 1,
    name: '개척마을',
    badge: '🏡 개척마을',
    coreMaxHp: 220,
    maxBuildings: 5,
    costWood: 15,
    costStone: 10,
    costGold: 0,
    passiveWood: 1,
    passiveStone: 1,
    passiveGold: 0,
    description: '점령한 땅에 세워진 개척 마을입니다. 기본적인 방어와 건설이 가능합니다.',
  },
  2: {
    tier: 2,
    name: '중소마을',
    badge: '🏘️ 중소마을',
    coreMaxHp: 350,
    maxBuildings: 7,
    costWood: 25,
    costStone: 20,
    costGold: 5,
    passiveWood: 2,
    passiveStone: 2,
    passiveGold: 1,
    description: '안정적인 중소마을입니다. 중심 마을의 기본 시작 단계입니다.',
  },
  3: {
    tier: 3,
    name: '큰마을',
    badge: '🏛️ 큰마을',
    coreMaxHp: 550,
    maxBuildings: 9,
    costWood: 40,
    costStone: 35,
    costGold: 15,
    passiveWood: 3,
    passiveStone: 3,
    passiveGold: 2,
    description: '인구와 생산력이 크게 늘어난 큰마을입니다.',
  },
  4: {
    tier: 4,
    name: '소도시',
    badge: '🏰 소도시',
    coreMaxHp: 800,
    maxBuildings: 11,
    costWood: 65,
    costStone: 55,
    costGold: 30,
    passiveWood: 5,
    passiveStone: 4,
    passiveGold: 3,
    description: '체계적인 방어선과 상권을 갖춘 소도시입니다.',
  },
  5: {
    tier: 5,
    name: '중소도시',
    badge: '🏯 중소도시',
    coreMaxHp: 1150,
    maxBuildings: 13,
    costWood: 95,
    costStone: 80,
    costGold: 50,
    passiveWood: 7,
    passiveStone: 6,
    passiveGold: 5,
    description: '강력한 요새와 풍성한 자원을 생산하는 중소도시입니다.',
  },
  6: {
    tier: 6,
    name: '대도시',
    badge: '👑 대도시',
    coreMaxHp: 1600,
    maxBuildings: 16,
    costWood: 140,
    costStone: 120,
    costGold: 80,
    passiveWood: 10,
    passiveStone: 9,
    passiveGold: 8,
    description: '왕국 최고 단계로 발전한 난공불락의 대도시입니다!',
  },
};

export const VILLAGE_PROGRESSION_TEXT =
  '점령지 → 개척마을 → 중소마을 → 큰마을 → 소도시 → 중소도시 → 대도시';

// 건설 가능한 건물 도감 (방어 타워, 성벽, 기본건물, 특수건물)
export const CONSTRUCTABLE_BLUEPRINTS: ConstructableBlueprint[] = [
  // 1. 방어 타워 (Defense Towers)
  {
    type: 'arrow_tower',
    category: 'tower',
    categoryLabel: '방어 타워',
    name: '궁수 방어 타워',
    icon: '🏹',
    spriteKey: 'tower',
    costWood: 15,
    costStone: 10,
    costGold: 0,
    maxHp: 240,
    attack: 22,
    range: 270,
    fireRateMs: 900,
    description: '사거리 내의 좀비, 스켈레톤 등 마물을 자동으로 조준 사격합니다.',
  },
  {
    type: 'magic_tower',
    category: 'tower',
    categoryLabel: '방어 타워',
    name: '마법 포격 타워',
    icon: '🔮',
    spriteKey: 'tower',
    costWood: 25,
    costStone: 25,
    costGold: 8,
    maxHp: 320,
    attack: 45,
    range: 310,
    fireRateMs: 1200,
    description: '강력한 마법 탄환을 발사하여 마물과 보스에게 큰 피해를 입힙니다.',
  },

  // 2. 성벽 (Walls & Palisades)
  {
    type: 'wood_wall',
    category: 'wall',
    categoryLabel: '성벽',
    name: '나무 방책',
    icon: '🪵',
    spriteKey: 'woodPalisade',
    costWood: 10,
    costStone: 4,
    costGold: 0,
    maxHp: 280,
    description: '마을 외곽을 둘러싸 마물의 진입을 저지하는 튼튼한 나무 방책입니다.',
  },
  {
    type: 'stone_wall',
    category: 'wall',
    categoryLabel: '성벽',
    name: '석조 성벽',
    icon: '🧱',
    spriteKey: 'castle',
    costWood: 15,
    costStone: 25,
    costGold: 5,
    maxHp: 650,
    description: '높은 내구도로 마물 웨이브와 보스의 공격을 견뎌내는 석조 성벽입니다.',
  },

  // 3. 기본건물 (Basic Buildings)
  {
    type: 'basic_house',
    category: 'basic',
    categoryLabel: '기본건물',
    name: '주민 가옥',
    icon: '🏠',
    spriteKey: 'house2',
    costWood: 12,
    costStone: 8,
    costGold: 0,
    maxHp: 200,
    description: '마을 주민이 거주하며 주기적으로 코어 보석의 내구도를 회복(+6 HP)합니다.',
  },
  {
    type: 'lumber_camp',
    category: 'basic',
    categoryLabel: '기본건물',
    name: '벌목 작업장',
    icon: '🪓',
    spriteKey: 'house1',
    costWood: 12,
    costStone: 10,
    costGold: 0,
    maxHp: 210,
    description: '주기적으로 목재(🪵+2)를 자동 생산하는 기본 생산 건물입니다.',
  },
  {
    type: 'stone_works',
    category: 'basic',
    categoryLabel: '기본건물',
    name: '석공 작업장',
    icon: '⛏️',
    spriteKey: 'house3',
    costWood: 14,
    costStone: 12,
    costGold: 0,
    maxHp: 210,
    description: '주기적으로 석재(🪨+2)를 자동 생산하는 기본 생산 건물입니다.',
  },

  // 4. 특수건물 (Special Buildings)
  {
    type: 'special_barracks',
    category: 'special',
    categoryLabel: '특수건물',
    name: '왕국 수비대 병영',
    icon: '⚔️',
    spriteKey: 'barracks',
    costWood: 28,
    costStone: 22,
    costGold: 10,
    maxHp: 400,
    attack: 30,
    range: 250,
    fireRateMs: 1100,
    description: '영지 내 타워 공격력을 25% 강화하고 침입한 마물을 참격으로 요격합니다.',
  },
  {
    type: 'special_sanctuary',
    category: 'special',
    categoryLabel: '특수건물',
    name: '신성 치유 성소',
    icon: '✨',
    spriteKey: 'monastery',
    costWood: 25,
    costStone: 28,
    costGold: 15,
    maxHp: 380,
    description: '영지 내 코어 보석(+20 HP)과 성벽/방책(+35 HP)을 주기적으로 수리합니다.',
  },
  {
    type: 'special_goldmine',
    category: 'special',
    categoryLabel: '특수건물',
    name: '황금 연금술 공방',
    icon: '🪙',
    spriteKey: 'archery',
    costWood: 30,
    costStone: 25,
    costGold: 12,
    maxHp: 320,
    description: '주기적으로 금화(🪙+2)를 정제하여 생산하는 특수 경제 건물입니다.',
  },
];

export function getBlueprint(type: ConstructableType): ConstructableBlueprint {
  return (
    CONSTRUCTABLE_BLUEPRINTS.find((b) => b.type === type) || CONSTRUCTABLE_BLUEPRINTS[0]
  );
}

// 영지 내 슬롯 좌표 오프셋 (640x640 기준)
export const TERRITORY_BUILD_SLOTS: { relX: number; relY: number; role: 'wall' | 'inner' }[] = [
  // 외곽 방책/성벽 슬롯 (북, 남, 동, 서 방어선)
  { relX: 320, relY: 52, role: 'wall' },   // Slot 0: 북쪽 방책선
  { relX: 320, relY: 588, role: 'wall' },  // Slot 1: 남쪽 방책선
  { relX: 588, relY: 350, role: 'wall' },  // Slot 2: 동쪽 방책선
  { relX: 52, relY: 350, role: 'wall' },   // Slot 3: 서쪽 방책선
  // 마을 내부 타워/기본/특수건물 슬롯
  { relX: 490, relY: 190, role: 'inner' }, // Slot 4: 북동 타워/건물지
  { relX: 150, relY: 190, role: 'inner' }, // Slot 5: 북서 타워/건물지
  { relX: 490, relY: 490, role: 'inner' }, // Slot 6: 남동 타워/건물지
  { relX: 150, relY: 490, role: 'inner' }, // Slot 7: 남서 타워/건물지
  { relX: 460, relY: 340, role: 'inner' }, // Slot 8: 동측 내부 슬롯
  { relX: 180, relY: 340, role: 'inner' }, // Slot 9: 서측 내부 슬롯
  { relX: 320, relY: 480, role: 'inner' }, // Slot 10: 남측 광장 슬롯
  { relX: 210, relY: 110, role: 'inner' }, // Slot 11: 북서 상단 슬롯
  { relX: 430, relY: 110, role: 'inner' }, // Slot 12: 북동 상단 슬롯
  { relX: 110, relY: 260, role: 'inner' }, // Slot 13: 서단 슬롯
  { relX: 530, relY: 260, role: 'inner' }, // Slot 14: 동단 슬롯
  { relX: 320, relY: 220, role: 'inner' }, // Slot 15: 중앙 상단 슬롯
];

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

export function getTerritoryCorePos(gridX: number, gridY: number): { x: number; y: number } {
  const origin = getIslandOrigin(gridX, gridY);
  return {
    x: origin.x + 320,
    y: origin.y + 350,
  };
}

export const INITIAL_ISLANDS: Island[] = [
  // 1. 중심 마을 (처음부터 중소마을 Lv.2 이며 나무 방책이 있음)
  {
    id: 0,
    gridX: 0,
    gridY: 0,
    costWood: 0,
    costStone: 0,
    costGold: 0,
    unlocked: true,
    name: '중심 마을 (중앙 본거지)',
    isAdjacentRich: false,
    resourceRichLabel: '🏘️ 시작 중소마을 (나무 방책 보유)',
    villageTier: 2, // 처음부터 중소마을!
    coreHp: VILLAGE_TIER_CONFIGS[2].coreMaxHp,
    coreMaxHp: VILLAGE_TIER_CONFIGS[2].coreMaxHp,
  },

  // 2. 중심 마을 인접 땅 (십자 방향 - 자원이 매우 풍부함!)
  {
    id: 1,
    gridX: 1,
    gridY: 0,
    costWood: 10,
    costStone: 5,
    costGold: 0,
    unlocked: false,
    name: '동쪽 풍요의 삼림 마을터',
    isAdjacentRich: true,
    resourceRichLabel: '🌟 인접 자원 풍요지 (목재·석재 대량 분포 / 채집량 2배)',
    villageTier: 0,
    coreHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
    coreMaxHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
  },
  {
    id: 2,
    gridX: 0,
    gridY: 1,
    costWood: 16,
    costStone: 10,
    costGold: 0,
    unlocked: false,
    name: '남쪽 풍요의 채석 마을터',
    isAdjacentRich: true,
    resourceRichLabel: '🌟 인접 자원 풍요지 (석재·황금 대량 분포 / 채집량 2배)',
    villageTier: 0,
    coreHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
    coreMaxHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
  },
  {
    id: 3,
    gridX: -1,
    gridY: 0,
    costWood: 25,
    costStone: 18,
    costGold: 4,
    unlocked: false,
    name: '서쪽 풍요의 황금 마을터',
    isAdjacentRich: true,
    resourceRichLabel: '🌟 인접 자원 풍요지 (황금 광맥 집중 분포 / 채집량 2배)',
    villageTier: 0,
    coreHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
    coreMaxHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
  },
  {
    id: 4,
    gridX: 0,
    gridY: -1,
    costWood: 30,
    costStone: 25,
    costGold: 8,
    unlocked: false,
    name: '북쪽 풍요의 고원 마을터',
    isAdjacentRich: true,
    resourceRichLabel: '🌟 인접 자원 풍요지 (목재·석재·금광 복합 풍요지 / 채집량 2배)',
    villageTier: 0,
    coreHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
    coreMaxHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
  },

  // 3. 중심 마을 대각선 인접 땅 (3x3 중심권 인접 - 자원이 풍부함!)
  {
    id: 5,
    gridX: 1,
    gridY: 1,
    costWood: 22,
    costStone: 16,
    costGold: 2,
    unlocked: false,
    name: '남동쪽 풍요의 과수원 마을터',
    isAdjacentRich: true,
    resourceRichLabel: '🌟 인접 자원 풍요지 (거목 및 황금 광석 풍부 / 채집량 2배)',
    villageTier: 0,
    coreHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
    coreMaxHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
  },
  {
    id: 6,
    gridX: -1,
    gridY: 1,
    costWood: 30,
    costStone: 25,
    costGold: 5,
    unlocked: false,
    name: '남서쪽 흑요석 광산 마을터',
    isAdjacentRich: true,
    resourceRichLabel: '🌟 인접 자원 풍요지 (고밀도 암석·금광 지대 / 채집량 2배)',
    villageTier: 0,
    coreHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
    coreMaxHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
  },
  {
    id: 7,
    gridX: 1,
    gridY: -1,
    costWood: 35,
    costStone: 22,
    costGold: 6,
    unlocked: false,
    name: '북동쪽 에메랄드 숲 마을터',
    isAdjacentRich: true,
    resourceRichLabel: '🌟 인접 자원 풍요지 (고밀도 원시림·광석 지대 / 채집량 2배)',
    villageTier: 0,
    coreHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
    coreMaxHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
  },
  {
    id: 8,
    gridX: -1,
    gridY: -1,
    costWood: 45,
    costStone: 35,
    costGold: 12,
    unlocked: false,
    name: '북서쪽 고대 유적 마을터',
    isAdjacentRich: true,
    resourceRichLabel: '🌟 인접 자원 풍요지 (고대 황금 광맥 다량 분포 / 채집량 2배)',
    villageTier: 0,
    coreHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
    coreMaxHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
  },

  // 4. 외곽 확장 영지 (거리 2 십자 방향)
  {
    id: 9,
    gridX: 2,
    gridY: 0,
    costWood: 50,
    costStone: 35,
    costGold: 8,
    unlocked: false,
    name: '극동 거목림 변경 마을터',
    isAdjacentRich: false,
    resourceRichLabel: '🌲 외곽 자원 개척지 (대규모 목재 산지)',
    villageTier: 0,
    coreHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
    coreMaxHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
  },
  {
    id: 10,
    gridX: 0,
    gridY: 2,
    costWood: 45,
    costStone: 55,
    costGold: 10,
    unlocked: false,
    name: '남부 화강암 변경 마을터',
    isAdjacentRich: false,
    resourceRichLabel: '🪨 외곽 자원 개척지 (대규모 석재 산지)',
    villageTier: 0,
    coreHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
    coreMaxHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
  },
  {
    id: 11,
    gridX: -2,
    gridY: 0,
    costWood: 55,
    costStone: 45,
    costGold: 18,
    unlocked: false,
    name: '극서 태양금광 변경 마을터',
    isAdjacentRich: false,
    resourceRichLabel: '🪙 외곽 자원 개척지 (대규모 금광 산지)',
    villageTier: 0,
    coreHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
    coreMaxHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
  },
  {
    id: 12,
    gridX: 0,
    gridY: -2,
    costWood: 65,
    costStone: 50,
    costGold: 22,
    unlocked: false,
    name: '북방 별빛성소 변경 마을터',
    isAdjacentRich: false,
    resourceRichLabel: '💎 외곽 자원 개척지 (고급 광물 복합 산지)',
    villageTier: 0,
    coreHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
    coreMaxHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
  },

  // 5. 최외곽 국경 마을터 링
  {
    id: 13,
    gridX: 2,
    gridY: 1,
    costWood: 55,
    costStone: 40,
    costGold: 12,
    unlocked: false,
    name: '동남 국경 초소 마을터',
    isAdjacentRich: false,
    resourceRichLabel: '🌲 외곽 자원 개척지',
    villageTier: 0,
    coreHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
    coreMaxHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
  },
  {
    id: 14,
    gridX: 1,
    gridY: 2,
    costWood: 50,
    costStone: 50,
    costGold: 12,
    unlocked: false,
    name: '남동 평원 개척 마을터',
    isAdjacentRich: false,
    resourceRichLabel: '🪨 외곽 자원 개척지',
    villageTier: 0,
    coreHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
    coreMaxHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
  },
  {
    id: 15,
    gridX: -1,
    gridY: 2,
    costWood: 52,
    costStone: 48,
    costGold: 15,
    unlocked: false,
    name: '남서 바위언덕 마을터',
    isAdjacentRich: false,
    resourceRichLabel: '🪨 외곽 자원 개척지',
    villageTier: 0,
    coreHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
    coreMaxHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
  },
  {
    id: 16,
    gridX: -2,
    gridY: 1,
    costWood: 65,
    costStone: 55,
    costGold: 22,
    unlocked: false,
    name: '남서 국경 요새 마을터',
    isAdjacentRich: false,
    resourceRichLabel: '🪙 외곽 자원 개척지',
    villageTier: 0,
    coreHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
    coreMaxHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
  },
  {
    id: 17,
    gridX: 2,
    gridY: -1,
    costWood: 60,
    costStone: 40,
    costGold: 18,
    unlocked: false,
    name: '북동 바람언덕 마을터',
    isAdjacentRich: false,
    resourceRichLabel: '🌲 외곽 자원 개척지',
    villageTier: 0,
    coreHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
    coreMaxHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
  },
  {
    id: 18,
    gridX: 1,
    gridY: -2,
    costWood: 68,
    costStone: 50,
    costGold: 22,
    unlocked: false,
    name: '북동 오로라 관측 마을터',
    isAdjacentRich: false,
    resourceRichLabel: '🪙 외곽 자원 개척지',
    villageTier: 0,
    coreHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
    coreMaxHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
  },
  {
    id: 19,
    gridX: -1,
    gridY: -2,
    costWood: 70,
    costStone: 55,
    costGold: 25,
    unlocked: false,
    name: '북서 달빛계곡 마을터',
    isAdjacentRich: false,
    resourceRichLabel: '🪙 외곽 자원 개척지',
    villageTier: 0,
    coreHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
    coreMaxHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
  },
  {
    id: 20,
    gridX: -2,
    gridY: -1,
    costWood: 75,
    costStone: 60,
    costGold: 30,
    unlocked: false,
    name: '서북 그림자봉우리 마을터',
    isAdjacentRich: false,
    resourceRichLabel: '💎 외곽 자원 개척지',
    villageTier: 0,
    coreHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
    coreMaxHp: VILLAGE_TIER_CONFIGS[0].coreMaxHp,
  },
];

export function getIslandOrigin(gridX: number, gridY: number): { x: number; y: number } {
  return {
    x: gridX * (TERRITORY_PX + TERRITORY_GAP),
    y: gridY * (TERRITORY_PX + TERRITORY_GAP),
  };
}

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

  // 외곽에 위치한 점령 영지들 탐색 (가장 중심에서 먼 외곽 영지 우선)
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
      // 인접 방향이 미점령 상태라면 이 변은 점령지의 외곽 경계선!
      if (!unlockedSet.has(`${nx},${ny}`)) {
        // 만약 중심 마을 외에 확장한 땅이 있다면 확장한 외곽 땅에서 우선 진입하도록 가중치 부여
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

/**
 * 마을 발전 단계(VillageTier)에 따른 중심 건축물 생성
 */
export function generateTerritoryBuildings(
  islandId: number,
  gridX: number,
  gridY: number,
  villageTier: VillageTier = islandId === 0 ? 2 : 0
): Building[] {
  const origin = getIslandOrigin(gridX, gridY);
  const buildings: Building[] = [];
  const tierInfo = VILLAGE_TIER_CONFIGS[villageTier];

  if (villageTier === 0) {
    // 마을 건설 전 (점령지 상태): 작은 개척 막사만 있거나 비어있음
    return buildings;
  }

  if (villageTier === 1) {
    // 1단계: 마을
    buildings.push({
      id: `b_${islandId}_hall_lv1`,
      type: 'house1',
      name: `${tierInfo.badge} 회관`,
      x: origin.x + 256,
      y: origin.y + 90,
      width: 128,
      height: 192,
      islandId,
    });
  } else if (villageTier === 2) {
    // 2단계: 중소마을 (중심 마을 초기 상태!)
    buildings.push({
      id: `b_${islandId}_hall_lv2`,
      type: islandId === 0 ? 'castle' : 'house2',
      name: islandId === 0 ? '중심 중소마을 본관' : `${tierInfo.badge} 중심회관`,
      x: origin.x + (islandId === 0 ? 160 : 256),
      y: origin.y + (islandId === 0 ? 45 : 85),
      width: islandId === 0 ? 320 : 128,
      height: islandId === 0 ? 240 : 192,
      islandId,
    });
    buildings.push({
      id: `b_${islandId}_sub_lv2`,
      type: 'house1',
      name: '중소마을 민가',
      x: origin.x + 60,
      y: origin.y + 180,
      width: 120,
      height: 180,
      islandId,
    });
  } else if (villageTier === 3) {
    // 3단계: 큰마을
    buildings.push({
      id: `b_${islandId}_hall_lv3`,
      type: 'castle',
      name: `${tierInfo.badge} 영주관`,
      x: origin.x + 160,
      y: origin.y + 45,
      width: 320,
      height: 240,
      islandId,
    });
    buildings.push({
      id: `b_${islandId}_sub1_lv3`,
      type: 'house2',
      name: '큰마을 상점가',
      x: origin.x + 50,
      y: origin.y + 180,
      width: 120,
      height: 180,
      islandId,
    });
    buildings.push({
      id: `b_${islandId}_sub2_lv3`,
      type: 'house3',
      name: '큰마을 대장간',
      x: origin.x + 470,
      y: origin.y + 180,
      width: 120,
      height: 180,
      islandId,
    });
  } else if (villageTier >= 4) {
    // 4단계 소도시 / 5단계 중소도시 / 6단계 대도시
    buildings.push({
      id: `b_${islandId}_hall_city`,
      type: 'castle',
      name: `${tierInfo.badge} 중앙 성채`,
      x: origin.x + 160,
      y: origin.y + 40,
      width: 320,
      height: 250,
      islandId,
    });
    buildings.push({
      id: `b_${islandId}_west_city`,
      type: villageTier >= 5 ? 'barracks' : 'house2',
      name: `${tierInfo.name} 서구획`,
      x: origin.x + 36,
      y: origin.y + 160,
      width: 140,
      height: 190,
      islandId,
    });
    buildings.push({
      id: `b_${islandId}_east_city`,
      type: villageTier >= 6 ? 'monastery' : 'archery',
      name: `${tierInfo.name} 동구획`,
      x: origin.x + 464,
      y: origin.y + 160,
      width: 140,
      height: 190,
      islandId,
    });
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
      return { x: b.x + 28, y: b.y + 115, w: b.width - 56, h: 90 };
    case 'house1':
    case 'house2':
    case 'house3':
      return { x: b.x + 20, y: b.y + 85, w: b.width - 40, h: 75 };
    case 'tower':
      return { x: b.x + 24, y: b.y + 140, w: b.width - 48, h: 80 };
    case 'barracks':
    case 'archery':
      return { x: b.x + 24, y: b.y + 120, w: b.width - 48, h: 95 };
    case 'monastery':
      return { x: b.x + 24, y: b.y + 150, w: b.width - 48, h: 110 };
    default:
      return { x: b.x + 16, y: b.y + 80, w: b.width - 32, h: 75 };
  }
}

/**
 * 영지별 자원 엔티티 생성
 * - 중심 마을(id: 0)은 나무 방책과 중소마을 건물이 자리하며 기본 시작 자원을 보유
 * - 중심 마을과 인접한 땅(id: 1~8)은 자원이 매우 풍부함! (고밀도 배치 + 채집 보너스)
 * - 외곽 땅(id: 9~20)도 넓혀가며 자원을 대량 확보할 수 있도록 구성
 */
export function generateIslandEntities(islandId: number, gridX: number, gridY: number): Entity[] {
  const origin = getIslandOrigin(gridX, gridY);
  const entities: Entity[] = [];

  const addTree = (idSuffix: string, relX: number, relY: number, hp = 3) => {
    entities.push({
      id: `t_${islandId}_${idSuffix}`,
      type: 'tree',
      x: origin.x + relX,
      y: origin.y + relY,
      hp,
      maxHp: hp,
      islandId,
    });
  };

  const addRock = (idSuffix: string, relX: number, relY: number, hp = 4) => {
    entities.push({
      id: `r_${islandId}_${idSuffix}`,
      type: 'rock',
      x: origin.x + relX,
      y: origin.y + relY,
      hp,
      maxHp: hp,
      islandId,
    });
  };

  const addGoldRock = (idSuffix: string, relX: number, relY: number, hp = 5) => {
    entities.push({
      id: `g_${islandId}_${idSuffix}`,
      type: 'gold_rock',
      x: origin.x + relX,
      y: origin.y + relY,
      hp,
      maxHp: hp,
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
    case 0: // 중심 마을 (중소마을 + 나무 방책 내부의 시작 자원)
      addTree('1', 430, 460);
      addTree('2', 200, 460);
      addTree('3', 110, 420);
      addRock('1', 510, 120);
      addRock('2', 520, 420);
      addGoldRock('1', 120, 120);
      addSheep('1', 260, 510);
      break;

    case 1: // [인접 풍요지] 동쪽 풍요의 삼림 마을터: 나무 + 석재 + 금광 대량 분포!
      addTree('1', 110, 110, 4);
      addTree('2', 230, 100, 4);
      addTree('3', 420, 100, 4);
      addTree('4', 530, 120, 4);
      addTree('5', 110, 260, 4);
      addTree('6', 530, 260, 4);
      addTree('7', 120, 500, 4);
      addTree('8', 250, 520, 4);
      addTree('9', 430, 520, 4);
      addRock('1', 530, 490, 5);
      addRock('2', 220, 250, 5);
      addGoldRock('1', 420, 250, 5);
      break;

    case 2: // [인접 풍요지] 남쪽 풍요의 채석 마을터: 석재 + 금광 + 목재 대량 분포!
      addRock('1', 110, 110, 5);
      addRock('2', 230, 110, 5);
      addRock('3', 420, 110, 5);
      addRock('4', 530, 120, 5);
      addRock('5', 110, 270, 5);
      addRock('6', 530, 270, 5);
      addRock('7', 130, 510, 5);
      addGoldRock('1', 430, 510, 6);
      addGoldRock('2', 530, 500, 6);
      addTree('1', 240, 510, 4);
      addTree('2', 220, 250, 4);
      break;

    case 3: // [인접 풍요지] 서쪽 풍요의 황금 마을터: 황금 광맥 + 석재 + 목재 대량 분포!
      addGoldRock('1', 110, 110, 6);
      addGoldRock('2', 230, 110, 6);
      addGoldRock('3', 420, 110, 6);
      addGoldRock('4', 530, 120, 6);
      addGoldRock('5', 120, 500, 6);
      addGoldRock('6', 520, 500, 6);
      addRock('1', 110, 260, 5);
      addRock('2', 530, 260, 5);
      addTree('1', 240, 510, 4);
      addTree('2', 410, 510, 4);
      break;

    case 4: // [인접 풍요지] 북쪽 풍요의 고원 마을터: 모든 자원 균형 대량 분포!
      addGoldRock('1', 110, 110, 6);
      addGoldRock('2', 530, 110, 6);
      addGoldRock('3', 230, 240, 6);
      addGoldRock('4', 410, 240, 6);
      addRock('1', 230, 110, 5);
      addRock('2', 410, 110, 5);
      addRock('3', 120, 500, 5);
      addRock('4', 520, 500, 5);
      addTree('1', 110, 260, 4);
      addTree('2', 530, 260, 4);
      addTree('3', 240, 510, 4);
      addTree('4', 410, 510, 4);
      break;

    case 5: // [인접 풍요지] 남동쪽 과수원 마을터
    case 6: // [인접 풍요지] 남서쪽 흑요석 광산 마을터
    case 7: // [인접 풍요지] 북동쪽 에메랄드 숲 마을터
    case 8: // [인접 풍요지] 북서쪽 고대 유적 마을터
      addTree('1', 110, 110, 4);
      addTree('2', 230, 110, 4);
      addTree('3', 530, 120, 4);
      addTree('4', 120, 500, 4);
      addRock('1', 420, 110, 5);
      addRock('2', 110, 260, 5);
      addRock('3', 530, 260, 5);
      addRock('4', 240, 510, 5);
      addGoldRock('1', 420, 510, 6);
      addGoldRock('2', 520, 500, 6);
      addGoldRock('3', 220, 240, 6);
      break;

    default:
      // 외곽 확장 영지 (땅을 넓혀가며 추가 자원 확보)
      addTree('1', 120, 120, 4);
      addTree('2', 520, 120, 4);
      addTree('3', 120, 500, 4);
      addRock('1', 240, 120, 5);
      addRock('2', 400, 120, 5);
      addRock('3', 240, 500, 5);
      addGoldRock('1', 520, 500, 6);
      addGoldRock('2', 400, 500, 6);
      addGoldRock('3', 120, 260, 6);
      break;
  }

  return entities;
}
