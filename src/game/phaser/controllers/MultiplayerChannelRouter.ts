import {
  ConstructedBuilding,
  Monster,
  Player,
  PlayerColor,
  VillageTier,
} from '../../../types/game';
import { supabase } from '../../../lib/supabase';
import { serverSync } from '../../../lib/serverSync';
import { GameEvents } from '../../events/gameEvents';
import { electHostFromPresence, PresenceEntryMeta } from './HostAuthorityHelper';

export interface IMultiplayerChannelCallbacks {
  getPlayerId: () => string;
  getPlayerName: () => string;
  getPlayerColor: () => PlayerColor;
  onOnlineCountChanged: (count: number) => void;
  onHostStatusChanged?: (isHost: boolean) => void;
  onRemotePlayerMove: (player: Player) => void;
  onRemotePlayerLeave: (playerId: string) => void;
  onRemoteEntityHit: (entityId: string, damage: number, hitByName: string) => void;
  onRemoteIslandUnlocked: (islandId: number, unlockedBy: string) => void;
  onRemoteVillageUpgraded: (territoryId: number) => void;
  onRemoteBuildingConstructed: (building: ConstructedBuilding) => void;
  onRemoteWaveSpawned: (isBossWave: boolean) => void;
  onRemoteMonstersSync: (monsters: Monster[], waveCount: number, bossWaveCount: number) => void;
  onRemoteMonsterHit: (monsterId: string, damage: number, attackerName: string) => void;
  onRemoteTerritoryLost: (territoryId: number, reason: string) => void;
}

interface BroadcastMeta {
  eventId?: string;
  senderId?: string;
}

interface LocalBusEnvelope {
  type?: string;
  senderId?: string;
  payload?: unknown;
}

/**
 * BroadcastChannel(로컬 탭) 및 Supabase Presence/Broadcast 채널 연결·라우팅 전담 라우터
 */
export class MultiplayerChannelRouter {
  private callbacks: IMultiplayerChannelCallbacks;
  private localBus: BroadcastChannel | null = null;
  private supabaseChannel: ReturnType<typeof supabase.channel> | null = null;
  private isSubscribed = false;
  private isHost = true;

  constructor(callbacks: IMultiplayerChannelCallbacks) {
    this.callbacks = callbacks;
  }

  public getIsHost(): boolean {
    return this.isHost;
  }

  public connect(): void {
    const playerId = this.callbacks.getPlayerId();
    this.setupLocalBus(playerId);
    this.setupSupabaseChannel(playerId);
  }

  public emit<T extends object>(
    localType: string,
    remoteEvent: string,
    localPayload: T,
    remotePayload: object = localPayload
  ): void {
    const playerId = this.callbacks.getPlayerId();
    this.localBus?.postMessage({ type: localType, senderId: playerId, payload: localPayload });
    if (this.supabaseChannel && this.isSubscribed) {
      serverSync.broadcast(this.supabaseChannel, remoteEvent, remotePayload, playerId);
    }
  }

  public destroy(): void {
    if (this.localBus) {
      this.localBus.close();
      this.localBus = null;
    }

    if (this.supabaseChannel) {
      void this.supabaseChannel.unsubscribe();
      this.supabaseChannel = null;
      this.isSubscribed = false;
    }
  }

  private setupLocalBus(playerId: string): void {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;

    this.localBus = new BroadcastChannel('tiny_isles_multiplayer');
    this.localBus.onmessage = (event: MessageEvent<LocalBusEnvelope>) => {
      const data = event.data;
      if (!data || data.senderId === playerId || !data.type) return;

      switch (data.type) {
        case 'player_move':
          this.callbacks.onRemotePlayerMove(data.payload as Player);
          break;
        case 'hit': {
          const { entityId, damage, hitBy } = data.payload as {
            entityId: string;
            damage: number;
            hitBy: string;
          };
          this.callbacks.onRemoteEntityHit(entityId, damage, hitBy);
          break;
        }
        case 'island_unlocked': {
          const { islandId, unlockedBy } = data.payload as {
            islandId: number;
            unlockedBy: string;
          };
          this.callbacks.onRemoteIslandUnlocked(islandId, unlockedBy);
          break;
        }
        case 'village_upgraded': {
          const { territoryId } = data.payload as { territoryId: number };
          this.callbacks.onRemoteVillageUpgraded(territoryId);
          break;
        }
        case 'building_constructed':
          this.callbacks.onRemoteBuildingConstructed(data.payload as ConstructedBuilding);
          break;
        case 'wave_spawned': {
          const { isBossWave } = data.payload as { isBossWave: boolean };
          this.callbacks.onRemoteWaveSpawned(isBossWave);
          break;
        }
        case 'monsters_sync': {
          const { monsters, waveCount, bossWaveCount } = data.payload as {
            monsters: Monster[];
            waveCount: number;
            bossWaveCount: number;
          };
          this.callbacks.onRemoteMonstersSync(monsters || [], waveCount ?? 0, bossWaveCount ?? 0);
          break;
        }
        case 'monster_hit': {
          const { monsterId, damage, attackerName } = data.payload as {
            monsterId: string;
            damage: number;
            attackerName: string;
          };
          this.callbacks.onRemoteMonsterHit(monsterId, damage, attackerName);
          break;
        }
        case 'territory_lost': {
          const { territoryId, reason } = data.payload as {
            territoryId: number;
            reason?: string;
          };
          this.callbacks.onRemoteTerritoryLost(territoryId, reason || '마물 군단');
          break;
        }
      }
    };
  }

  private setupSupabaseChannel(playerId: string): void {
    const roomId = 'tiny_isles_global_hub';
    const channel = supabase.channel(roomId, {
      config: {
        broadcast: { self: false },
        presence: { key: playerId },
      },
    });
    this.supabaseChannel = channel;

    const isValid = (meta: BroadcastMeta) =>
      serverSync.isValidIncomingEvent(meta.eventId, meta.senderId, playerId);

    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState() as Record<string, PresenceEntryMeta[]>;
        const { isHost, onlineCount } = electHostFromPresence(presenceState, playerId);
        if (this.isHost !== isHost) {
          this.isHost = isHost;
          this.callbacks.onHostStatusChanged?.(isHost);
        }
        this.callbacks.onOnlineCountChanged(onlineCount);
        GameEvents.emit('online-count-changed', onlineCount);
      })
      .on('presence', { event: 'leave' }, ({ key }: { key: string }) => {
        this.callbacks.onRemotePlayerLeave(key);
      })
      .on('broadcast', { event: 'player_move' }, ({ payload }: { payload: Player & BroadcastMeta }) => {
        if (isValid(payload)) this.callbacks.onRemotePlayerMove(payload);
      })
      .on(
        'broadcast',
        { event: 'entity_hit' },
        ({ payload }: { payload: { entityId: string; damage: number; hitBy: string } & BroadcastMeta }) => {
          if (isValid(payload)) this.callbacks.onRemoteEntityHit(payload.entityId, payload.damage, payload.hitBy);
        }
      )
      .on(
        'broadcast',
        { event: 'island_unlocked' },
        ({ payload }: { payload: { islandId: number; unlockedBy: string } & BroadcastMeta }) => {
          if (isValid(payload)) this.callbacks.onRemoteIslandUnlocked(payload.islandId, payload.unlockedBy);
        }
      )
      .on(
        'broadcast',
        { event: 'village_upgraded' },
        ({ payload }: { payload: { territoryId: number; tier: VillageTier } & BroadcastMeta }) => {
          if (isValid(payload)) this.callbacks.onRemoteVillageUpgraded(payload.territoryId);
        }
      )
      .on(
        'broadcast',
        { event: 'building_constructed' },
        ({ payload }: { payload: { building: ConstructedBuilding } & BroadcastMeta }) => {
          if (isValid(payload) && payload.building) {
            this.callbacks.onRemoteBuildingConstructed(payload.building);
          }
        }
      )
      .on(
        'broadcast',
        { event: 'wave_spawned' },
        ({ payload }: { payload: { isBossWave: boolean } & BroadcastMeta }) => {
          if (isValid(payload)) this.callbacks.onRemoteWaveSpawned(payload.isBossWave);
        }
      )
      .on(
        'broadcast',
        { event: 'monsters_sync' },
        ({
          payload,
        }: {
          payload: { monsters: Monster[]; waveCount: number; bossWaveCount: number } & BroadcastMeta;
        }) => {
          if (isValid(payload)) {
            this.callbacks.onRemoteMonstersSync(
              payload.monsters || [],
              payload.waveCount ?? 0,
              payload.bossWaveCount ?? 0
            );
          }
        }
      )
      .on(
        'broadcast',
        { event: 'monster_hit' },
        ({
          payload,
        }: {
          payload: { monsterId: string; damage: number; attackerName: string } & BroadcastMeta;
        }) => {
          if (isValid(payload)) {
            this.callbacks.onRemoteMonsterHit(payload.monsterId, payload.damage, payload.attackerName);
          }
        }
      )
      .on(
        'broadcast',
        { event: 'territory_lost' },
        ({ payload }: { payload: { territoryId: number; reason?: string } & BroadcastMeta }) => {
          if (isValid(payload)) {
            this.callbacks.onRemoteTerritoryLost(payload.territoryId, payload.reason || '마물 군단');
          }
        }
      )
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          this.isSubscribed = true;
          await channel.track({
            name: this.callbacks.getPlayerName(),
            color: this.callbacks.getPlayerColor(),
            joinedAt: Date.now(),
          });
        }
      });
  }
}
