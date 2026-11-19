import assert from 'node:assert/strict';
import test from 'node:test';
import { activeRoomTransportStore } from '../activeRoomTransportStore';
import { CloudflareRoomTransport } from '../CloudflareRoomTransport';

class MockWebSocket {
  public static readonly OPEN = 1;
  public static instances: MockWebSocket[] = [];
  public readyState = MockWebSocket.OPEN;
  public sent: string[] = [];
  public onopen: (() => void) | null = null;
  public onmessage: ((ev: { data: string }) => void) | null = null;
  public onclose: ((ev: { code: number; reason?: string }) => void) | null = null;
  public onerror: (() => void) | null = null;
  public url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  public send(data: string): void {
    this.sent.push(data);
  }

  public close(code = 1000, reason = ''): void {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
}

test('CloudflareRoomTransport는 단일 연결로 입장·방장 상태·배치 이벤트·인계 후 스냅샷 재전달을 처리한다', () => {
  const originalWs = globalThis.WebSocket;
  MockWebSocket.instances = [];
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;

  try {
    const transport = new CloudflareRoomTransport();
    const receivedEvents: Array<{ ev: string; payload: unknown }> = [];
    transport.on('player_move', (p) => receivedEvents.push({ ev: 'player_move', payload: p }));
    transport.on('entity_hit', (p) => receivedEvents.push({ ev: 'entity_hit', payload: p }));

    transport.connect('ab12cd', 'p1', {
      name: '방장',
      color: 'blue',
      appVersion: '20261119-v1',
    });

    assert.equal(MockWebSocket.instances.length, 1);
    const ws = MockWebSocket.instances[0];
    assert.ok(ws.url.endsWith('/ws/room/AB12CD'));

    ws.onopen?.();
    assert.equal(ws.sent.length, 1);
    const joinMsg = JSON.parse(ws.sent[0]) as { type: string; appVersion?: string };
    assert.equal(joinMsg.type, 'join');
    assert.equal(joinMsg.appVersion, '20261119-v1');

    // 서버 room_state 수신
    ws.onmessage?.({
      data: JSON.stringify({
        type: 'room_state',
        state: {
          roomId: 'AB12CD',
          inviteCode: 'AB12CD',
          status: 'waiting',
          hostId: 'p1',
          hostEpoch: 1,
          maxPlayers: 4,
          members: [
            {
              playerId: 'p1',
              name: '방장',
              color: 'blue',
              isHost: true,
              joinedAt: 1000,
              appVersion: '20261119-v1',
            },
          ],
          meta: {
            roomId: 'AB12CD',
            inviteCode: 'AB12CD',
            missionId: 'expedition_hunting',
            missionTitle: '사냥 원정',
            difficulty: 'normal',
            maxPlayers: 4,
            allowDropIn: true,
            currentCount: 0,
            targetCount: 20,
            elapsedSec: 0,
            timeLimitSec: null,
          },
          hasCachedSnapshot: false,
        },
      }),
    });

    assert.equal(transport.getIsHost(), true);
    assert.equal(transport.getOnlineCount(), 1);

    // 대기실 -> 인게임 인계(Handoff) 시 신규 구독자가 즉시 최신 스냅샷을 재수신해야 함
    activeRoomTransportStore.register('AB12CD', transport);
    const handedOff = activeRoomTransportStore.take('ab12cd');
    assert.equal(handedOff, transport);

    let replayedHostId = '';
    handedOff?.onPresenceSync((snap) => {
      replayedHostId = snap.hostId;
    });
    assert.equal(replayedHostId, 'p1');

    // 서버 game_batch 수신 분배 확인
    ws.onmessage?.({
      data: JSON.stringify({
        type: 'game_batch',
        senderId: 'p2',
        events: [
          { event: 'player_move', payload: { x: 10, y: 20 } },
          { event: 'entity_hit', payload: { damage: 55 } },
        ],
      }),
    });

    assert.equal(receivedEvents.length, 2);
    assert.equal(receivedEvents[0].ev, 'player_move');
    assert.equal(receivedEvents[1].ev, 'entity_hit');

    transport.disconnect();
  } finally {
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = originalWs;
    activeRoomTransportStore.clear(false);
  }
});

test('CloudflareRoomTransport는 서버 거절(join_rejected) 수신 시 재연결하지 않고 거절 콜백을 호출한다', () => {
  const originalWs = globalThis.WebSocket;
  MockWebSocket.instances = [];
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;

  try {
    const transport = new CloudflareRoomTransport();
    let rejectedReason = '';
    transport.onJoinRejected((reason) => {
      rejectedReason = reason;
    });

    transport.connect('FULL01', 'p5', { name: '다섯째', color: 'red', appVersion: 'v1' });
    const ws = MockWebSocket.instances[0];
    ws.onopen?.();
    ws.onmessage?.({
      data: JSON.stringify({
        type: 'join_rejected',
        reason: 'ROOM_FULL',
        message: '방 정원이 가득 찼습니다 (4/4).',
      }),
    });
    ws.close(4000, 'ROOM_FULL');

    assert.equal(rejectedReason, 'ROOM_FULL');
    assert.equal(transport.getStatus(), 'disconnected');
  } finally {
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = originalWs;
  }
});
