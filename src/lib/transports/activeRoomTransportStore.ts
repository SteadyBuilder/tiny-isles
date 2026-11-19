import { INetworkTransport } from '../contracts/INetworkTransport';

/**
 * 대기실(React) -> 인게임(Phaser) 전환 시 단일 WebSocket 연결을 끊지 않고
 * 그대로 인계(Handoff)하기 위한 활성 룸 전송기 저장소
 */
class ActiveRoomTransportStore {
  private roomId = '';
  private transport: INetworkTransport | null = null;

  public register(roomId: string, transport: INetworkTransport): void {
    const normalized = roomId.trim().toUpperCase();
    if (this.transport && this.transport !== transport) {
      this.transport.disconnect();
    }
    this.roomId = normalized;
    this.transport = transport;
  }

  public peek(roomId: string): INetworkTransport | null {
    if (!this.transport) return null;
    if (this.roomId !== roomId.trim().toUpperCase()) return null;
    return this.transport;
  }

  public take(roomId: string): INetworkTransport | null {
    const matched = this.peek(roomId);
    if (!matched) return null;
    this.roomId = '';
    this.transport = null;
    return matched;
  }

  public clear(disconnect = true): void {
    if (disconnect && this.transport) {
      this.transport.disconnect();
    }
    this.roomId = '';
    this.transport = null;
  }
}

export const activeRoomTransportStore = new ActiveRoomTransportStore();
