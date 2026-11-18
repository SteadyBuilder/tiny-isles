import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WALL_REPAIR_CONFIG,
  checkWallRepair,
  findNearestDamagedWall,
  isWallBuilding,
} from '../WallRepairRules';
import { ConstructedBuilding, Inventory } from '../../../types/game';

test('isWallBuilding correctly identifies wall categories and types', () => {
  const woodWall: ConstructedBuilding = {
    id: 'w1',
    territoryId: 0,
    type: 'wood_wall',
    category: 'wall',
    name: '나무 방책',
    x: 100,
    y: 100,
    hp: 150,
    maxHp: 280,
    slotIndex: 0,
  };

  const house: ConstructedBuilding = {
    id: 'h1',
    territoryId: 0,
    type: 'basic_house',
    category: 'basic',
    name: '주민 가옥',
    x: 100,
    y: 100,
    hp: 100,
    maxHp: 200,
    slotIndex: 4,
  };

  assert.equal(isWallBuilding(woodWall), true);
  assert.equal(isWallBuilding(house), false);
});

test('checkWallRepair validates max hp, inventory and calculates nextHp', () => {
  const wall: ConstructedBuilding = {
    id: 'w1',
    territoryId: 0,
    type: 'wood_wall',
    category: 'wall',
    name: '나무 방책',
    x: 100,
    y: 100,
    hp: 200,
    maxHp: 280,
    slotIndex: 0,
  };

  // Full hp
  const fullWall = { ...wall, hp: 280 };
  const resFull = checkWallRepair(fullWall, { wood: 10, stone: 10, gold: 10, meat: 0 });
  assert.equal(resFull.canRepair, false);
  assert.match(resFull.reason || '', /최대치/);

  // Insufficient resources (wood_wall needs 2 wood, 1 stone)
  const resNoRes = checkWallRepair(wall, { wood: 1, stone: 0, gold: 0, meat: 0 });
  assert.equal(resNoRes.canRepair, false);
  assert.match(resNoRes.reason || '', /수리 자원 부족/);

  // Sufficient resources
  const resOk = checkWallRepair(wall, { wood: 10, stone: 5, gold: 0, meat: 0 });
  assert.equal(resOk.canRepair, true);
  assert.equal(resOk.nextHp, 280); // 200 + 100 clamped to 280
  assert.equal(resOk.cost?.wood, WALL_REPAIR_CONFIG.wood_wall.wood);
});

test('findNearestDamagedWall finds damaged wall in range and ignores full hp walls', () => {
  const fullWall: ConstructedBuilding = {
    id: 'w0',
    territoryId: 0,
    type: 'wood_wall',
    category: 'wall',
    name: '북쪽 나무 방책',
    x: 500,
    y: 200,
    hp: 280,
    maxHp: 280,
    slotIndex: 0,
  };

  const damagedWall: ConstructedBuilding = {
    id: 'w1',
    territoryId: 0,
    type: 'stone_wall',
    category: 'wall',
    name: '남쪽 석조 성벽',
    x: 500,
    y: 600,
    hp: 150,
    maxHp: 650,
    slotIndex: 1,
  };

  const buildings = [fullWall, damagedWall];

  // Near the full wall -> should be null because it is not damaged
  const hit1 = findNearestDamagedWall(500, 210, buildings, 80);
  assert.equal(hit1, null);

  // Near the damaged wall -> should find damagedWall
  const hit2 = findNearestDamagedWall(500, 610, buildings, 80);
  assert.notEqual(hit2, null);
  assert.equal(hit2?.building.id, 'w1');
});
