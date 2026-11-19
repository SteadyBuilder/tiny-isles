import assert from 'node:assert/strict';
import test from 'node:test';
import { computeCappedCampSpawnBudget } from '../campSpawnBudgetUtils';

test('computeCappedCampSpawnBudget는 4인 고배율 부락 스폰을 상한 내로 제어하고 체력·경험치 배율로 보정한다', () => {
  const res = computeCappedCampSpawnBudget({
    desiredTotalCount: 72,
    activeCampMonsterCount: 40,
    maxActiveCampMonsters: 240,
    maxMonstersPerCamp: 24,
  });

  assert.equal(res.allowedTotalCount, 24);
  assert.equal(res.hpAndExpCompensationMult, 3);
  assert.ok(Math.abs(res.countScaleRatio - 1 / 3) < 0.001);
});

test('computeCappedCampSpawnBudget는 전역 상한에 근접해도 최소 4마리 수비병을 보장한다', () => {
  const res = computeCappedCampSpawnBudget({
    desiredTotalCount: 20,
    activeCampMonsterCount: 239,
    maxActiveCampMonsters: 240,
    maxMonstersPerCamp: 24,
  });

  assert.equal(res.allowedTotalCount, 4);
  assert.equal(res.hpAndExpCompensationMult, 5);
});
