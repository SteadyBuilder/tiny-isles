import assert from 'node:assert/strict';
import test from 'node:test';
import type Phaser from 'phaser';
import { Monster } from '../../../types/game';
import { MonsterKillSyncPayload } from '../../../types/monsterSync';
import { MonsterSyncCoordinator } from '../MonsterSyncCoordinator';
import { MonsterVisual } from '../MonsterVisualManager';

const noop = () => {};
const noopGfx = () => ({ clear: noop, setVisible: noop, fillStyle: noop, fillRect: noop, lineStyle: noop, strokeRect: noop });

function makeScene(): Phaser.Scene {
  return {
    textures: { exists: () => false },
    anims: { exists: () => false },
    add: {
      container: (x: number, y: number) => ({ x, y, depth: 0, setPosition: noop, setDepth: noop, destroy: noop }),
      image: () => ({ setScale: noop, setAlpha: noop, setTint: noop }),
      sprite: () => ({ setDisplaySize: noop, setTint: noop, setFlipX: noop, play: noop }),
      graphics: noopGfx,
      text: () => ({ setOrigin: () => ({}) }),
    },
  } as unknown as Phaser.Scene;
}

function makeMonster(overrides: Partial<Monster> = {}): Monster {
  return {
    id: 'm_1', type: 'goblin', name: '고블린', isBoss: false,
    x: 100, y: 100, hp: 100, maxHp: 100, attack: 15, speed: 75,
    targetTerritoryId: 0, spawnTerritoryId: 0, direction: 'right', isFieldMonster: true,
    ...overrides,
  };
}

function makeVisual(monster: Monster): MonsterVisual & { flipState: { flipX: boolean } } {
  const flipState = { flipX: monster.direction === 'left' };
  const c = { x: monster.x, y: monster.y, depth: 0, setPosition(nx: number, ny: number) { c.x = nx; c.y = ny; }, setDepth(d: number) { c.depth = d; }, destroy: noop };
  return {
    monster,
    container: c as unknown as Phaser.GameObjects.Container,
    sprite: { setFlipX(v: boolean) { flipState.flipX = v; } } as unknown as Phaser.GameObjects.Sprite,
    hpBar: noopGfx() as unknown as Phaser.GameObjects.Graphics,
    baseTint: null,
    hpTrailRatio: monster.hp / Math.max(1, monster.maxHp),
    hpFlashUntil: 0,
    lastAttackTime: 0,
    flipState,
  };
}

const makeCallbacks = (shakes: unknown[] = []) => ({
  onExplosion: noop,
  onShake: (t: Phaser.GameObjects.Container) => shakes.push(t),
  onRemoteKill: noop,
});

const delta = (over: Partial<Parameters<MonsterSyncCoordinator['applyDeltaSync']>[2]> = {}) => ({
  spawns: [], updates: [], kills: [], removedIds: [],
  totalMonsterCount: 1, waveCount: 1, bossWaveCount: 0, ...over,
});

function withFakePerfNow(initial: number, fn: (setNow: (t: number) => void) => void): void {
  const orig = performance.now.bind(performance);
  let now = initial;
  performance.now = () => now;
  try {
    fn((t: number) => { now = t; });
  } finally {
    performance.now = orig;
  }
}

test('deferred authoritative HP reconciles after grace expires even when remoteTargets is empty', () => {
  withFakePerfNow(1000, (setNow) => {
    const coord = new MonsterSyncCoordinator();
    const scene = makeScene();
    const mv = makeVisual(makeMonster({ id: 'm_1', x: 100, y: 100, hp: 60, maxHp: 100 }));
    const monsters = new Map<string, MonsterVisual>([['m_1', mv]]);

    coord.markLocalHit('m_1');
    coord.applyDeltaSync(scene, monsters, delta({ updates: [['m_1', 100, 100, 90, 100, 1, 0, 0]] }), makeCallbacks());

    setNow(1100);
    // Already at (100,100) so remoteTargets empties on first interpolate
    coord.interpolateRemoteMonsters(monsters, 16);
    assert.equal(mv.monster.hp, 60);

    setNow(1270); // Past 260ms grace -> flushes deferred HP with empty remoteTargets
    coord.interpolateRemoteMonsters(monsters, 16);
    assert.equal(mv.monster.hp, 90);
  });
});

test('calling markLocalHit again extends grace deadline for pending deferred authoritative HP', () => {
  withFakePerfNow(1000, (setNow) => {
    const coord = new MonsterSyncCoordinator();
    const scene = makeScene();
    const mv = makeVisual(makeMonster({ id: 'm_1', hp: 60, maxHp: 100 }));
    const monsters = new Map<string, MonsterVisual>([['m_1', mv]]);

    coord.markLocalHit('m_1'); // 1st deadline: 1260
    coord.applyDeltaSync(scene, monsters, delta({ updates: [['m_1', 100, 100, 95, 100, 1, 0, 0]] }), makeCallbacks());

    setNow(1150);
    coord.markLocalHit('m_1'); // 2nd deadline: 1410

    setNow(1300); // Past 1st deadline, before 2nd
    coord.interpolateRemoteMonsters(monsters, 16);
    assert.equal(mv.monster.hp, 60);

    setNow(1420); // Past 2nd deadline
    coord.interpolateRemoteMonsters(monsters, 16);
    assert.equal(mv.monster.hp, 95);
  });
});

test('applyDeltaSync updates existing monster in payload.spawns and clears stale grace and deferred HP', () => {
  withFakePerfNow(1000, (setNow) => {
    const coord = new MonsterSyncCoordinator();
    const scene = makeScene();
    const mv = makeVisual(makeMonster({ id: 'm_1', hp: 80, maxHp: 100, direction: 'right', targetTerritoryId: 0 }));
    const monsters = new Map<string, MonsterVisual>([['m_1', mv]]);
    const shakes: unknown[] = [];

    coord.markLocalHit('m_1');
    coord.applyDeltaSync(scene, monsters, delta({ updates: [['m_1', 100, 100, 95, 100, 1, 0, 0]] }), makeCallbacks(shakes));

    coord.applyDeltaSync(scene, monsters, delta({
      spawns: [makeMonster({
        id: 'm_1', x: 150, y: 160, hp: 50, maxHp: 120,
        direction: 'left', targetTerritoryId: 3, shieldHp: 30, shieldMaxHp: 45,
      })],
    }), makeCallbacks(shakes));

    assert.equal(mv.monster.direction, 'left');
    assert.equal(mv.monster.targetTerritoryId, 3);
    assert.equal(mv.monster.shieldHp, 30);
    assert.equal(mv.monster.shieldMaxHp, 45);
    assert.equal(mv.flipState.flipX, true);
    assert.equal(mv.monster.hp, 50);
    assert.equal(mv.monster.maxHp, 120);
    assert.equal(shakes.length, 1);

    setNow(1500);
    coord.interpolateRemoteMonsters(monsters, 16);
    assert.equal(mv.monster.hp, 50);
  });
});

test('completing single-chunk or multi-chunk receiveFullSyncChunk clears stale deferred HP and grace', () => {
  withFakePerfNow(1000, (setNow) => {
    const coord = new MonsterSyncCoordinator();
    const scene = makeScene();
    const mv = makeVisual(makeMonster({ id: 'm_1', hp: 60, maxHp: 100 }));
    const monsters = new Map<string, MonsterVisual>([['m_1', mv]]);

    coord.markLocalHit('m_1');
    coord.applyDeltaSync(scene, monsters, delta({ updates: [['m_1', 100, 100, 90, 100, 1, 0, 0]] }), makeCallbacks());
    const single = coord.receiveFullSyncChunk({
      monsters: [makeMonster({ id: 'm_1', hp: 70, maxHp: 100 })],
      waveCount: 1, bossWaveCount: 0, syncId: 'fs_1', chunkIndex: 0, totalChunks: 1,
    });
    assert.equal(single.ready, true);
    mv.monster.hp = single.monsters[0].hp;

    setNow(1300);
    coord.interpolateRemoteMonsters(monsters, 16);
    assert.equal(mv.monster.hp, 70);

    coord.markLocalHit('m_1');
    coord.applyDeltaSync(scene, monsters, delta({ updates: [['m_1', 100, 100, 95, 100, 1, 0, 0]] }), makeCallbacks());
    assert.equal(coord.receiveFullSyncChunk({
      monsters: [makeMonster({ id: 'm_1', hp: 65, maxHp: 100 })],
      waveCount: 1, bossWaveCount: 0, syncId: 'fs_2', chunkIndex: 0, totalChunks: 2,
    }).ready, false);
    assert.equal(coord.receiveFullSyncChunk({
      monsters: [], waveCount: 1, bossWaveCount: 0, syncId: 'fs_2', chunkIndex: 1, totalChunks: 2,
    }).ready, true);
    mv.monster.hp = 65;

    setNow(1600);
    coord.interpolateRemoteMonsters(monsters, 16);
    assert.equal(mv.monster.hp, 65);
  });
});

test('recordKill caps pendingKills at 256 entries FIFO', () => {
  const coord = new MonsterSyncCoordinator();
  for (let i = 0; i < 270; i++) {
    const kill: MonsterKillSyncPayload = {
      id: `k_${i}`, x: i, y: 0, isBoss: false, isElite: false,
      isCampMonster: false, isFieldMonster: true, expReward: 10, bonusMultiplier: 1,
    };
    coord.recordKill(kill);
  }
  const batches = coord.buildDeltaBatches(new Map(), 1, 0);
  assert.equal(batches.length, 1);
  assert.equal(batches[0].kills.length, 256);
  assert.equal(batches[0].kills[0].id, 'k_14');
  assert.equal(batches[0].kills[255].id, 'k_269');
});
