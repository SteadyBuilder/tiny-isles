import {
  KeyEventLike,
  hasBlockingModifier,
  isEditableDomTarget,
} from './keyboardInputUtils';

export type BuildModalKeyAction =
  | { type: 'close' }
  | { type: 'prev_category' }
  | { type: 'next_category' }
  | { type: 'select_blueprint'; index: number };

export const MAX_BUILD_MODAL_SHORTCUT_COUNT = 8;

const DIGIT_CODE_TO_INDEX: Readonly<Record<string, number>> = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Digit4: 3,
  Digit5: 4,
  Digit6: 5,
  Digit7: 6,
  Digit8: 7,
  Numpad1: 0,
  Numpad2: 1,
  Numpad3: 2,
  Numpad4: 3,
  Numpad5: 4,
  Numpad6: 5,
  Numpad7: 6,
  Numpad8: 7,
};

const DIGIT_KEY_TO_INDEX: Readonly<Record<string, number>> = {
  '1': 0,
  '2': 1,
  '3': 2,
  '4': 3,
  '5': 4,
  '6': 5,
  '7': 6,
  '8': 7,
};

/**
 * 건설 모달이 열려 있을 때 PC 키보드 입력을 모달 전용 액션으로 해석한다.
 * 물리 키 코드(`event.code`)를 우선해 한글 IME 상태에서도 일관되게 동작한다.
 */
export function resolveBuildModalKeyAction(
  event: KeyEventLike
): BuildModalKeyAction | null {
  if (isEditableDomTarget(event.target)) return null;
  if (hasBlockingModifier(event)) return null;

  const code = event.code ?? '';
  const key = event.key ?? '';

  if (code === 'KeyB' || key === 'b' || key === 'B') {
    return { type: 'close' };
  }

  if (code === 'Tab' || key === 'Tab') {
    return event.shiftKey ? { type: 'prev_category' } : { type: 'next_category' };
  }

  if (code === 'KeyQ' || code === 'ArrowLeft' || key === 'q' || key === 'Q' || key === 'ArrowLeft') {
    return { type: 'prev_category' };
  }

  if (code === 'KeyE' || code === 'ArrowRight' || key === 'e' || key === 'E' || key === 'ArrowRight') {
    return { type: 'next_category' };
  }

  if (code in DIGIT_CODE_TO_INDEX) {
    return { type: 'select_blueprint', index: DIGIT_CODE_TO_INDEX[code] };
  }

  if (key in DIGIT_KEY_TO_INDEX) {
    return { type: 'select_blueprint', index: DIGIT_KEY_TO_INDEX[key] };
  }

  return null;
}

/**
 * 카테고리 인덱스를 순환(wrap-around) 이동한다.
 */
export function cycleCategoryIndex(
  currentIndex: number,
  delta: -1 | 1,
  total: number
): number {
  if (total <= 0) return 0;
  return (currentIndex + delta + total) % total;
}

/**
 * 건물 카드 순번(0-based)에 대응하는 숫자 단축키(1~8)를 반환한다.
 */
export function getBlueprintShortcutNumber(index: number): number | null {
  if (index < 0 || index >= MAX_BUILD_MODAL_SHORTCUT_COUNT) return null;
  return index + 1;
}
