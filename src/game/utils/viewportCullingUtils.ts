export interface ViewportRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/**
 * 카메라 월드 뷰 영역에 여유 마진(marginPx)을 확장한 컬링 박스를 계산하는 순수 함수
 */
export function expandViewportRect(
  x: number,
  y: number,
  width: number,
  height: number,
  marginPx: number
): ViewportRect {
  return {
    left: x - marginPx,
    top: y - marginPx,
    right: x + width + marginPx,
    bottom: y + height + marginPx,
  };
}

/**
 * 특정 월드 좌표(점)가 확장된 뷰포트 박스 내부에 포함되는지 판정하는 순수 함수
 */
export function isPointInViewport(
  wx: number,
  wy: number,
  viewport: ViewportRect,
  objectPaddingPx: number = 0
): boolean {
  return (
    wx + objectPaddingPx >= viewport.left &&
    wx - objectPaddingPx <= viewport.right &&
    wy + objectPaddingPx >= viewport.top &&
    wy - objectPaddingPx <= viewport.bottom
  );
}

/**
 * 사각형 영역(청크 등)이 확장된 뷰포트 박스와 교차하는지 판정하는 순수 함수
 */
export function isRectInViewport(
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  viewport: ViewportRect
): boolean {
  return (
    rx + rw >= viewport.left &&
    rx <= viewport.right &&
    ry + rh >= viewport.top &&
    ry <= viewport.bottom
  );
}
