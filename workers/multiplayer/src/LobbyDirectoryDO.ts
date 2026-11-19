import { DurableObject } from 'cloudflare:workers';
import {
  DirectoryServerMessage,
  ProtocolPublicRoomListing,
} from '../../../src/shared/multiplayerProtocol';
import type { WorkerEnv } from './GameRoomDO';

const STALE_ROOM_TTL_MS = 90_000;

/**
 * 실시간 공개 방 목록 디렉토리 (Singleton Durable Object + WebSocket Hibernation)
 * - 방 상태 변경 시에만 구독자(로비 화면)에게 푸시하므로 폴링 부하 0
 */
export class LobbyDirectoryDO extends DurableObject<WorkerEnv> {
  private rooms = new Map<string, ProtocolPublicRoomListing>();

  constructor(ctx: DurableObjectState, env: WorkerEnv) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('{"type":"ping"}', '{"type":"pong"}')
    );
  }

  public async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      this.pruneStaleRooms();
      this.sendListingTo(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    if (request.method === 'GET' && url.pathname === '/rooms') {
      this.pruneStaleRooms();
      return Response.json({ rooms: this.getSortedRooms() });
    }

    if (request.method === 'POST' && url.pathname === '/upsert') {
      const listing = (await request.json()) as ProtocolPublicRoomListing;
      if (listing?.roomId) {
        this.rooms.set(listing.roomId.toUpperCase(), {
          ...listing,
          updatedAt: Date.now(),
        });
        this.pruneStaleRooms();
        this.broadcastDirectory();
      }
      return new Response('ok');
    }

    if (request.method === 'POST' && url.pathname === '/remove') {
      const body = (await request.json()) as { roomId?: string };
      if (body?.roomId) {
        this.rooms.delete(body.roomId.toUpperCase());
        this.pruneStaleRooms();
        this.broadcastDirectory();
      }
      return new Response('ok');
    }

    return new Response('Not Found', { status: 404 });
  }

  public async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== 'string') return;
    if (raw === '{"type":"ping"}') {
      try {
        ws.send('{"type":"pong"}');
      } catch {
        // 무시
      }
    }
  }

  public async webSocketClose(): Promise<void> {
    // Hibernation API가 자동 정리
  }

  private pruneStaleRooms(): void {
    const now = Date.now();
    for (const [id, listing] of this.rooms.entries()) {
      if (now - listing.updatedAt > STALE_ROOM_TTL_MS) {
        this.rooms.delete(id);
      }
    }
  }

  private getSortedRooms(): ProtocolPublicRoomListing[] {
    return Array.from(this.rooms.values()).sort((a, b) => {
      if (a.lockReason === 'open' && b.lockReason !== 'open') return -1;
      if (a.lockReason !== 'open' && b.lockReason === 'open') return 1;
      return b.updatedAt - a.updatedAt;
    });
  }

  private sendListingTo(ws: WebSocket): void {
    const payload: DirectoryServerMessage = {
      type: 'directory_sync',
      rooms: this.getSortedRooms(),
    };
    try {
      ws.send(JSON.stringify(payload));
    } catch {
      // 무시
    }
  }

  private broadcastDirectory(): void {
    const serialized = JSON.stringify({
      type: 'directory_sync',
      rooms: this.getSortedRooms(),
    } satisfies DirectoryServerMessage);

    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(serialized);
      } catch {
        // 끊긴 소켓 무시
      }
    }
  }
}
