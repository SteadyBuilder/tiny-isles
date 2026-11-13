/**
 * Touch gesture guard for on-screen mobile controls.
 *
 * Problem: Phaser registers window-level touches (even outside the canvas) as input pointers,
 * and the React pinch handler listens on window too. So holding the joystick with one thumb and
 * pressing ACTION with the other was interpreted as a 2-finger pinch zoom.
 *
 * Solution:
 *  1. Mark control zones with `GESTURE_BLOCK_ATTR`. Native (non-passive) touchstart/touchmove
 *     listeners call `preventDefault()`, and Phaser ignores `defaultPrevented` touch events.
 *  2. Pinch handlers only count touches that did NOT start inside a blocked zone.
 */

export const GESTURE_BLOCK_ATTR = 'data-gesture-block';

/** Spread onto a JSX element to mark it as a pinch-blocked control zone */
export const GESTURE_BLOCK_PROPS: Record<typeof GESTURE_BLOCK_ATTR, 'true'> = {
  [GESTURE_BLOCK_ATTR]: 'true',
};

/** True if the touch started inside a gesture-blocked control zone. Pure. */
export function isTouchInBlockedZone(touch: Touch): boolean {
  const target = touch.target;
  return target instanceof Element && target.closest(`[${GESTURE_BLOCK_ATTR}]`) !== null;
}

/** Touches eligible for pinch zoom (i.e. not started on a control). Pure. */
export function getPinchEligibleTouches(touches: TouchList): Touch[] {
  return Array.from(touches).filter((t) => !isTouchInBlockedZone(t));
}

/** Euclidean distance between two touches. Pure. */
export function getTouchDistance(a: Touch, b: Touch): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

/**
 * Attach native non-passive listeners that mark control touches as handled so Phaser
 * (and browser default gestures) ignore them. React/pointer handlers still receive the events.
 * Returns a cleanup function.
 */
export function attachGestureBlock(el: HTMLElement): () => void {
  const block = (e: TouchEvent): void => {
    if (e.cancelable) e.preventDefault();
  };
  el.addEventListener('touchstart', block, { passive: false });
  el.addEventListener('touchmove', block, { passive: false });
  return () => {
    el.removeEventListener('touchstart', block);
    el.removeEventListener('touchmove', block);
  };
}
