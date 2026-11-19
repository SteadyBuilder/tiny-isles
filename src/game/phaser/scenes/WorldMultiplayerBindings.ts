import Phaser from 'phaser';
import { PLAYER_CLASS_DEFINITIONS } from '../../../data/classes';
import { HOST_SYNC_CONFIG } from '../../../data/worldRules';
import { sound } from '../../../lib/sound';
import { ConstructedBuilding, Island, PlayerAction, PlayerColor } from '../../../types/game';
import { MissionProgressSyncPayload } from '../../../types/monsterSync';
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
  isDropInJoin?: () => boolean;
  onApplyDropInCatchUp?: (elapsedSec: number) => void;
  getIslands?: () => Island[];
  getConstructedBuildings?: () => ConstructedBuilding[];
  getMissionSyncSnapshot?: () => Omit<MissionProgressSyncPayload, 'hostEpoch'>;
  applyRemoteMissionProgressSync?: (payload: MissionProgressSyncPayload) => void;
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
  upgradeVillageRemotely: (territoryId: number, targetTier?: import('../../../types/game').VillageTier) => void;
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
  let hasCompletedInitialGuestSync = false;
  let hasAppliedDropInCatchUp = false;
  let initialSyncBannerTimer: ReturnType<typeof setTimeout> | null = null;
  let sync!: MultiplayerSyncController;

  let lastWorldSnapshotBroadcastAt = 0;
  const sessionStartedAtMs = Date.now();
  const peerJoinTimes = new Map<string, number>();
  const peerLastCombatActivity = new Map<string, number>();
  let scalingRefreshTimer: ReturnType<typeof setInterval> | null = null;

  const markPeerCombatActive = (peerId?: string) => {
    if (!peerId) return;
    const now = Date.now();
    if (!peerJoinTimes.has(peerId)) {
      peerJoinTimes.set(peerId, now);
    }
    peerLastCombatActivity.set(peerId, now);
  };

  const applyEffectiveScalingCount = (rawOnlineCount: number) => {
    if (host.getRoomMode?.() !== 'coop' || !waveSystem.getIsHost()) {
      waveSystem.setOnlineCount(rawOnlineCount);
      monsterCampSystem.setOnlineCount(rawOnlineCount);
      fieldMonsterSystem.setOnlineCount(rawOnlineCount);
      return;
    }

    const now = Date.now();
    const localId = host.getPlayerId();
    const memberIds = Array.from(sync?.getKnownMemberIds() ?? [localId]);
    if (!memberIds.includes(localId)) {
      memberIds.push(localId);
    }

    let effectiveCount = 0;
    for (const id of memberIds) {
      if (id === localId) {
        effectiveCount += 1;
        continue;
      }
      const joinedAt = peerJoinTimes.get(id) ?? now;
      const lastActiveAt = peerLastCombatActivity.get(id) ?? joinedAt;
      const sinceJoin = now - joinedAt;
      const sinceActive = now - lastActiveAt;

      // 게임 시작 25초 이후에 새로 들어온 중도 난입자는 45초 유예 시간 동안 난이도 상승에서 제외
      const isMidGameDropIn = joinedAt - sessionStartedAtMs > 25_000;
      if (isMidGameDropIn && sinceJoin < 45_000) {
        continue;
      }
      // 75초 이상 아무 활동(이동/전투/채집)이 없는 잠수 유저는 난이도 스케일링에서 제외
      if (sinceActive > 75_000) {
        continue;
      }
      effectiveCount += 1;
    }

    const safeEffective = Math.max(1, Math.min(rawOnlineCount, effectiveCount));
    waveSystem.setOnlineCount(safeEffective);
    monsterCampSystem.setOnlineCount(safeEffective);
    fieldMonsterSystem.setOnlineCount(safeEffective);
  };

  if (host.getRoomMode?.() === 'coop') {
    scalingRefreshTimer = setInterval(() => {
      if (!host.scene || !host.scene.sys?.isActive()) {
        if (scalingRefreshTimer) {
          clearInterval(scalingRefreshTimer);
          scalingRefreshTimer = null;
        }
        return;
      }
      if (waveSystem.getIsHost() && sync) {
        applyEffectiveScalingCount(sync.getOnlineCount());
      }
    }, 5000);
  }

  const clearInitialSyncBanner = () => {
    if (initialSyncBannerTimer) {
      clearTimeout(initialSyncBannerTimer);
      initialSyncBannerTimer = null;
    }
    if (!hasCompletedInitialGuestSync) {
      hasCompletedInitialGuestSync = true;
      GameEvents.emit('coop-initial-sync-state', { syncing: false });
    }
  };

  const isCoopLobbyGuest =
    host.getRoomMode?.() === 'coop' &&
    (Boolean(host.isDropInJoin?.()) ||
      (Boolean(host.getPreferredHostId?.()) &&
        host.getPreferredHostId?.() !== host.getPlayerId()));

  if (isCoopLobbyGuest) {
    GameEvents.emit('coop-initial-sync-state', {
      syncing: true,
      message: '방장과 월드 및 몬스터 상태를 동기화하는 중...',
    });
    initialSyncBannerTimer = setTimeout(() => {
      clearInitialSyncBanner();
    }, HOST_SYNC_CONFIG.initialSyncBannerTimeoutMs);
  }

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

  const broadcastMissionSnapshot = () => {
    if (!waveSystem.getIsHost()) return;
    const snap = host.getMissionSyncSnapshot?.();
    if (snap) {
      sync.broadcastMissionProgressSync(snap);
    }
  };

  const broadcastFullRoomState = (force: boolean, targetPlayerId?: string) => {
    if (!waveSystem.getIsHost()) return;
    sync.broadcastHostWelcome(targetPlayerId);
    const ws = waveSystem.getWaveState();
    sync.broadcastThreatSync({
      threatPercent: ws.threatPercent,
      waveCount: ws.waveCount,
      bossWaveCount: ws.bossWaveCount,
      countdownSecondsRemaining: ws.countdownSecondsRemaining,
      nextWaveIsBoss: ws.nextWaveIsBoss,
    });
    sync.broadcastDungeonPortalSync(waveSystem.getDungeonPortalState());
    broadcastMissionSnapshot();
    broadcastAuthoritativeWorldSnapshot(force);
    waveSystem.broadcastFullMonstersSync(force, Boolean(targetPlayerId));
    monsterCampSystem.broadcastFullCampSync(force);
    sync.broadcastDomainSnapshot();
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
      const now = Date.now();
      for (const id of sync.getKnownMemberIds()) {
        if (!peerJoinTimes.has(id)) {
          peerJoinTimes.set(id, now);
          peerLastCombatActivity.set(id, now);
        }
      }
      applyEffectiveScalingCount(count);
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
        clearInitialSyncBanner();
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
    onRemoteJoinHello: (payload) => {
      // 게스트가 입장 즉시 보낸 출석(join_hello)을 호스트가 수신하면 Presence 완료 전이라도 즉시 환영 + 전체 상태 송출
      markPeerCombatActive(payload.playerId);
      if (!waveSystem.getIsHost()) return;
      broadcastFullRoomState(false, payload.playerId);
    },
    onRemoteHostWelcome: () => {
      if (waveSystem.getIsHost()) return;
      fieldMonsterSystem.resetForGuest();
      monsterCampSystem.resetGuestGarrisonState();
    },
    onRemoteWorldStateSync: (payload) => {
      if (waveSystem.getIsHost()) return;
      clearInitialSyncBanner();
      const islands = host.getIslands?.();
      const buildings = host.getConstructedBuildings?.();
      if (!islands || !buildings || !host.applySyncedWorldState) return;
      const result = reconcileWorldStateSnapshot(islands, buildings, payload);
      if (result.changed) {
        host.applySyncedWorldState(result.islands, result.constructedBuildings);
      }
    },
    onRemoteMissionProgressSync: (payload) => {
      if (waveSystem.getIsHost()) return;
      host.applyRemoteMissionProgressSync?.(payload);
      if (!hasAppliedDropInCatchUp && typeof payload.elapsedSec === 'number') {
        hasAppliedDropInCatchUp = true;
        if (payload.elapsedSec >= 60) {
          host.onApplyDropInCatchUp?.(payload.elapsedSec);
        }
      }
    },
    onRemotePlayerSkillCast: (payload) => {
      if (!payload || payload.casterId === host.getPlayerId()) return;
      markPeerCombatActive(payload.casterId);
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
    onRemoteIslandUnlocked: (islandId, unlockedBy, ownerId) => {
      markPeerCombatActive(ownerId);
      host.unlockIslandLocally(islandId, unlockedBy, false, ownerId);
    },
    onRemoteVillageUpgraded: (territoryId, targetTier) =>
      host.upgradeVillageRemotely(territoryId, targetTier),
    onRemotePlayerActive: (peerId) => markPeerCombatActive(peerId),
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
    onRemoteMonstersSync: (payload) => {
      clearInitialSyncBanner();
      waveSystem.applyRemoteMonstersSync(payload);
    },
    onRemoteMonstersDeltaSync: (payload) => {
      clearInitialSyncBanner();
      waveSystem.applyRemoteMonstersDeltaSync(payload);
    },
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
        broadcastMissionSnapshot();
        broadcastAuthoritativeWorldSnapshot();
      }
    },
    onRemoteMonstersRepairRequest: (payload) => waveSystem.handleRemoteMonstersRepairRequest(payload),
    onRemoteMonsterHit: (payload) => {
      markPeerCombatActive(payload.attackerId);
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
    onRemoteCampStructureHit: (payload) => {
      markPeerCombatActive(payload.attackerId);
      campFortification.applyRemoteStructureHit(payload);
    },
    onRemoteCampCoreHit: (payload) => {
      markPeerCombatActive(payload.attackerId);
      monsterCampSystem.applyRemoteCampCoreHit(payload);
    },
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

