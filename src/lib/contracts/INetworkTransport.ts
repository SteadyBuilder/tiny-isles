import { PlayerColor } from '../../types/game';
import { RoomMember } from '../../types/room';

export interface NetworkPresenceMeta {
  name: string;
  color: PlayerColor;
  joinedAt: number;
}

export interface NetworkPresenceSnapshot {
  isHost: boolean;
  hostId: string;
  onlineCount: number;
  members: RoomMember[];
}

export type NetworkTransportStatus = 'disconnected' | 'connecting' | 'connected';

export type NetworkEventHandler<T = unknown> = (payload: T) => void;
export type PresenceSyncHandler = (snapshot: NetworkPresenceSnapshot) => void;
export type PlayerLeaveHandler = (playerId: string) => void;

/**
 * 멀티플레이 룸 전송 계층 추상 인터페이스 (Contract-First)
 * - 웹/프로토타입: LocalOfflineTransport, SupabaseRoomTransport
 * - 스팀 출시 단계: SteamP2PTransport로 구현체만 교체
 */
export interface INetworkTransport {
  connect(roomId: string, playerId: string, meta: Omit<NetworkPresenceMeta, 'joinedAt'>): void;
  disconnect(): void;
  emit<T extends object>(event: string, payload: T): void;
  on<T = unknown>(event: string, handler: NetworkEventHandler<T>): () => void;
  onPresenceSync(handler: PresenceSyncHandler): () => void;
  onPlayerLeave(handler: PlayerLeaveHandler): () => void;
  getStatus(): NetworkTransportStatus;
  getIsHost(): boolean;
  getOnlineCount(): number;
}
