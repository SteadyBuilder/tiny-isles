import assert from 'node:assert/strict';
import test from 'node:test';
import { RoomStateMachine } from '../roomStateMachine';

test('4인 정원 초과 시 5번째 플레이어를 서버에서 ROOM_FULL로 즉시 거절한다', () => {
  const room = new RoomStateMachine('AB12CD');
  for (let i = 1; i <= 4; i++) {
    const res = room.join({
      playerId: `p${i}`,
      name: `유저${i}`,
      color: i % 2 === 0 ? 'red' : 'blue',
      appVersion: 'v1.0.0',
      nowMs: 1000 + i * 10,
    });
    assert.equal(res.ok, true);
  }

  const fifth = room.join({
    playerId: 'p5',
    name: '유저5',
    color: 'blue',
    appVersion: 'v1.0.0',
    nowMs: 2000,
  });
  assert.equal(fifth.ok, false);
  if (!fifth.ok) {
    assert.equal(fifth.reason, 'ROOM_FULL');
  }
  assert.equal(room.getMemberCount(), 4);
});

test('프로덕션 빌드에서 방장과 앱 버전이 다르거나 누락되면 VERSION_MISMATCH로 거절한다', () => {
  const room = new RoomStateMachine('VER001');
  const hostJoin = room.join({
    playerId: 'host',
    name: '방장',
    color: 'blue',
    appVersion: '20261119-abc123',
    nowMs: 1000,
  });
  assert.equal(hostJoin.ok, true);

  const mismatch = room.join({
    playerId: 'guest_old',
    name: '구버전',
    color: 'red',
    appVersion: '20261118-old999',
    nowMs: 1100,
  });
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) {
    assert.equal(mismatch.reason, 'VERSION_MISMATCH');
    assert.equal(mismatch.hostAppVersion, '20261119-abc123');
  }

  const missingVersion = room.join({
    playerId: 'guest_legacy',
    name: '미전송',
    color: 'red',
    nowMs: 1200,
  });
  assert.equal(missingVersion.ok, false);
  if (!missingVersion.ok) {
    assert.equal(missingVersion.reason, 'VERSION_MISMATCH');
  }

  const sameVersion = room.join({
    playerId: 'guest_ok',
    name: '정상',
    color: 'red',
    appVersion: '20261119-abc123',
    nowMs: 1300,
  });
  assert.equal(sameVersion.ok, true);
});

test('방장이 백그라운드로 전환하거나 이탈하면 즉시 다음 포그라운드 멤버로 방장이 이양된다', () => {
  const room = new RoomStateMachine('HOST01');
  room.join({ playerId: 'p1', name: 'A', color: 'blue', appVersion: 'dev', nowMs: 1000 });
  room.join({ playerId: 'p2', name: 'B', color: 'red', appVersion: 'dev', nowMs: 2000 });
  room.join({ playerId: 'p3', name: 'C', color: 'blue', appVersion: 'dev', nowMs: 3000 });

  assert.equal(room.getHostId(), 'p1');
  const epoch1 = room.getHostEpoch();

  // 방장 모바일 백그라운드 전환 -> p2로 즉시 이양
  const bg = room.setBackground('p1', true);
  assert.equal(bg.hostChanged, true);
  assert.equal(room.getHostId(), 'p2');
  assert.equal(room.getHostEpoch(), epoch1 + 1);

  // p2 이탈 -> p3로 즉시 이양 (p1은 백그라운드 상태)
  const leave = room.leave('p2');
  assert.equal(leave.hostChanged, true);
  assert.equal(room.getHostId(), 'p3');
  assert.equal(room.getHostEpoch(), epoch1 + 2);
});

test('게임 시작 후 중도 합류 정책(진행률 65% 이상 / 방장 잠금)을 서버에서 차단한다', () => {
  const room = new RoomStateMachine('DROP01');
  room.join({
    playerId: 'p1',
    name: '방장',
    color: 'blue',
    appVersion: 'dev',
    initialMeta: { targetCount: 20, currentCount: 0, allowDropIn: true },
    nowMs: 1000,
  });

  const started = room.startGame('p1');
  assert.equal(started.ok, true);
  assert.equal(room.getStatus(), 'playing');

  // 초반(20% 진행) 중도 합류 허용
  room.updateMeta('p1', { currentCount: 4 });
  const earlyJoin = room.join({
    playerId: 'p2',
    name: '초반합류',
    color: 'red',
    appVersion: 'dev',
    nowMs: 2000,
  });
  assert.equal(earlyJoin.ok, true);
  if (earlyJoin.ok) {
    assert.equal(earlyJoin.isDropIn, true);
  }

  // 종반부(14/20 = 70% 진행) 중도 합류 차단
  room.updateMeta('p1', { currentCount: 14 });
  const lateJoin = room.join({
    playerId: 'p3',
    name: '종반합류',
    color: 'blue',
    appVersion: 'dev',
    nowMs: 3000,
  });
  assert.equal(lateJoin.ok, false);
  if (!lateJoin.ok) {
    assert.equal(lateJoin.reason, 'GAME_LOCKED');
  }
});

test('모든 플레이어가 퇴장하면 방이 초기화되고 공개 목록에서 제거된다', () => {
  const room = new RoomStateMachine('CLEAN1');
  room.join({ playerId: 'p1', name: '방장', color: 'blue', appVersion: 'dev', nowMs: 1000 });
  room.startGame('p1');
  room.updateSnapshot('p1', { tick: 42 });

  assert.notEqual(room.toPublicListing(1500), null);
  const leave = room.leave('p1');
  assert.equal(leave.isEmpty, true);
  assert.equal(room.getStatus(), 'waiting');
  assert.equal(room.getCachedSnapshot(), null);
  assert.equal(room.toPublicListing(2000), null);
});
