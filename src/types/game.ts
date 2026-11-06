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

export type EntityType = 'tree' | 'rock' | 'gold_rock';

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
