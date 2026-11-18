import assert from 'node:assert/strict';
import test from 'node:test';
import { KeyboardInputController } from '../../phaser/controllers/KeyboardInputController';
import {
  cycleCategoryIndex,
  getBlueprintShortcutNumber,
  resolveBuildModalKeyAction,
} from '../buildModalKeyboardUtils';

test('resolveBuildModalKeyAction resolves B toggle, category keys, and 1-8 blueprint keys including Korean IME', () => {
  assert.deepEqual(resolveBuildModalKeyAction({ code: 'KeyB', key: 'ㅠ' }), { type: 'close' });
  assert.deepEqual(resolveBuildModalKeyAction({ code: 'KeyQ', key: 'ㅂ' }), { type: 'prev_category' });
  assert.deepEqual(resolveBuildModalKeyAction({ code: 'KeyE', key: 'ㄷ' }), { type: 'next_category' });
  assert.deepEqual(resolveBuildModalKeyAction({ code: 'ArrowLeft', key: 'ArrowLeft' }), {
    type: 'prev_category',
  });
  assert.deepEqual(resolveBuildModalKeyAction({ code: 'ArrowRight', key: 'ArrowRight' }), {
    type: 'next_category',
  });
  assert.deepEqual(resolveBuildModalKeyAction({ code: 'Tab', key: 'Tab', shiftKey: false }), {
    type: 'next_category',
  });
  assert.deepEqual(resolveBuildModalKeyAction({ code: 'Tab', key: 'Tab', shiftKey: true }), {
    type: 'prev_category',
  });
  assert.deepEqual(resolveBuildModalKeyAction({ code: 'Digit1', key: '1' }), {
    type: 'select_blueprint',
    index: 0,
  });
  assert.deepEqual(resolveBuildModalKeyAction({ code: 'Digit8', key: '8' }), {
    type: 'select_blueprint',
    index: 7,
  });
  assert.deepEqual(resolveBuildModalKeyAction({ code: 'Numpad3', key: '3' }), {
    type: 'select_blueprint',
    index: 2,
  });
});

test('resolveBuildModalKeyAction ignores out-of-range keys, modifier combos, and editable targets', () => {
  assert.equal(resolveBuildModalKeyAction({ code: 'Digit9', key: '9' }), null);
  assert.equal(resolveBuildModalKeyAction({ code: 'Digit0', key: '0' }), null);
  assert.equal(resolveBuildModalKeyAction({ code: 'KeyB', key: 'b', ctrlKey: true }), null);
  assert.equal(resolveBuildModalKeyAction({ code: 'Digit1', key: '1', altKey: true }), null);
  assert.equal(
    resolveBuildModalKeyAction({
      code: 'Digit1',
      key: '1',
      target: { tagName: 'INPUT' } as unknown as EventTarget,
    }),
    null
  );
});

test('cycleCategoryIndex wraps cleanly in both directions and getBlueprintShortcutNumber maps 1..8', () => {
  assert.equal(cycleCategoryIndex(0, -1, 4), 3);
  assert.equal(cycleCategoryIndex(3, 1, 4), 0);
  assert.equal(cycleCategoryIndex(1, 1, 4), 2);
  assert.equal(cycleCategoryIndex(0, 1, 0), 0);

  assert.equal(getBlueprintShortcutNumber(0), 1);
  assert.equal(getBlueprintShortcutNumber(7), 8);
  assert.equal(getBlueprintShortcutNumber(-1), null);
  assert.equal(getBlueprintShortcutNumber(8), null);
});

test('KeyboardInputController.setModalLocked blocks game input independently of pause state', () => {
  let skillCount = 0;
  let interactCount = 0;

  const controller = new KeyboardInputController({
    onInteract: () => {
      interactCount += 1;
    },
    onCastSkill: () => {
      skillCount += 1;
    },
    onOpenInventory: () => {},
    onDash: () => {},
  });

  controller.processKeyDown({ code: 'KeyW', key: 'w' });
  assert.deepEqual(controller.getDirectionalVector(), { vx: 0, vy: -1 });

  controller.setModalLocked(true);
  assert.deepEqual(controller.getDirectionalVector(), { vx: 0, vy: 0 });

  controller.processKeyDown({ code: 'KeyQ', key: 'q' });
  controller.processKeyDown({ code: 'KeyE', key: 'e' });
  assert.equal(skillCount, 0);
  assert.equal(interactCount, 0);

  // Unlocking modal while game is paused must keep input blocked
  controller.setPaused(true);
  controller.setModalLocked(false);
  controller.processKeyDown({ code: 'KeyQ', key: 'q' });
  assert.equal(skillCount, 0);

  // Unpausing restores normal keyboard input
  controller.setPaused(false);
  controller.processKeyDown({ code: 'KeyQ', key: 'q' });
  assert.equal(skillCount, 1);
});
