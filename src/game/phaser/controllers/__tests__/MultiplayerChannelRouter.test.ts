import assert from 'node:assert/strict';
import test from 'node:test';
import { HOST_SYNC_CONFIG } from '../../../../data/worldRules';
import type {
  ConnectionResumeHandler,
  INetworkTransport,
  NetworkEventHandler,
  NetworkPresenceMeta,
  NetworkPresenceSnapshot,
  NetworkTransportStatus,
  PlayerLeaveHandler,
  PresenceSyncHandler,
} from '../../../../lib/contracts/INetworkTransport';
import { MultiplayerChannelRouter } from '../MultiplayerChannelRouter';

class MockTransport implements INetworkTransport {
  public connectedMeta: Omit<NetworkPresenceMeta, 'joinedAt'> | null = null;
  private presenceHandlers = new Set<PresenceSyncHandler>();
  private leaveHandlers = new Set<PlayerLeaveHandler>();
  private resumeHandlers = new Set<ConnectionResumeHandler>();
  private eventHandlers = new Map<string, Set<NetworkEventHandler>>();

  connect(_roomId: string, _playerId: string, meta: Omit<NetworkPresenceMeta, 'joinedAt'>): void {
    this.connectedMeta = meta;
  }
  disconnect(): void {}
  emit(): void {}
  on<T = unknown>(event: string, handler: NetworkEventHandler<T>): () => void {
    let set = this.eventHandlers.get(event);
    if (!set) {
      set = new Set();
      this.eventHandlers.set(event, set);
    }
    const wrapped = handler as NetworkEventHandler;
    set.add(wrapped);
    return () => set?.delete(wrapped);
  }
  onPresenceSync(handler: PresenceSyncHandler): () => void {
    this.presenceHandlers.add(handler);
    return () => this.presenceHandlers.delete(handler);
  }
  onPlayerLeave(handler: PlayerLeaveHandler): () => void {
    this.leaveHandlers.add(handler);
    return () => this.leaveHandlers.delete(handler);
  }
  onConnectionResume(handler: ConnectionResumeHandler): () => void {
    this.resumeHandlers.add(handler);
    return () => this.resumeHandlers.delete(handler);
  }
  getStatus(): NetworkTransportStatus {
    return 'connected';
  }
  getIsHost(): boolean {
    return false;
  }
  getOnlineCount(): number {
    return 1;
  }

  emitPresence(snapshot: NetworkPresenceSnapshot): void {
    this.presenceHandlers.forEach((h) => h(snapshot));
  }
}

function createRouterHarness(opts: { playerId: string; preferredHostId?: string }) {
  const hostStatusCalls: Array<{ isHost: boolean; hostEpoch?: number }> = [];
  const hostIdentityCalls: Array<{ hostId: string; isHost: boolean; hostEpoch: number }> = [];
  const transport = new MockTransport();

  const router = new MultiplayerChannelRouter({
    getPlayerId: () => opts.playerId,
    getPlayerName: () => '테스터',
    getPlayerColor: () => 'blue',
    getRoomId: () => 'ROOM01',
    getRoomMode: () => 'coop',
    getPreferredHostId: () => opts.preferredHostId,
    onOnlineCountChanged: () => {},
    onHostStatusChanged: (isHost, hostEpoch) => hostStatusCalls.push({ isHost, hostEpoch }),
    onHostIdentityChanged: (hostId, isHost, hostEpoch) =>
      hostIdentityCalls.push({ hostId, isHost, hostEpoch }),
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
  });

  router.connect(transport);
  return { router, transport, hostStatusCalls, hostIdentityCalls };
}

test('Root Cause #4: lobby guest holds temporary host promotion during grace window when arriving before lobby host', () => {
  const h = createRouterHarness({ playerId: 'guest_p2', preferredHostId: 'host_p1' });
  assert.equal(h.transport.connectedMeta?.preferredHostId, 'host_p1');

  // Guest connects before host_p1 enters Presence -> initially looks solo/host
  h.transport.emitPresence({
    isHost: true,
    hostId: 'guest_p2',
    hostEpoch: 0,
    onlineCount: 1,
    members: [
      { playerId: 'guest_p2', name: '게스트', color: 'blue', isHost: true, joinedAt: 1000 },
    ],
  });

  // Must NOT prematurely promote guest_p2 to Host!
  assert.equal(h.hostStatusCalls.length, 0);
  assert.equal(h.router.getIsHost(), false);

  // Lobby host arrives within grace period -> guest resolves directly as Guest without ever spawning fake host mobs
  h.transport.emitPresence({
    isHost: false,
    hostId: 'host_p1',
    hostEpoch: 1,
    onlineCount: 2,
    members: [
      { playerId: 'host_p1', name: '방장', color: 'red', isHost: true, joinedAt: 1050, claimedEpoch: 1 },
      { playerId: 'guest_p2', name: '게스트', color: 'blue', isHost: false, joinedAt: 11050, claimedEpoch: 0 },
    ],
  });

  assert.deepEqual(h.hostStatusCalls, [{ isHost: false, hostEpoch: 1 }]);
  assert.equal(h.router.getIsHost(), false);
  h.router.destroy();
});

test('Root Cause #4 fallback: lobby guest promotes after initialLobbyHostGraceMs if lobby host never joins', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = createRouterHarness({ playerId: 'guest_p2', preferredHostId: 'host_p1' });

  h.transport.emitPresence({
    isHost: true,
    hostId: 'guest_p2',
    hostEpoch: 0,
    onlineCount: 1,
    members: [
      { playerId: 'guest_p2', name: '게스트', color: 'blue', isHost: true, joinedAt: 1000 },
    ],
  });
  assert.equal(h.hostStatusCalls.length, 0);

  t.mock.timers.tick(HOST_SYNC_CONFIG.initialLobbyHostGraceMs);
  assert.deepEqual(h.hostStatusCalls, [{ isHost: true, hostEpoch: 0 }]);
  assert.equal(h.router.getIsHost(), true);
  h.router.destroy();
});

test('Root Cause #3: switching hostId while remaining Guest emits onHostIdentityChanged for sequence-guard reset', () => {
  const h = createRouterHarness({ playerId: 'guest_p3', preferredHostId: 'host_p1' });

  h.transport.emitPresence({
    isHost: false,
    hostId: 'host_p1',
    hostEpoch: 1,
    onlineCount: 3,
    members: [
      { playerId: 'host_p1', name: '방장1', color: 'red', isHost: true, joinedAt: 1000, claimedEpoch: 1 },
      { playerId: 'guest_p2', name: '게스트2', color: 'blue', isHost: false, joinedAt: 2000, claimedEpoch: 0 },
      { playerId: 'guest_p3', name: '게스트3', color: 'blue', isHost: false, joinedAt: 3000, claimedEpoch: 0 },
    ],
  });
  assert.equal(h.hostStatusCalls.length, 1);
  assert.equal(h.hostIdentityCalls.length, 0);

  // host_p1 leaves -> guest_p2 becomes host while guest_p3 remains Guest
  h.transport.emitPresence({
    isHost: false,
    hostId: 'guest_p2',
    hostEpoch: 2,
    onlineCount: 2,
    members: [
      { playerId: 'guest_p2', name: '게스트2', color: 'blue', isHost: true, joinedAt: 2000, claimedEpoch: 2 },
      { playerId: 'guest_p3', name: '게스트3', color: 'blue', isHost: false, joinedAt: 3000, claimedEpoch: 0 },
    ],
  });

  // isHost did not change (still false), so onHostIdentityChanged MUST fire!
  assert.equal(h.hostStatusCalls.length, 1);
  assert.deepEqual(h.hostIdentityCalls, [{ hostId: 'guest_p2', isHost: false, hostEpoch: 2 }]);
  h.router.destroy();
});
