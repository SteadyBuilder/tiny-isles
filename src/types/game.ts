export type ResourceType = 'wood' | 'stone' | 'gold';

export interface Inventory {
  wood: number;
  stone: number;
  gold: number;
}

export type PlayerAction = 'idle' | 'run' | 'axe' | 'pickaxe';
export type PlayerColor = 'blue' | 'red';

export interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  direction: 'left' | 'right';
  action: PlayerAction;
  color: PlayerColor;
  lastUpdated: number;
}

export type EntityType = 'tree' | 'rock' | 'gold_rock' | 'sheep';

export interface Entity {
  id: string;
  type: EntityType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  islandId: number;
  shakeTime?: number;
}

export type BuildingType =
  | 'castle'
  | 'house1'
  | 'house2'
  | 'house3'
  | 'tower'
  | 'barracks'
  | 'archery'
  | 'monastery'
  | 'woodPalisade';

export interface Building {
  id: string;
  type: BuildingType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  islandId: number;
}

// 마을 발전 단계:
// 0: 점령지 (마을 건설 전)
// 1: 마을 (초기 마을)
// 2: 중소마을 (중심 마을 시작 단계)
// 3: 큰마을
// 4: 소도시
// 5: 중소도시
// 6: 대도시
export type VillageTier = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface VillageTierConfig {
  tier: VillageTier;
  name: string;
  badge: string;
  coreMaxHp: number;
  maxBuildings: number;
  costWood: number;
  costStone: number;
  costGold: number;
  passiveWood: number;
  passiveStone: number;
  passiveGold: number;
  description: string;
}

// 점령지 건설 가능 카테고리: 방어 타워, 성벽, 기본건물, 특수건물
export type BuildingCategory = 'tower' | 'wall' | 'basic' | 'special';

export type ConstructableType =
  | 'arrow_tower'
  | 'magic_tower'
  | 'wood_wall'
  | 'stone_wall'
  | 'basic_house'
  | 'lumber_camp'
  | 'stone_works'
  | 'special_barracks'
  | 'special_sanctuary'
  | 'special_goldmine';

export interface ConstructableBlueprint {
  type: ConstructableType;
  category: BuildingCategory;
  categoryLabel: string;
  name: string;
  icon: string;
  spriteKey: BuildingType;
  costWood: number;
  costStone: number;
  costGold: number;
  maxHp: number;
  attack?: number;
  range?: number;
  fireRateMs?: number;
  description: string;
}

export interface ConstructedBuilding {
  id: string;
  territoryId: number;
  type: ConstructableType;
  category: BuildingCategory;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  slotIndex: number;
}

export interface TerritoryCore {
  x: number;
  y: number;
  level: number;
  name: string;
  islandId: number;
}

export interface Island {
  id: number;
  gridX: number; // e.g. 0, 1, -1
  gridY: number; // e.g. 0, 1, -1
  costWood: number;
  costStone: number;
  costGold: number;
  unlocked: boolean;
  name: string;
  isAdjacentRich?: boolean;
  resourceRichLabel?: string;
  villageTier: VillageTier;
  coreHp: number;
  coreMaxHp: number;
}

export type Territory = Island;

export type MonsterType = 'zombie' | 'skeleton' | 'goblin' | 'boss_deathlord';

export interface Monster {
  id: string;
  type: MonsterType;
  name: string;
  isBoss: boolean;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attack: number;
  speed: number;
  targetTerritoryId: number;
  spawnTerritoryId: number;
  direction: 'left' | 'right';
}

export interface WaveState {
  regularWaveIntervalSec: number; // 1800 (30분)
  bossWaveIntervalSec: number; // 3600 (60분)
  regularWaveRemainingSec: number;
  bossWaveRemainingSec: number;
  waveCount: number;
  bossWaveCount: number;
  activeMonstersCount: number;
  activeBoss: {
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    targetTerritoryName: string;
  } | null;
  lastWaveMessage: string | null;
  timeScale: number;
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  alpha: number;
  vy: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface ServerIslandRecord {
  island_id: number;
  island_name: string;
  unlocked_by: string;
  unlocked_at?: string;
}

export interface ServerPlayerRecord {
  id: string;
  name: string;
  color: PlayerColor;
  wood: number;
  stone: number;
  gold: number;
  last_active_at?: string;
  created_at?: string;
}
