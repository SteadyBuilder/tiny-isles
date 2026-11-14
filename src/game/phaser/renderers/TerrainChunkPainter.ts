import Phaser from 'phaser';
import { BIOME_CONFIGS } from '../../../data/biomes';
import { DEPTH } from '../../depthLayers';
import { TerrainCell, WorldTerrainMap } from '../../world/MapTerrainGenerator';
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
): void {
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
): void {
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

export interface BakedTerrainChunks {
  chunkImages: Phaser.GameObjects.Image[];
  chunkTexKeys: string[];
}

/**
 * 바이옴 타일맵·해안선·다리·도로·지면 장식을 CanvasTexture 청크로 베이크하는 전담 페인터
 */
export function bakeTerrainChunkTextures(
  scene: Phaser.Scene,
  terrain: WorldTerrainMap
): BakedTerrainChunks {
  const { tileSize, minGx, minGy, cols, rows } = terrain;
  const numChunksX = Math.ceil(cols / CHUNK_TILES);
  const numChunksY = Math.ceil(rows / CHUNK_TILES);

  const waterImg = getSourceImage(scene, 'waterBg');
  const bush1Img = getSourceImage(scene, 'bush');
  const bush2Img = getSourceImage(scene, 'bush2');
  const rock3Img = getSourceImage(scene, 'rock3');
  const rock4Img = getSourceImage(scene, 'rock4');
  const waterRock1Img = getSourceImage(scene, 'waterRock1');
  const waterRock2Img = getSourceImage(scene, 'waterRock2');

  const chunkImages: Phaser.GameObjects.Image[] = [];
  const chunkTexKeys: string[] = [];

  for (let cy = 0; cy < numChunksY; cy++) {
    for (let cx = 0; cx < numChunksX; cx++) {
      const startRx = cx * CHUNK_TILES;
      const startRy = cy * CHUNK_TILES;
      const chunkCols = Math.min(CHUNK_TILES, cols - startRx);
      const chunkRows = Math.min(CHUNK_TILES, rows - startRy);
      const w = chunkCols * tileSize;
      const h = chunkRows * tileSize;
      const texKey = `terrain_chunk_${cx}_${cy}`;

      if (scene.textures.exists(texKey)) {
        scene.textures.remove(texKey);
      }

      const canvasTex = scene.textures.createCanvas(texKey, w, h);
      if (!canvasTex) continue;
      const ctx = canvasTex.getContext();

      for (let ty = 0; ty < chunkRows; ty++) {
        for (let tx = 0; tx < chunkCols; tx++) {
          const rx = startRx + tx;
          const ry = startRy + ty;
          const cell = terrain.cells[ry * cols + rx];
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
              const bridgeSeg = terrain.bridges.find(
                (b) => b.gx === cell.gx && b.gy === cell.gy
              );
              drawBridgeTile(ctx, lx, ly, tileSize, bridgeSeg?.orientation || 'h');
            }
          } else {
            const cfg = BIOME_CONFIGS[cell.biome];
            const sheetImg = getSourceImage(scene, cfg.tilemapKey);

            const wLeft = isWaterTile(terrain, cell.gx - 1, cell.gy);
            const wRight = isWaterTile(terrain, cell.gx + 1, cell.gy);
            const wTop = isWaterTile(terrain, cell.gx, cell.gy - 1);
            const wBottom = isWaterTile(terrain, cell.gx, cell.gy + 1);

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
      const chunkImg = scene.add
        .image(worldOriginX, worldOriginY, texKey)
        .setOrigin(0, 0)
        .setDepth(DEPTH.BACKGROUND);
      chunkImages.push(chunkImg);
      chunkTexKeys.push(texKey);
    }
  }

  return { chunkImages, chunkTexKeys };
}
