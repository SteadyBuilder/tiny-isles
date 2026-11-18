import assert from 'node:assert/strict';
import test from 'node:test';
import { KeyboardInputController } from '../../phaser/controllers/KeyboardInputController';
import {
  hasBlockingModifier,
  isEditableDomTarget,
  isInteractHoldActive,
  resolveDirectionalVectorFromCodes,
  resolveGameKeyAction,
  shouldPreventDefaultForGameKey,
} from '../keyboardInputUtils';

test('resolveGameKeyAction handles Korean IME Process key via physical event.code', () => {
  assert.equal(resolveGameKeyAction({ code: 'KeyW', key: 'Process' }), 'move_up');
  assert.equal(resolveGameKeyAction({ code: 'KeyA', key: 'ㅁ' }), 'move_left');
  assert.equal(resolveGameKeyAction({ code: 'KeyS', key: 'ㄴ' }), 'move_down');
  assert.equal(resolveGameKeyAction({ code: 'KeyD', key: 'ㅇ' }), 'move_right');
  assert.equal(resolveGameKeyAction({ code: 'KeyE', key: 'ㄷ' }), 'interact');
  assert.equal(resolveGameKeyAction({ code: 'KeyQ', key: 'ㅂ' }), 'skill');
  assert.equal(resolveGameKeyAction({ code: 'KeyI', key: 'ㅑ' }), 'inventory');
  assert.equal(resolveGameKeyAction({ code: 'ArrowLeft', key: 'ArrowLeft' }), 'move_left');
  assert.equal(resolveGameKeyAction({ code: 'ShiftLeft', key: 'Shift' }), 'dash');
});

test('isEditableDomTarget detects inputs, textareas, selects, and contentEditable elements', () => {
  assert.equal(isEditableDomTarget({ tagName: 'INPUT' } as unknown as EventTarget), true);
  assert.equal(isEditableDomTarget({ tagName: 'textarea' } as unknown as EventTarget), true);
  assert.equal(isEditableDomTarget({ tagName: 'SELECT' } as unknown as EventTarget), true);
  assert.equal(
    isEditableDomTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget),
    true
  );
  assert.equal(isEditableDomTarget({ tagName: 'BUTTON' } as unknown as EventTarget), false);
  assert.equal(isEditableDomTarget({ tagName: 'CANVAS' } as unknown as EventTarget), false);
  assert.equal(isEditableDomTarget(null), false);
});

test('shouldPreventDefaultForGameKey prevents default on arrow keys and space only', () => {
  assert.equal(shouldPreventDefaultForGameKey('ArrowUp'), true);
  assert.equal(shouldPreventDefaultForGameKey('ArrowDown'), true);
  assert.equal(shouldPreventDefaultForGameKey('ArrowLeft'), true);
  assert.equal(shouldPreventDefaultForGameKey('ArrowRight'), true);
  assert.equal(shouldPreventDefaultForGameKey('Space'), true);
  assert.equal(shouldPreventDefaultForGameKey('KeyW'), false);
  assert.equal(shouldPreventDefaultForGameKey('Escape'), false);
});

test('hasBlockingModifier ignores Shift (used for dash) but blocks Ctrl, Alt, and Meta', () => {
  assert.equal(hasBlockingModifier({ ctrlKey: false, altKey: false, metaKey: false }), false);
  assert.equal(hasBlockingModifier({ ctrlKey: true }), true);
  assert.equal(hasBlockingModifier({ altKey: true }), true);
  assert.equal(hasBlockingModifier({ metaKey: true }), true);
});

test('resolveDirectionalVectorFromCodes and isInteractHoldActive compute combined states', () => {
  const pressed = new Set<string>(['ArrowRight', 'KeyW', 'Space']);
  assert.deepEqual(resolveDirectionalVectorFromCodes(pressed), { vx: 1, vy: -1 });
  assert.equal(isInteractHoldActive(pressed), true);

  pressed.delete('Space');
  pressed.add('KeyE');
  assert.equal(isInteractHoldActive(pressed), true);

  pressed.delete('KeyE');
  assert.equal(isInteractHoldActive(pressed), false);
});

test('KeyboardInputController tracks arrow/WASD keys, fires one-shot actions once, and resets cleanly', () => {
  let interactCount = 0;
  let skillCount = 0;
  let inventoryCount = 0;
  let dashCount = 0;

  const controller = new KeyboardInputController({
    onInteract: () => {
      interactCount += 1;
    },
    onCastSkill: () => {
      skillCount += 1;
    },
    onOpenInventory: () => {
      inventoryCount += 1;
    },
    onDash: () => {
      dashCount += 1;
    },
  });

  let arrowPrevented = false;
  controller.processKeyDown({
    code: 'ArrowRight',
    key: 'ArrowRight',
    preventDefault: () => {
      arrowPrevented = true;
    },
  });
  assert.equal(arrowPrevented, true);
  assert.deepEqual(controller.getDirectionalVector(), { vx: 1, vy: 0 });

  // Korean IME W pressed simultaneously
  controller.processKeyDown({ code: 'KeyW', key: 'Process' });
  assert.deepEqual(controller.getDirectionalVector(), { vx: 1, vy: -1 });

  // One-shot actions ignore key repeat
  controller.processKeyDown({ code: 'Space', key: ' ' });
  controller.processKeyDown({ code: 'Space', key: ' ', repeat: true });
  controller.processKeyDown({ code: 'KeyQ', key: 'ㅂ' });
  controller.processKeyDown({ code: 'KeyI', key: 'ㅑ' });
  controller.processKeyDown({ code: 'ShiftLeft', key: 'Shift', shiftKey: true });

  assert.equal(interactCount, 1);
  assert.equal(skillCount, 1);
  assert.equal(inventoryCount, 1);
  assert.equal(dashCount, 1);
  assert.equal(controller.isInteractHeld(), true);

  // Editable target does not trigger actions or movement
  controller.processKeyDown({
    code: 'KeyE',
    key: 'e',
    target: { tagName: 'INPUT' } as unknown as EventTarget,
  });
  assert.equal(interactCount, 1);

  // Modifier shortcut does not trigger actions
  controller.processKeyDown({ code: 'KeyI', key: 'i', metaKey: true });
  assert.equal(inventoryCount, 1);

  // Keyup releases key even if modifier was pressed during release
  controller.processKeyUp({ code: 'ArrowRight', key: 'ArrowRight', metaKey: true });
  assert.deepEqual(controller.getDirectionalVector(), { vx: 0, vy: -1 });

  // resetKeys clears all stuck keys
  controller.resetKeys();
  assert.deepEqual(controller.getDirectionalVector(), { vx: 0, vy: 0 });
  assert.equal(controller.isInteractHeld(), false);

  // Pause clears held keys and blocks new actions until resumed
  controller.processKeyDown({ code: 'ArrowLeft', key: 'ArrowLeft' });
  assert.deepEqual(controller.getDirectionalVector(), { vx: -1, vy: 0 });
  controller.setPaused(true);
  assert.deepEqual(controller.getDirectionalVector(), { vx: 0, vy: 0 });
  controller.processKeyDown({ code: 'Space', key: ' ' });
  assert.equal(interactCount, 1);
  controller.setPaused(false);
  controller.processKeyDown({ code: 'ArrowUp', key: 'ArrowUp' });
  assert.deepEqual(controller.getDirectionalVector(), { vx: 0, vy: -1 });
});

test('Z and F work as alternative interact keys (including Korean IME & diagonal arrows) and C toggles auto-interact', () => {
  assert.equal(resolveGameKeyAction({ code: 'KeyZ', key: 'ㅋ' }), 'interact');
  assert.equal(resolveGameKeyAction({ code: 'KeyF', key: 'ㄹ' }), 'interact');
  assert.equal(resolveGameKeyAction({ code: 'KeyC', key: 'ㅊ' }), 'toggle_auto_interact');

  const pressedZ = new Set<string>(['ArrowUp', 'ArrowLeft', 'KeyZ']);
  assert.deepEqual(resolveDirectionalVectorFromCodes(pressedZ), { vx: -1, vy: -1 });
  assert.equal(isInteractHoldActive(pressedZ), true);

  const pressedF = new Set<string>(['ArrowUp', 'ArrowLeft', 'KeyF']);
  assert.equal(isInteractHoldActive(pressedF), true);

  let interactCount = 0;
  let autoToggleCount = 0;

  const controller = new KeyboardInputController({
    onInteract: () => {
      interactCount += 1;
    },
    onToggleAutoInteract: () => {
      autoToggleCount += 1;
    },
    onCastSkill: () => {},
    onOpenInventory: () => {},
    onDash: () => {},
  });

  // Diagonal arrows held + Z pressed
  controller.processKeyDown({ code: 'ArrowUp', key: 'ArrowUp' });
  controller.processKeyDown({ code: 'ArrowLeft', key: 'ArrowLeft' });
  controller.processKeyDown({ code: 'KeyZ', key: 'ㅋ' });
  assert.deepEqual(controller.getDirectionalVector(), { vx: -1, vy: -1 });
  assert.equal(interactCount, 1);
  assert.equal(controller.isInteractHeld(), true);

  controller.processKeyUp({ code: 'KeyZ', key: 'ㅋ' });
  assert.equal(controller.isInteractHeld(), false);

  // F pressed while diagonal arrows still held
  controller.processKeyDown({ code: 'KeyF', key: 'f' });
  assert.equal(interactCount, 2);
  assert.equal(controller.isInteractHeld(), true);
  controller.processKeyUp({ code: 'KeyF', key: 'f' });

  // C toggles auto-interact once per press (ignores repeat)
  controller.processKeyDown({ code: 'KeyC', key: 'ㅊ' });
  controller.processKeyDown({ code: 'KeyC', key: 'ㅊ', repeat: true });
  assert.equal(autoToggleCount, 1);
  controller.processKeyUp({ code: 'KeyC', key: 'ㅊ' });
  controller.processKeyDown({ code: 'KeyC', key: 'c' });
  assert.equal(autoToggleCount, 2);
});
