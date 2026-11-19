import Phaser from 'phaser';
import { MINIMAP_CONFIG } from '../../../data/minimapConfig';
import { DungeonPortalState, PlayerColor } from '../../../types/game';
import {
  MinimapDynamicSnapshot,
  MinimapMonsterMarker,
  MinimapTeammateMarker,
  MinimapTerrainBakePayload,
  MinimapTerrainCellSample,
} from '../../../types/minimap';
import { GameEvents } from '../../events/gameEvents';
import { MonsterVisual } from '../../systems/MonsterVisualManager';
import { WORLD_BOUNDS } from '../../worldBounds';
import { WorldTerrainMap } from '../../world/MapTerrainGenerator';

export interface IMinimapSnapshotContext {
  scene: Phaser.Scene;
  isSceneAlive: () => boolean;
  getLocalPlayerState: () => {
    x: number;
    y: number;
    direction: 'left' | 'right';
    color: PlayerColor;
    isFainted: boolean;
  };
  getRemoteTeammates: () => MinimapTeammateMarker[];
  getMonsterVisuals: () => Map<string, MonsterVisual>;
  getDungeonPortalState: () => DungeonPortalState | null;
}

/**
 * Phaser WorldScene의 정적 지형 베이크 데이터와 실시간 동적 엔티티 스냅샷을
 * 스로틀링하여 GameEvents로 발행하는 전용 컨트롤러.
 */
export class MinimapSnapshotEmitter {
  private ctx: IMinimapSnapshotContext;
  private lastEmitTimeMs = -Infinity;

  constructor(ctx: IMinimapSnapshotContext) {
    this.ctx = ctx;
  }

  public emitTerrainBake(terrainMap: WorldTerrainMap): void {
    const step = Math.max(1, MINIMAP_CONFIG.terrainSampleStep);
    const sampledCells: MinimapTerrainCellSample[] = [];
    for (let i = 0; i < terrainMap.cells.length; i++) {
      const cell = terrainMap.cells[i];
      if (step > 1 && (Math.abs(cell.gx) % step !== 0 || Math.abs(cell.gy) % step !== 0)) {
        // 도로/마을 부지는 축소 시 끊김 방지를 위해 샘플링 제외 없이 유지
        if (!cell.isRoad && !cell.isVillagePlot) continue;
      }
      sampledCells.push({
        worldX: cell.worldX,
        worldY: cell.worldY,
        biome: cell.biome,
        isRoad: cell.isRoad,
        isVillagePlot: cell.isVillagePlot,
      });
    }

    const payload: MinimapTerrainBakePayload = {
      bounds: WORLD_BOUNDS,
      tileSize: terrainMap.tileSize,
      sampleStep: step,
      cells: sampledCells,
      waterBodies: terrainMap.waterBodies,
      bridges: terrainMap.bridges,
      goldMineZone: terrainMap.goldMineZone,
    };

    GameEvents.emit('minimap-terrain-ready', payload);
  }

  public update(timeMs: number, force = false): void {
    if (!this.ctx.isSceneAlive()) return;
    const isMobile =
      typeof window !== 'undefined' && window.innerWidth < MINIMAP_CONFIG.mobileBreakpointPx;
    const intervalMs = isMobile
      ? MINIMAP_CONFIG.mobileUpdateIntervalMs
      : MINIMAP_CONFIG.desktopUpdateIntervalMs;

    if (!force && timeMs - this.lastEmitTimeMs < intervalMs) return;
    this.lastEmitTimeMs = timeMs;

    const cam = this.ctx.scene.cameras?.main;
    const wv = cam?.worldView;
    const player = this.ctx.getLocalPlayerState();
    const teammates = this.ctx.getRemoteTeammates();

    const monsters: MinimapMonsterMarker[] = [];
    for (const visual of this.ctx.getMonsterVisuals().values()) {
      const m = visual.monster;
      if (m.hp <= 0) continue;
      monsters.push({
        id: m.id,
        x: visual.container.x,
        y: visual.container.y,
        isBoss: Boolean(m.isBoss),
      });
    }

    const portal = this.ctx.getDungeonPortalState();
    const snapshot: MinimapDynamicSnapshot = {
      player,
      cameraView: wv
        ? { x: wv.x, y: wv.y, width: wv.width, height: wv.height }
        : { x: player.x - 400, y: player.y - 300, width: 800, height: 600 },
      teammates,
      monsters,
      dungeonPortal: portal ? { x: portal.x, y: portal.y, active: true } : null,
      timestamp: timeMs,
    };

    GameEvents.emit('minimap-snapshot', snapshot);
  }

  public destroy(): void {
    this.lastEmitTimeMs = -Infinity;
  }
}
