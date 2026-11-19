import assert from 'node:assert/strict';
import test from 'node:test';
import { HOST_SYNC_CONFIG, MONSTER_SYNC_CONFIG } from '../../../../data/worldRules';
import type { HostHandoverPayload, HostHeartbeatPayload } from '../../../../types/monsterSync';
import type { RoomMember } from '../../../../types/room';
import { HostFailoverWatchdog } from '../HostFailoverWatchdog';

function makeMembers(): RoomMember[] {
  return [
    { playerId: 'p1', name: '방장', color: 'blue', isHost: true, joinedAt: 1000, claimedEpoch: 0 },
    { playerId: 'p2', name: '게스트1', color: 'red', isHost: false, joinedAt: 2000, claimedEpoch: 0 },
    { playerId: 'p3', name: '게스트2', color: 'blue', isHost: false, joinedAt: 3000, claimedEpoch: 0 },
    { playerId: 'p4', name: '게스트3', color: 'red', isHost: false, joinedAt: 4000, claimedEpoch: 0 },
  ];
}

function createHarness(localPlayerId: string) {
  let nowMs = 10_000;
  let localDigest = { count: 4, digest: 0x12345678 };
  const heartbeats: HostHeartbeatPayload[] = [];
  const handovers: HostHandoverPayload[] = [];
  const claimedEpochs: number[] = [];
  const yieldCalls: boolean[] = [];
  const bgUpdates: boolean[] = [];
  let digestMismatchCount = 0;
  let resumeResyncCount = 0;

  const watchdog = new HostFailoverWatchdog({
    getLocalPlayerId: () => localPlayerId,
    isCoopMode: () => true,
    getLiveMonsterDigest: () => localDigest,
    onSendHostHeartbeat: (payload) => heartbeats.push(payload),
    onSendHostHandover: (payload) => handovers.push(payload),
    onClaimHostAuthority: (nextEpoch) => claimedEpochs.push(nextEpoch),
    onYieldHostAuthority: (isBg) => yieldCalls.push(isBg),
    onUpdatePresenceBackground: (isBg) => bgUpdates.push(isBg),
    onDigestMismatchDetected: () => {
      digestMismatchCount += 1;
    },
    onResumeResyncNeeded: () => {
      resumeResyncCount += 1;
    },
    getNow: () => nowMs,
  });

  return {
    watchdog,
    heartbeats,
    handovers,
    claimedEpochs,
    yieldCalls,
    bgUpdates,
    getDigestMismatchCount: () => digestMismatchCount,
    getResumeResyncCount: () => resumeResyncCount,
    setLocalDigest: (count: number, digest: number) => {
      localDigest = { count, digest };
    },
    advance: (ms: number) => {
      nowMs += ms;
      return nowMs;
    },
    now: () => nowMs,
  };
}

test('HostFailoverWatchdog emits periodic host heartbeats carrying monster count and digest', () => {
  const h = createHarness('p1');
  h.watchdog.updatePresenceSnapshot({
    isHost: true,
    hostId: 'p1',
    hostEpoch: 2,
    onlineCount: 4,
    members: makeMembers(),
  });

  h.watchdog.tick();
  assert.equal(h.heartbeats.length, 1);
  assert.equal(h.heartbeats[0].hostId, 'p1');
  assert.equal(h.heartbeats[0].hostEpoch, 2);
  assert.equal(h.heartbeats[0].liveMonsterCount, 4);
  assert.equal(h.heartbeats[0].liveMonsterDigest, 0x12345678);

  h.advance(HOST_SYNC_CONFIG.heartbeatIntervalMs - 100);
  h.watchdog.tick();
  assert.equal(h.heartbeats.length, 1);

  h.advance(100);
  h.watchdog.tick();
  assert.equal(h.heartbeats.length, 2);
});

test('HostFailoverWatchdog triggers deterministic staggered failover when host goes silent', () => {
  const rank0 = createHarness('p2');
  const rank1 = createHarness('p3');
  const members = makeMembers();

  rank0.watchdog.updatePresenceSnapshot({
    isHost: false,
    hostId: 'p1',
    hostEpoch: 1,
    onlineCount: 4,
    members,
  });
  rank1.watchdog.updatePresenceSnapshot({
    isHost: false,
    hostId: 'p1',
    hostEpoch: 1,
    onlineCount: 4,
    members,
  });

  rank0.advance(HOST_SYNC_CONFIG.failoverTimeoutMs - 100);
  rank1.advance(HOST_SYNC_CONFIG.failoverTimeoutMs - 100);
  rank0.watchdog.tick();
  rank1.watchdog.tick();
  assert.deepEqual(rank0.claimedEpochs, []);
  assert.deepEqual(rank1.claimedEpochs, []);

  // At timeout boundary, rank 0 claims epoch 2 while rank 1 waits for stagger delay
  rank0.advance(100);
  rank1.advance(100);
  rank0.watchdog.tick();
  rank1.watchdog.tick();
  assert.deepEqual(rank0.claimedEpochs, [2]);
  assert.deepEqual(rank1.claimedEpochs, []);

  // If rank 0 fails to claim, rank 1 claims after stagger delay
  rank1.advance(HOST_SYNC_CONFIG.failoverCandidateStaggerMs);
  rank1.watchdog.tick();
  assert.deepEqual(rank1.claimedEpochs, [2]);
});

test('HostFailoverWatchdog proactively hands over host on mobile backgrounding and yields safely on resume', () => {
  const host = createHarness('p1');
  const guest = createHarness('p2');
  const members = makeMembers();

  host.watchdog.updatePresenceSnapshot({
    isHost: true,
    hostId: 'p1',
    hostEpoch: 1,
    onlineCount: 4,
    members,
  });
  guest.watchdog.updatePresenceSnapshot({
    isHost: false,
    hostId: 'p1',
    hostEpoch: 1,
    onlineCount: 4,
    members,
  });

  host.watchdog.handleVisibilityChange(true);
  assert.equal(host.handovers.length, 1);
  assert.equal(host.handovers[0].fromHostId, 'p1');
  assert.deepEqual(host.yieldCalls, [true]);

  // Rank-0 guest immediately claims host upon receiving handover
  guest.watchdog.handleHostHandover(host.handovers[0]);
  assert.deepEqual(guest.claimedEpochs, [2]);

  // Returning ex-host comes back foreground -> yields priority (no hijack) & requests resync
  host.advance(5000);
  host.watchdog.handleVisibilityChange(false);
  assert.deepEqual(host.yieldCalls, [true, false]);
  assert.equal(host.getResumeResyncCount(), 1);
});

test('HostFailoverWatchdog triggers full resync after consecutive heartbeat monster digest mismatches', () => {
  const guest = createHarness('p2');
  guest.watchdog.updatePresenceSnapshot({
    isHost: false,
    hostId: 'p1',
    hostEpoch: 1,
    onlineCount: 4,
    members: makeMembers(),
  });
  guest.setLocalDigest(4, 0x11111111);

  for (let i = 0; i < MONSTER_SYNC_CONFIG.digestMismatchTriggerCount - 1; i++) {
    guest.watchdog.handleHostHeartbeat({
      hostId: 'p1',
      hostEpoch: 1,
      liveMonsterCount: 4,
      liveMonsterDigest: 0x22222222,
      sentAt: guest.advance(1500),
    });
  }
  assert.equal(guest.getDigestMismatchCount(), 0);

  guest.watchdog.handleHostHeartbeat({
    hostId: 'p1',
    hostEpoch: 1,
    liveMonsterCount: 4,
    liveMonsterDigest: 0x22222222,
    sentAt: guest.advance(1500),
  });
  assert.equal(guest.getDigestMismatchCount(), 1);
});

test('HostFailoverWatchdog.recordPeerActivity refreshes silence timer only for current host', () => {
  const guest = createHarness('p2');
  guest.watchdog.updatePresenceSnapshot({
    isHost: false,
    hostId: 'p1',
    hostEpoch: 1,
    onlineCount: 4,
    members: makeMembers(),
  });

  // Advance close to failover timeout, then receive player_move from non-host peer p3 -> must NOT reset
  guest.advance(HOST_SYNC_CONFIG.failoverTimeoutMs - 500);
  guest.watchdog.recordPeerActivity('p3');
  guest.advance(600);
  guest.watchdog.tick();
  assert.deepEqual(guest.claimedEpochs, [2]);

  // Fresh guest where current host p1 sends player_move -> MUST refresh silence timer and prevent false failover
  const guest2 = createHarness('p2');
  guest2.watchdog.updatePresenceSnapshot({
    isHost: false,
    hostId: 'p1',
    hostEpoch: 1,
    onlineCount: 4,
    members: makeMembers(),
  });
  guest2.advance(HOST_SYNC_CONFIG.failoverTimeoutMs - 500);
  guest2.watchdog.recordPeerActivity('p1');
  guest2.advance(600);
  guest2.watchdog.tick();
  assert.deepEqual(guest2.claimedEpochs, []);
});

