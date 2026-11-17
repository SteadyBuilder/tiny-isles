import Phaser from 'phaser';
import { PERFORMANCE_CONFIG } from '../../../data/performanceConfig';
import { Inventory, Island } from '../../../types/game';
import { ViewportRect } from '../../utils/viewportCullingUtils';
import { WorldTerrainMap } from '../../world/MapTerrainGenerator';
import {
  BakedTerrainChunk,
  TerrainChunkGridInfo,
  bakeSingleTerrainChunk,
  getTerrainChunkGridInfo,
} from './TerrainChunkPainter';
import { TerritoryOverlayRenderer } from './TerritoryOverlayRenderer';

/**
 * Renders Necesse-style biome terrain chunks on demand with an LRU texture cache,
 * wooden bridges, water colliders, and territory village overlays in Phaser.
 */
export class TerrainRenderer {
  private scene: Phaser.Scene;
  private terrain: WorldTerrainMap;
  private gridInfo: TerrainChunkGridInfo;
  private chunkCache = new Map<string, BakedTerrainChunk>();
  private overlayRenderer: TerritoryOverlayRenderer;
  private waterColliders: Phaser.Physics.Arcade.StaticGroup;

  constructor(scene: Phaser.Scene, terrain: WorldTerrainMap) {
    this.scene = scene;
    this.terrain = terrain;
    this.gridInfo = getTerrainChunkGridInfo(terrain, PERFORMANCE_CONFIG.terrainChunkTiles);
    this.overlayRenderer = new TerritoryOverlayRenderer(scene);
    this.waterColliders = scene.physics.add.staticGroup();
  }

  public getWaterColliders(): Phaser.Physics.Arcade.StaticGroup {
    return this.waterColliders;
  }

  public bakeTerrainChunks(): void {
    this.clearChunks();
    this.gridInfo = getTerrainChunkGridInfo(this.terrain, PERFORMANCE_CONFIG.terrainChunkTiles);
  }

  /**
   * 카메라 뷰포트 주변 지형 청크만 온디맨드로 베이킹하고,
   * 화면 밖 오래된 청크는 LRU 상한을 초과하면 텍스처까지 즉시 해제합니다.
   * @returns 프레임 예산 제한으로 미처 굽지 못한 청크가 남아 있으면 true
   */
  public syncChunksToViewport(viewport: ViewportRect, maxNewBakes: number): boolean {
    const grid = this.gridInfo;
    const margin = PERFORMANCE_CONFIG.terrainChunkPrefetchMarginPx;
    const minCx = Math.max(0, Math.floor((viewport.left - margin - grid.worldOriginX) / grid.chunkPx));
    const maxCx = Math.min(
      grid.numChunksX - 1,
      Math.floor((viewport.right + margin - grid.worldOriginX) / grid.chunkPx)
    );
    const minCy = Math.max(0, Math.floor((viewport.top - margin - grid.worldOriginY) / grid.chunkPx));
    const maxCy = Math.min(
      grid.numChunksY - 1,
      Math.floor((viewport.bottom + margin - grid.worldOriginY) / grid.chunkPx)
    );

    const visibleKeys = new Set<string>();
    let bakedCount = 0;
    let hasPendingBakes = false;

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const key = `${cx}_${cy}`;
        visibleKeys.add(key);

        const existing = this.chunkCache.get(key);
        if (existing) {
          // Move to MRU position and ensure visible
          this.chunkCache.delete(key);
          this.chunkCache.set(key, existing);
          if (!existing.image.visible) existing.image.setVisible(true);
          continue;
        }

        if (bakedCount >= maxNewBakes) {
          hasPendingBakes = true;
          continue;
        }

        const baked = bakeSingleTerrainChunk(this.scene, this.terrain, cx, cy, grid.chunkTiles);
        if (baked) {
          this.chunkCache.set(key, baked);
          bakedCount++;
        }
      }
    }

    for (const [key, chunk] of this.chunkCache.entries()) {
      if (!visibleKeys.has(key) && chunk.image.visible) {
        chunk.image.setVisible(false);
      }
    }

    const maxCached = PERFORMANCE_CONFIG.maxCachedTerrainChunks;
    if (this.chunkCache.size > maxCached) {
      for (const [key, chunk] of this.chunkCache.entries()) {
        if (this.chunkCache.size <= maxCached) break;
        if (visibleKeys.has(key)) continue;
        this.destroyChunkEntry(chunk);
        this.chunkCache.delete(key);
      }
    }

    return hasPendingBakes;
  }

  public refreshChunksOnContextRestore(): void {
    for (const chunk of this.chunkCache.values()) {
      if (!this.scene.textures.exists(chunk.texKey)) continue;
      const tex = this.scene.textures.get(chunk.texKey);
      if (tex instanceof Phaser.Textures.CanvasTexture) {
        tex.refresh();
      }
    }
  }

  public buildWaterColliders(): void {
    this.waterColliders.clear(true, true);
    const inset = 5;
    for (const rect of this.terrain.waterBodies) {
      const w = Math.max(12, rect.w - inset * 2);
      const h = Math.max(12, rect.h - inset * 2);
      const col = this.scene.physics.add.staticSprite(
        rect.x + rect.w / 2,
        rect.y + rect.h / 2,
        ''
      );
      col.setVisible(false);
      col.body.setSize(w, h);
      this.waterColliders.add(col);
    }
    this.waterColliders.refresh();
  }

  public renderTerritoryOverlays(
    islands: ReadonlyArray<Island>,
    inventory: Inventory,
    force = false
  ): void {
    this.overlayRenderer.render(islands, inventory, this.terrain.goldMineZone, force);
  }

  private destroyChunkEntry(chunk: BakedTerrainChunk): void {
    if (chunk.image.scene) {
      chunk.image.destroy();
    }
    if (this.scene.textures?.exists(chunk.texKey)) {
      this.scene.textures.remove(chunk.texKey);
    }
  }

  public clearChunks(): void {
    for (const chunk of this.chunkCache.values()) {
      this.destroyChunkEntry(chunk);
    }
    this.chunkCache.clear();
  }

  public destroy(): void {
    this.clearChunks();
    this.overlayRenderer.destroy();
    this.waterColliders?.clear(true, true);
  }
}
