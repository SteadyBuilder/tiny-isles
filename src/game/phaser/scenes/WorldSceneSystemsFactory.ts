import Phaser from 'phaser';
import { SKILL_FX_STYLE_CONFIG } from '../../../data/combatFeedbackConfig';
import { FIELD_MONSTER_CONFIG } from '../../../data/fieldMonsters';
import { POTION_DEFINITIONS, rollMonsterLoot } from '../../../data/potions';
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
import { CampFortificationSystem } from '../../systems/CampFortificationSystem';
import { CoreGemSystem } from '../../systems/CoreGemSystem';
import { FieldMonsterSystem } from '../../systems/FieldMonsterSystem';
import { GarrisonSystem } from '../../systems/GarrisonSystem';
import { MonsterCampSystem } from '../../systems/MonsterCampSystem';
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

  waveSystem = new WaveSystem(
    {
      scene: host.scene,
      isHuntingMode: host.isHuntingMode,
      getDifficultyConfig: host.getDifficultyConfig,
      projectileSystem,
      healCampCore: (territoryId, amount) => monsterCampSystem?.healCampCore(territoryId, amount),
      onMonsterHitImpact: (opts, restoreTint) =>
        host.combatFeedbackRenderer.playHitImpact(opts, restoreTint),
      onMonsterKilledReward: (x, y, isBoss, expReward, isCampMonster, meta) => {
        playerProgressionSystem?.gainExp(expReward);
        // 사냥 특화 모드에서는 던전 침공 마물 처치 시 위협도 미증가, 부락 마물(+5%) 및 야생 필드 마물(+1%) 처치 시 상승
        if (isCampMonster || !host.isHuntingMode()) {
          waveSystem.addThreat(THREAT_WAVE_CONFIG.huntThreatGain, true);
          host.effectsRenderer.emitThreatOrbFromWorld(x, y, THREAT_WAVE_CONFIG.huntThreatGain);
        } else if (meta?.isFieldMonster) {
          const fieldGain = FIELD_MONSTER_CONFIG.threatGainOnKill;
          waveSystem.addThreat(fieldGain, true);
          host.effectsRenderer.emitThreatOrbFromWorld(x, y, fieldGain);
        }
        // 몬스터 처치 시 밸런스 테이블 기반 장비·물약·자원 꾸러미 드랍
        const difficultyId = host.getDifficultyConfig?.().id ?? 'normal';
        const lootResults = rollMonsterLoot({
          ring: meta?.campRing ?? 2,
          isElite: Boolean(meta?.isElite),
          isBoss,
          isHuntingMode: host.isHuntingMode(),
          difficultyId,
          eliteTier: meta?.eliteTier,
        });

        for (const loot of lootResults) {
          if (loot.kind === 'equipment') {
            host.lootChestRenderer.playDropAnimation({
              x,
              y,
              item: loot.item,
              onOpened: (openedItem) => {
                playerProgressionSystem?.grantRewardItem(openedItem);
                GameEvents.emit(
                  'game-alert',
                  `💎 전리품 드랍! [${openedItem.name}] 획득!`
                );
              },
            });
          } else if (loot.kind === 'potion') {
            const added = playerProgressionSystem?.grantPotion(loot.potionId, loot.count) ?? 0;
            const def = POTION_DEFINITIONS[loot.potionId];
            if (added > 0 && def) {
              sound.playGemDrop();
              host.lootChestRenderer.playLootIconDrop({
                x,
                y,
                textureKey: def.textureKey,
                glowColorHex: '#4ade80',
              });
              host.effectsRenderer.showFloatingText(
                x,
                y - 26,
                `${def.name} +${added}`,
                '#4ade80'
              );
              GameEvents.emit(
                'game-alert',
                `🧪 몬스터가 [${def.name}]을(를) 드랍했습니다!`
              );
            }
          } else if (loot.kind === 'resource') {
            const { wood, stone, gold, label, icon, textureKey } = loot.bundle;
            host.addResources(wood, stone, gold);
            const parts: string[] = [];
            if (wood > 0) parts.push(`🪵+${wood}`);
            if (stone > 0) parts.push(`🪨+${stone}`);
            if (gold > 0) parts.push(`🪙+${gold}`);
            if (parts.length > 0) {
              host.lootChestRenderer.playLootIconDrop({
                x,
                y,
                textureKey,
                glowColorHex: '#fbbf24',
              });
              host.effectsRenderer.showFloatingText(
                x,
                y - 12,
                `${parts.join(' ')}`,
                '#fde047'
              );
              if (isBoss || meta?.isElite) {
                GameEvents.emit('game-alert', `${icon} ${label} 획득! (${parts.join(' ')})`);
              }
            }
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
    getLocalPlayerState: host.getLocalPlayerState,
    onOnlineCountChanged: (count) => {
      waveSystem.setOnlineCount(count);
      monsterCampSystem.setOnlineCount(count);
      fieldMonsterSystem.setOnlineCount(count);
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
    fieldMonsterSystem,
    waveSystem,
    towerDefenseSystem,
    garrisonSystem,
    multiplayerSync,
  };
}
