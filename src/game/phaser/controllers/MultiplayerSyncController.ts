import Phaser from 'phaser';
import { HOST_SYNC_CONFIG, PLAYER_COMBAT_CONFIG, PLAYER_SYNC_CONFIG } from '../../../data/worldRules';
import {
  CampCoreHitPayload,
  CampCoreSyncPayload,
  CampFullSyncPayload,
  CampStructureHitPayload,
  CampStructureHpSyncPayload,
} from '../../../types/campSync';
import { RemotePlayerSkillCastPayload } from '../../../types/combat';
import {
  ConstructedBuilding,
  DungeonPortalState,
  Entity,
  Player,
  PlayerAction,
  PlayerColor,
  VillageTier,
} from '../../../types/game';
import {
  ActivePlayerTarget,
  HostHandoverPayload,
  HostHeartbeatPayload,
  HostWelcomePayload,
  JoinHelloPayload,
  MissionProgressSyncPayload,
  MonsterHitPayload,
  MonsterPlayerAttackPayload,
  MonstersDeltaSyncPayload,
  MonstersFullSyncPayload,
  MonstersRepairRequestPayload,
  ThreatSyncPayload,
  WorldStateSyncPayload,
} from '../../../types/monsterSync';
import { RoomMode } from '../../../types/room';
import { DomainSyncBus } from '../../net/DomainSyncBus';
import { WorldSnapshotRegistry } from '../../net/WorldSnapshotRegistry';
import { RemotePlayerRenderer } from '../renderers/RemotePlayerRenderer';
import { HostFailoverWatchdog } from './HostFailoverWatchdog';
import { MultiplayerChannelRouter } from './MultiplayerChannelRouter';

export interface IMultiplayerSyncContext {
  scene: Phaser.Scene;
  getPlayerId: () => string;
  getPlayerName: () => string;
  getPlayerColor: () => PlayerColor;
  getRoomId?: () => string;
  getRoomMode?: () => RoomMode;
  getPreferredHostId?: () => string | undefined;
  isLocalPlayerFainted?: () => boolean;
  getLocalPlayerHp?: () => { hp: number; maxHp: number };
  getLiveMonsterDigest?: () => { count: number; digest: number };
  getLocalPlayerState: () => {
    x: number;
    y: number;
    direction: 'left' | 'right';
    action: PlayerAction;
  };
  onOnlineCountChanged: (count: number, hasNewPeer?: boolean) => void;
  onHostStatusChanged?: (isHost: boolean, hostEpoch?: number) => void;
  onHostIdentityChanged?: (hostId: string, isHost: boolean, hostEpoch: number) => void;
  onConnectionResumed?: () => void;
  onSyncResyncRequested?: () => void;
  onRemoteJoinHello?: (payload: JoinHelloPayload) => void;
  onRemoteHostWelcome?: (payload: HostWelcomePayload) => void;
  onRemoteWorldStateSync?: (payload: WorldStateSyncPayload) => void;
  onRemoteMissionProgressSync?: (payload: MissionProgressSyncPayload) => void;
  onRemotePlayerSkillCast?: (payload: RemotePlayerSkillCastPayload) => void;
  onRemoteEntityHit: (entityId: string, damage: number, hitByName: string) => void;
  onRemoteEntityRespawned?: (entity: Entity) => void;
  onRemoteIslandUnlocked: (islandId: number, unlockedBy: string, ownerId?: string) => void;
  onRemoteVillageUpgraded: (territoryId: number, targetTier?: VillageTier) => void;
  onRemotePlayerActive?: (playerId: string) => void;
  onRemoteBuildingConstructed: (building: ConstructedBuilding) => void;
  onRemoteWaveSpawned: (isBossWave: boolean) => void;
  onRemoteWaveSummonRequest?: (isBossWave: boolean, isEarlySummon: boolean) => void;
  onRemoteMonstersSync: (payload: MonstersFullSyncPayload) => void;
  onRemoteMonstersDeltaSync?: (payload: MonstersDeltaSyncPayload) => void;
  onRemoteMonstersSyncRequest?: () => void;
  onRemoteMonstersRepairRequest?: (payload: MonstersRepairRequestPayload) => void;
  onRemoteMonsterHit: (payload: MonsterHitPayload) => void;
  onRemoteMonsterPlayerAttack?: (payload: MonsterPlayerAttackPayload) => void;
  onRemoteThreatAdded?: (amount: number) => void;
  onRemoteThreatSync?: (payload: ThreatSyncPayload) => void;
  onRemoteDungeonPortalSync?: (portal: DungeonPortalState | null) => void;
  onRemoteCampStructureHit?: (payload: CampStructureHitPayload) => void;
  onRemoteCampCoreHit?: (payload: CampCoreHitPayload) => void;
  onRemoteCampStructureHpSync?: (payload: CampStructureHpSyncPayload) => void;
  onRemoteCampCoreSync?: (payload: CampCoreSyncPayload) => void;
  onRemoteCampFullSync?: (payload: CampFullSyncPayload) => void;
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
  hp: number;
  maxHp: number;
  isFainted: boolean;
  name: string;
  color: PlayerColor;
}

/**
 * 실시간 멀티플레이(채널 라우터 + 방장 생존 감시 + 원격 플레이어 렌더러) 조율 컨트롤러
 */
export class MultiplayerSyncController {
  private ctx: IMultiplayerSyncContext;
  private remoteRenderer: RemotePlayerRenderer;
  private router: MultiplayerChannelRouter;
  private domainBus: DomainSyncBus;
  private snapshotRegistry = new WorldSnapshotRegistry();
  private watchdog: HostFailoverWatchdog;
  private lastBroadcastTime = 0;
  private lastHeartbeatTime = 0;
  private lastSentState: LastSentMoveSnapshot | null = null;
  private lastRemoteMovePos = new Map<string, { x: number; y: number }>();
  private hasConfirmedHostSession = false;
  private joinHelloTimer: ReturnType<typeof setInterval> | null = null;

  constructor(ctx: IMultiplayerSyncContext) {
    this.ctx = ctx;
    this.remoteRenderer = new RemotePlayerRenderer(ctx.scene);
    this.watchdog = new HostFailoverWatchdog({
      getLocalPlayerId: () => this.ctx.getPlayerId(),
      isCoopMode: () => this.ctx.getRoomMode?.() === 'coop',
      getLiveMonsterDigest: () => this.ctx.getLiveMonsterDigest?.() ?? { count: 0, digest: 0 },
      onSendHostHeartbeat: (payload: HostHeartbeatPayload) =>
        this.router.emit('host_heartbeat', 'host_heartbeat', payload),
      onSendHostHandover: (payload: HostHandoverPayload) =>
        this.router.emit('host_handover', 'host_handover', payload),
      onClaimHostAuthority: (nextEpoch) => this.router.claimHostAuthority(nextEpoch),
      onYieldHostAuthority: (isBackground) => this.router.yieldHostAuthority(isBackground),
      onUpdatePresenceBackground: (isBackground) =>
        this.router.updatePresenceBackground(isBackground),
      onDigestMismatchDetected: () => this.ctx.onSyncResyncRequested?.(),
      onResumeResyncNeeded: () => {
        this.ctx.onConnectionResumed?.();
        this.ctx.onSyncResyncRequested?.();
      },
    });
    this.router = new MultiplayerChannelRouter({
      getPlayerId: () => this.ctx.getPlayerId(),
      getPlayerName: () => this.ctx.getPlayerName(),
      getPlayerColor: () => this.ctx.getPlayerColor(),
      getRoomId: () => this.ctx.getRoomId?.() || 'default_room',
      getRoomMode: () => this.ctx.getRoomMode?.() || 'solo',
      getPreferredHostId: () => this.ctx.getPreferredHostId?.(),
      onOnlineCountChanged: (count, hasNewPeer) => this.ctx.onOnlineCountChanged(count, hasNewPeer),
      onHostStatusChanged: (isHost, hostEpoch) => {
        if (isHost) {
          this.stopJoinHelloLoop();
        }
        this.ctx.onHostStatusChanged?.(isHost, hostEpoch);
      },
      onHostIdentityChanged: (hostId, isHost, hostEpoch) =>
        this.ctx.onHostIdentityChanged?.(hostId, isHost, hostEpoch),
      onPresenceSnapshot: (snapshot) => this.watchdog.updatePresenceSnapshot(snapshot),
      onConnectionResume: () => {
        this.ctx.onConnectionResumed?.();
        this.ctx.onSyncResyncRequested?.();
      },
      onRemoteJoinHello: (payload) => {
        if (!payload || payload.playerId === this.ctx.getPlayerId()) return;
        this.watchdog.recordPeerActivity(payload.playerId);
        this.ctx.onRemoteJoinHello?.(payload);
      },
      onRemoteHostWelcome: (payload) => {
        if (!payload || payload.hostId === this.ctx.getPlayerId()) return;
        this.markHostConfirmed(payload.hostId, payload.hostEpoch);
        this.ctx.onRemoteHostWelcome?.(payload);
      },
      onRemoteHostHeartbeat: (payload) => {
        this.markHostConfirmed(payload.hostId, payload.hostEpoch);
        this.watchdog.handleHostHeartbeat(payload);
      },
      onRemoteHostHandover: (payload) => this.watchdog.handleHostHandover(payload),
      onRemoteWorldStateSync: (payload) => {
        this.markHostConfirmed(undefined, payload.hostEpoch);
        this.watchdog.recordHostActivity(payload.hostEpoch);
        this.ctx.onRemoteWorldStateSync?.(payload);
      },
      onRemoteMissionProgressSync: (payload) => {
        this.markHostConfirmed(undefined, payload.hostEpoch);
        this.watchdog.recordHostActivity(payload.hostEpoch);
        this.ctx.onRemoteMissionProgressSync?.(payload);
      },
      onRemotePlayerMove: (player) => {
        this.watchdog.recordPeerActivity(player.id);
        const prevPos = this.lastRemoteMovePos.get(player.id);
        const moved =
          !prevPos ||
          Math.abs(prevPos.x - player.x) >= 4 ||
          Math.abs(prevPos.y - player.y) >= 4;
        if (moved) {
          this.lastRemoteMovePos.set(player.id, { x: player.x, y: player.y });
          this.ctx.onRemotePlayerActive?.(player.id);
        }
        this.remoteRenderer.updatePlayer(player, this.ctx.getPlayerId());
      },
      onRemotePlayerLeave: (playerId) => {
        this.lastRemoteMovePos.delete(playerId);
        this.remoteRenderer.removePlayer(playerId);
      },
      onRemotePlayerSkillCast: (payload) => this.ctx.onRemotePlayerSkillCast?.(payload),
      onRemoteEntityHit: (entityId, damage, hitByName) =>
        this.ctx.onRemoteEntityHit(entityId, damage, hitByName),
      onRemoteEntityRespawned: (entity) => this.ctx.onRemoteEntityRespawned?.(entity),
      onRemoteIslandUnlocked: (islandId, unlockedBy, ownerId) =>
        this.ctx.onRemoteIslandUnlocked(islandId, unlockedBy, ownerId),
      onRemoteVillageUpgraded: (territoryId, targetTier) =>
        this.ctx.onRemoteVillageUpgraded(territoryId, targetTier),
      onRemoteBuildingConstructed: (building) =>
        this.ctx.onRemoteBuildingConstructed(building),
      onRemoteWaveSpawned: (isBossWave) => this.ctx.onRemoteWaveSpawned(isBossWave),
      onRemoteWaveSummonRequest: (isBossWave, isEarlySummon) =>
        this.ctx.onRemoteWaveSummonRequest?.(isBossWave, isEarlySummon),
      onRemoteMonstersSync: (payload) => {
        this.markHostConfirmed(undefined, payload.hostEpoch);
        this.watchdog.recordHostActivity(payload.hostEpoch);
        this.ctx.onRemoteMonstersSync(payload);
      },
      onRemoteMonstersDeltaSync: (payload) => {
        this.markHostConfirmed(undefined, payload.hostEpoch);
        this.watchdog.recordHostActivity(payload.hostEpoch);
        this.ctx.onRemoteMonstersDeltaSync?.(payload);
      },
      onRemoteMonstersSyncRequest: () => this.ctx.onRemoteMonstersSyncRequest?.(),
      onRemoteMonstersRepairRequest: (payload) =>
        this.ctx.onRemoteMonstersRepairRequest?.(payload),
      onRemoteMonsterHit: (payload) => this.ctx.onRemoteMonsterHit(payload),
      onRemoteMonsterPlayerAttack: (payload) => {
        this.watchdog.recordHostActivity();
        this.ctx.onRemoteMonsterPlayerAttack?.(payload);
      },
      onRemoteThreatAdded: (amount) => this.ctx.onRemoteThreatAdded?.(amount),
      onRemoteThreatSync: (payload) => {
        this.watchdog.recordHostActivity();
        this.ctx.onRemoteThreatSync?.(payload);
      },
      onRemoteDungeonPortalSync: (portal) => {
        this.watchdog.recordHostActivity();
        this.ctx.onRemoteDungeonPortalSync?.(portal);
      },
      onRemoteCampStructureHit: (payload) => this.ctx.onRemoteCampStructureHit?.(payload),
      onRemoteCampCoreHit: (payload) => this.ctx.onRemoteCampCoreHit?.(payload),
      onRemoteCampStructureHpSync: (payload) => {
        this.watchdog.recordHostActivity();
        this.ctx.onRemoteCampStructureHpSync?.(payload);
      },
      onRemoteCampCoreSync: (payload) => {
        this.watchdog.recordHostActivity();
        this.ctx.onRemoteCampCoreSync?.(payload);
      },
      onRemoteCampFullSync: (payload) => {
        this.watchdog.recordHostActivity();
        this.ctx.onRemoteCampFullSync?.(payload);
      },
      onRemoteTerritoryLost: (territoryId, reason) =>
        this.ctx.onRemoteTerritoryLost(territoryId, reason),
      onRemoteBuildingHpSync: (buildingId, hp, maxHp, damageDelta) => {
        // 게스트 개별 수리(damageDelta 미포함)가 호스트 생존 신호로 오인되지 않도록 전투 피해 시에만 기록
        if (typeof damageDelta === 'number' && damageDelta > 0) {
          this.watchdog.recordHostActivity();
        }
        this.ctx.onRemoteBuildingHpSync?.(buildingId, hp, maxHp, damageDelta);
      },
      onRemoteBuildingDestroyed: (buildingId) =>
        this.ctx.onRemoteBuildingDestroyed?.(buildingId),
      onRemoteCoreHpSync: (territoryId, coreHp, coreMaxHp, damageDelta) => {
        this.watchdog.recordHostActivity();
        this.ctx.onRemoteCoreHpSync?.(territoryId, coreHp, coreMaxHp, damageDelta);
      },
      onRemoteRepairTerritoryRequest: (territoryId) =>
        this.ctx.onRemoteRepairTerritoryRequest?.(territoryId),
      onRemoteWorldDefenseFailed: (resetAt, attackerName) =>
        this.ctx.onRemoteWorldDefenseFailed?.(resetAt, attackerName),
    });

    this.domainBus = new DomainSyncBus({
      registerDynamicEvent: (event, handler) => this.router.registerDynamicEvent(event, handler),
      emitDynamic: (event, payload, batched, coalesceKey) =>
        this.router.emitDynamic(event, payload, batched, coalesceKey),
    });

    this.domainBus.on('domain_snapshot_sync', (payload) => {
      if (this.router.getIsHost()) return;
      this.markHostConfirmed(undefined, payload.hostEpoch);
      this.snapshotRegistry.applyAll(payload.slices);
    });

    this.router.onRoomSnapshotSync((snapshot, hostId, hostEpoch) => {
      if (this.router.getIsHost()) return;
      this.markHostConfirmed(hostId, hostEpoch);
      const slices = snapshot.domainSlices as Record<string, unknown> | undefined;
      if (slices) {
        this.snapshotRegistry.applyAll(slices);
      }
    });
  }

  private markHostConfirmed(hostId?: string, hostEpoch?: number): void {
    this.hasConfirmedHostSession = true;
    this.stopJoinHelloLoop();
    this.router.confirmRemoteHostSeen(hostId, hostEpoch);
  }

  private startJoinHelloLoop(): void {
    this.stopJoinHelloLoop();
    if (this.ctx.getRoomMode?.() !== 'coop') return;
    const preferredHostId = this.ctx.getPreferredHostId?.();
    const localPlayerId = this.ctx.getPlayerId();
    // 로비 방장 자신은 join_hello를 보낼 필요가 없음
    if (preferredHostId && preferredHostId === localPlayerId) return;

    this.hasConfirmedHostSession = false;
    const sendHello = () => {
      if (this.hasConfirmedHostSession || this.router.getIsHost()) {
        this.stopJoinHelloLoop();
        return;
      }
      this.broadcastJoinHello();
    };
    setTimeout(sendHello, 220);
    this.joinHelloTimer = setInterval(sendHello, HOST_SYNC_CONFIG.joinHelloRetryIntervalMs);
  }

  private stopJoinHelloLoop(): void {
    if (this.joinHelloTimer) {
      clearInterval(this.joinHelloTimer);
      this.joinHelloTimer = null;
    }
  }

  public broadcastJoinHello(): void {
    if (this.ctx.getRoomMode?.() !== 'coop') return;
    const payload: JoinHelloPayload = {
      playerId: this.ctx.getPlayerId(),
      playerName: this.ctx.getPlayerName(),
      playerColor: this.ctx.getPlayerColor(),
      preferredHostId: this.ctx.getPreferredHostId?.(),
      sentAt: Date.now(),
    };
    this.router.emit('join_hello', 'join_hello', payload);
  }

  public broadcastHostWelcome(targetPlayerId?: string): void {
    if (this.ctx.getRoomMode?.() !== 'coop') return;
    const payload: HostWelcomePayload = {
      hostId: this.ctx.getPlayerId(),
      hostEpoch: this.router.getHostEpoch(),
      targetPlayerId,
      sentAt: Date.now(),
    };
    this.router.emit('host_welcome', 'host_welcome', payload);
  }

  public getIsHost(): boolean {
    return this.router.getIsHost();
  }

  public getHostEpoch(): number {
    return this.router.getHostEpoch();
  }

  public getOnlineCount(): number {
    return this.router.getOnlineCount();
  }

  public getKnownMemberIds(): ReadonlySet<string> {
    return this.router.getKnownMemberIds();
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

  public getRemotePlayerMinimapMarkers(): Array<{
    id: string;
    name: string;
    color: PlayerColor;
    x: number;
    y: number;
    isFainted: boolean;
  }> {
    return this.remoteRenderer.getMinimapMarkers();
  }

  public setup(): void {
    this.watchdog.attachBrowserLifecycle();
    this.router.connect();
    this.startJoinHelloLoop();
  }

  public update(deltaMs = 16): void {
    this.watchdog.tick();
    this.remoteRenderer.update(deltaMs);
  }

  public updateRoomMeta(
    meta: Partial<import('../../../shared/multiplayerProtocol').ProtocolRoomMeta>,
    ended?: boolean
  ): void {
    this.router.updateRoomMeta(meta, ended);
  }

  public getDomainBus(): DomainSyncBus {
    return this.domainBus;
  }

  public getSnapshotRegistry(): WorldSnapshotRegistry {
    return this.snapshotRegistry;
  }

  public broadcastDomainSnapshot(): void {
    if (!this.router.getIsHost()) return;
    const slices = this.snapshotRegistry.captureAll();
    if (Object.keys(slices).length === 0) return;
    const hostEpoch = this.router.getHostEpoch();
    this.domainBus.emit('domain_snapshot_sync', { hostEpoch, slices });
    this.router.uploadRoomSnapshot({ hostEpoch, domainSlices: slices });
  }

  public destroy(): void {
    this.stopJoinHelloLoop();
    this.lastSentState = null;
    this.lastRemoteMovePos.clear();
    this.domainBus.destroy();
    this.snapshotRegistry.clear();
    this.watchdog.destroy();
    this.remoteRenderer.clear();
    this.router.destroy();
  }

  public maybeBroadcastPlayerMove(time: number): void {
    if (this.ctx.getRoomMode?.() === 'solo') return;
    const minInterval =
      this.router.getOnlineCount() >= 3
        ? PLAYER_SYNC_CONFIG.coopMoveBroadcastIntervalMs
        : PLAYER_SYNC_CONFIG.moveBroadcastIntervalMs;
    if (time - this.lastBroadcastTime <= minInterval) return;

    const state = this.ctx.getLocalPlayerState();
    const rx = Math.round(state.x);
    const ry = Math.round(state.y);
    const isFainted = this.ctx.isLocalPlayerFainted?.() ?? false;
    const hpState = this.ctx.getLocalPlayerHp?.();
    const maxHp = Math.max(1, Math.round(hpState?.maxHp ?? PLAYER_COMBAT_CONFIG.maxHp));
    const hp = Math.max(0, Math.min(maxHp, Math.round(hpState?.hp ?? (isFainted ? 0 : maxHp))));
    const name = this.ctx.getPlayerName();
    const color = this.ctx.getPlayerColor();

    const prev = this.lastSentState;
    const changed =
      !prev ||
      prev.x !== rx ||
      prev.y !== ry ||
      prev.direction !== state.direction ||
      prev.action !== state.action ||
      prev.hp !== hp ||
      prev.maxHp !== maxHp ||
      prev.isFainted !== isFainted ||
      prev.name !== name ||
      prev.color !== color;

    if (!changed && time - this.lastHeartbeatTime < PLAYER_SYNC_CONFIG.idleHeartbeatMs) {
      return;
    }

    const hasUrgentStateChange =
      !prev ||
      prev.action !== state.action ||
      prev.hp !== hp ||
      prev.maxHp !== maxHp ||
      prev.isFainted !== isFainted ||
      prev.name !== name ||
      prev.color !== color;

    this.lastBroadcastTime = time;
    this.lastHeartbeatTime = time;
    this.lastSentState = {
      x: rx,
      y: ry,
      direction: state.direction,
      action: state.action,
      hp,
      maxHp,
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
      hp,
      maxHp,
      isFainted,
      lastUpdated: Date.now(),
    };

    if (hasUrgentStateChange) {
      this.router.emit('player_move', 'player_move', payload);
    } else {
      this.router.emitBatched('player_move', 'player_move', payload, payload, 'player_move');
    }
  }

  public broadcastPlayerSkillCast(payload: RemotePlayerSkillCastPayload): void {
    if (this.ctx.getRoomMode?.() === 'solo') return;
    this.router.emit('player_skill_cast', 'player_skill_cast', payload);
  }

  public broadcastHit(entityId: string, damage: number): void {
    const payload = { entityId, damage, hitBy: this.ctx.getPlayerName() };
    this.router.emitBatched('hit', 'entity_hit', payload);
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

  public requestMonstersRepair(payload: MonstersRepairRequestPayload): void {
    this.router.emit('monsters_repair_request', 'monsters_repair_request', {
      ids: payload.ids,
      requesterId: this.ctx.getPlayerId(),
    });
  }

  public broadcastMonsterHit(payload: MonsterHitPayload): void {
    this.router.emitBatched('monster_hit', 'monster_hit', payload);
  }

  public broadcastMonsterPlayerAttack(payload: MonsterPlayerAttackPayload): void {
    this.router.emitBatched('monster_player_attack', 'monster_player_attack', payload);
  }

  public broadcastThreatAdded(amount: number): void {
    this.router.emitBatched('threat_added', 'threat_added', { amount });
  }

  public broadcastThreatSync(payload: ThreatSyncPayload): void {
    this.router.emit('threat_sync', 'threat_sync', payload);
  }

  public broadcastDungeonPortalSync(portal: DungeonPortalState | null): void {
    this.router.emit('dungeon_portal_sync', 'dungeon_portal_sync', { portal });
  }

  public broadcastCampStructureHit(payload: CampStructureHitPayload): void {
    this.router.emitBatched('camp_structure_hit', 'camp_structure_hit', payload);
  }

  public broadcastCampCoreHit(payload: CampCoreHitPayload): void {
    this.router.emitBatched('camp_core_hit', 'camp_core_hit', payload);
  }

  public broadcastCampStructureHpSync(payload: CampStructureHpSyncPayload): void {
    this.router.emitBatched(
      'camp_structure_hp_sync',
      'camp_structure_hp_sync',
      payload,
      payload,
      `camp_struct_${payload.structureId}`
    );
  }

  public broadcastCampCoreSync(payload: CampCoreSyncPayload): void {
    this.router.emitBatched(
      'camp_core_sync',
      'camp_core_sync',
      payload,
      payload,
      `camp_core_${payload.territoryId}`
    );
  }

  public broadcastCampFullSync(payload: CampFullSyncPayload): void {
    this.router.emit('camp_full_sync', 'camp_full_sync', payload);
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
    const payload = {
      buildingId,
      hp,
      maxHp,
      damageDelta,
    };
    this.router.emitBatched(
      'building_hp_sync',
      'building_hp_sync',
      payload,
      payload,
      `bld_hp_${buildingId}`
    );
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

  public broadcastWorldStateSync(payload: WorldStateSyncPayload): void {
    this.router.emit('world_state_sync', 'world_state_sync', payload);
  }

  public broadcastMissionProgressSync(
    payload: Omit<MissionProgressSyncPayload, 'hostEpoch'>
  ): void {
    this.router.emit('mission_progress_sync', 'mission_progress_sync', {
      ...payload,
      hostEpoch: this.router.getHostEpoch(),
    });
  }
}
