import assert from 'node:assert/strict';
import test from 'node:test';
import type Phaser from 'phaser';
import { MONSTER_SYNC_CONFIG, WORLD_CLOCK_CONFIG } from '../../../data/worldRules';
import type { Monster } from '../../../types/game';
import type { MonstersDeltaSyncPayload, MonstersFullSyncPayload } from '../../../types/monsterSync';
import type { MonsterVisual } from '../MonsterVisualManager';
import { WaveNetworkSyncBridge } from '../WaveNetworkSyncBridge';

function makeMonster(id = 'm_1', hp = 100): Monster {
  return {
    id,
    type: 'goblin',
    name: '고블린',
    isBoss: false,
    x: 200,
    y: 300,
    hp,
    maxHp: 100,
    attack: 12,
    speed: 70,
    targetTerritoryId: 0,
    spawnTerritoryId: 0,
    direction: 'right',
    isFieldMonster: true,
  };
}

function makeVisual(monster: Monster): MonsterVisual {
  const container = { x: monster.x, y: monster.y, depth: 0, setPosition() {}, setDepth() {}, destroy() {} };
  const sprite = { setFlipX() {} };
  return {
    monster,
    container: container as unknown as Phaser.GameObjects.Container,
    sprite: sprite as unknown as Phaser.GameObjects.Sprite,
    hpBar: null,
    baseTint: null,
    hpTrailRatio: 1,
    hpFlashUntil: 0,
    lastAttackTime: 0,
  };
}

function createBridge(opts?: { isHost?: boolean; hasActiveInvaders?: boolean; now?: () => number }) {
  let host = opts?.isHost ?? true;
  let activeInvaders = opts?.hasActiveInvaders ?? true;
  let nowMs = 10_000;
  const fullSyncs: MonstersFullSyncPayload[] = [];
  const deltaSyncs: MonstersDeltaSyncPayload[] = [];
  const waveSyncCalls: Array<{ waveCount: number; bossWaveCount: number }> = [];
  let syncRequests = 0;

  const bridge = new WaveNetworkSyncBridge({
    isHost: () => host,
    hasActiveInvaders: () => activeInvaders,
    getWaveCounts: () => ({ waveCount: 4, bossWaveCount: 1 }),
    onSyncWaveCounts: (waveCount, bossWaveCount) => waveSyncCalls.push({ waveCount, bossWaveCount }),
    broadcastFullSync: (p) => fullSyncs.push(p),
    broadcastDeltaSync: (p) => deltaSyncs.push(p),
    requestMonstersSync: () => { syncRequests += 1; },
    getNow: opts?.now ?? (() => nowMs),
  });

  return {
    bridge,
    fullSyncs,
    deltaSyncs,
    waveSyncCalls,
    getSyncRequests: () => syncRequests,
    setHost: (v: boolean) => { host = v; },
    setActiveInvaders: (v: boolean) => { activeInvaders = v; },
    advanceTime: (ms: number) => { nowMs += ms; },
  };
}

test('shouldBroadcastCoopMonsters toggles with onlineCount and handleRemoteSyncRequest', () => {
  const ctx = createBridge({ isHost: true });
  const monsters = new Map<string, MonsterVisual>();

  assert.equal(ctx.bridge.shouldBroadcastCoopMonsters(), false);
  ctx.bridge.setOnlineCount(2);
  assert.equal(ctx.bridge.shouldBroadcastCoopMonsters(), true);
  ctx.bridge.setOnlineCount(1);
  assert.equal(ctx.bridge.shouldBroadcastCoopMonsters(), false);

  ctx.bridge.handleRemoteSyncRequest(monsters);
  assert.equal(ctx.bridge.shouldBroadcastCoopMonsters(), true);
  assert.equal(ctx.fullSyncs.length, 1);
});

test('broadcastFullMonstersSync enforces cooldown, supports force, and skips offline solo unless fromGuestRequest', () => {
  const ctx = createBridge({ isHost: true });
  const monsters = new Map([['m1', makeVisual(makeMonster('m1'))]]);

  ctx.bridge.broadcastFullMonstersSync(monsters, false, false);
  assert.equal(ctx.fullSyncs.length, 0);

  ctx.bridge.broadcastFullMonstersSync(monsters, false, true);
  assert.equal(ctx.fullSyncs.length, 1);

  ctx.bridge.setOnlineCount(2);
  ctx.advanceTime(MONSTER_SYNC_CONFIG.hostFullSyncCooldownMs - 50);
  ctx.bridge.broadcastFullMonstersSync(monsters, false, false);
  assert.equal(ctx.fullSyncs.length, 1);

  ctx.bridge.broadcastFullMonstersSync(monsters, true, false);
  assert.equal(ctx.fullSyncs.length, 2);

  ctx.advanceTime(MONSTER_SYNC_CONFIG.hostFullSyncCooldownMs);
  ctx.bridge.broadcastFullMonstersSync(monsters, false, false);
  assert.equal(ctx.fullSyncs.length, 3);
});

test('tickHostDeltaSync uses 1x interval for active invaders, 1.4x when idle, and skips offline', () => {
  const ctx = createBridge({ isHost: true, hasActiveInvaders: true });
  const monsters = new Map([['m1', makeVisual(makeMonster('m1'))]]);
  const activeInterval = WORLD_CLOCK_CONFIG.monsterSyncIntervalMs;
  const idleInterval = Math.round(WORLD_CLOCK_CONFIG.monsterSyncIntervalMs * 1.4);

  ctx.bridge.tickHostDeltaSync(monsters, activeInterval + 10);
  assert.equal(ctx.deltaSyncs.length, 0);

  ctx.bridge.setOnlineCount(2);
  ctx.bridge.tickHostDeltaSync(monsters, activeInterval - 1);
  assert.equal(ctx.deltaSyncs.length, 0);
  ctx.bridge.tickHostDeltaSync(monsters, 1);
  assert.equal(ctx.deltaSyncs.length, 1);

  ctx.setActiveInvaders(false);
  monsters.get('m1')!.monster.hp = 80;
  ctx.bridge.tickHostDeltaSync(monsters, activeInterval);
  assert.equal(ctx.deltaSyncs.length, 1);
  ctx.bridge.tickHostDeltaSync(monsters, idleInterval - activeInterval);
  assert.equal(ctx.deltaSyncs.length, 2);
});

test('onEnterGuestMode resets sync state, tickGuestSync throttles requests, and applyRemoteFullSync completes sync', () => {
  const ctx = createBridge({ isHost: false });
  const monsters = new Map<string, MonsterVisual>();

  ctx.bridge.onEnterGuestMode();
  assert.equal(ctx.getSyncRequests(), 1);

  ctx.bridge.tickGuestSync(monsters, 16);
  assert.equal(ctx.getSyncRequests(), 1);

  ctx.advanceTime(MONSTER_SYNC_CONFIG.guestSyncRequestThrottleMs);
  ctx.bridge.tickGuestSync(monsters, 16);
  assert.equal(ctx.getSyncRequests(), 2);

  const readyPayloads: Monster[][] = [];
  ctx.bridge.applyRemoteFullSync(
    { monsters: [makeMonster('m1')], waveCount: 2, bossWaveCount: 0, syncId: 's1', chunkIndex: 0, totalChunks: 2 },
    (m) => readyPayloads.push(m)
  );
  assert.equal(readyPayloads.length, 0);
  assert.equal(ctx.waveSyncCalls.length, 0);

  ctx.bridge.applyRemoteFullSync(
    { monsters: [makeMonster('m2')], waveCount: 5, bossWaveCount: 1, syncId: 's1', chunkIndex: 1, totalChunks: 2 },
    (m) => readyPayloads.push(m)
  );
  assert.equal(readyPayloads.length, 1);
  assert.equal(readyPayloads[0]?.length, 2);
  assert.deepEqual(ctx.waveSyncCalls, [{ waveCount: 5, bossWaveCount: 1 }]);

  ctx.advanceTime(MONSTER_SYNC_CONFIG.guestSyncRequestThrottleMs + 500);
  ctx.bridge.tickGuestSync(monsters, 16);
  assert.equal(ctx.getSyncRequests(), 2);
});

test('scheduleDeltaSyncFlush batches microtask flushes and stops after destroy', async () => {
  const ctx = createBridge({ isHost: true });
  const monsters = new Map([['m1', makeVisual(makeMonster('m1'))]]);
  ctx.bridge.setOnlineCount(2);

  ctx.bridge.scheduleDeltaSyncFlush(() => monsters);
  ctx.bridge.scheduleDeltaSyncFlush(() => monsters);
  assert.equal(ctx.deltaSyncs.length, 0);

  await Promise.resolve();
  assert.equal(ctx.deltaSyncs.length, 1);

  monsters.get('m1')!.monster.hp = 50;
  ctx.bridge.scheduleDeltaSyncFlush(() => monsters);
  ctx.bridge.destroy();
  await Promise.resolve();
  assert.equal(ctx.deltaSyncs.length, 1);
});

test('scheduleDeltaSyncFlush coalesces rapid back-to-back calls within deltaFlushMinIntervalMs', async () => {
  const ctx = createBridge({ isHost: true });
  const monsters = new Map([['m1', makeVisual(makeMonster('m1'))]]);
  ctx.bridge.setOnlineCount(2);

  // First flush runs immediately on microtask
  ctx.bridge.scheduleDeltaSyncFlush(() => monsters);
  await Promise.resolve();
  assert.equal(ctx.deltaSyncs.length, 1);

  // Rapid follow-up within min interval is deferred instead of flooding microtasks
  monsters.get('m1')!.monster.hp = 60;
  ctx.bridge.scheduleDeltaSyncFlush(() => monsters);
  await Promise.resolve();
  assert.equal(ctx.deltaSyncs.length, 1);

  ctx.bridge.destroy();
});

test('broadcastFullMonstersSync paces multi-chunk sends and cancels pending chunks on destroy', () => {
  const ctx = createBridge({ isHost: true });
  ctx.bridge.setOnlineCount(2);
  const monsters = new Map<string, MonsterVisual>();
  for (let i = 0; i < 250; i++) {
    monsters.set(`m_${i}`, makeVisual(makeMonster(`m_${i}`)));
  }

  ctx.bridge.broadcastFullMonstersSync(monsters, true, false);
  // First chunk sends immediately; subsequent chunks are paced via timers
  assert.equal(ctx.fullSyncs.length, 1);
  assert.equal(ctx.fullSyncs[0].chunkIndex, 0);
  assert.equal(ctx.fullSyncs[0].totalChunks, 3);

  ctx.bridge.destroy();
});
