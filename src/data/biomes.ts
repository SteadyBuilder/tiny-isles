import { EntityType } from '../types/game';

/**
 * Necesse-inspired Overworld Biome Identifiers.
 */
export type BiomeId = 'plains' | 'forest' | 'highland' | 'mystic' | 'gold_mine' | 'water';

export type LandBiomeId = Exclude<BiomeId, 'water'>;

export interface BiomeConfig {
  id: BiomeId;
  name: string;
  /** Phaser image key for 9x6 64x64 tilemap texture */
  tilemapKey: string;
  /** Interior grass tile coordinate in 9x6 64x64 grid */
  interiorTileCol: number;
  interiorTileRow: number;
  /** Fallback fill color for Canvas 2D or minimap preview */
  baseColorHex: number;
  baseColorCss: string;
  walkable: boolean;
  /** Relative spawn weights per resource entity type */
  resourceWeights: Record<EntityType, number>;
  /** Probability [0..1] of spawning non-blocking ground decoration on eligible tiles */
  decorationChance: number;
}

/**
 * Data-driven biome definitions referencing Tiny Swords Tilemap_color1..5 & Water assets.
 */
export const BIOME_CONFIGS: Record<BiomeId, BiomeConfig> = {
  plains: {
    id: 'plains',
    name: '온화한 초원',
    tilemapKey: 'tilemap1',
    interiorTileCol: 1,
    interiorTileRow: 1,
    baseColorHex: 0x6ca94b,
    baseColorCss: '#6ca94b',
    walkable: true,
    resourceWeights: {
      tree: 0.44,
      rock: 0.34,
      gold_rock: 0.08,
      sheep: 0.14,
    },
    decorationChance: 0.08,
  },
  forest: {
    id: 'forest',
    name: '울창한 삼림',
    tilemapKey: 'tilemap2',
    interiorTileCol: 1,
    interiorTileRow: 1,
    baseColorHex: 0x4f9145,
    baseColorCss: '#4f9145',
    walkable: true,
    resourceWeights: {
      tree: 0.68,
      rock: 0.2,
      gold_rock: 0.05,
      sheep: 0.07,
    },
    decorationChance: 0.14,
  },
  highland: {
    id: 'highland',
    name: '바위 고원',
    tilemapKey: 'tilemap4',
    interiorTileCol: 1,
    interiorTileRow: 1,
    baseColorHex: 0x7c8f4b,
    baseColorCss: '#7c8f4b',
    walkable: true,
    resourceWeights: {
      tree: 0.22,
      rock: 0.62,
      gold_rock: 0.12,
      sheep: 0.04,
    },
    decorationChance: 0.1,
  },
  mystic: {
    id: 'mystic',
    name: '신비의 습지',
    tilemapKey: 'tilemap5',
    interiorTileCol: 1,
    interiorTileRow: 1,
    baseColorHex: 0x458b7e,
    baseColorCss: '#458b7e',
    walkable: true,
    resourceWeights: {
      tree: 0.42,
      rock: 0.36,
      gold_rock: 0.16,
      sheep: 0.06,
    },
    decorationChance: 0.12,
  },
  gold_mine: {
    id: 'gold_mine',
    name: '황금 광산 지대',
    tilemapKey: 'tilemap3',
    interiorTileCol: 1,
    interiorTileRow: 1,
    baseColorHex: 0xc29238,
    baseColorCss: '#c29238',
    walkable: true,
    resourceWeights: {
      tree: 0,
      rock: 0.12,
      gold_rock: 0.88,
      sheep: 0,
    },
    decorationChance: 0.12,
  },
  water: {
    id: 'water',
    name: '호수와 개울',
    tilemapKey: 'waterBg',
    interiorTileCol: 0,
    interiorTileRow: 0,
    baseColorHex: 0x2f8fb5,
    baseColorCss: '#2f8fb5',
    walkable: false,
    resourceWeights: {
      tree: 0,
      rock: 0,
      gold_rock: 0,
      sheep: 0,
    },
    decorationChance: 0.06,
  },
};

export interface GoldMineBiomeConfig {
  /** Mid-game outer territory ID whose occupation unseals the gold mine */
  unlockTerritoryId: number;
  /** World center X of the clustered gold mine biome */
  centerX: number;
  /** World center Y of the clustered gold mine biome */
  centerY: number;
  /** Organic radius (px) around center inside the wilderness pocket */
  radiusPx: number;
  /** Number of gold_rock nodes clustered inside the unlocked gold mine */
  clusterNodeCount: number;
  /** Tight spacing (px) between clustered gold veins */
  clusterMinSpacingPx: number;
  /** Global announcement text broadcast on discovery */
  announcementText: string;
}

export const GOLD_MINE_BIOME_CONFIG: GoldMineBiomeConfig = {
  unlockTerritoryId: 11, // #11 극서 태양금광 변경 마을터 (-2, 0) 인접 야외 광맥 지대
  centerX: -1600,
  centerY: -320,
  radiusPx: 300,
  clusterNodeCount: 16,
  clusterMinSpacingPx: 56,
  announcementText: '황금광산 발견!!',
};

export interface TerrainGenerationConfig {
  seed: number;
  tileSize: number;
  /** Buffer tiles outside any 640x640 village square guaranteed to stay dry land */
  villageDryBufferPx: number;
  /** Half-width of main village-connecting roads (px) */
  roadHalfWidthPx: number;
  /** Frequency for elevation / highland noise */
  elevationScale: number;
  /** Frequency for moisture / forest-mystic noise */
  moistureScale: number;
  /** Frequency for lake / river water basins */
  waterScale: number;
  /** Noise threshold above which outdoor cells become water lakes */
  waterThreshold: number;
}

export const TERRAIN_GENERATION_CONFIG: TerrainGenerationConfig = {
  seed: 20261113,
  tileSize: 64,
  villageDryBufferPx: 64,
  roadHalfWidthPx: 32,
  elevationScale: 0.065,
  moistureScale: 0.075,
  waterScale: 0.085,
  waterThreshold: 0.67,
};

export interface ResourceDistributionConfig {
  /** Sector size (px) for uniform map-wide resource density balancing */
  sectorSizePx: number;
  /** Target resources spawned per outdoor-capable sector (dense wood & stone) */
  targetResourcesPerSector: number;
  /** Target cap for general-world gold_rock nodes outside the gold mine biome */
  generalGoldTargetCount: number;
  /** Minimum center-to-center spacing (px) between resource nodes */
  minEntitySpacingPx: number;
  /** Respawn delay (ms) after harvesting a node */
  respawnDelayMs: number;
  /** Clearance (px) around village squares so resources stay strictly in the wilderness */
  villageExclusionMarginPx: number;
  /** Clearance (px) from road centerlines */
  roadExclusionHalfWidthPx: number;
  /** Default HP by resource entity type */
  entityMaxHp: Record<EntityType, number>;
}

export const RESOURCE_DISTRIBUTION_CONFIG: ResourceDistributionConfig = {
  sectorSizePx: 640,
  targetResourcesPerSector: 10,
  generalGoldTargetCount: 70,
  minEntitySpacingPx: 64,
  respawnDelayMs: 10000,
  villageExclusionMarginPx: 44,
  roadExclusionHalfWidthPx: 52,
  entityMaxHp: {
    tree: 4,
    rock: 5,
    gold_rock: 6,
    sheep: 3,
  },
};
