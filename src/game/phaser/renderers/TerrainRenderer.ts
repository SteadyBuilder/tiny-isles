import Phaser from 'phaser';
import { BIOME_CONFIGS } from '../../../data/biomes';
import { Inventory, Island } from '../../../types/game';
import {
  TERRITORY_BUILD_SLOTS,
  TERRITORY_PX,
  VILLAGE_TIER_CONFIGS,
  getIslandOrigin,
} from '../../constants';
import { DEPTH } from '../../depthLayers';
import {
  TerrainCell,
  WorldTerrainMap,
  getTerrainCellAtWorld,
} from '../../world/MapTerrainGenerator';
import { hash2D } from '../../world/TerrainNoise';

const CHUNK_TILES = 20; // 20 * 64 = 1280px (safe within mobile/WebGL 2048px texture limits)

function getSourceImage(scene: Phaser.Scene, key: string): CanvasImageSource | null {
  if (!scene.textures.exists(key)) return null;
  return scene.textures.get(key).getSourceImage() as CanvasImageSource;
}

function isWaterTile(terrain: WorldTerrainMap, gx: number, gy: number): boolean {
  const rx = gx - terrain.minGx;
  const ry = gy - terrain.minGy;
  if (rx < 0 || rx >= terrain.cols || ry < 0 || ry >= terrain.rows) return false;
  const cell = terrain.cells[ry * terrain.cols + rx];
  return cell.biome === 'water' || cell.isBridge;
}

function drawBridgeTile(
  ctx: CanvasRenderingContext2D,
  lx: number,
  ly: number,
  tileSize: number,
  orientation: 'h' | 'v'
) {
  const pad = 4;
  if (orientation === 'h') {
    // Support beams & top/bottom railings
    ctx.fillStyle = '#5c3317';
    ctx.fillRect(lx, ly + pad, tileSize, 6);
    ctx.fillRect(lx, ly + tileSize - pad - 6, tileSize, 6);
    // Wooden planks
    for (let px = 2; px < tileSize; px += 10) {
      ctx.fillStyle = px % 20 === 2 ? '#b4743b' : '#9c5f2b';
      ctx.fillRect(lx + px, ly + pad + 4, 8, tileSize - (pad + 4) * 2);
      ctx.fillStyle = '#6b3e19';
      ctx.fillRect(lx + px, ly + pad + 4, 8, 2);
    }
    // Rail posts
    ctx.fillStyle = '#3f220d';
    ctx.fillRect(lx + 4, ly + pad - 2, 6, 8);
    ctx.fillRect(lx + tileSize - 10, ly + pad - 2, 6, 8);
    ctx.fillRect(lx + 4, ly + tileSize - pad - 6, 6, 8);
    ctx.fillRect(lx + tileSize - 10, ly + tileSize - pad - 6, 6, 8);
  } else {
    ctx.fillStyle = '#5c3317';
    ctx.fillRect(lx + pad, ly, 6, tileSize);
    ctx.fillRect(lx + tileSize - pad - 6, ly, 6, tileSize);
    for (let py = 2; py < tileSize; py += 10) {
      ctx.fillStyle = py % 20 === 2 ? '#b4743b' : '#9c5f2b';
      ctx.fillRect(lx + pad + 4, ly + py, tileSize - (pad + 4) * 2, 8);
      ctx.fillStyle = '#6b3e19';
      ctx.fillRect(lx + pad + 4, ly + py, 2, 8);
    }
    ctx.fillStyle = '#3f220d';
    ctx.fillRect(lx + pad - 2, ly + 4, 8, 6);
    ctx.fillRect(lx + pad - 2, ly + tileSize - 10, 8, 6);
    ctx.fillRect(lx + tileSize - pad - 6, ly + 4, 8, 6);
    ctx.fillRect(lx + tileSize - pad - 6, ly + tileSize - 10, 8, 6);
  }
}

function drawRoadTile(
  ctx: CanvasRenderingContext2D,
  lx: number,
  ly: number,
  tileSize: number,
  cell: TerrainCell
) {
  ctx.fillStyle = 'rgba(194, 178, 146, 0.56)';
  ctx.fillRect(lx + 4, ly + 4, tileSize - 8, tileSize - 8);
  ctx.fillStyle = 'rgba(148, 134, 108, 0.38)';
  ctx.fillRect(lx + 4, ly + 4, tileSize - 8, 2);
  ctx.fillRect(lx + 4, ly + tileSize - 6, tileSize - 8, 2);

  // Subtle deterministic pebbles along the path
  const r = hash2D(cell.gx, cell.gy, 5519);
  if (r < 0.6) {
    ctx.fillStyle = 'rgba(120, 113, 108, 0.45)';
    ctx.fillRect(lx + 14 + Math.floor(r * 24), ly + 18, 5, 4);
    ctx.fillRect(lx + 38 - Math.floor(r * 16), ly + 40, 4, 4);
  }
}

/**
 * Renders Necesse-style biome terrain chunks, shorelines, wooden bridges, water colliders,
 * and territory village overlays in Phaser.
 */
export class TerrainRenderer {
  private scene: Phaser.Scene;
  private terrain: WorldTerrainMap;
  private chunkImages: Phaser.GameObjects.Image[] = [];
  private overlayGraphics: Phaser.GameObjects.Graphics;
  private waterColliders: Phaser.Physics.Arcade.StaticGroup;

  constructor(scene: Phaser.Scene, terrain: WorldTerrainMap) {
    this.scene = scene;
    this.terrain = terrain;
    this.overlayGraphics = scene.add.graphics();
    this.overlayGraphics.setDepth(DEPTH.TERRAIN);
    this.waterColliders = scene.physics.add.staticGroup();
  }

  public getWaterColliders(): Phaser.Physics.Arcade.StaticGroup {
    return this.waterColliders;
  }

  public bakeTerrainChunks(): void {
    this.clearChunks();
    const { tileSize, minGx, minGy, cols, rows } = this.terrain;
    const chunkPx = CHUNK_TILES * tileSize;
    const numChunksX = Math.ceil(cols / CHUNK_TILES);
    const numChunksY = Math.ceil(rows / CHUNK_TILES);

    const waterImg = getSourceImage(this.scene, 'waterBg');
    const bush1Img = getSourceImage(this.scene, 'bush');
    const bush2Img = getSourceImage(this.scene, 'bush2');
    const rock3Img = getSourceImage(this.scene, 'rock3');
    const rock4Img = getSourceImage(this.scene, 'rock4');
    const waterRock1Img = getSourceImage(this.scene, 'waterRock1');
    const waterRock2Img = getSourceImage(this.scene, 'waterRock2');

    for (let cy = 0; cy < numChunksY; cy++) {
      for (let cx = 0; cx < numChunksX; cx++) {
        const startRx = cx * CHUNK_TILES;
        const startRy = cy * CHUNK_TILES;
        const chunkCols = Math.min(CHUNK_TILES, cols - startRx);
        const chunkRows = Math.min(CHUNK_TILES, rows - startRy);
        const w = chunkCols * tileSize;
        const h = chunkRows * tileSize;
        const texKey = `terrain_chunk_${cx}_${cy}`;

        if (this.scene.textures.exists(texKey)) {
          this.scene.textures.remove(texKey);
        }

        const canvasTex = this.scene.textures.createCanvas(texKey, w, h);
        if (!canvasTex) continue;
        const ctx = canvasTex.getContext();

        for (let ty = 0; ty < chunkRows; ty++) {
          for (let tx = 0; tx < chunkCols; tx++) {
            const rx = startRx + tx;
            const ry = startRy + ty;
            const cell = this.terrain.cells[ry * cols + rx];
            const lx = tx * tileSize;
            const ly = ty * tileSize;

            if (cell.biome === 'water' || cell.isBridge) {
              if (waterImg) {
                ctx.drawImage(waterImg, 0, 0, 64, 64, lx, ly, tileSize, tileSize);
              } else {
                ctx.fillStyle = BIOME_CONFIGS.water.baseColorCss;
                ctx.fillRect(lx, ly, tileSize, tileSize);
              }

              // Subtle animated-style foam highlight on water surface
              if (cell.biome === 'water' && hash2D(cell.gx, cell.gy, 881) < 0.28) {
                ctx.fillStyle = 'rgba(224, 242, 254, 0.24)';
                ctx.fillRect(lx + 16, ly + 28, 18, 3);
              }

              if (cell.isBridge) {
                const bridgeSeg = this.terrain.bridges.find(
                  (b) => b.gx === cell.gx && b.gy === cell.gy
                );
                drawBridgeTile(ctx, lx, ly, tileSize, bridgeSeg?.orientation || 'h');
              }
            } else {
              const cfg = BIOME_CONFIGS[cell.biome];
              const sheetImg = getSourceImage(this.scene, cfg.tilemapKey);

              const wLeft = isWaterTile(this.terrain, cell.gx - 1, cell.gy);
              const wRight = isWaterTile(this.terrain, cell.gx + 1, cell.gy);
              const wTop = isWaterTile(this.terrain, cell.gx, cell.gy - 1);
              const wBottom = isWaterTile(this.terrain, cell.gx, cell.gy + 1);

              // Draw water underneath shoreline tiles so rounded Tiny Swords corners blend over water
              if ((wLeft || wRight || wTop || wBottom) && waterImg) {
                ctx.drawImage(waterImg, 0, 0, 64, 64, lx, ly, tileSize, tileSize);
              }

              if (sheetImg) {
                const tileCol =
                  wLeft && wRight ? 3 : wLeft ? 0 : wRight ? 2 : cfg.interiorTileCol;
                const tileRow =
                  wTop && wBottom ? 3 : wTop ? 0 : wBottom ? 2 : cfg.interiorTileRow;
                ctx.drawImage(
                  sheetImg,
                  tileCol * 64,
                  tileRow * 64,
                  64,
                  64,
                  lx,
                  ly,
                  tileSize,
                  tileSize
                );
              } else {
                ctx.fillStyle = cfg.baseColorCss;
                ctx.fillRect(lx, ly, tileSize, tileSize);
              }

              if (cell.isRoad) {
                drawRoadTile(ctx, lx, ly, tileSize, cell);
              }
            }

            // Ground non-blocking decorations
            if (cell.decoration === 'bush1' && bush1Img) {
              ctx.drawImage(bush1Img, 0, 0, 128, 128, lx + 12, ly + 12, 40, 40);
            } else if (cell.decoration === 'bush2' && bush2Img) {
              ctx.drawImage(bush2Img, 0, 0, 128, 128, lx + 12, ly + 12, 40, 40);
            } else if (cell.decoration === 'pebble') {
              const pebbleImg = hash2D(cell.gx, cell.gy, 773) < 0.5 ? rock3Img : rock4Img;
              if (pebbleImg) {
                ctx.drawImage(pebbleImg, 0, 0, 64, 64, lx + 18, ly + 20, 28, 28);
              }
            } else if (cell.decoration === 'water_rock') {
              const wrImg = hash2D(cell.gx, cell.gy, 661) < 0.5 ? waterRock1Img : waterRock2Img;
              if (wrImg) {
                ctx.drawImage(wrImg, 0, 0, 64, 64, lx + 8, ly + 8, 48, 48);
              }
            }
          }
        }

        canvasTex.refresh();
        const worldOriginX = (minGx + startRx) * tileSize;
        const worldOriginY = (minGy + startRy) * tileSize;
        const chunkImg = this.scene.add
          .image(worldOriginX, worldOriginY, texKey)
          .setOrigin(0, 0)
          .setDepth(DEPTH.BACKGROUND);
        this.chunkImages.push(chunkImg);
      }
    }

    // Silence unused-import warning if helper is consumed externally
    void chunkPx;
    void getTerrainCellAtWorld;
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

  public renderTerritoryOverlays(islands: ReadonlyArray<Island>, inventory: Inventory): void {
    const g = this.overlayGraphics;
    g.clear();

    for (const isl of islands) {
      const origin = getIslandOrigin(isl.gridX, isl.gridY);
      if (isl.unlocked) {
        const plazaRadius = 56 + isl.villageTier * 8;
        g.fillStyle(0xa8a29e, 0.48);
        g.fillCircle(origin.x + 320, origin.y + 350, plazaRadius);
        g.lineStyle(3, 0x78716c, 0.58);
        g.strokeCircle(origin.x + 320, origin.y + 350, plazaRadius);

        g.lineStyle(2, 0x93c5fd, 0.28);
        g.strokeRect(origin.x, origin.y, TERRITORY_PX, TERRITORY_PX);

        for (let idx = 0; idx < TERRITORY_BUILD_SLOTS.length; idx++) {
          const slot = TERRITORY_BUILD_SLOTS[idx];
          const sx = origin.x + slot.relX;
          const sy = origin.y + slot.relY;
          if (slot.role === 'wall') {
            g.lineStyle(1.5, 0xfbbf24, 0.24);
            g.strokeCircle(sx, sy, 18);
          } else if (idx < 4 + VILLAGE_TIER_CONFIGS[isl.villageTier].maxBuildings) {
            g.lineStyle(1, 0x94a3b8, 0.22);
            g.strokeCircle(sx, sy, 16);
          }
        }
      } else {
        // Unoccupied build plot marker (reserved for constructing new villages)
        g.fillStyle(0x0f172a, 0.44);
        g.fillRect(origin.x, origin.y, TERRITORY_PX, TERRITORY_PX);

        const canAfford =
          inventory.wood >= isl.costWood &&
          inventory.stone >= isl.costStone &&
          inventory.gold >= isl.costGold;

        g.lineStyle(canAfford ? 3 : 2, canAfford ? 0x4ade80 : 0xfbbf24, canAfford ? 0.85 : 0.6);
        g.strokeRect(origin.x + 4, origin.y + 4, TERRITORY_PX - 8, TERRITORY_PX - 8);
      }
    }
  }

  public clearChunks(): void {
    for (const img of this.chunkImages) {
      img.destroy();
    }
    this.chunkImages = [];
  }
}
