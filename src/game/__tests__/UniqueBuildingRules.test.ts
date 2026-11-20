import assert from 'node:assert/strict';
import test from 'node:test';
import type { ConstructableType, ConstructedBuilding, Inventory, Island } from '../../types/game';
import { BuildingSystem } from '../BuildingSystem';
import { getBlueprint } from '../constants';

function makeTerritory(id: number, villageTier: Island['villageTier'] = 3): Island {
  return {
    id,
    gridX: id,
    gridY: 0,
    costWood: 0,
    costStone: 0,
    costGold: 0,
    unlocked: true,
    name: `영지 ${id}`,
    villageTier,
    coreHp: 350,
    coreMaxHp: 350,
  };
}

function makeBuilding(
  territoryId: number,
  type: ConstructableType,
  overrides: Partial<ConstructedBuilding> = {}
): ConstructedBuilding {
  const bp = getBlueprint(type);
  return {
    id: `cb_${territoryId}_${type}`,
    territoryId,
    type,
    category: bp.category,
    name: bp.name,
    x: 400,
    y: 400,
    hp: bp.maxHp,
    maxHp: bp.maxHp,
    slotIndex: 4,
    ...overrides,
  };
}

const RICH_INVENTORY: Inventory = { wood: 999, stone: 999, gold: 999, meat: 99 };
const EMPTY_INVENTORY: Inventory = { wood: 0, stone: 0, gold: 0, meat: 0 };

test('all special buildings enforce maxPerTerritory = 1', () => {
  const uniqueTypes: ConstructableType[] = [
    'special_barracks',
    'special_sanctuary',
    'job_hall',
    'tool_shop',
    'mercenary_guild',
  ];
  const territory0 = makeTerritory(0);

  for (const type of uniqueTypes) {
    assert.equal(getBlueprint(type).category, 'special');
    assert.equal(getBlueprint(type).maxPerTerritory, 1);

    const beforeCheck = BuildingSystem.checkBuild(territory0, type, RICH_INVENTORY, []);
    assert.equal(beforeCheck.canBuild, true);
    assert.equal(beforeCheck.alreadyBuilt, undefined);

    const builtList = [makeBuilding(0, type)];
    assert.equal(BuildingSystem.hasReachedTerritoryBuildingLimit(0, type, builtList), true);

    const afterCheck = BuildingSystem.checkBuild(territory0, type, RICH_INVENTORY, builtList);
    assert.equal(afterCheck.canBuild, false);
    assert.equal(afterCheck.alreadyBuilt, true);
    assert.ok(afterCheck.reason?.includes('[건설됨]'));

    // Even with zero resources, alreadyBuilt takes precedence so UI displays [건설됨]
    const emptyInvCheck = BuildingSystem.checkBuild(territory0, type, EMPTY_INVENTORY, builtList);
    assert.equal(emptyInvCheck.canBuild, false);
    assert.equal(emptyInvCheck.alreadyBuilt, true);
  }
});

test('unique buildings can still be built in another territory and rebuilt after destruction', () => {
  const territory0 = makeTerritory(0);
  const territory1 = makeTerritory(1);
  const builtInT0 = [makeBuilding(0, 'job_hall')];

  assert.equal(BuildingSystem.hasReachedTerritoryBuildingLimit(0, 'job_hall', builtInT0), true);
  assert.equal(BuildingSystem.hasReachedTerritoryBuildingLimit(1, 'job_hall', builtInT0), false);

  const otherTerritoryCheck = BuildingSystem.checkBuild(
    territory1,
    'job_hall',
    RICH_INVENTORY,
    builtInT0
  );
  assert.equal(otherTerritoryCheck.canBuild, true);

  // Destroyed building (removed or hp <= 0) unlocks reconstruction
  const destroyedList = [makeBuilding(0, 'job_hall', { hp: 0 })];
  assert.equal(BuildingSystem.hasReachedTerritoryBuildingLimit(0, 'job_hall', destroyedList), false);
  const rebuildCheck = BuildingSystem.checkBuild(territory0, 'job_hall', RICH_INVENTORY, []);
  assert.equal(rebuildCheck.canBuild, true);
});

test('basic resource buildings are in basic category and remain repeatable', () => {
  const territory0 = makeTerritory(0, 4);
  const basicResourceTypes: ConstructableType[] = [
    'basic_house',
    'lumber_camp',
    'stone_works',
    'special_goldmine',
  ];

  for (const type of basicResourceTypes) {
    assert.equal(getBlueprint(type).category, 'basic');
    const existing = [makeBuilding(0, type, { id: 'b1', slotIndex: 4 })];
    assert.equal(BuildingSystem.hasReachedTerritoryBuildingLimit(0, type, existing), false);
    const check = BuildingSystem.checkBuild(territory0, type, RICH_INVENTORY, existing);
    assert.equal(check.canBuild, true);
    assert.equal(check.alreadyBuilt, undefined);
  }
});
