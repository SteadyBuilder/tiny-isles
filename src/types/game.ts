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
  | 'monastery';

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
}

export type Territory = Island;

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
