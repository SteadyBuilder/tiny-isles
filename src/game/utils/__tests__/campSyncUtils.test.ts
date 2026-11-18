import test from 'node:test';
import assert from 'node:assert/strict';
import type { CampStateSnapshot, CampStructureSnapshot } from '../../../types/campSync';
import type { Island } from '../../../types/game';
import type { MonsterCampState } from '../../../types/hunting';
import {
  applyCampSnapshotToState,
  groupStructureSnapshotsByTerritory,
  planCampFortificationSync,
  toCampStateSnapshot,
} from '../campSyncUtils';

const makeCamp = (overrides: Partial<MonsterCampState> = {}): MonsterCampState => ({
  territoryId: 101,
  gridX: 2,
  gridY: 0,
  name: '고블린 전초기지',
  ring: 1,
  level: 1,
  coreHp: 500,
  coreMaxHp: 500,
  destroyed: false,
  respawnRemainingSec: null,
  firstCleared: false,
  clearCount: 0,
  ...overrides,
});

const makeIsland = (overrides: Partial<Island> = {}): Island => ({
  id: 101,
  gridX: 2,
  gridY: 0,
  costWood: 0,
  costStone: 0,
  costGold: 0,
  unlocked: true,
  name: '고블린 전초기지',
  villageTier: 1,
  coreHp: 500,
  coreMaxHp: 500,
  isMonsterCamp: true,
  campRing: 1,
  campLevel: 1,
  campDestroyed: false,
  campRespawnSec: null,
  ...overrides,
});

const makeSnapshot = (overrides: Partial<CampStateSnapshot> = {}): CampStateSnapshot => ({
  territoryId: 101,
  level: 1,
  coreHp: 500,
  coreMaxHp: 500,
  destroyed: false,
  respawnRemainingSec: null,
  firstCleared: false,
  clearCount: 0,
  ...overrides,
});

const makeStructure = (id: string, territoryId = 101, hp = 100, maxHp = 100): CampStructureSnapshot => ({
  id,
  territoryId,
  hp,
  maxHp,
});

test('toCampStateSnapshot copies camp state fields without extra runtime properties', () => {
  const camp = makeCamp({ level: 3, coreHp: 220, coreMaxHp: 800, firstCleared: true, clearCount: 2 });
  assert.deepEqual(toCampStateSnapshot(camp), {
    territoryId: 101,
    level: 3,
    coreHp: 220,
    coreMaxHp: 800,
    destroyed: false,
    respawnRemainingSec: null,
    firstCleared: true,
    clearCount: 2,
  });
});

test('applyCampSnapshotToState clamps HP, handles alive <-> destroyed transitions, and syncs Island', () => {
  const camp = makeCamp();
  const island = makeIsland();

  const destroyRes = applyCampSnapshotToState(
    camp,
    makeSnapshot({ coreHp: -50, coreMaxHp: 0, destroyed: true, respawnRemainingSec: 45, firstCleared: true, clearCount: 1 }),
    island
  );
  assert.deepEqual(destroyRes, { becameDestroyed: true, respawned: false, clearCountChanged: true });
  assert.equal(camp.coreMaxHp, 1);
  assert.equal(camp.coreHp, 0);
  assert.equal(camp.destroyed, true);
  assert.equal(camp.respawnRemainingSec, 45);
  assert.equal(island.campDestroyed, true);
  assert.equal(island.campRespawnSec, 45);
  assert.equal(island.coreHp, 0);
  assert.equal(island.coreMaxHp, 1);

  const respawnRes = applyCampSnapshotToState(
    camp,
    makeSnapshot({ level: 2, coreHp: 9999, coreMaxHp: 900, destroyed: false, respawnRemainingSec: 30, firstCleared: true, clearCount: -2 }),
    island
  );
  assert.deepEqual(respawnRes, { becameDestroyed: false, respawned: true, clearCountChanged: true });
  assert.equal(camp.level, 2);
  assert.equal(camp.coreHp, 900);
  assert.equal(camp.coreMaxHp, 900);
  assert.equal(camp.destroyed, false);
  assert.equal(camp.respawnRemainingSec, null);
  assert.equal(camp.clearCount, 0);
  assert.equal(island.campLevel, 2);
  assert.equal(island.campDestroyed, false);
  assert.equal(island.campRespawnSec, null);
  assert.equal(island.coreHp, 900);
});

test('groupStructureSnapshotsByTerritory groups structures by territoryId', () => {
  const grouped = groupStructureSnapshotsByTerritory([
    makeStructure('w1', 101),
    makeStructure('w2', 102),
    makeStructure('t1', 101),
  ]);
  assert.equal(grouped.size, 2);
  assert.deepEqual(grouped.get(101)?.map((s) => s.id), ['w1', 't1']);
  assert.deepEqual(grouped.get(102)?.map((s) => s.id), ['w2']);
});

test('planCampFortificationSync returns clear when campDestroyed is true', () => {
  const plan = planCampFortificationSync([{ id: 'w1' }], [makeStructure('w1')], true, false, false);
  assert.deepEqual(plan, { action: 'clear', removeIds: [], updates: [] });
});

test('planCampFortificationSync reconciles partial wall removal and full wall destruction while core is alive', () => {
  const current = [{ id: 'w1' }, { id: 'w2' }, { id: 't1' }];
  const partialIncoming = [makeStructure('w1', 101, 60, 100), makeStructure('t1', 101, 90, 100)];
  const partialPlan = planCampFortificationSync(current, partialIncoming, false, false, false);
  assert.deepEqual(partialPlan, {
    action: 'reconcile_only',
    removeIds: ['w2'],
    updates: partialIncoming,
  });

  const allDestroyedPlan = planCampFortificationSync(current, [], false, false, false);
  assert.deepEqual(allDestroyedPlan, {
    action: 'reconcile_only',
    removeIds: ['w1', 'w2', 't1'],
    updates: [],
  });
});

test('planCampFortificationSync triggers respawn_then_reconcile on respawn, clearCount change, or missing local structure', () => {
  const incoming = [makeStructure('w1'), makeStructure('w2')];

  assert.deepEqual(planCampFortificationSync([{ id: 'w1' }, { id: 'w2' }], incoming, false, true, false), {
    action: 'respawn_then_reconcile',
    removeIds: [],
    updates: incoming,
  });

  assert.deepEqual(planCampFortificationSync([{ id: 'w1' }, { id: 'w2' }], incoming, false, false, true), {
    action: 'respawn_then_reconcile',
    removeIds: [],
    updates: incoming,
  });

  assert.deepEqual(planCampFortificationSync([{ id: 'w1' }], incoming, false, false, false), {
    action: 'respawn_then_reconcile',
    removeIds: [],
    updates: incoming,
  });
});
