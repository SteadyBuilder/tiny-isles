import { PublicRoomListing } from '../data/dropInConfig';
import { DirectoryServerMessage } from '../shared/multiplayerProtocol';
import { buildDirectoryHttpUrl, buildDirectoryWsUrl } from './multiplayerEndpoint';

export type RoomDirectoryListener = (rooms: PublicRoomListing[]) => void;

const PING_INTERVAL_MS = 20_000;
const RECONNECT_DELAY_MS = 2_500;

/**
 * Cloudflare LobbyDirectoryDO 실시간 공개 방 목록 구독 클라이언트
 * - WebSocket Hibernation 푸시 방식(변경 시에만 수신, 폴링 부하 0)
 * - 초기 진입 시 REST 조회로 즉시 표시
 */
class RoomDirectoryClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<RoomDirectoryListener>();
  private currentRooms: PublicRoomListing[] = [];
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private restFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  public subscribeListings(listener: RoomDirectoryListener): () => void {
    this.listeners.add(listener);
    listener(this.currentRooms);
    this.ensureConnected();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.teardown();
      }
    };
  }

  public getCachedListings(): PublicRoomListing[] {
    return this.currentRooms;
  }

  public findRoomByCode(inviteCode: string): PublicRoomListing | undefined {
    const clean = inviteCode.trim().toUpperCase();
    return this.currentRooms.find(
      (r) => r.inviteCode.toUpperCase() === clean || r.roomId.toUpperCase() === clean
    );
  }

  private ensureConnected(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.openSocket();
  }

  private clearRestFallbackTimer(): void {
    if (this.restFallbackTimer) {
      clearTimeout(this.restFallbackTimer);
      this.restFallbackTimer = null;
    }
  }

  private async fetchInitialRest(): Promise<void> {
    try {
      const res = await fetch(buildDirectoryHttpUrl());
      if (!res.ok) return;
      const data = (await res.json()) as { rooms?: PublicRoomListing[] };
      if (Array.isArray(data.rooms)) {
        this.applyRooms(data.rooms);
      }
    } catch {
      // 오프라인 또는 로컬 서버 미실행 시 무시
    }
  }

  private openSocket(): void {
    if (this.listeners.size === 0 || typeof WebSocket === 'undefined') return;
    try {
      const ws = new WebSocket(buildDirectoryWsUrl());
      this.ws = ws;

      // WebSocket이 2.5초 내로 열리지 못한 환경(프록시/방화벽 등)에서만 REST 폴백 1회 수행
      this.clearRestFallbackTimer();
      this.restFallbackTimer = setTimeout(() => {
        this.restFallbackTimer = null;
        if (this.ws === ws && ws.readyState !== WebSocket.OPEN) {
          void this.fetchInitialRest();
        }
      }, RECONNECT_DELAY_MS);

      ws.onopen = () => {
        if (this.ws !== ws) return;
        this.clearRestFallbackTimer();
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
              this.ws.send('{"type":"ping"}');
            } catch {
              // 무시
            }
          }
        }, PING_INTERVAL_MS);
      };

      ws.onmessage = (event: MessageEvent) => {
        if (this.ws !== ws || typeof event.data !== 'string') return;
        try {
          const msg = JSON.parse(event.data) as DirectoryServerMessage;
          if (msg.type === 'directory_sync' && Array.isArray(msg.rooms)) {
            this.applyRooms(msg.rooms as PublicRoomListing[]);
          }
        } catch {
          // 무시
        }
      };

      ws.onclose = () => {
        if (this.ws !== ws) return;
        this.ws = null;
        this.clearRestFallbackTimer();
        if (this.pingTimer) {
          clearInterval(this.pingTimer);
          this.pingTimer = null;
        }
        if (this.listeners.size > 0 && !this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.openSocket();
          }, RECONNECT_DELAY_MS);
        }
      };

      ws.onerror = () => {
        // onclose에서 재연결
      };
    } catch {
      void this.fetchInitialRest();
    }
  }

  private applyRooms(rooms: PublicRoomListing[]): void {
    this.currentRooms = rooms;
    for (const listener of this.listeners) {
      listener(this.currentRooms);
    }
  }

  private teardown(): void {
    this.clearRestFallbackTimer();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.close(1000, 'IDLE');
      } catch {
        // 무시
      }
      this.ws = null;
    }
  }
}

export const roomDirectoryClient = new RoomDirectoryClient();
