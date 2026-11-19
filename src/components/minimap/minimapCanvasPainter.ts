import { MINIMAP_CONFIG } from '../../data/minimapConfig';
import { getIslandOrigin, TERRITORY_PX } from '../../game/world/territoryGrid';
import { WORLD_BOUNDS, WorldBounds } from '../../game/worldBounds';
import {
  computeMinimapViewport,
  worldRectToMinimapRect,
  worldToMinimapPoint,
} from '../../game/utils/minimapProjectionUtils';
import { Island } from '../../types/game';
import {
  MinimapDynamicSnapshot,
  MinimapTerrainBakePayload,
  MinimapViewMode,
} from '../../types/minimap';

export interface BakedMinimapTerrain {
  canvas: HTMLCanvasElement;
  bounds: WorldBounds;
}

/**
 * 정적 월드 지형(바이옴, 도로, 수역, 다리, 금광)을 오프스크린 캔버스에 1회 베이크한다.
 */
export function bakeTerrainToOffscreenCanvas(
  terrain: MinimapTerrainBakePayload
): BakedMinimapTerrain | null {
  if (typeof document === 'undefined') return null;
  const size = MINIMAP_CONFIG.terrainBakeResolution;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const { bounds, tileSize, sampleStep, cells, waterBodies, bridges, goldMineZone } = terrain;
  const scale = size / Math.max(1, bounds.width);

  ctx.fillStyle = MINIMAP_CONFIG.palette.background;
  ctx.fillRect(0, 0, size, size);

  const normalCellPx = Math.max(1.5, tileSize * sampleStep * scale + 0.6);
  const roadCellPx = Math.max(1.5, tileSize * scale + 0.6);

  // 1. 바이옴 바탕 셀
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (cell.isRoad) continue;
    const cx = (cell.worldX - bounds.min) * scale;
    const cy = (cell.worldY - bounds.min) * scale;
    ctx.fillStyle = MINIMAP_CONFIG.biomeColors[cell.biome] ?? MINIMAP_CONFIG.palette.background;
    const sz = cell.isVillagePlot ? roadCellPx : normalCellPx;
    ctx.fillRect(cx - sz * 0.5, cy - sz * 0.5, sz, sz);
  }

  // 2. 수역
  ctx.fillStyle = MINIMAP_CONFIG.palette.waterFill;
  for (let i = 0; i < waterBodies.length; i++) {
    const w = waterBodies[i];
    ctx.fillRect(
      (w.x - bounds.min) * scale,
      (w.y - bounds.min) * scale,
      Math.max(2, w.w * scale),
      Math.max(2, w.h * scale)
    );
  }

  // 3. 도로
  ctx.fillStyle = MINIMAP_CONFIG.palette.roadFill;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (!cell.isRoad) continue;
    const cx = (cell.worldX - bounds.min) * scale;
    const cy = (cell.worldY - bounds.min) * scale;
    ctx.fillRect(cx - roadCellPx * 0.5, cy - roadCellPx * 0.5, roadCellPx, roadCellPx);
  }

  // 4. 다리
  ctx.fillStyle = MINIMAP_CONFIG.palette.bridgeFill;
  for (let i = 0; i < bridges.length; i++) {
    const b = bridges[i];
    ctx.fillRect(
      (b.x - bounds.min) * scale,
      (b.y - bounds.min) * scale,
      Math.max(2, b.w * scale),
      Math.max(2, b.h * scale)
    );
  }

  // 5. 금광 지대 강조
  if (goldMineZone) {
    const gx = (goldMineZone.centerX - bounds.min) * scale;
    const gy = (goldMineZone.centerY - bounds.min) * scale;
    const gr = Math.max(4, goldMineZone.radiusPx * scale);
    ctx.beginPath();
    ctx.arc(gx, gy, gr, 0, Math.PI * 2);
    ctx.fillStyle = MINIMAP_CONFIG.palette.goldMineFill;
    ctx.fill();
    ctx.strokeStyle = MINIMAP_CONFIG.palette.goldMineStroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  return { canvas, bounds };
}

/**
 * 실시간 미니맵 1프레임을 2D 캔버스에 렌더링한다.
 */
export function renderMinimapFrame(
  ctx: CanvasRenderingContext2D,
  bakedTerrain: BakedMinimapTerrain | null,
  territories: Island[],
  unlockedIslandIds: number[],
  snapshot: MinimapDynamicSnapshot | null,
  viewMode: MinimapViewMode,
  canvasSize: number,
  nowMs: number
): void {
  const bounds = bakedTerrain?.bounds ?? WORLD_BOUNDS;
  const playerPos = snapshot?.player ?? { x: 640, y: 640 };
  const viewport = computeMinimapViewport(
    viewMode,
    bounds,
    playerPos,
    MINIMAP_CONFIG.radarRadiusPx
  );
  const markerScale = Math.max(0.68, canvasSize / MINIMAP_CONFIG.desktopCanvasSize);
  const pulse = 0.5 + 0.5 * Math.sin(nowMs / 240);
  const { palette, markerBaseSizes, edgeClampPaddingPx } = MINIMAP_CONFIG;

  ctx.clearRect(0, 0, canvasSize, canvasSize);

  // 1. 정적 지형 레이어 (오프스크린 캐시에서 크롭 복사)
  if (bakedTerrain) {
    const srcSize = bakedTerrain.canvas.width;
    const sx = ((viewport.minX - bounds.min) / bounds.width) * srcSize;
    const sy = ((viewport.minY - bounds.min) / bounds.width) * srcSize;
    const sw = (viewport.width / bounds.width) * srcSize;
    const sh = (viewport.height / bounds.width) * srcSize;
    ctx.drawImage(bakedTerrain.canvas, sx, sy, sw, sh, 0, 0, canvasSize, canvasSize);
  } else {
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, canvasSize, canvasSize);
  }

  // 2. 영지 구역 및 몬스터 부락 레이어
  for (let i = 0; i < territories.length; i++) {
    const isl = territories[i];
    const origin = getIslandOrigin(isl.gridX, isl.gridY);
    const rect = worldRectToMinimapRect(
      { x: origin.x, y: origin.y, width: TERRITORY_PX, height: TERRITORY_PX },
      viewport,
      canvasSize
    );
    if (
      rect.x + rect.width < 0 ||
      rect.y + rect.height < 0 ||
      rect.x > canvasSize ||
      rect.y > canvasSize
    ) {
      continue;
    }

    const isUnlocked = isl.id === 0 || isl.unlocked || unlockedIslandIds.includes(isl.id);
    const isCamp = Boolean(isl.isMonsterCamp);
    const campCleared = Boolean(isl.campDestroyed);

    if (isl.id === 0) {
      ctx.fillStyle = palette.centerTerritoryFill;
      ctx.strokeStyle = palette.centerTerritoryStroke;
    } else if (isUnlocked) {
      ctx.fillStyle = palette.unlockedTerritoryFill;
      ctx.strokeStyle = palette.unlockedTerritoryStroke;
    } else if (isCamp) {
      ctx.fillStyle = campCleared ? palette.campClearedFill : palette.campActiveFill;
      ctx.strokeStyle = campCleared ? palette.campClearedStroke : palette.campActiveStroke;
    } else {
      ctx.fillStyle = palette.lockedTerritoryFill;
      ctx.strokeStyle = palette.lockedTerritoryStroke;
    }

    ctx.lineWidth = isl.id === 0 ? 1.5 : 1;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

    // 코어 피격 경고 (점령 영지 코어 HP가 95% 미만일 때)
    if (
      isUnlocked &&
      typeof isl.coreHp === 'number' &&
      typeof isl.coreMaxHp === 'number' &&
      isl.coreMaxHp > 0 &&
      isl.coreHp < isl.coreMaxHp * 0.95
    ) {
      const cx = rect.x + rect.width * 0.5;
      const cy = rect.y + rect.height * 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(4, rect.width * 0.45) + pulse * 2.5, 0, Math.PI * 2);
      ctx.strokeStyle = palette.coreWarningStroke;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
  }

  if (!snapshot) return;

  // 3. 던전 포탈 마커 (사냥 모드)
  if (snapshot.dungeonPortal?.active) {
    const pt = worldToMinimapPoint(
      snapshot.dungeonPortal.x,
      snapshot.dungeonPortal.y,
      viewport,
      canvasSize,
      viewMode === 'radar',
      edgeClampPaddingPx
    );
    const r = markerBaseSizes.portalRadius * markerScale;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r + 1.5 + pulse * 2, 0, Math.PI * 2);
    ctx.strokeStyle = palette.portalRingStroke;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fillStyle = palette.portalFill;
    ctx.fill();
  }

  // 4. 침공 마물 및 보스 마커
  const monsterR = Math.max(1.5, markerBaseSizes.monsterRadius * markerScale);
  const bossR = markerBaseSizes.bossRadius * markerScale;
  for (let i = 0; i < snapshot.monsters.length; i++) {
    const m = snapshot.monsters[i];
    if (m.isBoss) {
      const pt = worldToMinimapPoint(
        m.x,
        m.y,
        viewport,
        canvasSize,
        viewMode === 'radar',
        edgeClampPaddingPx
      );
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, bossR + 1.5 + pulse * 2.2, 0, Math.PI * 2);
      ctx.strokeStyle = palette.bossRingStroke;
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, bossR, 0, Math.PI * 2);
      ctx.fillStyle = palette.bossFill;
      ctx.fill();
    } else {
      const pt = worldToMinimapPoint(m.x, m.y, viewport, canvasSize, false);
      if (pt.isClamped) continue;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, monsterR, 0, Math.PI * 2);
      ctx.fillStyle = palette.monsterFill;
      ctx.fill();
    }
  }

  // 5. 멀티플레이 팀원(원격 플레이어) 마커 — 레이더 모드 범위 밖에서도 가장자리 고정 표시
  const mateR = markerBaseSizes.teammateRadius * markerScale;
  const showTeammateLabels = canvasSize >= 140;
  for (let i = 0; i < snapshot.teammates.length; i++) {
    const mate = snapshot.teammates[i];
    const pt = worldToMinimapPoint(
      mate.x,
      mate.y,
      viewport,
      canvasSize,
      viewMode === 'radar',
      edgeClampPaddingPx
    );

    ctx.beginPath();
    ctx.arc(pt.x, pt.y, mateR, 0, Math.PI * 2);
    ctx.fillStyle = mate.isFainted
      ? palette.teammateFaintedFill
      : palette.teammateColorFill[mate.color] ?? palette.teammateColorFill.blue;
    ctx.fill();
    ctx.strokeStyle = mate.isFainted ? '#ef4444' : palette.teammateRingStroke;
    ctx.lineWidth = pt.isClamped ? 1.8 : 1.4;
    ctx.stroke();

    if (showTeammateLabels && !pt.isClamped && mate.name) {
      const shortName = mate.name.length > 4 ? `${mate.name.slice(0, 4)}` : mate.name;
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      const textW = ctx.measureText(shortName).width + 4;
      ctx.fillRect(pt.x - textW / 2, pt.y - mateR - 11, textW, 9);
      ctx.fillStyle = '#fef9c3';
      ctx.fillText(shortName, pt.x, pt.y - mateR - 2);
    }
  }

  // 6. 카메라 시야 사각형
  const camRect = worldRectToMinimapRect(snapshot.cameraView, viewport, canvasSize);
  ctx.fillStyle = palette.cameraViewFill;
  ctx.strokeStyle = palette.cameraViewStroke;
  ctx.lineWidth = 1;
  ctx.fillRect(camRect.x, camRect.y, camRect.width, camRect.height);
  ctx.strokeRect(camRect.x, camRect.y, camRect.width, camRect.height);

  // 7. 로컬 플레이어 마커 (최상위 레이어)
  const playerPt = worldToMinimapPoint(
    snapshot.player.x,
    snapshot.player.y,
    viewport,
    canvasSize,
    true,
    4
  );
  const playerR = markerBaseSizes.playerRadius * markerScale;
  ctx.beginPath();
  ctx.arc(playerPt.x, playerPt.y, playerR, 0, Math.PI * 2);
  ctx.fillStyle = snapshot.player.isFainted
    ? palette.localPlayerFaintedFill
    : palette.localPlayerFill;
  ctx.fill();
  ctx.strokeStyle = palette.localPlayerStroke;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // 바라보는 방향 미니 화살표
  const dirSign = snapshot.player.direction === 'left' ? -1 : 1;
  ctx.beginPath();
  ctx.moveTo(playerPt.x + dirSign * (playerR + 3.2), playerPt.y);
  ctx.lineTo(playerPt.x + dirSign * (playerR - 0.5), playerPt.y - 2.3);
  ctx.lineTo(playerPt.x + dirSign * (playerR - 0.5), playerPt.y + 2.3);
  ctx.closePath();
  ctx.fillStyle = palette.localPlayerStroke;
  ctx.fill();
}
