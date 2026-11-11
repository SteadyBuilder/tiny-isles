export type ResourceType = 'wood' | 'stone' | 'gold';

export interface Inventory {
  wood: number;
  stone: number;
  gold: number;
}

export type PlayerAction = 'idle' | 'run' | 'axe' | 'pickaxe' | 'attack' | 'build';
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
  hp: number;
  maxHp: number;
  isDashing?: boolean;
  dashCooldown?: number;
}

export type EntityType = 'tree' | 'rock' | 'gold_rock' | 'core_gem';

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

// 마을 단계: 야영지 -> 중소마을 -> 큰마을 -> 소도시 -> 중소도시 -> 대도시
export type VillageTier =
  | 'outpost' // 전초 야영지
  | 'small_village' // 중소마을 (기본 수도 상태)
  | 'large_village' // 큰마을
  | 'small_city' // 소도시
  | 'mid_city' // 중소도시
  | 'metropolis'; // 대도시

export interface Territory {
  id: number;
  gridX: number;
  gridY: number;
  name: string;
  unlocked: boolean;
  isCoreActive: boolean;
  coreHp: number;
  maxCoreHp: number;
  tier: VillageTier;
  isCapital: boolean;
  costWood: number;
  costStone: number;
  costGold: number;
}

// 기존 Island 타입과의 하위 호환
export type Island = Territory;

export type BuildingType = 'fence' | 'wall' | 'arrow_tower' | 'cannon_tower';

export interface Building {
  id: string;
  type: BuildingType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  territoryId: number;
  range: number;
  damage: number;
  attackCooldown: number; // ms
  lastAttackTime: number;
  targetId?: string;
}

export type MonsterType = 'zombie' | 'skeleton' | 'boss';

export interface Monster {
  id: string;
  type: MonsterType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  attackPower: number;
  attackRange: number;
  attackCooldown: number;
  lastAttackTime: number;
  targetType: 'player' | 'core' | 'building';
  targetId?: string;
  targetX: number;
  targetY: number;
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  targetId?: string;
  speed: number;
  damage: number;
  type: 'arrow' | 'bone' | 'cannonball';
  source: 'player' | 'tower' | 'monster';
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

export interface DefenseSession {
  modeMinutes: 30 | 60;
  elapsedSeconds: number;
  waveIndex: number;
  waveIncoming: boolean;
  timeToNextWave: number;
  isBossWave: boolean;
  totalWaves: number;
  isGameOver: boolean;
  isVictory: boolean;
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
