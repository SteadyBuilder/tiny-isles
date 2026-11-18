import assert from 'node:assert/strict';
import test from 'node:test';
import type Phaser from 'phaser';
import { Monster } from '../../../types/game';
import { MonsterKillSyncPayload } from '../../../types/monsterSync';
import { MonsterSyncCoordinator } from '../MonsterSyncCoordinator';
import { MonsterVisual } from '../MonsterVisualManager';

interface MockGraphics {
  clear: () => void;
  setVisible: () => void;
  fillStyle: () => void;
  fillRect: () => void;
  lineStyle: () => void;
  strokeRect: () => void;
}

interface MockContainer {
  x: number;
  y: number;
  depth: number;
  destroyed: boolean;
  setPosition: (x: number, y: number) => void;
  setDepth: (depth: number) => void;
  add: () => void;
  destroy: () => void;
}

function createMockGraphics(): MockGraphics {
  return {
    clear: () => {},
    setVisible: () => {},
    fillStyle: () => {},
    fillRect: () => {},
    lineStyle: () => {},
    strokeRect: () => {},
  };
}

function createMockContainer(x: number, y: number): MockContainer {
  const container: MockContainer = {
    x,
    y,
    depth: 0,
    destroyed: false,
    setPosition(nx: number, ny: number) {
      container.x = nx;
      container.y = ny;
    },
    setDepth(d: number) {
      container.depth = d;
    },
    add: () => {},
    destroy() {
      container.destroyed = true;
    },
  };
  return container;
}

function createMockScene(): Phaser.Scene {
  const mockScene = {
    textures: { exists: () => false },
    anims: { exists: () => false },
    add: {
      container: (x: number, y: number) => createMockContainer(x, y),
      image: () => ({ setScale: () => {}, setAlpha: () => {}, setTint: () => {} }),
      sprite: () => ({
        setDisplaySize: () => {},
        setTint: () => {},
        setFlipX: () => {},
        play: () => {},
      }),
      graphics: () => createMockGraphics(),
      text: () => ({ setOrigin: () => ({}) }),
    },
  };
  return mockScene as unknown as Phaser.Scene;
}

function makeMonster(overrides: Partial<Monster> = {}): Monster {
  return {
    id: 'm_1',
    type: 'goblin',
    name: '고블린',
    isBoss: false,
    x: 500,
    y: 400,
    hp: 100,
    maxHp: 100,
    attack: 15,
    speed: 75,
    targetTerritoryId: 0,
    spawnTerritoryId: 0,
    direction: 'right',
    isFieldMonster: true,
    ...overrides,
  };
}

function makeVisual(monster: Monster): MonsterVisual {
  return {
    monster,
    container: createMockContainer(monster.x, monster.y) as unknown as Phaser.GameObjects.Container,
    sprite: { setFlipX: () => {} } as unknown as Phaser.GameObjects.Sprite,
    hpBar: createMockGraphics() as unknown as Phaser.GameObjects.Graphics,
    baseTint: null,
    hpTrailRatio: monster.hp / Math.max(1, monster.maxHp),
    hpFlashUntil: 0,
    lastAttackTime: 0,
  };
}

test('buildFullSyncChunks splits live monsters into ordered chunks and receiveFullSyncChunk reassembles out-of-order arrivals', () => {
  const hostSync = new MonsterSyncCoordinator();
  const guestSync = new MonsterSyncCoordinator();
  const hostMap = new Map<string, MonsterVisual>();

  for (let i = 0; i < 250; i++) {
    const id = `m_${i}`;
    hostMap.set(id, makeVisual(makeMonster({ id, x: i * 2, y: i })));
  }
  // Dead monster must be excluded from full sync chunks
  hostMap.set('m_dead', makeVisual(makeMonster({ id: 'm_dead', hp: 0 })));

  const chunks = hostSync.buildFullSyncChunks(hostMap, 3, 1);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].monsters.length, 120);
  assert.equal(chunks[1].monsters.length, 120);
  assert.equal(chunks[2].monsters.length, 10);

  // Deliver out-of-order: chunk 2 -> chunk 0 -> chunk 1
  const r1 = guestSync.receiveFullSyncChunk(chunks[2]);
  assert.equal(r1.ready, false);
  const r2 = guestSync.receiveFullSyncChunk(chunks[0]);
  assert.equal(r2.ready, false);
  const r3 = guestSync.receiveFullSyncChunk(chunks[1]);
  assert.equal(r3.ready, true);
  assert.equal(r3.monsters.length, 250);
  assert.equal(r3.monsters[0].id, 'm_0');
  assert.equal(r3.monsters[249].id, 'm_249');
});

test('buildFullSyncChunks produces valid empty chunk when 0 monsters exist', () => {
  const hostSync = new MonsterSyncCoordinator();
  const chunks = hostSync.buildFullSyncChunks(new Map(), 1, 0);
  assert.equal(chunks.length, 1);
  assert.deepEqual(chunks[0].monsters, []);
  assert.equal(chunks[0].totalChunks, 1);

  const guestSync = new MonsterSyncCoordinator();
  const res = guestSync.receiveFullSyncChunk(chunks[0]);
  assert.equal(res.ready, true);
  assert.equal(res.monsters.length, 0);
});

test('buildDeltaBatches tracks spawns, compact tuple updates, recorded kills, and silent removals', () => {
  const coord = new MonsterSyncCoordinator();
  const map = new Map<string, MonsterVisual>();
  const m1 = makeMonster({ id: 'm_1', x: 100, y: 100, hp: 100 });
  const m2 = makeMonster({ id: 'm_2', x: 200, y: 200, hp: 80 });
  const m3 = makeMonster({ id: 'm_3', x: 300, y: 300, hp: 60 });
  map.set('m_1', makeVisual(m1));
  map.set('m_2', makeVisual(m2));
  map.set('m_3', makeVisual(m3));

  // Initial baseline via full sync
  coord.buildFullSyncChunks(map, 1, 0);
  assert.equal(coord.buildDeltaBatches(map, 1, 0).length, 0);

  // Mutate m_1 position & shield, kill m_2, vanish m_3, add m_4
  m1.x = 125;
  m1.shieldHp = 40;
  m1.shieldMaxHp = 40;
  m1.shieldUntil = performance.now() + 4000;
  map.delete('m_2');
  coord.recordKill({
    id: 'm_2',
    x: 200,
    y: 200,
    killerId: 'guest_1',
    isBoss: false,
    isElite: false,
    isCampMonster: false,
    isFieldMonster: true,
    expReward: 20,
    bonusMultiplier: 1,
  });
  map.delete('m_3');
  map.set('m_4', makeVisual(makeMonster({ id: 'm_4', x: 400, y: 400 })));

  const batches = coord.buildDeltaBatches(map, 2, 0);
  assert.equal(batches.length, 1);
  assert.equal(batches[0].spawns.map((s) => s.id).join(','), 'm_4');
  assert.equal(batches[0].updates.length, 1);
  assert.equal(batches[0].updates[0][0], 'm_1');
  assert.equal(batches[0].updates[0][1], 125);
  assert.equal(batches[0].updates[0][7], 40);
  assert.equal(batches[0].kills.map((k) => k.id).join(','), 'm_2');
  assert.equal(batches[0].removedIds.join(','), 'm_3');
});

test('applyDeltaSync respects local hit HP grace, destroys killed monsters, and spawns new ones', () => {
  const coord = new MonsterSyncCoordinator();
  const mockScene = createMockScene();
  const guestMonsters = new Map<string, MonsterVisual>();

  const g1 = makeVisual(makeMonster({ id: 'm_1', x: 100, y: 100, hp: 60, maxHp: 100 }));
  const g2 = makeVisual(makeMonster({ id: 'm_2', x: 300, y: 300, hp: 20, maxHp: 100 }));
  guestMonsters.set('m_1', g1);
  guestMonsters.set('m_2', g2);

  // Guest hits m_1 locally (HP predicted down to 60); markLocalHit protects against stale 95 HP update
  coord.markLocalHit('m_1');

  const explosions: Array<{ x: number; y: number }> = [];
  const shakes: unknown[] = [];
  const killsReceived: MonsterKillSyncPayload[] = [];

  const result1 = coord.applyDeltaSync(
    mockScene,
    guestMonsters,
    {
      spawns: [makeMonster({ id: 'm_new', x: 500, y: 500, hp: 120, maxHp: 120 })],
      updates: [
        ['m_1', 110, 105, 95, 100, 1, 0, 0], // stale higher HP within grace window -> keep 60
      ],
      kills: [
        {
          id: 'm_2',
          x: 300,
          y: 300,
          killerId: 'guest_1',
          isBoss: false,
          isElite: false,
          isCampMonster: false,
          isFieldMonster: true,
          expReward: 25,
          bonusMultiplier: 1,
        },
      ],
      removedIds: [],
      totalMonsterCount: 2,
      waveCount: 1,
      bossWaveCount: 0,
    },
    {
      onExplosion: (x, y) => explosions.push({ x, y }),
      onShake: (target) => shakes.push(target),
      onRemoteKill: (kill) => killsReceived.push(kill),
    }
  );

  assert.equal(result1.killedCount, 1);
  assert.equal(result1.needsFullSync, false);
  assert.equal(guestMonsters.has('m_2'), false);
  assert.equal(guestMonsters.has('m_new'), true);
  assert.equal(g1.monster.hp, 60);
  assert.equal(killsReceived.length, 1);
  assert.equal(explosions.length, 1);

  // Lower authoritative HP MUST always apply immediately even during grace window
  coord.applyDeltaSync(
    mockScene,
    guestMonsters,
    {
      spawns: [],
      updates: [['m_1', 112, 105, 30, 100, 1, 0, 25]],
      kills: [],
      removedIds: [],
      totalMonsterCount: 2,
      waveCount: 1,
      bossWaveCount: 0,
    },
    {
      onExplosion: (x, y) => explosions.push({ x, y }),
      onShake: (target) => shakes.push(target),
      onRemoteKill: (kill) => killsReceived.push(kill),
    }
  );
  assert.equal(g1.monster.hp, 30);
  assert.equal(g1.monster.shieldHp, 25);
  assert.equal(shakes.length, 1);
});

test('applyDeltaSync flags needsFullSync on missing update target or consecutive count mismatches', () => {
  const coord = new MonsterSyncCoordinator();
  const mockScene = createMockScene();
  const guestMonsters = new Map<string, MonsterVisual>();

  const noopCallbacks = {
    onExplosion: () => {},
    onShake: () => {},
    onRemoteKill: () => {},
  };

  // Single count mismatch without missing update -> no full sync yet (tolerates minor chunk race)
  const firstMismatch = coord.applyDeltaSync(
    mockScene,
    guestMonsters,
    {
      spawns: [],
      updates: [],
      kills: [],
      removedIds: [],
      totalMonsterCount: 5,
      waveCount: 1,
      bossWaveCount: 0,
    },
    noopCallbacks
  );
  assert.equal(firstMismatch.needsFullSync, false);

  // Second consecutive count mismatch -> triggers resync
  const secondMismatch = coord.applyDeltaSync(
    mockScene,
    guestMonsters,
    {
      spawns: [],
      updates: [],
      kills: [],
      removedIds: [],
      totalMonsterCount: 5,
      waveCount: 1,
      bossWaveCount: 0,
    },
    noopCallbacks
  );
  assert.equal(secondMismatch.needsFullSync, true);

  // Missing update target immediately triggers needsFullSync
  const missingTarget = coord.applyDeltaSync(
    mockScene,
    guestMonsters,
    {
      spawns: [],
      updates: [['unknown_id', 0, 0, 10, 10, 0, 0, 0]],
      kills: [],
      removedIds: [],
      totalMonsterCount: 0,
      waveCount: 1,
      bossWaveCount: 0,
    },
    noopCallbacks
  );
  assert.equal(missingTarget.needsFullSync, true);
});

test('interpolateRemoteMonsters lerps close targets smoothly and snaps far teleports', () => {
  const coord = new MonsterSyncCoordinator();
  const mockScene = createMockScene();
  const map = new Map<string, MonsterVisual>();
  const nearVis = makeVisual(makeMonster({ id: 'near', x: 100, y: 100 }));
  const farVis = makeVisual(makeMonster({ id: 'far', x: 0, y: 0 }));
  map.set('near', nearVis);
  map.set('far', farVis);

  coord.applyDeltaSync(
    mockScene,
    map,
    {
      spawns: [],
      updates: [
        ['near', 200, 100, 100, 100, 1, 0, 0], // dist 100 (< 260) -> lerp
        ['far', 1000, 0, 100, 100, 1, 0, 0], // dist 1000 (> 260) -> snap
      ],
      kills: [],
      removedIds: [],
      totalMonsterCount: 2,
      waveCount: 1,
      bossWaveCount: 0,
    },
    { onExplosion: () => {}, onShake: () => {}, onRemoteKill: () => {} }
  );

  coord.interpolateRemoteMonsters(map, 50);

  // near moves smoothly between 100 and 200
  assert.ok(nearVis.monster.x > 100 && nearVis.monster.x < 200);
  // far snaps directly to 1000
  assert.equal(farVis.monster.x, 1000);
  assert.equal(farVis.container.x, 1000);
});

test('multi-batch buildDeltaBatches applies sequentially without triggering false needsFullSync', () => {
  const hostCoord = new MonsterSyncCoordinator();
  const guestCoord = new MonsterSyncCoordinator();
  const mockScene = createMockScene();
  const hostMonsters = new Map<string, MonsterVisual>();
  const guestMonsters = new Map<string, MonsterVisual>();

  for (let i = 0; i < 200; i++) {
    const id = `batch_m_${i}`;
    hostMonsters.set(id, makeVisual(makeMonster({ id, x: i * 5, y: 100 })));
  }

  const batches = hostCoord.buildDeltaBatches(hostMonsters, 3, 1);
  assert.equal(batches.length, 3);
  assert.equal(batches[0].batchIndex, 0);
  assert.equal(batches[0].totalBatches, 3);
  assert.equal(batches[2].batchIndex, 2);
  assert.equal(batches[2].totalBatches, 3);

  // Trigger 1 prior count mismatch so an unchecked intermediate batch would hit streak >= 2
  guestCoord.applyDeltaSync(
    mockScene,
    guestMonsters,
    {
      spawns: [],
      updates: [],
      kills: [],
      removedIds: [],
      totalMonsterCount: 999,
      waveCount: 3,
      bossWaveCount: 1,
    },
    { onExplosion: () => {}, onShake: () => {}, onRemoteKill: () => {} }
  );

  let totalSpawned = 0;
  for (let i = 0; i < batches.length; i++) {
    const res = guestCoord.applyDeltaSync(mockScene, guestMonsters, batches[i], {
      onExplosion: () => {},
      onShake: () => {},
      onRemoteKill: () => {},
    });
    assert.equal(res.needsFullSync, false, `batch ${i} must not trigger full sync`);
    totalSpawned += res.spawnedCount;
  }

  assert.equal(totalSpawned, 200);
  assert.equal(guestMonsters.size, 200);
});

test('receiveFullSyncChunk expires incomplete stale batches by TTL and resets remoteTargets/streak on completion', () => {
  const guestCoord = new MonsterSyncCoordinator();
  const mockScene = createMockScene();
  const guestMonsters = new Map<string, MonsterVisual>();
  const m1 = makeVisual(makeMonster({ id: 'm_1', x: 100, y: 100 }));
  guestMonsters.set('m_1', m1);

  // Set remote target to (200, 100) before full sync resets position back to (100, 100)
  guestCoord.applyDeltaSync(
    mockScene,
    guestMonsters,
    {
      spawns: [],
      updates: [['m_1', 200, 100, 100, 100, 1, 0, 0]],
      kills: [],
      removedIds: [],
      totalMonsterCount: 99, // create 1 mismatch streak too
      waveCount: 1,
      bossWaveCount: 0,
    },
    { onExplosion: () => {}, onShake: () => {}, onRemoteKill: () => {} }
  );

  // Mock time progression for TTL test
  const origNow = performance.now.bind(performance);
  let fakeNow = 1000;
  performance.now = () => fakeNow;
  try {
    // Incomplete batch fs_stale arrives at t=1000
    const incomplete = guestCoord.receiveFullSyncChunk({
      monsters: [makeMonster({ id: 'old_chunk', x: 10, y: 10 })],
      waveCount: 1,
      bossWaveCount: 0,
      syncId: 'fs_stale',
      chunkIndex: 0,
      totalChunks: 2,
    });
    assert.equal(incomplete.ready, false);

    // Advance past fullSyncBatchTtlMs (8000ms) -> chunk 1 of fs_stale must NOT resurrect expired batch
    fakeNow = 10000;
    const expiredSecondHalf = guestCoord.receiveFullSyncChunk({
      monsters: [makeMonster({ id: 'old_chunk_2', x: 20, y: 20 })],
      waveCount: 1,
      bossWaveCount: 0,
      syncId: 'fs_stale',
      chunkIndex: 1,
      totalChunks: 2,
    });
    assert.equal(expiredSecondHalf.ready, false);

    // Single-chunk full sync clears remoteTargets and resets countMismatchStreak
    const fullSingle = guestCoord.receiveFullSyncChunk({
      monsters: [makeMonster({ id: 'm_1', x: 100, y: 100 })],
      waveCount: 1,
      bossWaveCount: 0,
      syncId: 'fs_single',
      chunkIndex: 0,
      totalChunks: 1,
    });
    assert.equal(fullSingle.ready, true);

    // Interpolation after full sync must NOT drag m_1 toward old (200, 100)
    guestCoord.interpolateRemoteMonsters(guestMonsters, 50);
    assert.equal(m1.monster.x, 100);
  } finally {
    performance.now = origNow;
  }
});
