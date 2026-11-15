import { RESOURCE_INTERACTION_RULES } from '../../data/resourceInteraction';
import { Entity } from '../../types/game';

export interface WorldRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

export interface SpriteBoundsInput {
  x: number;
  y: number;
  displayWidth: number;
  displayHeight: number;
  originX: number;
  originY: number;
}

/**
 * 컨테이너 좌표와 내부 스프라이트 메타데이터로부터 월드 AABB를 계산하는 순수 함수
 */
export function getSpriteWorldRect(
  sprite: SpriteBoundsInput,
  containerX: number,
  containerY: number
): WorldRect {
  const worldX = containerX + sprite.x;
  const worldY = containerY + sprite.y;
  const left = worldX - sprite.displayWidth * sprite.originX;
  const top = worldY - sprite.displayHeight * sprite.originY;
  const right = left + sprite.displayWidth;
  const bottom = top + sprite.displayHeight;

  return {
    left,
    top,
    right,
    bottom,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  };
}

/**
 * 자원 스프라이트 월드 영역에서 실제 채집 가능한 본체(밑동/몸통) AABB를 계산하는 순수 함수
 */
export function getResourceGatherRect(
  entityType: Entity['type'],
  spriteRect: WorldRect
): WorldRect {
  const { gatherRectRatio } = RESOURCE_INTERACTION_RULES[entityType];
  const fullW = spriteRect.right - spriteRect.left;
  const fullH = spriteRect.bottom - spriteRect.top;

  const targetW = fullW * gatherRectRatio.widthRatio;
  const targetH = fullH * gatherRectRatio.heightRatio;

  const left = spriteRect.centerX - targetW / 2;
  const right = spriteRect.centerX + targetW / 2;

  let top: number;
  let bottom: number;
  if (gatherRectRatio.anchorY === 'bottom') {
    bottom = spriteRect.bottom;
    top = bottom - targetH;
  } else {
    top = spriteRect.centerY - targetH / 2;
    bottom = spriteRect.centerY + targetH / 2;
  }

  return {
    left,
    top,
    right,
    bottom,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  };
}

/**
 * 점 (px, py)와 사각형(WorldRect) 사이의 최단 유클리드 거리를 반환 (내부면 0)
 */
export function distancePointToRect(px: number, py: number, rect: WorldRect): number {
  const clampedX = Math.max(rect.left, Math.min(px, rect.right));
  const clampedY = Math.max(rect.top, Math.min(py, rect.bottom));
  return Math.hypot(px - clampedX, py - clampedY);
}

/**
 * 점 (px, py)가 사각형 경계 + marginPx 이내에 있는지 판정
 */
export function isPointWithinRectMargin(
  px: number,
  py: number,
  rect: WorldRect,
  marginPx: number
): boolean {
  return distancePointToRect(px, py, rect) <= marginPx;
}
