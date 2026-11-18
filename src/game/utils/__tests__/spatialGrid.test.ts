import assert from 'node:assert/strict';
import test from 'node:test';
import { Monster } from '../../../types/game';
import { MonsterVisual } from '../../systems/MonsterVisualManager';
import { MonsterSpatialGrid } from '../spatialGrid';

function makeVisual(id: string, x: number, y: number, hp = 100): MonsterVisual {
  const monster: Monster = {
    id,
    type: 'goblin',
    name: id,
    isBoss: false,
    x,
    y,
    hp,
    maxHp: 100,
    attack: 10,
    speed: 60,
    targetTerritoryId: 0,
    spawnTerritoryId: 0,
    direction: 'right',
    isFieldMonster: true,
  };
  return {
    monster,
    container: {} as MonsterVisual['container'],
    sprite: {} as MonsterVisual['sprite'],
    hpBar: null,
    baseTint: null,
    hpTrailRatio: hp / 100,
    hpFlashUntil: 0,
    lastAttackTime: 0,
  };
}

test('MonsterSpatialGrid ensureFresh caches per frameStamp and rebuilds on new frame or clear', () => {
  const grid = new MonsterSpatialGrid();
  const m1 = makeVisual('m1', 100, 100, 100);
  const m2 = makeVisual('m2', 500, 500, 100);
  const monsters = new Map<string, MonsterVisual>([
    ['m1', m1],
    ['m2', m2],
  ]);

  grid.ensureFresh(monsters, 1000);
  assert.equal(grid.findNearestInRadius(100, 100, 50)?.monster.id, 'm1');

  // Move m1 within the SAME frameStamp -> ensureFresh must reuse cached grid without re-bucketing
  m1.monster.x = 900;
  m1.monster.y = 900;
  grid.ensureFresh(monsters, 1000);
  assert.equal(grid.findNearestInRadius(900, 900, 50), null);

  // Advance frameStamp -> rebuild updates cell position
  grid.ensureFresh(monsters, 1016);
  assert.equal(grid.findNearestInRadius(900, 900, 50)?.monster.id, 'm1');

  // Empty map clears buckets
  monsters.clear();
  grid.ensureFresh(monsters, 1032);
  assert.equal(grid.findNearestInRadius(900, 900, 50), null);
});

test('MonsterSpatialGrid queryRadius and findNearestInRadius skip dead monsters and respect radius', () => {
  const grid = new MonsterSpatialGrid();
  const deadClose = makeVisual('dead', 105, 105, 0);
  const far = makeVisual('far', 210, 100, 80);
  const mid = makeVisual('mid', 150, 100, 60);
  const out = makeVisual('out', 400, 400, 100);

  const monsters = new Map<string, MonsterVisual>([
    ['dead', deadClose],
    ['far', far],
    ['mid', mid],
    ['out', out],
  ]);

  grid.rebuild(monsters, 200);

  const found = grid.queryRadius(100, 100, 120).map((mv) => mv.monster.id).sort();
  assert.deepEqual(found, ['far', 'mid']);

  const nearest = grid.findNearestInRadius(100, 100, 120);
  assert.equal(nearest?.monster.id, 'mid');

  // Late kill in the same frame before rebuild must still be filtered dynamically
  mid.monster.hp = 0;
  assert.equal(grid.findNearestInRadius(100, 100, 120)?.monster.id, 'far');
  assert.equal(grid.findNearestInRadius(100, 100, 40), null);
});
