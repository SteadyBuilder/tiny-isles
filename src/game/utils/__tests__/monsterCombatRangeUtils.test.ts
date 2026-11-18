import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYER_CLASS_DEFINITIONS } from '../../../data/classes';
import { DUNGEON_INVASION_CONFIG } from '../../../data/monsterCamps';
import { PLAYER_COMBAT_CONFIG } from '../../../data/worldRules';
import {
  canMonsterStrikeInRange,
  MonsterAttackTimingState,
  resetMonsterAttackEntry,
  resolveMonsterPlayerAttackRange,
} from '../monsterCombatRangeUtils';

test('player melee and boss attack ranges strictly exceed monster melee, lancer, and boss ranges', () => {
  const pawnRange = PLAYER_CLASS_DEFINITIONS.pawn.attackRange;
  const guardianRange = PLAYER_CLASS_DEFINITIONS.guardian.attackRange;
  const lancerRange = PLAYER_CLASS_DEFINITIONS.lancer.attackRange;

  const monsterMeleeRange = resolveMonsterPlayerAttackRange('melee', false);
  const monsterLancerRange = resolveMonsterPlayerAttackRange('lancer', false);
  const monsterBossRange = resolveMonsterPlayerAttackRange('melee', true);

  assert.ok(pawnRange > monsterMeleeRange, `pawn(${pawnRange}) > monsterMelee(${monsterMeleeRange})`);
  assert.ok(pawnRange > monsterLancerRange, `pawn(${pawnRange}) > monsterLancer(${monsterLancerRange})`);
  assert.ok(guardianRange > monsterLancerRange, `guardian(${guardianRange}) > monsterLancer(${monsterLancerRange})`);
  assert.ok(lancerRange > monsterLancerRange, `playerLancer(${lancerRange}) > monsterLancer(${monsterLancerRange})`);
  assert.ok(
    PLAYER_COMBAT_CONFIG.meleeRangeBoss > monsterBossRange,
    `playerBossRange(${PLAYER_COMBAT_CONFIG.meleeRangeBoss}) > monsterBoss(${monsterBossRange})`
  );
  assert.equal(resolveMonsterPlayerAttackRange('ranged', false), DUNGEON_INVASION_CONFIG.rangedAttackRangePx);
  assert.equal(resolveMonsterPlayerAttackRange('mage', false), DUNGEON_INVASION_CONFIG.mageAttackRangePx);
});

test('canMonsterStrikeInRange enforces first-strike entry delay and resets when leaving range', () => {
  const state: MonsterAttackTimingState = { lastAttackTime: 0 };
  const cooldownMs = 1100;
  const delayMs = 400;

  // First frame entering range at t=2000: must wait until 2400ms
  assert.equal(canMonsterStrikeInRange(state, 2000, cooldownMs, delayMs), false);
  assert.equal(state.firstAttackReadyAt, 2400);

  // Before delay expires (t=2350): still cannot attack
  assert.equal(canMonsterStrikeInRange(state, 2350, cooldownMs, delayMs), false);

  // At t=2400: delay expired and cooldown satisfied -> can attack
  assert.equal(canMonsterStrikeInRange(state, 2400, cooldownMs, delayMs), true);
  state.lastAttackTime = 2400;

  // Immediately after attack (t=2600): blocked by cooldown
  assert.equal(canMonsterStrikeInRange(state, 2600, cooldownMs, delayMs), false);

  // Leaves range -> reset entry state, re-entering at t=5000 requires another 400ms delay
  resetMonsterAttackEntry(state);
  assert.equal(state.firstAttackReadyAt, undefined);
  assert.equal(canMonsterStrikeInRange(state, 5000, cooldownMs, delayMs), false);
  assert.equal(canMonsterStrikeInRange(state, 5400, cooldownMs, delayMs), true);
});
