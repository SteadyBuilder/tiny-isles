import { PlayerColor } from '../../types/game';
import { RoomMember } from '../../types/room';

export interface NetworkPresenceMeta {
  name: string;
  color: PlayerColor;
  joinedAt: number;
  isBackground?: boolean;
  claimedEpoch?: number;
}

export interface NetworkPresenceSnapshot {
  isHost: boolean;
  hostId: string;
  hostEpoch: number;
  onlineCount: number;
  members: RoomMember[];
}

export type NetworkTransportStatus = 'disconnected' | 'connecting' | 'connected';

export type NetworkEventHandler<T = unknown> = (payload: T) => void;
export type PresenceSyncHandler = (snapshot: NetworkPresenceSnapshot) => void;
export type PlayerLeaveHandler = (playerId: string) => void;
export type ConnectionResumeHandler = () => void;

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
  onConnectionResume?(handler: ConnectionResumeHandler): () => void;
  claimHostAuthority?(nextEpoch: number): void;
  yieldHostAuthority?(isBackground: boolean): void;
  updatePresenceBackground?(isBackground: boolean): void;
  getStatus(): NetworkTransportStatus;
  getIsHost(): boolean;
  getOnlineCount(): number;
}
