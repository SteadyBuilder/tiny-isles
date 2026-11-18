import assert from 'node:assert/strict';
import test from 'node:test';
import type { MonsterPlayerAttackPayload } from '../../../types/monsterSync';
import {
  executeRemoteMonsterPlayerAttack,
  type IRemoteAttackProjectilePlayer,
} from '../RemoteMonsterAttackHandler';

type FireArgs = Parameters<IRemoteAttackProjectilePlayer['fireProjectile']>[0];
type TelegraphArgs = Parameters<IRemoteAttackProjectilePlayer['spawnTelegraphZone']>[0];

function makePayload(overrides: Partial<MonsterPlayerAttackPayload> = {}): MonsterPlayerAttackPayload {
  return {
    targetPlayerId: 'p1',
    monsterId: 'm1',
    monsterName: '흑마법사',
    role: 'melee',
    damage: 18,
    startX: 100,
    startY: 100,
    targetX: 300,
    targetY: 300,
    ...overrides,
  };
}

function createHarness(opts?: { localId?: string; pos?: { x: number; y: number }; fainted?: boolean }) {
  const fired: FireArgs[] = [];
  const telegraphs: TelegraphArgs[] = [];
  const damages: Array<{ damage: number; attackerName: string }> = [];
  const explosions: Array<{ x: number; y: number }> = [];
  let pos = opts?.pos ?? { x: 300, y: 300 };
  let fainted = opts?.fainted ?? false;

  const projectileSystem: IRemoteAttackProjectilePlayer = {
    fireProjectile: (params) => fired.push(params),
    spawnTelegraphZone: (params) => telegraphs.push(params),
  };

  const deps = {
    getLocalPlayerId: () => opts?.localId ?? 'p1',
    getLocalPlayerPosition: () => pos,
    isLocalPlayerFainted: () => fainted,
    damageLocalPlayer: (damage: number, attackerName: string) => damages.push({ damage, attackerName }),
    playExplosionAt: (x: number, y: number) => explosions.push({ x, y }),
    projectileSystem,
  };

  return {
    deps,
    fired,
    telegraphs,
    damages,
    explosions,
    setPos: (x: number, y: number) => { pos = { x, y }; },
    setFainted: (v: boolean) => { fainted = v; },
  };
}

test('ignores attacks targeted at other players and accepts wildcard or matching local ID', () => {
  const h = createHarness({ localId: 'p1' });

  executeRemoteMonsterPlayerAttack(makePayload({ targetPlayerId: 'p2' }), h.deps);
  assert.equal(h.damages.length, 0);

  executeRemoteMonsterPlayerAttack(makePayload({ targetPlayerId: 'p1', damage: 10 }), h.deps);
  executeRemoteMonsterPlayerAttack(makePayload({ targetPlayerId: '*', damage: 15 }), h.deps);
  assert.deepEqual(h.damages, [
    { damage: 10, attackerName: '흑마법사' },
    { damage: 15, attackerName: '흑마법사' },
  ]);
});

test('melee fallback damages directly when alive and skips when fainted', () => {
  const alive = createHarness({ fainted: false });
  executeRemoteMonsterPlayerAttack(makePayload({ role: 'melee', damage: 22 }), alive.deps);
  assert.equal(alive.damages.length, 1);
  assert.equal(alive.fired.length, 0);

  const fainted = createHarness({ fainted: true });
  executeRemoteMonsterPlayerAttack(makePayload({ role: 'melee', damage: 22 }), fainted.deps);
  assert.equal(fainted.damages.length, 0);
});

test('telegraph zone fires mage projectile when !isBossSkill, detonates with explosion, and checks radius + 4', () => {
  const h = createHarness({ pos: { x: 354, y: 300 } });
  executeRemoteMonsterPlayerAttack(
    makePayload({ role: 'mage', telegraphRadius: 50, telegraphDurationMs: 600, damage: 30 }),
    h.deps
  );

  assert.equal(h.fired.length, 1);
  assert.equal(h.fired[0]?.isMagic, true);
  assert.equal(h.telegraphs.length, 1);

  h.telegraphs[0]?.onDetonate();
  assert.deepEqual(h.explosions, [{ x: 300, y: 300 }]);
  assert.equal(h.damages.length, 1);

  h.setPos(355, 300);
  h.telegraphs[0]?.onDetonate();
  assert.equal(h.damages.length, 1);

  h.setPos(300, 300);
  h.setFainted(true);
  h.telegraphs[0]?.onDetonate();
  assert.equal(h.damages.length, 1);

  const bossH = createHarness();
  executeRemoteMonsterPlayerAttack(
    makePayload({ role: 'mage', isBossSkill: true, telegraphRadius: 60, telegraphDurationMs: 700 }),
    bossH.deps
  );
  assert.equal(bossH.fired.length, 0);
  assert.equal(bossH.telegraphs.length, 1);
});

test('non-telegraph ranged and boss skills fire projectiles and enforce hitRadius (58 ranged, 64 magic/boss)', () => {
  const ranged = createHarness({ pos: { x: 358, y: 300 } });
  executeRemoteMonsterPlayerAttack(makePayload({ role: 'ranged', damage: 14 }), ranged.deps);
  assert.equal(ranged.fired.length, 1);
  assert.equal(ranged.fired[0]?.isMagic, false);

  ranged.fired[0]?.onArrive();
  assert.equal(ranged.damages.length, 1);
  ranged.setPos(359, 300);
  ranged.fired[0]?.onArrive();
  assert.equal(ranged.damages.length, 1);

  const boss = createHarness({ pos: { x: 364, y: 300 } });
  executeRemoteMonsterPlayerAttack(makePayload({ role: 'melee', isBossSkill: true, damage: 45 }), boss.deps);
  assert.equal(boss.fired.length, 1);
  assert.equal(boss.fired[0]?.isMagic, true);

  boss.fired[0]?.onArrive();
  assert.equal(boss.damages.length, 1);
  boss.setPos(365, 300);
  boss.fired[0]?.onArrive();
  assert.equal(boss.damages.length, 1);
});
