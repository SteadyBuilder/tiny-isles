import test from 'node:test';
import assert from 'node:assert/strict';
import { Monster } from '../../../types/game';
import { ActivePlayerTarget } from '../../../types/monsterSync';
import {
  chunkArray,
  createSyncTrackedState,
  findTargetPlayerForMonster,
  hasMonsterSyncChanged,
  toCompactMonsterTuple,
} from '../monsterSyncUtils';

const makeMonster = (overrides: Partial<Monster> = {}): Monster => ({
  id: 'fld_1',
  type: 'goblin',
  name: '고블린',
  isBoss: false,
  x: 1200.4,
  y: -340.6,
  hp: 150,
  maxHp: 150,
  attack: 20,
  speed: 70,
  targetTerritoryId: 0,
  spawnTerritoryId: 0,
  direction: 'left',
  isFieldMonster: true,
  ...overrides,
});

test('hasMonsterSyncChanged detects rounded coordinate, hp, direction, and shield changes', () => {
  const m = makeMonster();
  const prev = createSyncTrackedState(m);

  // Sub-pixel movement that rounds to the same integer should not trigger a delta
  const sameRounded = makeMonster({ x: 1200.2, y: -340.9 });
  assert.equal(hasMonsterSyncChanged(prev, sameRounded), false);

  // Moving >= 1px triggers change
  assert.equal(hasMonsterSyncChanged(prev, makeMonster({ x: 1202 })), true);
  // HP change triggers change
  assert.equal(hasMonsterSyncChanged(prev, makeMonster({ hp: 120 })), true);
  // Direction change triggers change
  assert.equal(hasMonsterSyncChanged(prev, makeMonster({ direction: 'right' })), true);
  // Shield change triggers change
  assert.equal(hasMonsterSyncChanged(prev, makeMonster({ shieldHp: 45 })), true);
});

test('toCompactMonsterTuple encodes rounded compact array tuple', () => {
  const m = makeMonster({ x: 100.7, y: 200.3, direction: 'right', shieldHp: 30 });
  assert.deepEqual(toCompactMonsterTuple(m), ['fld_1', 101, 200, 150, 150, 1, 0, 30]);
});

test('chunkArray splits large monster arrays evenly without dropping items', () => {
  const items = Array.from({ length: 250 }, (_, i) => i);
  const chunks = chunkArray(items, 120);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].length, 120);
  assert.equal(chunks[1].length, 120);
  assert.equal(chunks[2].length, 10);
  assert.deepEqual(chunks.flat(), items);
});

test('findTargetPlayerForMonster picks nearest alive player or valid preferred aggro target', () => {
  const players: ActivePlayerTarget[] = [
    { id: 'host', x: 0, y: 0, isFainted: false },
    { id: 'guest_fainted', x: 50, y: 0, isFainted: true },
    { id: 'guest_near', x: 1400, y: 0, isFainted: false },
  ];

  // Guest is nearest to monster at x=1300
  const nearest = findTargetPlayerForMonster(1300, 0, players, 350);
  assert.equal(nearest?.player.id, 'guest_near');
  assert.equal(nearest?.dist, 100);

  // Fainted player at x=50 is ignored when monster is at x=40
  const skipFainted = findTargetPlayerForMonster(40, 0, players, 350);
  assert.equal(skipFainted?.player.id, 'host');

  // Preferred aggro target within leash radius is prioritized over closer player
  const aggro = findTargetPlayerForMonster(1200, 0, players, 1500, 'host');
  assert.equal(aggro?.player.id, 'host');
});
