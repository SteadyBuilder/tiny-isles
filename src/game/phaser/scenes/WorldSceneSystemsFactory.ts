import Phaser from 'phaser';
import { sound } from '../../../lib/sound';
import {
  ConstructedBuilding,
  Island,
  PlayerAction,
  PlayerColor,
} from '../../../types/game';
import { GameEvents } from '../../events/gameEvents';
import { CoreGemSystem } from '../../systems/CoreGemSystem';
import { GarrisonSystem } from '../../systems/GarrisonSystem';
import { LivingWorldCoordinator } from '../../systems/LivingWorldCoordinator';
import { PlayerHealthSystem } from '../../systems/PlayerHealthSystem';
import { TowerDefenseSystem } from '../../systems/TowerDefenseSystem';
import { WaveSystem } from '../../systems/WaveSystem';
import { MultiplayerSyncController } from '../controllers/MultiplayerSyncController';
import { ConstructedBuildingRenderer } from '../renderers/ConstructedBuildingRenderer';
import { ResourceEntityRenderer } from '../renderers/ResourceEntityRenderer';
import { TerritoryStructureRenderer } from '../renderers/TerritoryStructureRenderer';
import { WorldEffectsRenderer } from '../renderers/WorldEffectsRenderer';

export interface IWorldSystemsHost {
  scene: Phaser.Scene;
  isSceneAlive: () => boolean;
  getPlayerId: () => string;
  getPlayerName: () => string;
  getPlayerColor: () => PlayerColor;
  getPlayerPosition: () => { x: number; y: number };
  respawnPlayerAt: (x: number, y: number) => void;
  applyRestoredPlayerPosition?: (x: number, y: number) => void;
  onPlayerFaintedVisual: (fainted: boolean) => void;
  onPlayerHitVisual: () => void;
  getLocalPlayerState: () => {
    x: number;
    y: number;
    direction: 'left' | 'right';
    action: PlayerAction;
  };
  getCurrentTerritoryId: () => number;
  getIslands: () => Island[];
  getConstructedBuildings: () => ConstructedBuilding[];
  applySyncedWorldState: (
    updatedIslands: Island[],
    updatedBuildings: ConstructedBuilding[]
  ) => void;
  addResources: (wood: number, stone: number, gold: number) => void;
  destroyConstructedBuilding: (buildingId: string) => void;
  refreshTerritoryDecorations: () => void;
  saveWorldState: (immediate?: boolean) => void;
  emitWorldStateToReact: (immediate?: boolean) => void;
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
  effectsRenderer: WorldEffectsRenderer;
  territoryStructureRenderer: TerritoryStructureRenderer;
  constructedBuildingRenderer: ConstructedBuildingRenderer;
  resourceEntityRenderer: ResourceEntityRenderer;
}

export interface WorldSystemsBundle {
  coreGemSystem: CoreGemSystem;
  playerHealthSystem: PlayerHealthSystem;
  waveSystem: WaveSystem;
  towerDefenseSystem: TowerDefenseSystem;
  garrisonSystem: GarrisonSystem;
  livingWorldCoordinator: LivingWorldCoordinator;
  multiplayerSync: MultiplayerSyncController;
}

/**
 * CoreGem, PlayerHealth, Wave, TowerDefense, Garrison, LivingWorld, MultiplayerSync 인스턴스를 생성/배선하는 팩토리
 */
export function createWorldSystemsBundle(host: IWorldSystemsHost): WorldSystemsBundle {
  let multiplayerSync!: MultiplayerSyncController;
  let livingWorldCoordinator!: LivingWorldCoordinator;

  const playerHealthSystem = new PlayerHealthSystem({
    scene: host.scene,
    isSceneAlive: host.isSceneAlive,
    getPlayerPosition: host.getPlayerPosition,
    respawnPlayerAt: host.respawnPlayerAt,
    onPlayerFaintedVisual: host.onPlayerFaintedVisual,
    onPlayerHitVisual: host.onPlayerHitVisual,
    showFloatingText: (x, y, text, color) => host.effectsRenderer.showFloatingText(x, y, text, color),
  });

  const coreGemSystem = new CoreGemSystem({
    getIslands: host.getIslands,
    getConstructedBuildings: host.getConstructedBuildings,
    removeConstructedBuilding: host.destroyConstructedBuilding,
    removeEntityVisualsForIsland: (islandId: number) =>
      host.resourceEntityRenderer.removeForIsland(islandId),
    showFloatingText: (x, y, text, color) => host.effectsRenderer.showFloatingText(x, y, text, color),
    shakeObject: (target) => host.effectsRenderer.shakeObject(target),
    playExplosionAt: (x, y) => host.effectsRenderer.playExplosionAt(x, y),
    saveWorldState: (immediate = false) => host.saveWorldState(immediate),
    emitWorldState: (immediate = false) => host.emitWorldStateToReact(immediate),
    refreshTerritoryDecorations: host.refreshTerritoryDecorations,
    broadcastTerritoryLost: (territoryId: number) =>
      multiplayerSync?.broadcastTerritoryLost(territoryId),
    broadcastCoreHpSync: (territoryId, coreHp, coreMaxHp, damageDelta) =>
      multiplayerSync?.broadcastCoreHpSync(territoryId, coreHp, coreMaxHp, damageDelta),
  });

  const waveSystem = new WaveSystem(
    {
      scene: host.scene,
      getIslands: host.getIslands,
      getConstructedBuildings: host.getConstructedBuildings,
      destroyConstructedBuilding: host.destroyConstructedBuilding,
      updateConstructedBuildingHpBar: (buildingId: string) =>
        host.constructedBuildingRenderer.updateHpBar(buildingId),
      onBuildingDamaged: (buildingId, hp, maxHp, damageDelta) => {
        multiplayerSync?.broadcastBuildingHpSync(buildingId, hp, maxHp, damageDelta);
        host.saveWorldState(false);
        host.emitWorldStateToReact(false);
      },
      getConstructedVisualContainer: (buildingId: string) =>
        host.constructedBuildingRenderer.getContainer(buildingId),
      getLocalPlayerId: host.getPlayerId,
      getLocalPlayerPosition: host.getPlayerPosition,
      isLocalPlayerFainted: () => playerHealthSystem.isFainted(),
      damageLocalPlayer: (dmg, attacker) => playerHealthSystem.damagePlayer(dmg, attacker),
      showFloatingText: (x, y, text, color) => host.effectsRenderer.showFloatingText(x, y, text, color),
      shakeObject: (target) => host.effectsRenderer.shakeObject(target),
      playExplosionAt: (x, y) => host.effectsRenderer.playExplosionAt(x, y),
      addRewardResources: host.addResources,
      broadcastWaveSpawn: (isBossWave) => multiplayerSync?.broadcastWaveSpawn(isBossWave),
      broadcastWaveSummonRequest: (isBossWave, isEarlySummon) =>
        multiplayerSync?.broadcastWaveSummonRequest(isBossWave, isEarlySummon),
      broadcastMonstersSync: (monsters, waveCount, bossWaveCount) =>
        multiplayerSync?.broadcastMonstersSync(monsters, waveCount, bossWaveCount),
      broadcastMonsterHit: (monsterId, damage, attackerName) =>
        multiplayerSync?.broadcastMonsterHit(monsterId, damage, attackerName),
      broadcastThreatAdded: (amount) => multiplayerSync?.broadcastThreatAdded(amount),
      broadcastThreatSync: (threatPercent, waveCount, bossWaveCount) =>
        multiplayerSync?.broadcastThreatSync(threatPercent, waveCount, bossWaveCount),
      emitThreatOrb: (worldX, worldY, amount) =>
        host.effectsRenderer.emitThreatOrbFromWorld(worldX, worldY, amount),
      onMonstersChanged: () => livingWorldCoordinator?.requestImmediateSnapshot(),
    },
    coreGemSystem
  );

  const towerDefenseSystem = new TowerDefenseSystem(
    {
      scene: host.scene,
      getConstructedBuildings: host.getConstructedBuildings,
      getConstructedVisuals: () => host.constructedBuildingRenderer.getVisuals(),
      showFloatingText: (x, y, text, color) => host.effectsRenderer.showFloatingText(x, y, text, color),
      playExplosionAt: (x, y) => host.effectsRenderer.playExplosionAt(x, y),
    },
    waveSystem
  );

  const garrisonSystem = new GarrisonSystem({ scene: host.scene }, waveSystem);

  livingWorldCoordinator = new LivingWorldCoordinator(
    {
      getPlayerId: host.getPlayerId,
      getPlayerName: host.getPlayerName,
      getPlayerColor: host.getPlayerColor,
      getPlayerPosition: host.getPlayerPosition,
      getCurrentTerritoryId: host.getCurrentTerritoryId,
      getIslands: host.getIslands,
      getConstructedBuildings: host.getConstructedBuildings,
      applySyncedWorldState: host.applySyncedWorldState,
      applyRestoredPlayerPosition: host.applyRestoredPlayerPosition,
    },
    waveSystem,
    garrisonSystem
  );

  multiplayerSync = new MultiplayerSyncController({
    scene: host.scene,
    getPlayerId: host.getPlayerId,
    getPlayerName: host.getPlayerName,
    getPlayerColor: host.getPlayerColor,
    getLocalPlayerState: host.getLocalPlayerState,
    onOnlineCountChanged: (count) => {
      waveSystem.setOnlineCount(count);
      if (waveSystem.getIsHost()) {
        const ws = waveSystem.getWaveState();
        multiplayerSync?.broadcastThreatSync(ws.threatPercent, ws.waveCount, ws.bossWaveCount);
      }
    },
    onHostStatusChanged: (isHost) => {
      waveSystem.setHostMode(isHost);
      if (isHost) {
        livingWorldCoordinator?.requestImmediateSnapshot();
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
    onRemoteMonstersSync: (monsters, waveCount, bossWaveCount) =>
      waveSystem.applyRemoteMonstersSync(monsters, waveCount, bossWaveCount),
    onRemoteMonsterHit: (monsterId, damage, attackerName) => {
      if (waveSystem.getIsHost()) {
        waveSystem.damageMonster(monsterId, damage, attackerName, true);
      }
    },
    onRemoteThreatAdded: (amount) => {
      if (waveSystem.getIsHost()) {
        waveSystem.addThreat(amount, false);
      }
    },
    onRemoteThreatSync: (threatPercent, waveCount, bossWaveCount) =>
      waveSystem.applyRemoteThreatSync(threatPercent, waveCount, bossWaveCount),
    onRemoteTerritoryLost: (territoryId, reason) =>
      coreGemSystem.loseTerritory(territoryId, reason, false),
    onRemoteBuildingHpSync: (buildingId, hp, maxHp, damageDelta) =>
      host.onRemoteBuildingHpSync?.(buildingId, hp, maxHp, damageDelta),
    onRemoteBuildingDestroyed: (buildingId) => host.onRemoteBuildingDestroyed?.(buildingId),
    onRemoteCoreHpSync: (territoryId, coreHp, coreMaxHp, damageDelta) =>
      coreGemSystem.applyRemoteCoreHpSync(territoryId, coreHp, coreMaxHp, damageDelta),
    onRemoteRepairTerritoryRequest: (territoryId) =>
      host.onRemoteRepairTerritoryRequest?.(territoryId),
  });
  multiplayerSync.setup();

  return {
    coreGemSystem,
    playerHealthSystem,
    waveSystem,
    towerDefenseSystem,
    garrisonSystem,
    livingWorldCoordinator,
    multiplayerSync,
  };
}
