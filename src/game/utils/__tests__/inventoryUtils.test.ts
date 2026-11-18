import assert from 'node:assert/strict';
import test from 'node:test';
import { isSameInventory } from '../inventoryUtils';

test('isSameInventory compares resource fields by value', () => {
  assert.equal(
    isSameInventory({ wood: 30, stone: 20, gold: 10 }, { wood: 30, stone: 20, gold: 10 }),
    true
  );
  assert.equal(
    isSameInventory({ wood: 31, stone: 20, gold: 10 }, { wood: 30, stone: 20, gold: 10 }),
    false
  );
  assert.equal(
    isSameInventory({ wood: 30, stone: 21, gold: 10 }, { wood: 30, stone: 20, gold: 10 }),
    false
  );
  assert.equal(
    isSameInventory({ wood: 30, stone: 20, gold: 11 }, { wood: 30, stone: 20, gold: 10 }),
    false
  );
});
