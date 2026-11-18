import {
  ConstructedBuilding,
  Entity,
  Player,
  PlayerColor,
  VillageTier,
} from '../../../types/game';
import {
  MonsterHitPayload,
  MonsterPlayerAttackPayload,
  MonstersDeltaSyncPayload,
  MonstersFullSyncPayload,
} from '../../../types/monsterSync';
import { RoomMode } from '../../../types/room';
import { INetworkTransport } from '../../../lib/contracts/INetworkTransport';
import { serverSync } from '../../../lib/serverSync';
import { LocalOfflineTransport } from '../../../lib/transports/LocalOfflineTransport';
import { SupabaseRoomTransport } from '../../../lib/transports/SupabaseRoomTransport';
import { GameEvents } from '../../events/gameEvents';

export interface IMultiplayerChannelCallbacks {
  getPlayerId: () => string;
  getPlayerName: () => string;
  getPlayerColor: () => PlayerColor;
  getRoomId?: () => string;
  getRoomMode?: () => RoomMode;
  onOnlineCountChanged: (count: number, hasNewPeer?: boolean) => void;
  onHostStatusChanged?: (isHost: boolean) => void;
  onRemotePlayerMove: (player: Player) => void;
  onRemotePlayerLeave: (playerId: string) => void;
  onRemoteEntityHit: (entityId: string, damage: number, hitByName: string) => void;
  onRemoteEntityRespawned?: (entity: Entity) => void;
  onRemoteIslandUnlocked: (islandId: number, unlockedBy: string, ownerId?: string) => void;
  onRemoteVillageUpgraded: (territoryId: number) => void;
  onRemoteBuildingConstructed: (building: ConstructedBuilding) => void;
  onRemoteWaveSpawned: (isBossWave: boolean) => void;
  onRemoteWaveSummonRequest?: (isBossWave: boolean, isEarlySummon: boolean) => void;
  onRemoteMonstersSync: (payload: MonstersFullSyncPayload) => void;
  onRemoteMonstersDeltaSync?: (payload: MonstersDeltaSyncPayload) => void;
  onRemoteMonstersSyncRequest?: () => void;
  onRemoteMonsterHit: (payload: MonsterHitPayload) => void;
  onRemoteMonsterPlayerAttack?: (payload: MonsterPlayerAttackPayload) => void;
  onRemoteThreatAdded?: (amount: number) => void;
  onRemoteThreatSync?: (threatPercent: number, waveCount: number, bossWaveCount: number) => void;
  onRemoteTerritoryLost: (territoryId: number, reason: string) => void;
  onRemoteBuildingHpSync?: (
    buildingId: string,
    hp: number,
    maxHp: number,
    damageDelta?: number
  ) => void;
  onRemoteBuildingDestroyed?: (buildingId: string) => void;
  onRemoteCoreHpSync?: (
    territoryId: number,
    coreHp: number,
    coreMaxHp: number,
    damageDelta?: number
  ) => void;
  onRemoteRepairTerritoryRequest?: (territoryId: number) => void;
  onRemoteWorldDefenseFailed?: (resetAt: string, attackerName: string) => void;
}

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

  private dispatchSharedEvent(eventName: string, payload: unknown): void {
    switch (eventName) {
      case 'player_move':
        this.callbacks.onRemotePlayerMove(payload as Player);
        break;
      case 'entity_hit': {
        const p = payload as { entityId: string; damage: number; hitBy: string };
        this.callbacks.onRemoteEntityHit(p.entityId, p.damage, p.hitBy);
        break;
      }
      case 'island_unlocked': {
        const p = payload as { islandId: number; unlockedBy: string; ownerId?: string };
        this.callbacks.onRemoteIslandUnlocked(p.islandId, p.unlockedBy, p.ownerId);
        break;
      }
      case 'village_upgraded':
        this.callbacks.onRemoteVillageUpgraded((payload as { territoryId: number }).territoryId);
        break;
      case 'wave_spawned':
        this.callbacks.onRemoteWaveSpawned((payload as { isBossWave: boolean }).isBossWave);
        break;
      case 'wave_summon_request': {
        const p = payload as { isBossWave: boolean; isEarlySummon: boolean };
        this.callbacks.onRemoteWaveSummonRequest?.(Boolean(p.isBossWave), Boolean(p.isEarlySummon));
        break;
      }
      case 'monsters_sync': {
        const p = payload as Partial<MonstersFullSyncPayload>;
        this.callbacks.onRemoteMonstersSync({
          monsters: p.monsters || [],
          waveCount: p.waveCount ?? 0,
          bossWaveCount: p.bossWaveCount ?? 0,
          syncId: p.syncId,
          chunkIndex: p.chunkIndex,
          totalChunks: p.totalChunks,
        });
        break;
      }
      case 'monsters_delta_sync':
        this.callbacks.onRemoteMonstersDeltaSync?.(payload as MonstersDeltaSyncPayload);
        break;
      case 'monsters_sync_request':
        this.callbacks.onRemoteMonstersSyncRequest?.();
        break;
      case 'monster_hit':
        this.callbacks.onRemoteMonsterHit(payload as MonsterHitPayload);
        break;
      case 'monster_player_attack':
        this.callbacks.onRemoteMonsterPlayerAttack?.(payload as MonsterPlayerAttackPayload);
        break;
      case 'threat_added':
        this.callbacks.onRemoteThreatAdded?.(Number((payload as { amount: number }).amount ?? 0));
        break;
      case 'threat_sync': {
        const p = payload as { threatPercent: number; waveCount: number; bossWaveCount: number };
        this.callbacks.onRemoteThreatSync?.(
          Number(p.threatPercent ?? 0),
          Number(p.waveCount ?? 0),
          Number(p.bossWaveCount ?? 0)
        );
        break;
      }
      case 'territory_lost': {
        const p = payload as { territoryId: number; reason?: string };
        this.callbacks.onRemoteTerritoryLost(p.territoryId, p.reason || '마물 군단');
        break;
      }
      case 'building_hp_sync': {
        const p = payload as { buildingId: string; hp: number; maxHp: number; damageDelta?: number };
        this.callbacks.onRemoteBuildingHpSync?.(p.buildingId, p.hp, p.maxHp, p.damageDelta);
        break;
      }
      case 'building_destroyed':
        this.callbacks.onRemoteBuildingDestroyed?.((payload as { buildingId: string }).buildingId);
        break;
      case 'core_hp_sync': {
        const p = payload as { territoryId: number; coreHp: number; coreMaxHp: number; damageDelta?: number };
        this.callbacks.onRemoteCoreHpSync?.(p.territoryId, p.coreHp, p.coreMaxHp, p.damageDelta);
        break;
      }
      case 'repair_territory_request':
        this.callbacks.onRemoteRepairTerritoryRequest?.((payload as { territoryId: number }).territoryId);
        break;
      case 'entity_respawned': {
        const p = payload as { entity: Entity };
        if (p.entity) this.callbacks.onRemoteEntityRespawned?.(p.entity);
        break;
      }
      case 'world_defense_failed': {
        const p = payload as { resetAt: string; attackerName: string };
        if (p.resetAt) {
          this.callbacks.onRemoteWorldDefenseFailed?.(p.resetAt, p.attackerName || '마물 군단');
        }
        break;
      }
    }
  }

  private bindTransportEvents(): void {
    const t = this.transport;
    if (!t) return;

    const sharedEvents = [
      'player_move',
      'entity_hit',
      'island_unlocked',
      'village_upgraded',
      'wave_spawned',
      'wave_summon_request',
      'monsters_sync',
      'monsters_delta_sync',
      'monsters_sync_request',
      'monster_hit',
      'monster_player_attack',
      'threat_added',
      'threat_sync',
      'territory_lost',
      'building_hp_sync',
      'building_destroyed',
      'core_hp_sync',
      'repair_territory_request',
      'entity_respawned',
      'world_defense_failed',
    ] as const;

    this.unsubscribers.push(
      t.onPresenceSync((snapshot) => {
        const hostResolutionChanged = !this.presenceResolved || this.isHost !== snapshot.isHost;
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

        this.callbacks.onOnlineCountChanged(snapshot.onlineCount, hasNewPeer);

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
        if (hostResolutionChanged) {
          this.callbacks.onHostStatusChanged?.(snapshot.isHost);
        }
      }),
      t.onPlayerLeave((playerId) => {
        this.knownMemberIds.delete(playerId);
        this.callbacks.onRemotePlayerLeave(playerId);
      }),
      t.on<{ building: ConstructedBuilding }>('building_constructed', (p) => {
        if (p.building) this.callbacks.onRemoteBuildingConstructed(p.building);
      }),
      ...sharedEvents.map((ev) => t.on(ev, (p) => this.dispatchSharedEvent(ev, p)))
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
        this.dispatchSharedEvent('entity_hit', data.payload);
      } else if (data.type === 'building_constructed') {
        this.callbacks.onRemoteBuildingConstructed(data.payload as ConstructedBuilding);
      } else {
        this.dispatchSharedEvent(data.type, data.payload);
      }
    };
    this.localBus.postMessage({ type: '__bus_hello', senderId: playerId });
  }
}
