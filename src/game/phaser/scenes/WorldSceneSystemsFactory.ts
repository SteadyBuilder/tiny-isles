import Phaser from 'phaser';
import {
  ConstructedBuilding,
  Inventory,
  Island,
  PlayerAction,
  PlayerClassId,
  PlayerColor,
} from '../../../types/game';
import { MissionDifficultyConfig, RoomMode } from '../../../types/room';
import { CampFortificationSystem } from '../../systems/CampFortificationSystem';
import { CoreGemSystem } from '../../systems/CoreGemSystem';
import { FieldMonsterSystem } from '../../systems/FieldMonsterSystem';
import { GarrisonSystem } from '../../systems/GarrisonSystem';
import { MercenarySystem } from '../../systems/MercenarySystem';
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
import { MetaBonusSummary } from '../../../types/metaProgression';
import { createWorldMultiplayerSync } from './WorldMultiplayerBindings';
import { createWorldPlayerSystems } from './WorldPlayerBindings';

export interface IWorldSystemsHost {
  scene: Phaser.Scene;
  isSceneAlive: () => boolean;
  isHuntingMode: () => boolean;
  getDifficultyConfig?: () => MissionDifficultyConfig;
  getMetaBonuses?: () => MetaBonusSummary;
  getPlayerId: () => string;
  getPlayerName: () => string;
  getPlayerColor: () => PlayerColor;
  getRoomId?: () => string;
  getRoomMode?: () => RoomMode;
  getPreferredHostId?: () => string | undefined;
  isDropInJoin?: () => boolean;
  onApplyDropInCatchUp?: (elapsedSec: number) => void;
  onRecordDamageContribution?: (damage: number) => void;
  onRecordKillContribution?: (isObjective: boolean) => void;
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
  getMissionSyncSnapshot?: () => Omit<import('../../../types/monsterSync').MissionProgressSyncPayload, 'hostEpoch'>;
  applyRemoteMissionProgressSync?: (payload: import('../../../types/monsterSync').MissionProgressSyncPayload) => void;
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
  onMonstersChanged?: () => void;
}

export interface WorldSystemsBundle {
  coreGemSystem: CoreGemSystem;
  playerHealthSystem: PlayerHealthSystem;
  projectileSystem: ProjectileSystem;
  playerProgressionSystem: PlayerProgressionSystem;
  campFortification: CampFortificationSystem;
  monsterCampSystem: MonsterCampSystem;
  fieldMonsterSystem: FieldMonsterSystem;
  waveSystem: WaveSystem;
  towerDefenseSystem: TowerDefenseSystem;
  garrisonSystem: GarrisonSystem;
  mercenarySystem: MercenarySystem;
  multiplayerSync: MultiplayerSyncController;
}

/**
 * CoreGem, PlayerHealth, Projectile, PlayerProgression, MonsterCamp, FieldMonster, Wave, TowerDefense, Garrison, MultiplayerSync 팩토리
 */
export function createWorldSystemsBundle(host: IWorldSystemsHost): WorldSystemsBundle {
  let multiplayerSync!: MultiplayerSyncController;
  let monsterCampSystem!: MonsterCampSystem;
  let fieldMonsterSystem!: FieldMonsterSystem;
  let waveSystem!: WaveSystem;

  const projectileSystem = new ProjectileSystem(host.scene);
  const { playerHealthSystem, playerProgressionSystem } = createWorldPlayerSystems(
    host,
    projectileSystem,
    {
      getWaveSystem: () => waveSystem,
      tryDamageCampCoreInRadius: (x, y, r, dmg) =>
        monsterCampSystem?.damageCampCoresInRadius(x, y, r, dmg, true) ?? false,
      onBroadcastSkillCast: (payload) => multiplayerSync?.broadcastPlayerSkillCast(payload),
    }
  );

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
      onMonsterHitImpact: (opts, restoreTint) => {
        if (opts.isLocalPlayerAttack && opts.damage > 0) {
          host.onRecordDamageContribution?.(opts.damage);
        }
        host.combatFeedbackRenderer.playHitImpact(opts, restoreTint);
      },
      onMonsterKilledReward: (x, y, isBoss, expReward, isCampMonster, meta) => {
        if (meta?.isParticipant !== false) {
          host.onRecordKillContribution?.(Boolean(isBoss));
        }
        distributeHostMonsterKillReward(
          rewardContext,
          x,
          y,
          isBoss,
          expReward,
          isCampMonster,
          meta
        );
      },
      onRemoteMonsterKilledReward: (kill) => {
        if (kill.killerId === host.getPlayerId() || kill.isBoss) {
          host.onRecordKillContribution?.(Boolean(kill.isBoss));
        }
        distributeRemoteMonsterKillReward(rewardContext, kill);
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
      requestMonstersRepair: (payload) => multiplayerSync?.requestMonstersRepair(payload),
      broadcastMonsterHit: (payload) => multiplayerSync?.broadcastMonsterHit(payload),
      broadcastMonsterPlayerAttack: (payload) =>
        multiplayerSync?.broadcastMonsterPlayerAttack(payload),
      broadcastThreatAdded: (amount) => multiplayerSync?.broadcastThreatAdded(amount),
      broadcastThreatSync: (payload) => multiplayerSync?.broadcastThreatSync(payload),
      broadcastDungeonPortalSync: (portal) => multiplayerSync?.broadcastDungeonPortalSync(portal),
      emitThreatOrb: (worldX, worldY, amount) =>
        host.effectsRenderer.emitThreatOrbFromWorld(worldX, worldY, amount),
      onMonstersChanged: host.onMonstersChanged,
    },
    coreGemSystem
  );

  const campFortification = new CampFortificationSystem({
    scene: host.scene,
    wallColliders: host.wallColliders,
    projectileSystem,
    isHost: () => waveSystem.getIsHost(),
    getLocalPlayerId: host.getPlayerId,
    getLocalPlayerPosition: host.getPlayerPosition,
    isLocalPlayerFainted: () => playerHealthSystem.isFainted(),
    damageLocalPlayer: (dmg, attacker) => playerHealthSystem.damagePlayer(dmg, attacker),
    onStructureDamaged: (territoryId, attackerId) =>
      waveSystem.aggroCampMonsters(territoryId, attackerId ?? host.getPlayerId()),
    onStructureHitFeedback: (x, y, isSkill, isLocalAttack = true) => {
      if (isLocalAttack) {
        host.onRecordDamageContribution?.(40);
      }
      host.combatFeedbackRenderer.playHitImpact({
        x,
        y,
        damage: 0,
        isSkill,
        isLocalPlayerAttack: isLocalAttack,
      });
    },
    onStructureSyncBroadcast: (payload) => multiplayerSync?.broadcastCampStructureHpSync(payload),
    onRemoteStructureHit: (payload) => multiplayerSync?.broadcastCampStructureHit(payload),
    playExplosionAt: (x, y) => host.effectsRenderer.playExplosionAt(x, y),
    shakeObject: (target) => host.effectsRenderer.shakeObject(target),
    showFloatingText: (x, y, text, color) => host.effectsRenderer.showFloatingText(x, y, text, color),
  });

  monsterCampSystem = new MonsterCampSystem({
    scene: host.scene,
    isHuntingMode: host.isHuntingMode,
    isHost: () => waveSystem.getIsHost(),
    getLocalPlayerId: host.getPlayerId,
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
    onCampCoreDamaged: (territoryId, attackerId) =>
      waveSystem.aggroCampMonsters(territoryId, attackerId ?? host.getPlayerId()),
    onCampCoreHitFeedback: (x, y, isSkill, isLocalAttack = true) => {
      if (isLocalAttack) {
        host.onRecordDamageContribution?.(50);
      }
      host.combatFeedbackRenderer.playHitImpact({
        x,
        y,
        damage: 0,
        isSkill,
        isLocalPlayerAttack: isLocalAttack,
      });
    },
    broadcastCampCoreHit: (payload) => multiplayerSync?.broadcastCampCoreHit(payload),
    broadcastCampCoreSync: (payload) => multiplayerSync?.broadcastCampCoreSync(payload),
    broadcastCampFullSync: (payload) => multiplayerSync?.broadcastCampFullSync(payload),
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
      getTowerDamageMultiplier: () => 1 + (host.getMetaBonuses?.().towerDamageBonusRatio ?? 0),
    },
    waveSystem
  );

  const garrisonSystem = new GarrisonSystem(
    { scene: host.scene, projectileSystem },
    waveSystem
  );

  const mercenarySystem = new MercenarySystem(
    {
      scene: host.scene,
      projectileSystem,
      showFloatingText: (x, y, text, color) => host.effectsRenderer.showFloatingText(x, y, text, color),
    },
    waveSystem
  );

  multiplayerSync = createWorldMultiplayerSync(host, {
    coreGemSystem,
    playerHealthSystem,
    campFortification,
    monsterCampSystem,
    fieldMonsterSystem,
    waveSystem,
  });
  multiplayerSync.setup();

  return {
    coreGemSystem,
    playerHealthSystem,
    projectileSystem,
    playerProgressionSystem,
    campFortification,
    monsterCampSystem,
    fieldMonsterSystem,
    waveSystem,
    towerDefenseSystem,
    garrisonSystem,
    mercenarySystem,
    multiplayerSync,
  };
}
