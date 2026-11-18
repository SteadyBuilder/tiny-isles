import Phaser from 'phaser';
import { SKILL_FX_STYLE_CONFIG } from '../../../data/combatFeedbackConfig';
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
import { CampFortificationSystem } from '../../systems/CampFortificationSystem';
import { CoreGemSystem } from '../../systems/CoreGemSystem';
import { FieldMonsterSystem } from '../../systems/FieldMonsterSystem';
import { GarrisonSystem } from '../../systems/GarrisonSystem';
import { MonsterCampSystem } from '../../systems/MonsterCampSystem';
import {
  MonsterRewardContext,
  distributeHostMonsterKillReward,
  distributeRemoteMonsterKillReward,
} from '../../systems/MonsterRewardDistributor';
import { PlayerHealthSystem } from '../../systems/PlayerHealthSystem';
import { PlayerProgressionSystem } from '../../systems/PlayerProgressionSystem';
import { ProjectileSystem } from '../../systems/ProjectileSystem';
import { TowerDefenseSystem } from '../../systems/TowerDefenseSystem';
import { WaveSystem } from '../../systems/WaveSystem';
import { checkJobHallProximity } from '../../utils/jobHallUtils';
import { checkToolShopProximity } from '../../utils/toolShopUtils';
import { WorldTerrainMap } from '../../world/MapTerrainGenerator';
import { MultiplayerSyncController } from '../controllers/MultiplayerSyncController';
import { CombatFeedbackRenderer } from '../renderers/CombatFeedbackRenderer';
import { ConstructedBuildingRenderer } from '../renderers/ConstructedBuildingRenderer';
import { LootChestDropRenderer } from '../renderers/LootChestDropRenderer';
import { PlayerCelebrationEffects } from '../renderers/PlayerCelebrationEffects';
import { ResourceEntityRenderer } from '../renderers/ResourceEntityRenderer';
import { SkillEffectsRenderer } from '../renderers/SkillEffectsRenderer';
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
  getPlayerDirection?: () => 'left' | 'right';
  triggerSkillSurge?: (dirX: number, dirY: number, speedPx: number, durationMs: number) => void;
  respawnPlayerAt: (x: number, y: number) => void;
  onPlayerFaintedVisual: (fainted: boolean) => void;
  onPlayerHitVisual: () => void;
  onPlayerCastVisual?: (durationMs?: number) => void;
  onPlayerClassVisualChanged?: (classId: PlayerClassId) => void;
  getLocalPlayerState: () => {
    x: number;
    y: number;
    direction: 'left' | 'right';
    action: PlayerAction;
  };
  getCurrentTerritoryId: () => number;
  getIslands: () => Island[];
  getTerrainMap: () => WorldTerrainMap;
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
  combatFeedbackRenderer: CombatFeedbackRenderer;
  skillEffectsRenderer: SkillEffectsRenderer;
  lootChestRenderer: LootChestDropRenderer;
  celebrationEffects: PlayerCelebrationEffects;
  territoryStructureRenderer: TerritoryStructureRenderer;
  constructedBuildingRenderer: ConstructedBuildingRenderer;
  resourceEntityRenderer: ResourceEntityRenderer;
  wallColliders?: Phaser.Physics.Arcade.StaticGroup;
}

export interface WorldSystemsBundle {
  coreGemSystem: CoreGemSystem;
  playerHealthSystem: PlayerHealthSystem;
  projectileSystem: ProjectileSystem;
  playerProgressionSystem: PlayerProgressionSystem;
  monsterCampSystem: MonsterCampSystem;
  fieldMonsterSystem: FieldMonsterSystem;
  waveSystem: WaveSystem;
  towerDefenseSystem: TowerDefenseSystem;
  garrisonSystem: GarrisonSystem;
  multiplayerSync: MultiplayerSyncController;
}

/**
 * CoreGem, PlayerHealth, Projectile, PlayerProgression, MonsterCamp, FieldMonster, Wave, TowerDefense, Garrison, MultiplayerSync 팩토리
 */
export function createWorldSystemsBundle(host: IWorldSystemsHost): WorldSystemsBundle {
  let multiplayerSync!: MultiplayerSyncController;
  let monsterCampSystem!: MonsterCampSystem;
  let fieldMonsterSystem!: FieldMonsterSystem;
  let playerProgressionSystem!: PlayerProgressionSystem;

  const projectileSystem = new ProjectileSystem(host.scene);

  let waveSystem!: WaveSystem;

  const playerHealthSystem = new PlayerHealthSystem({
    scene: host.scene,
    isSceneAlive: host.isSceneAlive,
    getPlayerPosition: host.getPlayerPosition,
    respawnPlayerAt: host.respawnPlayerAt,
    onPlayerFaintedVisual: host.onPlayerFaintedVisual,
    onPlayerHitVisual: host.onPlayerHitVisual,
    onPlayerDamagedShake: () => host.combatFeedbackRenderer.triggerPlayerDamagedShake(),
    onPlayerHealed: (px, py) => host.effectsRenderer.playHealEffectAt(px, py),
    getDamageReductionPercent: () => playerProgressionSystem?.getDamageReductionPercent() ?? 0,
    onThornsReflect: (px, py) => {
      const thorns = playerProgressionSystem?.getThornsDamage() ?? 0;
      if (thorns <= 0 || !waveSystem) return;
      for (const mv of waveSystem.getMonsterVisuals().values()) {
        if (Math.hypot(mv.monster.x - px, mv.monster.y - py) <= 115) {
          waveSystem.damageMonster(
            mv.monster.id,
            thorns,
            `${host.getPlayerName()} (가시반사)`,
            false,
            host.getPlayerId()
          );
          host.effectsRenderer.showFloatingText(
            mv.monster.x,
            mv.monster.y - 30,
            `🛡️ 반사 -${thorns}`,
            '#34d399'
          );
          break;
        }
      }
    },
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

  const rewardContext: MonsterRewardContext = {
    isHuntingMode: host.isHuntingMode,
    getDifficultyId: () => host.getDifficultyConfig?.().id ?? 'normal',
    getLocalPlayerId: host.getPlayerId,
    getLocalPlayerPosition: host.getPlayerPosition,
    addThreat: (amount) => waveSystem.addThreat(amount, true),
    emitThreatOrb: (worldX, worldY, amount) =>
      host.effectsRenderer.emitThreatOrbFromWorld(worldX, worldY, amount),
    addResources: host.addResources,
    gainExp: (exp) => playerProgressionSystem?.gainExp(exp),
    grantRewardItem: (item) => playerProgressionSystem?.grantRewardItem(item),
    grantPotion: (potionId, count) => playerProgressionSystem?.grantPotion(potionId, count) ?? 0,
    playChestDrop: (x, y, item, onOpened) =>
      host.lootChestRenderer.playDropAnimation({ x, y, item, onOpened }),
    playLootIconDrop: (x, y, textureKey, glowColorHex) =>
      host.lootChestRenderer.playLootIconDrop({ x, y, textureKey, glowColorHex }),
    showFloatingText: (x, y, text, color) => host.effectsRenderer.showFloatingText(x, y, text, color),
  };

  waveSystem = new WaveSystem(
    {
      scene: host.scene,
      initialIsHost: host.getRoomMode?.() !== 'coop',
      isHuntingMode: host.isHuntingMode,
      getDifficultyConfig: host.getDifficultyConfig,
      projectileSystem,
      healCampCore: (territoryId, amount) => monsterCampSystem?.healCampCore(territoryId, amount),
      onMonsterHitImpact: (opts, restoreTint) =>
        host.combatFeedbackRenderer.playHitImpact(opts, restoreTint),
      onMonsterKilledReward: (x, y, isBoss, expReward, isCampMonster, meta) =>
        distributeHostMonsterKillReward(
          rewardContext,
          x,
          y,
          isBoss,
          expReward,
          isCampMonster,
          meta
        ),
      onRemoteMonsterKilledReward: (kill) =>
        distributeRemoteMonsterKillReward(rewardContext, kill),
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
      getActivePlayers: () =>
        multiplayerSync?.getActivePlayers(
          host.getPlayerPosition(),
          playerHealthSystem.isFainted()
        ) ?? [
          {
            id: host.getPlayerId(),
            ...host.getPlayerPosition(),
            isFainted: playerHealthSystem.isFainted(),
          },
        ],
      damageLocalPlayer: (dmg, attacker) => playerHealthSystem.damagePlayer(dmg, attacker),
      showFloatingText: (x, y, text, color) => host.effectsRenderer.showFloatingText(x, y, text, color),
      shakeObject: (target) => host.effectsRenderer.shakeObject(target),
      playExplosionAt: (x, y) => host.effectsRenderer.playExplosionAt(x, y),
      addRewardResources: host.addResources,
      broadcastWaveSpawn: (isBossWave) => multiplayerSync?.broadcastWaveSpawn(isBossWave),
      broadcastWaveSummonRequest: (isBossWave, isEarlySummon) =>
        multiplayerSync?.broadcastWaveSummonRequest(isBossWave, isEarlySummon),
      broadcastMonstersSync: (payload) => multiplayerSync?.broadcastMonstersSync(payload),
      broadcastMonstersDeltaSync: (payload) =>
        multiplayerSync?.broadcastMonstersDeltaSync(payload),
      requestMonstersSync: () => multiplayerSync?.requestMonstersSync(),
      broadcastMonsterHit: (payload) => multiplayerSync?.broadcastMonsterHit(payload),
      broadcastMonsterPlayerAttack: (payload) =>
        multiplayerSync?.broadcastMonsterPlayerAttack(payload),
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
    getPlayerDirection: host.getPlayerDirection,
    isPlayerFainted: () => playerHealthSystem.isFainted(),
    getGold: () => host.getInventory().gold,
    spendGold: (amount) => host.spendResources(0, 0, amount),
    addGold: (amount) => host.addResources(0, 0, amount),
    onMaxHpChanged: (newMaxHp, healDelta) => playerHealthSystem.setMaxHp(newMaxHp, healDelta),
    healPlayer: (amount) => playerHealthSystem.healPlayer(amount),
    onClassChangedVisual: (classId) => host.onPlayerClassVisualChanged?.(classId),
    getMonsterVisuals: () => waveSystem.getMonsterVisuals(),
    damageMonster: (id, dmg, attacker, attackerId, hitMeta) =>
      waveSystem.damageMonster(id, dmg, attacker, false, attackerId, hitMeta),
    tryDamageCampCoreInRadius: (x, y, r, dmg) =>
      monsterCampSystem?.damageCampCoresInRadius(x, y, r, dmg, true) ?? false,
    projectileSystem,
    showFloatingText: (x, y, text, color) => host.effectsRenderer.showFloatingText(x, y, text, color),
    playExplosionAt: (x, y) => host.effectsRenderer.playExplosionAt(x, y),
    playSkillEffect: (fxCtx) => {
      const chargeMs = SKILL_FX_STYLE_CONFIG[fxCtx.classId].chargeDurationMs;
      if (chargeMs > 0) {
        host.onPlayerCastVisual?.(chargeMs);
      }
      host.skillEffectsRenderer.playClassSkill(fxCtx);
    },
    triggerSkillSurge: host.triggerSkillSurge,
    getJobHallStatus: () => {
      const pos = host.getPlayerPosition();
      const status = checkJobHallProximity(pos.x, pos.y, host.getConstructedBuildings());
      return { hasBuilt: status.hasBuilt, isNear: status.isNear };
    },
    getToolShopStatus: () => {
      const pos = host.getPlayerPosition();
      const status = checkToolShopProximity(pos.x, pos.y, host.getConstructedBuildings());
      return { hasBuilt: status.hasBuilt, isNear: status.isNear };
    },
    getPlayerHpState: () => playerHealthSystem.getState(),
    playLevelUpEffect: (x, y, level, delayMs) =>
      host.celebrationEffects.playLevelUpEffect(x, y, level, delayMs),
    playClassAdvancementEffect: (x, y, classId) =>
      host.celebrationEffects.playClassAdvancementEffect(x, y, classId),
  });

  const campFortification = new CampFortificationSystem({
    scene: host.scene,
    wallColliders: host.wallColliders,
    projectileSystem,
    getLocalPlayerPosition: host.getPlayerPosition,
    isLocalPlayerFainted: () => playerHealthSystem.isFainted(),
    damageLocalPlayer: (dmg, attacker) => playerHealthSystem.damagePlayer(dmg, attacker),
    onStructureDamaged: (territoryId) =>
      waveSystem.aggroCampMonsters(territoryId, host.getPlayerId()),
    onStructureHitFeedback: (x, y, isSkill) =>
      host.combatFeedbackRenderer.playHitImpact({
        x,
        y,
        damage: 0,
        isSkill,
        isLocalPlayerAttack: true,
      }),
    playExplosionAt: (x, y) => host.effectsRenderer.playExplosionAt(x, y),
    shakeObject: (target) => host.effectsRenderer.shakeObject(target),
    showFloatingText: (x, y, text, color) => host.effectsRenderer.showFloatingText(x, y, text, color),
  });

  monsterCampSystem = new MonsterCampSystem({
    scene: host.scene,
    isHuntingMode: host.isHuntingMode,
    isHost: () => waveSystem.getIsHost(),
    getDifficultyConfig: host.getDifficultyConfig,
    getIslands: host.getIslands,
    getMonsters: () => waveSystem.getMonsterVisuals(),
    fortification: campFortification,
    addResources: host.addResources,
    addThreat: (amount) => waveSystem.addThreat(amount, true),
    gainExp: (exp) => playerProgressionSystem.gainExp(exp),
    grantRewardItem: (item) => playerProgressionSystem.grantRewardItem(item),
    playChestDropAt: (x, y, item, onOpened) =>
      host.lootChestRenderer.playDropAnimation({ x, y, item, onOpened }),
    onCampCoreDamaged: (territoryId) =>
      waveSystem.aggroCampMonsters(territoryId, host.getPlayerId()),
    onCampCoreHitFeedback: (x, y, isSkill) =>
      host.combatFeedbackRenderer.playHitImpact({
        x,
        y,
        damage: 0,
        isSkill,
        isLocalPlayerAttack: true,
      }),
    playExplosionAt: (x, y) => host.effectsRenderer.playExplosionAt(x, y),
    shakeObject: (target) => host.effectsRenderer.shakeObject(target),
    showFloatingText: (x, y, text, color) => host.effectsRenderer.showFloatingText(x, y, text, color),
    emitTerritoriesUpdated: () => {
      host.refreshTerritoryDecorations();
      host.emitWorldStateToReact(true);
    },
  });

  fieldMonsterSystem = new FieldMonsterSystem({
    scene: host.scene,
    isHuntingMode: host.isHuntingMode,
    isHost: () => waveSystem.getIsHost(),
    getDifficultyConfig: host.getDifficultyConfig,
    getIslands: host.getIslands,
    getTerrainMap: host.getTerrainMap,
    getMonsters: () => waveSystem.getMonsterVisuals(),
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
    isLocalPlayerFainted: () => playerHealthSystem.isFainted(),
    getLocalPlayerState: host.getLocalPlayerState,
    onOnlineCountChanged: (count) => {
      waveSystem.setOnlineCount(count);
      monsterCampSystem.setOnlineCount(count);
      fieldMonsterSystem.setOnlineCount(count);
      if (waveSystem.getIsHost()) {
        const ws = waveSystem.getWaveState();
        multiplayerSync?.broadcastThreatSync(ws.threatPercent, ws.waveCount, ws.bossWaveCount);
        if (count > 1) {
          waveSystem.broadcastFullMonstersSync(true);
        }
      }
    },
    onHostStatusChanged: (isHost) => {
      waveSystem.setHostMode(isHost);
      if (isHost) {
        monsterCampSystem.ensureHostGarrisonsSpawned();
        fieldMonsterSystem.ensureHostInitialized();
        waveSystem.broadcastFullMonstersSync(true);
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
    onRemoteMonstersSyncRequest: () => waveSystem.handleRemoteMonstersSyncRequest(),
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
    fieldMonsterSystem,
    waveSystem,
    towerDefenseSystem,
    garrisonSystem,
    multiplayerSync,
  };
}
