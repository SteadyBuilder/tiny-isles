import {
  KeyEventLike,
  hasBlockingModifier,
  isEditableDomTarget,
  isInteractHoldActive,
  resolveDirectionalVectorFromCodes,
  resolveGameKeyAction,
  resolveNormalizedKeyToken,
  shouldPreventDefaultForGameKey,
} from '../../utils/keyboardInputUtils';

export interface IKeyboardInputCallbacks {
  onInteract: () => void;
  onToggleAutoInteract?: () => void;
  onCastSkill: () => void;
  onOpenInventory: () => void;
  onDash: () => void;
}

/**
 * 물리 키 코드(`event.code`) 기반으로 게임 키보드 입력을 추적하는 전용 컨트롤러.
 *
 * - 한글 IME 활성 상태에서도 WASD·단축키가 누락되지 않도록 물리 키 코드를 우선 사용한다.
 * - HUD 버튼 등 비편집 UI에 포커스가 남아 방향키/스페이스바가 가로채이는 현상을 방지한다.
 * - 탭 전환(`visibilitychange`), 창 포커스 이탈(`blur`), 우클릭 메뉴(`contextmenu`),
 *   일시정지 전환 시 눌린 키 상태를 즉시 초기화하여 키 고착(stuck key)을 예방한다.
 */
export class KeyboardInputController {
  private callbacks: IKeyboardInputCallbacks;
  private pressedCodes = new Set<string>();
  private isPaused = false;
  private isModalLocked = false;
  private attached = false;
  private unbindFns: Array<() => void> = [];

  constructor(callbacks: IKeyboardInputCallbacks) {
    this.callbacks = callbacks;
  }

  public attach(): void {
    if (this.attached) return;
    this.attached = true;

    const handleKeyDown = (e: KeyboardEvent) => {
      this.processKeyDown(e);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      this.processKeyUp(e);
    };

    const handleReset = () => {
      this.resetKeys();
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        this.resetKeys();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown, { capture: true });
      window.addEventListener('keyup', handleKeyUp, { capture: true });
      window.addEventListener('blur', handleReset);
      window.addEventListener('contextmenu', handleReset);
      this.unbindFns.push(() => {
        window.removeEventListener('keydown', handleKeyDown, { capture: true });
        window.removeEventListener('keyup', handleKeyUp, { capture: true });
        window.removeEventListener('blur', handleReset);
        window.removeEventListener('contextmenu', handleReset);
      });
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      this.unbindFns.push(() => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      });
    }
  }

  public detach(): void {
    if (!this.attached) return;
    this.attached = false;
    for (const unbind of this.unbindFns) {
      unbind();
    }
    this.unbindFns = [];
    this.resetKeys();
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
    this.resetKeys();
  }

  public setModalLocked(locked: boolean): void {
    this.isModalLocked = locked;
    if (locked) {
      this.resetKeys();
    }
  }

  public resetKeys(): void {
    this.pressedCodes.clear();
  }

  public getDirectionalVector(): { vx: number; vy: number } {
    if (this.isPaused || this.isModalLocked) return { vx: 0, vy: 0 };
    return resolveDirectionalVectorFromCodes(this.pressedCodes);
  }

  public isInteractHeld(): boolean {
    if (this.isPaused || this.isModalLocked) return false;
    return isInteractHoldActive(this.pressedCodes);
  }

  public processKeyDown(event: KeyEventLike): void {
    const token = resolveNormalizedKeyToken(event);
    if (!token) return;

    const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
    if (isEditableDomTarget(event.target) || isEditableDomTarget(activeEl)) {
      return;
    }

    if (hasBlockingModifier(event)) {
      return;
    }

    if (this.isPaused || this.isModalLocked) {
      return;
    }

    // HUD 버튼 등 비편집 UI 요소에 잔류한 포커스를 해제해 Space/방향키 오동작 방지
    if (
      activeEl &&
      typeof HTMLElement !== 'undefined' &&
      activeEl instanceof HTMLElement &&
      activeEl !== document.body &&
      !isEditableDomTarget(activeEl)
    ) {
      activeEl.blur();
    }

    if (shouldPreventDefaultForGameKey(token)) {
      event.preventDefault?.();
    }

    const wasAlreadyDown = this.pressedCodes.has(token);
    this.pressedCodes.add(token);

    if (wasAlreadyDown || event.repeat) {
      return;
    }

    const action = resolveGameKeyAction(event);
    switch (action) {
      case 'interact':
        this.callbacks.onInteract();
        break;
      case 'toggle_auto_interact':
        this.callbacks.onToggleAutoInteract?.();
        break;
      case 'skill':
        this.callbacks.onCastSkill();
        break;
      case 'inventory':
        this.callbacks.onOpenInventory();
        break;
      case 'dash':
        this.callbacks.onDash();
        break;
      default:
        break;
    }
  }

  public processKeyUp(event: KeyEventLike): void {
    const token = resolveNormalizedKeyToken(event);
    if (!token) return;
    this.pressedCodes.delete(token);
  }
}
