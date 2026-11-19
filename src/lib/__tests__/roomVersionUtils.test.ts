import assert from 'node:assert/strict';
import test from 'node:test';
import { RoomMember } from '../../types/room';
import { analyzeRoomVersionCompatibility } from '../roomVersionUtils';

function makeMember(
  playerId: string,
  isHost: boolean,
  appVersion?: string
): RoomMember {
  return {
    playerId,
    name: playerId,
    color: isHost ? 'blue' : 'red',
    isHost,
    joinedAt: isHost ? 1000 : 2000,
    appVersion,
  };
}

test('analyzeRoomVersionCompatibility passes when all members match latest build', () => {
  const result = analyzeRoomVersionCompatibility({
    members: [
      makeMember('host', true, '20261119-v2'),
      makeMember('guest', false, '20261119-v2'),
    ],
    localPlayerId: 'host',
    localBuildId: '20261119-v2',
    latestServerBuildId: '20261119-v2',
  });

  assert.equal(result.isCompatible, true);
  assert.equal(result.hasMemberMismatch, false);
  assert.equal(result.isLocalOutdated, false);
  assert.deepEqual(result.outdatedMemberIds, []);
});

test('analyzeRoomVersionCompatibility detects outdated guest with older or missing legacy appVersion', () => {
  const result = analyzeRoomVersionCompatibility({
    members: [
      makeMember('host', true, '20261119-v2'),
      makeMember('guest_old', false, '20261118-v1'),
      makeMember('guest_legacy', false, undefined),
    ],
    localPlayerId: 'host',
    localBuildId: '20261119-v2',
    latestServerBuildId: '20261119-v2',
  });

  assert.equal(result.isCompatible, false);
  assert.equal(result.hasMemberMismatch, true);
  assert.equal(result.isLocalOutdated, false);
  assert.deepEqual(result.outdatedMemberIds, ['guest_old', 'guest_legacy']);
});

test('analyzeRoomVersionCompatibility marks local outdated when server has newer build', () => {
  const result = analyzeRoomVersionCompatibility({
    members: [
      makeMember('host', true, '20261119-v2'),
      makeMember('guest', false, '20261118-v1'),
    ],
    localPlayerId: 'guest',
    localBuildId: '20261118-v1',
    latestServerBuildId: '20261119-v2',
  });

  assert.equal(result.isCompatible, false);
  assert.equal(result.isLocalOutdated, true);
  assert.deepEqual(result.outdatedMemberIds, ['guest']);
});

test('analyzeRoomVersionCompatibility stays compatible in dev mode', () => {
  const result = analyzeRoomVersionCompatibility({
    members: [
      makeMember('host', true, 'dev'),
      makeMember('guest', false, undefined),
    ],
    localPlayerId: 'host',
    localBuildId: 'dev',
    latestServerBuildId: '20261119-v2',
  });

  assert.equal(result.isCompatible, true);
  assert.equal(result.hasMemberMismatch, false);
});
