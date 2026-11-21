import assert from 'node:assert/strict';
import test from 'node:test';
import { EquipmentItem } from '../../../types/hunting';
import { buildStatComparisonRows } from '../equipmentScoreUtils';

const baseSword: EquipmentItem = {
  instanceId: 'sw-1',
  id: 'iron-sword',
  name: '철검',
  icon: '⚔️',
  spritePath: '/assets/items/sword.png',
  textureKey: 'sword',
  slot: 'weapon',
  rarity: 'common',
  minRing: 1,
  salvageGold: 10,
  description: '기본 철검',
  obtainedAt: 1000,
  bonusAttack: 10,
  bonusMaxHp: 20,
  bonusSpeed: 0,
  bonusCritChance: 5,
};

const betterAxe: EquipmentItem = {
  instanceId: 'ax-1',
  id: 'war-axe',
  name: '전투 도끼',
  icon: '🪓',
  spritePath: '/assets/items/axe.png',
  textureKey: 'axe',
  slot: 'weapon',
  rarity: 'rare',
  minRing: 1,
  salvageGold: 25,
  description: '무거운 전투 도끼',
  obtainedAt: 2000,
  bonusAttack: 18,
  bonusMaxHp: 20,
  bonusSpeed: 0,
  bonusAttackSpeedPercent: 8,
};

test('buildStatComparisonRows marks up/down/same directions against equipped item', () => {
  const rows = buildStatComparisonRows(betterAxe, baseSword);
  const byKey = new Map(rows.map((r) => [r.key, r]));

  assert.equal(byKey.get('bonusAttack')?.direction, 'up');
  assert.equal(byKey.get('bonusMaxHp')?.direction, 'same');
  assert.equal(byKey.get('bonusCritChance')?.direction, 'down');
  assert.equal(byKey.get('bonusAttackSpeedPercent')?.direction, 'up');
});

test('buildStatComparisonRows marks all positive stats as up when slot is empty', () => {
  const rows = buildStatComparisonRows(baseSword, null);
  assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => r.direction === 'up'));
});
