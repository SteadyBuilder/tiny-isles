export * from './hunting';
export * from './combat';
import { MonsterCombatRole, PlayerClassId } from './hunting';

export type ResourceType = 'wood' | 'stone' | 'gold';

export interface Inventory {
  wood: number;
  stone: number;
  gold: number;
}

export type PlayerAction = 'idle' | 'run' | 'axe' | 'pickaxe' | 'cast' | 'hit' | 'stun';
export type PlayerColor = 'blue' | 'red';

export interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  direction: 'left' | 'right';
  action: PlayerAction;
  color: PlayerColor;
  classId?: PlayerClassId;
  level?: number;
  isFainted?: boolean;
  lastUpdated: number;
}

export interface PlayerHpState {
  hp: number;
  maxHp: number;
  isFainted: boolean;
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
  zoneTag?: 'wilderness' | 'gold_mine';
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
  | 'woodPalisade'
  | 'woodOutpost'
  | 'woodHut'
  | 'magicTower'
  | 'lumberCamp'
  | 'stoneWorks'
  | 'alchemistLab'
  | 'blacksmith'
  | 'market'
  | 'windmill'
  | 'stoneWall'
  | 'blackCastle'
  | 'blackTower'
  | 'purpleCastle';

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
  | 'special_goldmine'
  | 'job_hall'
  | 'tool_shop';

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
  shortEffect: string;
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

export interface IslandOwnerInfo {
  ownerId: string;
  ownerName: string;
}

export interface Island {
  id: number;
  gridX: number; // e.g. 0, 1, -1
  gridY: number; // e.g. 0, 1, -1
  costWood: number;
  costStone: number;
  costGold: number;
  unlocked: boolean;
  ownerId?: string;
  ownerName?: string;
  name: string;
  isAdjacentRich?: boolean;
  resourceRichLabel?: string;
  villageTier: VillageTier;
  coreHp: number;
  coreMaxHp: number;
  isMonsterCamp?: boolean;
  campRing?: 1 | 2 | 3 | 4;
  campLevel?: number;
  campDestroyed?: boolean;
  campRespawnSec?: number | null;
}

export type Territory = Island;

export type MonsterType =
  | 'zombie'
  | 'skeleton'
  | 'goblin'
  | 'lancer'
  | 'archmage'
  | 'boss_deathlord';

export type BossSkillId =
  | 'shockwave'
  | 'frost_nova'
  | 'void_barrage'
  | 'summon_minions'
  | 'meteor_rain'
  | 'lightning_judgment';

export interface Monster {
  id: string;
  type: MonsterType;
  name: string;
  isBoss: boolean;
  bossTemplateId?: string;
  bossSkillId?: BossSkillId;
  bossSpriteKey?: string;
  bossTintHex?: number;
  bossScale?: number;
  isElite?: boolean;
  eliteAffix?: import('./hunting').EliteAffixId;
  eliteTier?: import('./hunting').FieldEliteTier;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attack: number;
  speed: number;
  targetTerritoryId: number;
  spawnTerritoryId: number;
  direction: 'left' | 'right';
  role?: MonsterCombatRole;
  isCampMonster?: boolean;
  isFieldMonster?: boolean;
  campTerritoryId?: number;
  campRing?: 1 | 2 | 3 | 4;
  homeX?: number;
  homeY?: number;
  patrolRadiusPx?: number;
  expReward?: number;
  shieldHp?: number;
  shieldMaxHp?: number;
  shieldUntil?: number;
}

export interface WaveState {
  threatPercent: number;
  warningThreshold: number;
  wavesUntilBoss: number;
  waveCount: number;
  bossWaveCount: number;
  activeMonstersCount: number;
  countdownSecondsRemaining: number | null;
  nextWaveIsBoss: boolean;
  activeBoss: {
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    targetTerritoryName: string;
  } | null;
  lastWaveMessage: string | null;
  onlineScaleLabel?: string;
  activeGarrisonCount?: number;
}

export interface ThreatOrbFxPayload {
  startX: number;
  startY: number;
  amount: number;
}

export interface DynamicScalingProfile {
  minPlayers: number;
  maxPlayers: number;
  countMultiplier: number;
  hpMultiplier: number;
  attackMultiplier: number;
  label: string;
}

export interface GarrisonUnit {
  playerId: string;
  name: string;
  color: PlayerColor;
  territoryId: number;
  x: number;
  y: number;
  power: number;
  updatedAt: string;
}

export interface WorldSyncState {
  worldId: string;
  lastActiveAt: string;
  waveCount: number;
  bossWaveCount: number;
  unlockedIslandIds: number[];
  islandOwners?: Record<number, IslandOwnerInfo>;
  villageTiers: Record<number, VillageTier>;
  coreHps: Record<number, number>;
  constructedBuildings: ConstructedBuilding[];
  activeMonsters: Monster[];
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
