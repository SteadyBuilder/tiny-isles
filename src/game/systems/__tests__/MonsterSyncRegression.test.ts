import assert from 'node:assert/strict';
import test from 'node:test';
import type Phaser from 'phaser';
import type { Monster } from '../../../types/game';
import type { MonsterKillSyncPayload } from '../../../types/monsterSync';
import { SyncSequenceGuard } from '../MonsterReconciliationHelper';
import { MonsterSyncCoordinator } from '../MonsterSyncCoordinator';
import type { MonsterVisual } from '../MonsterVisualManager';

function createMockGraphics() {
  return {
    clear: () => {},
    setVisible: () => {},
    fillStyle: () => {},
    fillRect: () => {},
    lineStyle: () => {},
    strokeRect: () => {},
  };
}

function createMockContainer(x: number, y: number) {
  const container = {
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
  return {
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
  } as unknown as Phaser.Scene;
}

function makeMonster(overrides: Partial<Monster> = {}): Monster {
  return {
    id: 'm_1',
    type: 'goblin',
    name: '고블린',
    isBoss: false,
    x: 400,
    y: 400,
    hp: 100,
    maxHp: 100,
    attack: 12,
    speed: 70,
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
    hpTrailRatio: 1,
    hpFlashUntil: 0,
    lastAttackTime: 0,
  };
}

test('Root Cause #1: interleaved higher-seq delta sync never aborts or rejects in-flight multi-chunk full sync', () => {
  const hostCoord = new MonsterSyncCoordinator();
  const guestCoord = new MonsterSyncCoordinator();
  hostCoord.setHostEpoch(1);

  const hostMonsters = new Map<string, MonsterVisual>();
  for (let i = 0; i < 300; i++) {
    hostMonsters.set(
      `m_${i}`,
      makeVisual(
        makeMonster({
          id: `m_${i}`,
          x: 200 + i,
          y: 300 + i,
          homeX: 200.4 + i,
          homeY: 300.6 + i,
        })
      )
    );
  }

  // Host builds 3-chunk full sync (fullSyncSeq = 1)
  const chunks = hostCoord.buildFullSyncChunks(hostMonsters, 3, 1);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].syncSeq, 1);

  // Guest receives chunk 0 of full sync
  const r0 = guestCoord.receiveFullSyncChunk(chunks[0]);
  assert.equal(r0.ready, false);

  // Interleaved delta syncs arrive with higher deltaSyncSeq (e.g., 5) while chunks 1 & 2 are still in flight
  const guestMonsters = new Map<string, MonsterVisual>();
  const callbacks = {
    onExplosion: () => {},
    onShake: () => {},
    onRemoteKill: (_k: MonsterKillSyncPayload) => {},
  };
  const deltaRes = guestCoord.applyDeltaSync(
    createMockScene(),
    guestMonsters,
    {
      hostEpoch: 1,
      syncSeq: 5,
      spawns: [],
      updates: [['m_299', 499, 599, 95, 100, 1, 0, 0]],
      kills: [],
      removedIds: [],
      totalMonsterCount: 300,
      waveCount: 3,
      bossWaveCount: 1,
    },
    callbacks
  );
  assert.deepEqual(deltaRes.missingIds, ['m_299']);

  // Remaining chunks 1 and 2 MUST still be accepted despite deltaSyncSeq = 5
  const r1 = guestCoord.receiveFullSyncChunk(chunks[1]);
  assert.equal(r1.ready, false);
  const r2 = guestCoord.receiveFullSyncChunk(chunks[2]);
  assert.equal(r2.ready, true);
  assert.equal(r2.monsters.length, 300);
  assert.equal(r2.monsters[299].id, 'm_299');
  assert.equal(r2.monsters[299].homeX, Math.round(200.4 + 299));
});

test('Root Cause #3: resetSequenceGuard clears stale host epoch/seq barriers on host switch without deleting live mobs', () => {
  const guard = new SyncSequenceGuard();
  assert.equal(guard.acceptDelta(2, 40), true);
  assert.equal(guard.canAcceptFullSync(2, 5), true);
  guard.commitFullSync(2, 5);

  // Before reset, a replacement host that starts at lower epoch/seq would be rejected
  assert.equal(guard.acceptDelta(1, 1), false);
  assert.equal(guard.canAcceptFullSync(1, 1), false);

  const guestCoord = new MonsterSyncCoordinator();
  const mockScene = createMockScene();
  const guestMonsters = new Map<string, MonsterVisual>([
    ['m_alive', makeVisual(makeMonster({ id: 'm_alive', hp: 100 }))],
  ]);
  const callbacks = {
    onExplosion: () => {},
    onShake: () => {},
    onRemoteKill: (_k: MonsterKillSyncPayload) => {},
  };

  guestCoord.applyDeltaSync(
    mockScene,
    guestMonsters,
    {
      hostEpoch: 2,
      syncSeq: 40,
      spawns: [],
      updates: [['m_alive', 410, 410, 90, 100, 1, 0, 0]],
      kills: [],
      removedIds: [],
      totalMonsterCount: 1,
      waveCount: 1,
      bossWaveCount: 0,
    },
    callbacks
  );
  assert.equal(guestMonsters.get('m_alive')!.monster.hp, 90);

  // Replacement host takes over -> resetSequenceGuard allows epoch 1 / seq 1 packets
  guestCoord.resetSequenceGuard();
  assert.equal(guestMonsters.has('m_alive'), true);

  guestCoord.applyDeltaSync(
    mockScene,
    guestMonsters,
    {
      hostEpoch: 1,
      syncSeq: 1,
      spawns: [makeMonster({ id: 'm_new_host_mob', hp: 80 })],
      updates: [],
      kills: [],
      removedIds: [],
      totalMonsterCount: 2,
      waveCount: 1,
      bossWaveCount: 0,
    },
    callbacks
  );
  assert.equal(guestMonsters.has('m_new_host_mob'), true);
});

test('Root Cause #5: buildRepairDeltaPayload materializes missing live mobs and removes dead IDs without consuming pendingKills', () => {
  const hostCoord = new MonsterSyncCoordinator();
  hostCoord.setHostEpoch(2);
  const hostMonsters = new Map<string, MonsterVisual>([
    ['m_near_base', makeVisual(makeMonster({ id: 'm_near_base', x: 512.7, y: 488.2, hp: 75 }))],
  ]);

  hostCoord.recordKill({
    id: 'm_already_killed',
    x: 100,
    y: 100,
    killerId: 'p2',
    isBoss: false,
    isElite: false,
    isCampMonster: false,
    isFieldMonster: true,
    expReward: 25,
    bonusMultiplier: 1,
  });

  const repairPayload = hostCoord.buildRepairDeltaPayload(
    hostMonsters,
    ['m_near_base', 'm_ghost_id', 'm_near_base'],
    4,
    1
  );
  assert.ok(repairPayload);
  assert.equal(repairPayload.hostEpoch, 2);
  assert.equal(repairPayload.spawns.length, 1);
  assert.equal(repairPayload.spawns[0].id, 'm_near_base');
  assert.equal(repairPayload.spawns[0].x, 513);
  assert.deepEqual(repairPayload.removedIds, ['m_ghost_id']);
  assert.deepEqual(repairPayload.kills, []);

  // Pending kills must remain intact for normal delta broadcast
  const normalDeltas = hostCoord.buildDeltaBatches(hostMonsters, 4, 1);
  assert.equal(normalDeltas.length, 1);
  assert.deepEqual(
    normalDeltas[0].kills.map((k) => k.id),
    ['m_already_killed']
  );

  // Guest applies repair delta -> invisible monster appears and ghost disappears
  const guestCoord = new MonsterSyncCoordinator();
  const guestMonsters = new Map<string, MonsterVisual>([
    ['m_ghost_id', makeVisual(makeMonster({ id: 'm_ghost_id', hp: 50 }))],
  ]);
  const res = guestCoord.applyDeltaSync(
    createMockScene(),
    guestMonsters,
    repairPayload,
    {
      onExplosion: () => {},
      onShake: () => {},
      onRemoteKill: () => {},
    }
  );
  assert.equal(res.spawnedCount, 1);
  assert.equal(res.killedCount, 1);
  assert.equal(guestMonsters.has('m_near_base'), true);
  assert.equal(guestMonsters.has('m_ghost_id'), false);
});
