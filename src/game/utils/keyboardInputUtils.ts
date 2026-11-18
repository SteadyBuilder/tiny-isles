/**
 * 게임 키보드 입력 매핑 및 판별을 위한 순수 유틸리티 모듈.
 *
 * Phaser 기본 KeyboardPlugin은 deprecated `event.keyCode`에 의존하므로
 * 한글 IME 활성 상태(`keyCode === 229`), UI 버튼 포커스 잔류, 탭 전환/일시정지 시
 * 키 먹통 또는 키 고착(stuck key) 현상이 발생할 수 있다.
 * 물리 키 코드(`event.code`) 기반으로 일관되게 판별한다.
 */

export type GameKeyAction =
  | 'move_up'
  | 'move_down'
  | 'move_left'
  | 'move_right'
  | 'interact'
  | 'skill'
  | 'inventory'
  | 'dash';

export interface KeyEventLike {
  code?: string;
  key?: string;
  repeat?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  target?: EventTarget | null;
  preventDefault?: () => void;
}

export const CODE_TO_GAME_ACTION: Readonly<Record<string, GameKeyAction>> = {
  ArrowUp: 'move_up',
  KeyW: 'move_up',
  ArrowDown: 'move_down',
  KeyS: 'move_down',
  ArrowLeft: 'move_left',
  KeyA: 'move_left',
  ArrowRight: 'move_right',
  KeyD: 'move_right',
  Space: 'interact',
  KeyE: 'interact',
  KeyQ: 'skill',
  KeyI: 'inventory',
  ShiftLeft: 'dash',
  ShiftRight: 'dash',
};

const KEY_FALLBACK_TO_GAME_ACTION: Readonly<Record<string, GameKeyAction>> = {
  ArrowUp: 'move_up',
  ArrowDown: 'move_down',
  ArrowLeft: 'move_left',
  ArrowRight: 'move_right',
  w: 'move_up',
  W: 'move_up',
  s: 'move_down',
  S: 'move_down',
  a: 'move_left',
  A: 'move_left',
  d: 'move_right',
  D: 'move_right',
  ' ': 'interact',
  e: 'interact',
  E: 'interact',
  q: 'skill',
  Q: 'skill',
  i: 'inventory',
  I: 'inventory',
  Shift: 'dash',
};

const PREVENT_DEFAULT_CODES: ReadonlySet<string> = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
]);

const EDITABLE_TAG_NAMES: ReadonlySet<string> = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

interface EditableTargetLike {
  tagName?: string;
  isContentEditable?: boolean;
}

/**
 * 텍스트 입력창, 슬라이더, 셀렉트 박스 등 브라우저 자체 키 입력이 필요한 요소인지 판별한다.
 */
export function isEditableDomTarget(target: EventTarget | null | undefined): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as EditableTargetLike;
  if (el.isContentEditable) return true;
  if (typeof el.tagName === 'string' && EDITABLE_TAG_NAMES.has(el.tagName.toUpperCase())) {
    return true;
  }
  return false;
}

/**
 * 브라우저/OS 단축키 조합(Ctrl/Alt/Meta)이 눌린 상태인지 판별한다.
 * Shift는 게임 내 대시(Dash) 키로 사용되므로 제외한다.
 */
export function hasBlockingModifier(event: Pick<KeyEventLike, 'ctrlKey' | 'altKey' | 'metaKey'>): boolean {
  return Boolean(event.ctrlKey || event.altKey || event.metaKey);
}

/**
 * 키보드 이벤트에서 물리 키(`code`)를 우선해 게임 액션을 해석한다.
 * 한글 IME 활성 시 `event.key`가 `'Process'`이거나 한글 자모여도 `event.code`로 정상 인식된다.
 */
export function resolveGameKeyAction(event: Pick<KeyEventLike, 'code' | 'key'>): GameKeyAction | null {
  if (event.code && event.code in CODE_TO_GAME_ACTION) {
    return CODE_TO_GAME_ACTION[event.code];
  }
  if (event.key && event.key in KEY_FALLBACK_TO_GAME_ACTION) {
    return KEY_FALLBACK_TO_GAME_ACTION[event.key];
  }
  return null;
}

/**
 * 이벤트에서 pressedCodes 집합의 키로 사용할 정규화 식별자를 반환한다.
 */
export function resolveNormalizedKeyToken(event: Pick<KeyEventLike, 'code' | 'key'>): string | null {
  if (event.code && event.code in CODE_TO_GAME_ACTION) {
    return event.code;
  }
  if (event.key && event.key in KEY_FALLBACK_TO_GAME_ACTION) {
    const action = KEY_FALLBACK_TO_GAME_ACTION[event.key];
    switch (action) {
      case 'move_up':
        return event.key === 'ArrowUp' ? 'ArrowUp' : 'KeyW';
      case 'move_down':
        return event.key === 'ArrowDown' ? 'ArrowDown' : 'KeyS';
      case 'move_left':
        return event.key === 'ArrowLeft' ? 'ArrowLeft' : 'KeyA';
      case 'move_right':
        return event.key === 'ArrowRight' ? 'ArrowRight' : 'KeyD';
      case 'interact':
        return event.key === ' ' ? 'Space' : 'KeyE';
      case 'skill':
        return 'KeyQ';
      case 'inventory':
        return 'KeyI';
      case 'dash':
        return 'ShiftLeft';
    }
  }
  return null;
}

/**
 * 방향키·스페이스바처럼 브라우저 기본 스크롤이나 포커스 버튼 클릭을 유발하는 키인지 판별한다.
 */
export function shouldPreventDefaultForGameKey(code: string): boolean {
  return PREVENT_DEFAULT_CODES.has(code);
}

/**
 * 현재 눌려 있는 물리 키 집합으로부터 이동 방향 벡터(-1 ~ 1)를 계산한다.
 */
export function resolveDirectionalVectorFromCodes(pressedCodes: ReadonlySet<string>): {
  vx: number;
  vy: number;
} {
  let vx = 0;
  let vy = 0;
  if (pressedCodes.has('ArrowLeft') || pressedCodes.has('KeyA')) vx -= 1;
  if (pressedCodes.has('ArrowRight') || pressedCodes.has('KeyD')) vx += 1;
  if (pressedCodes.has('ArrowUp') || pressedCodes.has('KeyW')) vy -= 1;
  if (pressedCodes.has('ArrowDown') || pressedCodes.has('KeyS')) vy += 1;
  return { vx, vy };
}

/**
 * 상호작용 홀드 입력(Space / E)이 유지되고 있는지 판별한다.
 */
export function isInteractHoldActive(pressedCodes: ReadonlySet<string>): boolean {
  return pressedCodes.has('Space') || pressedCodes.has('KeyE');
}
