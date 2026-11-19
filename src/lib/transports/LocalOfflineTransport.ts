import {
  INetworkTransport,
  NetworkEventHandler,
  NetworkPresenceMeta,
  NetworkTransportStatus,
  PlayerLeaveHandler,
  PresenceSyncHandler,
} from '../contracts/INetworkTransport';

/**
 * 솔플(오프라인) 전용 무비용 네트워크 트랜스포트
 * - 스팀 오프라인 모드 및 웹 솔로 플레이에서 Supabase 연결 없이 즉시 동작합니다.
 */
export class LocalOfflineTransport implements INetworkTransport {
  private status: NetworkTransportStatus = 'disconnected';
  private presenceHandlers = new Set<PresenceSyncHandler>();

  public connect(
    _roomId: string,
    playerId: string,
    meta: Omit<NetworkPresenceMeta, 'joinedAt'>
  ): void {
    this.status = 'connected';
    const snapshot = {
      isHost: true,
      hostId: playerId,
      hostEpoch: 0,
      onlineCount: 1,
      members: [
        {
          playerId,
          name: meta.name,
          color: meta.color,
          isHost: true,
          joinedAt: Date.now(),
          isBackground: false,
          claimedEpoch: 0,
        },
      ],
    };
    this.presenceHandlers.forEach((handler) => handler(snapshot));
  }

  public disconnect(): void {
    this.status = 'disconnected';
    this.presenceHandlers.clear();
  }

  public emit<T extends object>(_event: string, _payload: T): void {
    // 솔플 모드에서는 원격 브로드캐스트를 수행하지 않습니다.
  }

  public on<T = unknown>(_event: string, _handler: NetworkEventHandler<T>): () => void {
    return () => {};
  }

  public onPresenceSync(handler: PresenceSyncHandler): () => void {
    this.presenceHandlers.add(handler);
    return () => {
      this.presenceHandlers.delete(handler);
    };
  }

  public onPlayerLeave(_handler: PlayerLeaveHandler): () => void {
    return () => {};
  }

  public getStatus(): NetworkTransportStatus {
    return this.status;
  }

  public getIsHost(): boolean {
    return true;
  }

  public getOnlineCount(): number {
    return 1;
  }
}
