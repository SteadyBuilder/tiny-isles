import {
  ConstructedBuilding,
  Entity,
  Monster,
  Player,
  PlayerColor,
  VillageTier,
} from '../../../types/game';
import { RoomMode } from '../../../types/room';
import { INetworkTransport } from '../../../lib/contracts/INetworkTransport';
import { LocalOfflineTransport } from '../../../lib/transports/LocalOfflineTransport';
import { SupabaseRoomTransport } from '../../../lib/transports/SupabaseRoomTransport';
import { GameEvents } from '../../events/gameEvents';

export interface IMultiplayerChannelCallbacks {
  getPlayerId: () => string;
  getPlayerName: () => string;
  getPlayerColor: () => PlayerColor;
  getRoomId?: () => string;
  getRoomMode?: () => RoomMode;
  onOnlineCountChanged: (count: number) => void;
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
  onRemoteMonstersSync: (monsters: Monster[], waveCount: number, bossWaveCount: number) => void;
  onRemoteMonsterHit: (monsterId: string, damage: number, attackerName: string) => void;
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
  payload?: unknown;
}

/**
 * INetworkTransport(LocalOffline / SupabaseRoom / 추후 SteamP2P) 기반 멀티플레이 채널 라우터
 */
export class MultiplayerChannelRouter {
  private callbacks: IMultiplayerChannelCallbacks;
  private transport: INetworkTransport | null = null;
  private localBus: BroadcastChannel | null = null;
  private unsubscribers: Array<() => void> = [];
  private isHost = true;

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
    this.localBus?.postMessage({ type: localType, senderId: playerId, payload: localPayload });
    this.transport?.emit(remoteEvent, remotePayload);
  }

  public destroy(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];

    if (this.localBus) {
      this.localBus.close();
      this.localBus = null;
    }
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
        if (this.isHost !== snapshot.isHost) {
          this.isHost = snapshot.isHost;
          this.callbacks.onHostStatusChanged?.(snapshot.isHost);
        }
        this.callbacks.onOnlineCountChanged(snapshot.onlineCount);
        GameEvents.emit('online-count-changed', snapshot.onlineCount);
        GameEvents.emit('room-members-updated', snapshot.members);
      }),
      t.onPlayerLeave((playerId) => {
        this.callbacks.onRemotePlayerLeave(playerId);
      }),
      t.on<Player>('player_move', (p) => this.callbacks.onRemotePlayerMove(p)),
      t.on<{ entityId: string; damage: number; hitBy: string }>('entity_hit', (p) =>
        this.callbacks.onRemoteEntityHit(p.entityId, p.damage, p.hitBy)
      ),
      t.on<{ islandId: number; unlockedBy: string; ownerId?: string }>('island_unlocked', (p) =>
        this.callbacks.onRemoteIslandUnlocked(p.islandId, p.unlockedBy, p.ownerId)
      ),
      t.on<{ territoryId: number }>('village_upgraded', (p) =>
        this.callbacks.onRemoteVillageUpgraded(p.territoryId)
      ),
      t.on<{ building: ConstructedBuilding }>('building_constructed', (p) => {
        if (p.building) this.callbacks.onRemoteBuildingConstructed(p.building);
      }),
      t.on<{ isBossWave: boolean }>('wave_spawned', (p) =>
        this.callbacks.onRemoteWaveSpawned(p.isBossWave)
      ),
      t.on<{ isBossWave: boolean; isEarlySummon: boolean }>('wave_summon_request', (p) =>
        this.callbacks.onRemoteWaveSummonRequest?.(Boolean(p.isBossWave), Boolean(p.isEarlySummon))
      ),
      t.on<{ monsters: Monster[]; waveCount: number; bossWaveCount: number }>('monsters_sync', (p) =>
        this.callbacks.onRemoteMonstersSync(p.monsters || [], p.waveCount ?? 0, p.bossWaveCount ?? 0)
      ),
      t.on<{ monsterId: string; damage: number; attackerName: string }>('monster_hit', (p) =>
        this.callbacks.onRemoteMonsterHit(p.monsterId, p.damage, p.attackerName)
      ),
      t.on<{ amount: number }>('threat_added', (p) =>
        this.callbacks.onRemoteThreatAdded?.(Number(p.amount ?? 0))
      ),
      t.on<{ threatPercent: number; waveCount: number; bossWaveCount: number }>('threat_sync', (p) =>
        this.callbacks.onRemoteThreatSync?.(
          Number(p.threatPercent ?? 0),
          Number(p.waveCount ?? 0),
          Number(p.bossWaveCount ?? 0)
        )
      ),
      t.on<{ territoryId: number; reason?: string }>('territory_lost', (p) =>
        this.callbacks.onRemoteTerritoryLost(p.territoryId, p.reason || '마물 군단')
      ),
      t.on<{ buildingId: string; hp: number; maxHp: number; damageDelta?: number }>(
        'building_hp_sync',
        (p) => this.callbacks.onRemoteBuildingHpSync?.(p.buildingId, p.hp, p.maxHp, p.damageDelta)
      ),
      t.on<{ buildingId: string }>('building_destroyed', (p) =>
        this.callbacks.onRemoteBuildingDestroyed?.(p.buildingId)
      ),
      t.on<{ territoryId: number; coreHp: number; coreMaxHp: number; damageDelta?: number }>(
        'core_hp_sync',
        (p) =>
          this.callbacks.onRemoteCoreHpSync?.(p.territoryId, p.coreHp, p.coreMaxHp, p.damageDelta)
      ),
      t.on<{ territoryId: number }>('repair_territory_request', (p) =>
        this.callbacks.onRemoteRepairTerritoryRequest?.(p.territoryId)
      ),
      t.on<{ entity: Entity }>('entity_respawned', (p) => {
        if (p.entity) this.callbacks.onRemoteEntityRespawned?.(p.entity);
      }),
      t.on<{ resetAt: string; attackerName: string }>('world_defense_failed', (p) => {
        if (p.resetAt) {
          this.callbacks.onRemoteWorldDefenseFailed?.(p.resetAt, p.attackerName || '마물 군단');
        }
      })
    );
  }

  private setupLocalBus(playerId: string, roomId: string): void {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    this.localBus = new BroadcastChannel(`tiny_isles_room_${roomId}`);
    this.localBus.onmessage = (event: MessageEvent<LocalBusEnvelope>) => {
      const data = event.data;
      if (!data || data.senderId === playerId || !data.type) return;
      this.handleLocalMessage(data.type, data.payload);
    };
  }

  private handleLocalMessage(type: string, payload: unknown): void {
    switch (type) {
      case 'player_move':
        this.callbacks.onRemotePlayerMove(payload as Player);
        break;
      case 'hit': {
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
      case 'building_constructed':
        this.callbacks.onRemoteBuildingConstructed(payload as ConstructedBuilding);
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
        const p = payload as { monsters: Monster[]; waveCount: number; bossWaveCount: number };
        this.callbacks.onRemoteMonstersSync(p.monsters || [], p.waveCount ?? 0, p.bossWaveCount ?? 0);
        break;
      }
      case 'monster_hit': {
        const p = payload as { monsterId: string; damage: number; attackerName: string };
        this.callbacks.onRemoteMonsterHit(p.monsterId, p.damage, p.attackerName);
        break;
      }
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
    }
  }
}
