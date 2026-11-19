import assert from 'node:assert/strict';
import test from 'node:test';
import type Phaser from 'phaser';
import { MONSTER_SYNC_CONFIG } from '../../../data/worldRules';
import type { ConstructedBuilding, Island, Monster } from '../../../types/game';
import type { MonsterKillSyncPayload } from '../../../types/monsterSync';
import {
  buildWorldStateSyncPayload,
  reconcileWorldStateSnapshot,
} from '../../utils/worldStateSyncUtils';
import {
  MonsterTombstoneTracker,
  SyncSequenceGuard,
  computeMonsterIdDigest,
} from '../MonsterReconciliationHelper';
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

function makeMonsterMap(entries: Array<{ id: string; hp?: number }>): Map<string, MonsterVisual> {
  const map = new Map<string, MonsterVisual>();
  for (const e of entries) {
    map.set(e.id, makeVisual(makeMonster({ id: e.id, hp: e.hp ?? 100 })));
  }
  return map;
}

test('computeMonsterIdDigest is order-independent, ignores hp<=0, and distinguishes swapped ID sets of equal size', () => {
  const d1 = computeMonsterIdDigest(
    makeMonsterMap([{ id: 'm_a' }, { id: 'm_b' }, { id: 'm_c' }, { id: 'm_dead', hp: 0 }])
  );
  const d2 = computeMonsterIdDigest(makeMonsterMap([{ id: 'm_c' }, { id: 'm_a' }, { id: 'm_b' }]));
  const d3 = computeMonsterIdDigest(
    makeMonsterMap([{ id: 'm_a' }, { id: 'm_b' }, { id: 'm_ghost' }])
  );

  assert.equal(d1.count, 3);
  assert.equal(d1.digest, d2.digest);
  assert.notEqual(d1.digest, d3.digest);
  assert.deepEqual(computeMonsterIdDigest(new Map()), { count: 0, digest: 0 });
});

test('MonsterTombstoneTracker expires tombstones after TTL and blocks resurrection before expiry', () => {
  const tracker = new MonsterTombstoneTracker();
  tracker.markDead('m_dead', 1000);

  assert.equal(tracker.isTombstoned('m_dead', 3000), true);
  assert.equal(
    tracker.isTombstoned('m_dead', 1000 + MONSTER_SYNC_CONFIG.killTombstoneTtlMs + 1),
    false
  );
});

test('SyncSequenceGuard rejects stale epochs/seqs and allows multi-batch payloads sharing the same syncSeq', () => {
  const guard = new SyncSequenceGuard();
  assert.equal(guard.accept(1, 5), true);
  assert.equal(guard.accept(1, 5), true); // second batch in same syncSeq
  assert.equal(guard.accept(1, 4), false); // out-of-order stale seq
  assert.equal(guard.accept(0, 99), false); // stale host epoch
  assert.equal(guard.accept(2, 1), true); // new host epoch resets seq baseline
  assert.equal(guard.accept(2, 0), false); // stale seq in new epoch
  assert.equal(guard.accept(2, 2), true);
});

test('buildFullSyncChunks preserves pendingKills and recordGhostRemoval emits immediate removedIds', () => {
  const coord = new MonsterSyncCoordinator();
  coord.setHostEpoch(3);
  const hostMap = new Map<string, MonsterVisual>([['m_live', makeVisual(makeMonster({ id: 'm_live' }))]]);

  coord.recordKill({
    id: 'm_killed',
    x: 200,
    y: 200,
    killerId: 'p2',
    isBoss: false,
    isElite: false,
    isCampMonster: false,
    isFieldMonster: true,
    expReward: 20,
    bonusMultiplier: 1,
  });
  coord.recordGhostRemoval('m_ghost_hit');

  const chunks = coord.buildFullSyncChunks(hostMap, 2, 0);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].hostEpoch, 3);
  assert.ok((chunks[0].syncSeq ?? 0) > 0);

  // Full sync must NOT drop pendingKills or explicit ghost removals
  const deltaBatches = coord.buildDeltaBatches(hostMap, 2, 0);
  assert.equal(deltaBatches.length, 1);
  assert.deepEqual(
    deltaBatches[0].kills.map((k) => k.id),
    ['m_killed']
  );
  assert.ok(deltaBatches[0].removedIds.includes('m_ghost_hit'));
});

test('applyDeltaSync tombstones dead mobs against late spawns, disposes hp<=0 updates, ignores stale seqs, and catches equal-count digest drift', () => {
  const coord = new MonsterSyncCoordinator();
  const mockScene = createMockScene();
  const guestMonsters = new Map<string, MonsterVisual>([
    ['m_1', makeVisual(makeMonster({ id: 'm_1', hp: 50 }))],
    ['m_2', makeVisual(makeMonster({ id: 'm_2', hp: 10 }))],
  ]);

  const kills: MonsterKillSyncPayload[] = [];
  const callbacks = {
    onExplosion: () => {},
    onShake: () => {},
    onRemoteKill: (k: MonsterKillSyncPayload) => kills.push(k),
  };

  // 1. Kill m_1 and send hp=0 update for m_2
  const r1 = coord.applyDeltaSync(
    mockScene,
    guestMonsters,
    {
      hostEpoch: 2,
      syncSeq: 10,
      spawns: [],
      updates: [['m_2', 400, 400, 0, 100, 1, 0, 0]],
      kills: [
        {
          id: 'm_1',
          x: 400,
          y: 400,
          killerId: 'p1',
          isBoss: false,
          isElite: false,
          isCampMonster: false,
          isFieldMonster: true,
          expReward: 15,
          bonusMultiplier: 1,
        },
      ],
      removedIds: [],
      totalMonsterCount: 0,
      liveMonsterDigest: 0,
      waveCount: 1,
      bossWaveCount: 0,
    },
    callbacks
  );
  assert.equal(guestMonsters.size, 0);
  assert.equal(kills.length, 1);
  assert.equal(r1.needsFullSync, false);

  // 2. Late spawn attempting to resurrect tombstoned m_1 + duplicate kill reward must be ignored
  coord.applyDeltaSync(
    mockScene,
    guestMonsters,
    {
      hostEpoch: 2,
      syncSeq: 11,
      spawns: [makeMonster({ id: 'm_1', hp: 100 })],
      updates: [],
      kills: [
        {
          id: 'm_1',
          x: 400,
          y: 400,
          killerId: 'p1',
          isBoss: false,
          isElite: false,
          isCampMonster: false,
          isFieldMonster: true,
          expReward: 15,
          bonusMultiplier: 1,
        },
      ],
      removedIds: [],
      totalMonsterCount: 0,
      liveMonsterDigest: 0,
      waveCount: 1,
      bossWaveCount: 0,
    },
    callbacks
  );
  assert.equal(guestMonsters.has('m_1'), false);
  assert.equal(kills.length, 1);

  // 3. Stale syncSeq packet must be dropped cleanly
  const rStale = coord.applyDeltaSync(
    mockScene,
    guestMonsters,
    {
      hostEpoch: 2,
      syncSeq: 5,
      spawns: [makeMonster({ id: 'm_stale', hp: 100 })],
      updates: [],
      kills: [],
      removedIds: [],
      totalMonsterCount: 1,
      liveMonsterDigest: computeMonsterIdDigest(makeMonsterMap([{ id: 'm_stale' }])).digest,
      waveCount: 1,
      bossWaveCount: 0,
    },
    callbacks
  );
  assert.equal(guestMonsters.has('m_stale'), false);
  assert.equal(rStale.needsFullSync, false);

  // 4. Equal monster count (1 vs 1) with different IDs triggers needsFullSync after 2 consecutive mismatches
  guestMonsters.set('m_local_ghost', makeVisual(makeMonster({ id: 'm_local_ghost', hp: 80 })));
  const mismatchedDigest = computeMonsterIdDigest(
    makeMonsterMap([{ id: 'm_real_host_mob' }])
  ).digest;
  const rDrift1 = coord.applyDeltaSync(
    mockScene,
    guestMonsters,
    {
      hostEpoch: 2,
      syncSeq: 12,
      spawns: [],
      updates: [],
      kills: [],
      removedIds: [],
      totalMonsterCount: 1,
      liveMonsterDigest: mismatchedDigest,
      waveCount: 1,
      bossWaveCount: 0,
    },
    callbacks
  );
  assert.equal(rDrift1.needsFullSync, false);

  const rDrift2 = coord.applyDeltaSync(
    mockScene,
    guestMonsters,
    {
      hostEpoch: 2,
      syncSeq: 13,
      spawns: [],
      updates: [],
      kills: [],
      removedIds: [],
      totalMonsterCount: 1,
      liveMonsterDigest: mismatchedDigest,
      waveCount: 1,
      bossWaveCount: 0,
    },
    callbacks
  );
  assert.equal(rDrift2.needsFullSync, true);
});

test('reconcileWorldStateSnapshot syncs unlocked islands & buildings while preserving local camp metadata', () => {
  const localIslands: Island[] = [
    {
      id: 0,
      gridX: 0,
      gridY: 0,
      costWood: 0,
      costStone: 0,
      costGold: 0,
      unlocked: true,
      name: '중심 마을',
      villageTier: 2,
      coreHp: 350,
      coreMaxHp: 350,
    },
    {
      id: 1,
      gridX: 1,
      gridY: 0,
      costWood: 20,
      costStone: 20,
      costGold: 5,
      unlocked: false,
      name: '동쪽 초원',
      villageTier: 0,
      coreHp: 200,
      coreMaxHp: 200,
      isMonsterCamp: true,
      campRing: 1,
      campLevel: 2,
      campDestroyed: false,
      campRespawnSec: 45,
    },
  ];
  const hostIslands: Island[] = [
    { ...localIslands[0], villageTier: 3, coreHp: 400, coreMaxHp: 450 },
    { ...localIslands[1], unlocked: true, ownerId: 'p2', ownerName: '동료', villageTier: 1 },
  ];
  const hostBuildings: ConstructedBuilding[] = [
    {
      id: 'cb_0_4_a',
      territoryId: 0,
      type: 'job_hall',
      category: 'special',
      name: '왕국 전직소',
      x: 500,
      y: 400,
      hp: 380,
      maxHp: 380,
      slotIndex: 4,
    },
  ];

  const payload = buildWorldStateSyncPayload(2, hostIslands, hostBuildings);
  const reconciled = reconcileWorldStateSnapshot(localIslands, [], payload);

  assert.equal(reconciled.changed, true);
  assert.equal(reconciled.islands[0].villageTier, 3);
  assert.equal(reconciled.islands[1].unlocked, true);
  assert.equal(reconciled.islands[1].ownerId, 'p2');
  assert.equal(reconciled.islands[1].campLevel, 2);
  assert.equal(reconciled.islands[1].campRespawnSec, 45);
  assert.equal(reconciled.constructedBuildings.length, 1);

  // Applying the same payload again reports changed: false to avoid redundant Phaser re-renders
  const noOp = reconcileWorldStateSnapshot(
    reconciled.islands,
    reconciled.constructedBuildings,
    payload
  );
  assert.equal(noOp.changed, false);
});
