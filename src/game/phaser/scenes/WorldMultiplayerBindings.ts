import Phaser from 'phaser';
import { sound } from '../../../lib/sound';
import { ConstructedBuilding, PlayerAction, PlayerColor } from '../../../types/game';
import { RoomMode } from '../../../types/room';
import { GameEvents } from '../../events/gameEvents';
import { CampFortificationSystem } from '../../systems/CampFortificationSystem';
import { CoreGemSystem } from '../../systems/CoreGemSystem';
import { FieldMonsterSystem } from '../../systems/FieldMonsterSystem';
import { MonsterCampSystem } from '../../systems/MonsterCampSystem';
import { PlayerHealthSystem } from '../../systems/PlayerHealthSystem';
import { WaveSystem } from '../../systems/WaveSystem';
import { MultiplayerSyncController } from '../controllers/MultiplayerSyncController';
import { ResourceEntityRenderer } from '../renderers/ResourceEntityRenderer';

export interface IWorldMultiplayerHost {
  scene: Phaser.Scene;
  getPlayerId: () => string;
  getPlayerName: () => string;
  getPlayerColor: () => PlayerColor;
  getRoomId?: () => string;
  getRoomMode?: () => RoomMode;
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

  let sync!: MultiplayerSyncController;
  sync = new MultiplayerSyncController({
    scene: host.scene,
    getPlayerId: host.getPlayerId,
    getPlayerName: host.getPlayerName,
    getPlayerColor: host.getPlayerColor,
    getRoomId: host.getRoomId,
    getRoomMode: host.getRoomMode,
    isLocalPlayerFainted: () => playerHealthSystem.isFainted(),
    getLocalPlayerState: host.getLocalPlayerState,
    onOnlineCountChanged: (count, hasNewPeer) => {
      waveSystem.setOnlineCount(count);
      monsterCampSystem.setOnlineCount(count);
      fieldMonsterSystem.setOnlineCount(count);
      if (waveSystem.getIsHost() && hasNewPeer) {
        const ws = waveSystem.getWaveState();
        sync.broadcastThreatSync({
          threatPercent: ws.threatPercent,
          waveCount: ws.waveCount,
          bossWaveCount: ws.bossWaveCount,
          countdownSecondsRemaining: ws.countdownSecondsRemaining,
          nextWaveIsBoss: ws.nextWaveIsBoss,
        });
        sync.broadcastDungeonPortalSync(waveSystem.getDungeonPortalState());
        if (count > 1) {
          waveSystem.broadcastFullMonstersSync(true);
          monsterCampSystem.broadcastFullCampSync(true);
        }
      }
    },
    onHostStatusChanged: (isHost) => {
      waveSystem.setHostMode(isHost);
      if (isHost) {
        monsterCampSystem.ensureHostGarrisonsSpawned();
        fieldMonsterSystem.ensureHostInitialized();
      } else {
        fieldMonsterSystem.resetForGuest();
        monsterCampSystem.resetGuestGarrisonState();
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
      GameEvents.emit(
        'game-alert',
        isBossWave
          ? '👹 외곽 영지에서 보스 군단 침공이 시작되었습니다!'
          : '🧟 외곽 영지 경계에서 마물 웨이브가 진입했습니다!'
      );
    },
    onRemoteWaveSummonRequest: (isBossWave, isEarlySummon) =>
      waveSystem.handleRemoteWaveSummonRequest(isBossWave, isEarlySummon),
    onRemoteMonstersSync: (payload) => waveSystem.applyRemoteMonstersSync(payload),
    onRemoteMonstersDeltaSync: (payload) => waveSystem.applyRemoteMonstersDeltaSync(payload),
    onRemoteMonstersSyncRequest: () => {
      waveSystem.handleRemoteMonstersSyncRequest();
      monsterCampSystem.broadcastFullCampSync(false);
    },
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
