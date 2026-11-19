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
  PlayerColor,
} from '../../../types/game';
import {
  DungeonPortalSyncPayload,
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
import { NetworkPresenceSnapshot } from '../../../lib/contracts/INetworkTransport';

export interface IMultiplayerChannelCallbacks {
  getPlayerId: () => string;
  getPlayerName: () => string;
  getPlayerColor: () => PlayerColor;
  getRoomId?: () => string;
  getRoomMode?: () => RoomMode;
  getPreferredHostId?: () => string | undefined;
  onOnlineCountChanged: (count: number, hasNewPeer?: boolean) => void;
  onHostStatusChanged?: (isHost: boolean, hostEpoch?: number) => void;
  onHostIdentityChanged?: (hostId: string, isHost: boolean, hostEpoch: number) => void;
  onPresenceSnapshot?: (snapshot: NetworkPresenceSnapshot) => void;
  onConnectionResume?: () => void;
  onRemoteJoinHello?: (payload: JoinHelloPayload) => void;
  onRemoteHostWelcome?: (payload: HostWelcomePayload) => void;
  onRemoteHostHeartbeat?: (payload: HostHeartbeatPayload) => void;
  onRemoteHostHandover?: (payload: HostHandoverPayload) => void;
  onRemoteWorldStateSync?: (payload: WorldStateSyncPayload) => void;
  onRemoteMissionProgressSync?: (payload: MissionProgressSyncPayload) => void;
  onRemotePlayerMove: (player: Player) => void;
  onRemotePlayerLeave: (playerId: string) => void;
  onRemotePlayerSkillCast?: (payload: RemotePlayerSkillCastPayload) => void;
  onRemoteEntityHit: (entityId: string, damage: number, hitByName: string) => void;
  onRemoteEntityRespawned?: (entity: Entity) => void;
  onRemoteIslandUnlocked: (islandId: number, unlockedBy: string, ownerId?: string) => void;
  onRemoteVillageUpgraded: (territoryId: number, targetTier?: import('../../../types/game').VillageTier) => void;
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

export const SHARED_CHANNEL_EVENTS = [
  'join_hello',
  'host_welcome',
  'host_heartbeat',
  'host_handover',
  'world_state_sync',
  'mission_progress_sync',
  'player_move',
  'player_skill_cast',
  'entity_hit',
  'island_unlocked',
  'village_upgraded',
  'wave_spawned',
  'wave_summon_request',
  'monsters_sync',
  'monsters_delta_sync',
  'monsters_sync_request',
  'monsters_repair_request',
  'monster_hit',
  'monster_player_attack',
  'threat_added',
  'threat_sync',
  'dungeon_portal_sync',
  'camp_structure_hit',
  'camp_core_hit',
  'camp_structure_hp_sync',
  'camp_core_sync',
  'camp_full_sync',
  'territory_lost',
  'building_hp_sync',
  'building_destroyed',
  'core_hp_sync',
  'repair_territory_request',
  'entity_respawned',
  'world_defense_failed',
] as const;

export function dispatchSharedChannelEvent(
  eventName: string,
  payload: unknown,
  callbacks: IMultiplayerChannelCallbacks
): void {
  switch (eventName) {
    case 'join_hello':
      callbacks.onRemoteJoinHello?.(payload as JoinHelloPayload);
      break;
    case 'host_welcome':
      callbacks.onRemoteHostWelcome?.(payload as HostWelcomePayload);
      break;
    case 'host_heartbeat':
      callbacks.onRemoteHostHeartbeat?.(payload as HostHeartbeatPayload);
      break;
    case 'host_handover':
      callbacks.onRemoteHostHandover?.(payload as HostHandoverPayload);
      break;
    case 'world_state_sync':
      callbacks.onRemoteWorldStateSync?.(payload as WorldStateSyncPayload);
      break;
    case 'mission_progress_sync':
      callbacks.onRemoteMissionProgressSync?.(payload as MissionProgressSyncPayload);
      break;
    case 'player_move':
      callbacks.onRemotePlayerMove(payload as Player);
      break;
    case 'player_skill_cast':
      callbacks.onRemotePlayerSkillCast?.(payload as RemotePlayerSkillCastPayload);
      break;
    case 'entity_hit': {
      const p = payload as { entityId: string; damage: number; hitBy: string };
      callbacks.onRemoteEntityHit(p.entityId, p.damage, p.hitBy);
      break;
    }
    case 'island_unlocked': {
      const p = payload as { islandId: number; unlockedBy: string; ownerId?: string };
      callbacks.onRemoteIslandUnlocked(p.islandId, p.unlockedBy, p.ownerId);
      break;
    }
    case 'village_upgraded': {
      const p = payload as { territoryId: number; tier?: import('../../../types/game').VillageTier };
      callbacks.onRemoteVillageUpgraded(p.territoryId, p.tier);
      break;
    }
    case 'wave_spawned':
      callbacks.onRemoteWaveSpawned((payload as { isBossWave: boolean }).isBossWave);
      break;
    case 'wave_summon_request': {
      const p = payload as { isBossWave: boolean; isEarlySummon: boolean };
      callbacks.onRemoteWaveSummonRequest?.(Boolean(p.isBossWave), Boolean(p.isEarlySummon));
      break;
    }
    case 'monsters_sync': {
      const p = payload as Partial<MonstersFullSyncPayload>;
      callbacks.onRemoteMonstersSync({
        monsters: p.monsters || [],
        waveCount: p.waveCount ?? 0,
        bossWaveCount: p.bossWaveCount ?? 0,
        syncId: p.syncId,
        chunkIndex: p.chunkIndex,
        totalChunks: p.totalChunks,
        hostEpoch: p.hostEpoch,
        syncSeq: p.syncSeq,
      });
      break;
    }
    case 'monsters_delta_sync':
      callbacks.onRemoteMonstersDeltaSync?.(payload as MonstersDeltaSyncPayload);
      break;
    case 'monsters_sync_request':
      callbacks.onRemoteMonstersSyncRequest?.();
      break;
    case 'monsters_repair_request': {
      const p = payload as Partial<MonstersRepairRequestPayload>;
      callbacks.onRemoteMonstersRepairRequest?.({
        ids: Array.isArray(p.ids) ? p.ids : [],
        requesterId: p.requesterId,
      });
      break;
    }
    case 'monster_hit':
      callbacks.onRemoteMonsterHit(payload as MonsterHitPayload);
      break;
    case 'monster_player_attack':
      callbacks.onRemoteMonsterPlayerAttack?.(payload as MonsterPlayerAttackPayload);
      break;
    case 'threat_added':
      callbacks.onRemoteThreatAdded?.(Number((payload as { amount: number }).amount ?? 0));
      break;
    case 'threat_sync': {
      const p = payload as Partial<ThreatSyncPayload>;
      callbacks.onRemoteThreatSync?.({
        threatPercent: Number(p.threatPercent ?? 0),
        waveCount: Number(p.waveCount ?? 0),
        bossWaveCount: Number(p.bossWaveCount ?? 0),
        countdownSecondsRemaining: p.countdownSecondsRemaining,
        nextWaveIsBoss: p.nextWaveIsBoss,
      });
      break;
    }
    case 'dungeon_portal_sync': {
      const p = payload as Partial<DungeonPortalSyncPayload>;
      callbacks.onRemoteDungeonPortalSync?.(p.portal ?? null);
      break;
    }
    case 'camp_structure_hit':
      callbacks.onRemoteCampStructureHit?.(payload as CampStructureHitPayload);
      break;
    case 'camp_core_hit':
      callbacks.onRemoteCampCoreHit?.(payload as CampCoreHitPayload);
      break;
    case 'camp_structure_hp_sync':
      callbacks.onRemoteCampStructureHpSync?.(payload as CampStructureHpSyncPayload);
      break;
    case 'camp_core_sync':
      callbacks.onRemoteCampCoreSync?.(payload as CampCoreSyncPayload);
      break;
    case 'camp_full_sync':
      callbacks.onRemoteCampFullSync?.(payload as CampFullSyncPayload);
      break;
    case 'territory_lost': {
      const p = payload as { territoryId: number; reason?: string };
      callbacks.onRemoteTerritoryLost(p.territoryId, p.reason || '마물 군단');
      break;
    }
    case 'building_hp_sync': {
      const p = payload as { buildingId: string; hp: number; maxHp: number; damageDelta?: number };
      callbacks.onRemoteBuildingHpSync?.(p.buildingId, p.hp, p.maxHp, p.damageDelta);
      break;
    }
    case 'building_destroyed':
      callbacks.onRemoteBuildingDestroyed?.((payload as { buildingId: string }).buildingId);
      break;
    case 'core_hp_sync': {
      const p = payload as { territoryId: number; coreHp: number; coreMaxHp: number; damageDelta?: number };
      callbacks.onRemoteCoreHpSync?.(p.territoryId, p.coreHp, p.coreMaxHp, p.damageDelta);
      break;
    }
    case 'repair_territory_request':
      callbacks.onRemoteRepairTerritoryRequest?.((payload as { territoryId: number }).territoryId);
      break;
    case 'entity_respawned': {
      const p = payload as { entity: Entity };
      if (p.entity) callbacks.onRemoteEntityRespawned?.(p.entity);
      break;
    }
    case 'world_defense_failed': {
      const p = payload as { resetAt: string; attackerName: string };
      if (p.resetAt) {
        callbacks.onRemoteWorldDefenseFailed?.(p.resetAt, p.attackerName || '마물 군단');
      }
      break;
    }
  }
}
