import test from 'node:test';
import assert from 'node:assert/strict';
import { SANCTUARY_HEAL_CONFIG } from '../../../data/potions';
import { ConstructedBuilding } from '../../../types/game';
import { checkSanctuaryPlayerHeal } from '../sanctuaryHealUtils';

const makeSanctuary = (overrides: Partial<ConstructedBuilding> = {}): ConstructedBuilding => ({
  id: 'sanc-1',
  territoryId: 0,
  type: 'special_sanctuary',
  category: 'special',
  name: '신성 치유 성소',
  x: 500,
  y: 500,
  hp: 380,
  maxHp: 380,
  slotIndex: 0,
  ...overrides,
});

test('checkSanctuaryPlayerHeal returns healAmount when player is within radius of intact sanctuary', () => {
  const sanctuary = makeSanctuary();
  const maxHp = 200;
  const res = checkSanctuaryPlayerHeal(650, 500, maxHp, [sanctuary]);

  assert.equal(res.inRange, true);
  assert.equal(res.sanctuary?.id, 'sanc-1');
  assert.equal(
    res.healAmount,
    SANCTUARY_HEAL_CONFIG.flatHealAmount + Math.round(maxHp * SANCTUARY_HEAL_CONFIG.maxHpHealRatio)
  );
});

test('checkSanctuaryPlayerHeal ignores destroyed or out-of-range sanctuaries', () => {
  const destroyed = makeSanctuary({ id: 'sanc-dead', hp: 0 });
  const far = makeSanctuary({ id: 'sanc-far', x: 1000, y: 1000 });

  const res = checkSanctuaryPlayerHeal(500, 500, 200, [destroyed, far]);
  assert.equal(res.inRange, false);
  assert.equal(res.healAmount, 0);
  assert.equal(res.sanctuary, null);
});
