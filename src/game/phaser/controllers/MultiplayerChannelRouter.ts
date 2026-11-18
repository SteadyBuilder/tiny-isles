import { ConstructedBuilding } from '../../../types/game';
import { RoomMode } from '../../../types/room';
import { INetworkTransport } from '../../../lib/contracts/INetworkTransport';
import { serverSync } from '../../../lib/serverSync';
import { LocalOfflineTransport } from '../../../lib/transports/LocalOfflineTransport';
import { SupabaseRoomTransport } from '../../../lib/transports/SupabaseRoomTransport';
import { GameEvents } from '../../events/gameEvents';
import {
  IMultiplayerChannelCallbacks,
  SHARED_CHANNEL_EVENTS,
  dispatchSharedChannelEvent,
} from './ChannelEventDispatcher';

export type { IMultiplayerChannelCallbacks };

interface LocalBusEnvelope {
  type?: string;
  senderId?: string;
  eventId?: string;
  payload?: unknown;
}

/**
 * INetworkTransport(LocalOffline / SupabaseRoom / 추후 SteamP2P) 기반 멀티플레이 채널 라우터
 */
export class MultiplayerChannelRouter {
  private callbacks: IMultiplayerChannelCallbacks;
  private transport: INetworkTransport | null = null;
  private localBus: BroadcastChannel | null = null;
  private hasLocalBusPeer = false;
  private unsubscribers: Array<() => void> = [];
  private isHost = true;
  private presenceResolved = false;
  private knownMemberIds = new Set<string>();
  private lastOnlineCount = -1;
  private lastMembersSignature = '';

  constructor(callbacks: IMultiplayerChannelCallbacks) {
    this.callbacks = callbacks;
  }

  public getIsHost(): boolean {
    return this.isHost;
  }

  public connect(customTransport?: INetworkTransport): void {
    serverSync.clearEventCaches();
    const playerId = this.callbacks.getPlayerId();
    const roomId = this.callbacks.getRoomId?.() || 'default_room';
    const roomMode: RoomMode = this.callbacks.getRoomMode?.() || 'solo';

    // 협동 모드에서는 Presence가 첫 동기화될 때까지 임의 스폰을 막기 위해 false로 시작
    this.isHost = roomMode === 'solo';
    this.presenceResolved = roomMode === 'solo';
    this.knownMemberIds.clear();
    this.lastOnlineCount = -1;
    this.lastMembersSignature = '';

    this.transport =
      customTransport ??
      (roomMode === 'solo' ? new LocalOfflineTransport() : new SupabaseRoomTransport());

    if (roomMode === 'coop') {
      this.setupLocalBus(playerId, roomId);
    }

    this.bindTransportEvents();
    this.transport.connect(roomId, playerId, {
      name: this.callbacks.getPlayerName(),
      color: this.callbacks.getPlayerColor(),
    });
  }

  public emit<T extends object>(
    localType: string,
    remoteEvent: string,
    localPayload: T,
    remotePayload: object = localPayload
  ): void {
    const playerId = this.callbacks.getPlayerId();
    const eventId = serverSync.createEventId(remoteEvent, playerId);
    if (this.localBus && this.hasLocalBusPeer) {
      this.localBus.postMessage({
        type: localType,
        senderId: playerId,
        eventId,
        payload: localPayload,
      });
    }
    this.transport?.emit(remoteEvent, { ...remotePayload, eventId });
  }

  public destroy(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    this.knownMemberIds.clear();
    serverSync.clearEventCaches();

    if (this.localBus) {
      this.localBus.close();
      this.localBus = null;
    }
    this.hasLocalBusPeer = false;
    if (this.transport) {
      this.transport.disconnect();
      this.transport = null;
    }
  }

  private bindTransportEvents(): void {
    const t = this.transport;
    if (!t) return;

    this.unsubscribers.push(
      t.onPresenceSync((snapshot) => {
        const hostResolutionChanged = !this.presenceResolved || this.isHost !== snapshot.isHost;
        const becameHost = hostResolutionChanged && snapshot.isHost;
        this.presenceResolved = true;
        this.isHost = snapshot.isHost;

        const localPlayerId = this.callbacks.getPlayerId();
        let hasNewPeer = false;
        const nextKnown = new Set<string>();
        const signatureParts: string[] = [];
        for (const member of snapshot.members) {
          nextKnown.add(member.playerId);
          if (member.playerId !== localPlayerId && !this.knownMemberIds.has(member.playerId)) {
            hasNewPeer = true;
          }
          signatureParts.push(
            `${member.playerId}:${member.name}:${member.color}:${member.isHost ? 1 : 0}`
          );
        }
        this.knownMemberIds = nextKnown;

        if (hostResolutionChanged) {
          this.callbacks.onHostStatusChanged?.(snapshot.isHost);
        }
        const shouldSyncPeers = hasNewPeer || (becameHost && snapshot.onlineCount > 1);
        this.callbacks.onOnlineCountChanged(snapshot.onlineCount, shouldSyncPeers);

        if (snapshot.onlineCount !== this.lastOnlineCount) {
          this.lastOnlineCount = snapshot.onlineCount;
          GameEvents.emit('online-count-changed', snapshot.onlineCount);
        }
        signatureParts.sort();
        const membersSignature = signatureParts.join('|');
        if (membersSignature !== this.lastMembersSignature) {
          this.lastMembersSignature = membersSignature;
          GameEvents.emit('room-members-updated', snapshot.members);
        }
      }),
      t.onPlayerLeave((playerId) => {
        this.knownMemberIds.delete(playerId);
        this.callbacks.onRemotePlayerLeave(playerId);
      }),
      t.on<{ building: ConstructedBuilding }>('building_constructed', (p) => {
        if (p.building) this.callbacks.onRemoteBuildingConstructed(p.building);
      }),
      ...SHARED_CHANNEL_EVENTS.map((ev) =>
        t.on(ev, (p) => dispatchSharedChannelEvent(ev, p, this.callbacks))
      )
    );
  }

  private setupLocalBus(playerId: string, roomId: string): void {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    this.localBus = new BroadcastChannel(`tiny_isles_room_${roomId}`);
    this.localBus.onmessage = (event: MessageEvent<LocalBusEnvelope>) => {
      const data = event.data;
      if (!data || !data.type) return;
      if (data.senderId && data.senderId !== playerId) {
        if (data.type === '__bus_hello') {
          this.hasLocalBusPeer = true;
          this.localBus?.postMessage({ type: '__bus_ack', senderId: playerId });
          return;
        }
        if (data.type === '__bus_ack') {
          this.hasLocalBusPeer = true;
          return;
        }
      }
      if (!serverSync.isValidIncomingEvent(data.eventId, data.senderId, playerId)) return;

      if (data.type === 'hit') {
        dispatchSharedChannelEvent('entity_hit', data.payload, this.callbacks);
      } else if (data.type === 'building_constructed') {
        this.callbacks.onRemoteBuildingConstructed(data.payload as ConstructedBuilding);
      } else {
        dispatchSharedChannelEvent(data.type, data.payload, this.callbacks);
      }
    };
    this.localBus.postMessage({ type: '__bus_hello', senderId: playerId });
  }
}
