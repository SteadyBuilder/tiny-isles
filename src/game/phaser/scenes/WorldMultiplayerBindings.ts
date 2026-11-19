import Phaser from 'phaser';
import { PLAYER_CLASS_DEFINITIONS } from '../../../data/classes';
import { sound } from '../../../lib/sound';
import { ConstructedBuilding, Island, PlayerAction, PlayerColor } from '../../../types/game';
import { RoomMode } from '../../../types/room';
import { GameEvents } from '../../events/gameEvents';
import {
  buildWorldStateSyncPayload,
  reconcileWorldStateSnapshot,
} from '../../utils/worldStateSyncUtils';
import { CampFortificationSystem } from '../../systems/CampFortificationSystem';
import { CoreGemSystem } from '../../systems/CoreGemSystem';
import { FieldMonsterSystem } from '../../systems/FieldMonsterSystem';
import { MonsterCampSystem } from '../../systems/MonsterCampSystem';
import { PlayerHealthSystem } from '../../systems/PlayerHealthSystem';
import { WaveSystem } from '../../systems/WaveSystem';
import { MultiplayerSyncController } from '../controllers/MultiplayerSyncController';
import { ResourceEntityRenderer } from '../renderers/ResourceEntityRenderer';
import { SkillEffectsRenderer } from '../renderers/SkillEffectsRenderer';
import { WorldEffectsRenderer } from '../renderers/WorldEffectsRenderer';

export interface IWorldMultiplayerHost {
  scene: Phaser.Scene;
  getPlayerId: () => string;
  getPlayerName: () => string;
  getPlayerColor: () => PlayerColor;
  getRoomId?: () => string;
  getRoomMode?: () => RoomMode;
  getPreferredHostId?: () => string | undefined;
  getIslands?: () => Island[];
  getConstructedBuildings?: () => ConstructedBuilding[];
  applySyncedWorldState?: (
    updatedIslands: Island[],
    updatedBuildings: ConstructedBuilding[]
  ) => void;
  getLocalPlayerState: () => {
    x: number;
    y: number;
    direction: 'left' | 'right';
    action: PlayerAction;
  };
  unlockIslandLocally: (islandId: number, unlockedBy: string, isLocalTrigger: boolean, ownerId?: string) => void;
  upgradeVillageRemotely: (territoryId: number) => void;
  onRemoteBuildingConstructed: (cb: ConstructedBuilding) => void;
  onRemoteBuildingHpSync?: (
    buildingId: string,
    hp: number,
    maxHp: number,
    damageDelta?: number
  ) => void;
  onRemoteBuildingDestroyed?: (buildingId: string) => void;
  onRemoteRepairTerritoryRequest?: (territoryId: number) => void;
  onCoreDestroyed?: () => void;
  resourceEntityRenderer: ResourceEntityRenderer;
  skillEffectsRenderer: SkillEffectsRenderer;
  effectsRenderer: WorldEffectsRenderer;
}

export interface IWorldMultiplayerSystems {
  coreGemSystem: CoreGemSystem;
  playerHealthSystem: PlayerHealthSystem;
  campFortification: CampFortificationSystem;
  monsterCampSystem: MonsterCampSystem;
  fieldMonsterSystem: FieldMonsterSystem;
  waveSystem: WaveSystem;
}

/**
 * WorldScene 멀티플레이 동기화 컨트롤러 조립 및 호스트-게스트 이벤트 바인딩 전담 헬퍼
 */
export function createWorldMultiplayerSync(
  host: IWorldMultiplayerHost,
  systems: IWorldMultiplayerSystems
): MultiplayerSyncController {
  const {
    coreGemSystem,
    playerHealthSystem,
    campFortification,
    monsterCampSystem,
    fieldMonsterSystem,
    waveSystem,
  } = systems;

  let hasResolvedHostOnce = false;
  let lastKnownHostState = false;
  let sync!: MultiplayerSyncController;

  let lastWorldSnapshotBroadcastAt = 0;

  const broadcastAuthoritativeWorldSnapshot = (force = false) => {
    if (!waveSystem.getIsHost()) return;
    const now = Date.now();
    if (!force && now - lastWorldSnapshotBroadcastAt < 1200) return;
    const islands = host.getIslands?.();
    const buildings = host.getConstructedBuildings?.();
    if (!islands || !buildings) return;
    lastWorldSnapshotBroadcastAt = now;
    sync.broadcastWorldStateSync(
      buildWorldStateSyncPayload(sync.getHostEpoch(), islands, buildings)
    );
  };

  const broadcastFullRoomState = (force: boolean) => {
    if (!waveSystem.getIsHost()) return;
    const ws = waveSystem.getWaveState();
    sync.broadcastThreatSync({
      threatPercent: ws.threatPercent,
      waveCount: ws.waveCount,
      bossWaveCount: ws.bossWaveCount,
      countdownSecondsRemaining: ws.countdownSecondsRemaining,
      nextWaveIsBoss: ws.nextWaveIsBoss,
    });
    sync.broadcastDungeonPortalSync(waveSystem.getDungeonPortalState());
    broadcastAuthoritativeWorldSnapshot(force);
    waveSystem.broadcastFullMonstersSync(force);
    monsterCampSystem.broadcastFullCampSync(force);
  };

  sync = new MultiplayerSyncController({
    scene: host.scene,
    getPlayerId: host.getPlayerId,
    getPlayerName: host.getPlayerName,
    getPlayerColor: host.getPlayerColor,
    getRoomId: host.getRoomId,
    getRoomMode: host.getRoomMode,
    getPreferredHostId: host.getPreferredHostId,
    isLocalPlayerFainted: () => playerHealthSystem.isFainted(),
    getLocalPlayerHp: () => playerHealthSystem.getState(),
    getLiveMonsterDigest: () => waveSystem.getLiveMonsterDigest(),
    getLocalPlayerState: host.getLocalPlayerState,
    onOnlineCountChanged: (count, hasNewPeer) => {
      waveSystem.setOnlineCount(count);
      monsterCampSystem.setOnlineCount(count);
      fieldMonsterSystem.setOnlineCount(count);
      if (waveSystem.getIsHost() && hasNewPeer && count > 1) {
        broadcastFullRoomState(true);
      }
    },
    onHostStatusChanged: (isHost, hostEpoch) => {
      const migratedMidGame = hasResolvedHostOnce && isHost && !lastKnownHostState;
      hasResolvedHostOnce = true;
      lastKnownHostState = isHost;

      waveSystem.setHostMode(isHost, hostEpoch);
      if (isHost) {
        monsterCampSystem.ensureHostGarrisonsSpawned();
        fieldMonsterSystem.ensureHostInitialized();
        if (migratedMidGame && host.getRoomMode?.() === 'coop') {
          GameEvents.emit(
            'game-alert',
            '📡 방장 권한을 자동으로 이어받았습니다. 게임이 끊김 없이 계속됩니다!'
          );
          broadcastFullRoomState(true);
        }
      } else {
        fieldMonsterSystem.resetForGuest();
        monsterCampSystem.resetGuestGarrisonState();
      }
    },
    onHostIdentityChanged: (_hostId, isHost, hostEpoch) => {
      waveSystem.handleHostIdentityChanged(isHost, hostEpoch);
    },
    onConnectionResumed: () => {
      waveSystem.handleConnectionResumed();
    },
    onSyncResyncRequested: () => {
      if (!waveSystem.getIsHost()) {
        waveSystem.requestMonstersSyncNow();
      }
    },
    onRemoteWorldStateSync: (payload) => {
      if (waveSystem.getIsHost()) return;
      const islands = host.getIslands?.();
      const buildings = host.getConstructedBuildings?.();
      if (!islands || !buildings || !host.applySyncedWorldState) return;
      const result = reconcileWorldStateSnapshot(islands, buildings, payload);
      if (result.changed) {
        host.applySyncedWorldState(result.islands, result.constructedBuildings);
      }
    },
    onRemotePlayerSkillCast: (payload) => {
      if (!payload || payload.casterId === host.getPlayerId()) return;
      host.skillEffectsRenderer.playClassSkill({
        classId: payload.classId,
        casterX: payload.casterX,
        casterY: payload.casterY,
        facingDir: payload.facingDir,
        radius: payload.radius,
        targetX: payload.targetX,
        targetY: payload.targetY,
        targetPoints: payload.targetPoints,
      });
      const cls = PLAYER_CLASS_DEFINITIONS[payload.classId];
      if (cls) {
        host.effectsRenderer.showFloatingText(
          payload.casterX,
          payload.casterY - 58,
          `${cls.skillIcon} ${cls.skillName}!`,
          '#38bdf8'
        );
      }
    },
    onRemoteEntityHit: (entityId, damage) =>
      host.resourceEntityRenderer.handleRemoteHit(entityId, damage),
    onRemoteEntityRespawned: (entity) =>
      host.resourceEntityRenderer.applyRemoteEntityRespawn(entity),
    onRemoteIslandUnlocked: (islandId, unlockedBy, ownerId) =>
      host.unlockIslandLocally(islandId, unlockedBy, false, ownerId),
    onRemoteVillageUpgraded: (territoryId) => host.upgradeVillageRemotely(territoryId),
    onRemoteBuildingConstructed: host.onRemoteBuildingConstructed,
    onRemoteWaveSpawned: (isBossWave) => {
      sound.playBreak();
      GameEvents.emit('wave-spawned', {
        isBossWave,
        waveNumber: waveSystem.getWaveState().waveCount,
        kind: isBossWave ? 'boss' : 'regular',
        directionLabel: '외곽 영지 경계',
      });
    },
    onRemoteWaveSummonRequest: (isBossWave, isEarlySummon) =>
      waveSystem.handleRemoteWaveSummonRequest(isBossWave, isEarlySummon),
    onRemoteMonstersSync: (payload) => waveSystem.applyRemoteMonstersSync(payload),
    onRemoteMonstersDeltaSync: (payload) => waveSystem.applyRemoteMonstersDeltaSync(payload),
    onRemoteMonstersSyncRequest: () => {
      waveSystem.handleRemoteMonstersSyncRequest();
      monsterCampSystem.broadcastFullCampSync(false);
      if (waveSystem.getIsHost()) {
        const ws = waveSystem.getWaveState();
        sync.broadcastThreatSync({
          threatPercent: ws.threatPercent,
          waveCount: ws.waveCount,
          bossWaveCount: ws.bossWaveCount,
          countdownSecondsRemaining: ws.countdownSecondsRemaining,
          nextWaveIsBoss: ws.nextWaveIsBoss,
        });
        sync.broadcastDungeonPortalSync(waveSystem.getDungeonPortalState());
        broadcastAuthoritativeWorldSnapshot();
      }
    },
    onRemoteMonstersRepairRequest: (payload) => waveSystem.handleRemoteMonstersRepairRequest(payload),
    onRemoteMonsterHit: (payload) => {
      if (waveSystem.getIsHost()) {
        waveSystem.damageMonster(
          payload.monsterId,
          payload.damage,
          payload.attackerName,
          true,
          payload.attackerId,
          { isCrit: payload.isCrit, isSkill: payload.isSkill }
        );
      }
    },
    onRemoteMonsterPlayerAttack: (payload) => waveSystem.handleRemoteMonsterPlayerAttack(payload),
    onRemoteThreatAdded: (amount) => {
      if (waveSystem.getIsHost()) {
        waveSystem.addThreat(amount, false);
      }
    },
    onRemoteThreatSync: (payload) => waveSystem.applyRemoteThreatSync(payload),
    onRemoteDungeonPortalSync: (portal) => waveSystem.applyRemoteDungeonPortalSync(portal),
    onRemoteCampStructureHit: (payload) => campFortification.applyRemoteStructureHit(payload),
    onRemoteCampCoreHit: (payload) => monsterCampSystem.applyRemoteCampCoreHit(payload),
    onRemoteCampStructureHpSync: (payload) => campFortification.applyRemoteStructureHpSync(payload),
    onRemoteCampCoreSync: (payload) => monsterCampSystem.applyRemoteCampCoreSync(payload),
    onRemoteCampFullSync: (payload) => monsterCampSystem.applyRemoteCampFullSync(payload),
    onRemoteTerritoryLost: (territoryId, reason) =>
      coreGemSystem.loseTerritory(territoryId, reason, false),
    onRemoteBuildingHpSync: (buildingId, hp, maxHp, damageDelta) =>
      host.onRemoteBuildingHpSync?.(buildingId, hp, maxHp, damageDelta),
    onRemoteBuildingDestroyed: (buildingId) => host.onRemoteBuildingDestroyed?.(buildingId),
    onRemoteCoreHpSync: (territoryId, coreHp, coreMaxHp, damageDelta) =>
      coreGemSystem.applyRemoteCoreHpSync(territoryId, coreHp, coreMaxHp, damageDelta),
    onRemoteRepairTerritoryRequest: (territoryId) =>
      host.onRemoteRepairTerritoryRequest?.(territoryId),
    onRemoteWorldDefenseFailed: () => {
      host.onCoreDestroyed?.();
    },
  });

  return sync;
}
