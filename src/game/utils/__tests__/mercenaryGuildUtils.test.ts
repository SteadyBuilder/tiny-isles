import assert from 'node:assert/strict';
import test from 'node:test';
import { ConstructedBuilding } from '../../../types/game';
import { checkMercenaryGuildProximity } from '../mercenaryGuildUtils';

test('checkMercenaryGuildProximity detects built active guild within radius', () => {
  const buildings: ConstructedBuilding[] = [
    {
      id: 'mg_1',
      territoryId: 0,
      type: 'mercenary_guild',
      category: 'special',
      name: '용병 길드',
      x: 400,
      y: 400,
      hp: 400,
      maxHp: 400,
      slotIndex: 4,
    },
  ];

  const near = checkMercenaryGuildProximity(450, 420, buildings, 155);
  assert.equal(near.hasBuilt, true);
  assert.equal(near.isNear, true);
  assert.equal(near.nearestBuilding?.id, 'mg_1');

  const far = checkMercenaryGuildProximity(800, 800, buildings, 155);
  assert.equal(far.hasBuilt, true);
  assert.equal(far.isNear, false);
  assert.equal(far.nearestBuilding, null);
});
