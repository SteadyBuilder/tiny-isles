import {
  ConstructableBlueprint,
  ConstructableType,
  ConstructedBuilding,
  VillageTier,
  VillageTierConfig,
} from '../types/game';

/**
 * 마을 6단계 발전 테크트리 상세 설정 (데이터 순수 분리)
 */
export const VILLAGE_TIER_CONFIG: Record<VillageTier, VillageTierConfig> = {
  0: {
    tier: 0,
    name: '점령지',
    badge: '🚩 점령지',
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
    badge: '🏕️ 개척마을',
    coreMaxHp: 200,
    maxBuildings: 5,
    costWood: 0,
    costStone: 0,
    costGold: 0,
    passiveWood: 1,
    passiveStone: 1,
    passiveGold: 0,
    description: '최초 개척지입니다. 텐트와 기본 방책으로 구성됩니다.',
  },
  2: {
    tier: 2,
    name: '중소마을',
    badge: '🏡 중소마을',
    coreMaxHp: 350,
    maxBuildings: 7,
    costWood: 20,
    costStone: 15,
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

/**
 * 건설 가능한 건물 도감 (방어 타워, 성벽, 기본건물, 특수건물)
 * [AI Guideline]: 새로운 건물을 추가할 때는 반드시 이 배열에 정의를 추가하세요.
 */
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

  // 2. 성벽 및 방책 (Walls & Palisades)
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

/**
 * 영지 내 건설 슬롯 상대 좌표 오프셋 (640x640 영지 기준)
 */
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
