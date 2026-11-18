import assert from 'node:assert/strict';
import test from 'node:test';
import {
  consumeEscapeKeyEvent,
  EscapeKeyEventLike,
  shouldTriggerSoloPauseOnEscape,
} from '../useEscapeToClose';

interface ListenerEntry {
  fn: (e: EscapeKeyEventLike) => void;
  capture: boolean;
}

/**
 * 브라우저 DOM의 window -> focused element -> window 캡처/버블 전파 순서를 재현하는 테스트 하네스
 */
function createDomKeyDispatcher() {
  const windowListeners: ListenerEntry[] = [];

  return {
    addWindowKeydownListener(fn: (e: EscapeKeyEventLike) => void, capture = false) {
      windowListeners.push({ fn, capture });
    },
    removeWindowKeydownListener(fn: (e: EscapeKeyEventLike) => void, capture = false) {
      const idx = windowListeners.findIndex((entry) => entry.fn === fn && entry.capture === capture);
      if (idx >= 0) windowListeners.splice(idx, 1);
    },
    dispatchEscape(options: { repeat?: boolean } = {}) {
      let defaultPrevented = false;
      let propagationStopped = false;
      let immediateStopped = false;

      const event: EscapeKeyEventLike = {
        key: 'Escape',
        repeat: Boolean(options.repeat),
        get defaultPrevented() {
          return defaultPrevented;
        },
        preventDefault: () => {
          defaultPrevented = true;
        },
        stopPropagation: () => {
          propagationStopped = true;
        },
        stopImmediatePropagation: () => {
          propagationStopped = true;
          immediateStopped = true;
        },
      };

      // 1. Capture phase on window
      for (const entry of [...windowListeners]) {
        if (!entry.capture) continue;
        entry.fn(event);
        if (immediateStopped) break;
      }

      // 2. Bubble phase on window (skipped if stopped in capture phase)
      if (!propagationStopped) {
        for (const entry of [...windowListeners]) {
          if (entry.capture) continue;
          entry.fn(event);
          if (immediateStopped) break;
        }
      }
    },
  };
}

test('consumeEscapeKeyEvent consumes Escape key and invokes onClose', () => {
  let prevented = false;
  let stopped = false;
  let immediateStopped = false;
  let closed = false;

  const event: EscapeKeyEventLike = {
    key: 'Escape',
    preventDefault: () => {
      prevented = true;
    },
    stopPropagation: () => {
      stopped = true;
    },
    stopImmediatePropagation: () => {
      immediateStopped = true;
    },
  };

  const handled = consumeEscapeKeyEvent(event, () => {
    closed = true;
  });

  assert.equal(handled, true);
  assert.equal(prevented, true);
  assert.equal(stopped, true);
  assert.equal(immediateStopped, true);
  assert.equal(closed, true);
});

test('consumeEscapeKeyEvent ignores non-Escape keys', () => {
  let prevented = false;
  let closed = false;

  const event: EscapeKeyEventLike = {
    key: 'i',
    preventDefault: () => {
      prevented = true;
    },
    stopPropagation: () => {},
  };

  const handled = consumeEscapeKeyEvent(event, () => {
    closed = true;
  });

  assert.equal(handled, false);
  assert.equal(prevented, false);
  assert.equal(closed, false);
});

test('shouldTriggerSoloPauseOnEscape blocks defaultPrevented, repeat, and non-Escape events', () => {
  assert.equal(
    shouldTriggerSoloPauseOnEscape({ key: 'Escape', defaultPrevented: false, repeat: false }),
    true
  );
  assert.equal(
    shouldTriggerSoloPauseOnEscape({ key: 'Escape', defaultPrevented: true, repeat: false }),
    false
  );
  assert.equal(
    shouldTriggerSoloPauseOnEscape({ key: 'Escape', defaultPrevented: false, repeat: true }),
    false
  );
  assert.equal(
    shouldTriggerSoloPauseOnEscape({ key: 'Enter', defaultPrevented: false, repeat: false }),
    false
  );
});

test('capture-phase inventory ESC closes only inventory and prevents solo pause modal', () => {
  const dom = createDomKeyDispatcher();
  let inventoryOpen = true;
  let pauseToggledCount = 0;

  // 1. Register solo-pause listener in bubble phase first (matches useRoomLobbyState mount)
  const pauseListener = (e: EscapeKeyEventLike) => {
    if (!shouldTriggerSoloPauseOnEscape(e)) return;
    pauseToggledCount += 1;
  };
  dom.addWindowKeydownListener(pauseListener, false);

  // 2. Register modal close listener in capture phase afterwards (matches InventoryModal opening)
  const modalListener = (e: EscapeKeyEventLike) => {
    consumeEscapeKeyEvent(e, () => {
      inventoryOpen = false;
    });
  };
  dom.addWindowKeydownListener(modalListener, true);

  // Press ESC while inventory is open -> only closes inventory
  dom.dispatchEscape();

  assert.equal(inventoryOpen, false);
  assert.equal(pauseToggledCount, 0);

  // Cleanup modal listener when inventory closes
  dom.removeWindowKeydownListener(modalListener, true);

  // Held repeat ESC right after closing must not open pause modal
  dom.dispatchEscape({ repeat: true });
  assert.equal(pauseToggledCount, 0);

  // Fresh ESC after inventory closed toggles solo pause modal normally
  dom.dispatchEscape();
  assert.equal(pauseToggledCount, 1);

  dom.removeWindowKeydownListener(pauseListener, false);
});
