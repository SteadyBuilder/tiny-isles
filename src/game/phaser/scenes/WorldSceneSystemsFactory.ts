import Phaser from 'phaser';
import { rollMonsterDropItem } from '../../../data/items';
import { THREAT_WAVE_CONFIG } from '../../../data/worldRules';
import { sound } from '../../../lib/sound';
import {
  ConstructedBuilding,
  Inventory,
  Island,
  PlayerAction,
  PlayerClassId,
  PlayerColor,
} from '../../../types/game';
import { MissionDifficultyConfig, RoomMode } from '../../../types/room';
import { GameEvents } from '../../events/gameEvents';
import { CoreGemSystem } from '../../systems/CoreGemSystem';
import { GarrisonSystem } from '../../systems/GarrisonSystem';
import { MonsterCampSystem } from '../../systems/MonsterCampSystem';
import { PlayerHealthSystem } from '../../systems/PlayerHealthSystem';
import { PlayerProgressionSystem } from '../../systems/PlayerProgressionSystem';
import { ProjectileSystem } from '../../systems/ProjectileSystem';
import { TowerDefenseSystem } from '../../systems/TowerDefenseSystem';
import { WaveSystem } from '../../systems/WaveSystem';
import { checkJobHallProximity } from '../../utils/jobHallUtils';
import { MultiplayerSyncController } from '../controllers/MultiplayerSyncController';
import { ConstructedBuildingRenderer } from '../renderers/ConstructedBuildingRenderer';
import { LootChestDropRenderer } from '../renderers/LootChestDropRenderer';
import { PlayerCelebrationEffects } from '../renderers/PlayerCelebrationEffects';
import { ResourceEntityRenderer } from '../renderers/ResourceEntityRenderer';
import { TerritoryStructureRenderer } from '../renderers/TerritoryStructureRenderer';
import { WorldEffectsRenderer } from '../renderers/WorldEffectsRenderer';

export interface IWorldSystemsHost {
  scene: Phaser.Scene;
  isSceneAlive: () => boolean;
  isHuntingMode: () => boolean;
  getDifficultyConfig?: () => MissionDifficultyConfig;
  getPlayerId: () => string;
  getPlayerName: () => string;
  getPlayerColor: () => PlayerColor;
  getRoomId?: () => string;
  getRoomMode?: () => RoomMode;
  onCoreDestroyed?: () => void;
  getPlayerPosition: () => { x: number; y: number };
  respawnPlayerAt: (x: number, y: number) => void;
  onPlayerFaintedVisual: (fainted: boolean) => void;
  onPlayerHitVisual: () => void;
  onPlayerClassVisualChanged?: (classId: PlayerClassId) => void;
  getLocalPlayerState: () => {
    x: number;
    y: number;
    direction: 'left' | 'right';
    action: PlayerAction;
  };
  getCurrentTerritoryId: () => number;
  getIslands: () => Island[];
  getConstructedBuildings: () => ConstructedBuilding[];
  getInventory: () => Inventory;
  spendResources: (wood: number, stone: number, gold: number) => void;
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
  lootChestRenderer: LootChestDropRenderer;
  celebrationEffects: PlayerCelebrationEffects;
  territoryStructureRenderer: TerritoryStructureRenderer;
  constructedBuildingRenderer: ConstructedBuildingRenderer;
  resourceEntityRenderer: ResourceEntityRenderer;
}

export interface WorldSystemsBundle {
  coreGemSystem: CoreGemSystem;
  playerHealthSystem: PlayerHealthSystem;
  projectileSystem: ProjectileSystem;
  playerProgressionSystem: PlayerProgressionSystem;
  monsterCampSystem: MonsterCampSystem;
  waveSystem: WaveSystem;
  towerDefenseSystem: TowerDefenseSystem;
  garrisonSystem: GarrisonSystem;
  multiplayerSync: MultiplayerSyncController;
}

/**
 * CoreGem, PlayerHealth, Projectile, PlayerProgression, MonsterCamp, Wave, TowerDefense, Garrison, MultiplayerSync 팩토리
 */
export function createWorldSystemsBundle(host: IWorldSystemsHost): WorldSystemsBundle {
  let multiplayerSync!: MultiplayerSyncController;
  let monsterCampSystem!: MonsterCampSystem;
  let playerProgressionSystem!: PlayerProgressionSystem;

  const projectileSystem = new ProjectileSystem(host.scene);

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
    broadcastWorldDefenseFailed: (resetAt, attackerName) =>
      multiplayerSync?.broadcastWorldDefenseFailed(resetAt, attackerName),
    onDefenseFailedReset: () => host.onCoreDestroyed?.(),
  });

  const waveSystem = new WaveSystem(
    {
      scene: host.scene,
      isHuntingMode: host.isHuntingMode,
      getDifficultyConfig: host.getDifficultyConfig,
      projectileSystem,
      healCampCore: (territoryId, amount) => monsterCampSystem?.healCampCore(territoryId, amount),
      onMonsterKilledReward: (x, y, isBoss, expReward, isCampMonster, meta) => {
        playerProgressionSystem?.gainExp(expReward);
        // 사냥 특화 모드에서는 몬스터 웨이브(던전 침공) 처치 시 위협도 미증가, 부락 주둔 마물만 증가
        if (isCampMonster || !host.isHuntingMode()) {
          waveSystem.addThreat(THREAT_WAVE_CONFIG.huntThreatGain, true);
          host.effectsRenderer.emitThreatOrbFromWorld(x, y, THREAT_WAVE_CONFIG.huntThreatGain);
        }
        // 사냥 특화 모드: 일반·정예·보스 처치 시 디아블로식 필드 장비 드랍
        if (host.isHuntingMode()) {
          const difficultyId = host.getDifficultyConfig?.().id ?? 'normal';
          const dropItem = rollMonsterDropItem({
            ring: meta?.campRing ?? 2,
            isElite: Boolean(meta?.isElite),
            isBoss,
            difficultyId,
          });
          if (dropItem) {
            host.lootChestRenderer.playDropAnimation({
              x,
              y,
              item: dropItem,
              onOpened: (openedItem) => {
                playerProgressionSystem?.grantRewardItem(openedItem);
                GameEvents.emit(
                  'game-alert',
                  `💎 전리품 드랍! [${openedItem.icon}${openedItem.name}] 획득!`
                );
              },
            });
          }
        }
      },
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
    },
    coreGemSystem
  );

  playerProgressionSystem = new PlayerProgressionSystem({
    scene: host.scene,
    getPlayerId: host.getPlayerId,
    getPlayerName: host.getPlayerName,
    getPlayerPosition: host.getPlayerPosition,
    getGold: () => host.getInventory().gold,
    spendGold: (amount) => host.spendResources(0, 0, amount),
    addGold: (amount) => host.addResources(0, 0, amount),
    onMaxHpChanged: (newMaxHp, healDelta) => playerHealthSystem.setMaxHp(newMaxHp, healDelta),
    healPlayer: (amount) => playerHealthSystem.healPlayer(amount),
    onClassChangedVisual: (classId) => host.onPlayerClassVisualChanged?.(classId),
    getMonsterVisuals: () => waveSystem.getMonsterVisuals(),
    damageMonster: (id, dmg, attacker, attackerId) =>
      waveSystem.damageMonster(id, dmg, attacker, false, attackerId),
    tryDamageCampCoreInRadius: (x, y, r, dmg) =>
      monsterCampSystem?.damageCampCoresInRadius(x, y, r, dmg),
    projectileSystem,
    showFloatingText: (x, y, text, color) => host.effectsRenderer.showFloatingText(x, y, text, color),
    playExplosionAt: (x, y) => host.effectsRenderer.playExplosionAt(x, y),
    getJobHallStatus: () => {
      const pos = host.getPlayerPosition();
      const status = checkJobHallProximity(pos.x, pos.y, host.getConstructedBuildings());
      return { hasBuilt: status.hasBuilt, isNear: status.isNear };
    },
    playLevelUpEffect: (x, y, level, delayMs) =>
      host.celebrationEffects.playLevelUpEffect(x, y, level, delayMs),
    playClassAdvancementEffect: (x, y, classId) =>
      host.celebrationEffects.playClassAdvancementEffect(x, y, classId),
  });

  monsterCampSystem = new MonsterCampSystem({
    scene: host.scene,
    isHuntingMode: host.isHuntingMode,
    getDifficultyConfig: host.getDifficultyConfig,
    getIslands: host.getIslands,
    getMonsters: () => waveSystem.getMonsterVisuals(),
    addResources: host.addResources,
    addThreat: (amount) => waveSystem.addThreat(amount, true),
    gainExp: (exp) => playerProgressionSystem.gainExp(exp),
    grantRewardItem: (item) => playerProgressionSystem.grantRewardItem(item),
    playChestDropAt: (x, y, item, onOpened) =>
      host.lootChestRenderer.playDropAnimation({ x, y, item, onOpened }),
    onCampCoreDamaged: (territoryId) =>
      waveSystem.aggroCampMonsters(territoryId, host.getPlayerId()),
    playExplosionAt: (x, y) => host.effectsRenderer.playExplosionAt(x, y),
    shakeObject: (target) => host.effectsRenderer.shakeObject(target),
    showFloatingText: (x, y, text, color) => host.effectsRenderer.showFloatingText(x, y, text, color),
    emitTerritoriesUpdated: () => {
      host.refreshTerritoryDecorations();
      host.emitWorldStateToReact(true);
    },
  });

  const towerDefenseSystem = new TowerDefenseSystem(
    {
      scene: host.scene,
      getConstructedBuildings: host.getConstructedBuildings,
      getConstructedVisuals: () => host.constructedBuildingRenderer.getVisuals(),
      showFloatingText: (x, y, text, color) => host.effectsRenderer.showFloatingText(x, y, text, color),
      playExplosionAt: (x, y) => host.effectsRenderer.playExplosionAt(x, y),
      projectileSystem,
    },
    waveSystem
  );

  const garrisonSystem = new GarrisonSystem({ scene: host.scene }, waveSystem);

  multiplayerSync = new MultiplayerSyncController({
    scene: host.scene,
    getPlayerId: host.getPlayerId,
    getPlayerName: host.getPlayerName,
    getPlayerColor: host.getPlayerColor,
    getRoomId: host.getRoomId,
    getRoomMode: host.getRoomMode,
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
    onRemoteWorldDefenseFailed: () => {
      host.onCoreDestroyed?.();
    },
  });
  multiplayerSync.setup();

  return {
    coreGemSystem,
    playerHealthSystem,
    projectileSystem,
    playerProgressionSystem,
    monsterCampSystem,
    waveSystem,
    towerDefenseSystem,
    garrisonSystem,
    multiplayerSync,
  };
}
