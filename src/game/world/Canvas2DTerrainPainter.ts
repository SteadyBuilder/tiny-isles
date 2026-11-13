import { BIOME_CONFIGS } from '../../data/biomes';
import { GameAssets } from '../AssetLoader';
import { TerrainCell, WorldTerrainMap } from './MapTerrainGenerator';
import { hash2D } from './TerrainNoise';

function isWaterTile(terrain: WorldTerrainMap, gx: number, gy: number): boolean {
  const rx = gx - terrain.minGx;
  const ry = gy - terrain.minGy;
  if (rx < 0 || rx >= terrain.cols || ry < 0 || ry >= terrain.rows) return false;
  const cell = terrain.cells[ry * terrain.cols + rx];
  return cell.biome === 'water' || cell.isBridge;
}

function getBiomeImage(assets: GameAssets, tilemapKey: string): HTMLImageElement | null {
  switch (tilemapKey) {
    case 'tilemap2':
      return assets.tilemap2;
    case 'tilemap4':
      return assets.tilemap4;
    case 'tilemap5':
      return assets.tilemap5;
    case 'tilemap1':
    default:
      return assets.tilemap;
  }
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
    ctx.fillStyle = '#5c3317';
    ctx.fillRect(lx, ly + pad, tileSize, 6);
    ctx.fillRect(lx, ly + tileSize - pad - 6, tileSize, 6);
    for (let px = 2; px < tileSize; px += 10) {
      ctx.fillStyle = px % 20 === 2 ? '#b4743b' : '#9c5f2b';
      ctx.fillRect(lx + px, ly + pad + 4, 8, tileSize - (pad + 4) * 2);
      ctx.fillStyle = '#6b3e19';
      ctx.fillRect(lx + px, ly + pad + 4, 8, 2);
    }
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
  const r = hash2D(cell.gx, cell.gy, 5519);
  if (r < 0.6) {
    ctx.fillStyle = 'rgba(120, 113, 108, 0.45)';
    ctx.fillRect(lx + 14 + Math.floor(r * 24), ly + 18, 5, 4);
    ctx.fillRect(lx + 38 - Math.floor(r * 16), ly + 40, 4, 4);
  }
}

/**
 * Draws the visible viewport slice of the procedural Necesse-style biome terrain onto a Canvas 2D context.
 */
export function drawVisibleTerrain2D(
  ctx: CanvasRenderingContext2D,
  terrain: WorldTerrainMap,
  assets: GameAssets,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): void {
  const { tileSize, minGx, minGy, cols, rows } = terrain;
  const startRx = Math.max(0, Math.floor(minX / tileSize) - minGx);
  const endRx = Math.min(cols - 1, Math.ceil(maxX / tileSize) - minGx);
  const startRy = Math.max(0, Math.floor(minY / tileSize) - minGy);
  const endRy = Math.min(rows - 1, Math.ceil(maxY / tileSize) - minGy);

  const bridgeOrientations = new Map<string, 'h' | 'v'>();
  for (const b of terrain.bridges) {
    bridgeOrientations.set(`${b.gx},${b.gy}`, b.orientation);
  }

  for (let ry = startRy; ry <= endRy; ry++) {
    for (let rx = startRx; rx <= endRx; rx++) {
      const cell = terrain.cells[ry * cols + rx];
      const lx = cell.worldX;
      const ly = cell.worldY;

      if (cell.biome === 'water' || cell.isBridge) {
        if (assets.waterBg && assets.waterBg.complete) {
          ctx.drawImage(assets.waterBg, 0, 0, 64, 64, lx, ly, tileSize, tileSize);
        } else {
          ctx.fillStyle = BIOME_CONFIGS.water.baseColorCss;
          ctx.fillRect(lx, ly, tileSize, tileSize);
        }

        if (cell.biome === 'water' && hash2D(cell.gx, cell.gy, 881) < 0.28) {
          ctx.fillStyle = 'rgba(224, 242, 254, 0.24)';
          ctx.fillRect(lx + 16, ly + 28, 18, 3);
        }

        if (cell.isBridge) {
          drawBridgeTile(
            ctx,
            lx,
            ly,
            tileSize,
            bridgeOrientations.get(`${cell.gx},${cell.gy}`) || 'h'
          );
        }
      } else {
        const cfg = BIOME_CONFIGS[cell.biome];
        const sheetImg = getBiomeImage(assets, cfg.tilemapKey);

        const wLeft = isWaterTile(terrain, cell.gx - 1, cell.gy);
        const wRight = isWaterTile(terrain, cell.gx + 1, cell.gy);
        const wTop = isWaterTile(terrain, cell.gx, cell.gy - 1);
        const wBottom = isWaterTile(terrain, cell.gx, cell.gy + 1);

        if ((wLeft || wRight || wTop || wBottom) && assets.waterBg?.complete) {
          ctx.drawImage(assets.waterBg, 0, 0, 64, 64, lx, ly, tileSize, tileSize);
        }

        if (sheetImg && sheetImg.complete) {
          const tileCol = wLeft && wRight ? 3 : wLeft ? 0 : wRight ? 2 : cfg.interiorTileCol;
          const tileRow = wTop && wBottom ? 3 : wTop ? 0 : wBottom ? 2 : cfg.interiorTileRow;
          ctx.drawImage(sheetImg, tileCol * 64, tileRow * 64, 64, 64, lx, ly, tileSize, tileSize);
        } else {
          ctx.fillStyle = cfg.baseColorCss;
          ctx.fillRect(lx, ly, tileSize, tileSize);
        }

        if (cell.isRoad) {
          drawRoadTile(ctx, lx, ly, tileSize, cell);
        }
      }

      if (cell.decoration === 'bush1' && assets.bush?.complete) {
        ctx.drawImage(assets.bush, 0, 0, 128, 128, lx + 12, ly + 12, 40, 40);
      } else if (cell.decoration === 'bush2' && assets.bush2?.complete) {
        ctx.drawImage(assets.bush2, 0, 0, 128, 128, lx + 12, ly + 12, 40, 40);
      } else if (cell.decoration === 'pebble') {
        const pebbleImg = hash2D(cell.gx, cell.gy, 773) < 0.5 ? assets.rock3 : assets.rock4;
        if (pebbleImg?.complete) {
          ctx.drawImage(pebbleImg, 0, 0, 64, 64, lx + 18, ly + 20, 28, 28);
        }
      } else if (cell.decoration === 'water_rock') {
        const wrImg =
          hash2D(cell.gx, cell.gy, 661) < 0.5 ? assets.waterRock1 : assets.waterRock2;
        if (wrImg?.complete) {
          ctx.drawImage(wrImg, 0, 0, 64, 64, lx + 8, ly + 8, 48, 48);
        }
      }
    }
  }
}
