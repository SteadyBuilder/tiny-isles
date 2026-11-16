import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  computeMonotonicJoinedAt,
  electHostFromPresence,
  PresenceEntryMeta,
} from '../../game/phaser/controllers/HostAuthorityHelper';
import { RoomMember } from '../../types/room';
import { serverSync } from '../serverSync';
import { supabase } from '../supabase';
import {
  INetworkTransport,
  NetworkEventHandler,
  NetworkPresenceMeta,
  NetworkTransportStatus,
  PlayerLeaveHandler,
  PresenceSyncHandler,
} from '../contracts/INetworkTransport';

interface BroadcastEnvelope {
  eventId?: string;
  senderId?: string;
}

interface PresenceRawEntry extends PresenceEntryMeta {
  name?: string;
  color?: 'blue' | 'red';
}

/**
 * Supabase Realtime 채널 기반 인스턴스 룸(1~4인 코옵) 전송 어댑터
 */
export class SupabaseRoomTransport implements INetworkTransport {
  private channel: RealtimeChannel | null = null;
  private status: NetworkTransportStatus = 'disconnected';
  private localPlayerId = '';
  private isHost = true;
  private onlineCount = 1;
  private connectionEpoch = 0;

  private eventHandlers = new Map<string, Set<NetworkEventHandler>>();
  private presenceHandlers = new Set<PresenceSyncHandler>();
  private leaveHandlers = new Set<PlayerLeaveHandler>();

  public connect(
    roomId: string,
    playerId: string,
    meta: Omit<NetworkPresenceMeta, 'joinedAt'>
  ): void {
    this.cleanupChannel();
    const epoch = ++this.connectionEpoch;
    this.localPlayerId = playerId;
    this.status = 'connecting';

    const channelName = `tiny_isles_room_${roomId}`;
    void this.openChannel(channelName, playerId, meta, epoch);
  }

  private async openChannel(
    channelName: string,
    playerId: string,
    meta: Omit<NetworkPresenceMeta, 'joinedAt'>,
    epoch: number
  ): Promise<void> {
    const targetTopic = `realtime:${channelName}`;
    const staleChannels = supabase
      .getChannels()
      .filter((ch) => ch.topic === targetTopic);
    if (staleChannels.length > 0) {
      await Promise.all(staleChannels.map((ch) => supabase.removeChannel(ch)));
    }
    if (epoch !== this.connectionEpoch) return;

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
        presence: { key: playerId },
      },
    });
    this.channel = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        if (epoch !== this.connectionEpoch) return;
        const rawState = channel.presenceState() as Record<string, PresenceRawEntry[]>;
        const { isHost, hostId, onlineCount } = electHostFromPresence(rawState, playerId);
        this.isHost = isHost;
        this.onlineCount = onlineCount;

        const members: RoomMember[] = Object.entries(rawState).map(([id, entries]) => {
          const first = Array.isArray(entries) && entries.length > 0 ? entries[0] : undefined;
          return {
            playerId: id,
            name: first?.name || '수호자',
            color: first?.color === 'red' ? 'red' : 'blue',
            isHost: id === hostId,
            joinedAt: typeof first?.joinedAt === 'number' ? first.joinedAt : Number.MAX_SAFE_INTEGER,
          };
        });
        members.sort((a, b) => a.joinedAt - b.joinedAt || a.playerId.localeCompare(b.playerId));

        this.presenceHandlers.forEach((h) =>
          h({ isHost, hostId, onlineCount, members })
        );
      })
      .on('presence', { event: 'leave' }, ({ key }: { key: string }) => {
        if (epoch !== this.connectionEpoch) return;
        this.leaveHandlers.forEach((h) => h(key));
      })
      .on('broadcast', { event: '*' }, ({ event, payload }: { event: string; payload: unknown }) => {
        if (epoch !== this.connectionEpoch) return;
        const env = (payload ?? {}) as BroadcastEnvelope;
        if (!serverSync.isValidIncomingEvent(env.eventId, env.senderId, this.localPlayerId)) {
          return;
        }
        const handlers = this.eventHandlers.get(event);
        if (!handlers) return;
        handlers.forEach((handler) => handler(payload));
      })
      .subscribe(async (subStatus: string) => {
        if (epoch !== this.connectionEpoch) return;
        if (subStatus === 'SUBSCRIBED') {
          this.status = 'connected';
          const currentPresence = channel.presenceState() as Record<string, PresenceEntryMeta[]>;
          const joinedAt = computeMonotonicJoinedAt(currentPresence, Date.now());
          await channel.track({
            name: meta.name,
            color: meta.color,
            joinedAt,
          });
        }
      });
  }

  private cleanupChannel(): void {
    this.connectionEpoch += 1;
    if (this.channel) {
      const ch = this.channel;
      this.channel = null;
      void supabase.removeChannel(ch);
    }
    this.status = 'disconnected';
  }

  public disconnect(): void {
    this.cleanupChannel();
    this.eventHandlers.clear();
    this.presenceHandlers.clear();
    this.leaveHandlers.clear();
  }

  public emit<T extends object>(event: string, payload: T): void {
    if (!this.channel || this.status !== 'connected') return;
    serverSync.broadcast(this.channel, event, payload, this.localPlayerId);
  }

  public on<T = unknown>(event: string, handler: NetworkEventHandler<T>): () => void {
    let set = this.eventHandlers.get(event);
    if (!set) {
      set = new Set();
      this.eventHandlers.set(event, set);
    }
    const wrapped = handler as NetworkEventHandler;
    set.add(wrapped);
    return () => {
      set?.delete(wrapped);
    };
  }

  public onPresenceSync(handler: PresenceSyncHandler): () => void {
    this.presenceHandlers.add(handler);
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

  public getStatus(): NetworkTransportStatus {
    return this.status;
  }

  public getIsHost(): boolean {
    return this.isHost;
  }

  public getOnlineCount(): number {
    return this.onlineCount;
  }
}
