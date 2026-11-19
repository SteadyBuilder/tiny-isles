import { PlayerColor } from './game';
import { BiomeId } from '../data/biomes';
import { WorldBounds } from '../game/worldBounds';
import { BridgeSegment, GoldMineZoneMeta, WaterRect } from '../game/world/MapTerrainGenerator';

export type MinimapViewMode = 'world' | 'radar';

export interface MinimapTerrainCellSample {
  worldX: number;
  worldY: number;
  biome: BiomeId;
  isRoad: boolean;
  isVillagePlot: boolean;
}

export interface MinimapTerrainBakePayload {
  bounds: WorldBounds;
  tileSize: number;
  sampleStep: number;
  cells: MinimapTerrainCellSample[];
  waterBodies: WaterRect[];
  bridges: BridgeSegment[];
  goldMineZone: GoldMineZoneMeta;
}

export interface MinimapTeammateMarker {
  id: string;
  name: string;
  color: PlayerColor;
  x: number;
  y: number;
  isFainted: boolean;
}

export interface MinimapMonsterMarker {
  id: string;
  x: number;
  y: number;
  isBoss: boolean;
}

export interface MinimapCameraRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MinimapDynamicSnapshot {
  player: {
    x: number;
    y: number;
    direction: 'left' | 'right';
    color: PlayerColor;
    isFainted: boolean;
  };
  cameraView: MinimapCameraRect;
  teammates: MinimapTeammateMarker[];
  monsters: MinimapMonsterMarker[];
  dungeonPortal: {
    x: number;
    y: number;
    active: boolean;
  } | null;
  timestamp: number;
}

export interface MinimapViewport {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

export interface MinimapProjectedPoint {
  x: number;
  y: number;
  isClamped: boolean;
}
