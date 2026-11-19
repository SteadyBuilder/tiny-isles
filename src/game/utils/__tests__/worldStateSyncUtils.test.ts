import assert from 'node:assert/strict';
import test from 'node:test';
import { ConstructedBuilding, Island } from '../../../types/game';
import { buildWorldStateSyncPayload, reconcileWorldStateSnapshot } from '../worldStateSyncUtils';

function makeIsland(overrides: Partial<Island> = {}): Island {
  return {
    id: 1,
    name: '마물 주둔지 #1',
    gridX: 1,
    gridY: 0,
    costWood: 100,
    costStone: 100,
    costGold: 50,
    unlocked: false,
    villageTier: 1,
    coreHp: 1200,
    coreMaxHp: 1200,
    isMonsterCamp: true,
    ...overrides,
  };
}

test('reconcileWorldStateSnapshot ignores coreHp diffs on active monster camps to prevent wiping camp wall colliders', () => {
  const mainVillage = makeIsland({
    id: 0,
    name: '시작의 섬',
    gridX: 0,
    gridY: 0,
    unlocked: true,
    isMonsterCamp: false,
    coreHp: 1500,
    coreMaxHp: 1500,
  });
  const localCamp = makeIsland({
    id: 2,
    unlocked: false,
    isMonsterCamp: true,
    coreHp: 1200,
    coreMaxHp: 1200,
  });

  // Host scaled camp HP for 4 players (e.g. 2520), which arrives via camp_full_sync separately
  const hostCamp = makeIsland({
    id: 2,
    unlocked: false,
    isMonsterCamp: true,
    coreHp: 2520,
    coreMaxHp: 2520,
  });

  const buildings: ConstructedBuilding[] = [];
  const payload = buildWorldStateSyncPayload(1, [mainVillage, hostCamp], buildings);

  const result = reconcileWorldStateSnapshot([mainVillage, localCamp], buildings, payload);
  assert.equal(result.changed, false);
  assert.equal(result.islands[1].coreHp, 1200);
  assert.equal(result.islands[1].coreMaxHp, 1200);
});

test('reconcileWorldStateSnapshot detects captured monster camp when unlocked transitions to true', () => {
  const localCamp = makeIsland({
    id: 2,
    unlocked: false,
    isMonsterCamp: true,
    coreHp: 300,
    coreMaxHp: 1200,
  });
  const capturedCamp = makeIsland({
    id: 2,
    unlocked: true,
    ownerId: 'host_1',
    ownerName: '방장',
    isMonsterCamp: true,
    coreHp: 1500,
    coreMaxHp: 1500,
  });

  const payload = buildWorldStateSyncPayload(1, [capturedCamp], []);
  const result = reconcileWorldStateSnapshot([localCamp], [], payload);
  assert.equal(result.changed, true);
  assert.equal(result.islands[0].unlocked, true);
  assert.equal(result.islands[0].coreHp, 1500);
});
