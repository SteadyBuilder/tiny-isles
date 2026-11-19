import {
  BatchedGameEvent,
  ProtocolRoomMeta,
  RoomRejectReason,
  ServerRoomStatus,
} from '../../shared/multiplayerProtocol';
import { PlayerColor } from '../../types/game';
import { RoomMember } from '../../types/room';

export interface NetworkPresenceMeta {
  name: string;
  color: PlayerColor;
  joinedAt: number;
  isBackground?: boolean;
  claimedEpoch?: number;
  preferredHostId?: string;
  appVersion?: string;
  initialMeta?: Partial<ProtocolRoomMeta>;
  requireExisting?: boolean;
}

export interface NetworkPresenceSnapshot {
  isHost: boolean;
  hostId: string;
  hostEpoch: number;
  onlineCount: number;
  members: RoomMember[];
  roomStatus?: ServerRoomStatus;
  roomMeta?: ProtocolRoomMeta;
}

export type NetworkTransportStatus = 'disconnected' | 'connecting' | 'connected';

export type NetworkEventHandler<T = unknown> = (payload: T) => void;
export type PresenceSyncHandler = (snapshot: NetworkPresenceSnapshot) => void;
export type PlayerLeaveHandler = (playerId: string) => void;
export type ConnectionResumeHandler = () => void;
export type RoomRejectHandler = (
  reason: RoomRejectReason,
  message: string,
  hostAppVersion?: string
) => void;
export type GameStartedHandler = (
  roomConfig: Record<string, unknown>,
  snapshot: NetworkPresenceSnapshot
) => void;
export type SnapshotSyncHandler = (
  snapshot: Record<string, unknown>,
  hostId: string,
  hostEpoch: number
) => void;

/**
 * 멀티플레이 룸 전송 계층 추상 인터페이스 (Contract-First)
 * - 솔로/오프라인: LocalOfflineTransport
 * - 웹 협동: CloudflareRoomTransport (Cloudflare Durable Objects 단일 WebSocket)
 * - 스팀 출시 단계: SteamP2PTransport로 구현체만 교체
 */
export interface INetworkTransport {
  connect(roomId: string, playerId: string, meta: Omit<NetworkPresenceMeta, 'joinedAt'>): void;
  disconnect(): void;
  emit<T extends object>(event: string, payload: T): void;
  emitBatch?(events: BatchedGameEvent[]): void;
  on<T = unknown>(event: string, handler: NetworkEventHandler<T>): () => void;
  onPresenceSync(handler: PresenceSyncHandler): () => void;
  onPlayerLeave(handler: PlayerLeaveHandler): () => void;
  onConnectionResume?(handler: ConnectionResumeHandler): () => void;
  onJoinRejected?(handler: RoomRejectHandler): () => void;
  onGameStarted?(handler: GameStartedHandler): () => void;
  onSnapshotSync?(handler: SnapshotSyncHandler): () => void;
  startGame?(roomConfig: Record<string, unknown>, meta?: Partial<ProtocolRoomMeta>): void;
  updateRoomMeta?(meta: Partial<ProtocolRoomMeta>, ended?: boolean): void;
  uploadSnapshot?(snapshot: Record<string, unknown>): void;
  requestSnapshot?(): void;
  claimHostAuthority?(nextEpoch: number): void;
  yieldHostAuthority?(isBackground: boolean): void;
  updatePresenceBackground?(isBackground: boolean): void;
  getLatestSnapshot?(): NetworkPresenceSnapshot | null;
  getRoomId?(): string;
  getStatus(): NetworkTransportStatus;
  getIsHost(): boolean;
  getOnlineCount(): number;
}
