import { DurableObject } from 'cloudflare:workers';
import {
  ClientToServerMessage,
  ServerToClientMessage,
} from '../../../src/shared/multiplayerProtocol';
import { RoomStateMachine } from './roomStateMachine';

export interface WorkerEnv {
  GAME_ROOMS: DurableObjectNamespace<GameRoomDO>;
  LOBBY_DIRECTORY: DurableObjectNamespace;
  ALLOWED_ORIGINS?: string;
}

interface SocketAttachment {
  playerId: string;
  roomId: string;
}

const DIRECTORY_PROGRESS_SYNC_MIN_MS = 12_000;

/**
 * 방 1개 = 전용 미니 서버 1개 (Cloudflare Durable Object + WebSocket Hibernation)
 * - 대기실(waiting) → 인게임(playing) → 종료(ended)까지 단일 WebSocket 연결 유지
 * - 서버가 정원(4인)·버전·방장 선출/이양·최신 스냅샷을 직접 관리
 */
export class GameRoomDO extends DurableObject<WorkerEnv> {
  private machine: RoomStateMachine | null = null;
  private socketToPlayer = new Map<WebSocket, string>();
  private playerToSocket = new Map<string, WebSocket>();
  private lastDirectoryPushAt = 0;

  constructor(ctx: DurableObjectState, env: WorkerEnv) {
    super(ctx, env);
    // ping/pong은 DO를 깨우지 않고 무료 자동 응답
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('{"type":"ping"}', '{"type":"pong"}')
    );
  }

  public async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    const url = new URL(request.url);
    const roomCode = (url.searchParams.get('roomId') || 'DEFAULT').trim().toUpperCase();
    this.ensureMachine(roomCode);

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ playerId: '', roomId: roomCode } satisfies SocketAttachment);

    return new Response(null, { status: 101, webSocket: client });
  }

  public async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== 'string') return;

    let msg: ClientToServerMessage;
    try {
      msg = JSON.parse(raw) as ClientToServerMessage;
    } catch {
      return;
    }

    const attachment = (ws.deserializeAttachment() as SocketAttachment | null) ?? {
      playerId: '',
      roomId: 'DEFAULT',
    };
    const machine = this.ensureMachine(attachment.roomId);

    switch (msg.type) {
      case 'ping': {
        this.sendTo(ws, { type: 'pong' });
        return;
      }

      case 'join': {
        const result = machine.join({
          playerId: msg.playerId,
          name: msg.name,
          color: msg.color,
          appVersion: msg.appVersion,
          initialMeta: msg.initialMeta,
          requireExisting: msg.requireExisting,
        });

        if (!result.ok) {
          this.sendTo(ws, {
            type: 'join_rejected',
            reason: result.reason,
            message: result.message,
            hostAppVersion: result.hostAppVersion,
          });
          ws.close(4000, result.reason);
          return;
        }

        // 동일 playerId의 이전 소켓이 남아 있다면 정리
        const prevWs = this.playerToSocket.get(msg.playerId);
        if (prevWs && prevWs !== ws) {
          this.socketToPlayer.delete(prevWs);
          try {
            prevWs.close(4001, 'REPLACED_SESSION');
          } catch {
            // 이미 닫힌 소켓 무시
          }
        }

        this.socketToPlayer.set(ws, msg.playerId);
        this.playerToSocket.set(msg.playerId, ws);
        ws.serializeAttachment({
          playerId: msg.playerId,
          roomId: attachment.roomId,
        } satisfies SocketAttachment);

        this.broadcast({ type: 'room_state', state: result.state });

        // 중도 합류 시 캐시된 최신 월드 스냅샷이 있으면 1회 즉시 전달
        if (result.isDropIn) {
          const cached = machine.getCachedSnapshot();
          if (cached) {
            this.sendTo(ws, {
              type: 'snapshot_sync',
              snapshot: cached,
              hostId: machine.getHostId(),
              hostEpoch: machine.getHostEpoch(),
            });
          }
        }

        await this.syncDirectory(true);
        return;
      }

      case 'start_game': {
        const playerId = this.resolvePlayerId(ws);
        if (!playerId) return;
        const started = machine.startGame(playerId, msg.meta);
        if (!started.ok) return;

        this.broadcast({
          type: 'game_started',
          roomConfig: msg.roomConfig,
          state: started.state,
        });
        await this.syncDirectory(true);
        return;
      }

      case 'room_meta_update': {
        const playerId = this.resolvePlayerId(ws);
        if (!playerId) return;
        if (!machine.updateMeta(playerId, msg.meta, msg.ended)) return;
        if (msg.ended) {
          this.broadcast({ type: 'room_state', state: machine.getStatePayload() });
          await this.syncDirectory(true);
        } else {
          await this.syncDirectory(false);
        }
        return;
      }

      case 'background_state': {
        const playerId = this.resolvePlayerId(ws);
        if (!playerId) return;
        const { changed, hostChanged } = machine.setBackground(playerId, Boolean(msg.isBackground));
        if (changed) {
          this.broadcast({ type: 'room_state', state: machine.getStatePayload() });
          if (hostChanged) {
            await this.syncDirectory(true);
          }
        }
        return;
      }

      case 'game_event': {
        const playerId = this.resolvePlayerId(ws);
        if (!playerId) return;
        const out: ServerToClientMessage = {
          type: 'game_event',
          senderId: playerId,
          event: msg.event,
          payload: msg.payload,
        };
        if (msg.targetPlayerId) {
          const targetWs = this.playerToSocket.get(msg.targetPlayerId);
          if (targetWs) this.sendTo(targetWs, out);
        } else {
          this.broadcast(out, ws);
        }
        return;
      }

      case 'game_batch': {
        const playerId = this.resolvePlayerId(ws);
        if (!playerId || !Array.isArray(msg.events) || msg.events.length === 0) return;
        this.broadcast(
          {
            type: 'game_batch',
            senderId: playerId,
            events: msg.events,
          },
          ws
        );
        return;
      }

      case 'snapshot_upload': {
        const playerId = this.resolvePlayerId(ws);
        if (!playerId) return;
        machine.updateSnapshot(playerId, msg.snapshot);
        return;
      }

      case 'request_snapshot': {
        const cached = machine.getCachedSnapshot();
        if (cached) {
          this.sendTo(ws, {
            type: 'snapshot_sync',
            snapshot: cached,
            hostId: machine.getHostId(),
            hostEpoch: machine.getHostEpoch(),
          });
        }
        return;
      }
    }
  }

  public async webSocketClose(ws: WebSocket): Promise<void> {
    await this.handleDisconnect(ws);
  }

  public async webSocketError(ws: WebSocket): Promise<void> {
    await this.handleDisconnect(ws);
  }

  private async handleDisconnect(ws: WebSocket): Promise<void> {
    const playerId = this.resolvePlayerId(ws);
    this.socketToPlayer.delete(ws);

    if (!playerId) return;
    if (this.playerToSocket.get(playerId) === ws) {
      this.playerToSocket.delete(playerId);
    }

    if (!this.machine) return;
    const { removed, isEmpty } = this.machine.leave(playerId);
    if (!removed) return;

    if (!isEmpty) {
      this.broadcast({ type: 'player_left', playerId });
      this.broadcast({ type: 'room_state', state: this.machine.getStatePayload() });
    }
    await this.syncDirectory(true);
  }

  private ensureMachine(roomCode: string): RoomStateMachine {
    if (!this.machine) {
      this.machine = new RoomStateMachine(roomCode, roomCode);
    }
    return this.machine;
  }

  private resolvePlayerId(ws: WebSocket): string {
    const mapped = this.socketToPlayer.get(ws);
    if (mapped) return mapped;
    const attachment = ws.deserializeAttachment() as SocketAttachment | null;
    if (attachment?.playerId) {
      this.socketToPlayer.set(ws, attachment.playerId);
      this.playerToSocket.set(attachment.playerId, ws);
      return attachment.playerId;
    }
    return '';
  }

  private sendTo(ws: WebSocket, message: ServerToClientMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // 끊긴 소켓 무시
    }
  }

  private broadcast(message: ServerToClientMessage, exclude?: WebSocket): void {
    const serialized = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      if (exclude && ws === exclude) continue;
      try {
        ws.send(serialized);
      } catch {
        // 끊긴 소켓 무시
      }
    }
  }

  private async syncDirectory(force: boolean): Promise<void> {
    if (!this.machine) return;
    const now = Date.now();
    if (!force && now - this.lastDirectoryPushAt < DIRECTORY_PROGRESS_SYNC_MIN_MS) {
      return;
    }
    this.lastDirectoryPushAt = now;

    try {
      const dirId = this.env.LOBBY_DIRECTORY.idFromName('global_directory_v1');
      const dirStub = this.env.LOBBY_DIRECTORY.get(dirId);
      const listing = this.machine.toPublicListing(now);
      if (listing) {
        await dirStub.fetch('https://directory.internal/upsert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(listing),
        });
      } else {
        await dirStub.fetch('https://directory.internal/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId: this.machine.getStatePayload().roomId }),
        });
      }
    } catch {
      // 디렉토리 일시 실패는 게임 방 진행을 막지 않음
    }
  }
}
