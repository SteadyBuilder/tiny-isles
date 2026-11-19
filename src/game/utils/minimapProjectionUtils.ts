import { WorldBounds } from '../worldBounds';
import {
  MinimapCameraRect,
  MinimapProjectedPoint,
  MinimapViewMode,
  MinimapViewport,
} from '../../types/minimap';

/**
 * 미니맵 뷰 모드(전체 월드 / 주변 레이더)에 따른 월드 가시 영역을 계산하는 순수 함수.
 * 레이더 모드에서는 플레이어를 중심으로 하되 월드 경계 밖으로 벗어나지 않도록 클램핑한다.
 */
export function computeMinimapViewport(
  mode: MinimapViewMode,
  worldBounds: WorldBounds,
  playerPos: { x: number; y: number },
  radarRadiusPx: number
): MinimapViewport {
  if (mode === 'world') {
    return {
      minX: worldBounds.min,
      minY: worldBounds.min,
      width: worldBounds.width,
      height: worldBounds.width,
    };
  }

  const diameter = Math.min(worldBounds.width, Math.max(1, radarRadiusPx * 2));
  const half = diameter / 2;
  const maxMin = worldBounds.max - diameter;

  const minX = Math.max(worldBounds.min, Math.min(maxMin, playerPos.x - half));
  const minY = Math.max(worldBounds.min, Math.min(maxMin, playerPos.y - half));

  return {
    minX,
    minY,
    width: diameter,
    height: diameter,
  };
}

/**
 * 월드 좌표를 미니맵 캔버스 좌표(0 ~ canvasSize)로 투영하는 순수 함수.
 * clampToEdge가 true이면 뷰포트 바깥 좌표도 가장자리 여백 안쪽에 고정해 방향을 표시한다.
 */
export function worldToMinimapPoint(
  worldX: number,
  worldY: number,
  viewport: MinimapViewport,
  canvasSize: number,
  clampToEdge = false,
  edgePaddingPx = 5
): MinimapProjectedPoint {
  const safeW = Math.max(1, viewport.width);
  const safeH = Math.max(1, viewport.height);
  const rawX = ((worldX - viewport.minX) / safeW) * canvasSize;
  const rawY = ((worldY - viewport.minY) / safeH) * canvasSize;

  const isOutOfBounds = rawX < 0 || rawX > canvasSize || rawY < 0 || rawY > canvasSize;
  if (!clampToEdge) {
    return {
      x: rawX,
      y: rawY,
      isClamped: isOutOfBounds,
    };
  }

  const minCoord = Math.min(edgePaddingPx, canvasSize / 2);
  const maxCoord = Math.max(minCoord, canvasSize - edgePaddingPx);
  const clampedX = Math.max(minCoord, Math.min(maxCoord, rawX));
  const clampedY = Math.max(minCoord, Math.min(maxCoord, rawY));

  return {
    x: clampedX,
    y: clampedY,
    isClamped: clampedX !== rawX || clampedY !== rawY,
  };
}

/**
 * 월드 사각형(영지, 수역, 카메라 뷰)을 미니맵 캔버스 사각형으로 투영하는 순수 함수.
 */
export function worldRectToMinimapRect(
  rect: MinimapCameraRect,
  viewport: MinimapViewport,
  canvasSize: number
): MinimapCameraRect {
  const scaleX = canvasSize / Math.max(1, viewport.width);
  const scaleY = canvasSize / Math.max(1, viewport.height);
  return {
    x: (rect.x - viewport.minX) * scaleX,
    y: (rect.y - viewport.minY) * scaleY,
    width: rect.width * scaleX,
    height: rect.height * scaleY,
  };
}

/**
 * 화면 크기에 따라 모바일 저높이 가로모드(자동 접힘 대상)인지 판별하는 순수 함수.
 */
export function shouldAutoCollapseMinimap(
  viewportWidth: number,
  viewportHeight: number,
  mobileBreakpointPx: number,
  compactLandscapeMaxHeightPx: number
): boolean {
  return viewportWidth < mobileBreakpointPx && viewportHeight <= compactLandscapeMaxHeightPx;
}
