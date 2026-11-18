import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveMonsterAnimKeys } from '../monsterAnimationUtils';

test('resolveMonsterAnimKeys maps melee, lancer, ranged, and mage monsters to run/attack anim pairs', () => {
  assert.deepEqual(
    resolveMonsterAnimKeys({ isBoss: false, type: 'goblin', role: 'melee' }),
    { runAnimKey: 'monster_zombie_run', attackAnimKey: 'monster_zombie_attack' }
  );
  assert.deepEqual(
    resolveMonsterAnimKeys({ isBoss: false, type: 'zombie', role: 'melee' }),
    { runAnimKey: 'monster_zombie_run', attackAnimKey: 'monster_zombie_attack' }
  );
  assert.deepEqual(
    resolveMonsterAnimKeys({ isBoss: false, type: 'lancer', role: 'lancer' }),
    { runAnimKey: 'monster_lancer_run', attackAnimKey: 'monster_lancer_attack' }
  );
  assert.deepEqual(
    resolveMonsterAnimKeys({ isBoss: false, type: 'skeleton', role: 'ranged' }),
    { runAnimKey: 'monster_skeleton_run', attackAnimKey: 'monster_skeleton_attack' }
  );
  assert.deepEqual(
    resolveMonsterAnimKeys({ isBoss: false, type: 'archmage', role: 'mage' }),
    { runAnimKey: 'monster_archmage_run', attackAnimKey: 'monster_archmage_cast' }
  );
});

test('resolveMonsterAnimKeys resolves boss animations from bossSpriteKey with purple warrior fallback', () => {
  assert.deepEqual(
    resolveMonsterAnimKeys({ isBoss: true, type: 'goblin' }),
    { runAnimKey: 'monster_boss_run', attackAnimKey: 'monster_boss_attack' }
  );
  assert.deepEqual(
    resolveMonsterAnimKeys({ isBoss: true, type: 'lancer', bossSpriteKey: 'enemyLancerRun' }),
    { runAnimKey: 'monster_lancer_run', attackAnimKey: 'monster_lancer_attack' }
  );
  assert.deepEqual(
    resolveMonsterAnimKeys({ isBoss: true, type: 'archmage', bossSpriteKey: 'enemyArchmageRun' }),
    { runAnimKey: 'monster_archmage_run', attackAnimKey: 'monster_archmage_cast' }
  );
  assert.deepEqual(
    resolveMonsterAnimKeys({ isBoss: true, type: 'skeleton', bossSpriteKey: 'enemyArcherRun' }),
    { runAnimKey: 'monster_skeleton_run', attackAnimKey: 'monster_skeleton_attack' }
  );
});
