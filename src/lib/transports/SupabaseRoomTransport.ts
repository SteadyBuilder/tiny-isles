import type { RealtimeChannel } from '@supabase/supabase-js';
import { HOST_SYNC_CONFIG } from '../../data/worldRules';
import {
  computeMaxClaimedEpoch,
  computeMonotonicJoinedAt,
  electHostFromPresence,
  extractLatestPresenceMeta,
  PresenceEntryMeta,
} from '../../game/phaser/controllers/HostAuthorityHelper';
import { RoomMember } from '../../types/room';
import { serverSync } from '../serverSync';
import { supabase } from '../supabase';
import {
  ConnectionResumeHandler,
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
 * - 모바일 슬립/네트워크 절체 시 지수 백오프 자동 재연결 및 Presence 기반 무중단 방장 이양 지원
 */
export class SupabaseRoomTransport implements INetworkTransport {
  private channel: RealtimeChannel | null = null;
  private status: NetworkTransportStatus = 'disconnected';
  private roomId = '';
  private localPlayerId = '';
  private baseMeta: Omit<NetworkPresenceMeta, 'joinedAt'> = { name: '수호자', color: 'blue' };
  private preferredHostId = '';
  private currentJoinedAt = 0;
  private isBackground = false;
  private claimedEpoch = 0;
  private highestObservedEpoch = 0;
  private hasCorrectedInitialJoinSkew = false;
  private isHost = true;
  private onlineCount = 1;
  private connectionEpoch = 0;
  private isReconnectingSession = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  private eventHandlers = new Map<string, Set<NetworkEventHandler>>();
  private presenceHandlers = new Set<PresenceSyncHandler>();
  private leaveHandlers = new Set<PlayerLeaveHandler>();
  private resumeHandlers = new Set<ConnectionResumeHandler>();

  private boundOnlineHandler: (() => void) | null = null;
  private boundVisibilityHandler: (() => void) | null = null;

  public connect(
    roomId: string,
    playerId: string,
    meta: Omit<NetworkPresenceMeta, 'joinedAt'>
  ): void {
    this.disposed = false;
    this.clearReconnectTimer();
    this.cleanupChannel();
    const epoch = ++this.connectionEpoch;
    this.roomId = roomId;
    this.localPlayerId = playerId;
    this.baseMeta = { name: meta.name, color: meta.color };
    this.preferredHostId = meta.preferredHostId ?? '';
    this.isBackground =
      typeof document !== 'undefined' && document.visibilityState === 'hidden';
    // 로비에서 확정된 방장은 초기 claimedEpoch=1로 시작해 기기 시계 오차와 무관하게 방장 권한을 안정적으로 유지
    this.claimedEpoch =
      !this.isBackground && this.preferredHostId !== '' && this.preferredHostId === playerId
        ? 1
        : 0;
    this.highestObservedEpoch = this.claimedEpoch;
    this.hasCorrectedInitialJoinSkew = false;
    this.currentJoinedAt = 0;
    this.isReconnectingSession = false;
    this.reconnectAttempt = 0;
    this.status = 'connecting';

    this.attachNetworkRecoveryListeners();
    void this.openChannel(`tiny_isles_room_${roomId}`, playerId, epoch);
  }

  private attachNetworkRecoveryListeners(): void {
    if (typeof window === 'undefined' || this.boundOnlineHandler) return;
    this.boundOnlineHandler = () => {
      if (this.disposed) return;
      this.ensureChannelHealthy();
    };
    this.boundVisibilityHandler = () => {
      if (this.disposed || typeof document === 'undefined') return;
      if (document.visibilityState === 'visible') {
        this.ensureChannelHealthy();
      }
    };
    window.addEventListener('online', this.boundOnlineHandler);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.boundVisibilityHandler);
    }
  }

  private detachNetworkRecoveryListeners(): void {
    if (this.boundOnlineHandler && typeof window !== 'undefined') {
      window.removeEventListener('online', this.boundOnlineHandler);
      this.boundOnlineHandler = null;
    }
    if (this.boundVisibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
      this.boundVisibilityHandler = null;
    }
  }

  private ensureChannelHealthy(): void {
    if (this.disposed || !this.roomId || !this.localPlayerId) return;
    if (this.status === 'connecting') return;
    const state = (this.channel as { state?: string } | null)?.state;
    if (!this.channel || this.status !== 'connected' || (state && state !== 'joined')) {
      this.reconnectNow();
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.disposed || this.reconnectTimer || !this.roomId || !this.localPlayerId) return;
    const delay = Math.min(
      HOST_SYNC_CONFIG.reconnectMaxDelayMs,
      HOST_SYNC_CONFIG.reconnectBaseDelayMs * Math.pow(2, this.reconnectAttempt)
    );
    this.reconnectAttempt = Math.min(this.reconnectAttempt + 1, 5);
    this.status = 'connecting';
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.disposed) return;
      this.reconnectNow();
    }, delay);
  }

  private reconnectNow(): void {
    if (this.disposed || !this.roomId || !this.localPlayerId) return;
    this.isReconnectingSession = true;
    this.clearReconnectTimer();
    this.cleanupChannel();
    const epoch = ++this.connectionEpoch;
    this.status = 'connecting';
    void this.openChannel(`tiny_isles_room_${this.roomId}`, this.localPlayerId, epoch);
  }

  private async openChannel(
    channelName: string,
    playerId: string,
    epoch: number
  ): Promise<void> {
    const targetTopic = `realtime:${channelName}`;
    const staleChannels = supabase
      .getChannels()
      .filter((ch) => ch.topic === targetTopic);
    if (staleChannels.length > 0) {
      await Promise.all(staleChannels.map((ch) => supabase.removeChannel(ch)));
    }
    if (epoch !== this.connectionEpoch || this.disposed) return;

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
        const rawPresence = channel.presenceState() as Record<string, PresenceRawEntry[]>;
        const rawState: Record<string, PresenceRawEntry[]> = { ...rawPresence };
        if (!rawState[playerId] || rawState[playerId].length === 0) {
          rawState[playerId] = [
            {
              name: this.baseMeta.name,
              color: this.baseMeta.color,
              joinedAt: this.currentJoinedAt || Date.now(),
              isBackground: this.isBackground,
              claimedEpoch: this.claimedEpoch,
            },
          ];
        }
        const otherKeys = Object.keys(rawState).filter((id) => id !== playerId);

        // SUBSCRIBED 시점에 presenceState가 비어있어 기기 시계 오차로 joinedAt이 앞섰던 게스트/재접속자를 자동 보정
        if (!this.hasCorrectedInitialJoinSkew && otherKeys.length > 0) {
          this.hasCorrectedInitialJoinSkew = true;
          const isLobbyGuest =
            Boolean(this.preferredHostId) && this.preferredHostId !== playerId;
          if (isLobbyGuest || this.isReconnectingSession) {
            const othersPresence: Record<string, PresenceRawEntry[]> = {};
            for (const key of otherKeys) {
              othersPresence[key] = rawState[key];
            }
            const nextMonotonic = computeMonotonicJoinedAt(othersPresence, Date.now());
            let shouldRetrack = false;
            if (this.currentJoinedAt < nextMonotonic) {
              this.currentJoinedAt = nextMonotonic;
              shouldRetrack = true;
            }
            if (this.isReconnectingSession && this.claimedEpoch > 0) {
              this.claimedEpoch = 0;
              shouldRetrack = true;
            }
            if (shouldRetrack) {
              rawState[playerId] = [
                {
                  name: this.baseMeta.name,
                  color: this.baseMeta.color,
                  joinedAt: this.currentJoinedAt,
                  isBackground: this.isBackground,
                  claimedEpoch: this.claimedEpoch,
                },
              ];
              void this.trackPresenceState();
            }
          }
        }

        const maxPresentEpoch = computeMaxClaimedEpoch(rawState);
        if (maxPresentEpoch > this.highestObservedEpoch) {
          this.highestObservedEpoch = maxPresentEpoch;
        }

        const { isHost, hostId, onlineCount } = electHostFromPresence(
          rawState,
          playerId,
          this.preferredHostId || undefined
        );

        // 상위 에폭 방장이 이탈해 새 방장으로 승계된 경우 에폭이 역행(1->0)하지 않도록 단조 승격
        if (
          isHost &&
          !this.isBackground &&
          this.highestObservedEpoch > 0 &&
          this.claimedEpoch < this.highestObservedEpoch
        ) {
          this.claimedEpoch = this.highestObservedEpoch + 1;
          this.highestObservedEpoch = this.claimedEpoch;
          void this.trackPresenceState();
        }

        const hostEpoch = Math.max(maxPresentEpoch, isHost ? this.claimedEpoch : 0);
        this.isHost = isHost;
        this.onlineCount = onlineCount;

        const members: RoomMember[] = Object.entries(rawState).map(([id, entries]) => {
          const latest = extractLatestPresenceMeta(entries) as PresenceRawEntry | undefined;
          return {
            playerId: id,
            name: latest?.name || '수호자',
            color: latest?.color === 'red' ? 'red' : 'blue',
            isHost: id === hostId,
            joinedAt:
              typeof latest?.joinedAt === 'number' ? latest.joinedAt : Number.MAX_SAFE_INTEGER,
            isBackground: latest?.isBackground === true,
            claimedEpoch: typeof latest?.claimedEpoch === 'number' ? latest.claimedEpoch : 0,
          };
        });
        members.sort((a, b) => a.joinedAt - b.joinedAt || a.playerId.localeCompare(b.playerId));

        this.presenceHandlers.forEach((h) =>
          h({ isHost, hostId, hostEpoch, onlineCount, members })
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
        if (epoch !== this.connectionEpoch || this.disposed) return;
        if (subStatus === 'SUBSCRIBED') {
          this.clearReconnectTimer();
          this.reconnectAttempt = 0;
          this.status = 'connected';
          this.hasCorrectedInitialJoinSkew = false;
          const currentPresence = channel.presenceState() as Record<string, PresenceEntryMeta[]>;
          const isLobbyGuest =
            Boolean(this.preferredHostId) && this.preferredHostId !== playerId;
          const baseJoinClock = isLobbyGuest ? Date.now() + 10_000 : Date.now();
          this.currentJoinedAt = computeMonotonicJoinedAt(currentPresence, baseJoinClock);
          if (
            this.isReconnectingSession &&
            Object.keys(currentPresence).some((id) => id !== playerId)
          ) {
            this.claimedEpoch = 0;
          }
          await this.trackPresenceState();
          if (this.isReconnectingSession) {
            this.resumeHandlers.forEach((h) => h());
          }
          return;
        }
        if (subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT' || subStatus === 'CLOSED') {
          this.scheduleReconnect();
        }
      });
  }

  private async trackPresenceState(): Promise<void> {
    if (!this.channel || this.status !== 'connected' || this.disposed) return;
    try {
      const result = await this.channel.track({
        name: this.baseMeta.name,
        color: this.baseMeta.color,
        joinedAt: this.currentJoinedAt || Date.now(),
        isBackground: this.isBackground,
        claimedEpoch: this.claimedEpoch,
      });
      if (result === 'timed out' || result === 'error') {
        this.scheduleReconnect();
      }
    } catch {
      this.scheduleReconnect();
    }
  }

  public claimHostAuthority(nextEpoch: number): void {
    this.isBackground = false;
    const monotonicNext = Math.max(
      this.claimedEpoch,
      this.highestObservedEpoch + 1,
      Math.max(1, Math.floor(nextEpoch))
    );
    this.claimedEpoch = monotonicNext;
    this.highestObservedEpoch = Math.max(this.highestObservedEpoch, monotonicNext);
    void this.trackPresenceState();
  }

  public yieldHostAuthority(isBackground: boolean): void {
    this.isBackground = isBackground;
    this.claimedEpoch = 0;
    if (this.channel && this.status === 'connected') {
      const raw = this.channel.presenceState() as Record<string, PresenceEntryMeta[]>;
      const hasOtherPeers = Object.keys(raw).some((id) => id !== this.localPlayerId);
      if (hasOtherPeers) {
        this.currentJoinedAt = computeMonotonicJoinedAt(raw, Date.now());
      }
    }
    void this.trackPresenceState();
  }

  public updatePresenceBackground(isBackground: boolean): void {
    this.isBackground = isBackground;
    void this.trackPresenceState();
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
    this.disposed = true;
    this.clearReconnectTimer();
    this.detachNetworkRecoveryListeners();
    this.cleanupChannel();
    this.eventHandlers.clear();
    this.presenceHandlers.clear();
    this.leaveHandlers.clear();
    this.resumeHandlers.clear();
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

  public onConnectionResume(handler: ConnectionResumeHandler): () => void {
    this.resumeHandlers.add(handler);
    return () => {
      this.resumeHandlers.delete(handler);
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
