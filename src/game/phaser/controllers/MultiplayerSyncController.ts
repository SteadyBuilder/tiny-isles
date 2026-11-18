import Phaser from 'phaser';
import { PLAYER_SYNC_CONFIG } from '../../../data/worldRules';
import {
  ConstructedBuilding,
  Entity,
  Player,
  PlayerAction,
  PlayerColor,
  VillageTier,
} from '../../../types/game';
import {
  ActivePlayerTarget,
  MonsterHitPayload,
  MonsterPlayerAttackPayload,
  MonstersDeltaSyncPayload,
  MonstersFullSyncPayload,
} from '../../../types/monsterSync';
import { RoomMode } from '../../../types/room';
import { RemotePlayerRenderer } from '../renderers/RemotePlayerRenderer';
import { MultiplayerChannelRouter } from './MultiplayerChannelRouter';

export interface IMultiplayerSyncContext {
  scene: Phaser.Scene;
  getPlayerId: () => string;
  getPlayerName: () => string;
  getPlayerColor: () => PlayerColor;
  getRoomId?: () => string;
  getRoomMode?: () => RoomMode;
  isLocalPlayerFainted?: () => boolean;
  getLocalPlayerState: () => {
    x: number;
    y: number;
    direction: 'left' | 'right';
    action: PlayerAction;
  };
  onOnlineCountChanged: (count: number, hasNewPeer?: boolean) => void;
  onHostStatusChanged?: (isHost: boolean) => void;
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

interface LastSentMoveSnapshot {
  x: number;
  y: number;
  direction: 'left' | 'right';
  action: PlayerAction;
  isFainted: boolean;
  name: string;
  color: PlayerColor;
}

/**
 * 실시간 멀티플레이(채널 라우터 + 원격 플레이어 렌더러) 조율 컨트롤러
 */
export class MultiplayerSyncController {
  private ctx: IMultiplayerSyncContext;
  private remoteRenderer: RemotePlayerRenderer;
  private router: MultiplayerChannelRouter;
  private lastBroadcastTime = 0;
  private lastHeartbeatTime = 0;
  private lastSentState: LastSentMoveSnapshot | null = null;

  constructor(ctx: IMultiplayerSyncContext) {
    this.ctx = ctx;
    this.remoteRenderer = new RemotePlayerRenderer(ctx.scene);
    this.router = new MultiplayerChannelRouter({
      getPlayerId: () => this.ctx.getPlayerId(),
      getPlayerName: () => this.ctx.getPlayerName(),
      getPlayerColor: () => this.ctx.getPlayerColor(),
      getRoomId: () => this.ctx.getRoomId?.() || 'default_room',
      getRoomMode: () => this.ctx.getRoomMode?.() || 'solo',
      onOnlineCountChanged: (count, hasNewPeer) => this.ctx.onOnlineCountChanged(count, hasNewPeer),
      onHostStatusChanged: (isHost) => this.ctx.onHostStatusChanged?.(isHost),
      onRemotePlayerMove: (player) =>
        this.remoteRenderer.updatePlayer(player, this.ctx.getPlayerId()),
      onRemotePlayerLeave: (playerId) => this.remoteRenderer.removePlayer(playerId),
      onRemoteEntityHit: (entityId, damage, hitByName) =>
        this.ctx.onRemoteEntityHit(entityId, damage, hitByName),
      onRemoteEntityRespawned: (entity) => this.ctx.onRemoteEntityRespawned?.(entity),
      onRemoteIslandUnlocked: (islandId, unlockedBy, ownerId) =>
        this.ctx.onRemoteIslandUnlocked(islandId, unlockedBy, ownerId),
      onRemoteVillageUpgraded: (territoryId) =>
        this.ctx.onRemoteVillageUpgraded(territoryId),
      onRemoteBuildingConstructed: (building) =>
        this.ctx.onRemoteBuildingConstructed(building),
      onRemoteWaveSpawned: (isBossWave) => this.ctx.onRemoteWaveSpawned(isBossWave),
      onRemoteWaveSummonRequest: (isBossWave, isEarlySummon) =>
        this.ctx.onRemoteWaveSummonRequest?.(isBossWave, isEarlySummon),
      onRemoteMonstersSync: (payload) => this.ctx.onRemoteMonstersSync(payload),
      onRemoteMonstersDeltaSync: (payload) => this.ctx.onRemoteMonstersDeltaSync?.(payload),
      onRemoteMonstersSyncRequest: () => this.ctx.onRemoteMonstersSyncRequest?.(),
      onRemoteMonsterHit: (payload) => this.ctx.onRemoteMonsterHit(payload),
      onRemoteMonsterPlayerAttack: (payload) => this.ctx.onRemoteMonsterPlayerAttack?.(payload),
      onRemoteThreatAdded: (amount) => this.ctx.onRemoteThreatAdded?.(amount),
      onRemoteThreatSync: (threatPercent, waveCount, bossWaveCount) =>
        this.ctx.onRemoteThreatSync?.(threatPercent, waveCount, bossWaveCount),
      onRemoteTerritoryLost: (territoryId, reason) =>
        this.ctx.onRemoteTerritoryLost(territoryId, reason),
      onRemoteBuildingHpSync: (buildingId, hp, maxHp, damageDelta) =>
        this.ctx.onRemoteBuildingHpSync?.(buildingId, hp, maxHp, damageDelta),
      onRemoteBuildingDestroyed: (buildingId) =>
        this.ctx.onRemoteBuildingDestroyed?.(buildingId),
      onRemoteCoreHpSync: (territoryId, coreHp, coreMaxHp, damageDelta) =>
        this.ctx.onRemoteCoreHpSync?.(territoryId, coreHp, coreMaxHp, damageDelta),
      onRemoteRepairTerritoryRequest: (territoryId) =>
        this.ctx.onRemoteRepairTerritoryRequest?.(territoryId),
      onRemoteWorldDefenseFailed: (resetAt, attackerName) =>
        this.ctx.onRemoteWorldDefenseFailed?.(resetAt, attackerName),
    });
  }

  public getIsHost(): boolean {
    return this.router.getIsHost();
  }

  public getActivePlayers(
    localPos: { x: number; y: number },
    localFainted: boolean
  ): ActivePlayerTarget[] {
    const localPlayer: ActivePlayerTarget = {
      id: this.ctx.getPlayerId(),
      x: localPos.x,
      y: localPos.y,
      isFainted: localFainted,
    };
    return [localPlayer, ...this.remoteRenderer.getActivePlayers()];
  }

  public setup(): void {
    this.router.connect();
  }

  public destroy(): void {
    this.lastSentState = null;
    this.remoteRenderer.clear();
    this.router.destroy();
  }

  public maybeBroadcastPlayerMove(time: number): void {
    if (this.ctx.getRoomMode?.() === 'solo') return;
    if (time - this.lastBroadcastTime <= PLAYER_SYNC_CONFIG.moveBroadcastIntervalMs) return;

    const state = this.ctx.getLocalPlayerState();
    const rx = Math.round(state.x);
    const ry = Math.round(state.y);
    const isFainted = this.ctx.isLocalPlayerFainted?.() ?? false;
    const name = this.ctx.getPlayerName();
    const color = this.ctx.getPlayerColor();

    const prev = this.lastSentState;
    const changed =
      !prev ||
      prev.x !== rx ||
      prev.y !== ry ||
      prev.direction !== state.direction ||
      prev.action !== state.action ||
      prev.isFainted !== isFainted ||
      prev.name !== name ||
      prev.color !== color;

    if (!changed && time - this.lastHeartbeatTime < PLAYER_SYNC_CONFIG.idleHeartbeatMs) {
      return;
    }

    this.lastBroadcastTime = time;
    this.lastHeartbeatTime = time;
    this.lastSentState = {
      x: rx,
      y: ry,
      direction: state.direction,
      action: state.action,
      isFainted,
      name,
      color,
    };

    const payload: Player = {
      id: this.ctx.getPlayerId(),
      name,
      x: rx,
      y: ry,
      direction: state.direction,
      action: state.action,
      color,
      isFainted,
      lastUpdated: Date.now(),
    };
    this.router.emit('player_move', 'player_move', payload);
  }

  public broadcastHit(entityId: string, damage: number): void {
    const payload = { entityId, damage, hitBy: this.ctx.getPlayerName() };
    this.router.emit('hit', 'entity_hit', payload);
  }

  public broadcastUnlock(islandId: number, unlockedBy: string, ownerId?: string): void {
    this.router.emit('island_unlocked', 'island_unlocked', { islandId, unlockedBy, ownerId });
  }

  public broadcastVillageUpgrade(territoryId: number, tier: VillageTier): void {
    this.router.emit('village_upgraded', 'village_upgraded', { territoryId, tier });
  }

  public broadcastBuildingConstructed(building: ConstructedBuilding): void {
    this.router.emit('building_constructed', 'building_constructed', building, { building });
  }

  public broadcastWaveSpawn(isBossWave: boolean): void {
    this.router.emit('wave_spawned', 'wave_spawned', { isBossWave });
  }

  public broadcastWaveSummonRequest(isBossWave: boolean, isEarlySummon: boolean): void {
    this.router.emit('wave_summon_request', 'wave_summon_request', { isBossWave, isEarlySummon });
  }

  public broadcastMonstersSync(payload: MonstersFullSyncPayload): void {
    this.router.emit('monsters_sync', 'monsters_sync', payload);
  }

  public broadcastMonstersDeltaSync(payload: MonstersDeltaSyncPayload): void {
    this.router.emit('monsters_delta_sync', 'monsters_delta_sync', payload);
  }

  public requestMonstersSync(): void {
    this.router.emit('monsters_sync_request', 'monsters_sync_request', {
      requesterId: this.ctx.getPlayerId(),
    });
  }

  public broadcastMonsterHit(payload: MonsterHitPayload): void {
    this.router.emit('monster_hit', 'monster_hit', payload);
  }

  public broadcastMonsterPlayerAttack(payload: MonsterPlayerAttackPayload): void {
    this.router.emit('monster_player_attack', 'monster_player_attack', payload);
  }

  public broadcastThreatAdded(amount: number): void {
    this.router.emit('threat_added', 'threat_added', { amount });
  }

  public broadcastThreatSync(
    threatPercent: number,
    waveCount: number,
    bossWaveCount: number
  ): void {
    this.router.emit('threat_sync', 'threat_sync', { threatPercent, waveCount, bossWaveCount });
  }

  public broadcastTerritoryLost(territoryId: number): void {
    this.router.emit('territory_lost', 'territory_lost', {
      territoryId,
      reason: '마물 군단',
    });
  }

  public broadcastBuildingHpSync(
    buildingId: string,
    hp: number,
    maxHp: number,
    damageDelta?: number
  ): void {
    this.router.emit('building_hp_sync', 'building_hp_sync', {
      buildingId,
      hp,
      maxHp,
      damageDelta,
    });
  }

  public broadcastBuildingDestroyed(buildingId: string): void {
    this.router.emit('building_destroyed', 'building_destroyed', { buildingId });
  }

  public broadcastCoreHpSync(
    territoryId: number,
    coreHp: number,
    coreMaxHp: number,
    damageDelta?: number
  ): void {
    this.router.emit('core_hp_sync', 'core_hp_sync', {
      territoryId,
      coreHp,
      coreMaxHp,
      damageDelta,
    });
  }

  public broadcastRepairTerritoryRequest(territoryId: number): void {
    this.router.emit('repair_territory_request', 'repair_territory_request', { territoryId });
  }

  public broadcastEntityRespawned(entity: Entity): void {
    this.router.emit('entity_respawned', 'entity_respawned', { entity });
  }

  public broadcastWorldDefenseFailed(resetAt: string, attackerName: string): void {
    this.router.emit('world_defense_failed', 'world_defense_failed', {
      resetAt,
      attackerName,
    });
  }
}
