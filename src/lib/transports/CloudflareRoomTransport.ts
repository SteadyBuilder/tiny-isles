import { HOST_SYNC_CONFIG } from '../../data/worldRules';
import {
  BatchedGameEvent,
  ClientToServerMessage,
  ProtocolRoomMeta,
  RoomStatePayload,
  ServerToClientMessage,
} from '../../shared/multiplayerProtocol';
import {
  ConnectionResumeHandler,
  GameStartedHandler,
  INetworkTransport,
  NetworkEventHandler,
  NetworkPresenceMeta,
  NetworkPresenceSnapshot,
  NetworkTransportStatus,
  PlayerLeaveHandler,
  PresenceSyncHandler,
  RoomRejectHandler,
  SnapshotSyncHandler,
} from '../contracts/INetworkTransport';
import { buildRoomWsUrl } from '../multiplayerEndpoint';

const PING_INTERVAL_MS = 15_000;

/**
 * Cloudflare Durable Objects(GameRoomDO) 단일 WebSocket 전송 계층 구현체
 * - 대기실 -> 인게임 -> 종료까지 1개의 WebSocket 연결을 유지
 * - 방장 선출/이양·정원 제한·버전 검증은 서버(GameRoomDO)가 단일 진실 원천으로 결정
 */
export class CloudflareRoomTransport implements INetworkTransport {
  private ws: WebSocket | null = null;
  private status: NetworkTransportStatus = 'disconnected';
  private roomId = '';
  private playerId = '';
  private meta: Omit<NetworkPresenceMeta, 'joinedAt'> | null = null;
  private isHost = false;
  private hostId = '';
  private hostEpoch = 0;
  private onlineCount = 1;
  private latestSnapshot: NetworkPresenceSnapshot | null = null;
  private manualDisconnect = false;
  private hasConnectedOnce = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  private eventHandlers = new Map<string, Set<NetworkEventHandler>>();
  private presenceHandlers = new Set<PresenceSyncHandler>();
  private leaveHandlers = new Set<PlayerLeaveHandler>();
  private resumeHandlers = new Set<ConnectionResumeHandler>();
  private rejectHandlers = new Set<RoomRejectHandler>();
  private gameStartedHandlers = new Set<GameStartedHandler>();
  private snapshotSyncHandlers = new Set<SnapshotSyncHandler>();

  public connect(
    roomId: string,
    playerId: string,
    meta: Omit<NetworkPresenceMeta, 'joinedAt'>
  ): void {
    this.disconnect();
    this.manualDisconnect = false;
    this.hasConnectedOnce = false;
    this.reconnectAttempts = 0;
    this.roomId = roomId.trim().toUpperCase();
    this.playerId = playerId;
    this.meta = { ...meta };
    this.openSocket();
  }

  public disconnect(): void {
    this.manualDisconnect = true;
    this.clearTimers();
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.close(1000, 'CLIENT_DISCONNECT');
      } catch {
        // 무시
      }
      this.ws = null;
    }
    this.status = 'disconnected';
    this.latestSnapshot = null;
  }

  public emit<T extends object>(event: string, payload: T): void {
    this.sendMessage({
      type: 'game_event',
      event,
      payload: payload as Record<string, unknown>,
    });
  }

  public emitBatch(events: BatchedGameEvent[]): void {
    if (events.length === 0) return;
    this.sendMessage({ type: 'game_batch', events });
  }

  public startGame(roomConfig: Record<string, unknown>, meta?: Partial<ProtocolRoomMeta>): void {
    this.sendMessage({ type: 'start_game', roomConfig, meta });
  }

  public updateRoomMeta(meta: Partial<ProtocolRoomMeta>, ended?: boolean): void {
    this.sendMessage({ type: 'room_meta_update', meta, ended });
  }

  public uploadSnapshot(snapshot: Record<string, unknown>): void {
    this.sendMessage({ type: 'snapshot_upload', snapshot });
  }

  public requestSnapshot(): void {
    this.sendMessage({ type: 'request_snapshot' });
  }

  public yieldHostAuthority(isBackground: boolean): void {
    this.updatePresenceBackground(isBackground);
  }

  public updatePresenceBackground(isBackground: boolean): void {
    this.sendMessage({ type: 'background_state', isBackground });
  }

  public on<T = unknown>(event: string, handler: NetworkEventHandler<T>): () => void {
    let set = this.eventHandlers.get(event);
    if (!set) {
      set = new Set();
      this.eventHandlers.set(event, set);
    }
    set.add(handler as NetworkEventHandler);
    return () => {
      this.eventHandlers.get(event)?.delete(handler as NetworkEventHandler);
    };
  }

  public onPresenceSync(handler: PresenceSyncHandler): () => void {
    this.presenceHandlers.add(handler);
    if (this.latestSnapshot) {
      handler(this.latestSnapshot);
    }
    return () => {
      this.presenceHandlers.delete(handler);
    };
  }

  public onPlayerLeave(handler: PlayerLeaveHandler): () => void {
    this.leaveHandlers.add(handler);
    return () => {
      this.leaveHandlers.delete(handler);
    };
  }

  public onConnectionResume(handler: ConnectionResumeHandler): () => void {
    this.resumeHandlers.add(handler);
    return () => {
      this.resumeHandlers.delete(handler);
    };
  }

  public onJoinRejected(handler: RoomRejectHandler): () => void {
    this.rejectHandlers.add(handler);
    return () => {
      this.rejectHandlers.delete(handler);
    };
  }

  public onGameStarted(handler: GameStartedHandler): () => void {
    this.gameStartedHandlers.add(handler);
    return () => {
      this.gameStartedHandlers.delete(handler);
    };
  }

  public onSnapshotSync(handler: SnapshotSyncHandler): () => void {
    this.snapshotSyncHandlers.add(handler);
    return () => {
      this.snapshotSyncHandlers.delete(handler);
    };
  }

  public getLatestSnapshot(): NetworkPresenceSnapshot | null {
    return this.latestSnapshot;
  }

  public getRoomId(): string {
    return this.roomId;
  }

  public getStatus(): NetworkTransportStatus {
    return this.status;
  }

  public getIsHost(): boolean {
    return this.isHost;
  }

  public getOnlineCount(): number {
    return this.onlineCount;
  }

  private openSocket(): void {
    if (this.manualDisconnect || !this.roomId || !this.meta) return;
    this.status = 'connecting';

    const ws = new WebSocket(buildRoomWsUrl(this.roomId));
    this.ws = ws;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      const isResume = this.hasConnectedOnce;
      this.hasConnectedOnce = true;
      this.reconnectAttempts = 0;
      this.status = 'connected';
      this.startPingTimer();

      if (this.meta) {
        this.sendMessage({
          type: 'join',
          playerId: this.playerId,
          name: this.meta.name,
          color: this.meta.color,
          appVersion: this.meta.appVersion,
          initialMeta: this.meta.initialMeta,
          requireExisting: isResume ? false : this.meta.requireExisting,
        });
      }

      if (isResume) {
        for (const h of this.resumeHandlers) h();
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      if (this.ws !== ws || typeof event.data !== 'string') return;
      let msg: ServerToClientMessage;
      try {
        msg = JSON.parse(event.data) as ServerToClientMessage;
      } catch {
        return;
      }
      this.handleServerMessage(msg);
    };

    ws.onclose = (ev: CloseEvent) => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.clearTimers();
      this.status = 'disconnected';

      // 서버 거절(4000) 또는 세션 교체(4001)는 재연결하지 않음
      if (this.manualDisconnect || ev.code === 4000 || ev.code === 4001) {
        return;
      }
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose에서 재연결 처리
    };
  }

  private handleServerMessage(msg: ServerToClientMessage): void {
    switch (msg.type) {
      case 'pong':
        return;

      case 'join_rejected': {
        this.manualDisconnect = true;
        for (const h of this.rejectHandlers) {
          h(msg.reason, msg.message, msg.hostAppVersion);
        }
        return;
      }

      case 'room_state': {
        const snapshot = this.applyRoomState(msg.state);
        for (const h of this.presenceHandlers) h(snapshot);
        return;
      }

      case 'game_started': {
        const snapshot = this.applyRoomState(msg.state);
        for (const h of this.presenceHandlers) h(snapshot);
        for (const h of this.gameStartedHandlers) h(msg.roomConfig, snapshot);
        return;
      }

      case 'game_event': {
        if (msg.senderId === this.playerId) return;
        this.dispatchEvent(msg.event, msg.payload);
        return;
      }

      case 'game_batch': {
        if (msg.senderId === this.playerId) return;
        for (const item of msg.events) {
          this.dispatchEvent(item.event, item.payload);
        }
        return;
      }

      case 'snapshot_sync': {
        for (const h of this.snapshotSyncHandlers) {
          h(msg.snapshot, msg.hostId, msg.hostEpoch);
        }
        return;
      }

      case 'player_left': {
        for (const h of this.leaveHandlers) h(msg.playerId);
        return;
      }
    }
  }

  private applyRoomState(state: RoomStatePayload): NetworkPresenceSnapshot {
    this.hostId = state.hostId;
    this.hostEpoch = state.hostEpoch;
    this.isHost = state.hostId === this.playerId;
    this.onlineCount = Math.max(1, state.members.length);

    const snapshot: NetworkPresenceSnapshot = {
      isHost: this.isHost,
      hostId: this.hostId,
      hostEpoch: this.hostEpoch,
      onlineCount: this.onlineCount,
      members: state.members.map((m) => ({
        playerId: m.playerId,
        name: m.name,
        color: m.color,
        isHost: m.isHost,
        joinedAt: m.joinedAt,
        isBackground: m.isBackground,
        appVersion: m.appVersion,
      })),
      roomStatus: state.status,
      roomMeta: state.meta,
    };
    this.latestSnapshot = snapshot;
    return snapshot;
  }

  private dispatchEvent(event: string, payload: Record<string, unknown>): void {
    const handlers = this.eventHandlers.get(event);
    if (!handlers) return;
    for (const h of handlers) {
      h(payload);
    }
  }

  private sendMessage(message: ClientToServerMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify(message));
    } catch {
      // 전송 실패 시 onclose 재연결 경로에 위임
    }
  }

  private startPingTimer(): void {
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
  }

  private scheduleReconnect(): void {
    if (this.manualDisconnect || this.reconnectTimer) return;
    const delay = Math.min(
      HOST_SYNC_CONFIG.reconnectMaxDelayMs,
      HOST_SYNC_CONFIG.reconnectBaseDelayMs * Math.pow(2, this.reconnectAttempts)
    );
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delay);
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}
