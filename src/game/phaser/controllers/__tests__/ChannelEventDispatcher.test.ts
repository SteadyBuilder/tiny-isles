import assert from 'node:assert/strict';
import test from 'node:test';
import type { RemotePlayerSkillCastPayload } from '../../../../types/combat';
import type { Player } from '../../../../types/game';
import {
  IMultiplayerChannelCallbacks,
  SHARED_CHANNEL_EVENTS,
  dispatchSharedChannelEvent,
} from '../ChannelEventDispatcher';

function createStubCallbacks(
  overrides: Partial<IMultiplayerChannelCallbacks> = {}
): IMultiplayerChannelCallbacks {
  return {
    getPlayerId: () => 'local-1',
    getPlayerName: () => '로컬수호자',
    getPlayerColor: () => 'blue',
    onOnlineCountChanged: () => {},
    onRemotePlayerMove: () => {},
    onRemotePlayerLeave: () => {},
    onRemoteEntityHit: () => {},
    onRemoteIslandUnlocked: () => {},
    onRemoteVillageUpgraded: () => {},
    onRemoteBuildingConstructed: () => {},
    onRemoteWaveSpawned: () => {},
    onRemoteMonstersSync: () => {},
    onRemoteMonsterHit: () => {},
    onRemoteTerritoryLost: () => {},
    ...overrides,
  };
}

test('SHARED_CHANNEL_EVENTS includes player_skill_cast for multiplayer skill sync', () => {
  assert.ok(SHARED_CHANNEL_EVENTS.includes('player_skill_cast'));
});

test('dispatchSharedChannelEvent routes player_skill_cast payload to onRemotePlayerSkillCast', () => {
  const received: RemotePlayerSkillCastPayload[] = [];
  const callbacks = createStubCallbacks({
    onRemotePlayerSkillCast: (payload) => received.push(payload),
  });

  const payload: RemotePlayerSkillCastPayload = {
    casterId: 'remote-2',
    casterName: '동료마법사',
    classId: 'archmage',
    casterX: 420,
    casterY: 310,
    facingDir: 'left',
    radius: 185,
    targetPoints: [{ x: 480, y: 290 }],
  };

  dispatchSharedChannelEvent('player_skill_cast', payload, callbacks);

  assert.equal(received.length, 1);
  assert.deepEqual(received[0], payload);
});

test('dispatchSharedChannelEvent preserves hp and maxHp fields on player_move', () => {
  const received: Player[] = [];
  const callbacks = createStubCallbacks({
    onRemotePlayerMove: (player) => received.push(player),
  });

  const playerPayload: Player = {
    id: 'remote-2',
    name: '동료전사',
    x: 200,
    y: 250,
    direction: 'right',
    action: 'run',
    color: 'red',
    hp: 64,
    maxHp: 140,
    isFainted: false,
    lastUpdated: 123456,
  };

  dispatchSharedChannelEvent('player_move', playerPayload, callbacks);

  assert.equal(received.length, 1);
  assert.equal(received[0].hp, 64);
  assert.equal(received[0].maxHp, 140);
});

test('SHARED_CHANNEL_EVENTS includes host_heartbeat, host_handover, and world_state_sync', () => {
  assert.ok(SHARED_CHANNEL_EVENTS.includes('host_heartbeat'));
  assert.ok(SHARED_CHANNEL_EVENTS.includes('host_handover'));
  assert.ok(SHARED_CHANNEL_EVENTS.includes('world_state_sync'));
});

test('dispatchSharedChannelEvent routes host_heartbeat, host_handover, world_state_sync, and monsters_sync metadata', () => {
  const heartbeats: unknown[] = [];
  const handovers: unknown[] = [];
  const worldSyncs: unknown[] = [];
  const monsterSyncs: Array<{ hostEpoch?: number; syncSeq?: number }> = [];

  const callbacks = createStubCallbacks({
    onRemoteHostHeartbeat: (p) => heartbeats.push(p),
    onRemoteHostHandover: (p) => handovers.push(p),
    onRemoteWorldStateSync: (p) => worldSyncs.push(p),
    onRemoteMonstersSync: (p) => monsterSyncs.push({ hostEpoch: p.hostEpoch, syncSeq: p.syncSeq }),
  });

  dispatchSharedChannelEvent(
    'host_heartbeat',
    { hostId: 'p1', hostEpoch: 2, liveMonsterCount: 5, liveMonsterDigest: 99, sentAt: 1000 },
    callbacks
  );
  dispatchSharedChannelEvent(
    'host_handover',
    { fromHostId: 'p1', hostEpoch: 2, reason: 'background' },
    callbacks
  );
  dispatchSharedChannelEvent(
    'world_state_sync',
    { hostEpoch: 2, islands: [], constructedBuildings: [] },
    callbacks
  );
  dispatchSharedChannelEvent(
    'monsters_sync',
    { monsters: [], waveCount: 1, bossWaveCount: 0, hostEpoch: 2, syncSeq: 7 },
    callbacks
  );

  assert.equal(heartbeats.length, 1);
  assert.equal(handovers.length, 1);
  assert.equal(worldSyncs.length, 1);
  assert.deepEqual(monsterSyncs, [{ hostEpoch: 2, syncSeq: 7 }]);
});
