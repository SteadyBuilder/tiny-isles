import Phaser from 'phaser';
import { Inventory, Island } from '../../../types/game';
import { WorldTerrainMap } from '../../world/MapTerrainGenerator';
import { bakeTerrainChunkTextures } from './TerrainChunkPainter';
import { TerritoryOverlayRenderer } from './TerritoryOverlayRenderer';

/**
 * Renders Necesse-style biome terrain chunks, shorelines, wooden bridges, water colliders,
 * and territory village overlays in Phaser.
 */
export class TerrainRenderer {
  private scene: Phaser.Scene;
  private terrain: WorldTerrainMap;
  private chunkImages: Phaser.GameObjects.Image[] = [];
  private chunkTexKeys: string[] = [];
  private overlayRenderer: TerritoryOverlayRenderer;
  private waterColliders: Phaser.Physics.Arcade.StaticGroup;

  constructor(scene: Phaser.Scene, terrain: WorldTerrainMap) {
    this.scene = scene;
    this.terrain = terrain;
    this.overlayRenderer = new TerritoryOverlayRenderer(scene);
    this.waterColliders = scene.physics.add.staticGroup();
  }

  public getWaterColliders(): Phaser.Physics.Arcade.StaticGroup {
    return this.waterColliders;
  }

  public bakeTerrainChunks(): void {
    this.clearChunks();
    const baked = bakeTerrainChunkTextures(this.scene, this.terrain);
    this.chunkImages = baked.chunkImages;
    this.chunkTexKeys = baked.chunkTexKeys;
  }

  public refreshChunksOnContextRestore(): void {
    for (const texKey of this.chunkTexKeys) {
      if (!this.scene.textures.exists(texKey)) continue;
      const tex = this.scene.textures.get(texKey);
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

  public clearChunks(): void {
    for (const img of this.chunkImages) {
      img.destroy();
    }
    this.chunkImages = [];
    this.chunkTexKeys = [];
  }

  public destroy(): void {
    this.clearChunks();
    this.overlayRenderer.destroy();
    this.waterColliders?.clear(true, true);
  }
}
