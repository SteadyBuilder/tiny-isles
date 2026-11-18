import assert from 'node:assert/strict';
import test from 'node:test';
import { computeMonotonicJoinedAt, electHostFromPresence } from '../HostAuthorityHelper';

test('electHostFromPresence defaults to localPlayerId as host when presence is empty', () => {
  const res = electHostFromPresence({}, 'local_p1');
  assert.deepEqual(res, {
    isHost: true,
    hostId: 'local_p1',
    onlineCount: 1,
  });
});

test('electHostFromPresence picks the peer with the lowest joinedAt', () => {
  const presence = {
    p_late: [{ joinedAt: 2000 }],
    p_early: [{ joinedAt: 1000 }],
    p_mid: [{ joinedAt: 1500 }],
  };

  assert.deepEqual(electHostFromPresence(presence, 'p_early'), {
    isHost: true,
    hostId: 'p_early',
    onlineCount: 3,
  });

  assert.deepEqual(electHostFromPresence(presence, 'p_late'), {
    isHost: false,
    hostId: 'p_early',
    onlineCount: 3,
  });
});

test('electHostFromPresence breaks equal joinedAt ties deterministically via playerId.localeCompare', () => {
  const presence = {
    player_c: [{ joinedAt: 5000 }],
    player_a: [{ joinedAt: 5000 }],
    player_b: [{ joinedAt: 5000 }],
  };

  const res = electHostFromPresence(presence, 'player_b');
  assert.equal(res.hostId, 'player_a');
  assert.equal(res.isHost, false);
  assert.equal(res.onlineCount, 3);
});

test('electHostFromPresence falls back to MAX_SAFE_INTEGER for empty entry array or non-number joinedAt', () => {
  const presence = {
    empty_entries: [],
    missing_joined: [{}],
    string_joined: [{ joinedAt: '100' as unknown as number }],
    valid_peer: [{ joinedAt: 9000 }],
  };

  const res = electHostFromPresence(presence, 'empty_entries');
  assert.equal(res.hostId, 'valid_peer');
  assert.equal(res.isHost, false);
  assert.equal(res.onlineCount, 4);

  // When all peers lack valid numeric joinedAt, lexical tie-break selects lowest playerId
  const allInvalid = {
    zeta: [],
    alpha: [{ joinedAt: undefined }],
  };
  const fallbackRes = electHostFromPresence(allInvalid, 'alpha');
  assert.equal(fallbackRes.hostId, 'alpha');
  assert.equal(fallbackRes.isHost, true);
});

test('computeMonotonicJoinedAt returns now when presence is empty or now exceeds maxExistingJoinedAt', () => {
  assert.equal(computeMonotonicJoinedAt({}, 12345), 12345);
  assert.equal(
    computeMonotonicJoinedAt({ p1: [{ joinedAt: 1000 }], p2: [{ joinedAt: 2000 }] }, 2500),
    2500
  );
});

test('computeMonotonicJoinedAt jumps to maxExistingJoinedAt + 1 when local clock is skewed behind', () => {
  const presence = {
    p1: [{ joinedAt: 5000 }],
    p2: [{ joinedAt: 8000 }],
  };
  assert.equal(computeMonotonicJoinedAt(presence, 4000), 8001);
  assert.equal(computeMonotonicJoinedAt(presence, 8000), 8001);
});

test('computeMonotonicJoinedAt ignores non-finite or missing joinedAt values', () => {
  const presence = {
    p_empty: [],
    p_missing: [{}],
    p_nan: [{ joinedAt: Number.NaN }],
    p_inf: [{ joinedAt: Number.POSITIVE_INFINITY }],
    p_neg_inf: [{ joinedAt: Number.NEGATIVE_INFINITY }],
    p_valid: [{ joinedAt: 3000 }],
  };
  assert.equal(computeMonotonicJoinedAt(presence, 1000), 3001);

  const onlyInvalid = {
    p_nan: [{ joinedAt: Number.NaN }],
    p_missing: [{}],
  };
  assert.equal(computeMonotonicJoinedAt(onlyInvalid, 1500), 1500);
});
