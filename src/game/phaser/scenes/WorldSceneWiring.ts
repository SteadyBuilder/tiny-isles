import Phaser from 'phaser';
import { PLAYER_COMBAT_CONFIG } from '../../../data/worldRules';
import {
  ConstructedBuilding,
  Inventory,
  Island,
  PlayerColor,
} from '../../../types/game';
import { BuildingRepairController } from '../controllers/BuildingRepairController';
import { PlayerInteractionController } from '../controllers/PlayerInteractionController';
import { PlayerMovementController } from '../controllers/PlayerMovementController';
import { TerritoryActionController } from '../controllers/TerritoryActionController';
import { TerritoryPassiveSystem } from '../controllers/TerritoryPassiveSystem';
import { TowerPlacementController } from '../controllers/TowerPlacementController';
import { ViewportCullingController } from '../controllers/ViewportCullingController';
import { WorldEventBusController } from '../controllers/WorldEventBusController';
import { WorldPersistenceController } from '../controllers/WorldPersistenceController';
import { ConstructedBuildingRenderer } from '../renderers/ConstructedBuildingRenderer';
import { ExpansionAltarRenderer } from '../renderers/ExpansionAltarRenderer';
import { ResourceEntityRenderer } from '../renderers/ResourceEntityRenderer';
import { ResourceDropEffectsRenderer } from '../renderers/ResourceDropEffectsRenderer';
import { TerrainRenderer } from '../renderers/TerrainRenderer';
import { TerritoryStructureRenderer } from '../renderers/TerritoryStructureRenderer';
import { WorldEffectsRenderer } from '../renderers/WorldEffectsRenderer';
import { WaterRect } from '../../world/MapTerrainGenerator';
import { checkSanctuaryPlayerHeal } from '../../utils/sanctuaryHealUtils';
import { WorldSystemsBundle } from './WorldSceneSystemsFactory';

export interface IWorldControllersHost {
  scene: Phaser.Scene;
  isSceneAlive: () => boolean;
  getPlayerId: () => string;
  getPlayerName: () => string;
  getPlayerColor: () => PlayerColor;
  setPlayerProfile: (name: string, color: PlayerColor) => void;
  getInitialZoom: () => number;
  getIslands: () => Island[];
  getConstructedBuildings: () => ConstructedBuilding[];
  getInventory: () => Inventory;
  setInventory: (inv: Inventory) => void;
  addResources: (wood: number, stone: number, gold: number) => void;
  spendResources: (wood: number, stone: number, gold: number) => void;
  addHarvestedResource: (resKey: keyof Inventory, amount: number) => void;
  refreshTerritoryDecorations: () => void;
  drawTerrainDecorations: () => void;
  drawExpansionAltars: () => void;
  getWallColliders: () => Phaser.Physics.Arcade.StaticGroup | null;
  getWaterBodies: () => ReadonlyArray<WaterRect>;
  terrainRenderer: TerrainRenderer;
  altarRenderer: ExpansionAltarRenderer;
  effectsRenderer: WorldEffectsRenderer;
  territoryStructureRenderer: TerritoryStructureRenderer;
  constructedBuildingRenderer: ConstructedBuildingRenderer;
  resourceEntityRenderer: ResourceEntityRenderer;
  resourceDropEffectsRenderer: ResourceDropEffectsRenderer;
  systems: WorldSystemsBundle;
  persistence: WorldPersistenceController;
}

export interface WorldControllersBundle {
  territoryPassive: TerritoryPassiveSystem;
  territoryAction: TerritoryActionController;
  buildingRepair: BuildingRepairController;
  playerInteraction: PlayerInteractionController;
  playerMovement: PlayerMovementController;
  towerPlacement: TowerPlacementController;
  viewportCulling: ViewportCullingController;
  eventBus: WorldEventBusController;
}

/**
 * WorldScene의 컨트롤러(영지 액션/패시브, 플레이어 이동·상호작용, EventBus 브릿지) 조합 빌더
 */
export function createWorldControllersBundle(
  host: IWorldControllersHost
): WorldControllersBundle {
  let territoryAction!: TerritoryActionController;
  let playerMovement!: PlayerMovementController;
  let playerInteraction!: PlayerInteractionController;

  const territoryPassive = new TerritoryPassiveSystem({
    getIslands: host.getIslands,
    getConstructedBuildings: host.getConstructedBuildings,
    isHost: () => host.systems.waveSystem.getIsHost(),
    addResources: host.addResources,
    updateCoreGemVisual: (id) => host.systems.coreGemSystem.updateCoreGemVisual(id),
    updateConstructedBuildingHpBar: (id) => host.constructedBuildingRenderer.updateHpBar(id),
    onCoreHealed: (territoryId, coreHp, coreMaxHp) =>
      host.systems.multiplayerSync?.broadcastCoreHpSync(territoryId, coreHp, coreMaxHp),
    onBuildingHealed: (buildingId, hp, maxHp) =>
      host.systems.multiplayerSync?.broadcastBuildingHpSync(buildingId, hp, maxHp),
    showFloatingText: (x, y, text, color) => host.effectsRenderer.showFloatingText(x, y, text, color),
    saveWorldState: (immediate = false) => host.persistence.saveWorldState(immediate),
    emitWorldStateToReact: (immediate = false) => host.persistence.emitWorldStateToReact(immediate),
  });

  territoryAction = new TerritoryActionController({
    getPlayerId: host.getPlayerId,
    getPlayerStandingTerritoryId: () => playerMovement.getCurrentStandingTerritoryId(),
    getIslands: host.getIslands,
    getConstructedBuildings: host.getConstructedBuildings,
    getInventory: host.getInventory,
    spendInventory: host.spendResources,
    saveWorldState: (immediate = true) => host.persistence.saveWorldState(immediate),
    emitWorldStateToReact: (immediate = true) => host.persistence.emitWorldStateToReact(immediate),
    drawTerrainDecorations: host.drawTerrainDecorations,
    drawExpansionAltars: host.drawExpansionAltars,
    spawnAllBuildings: () =>
      host.territoryStructureRenderer.spawnAllBuildings(
        host.getIslands(),
        host.systems.coreGemSystem
      ),
    createTerritoryCoreForIsland: (isl) =>
      host.territoryStructureRenderer.createTerritoryCoreForIsland(
        isl,
        host.systems.coreGemSystem
      ),
    updateCoreGemVisual: (id) => host.systems.coreGemSystem.updateCoreGemVisual(id),
    spawnConstructedBuildingVisual: (cb) => host.constructedBuildingRenderer.spawnOne(cb),
    updateConstructedBuildingHpBar: (id) => host.constructedBuildingRenderer.updateHpBar(id),
    hasConstructedBuildingContainer: (id) =>
      Boolean(host.constructedBuildingRenderer.getContainer(id)),
    removeConstructedBuildingVisual: (id) => host.constructedBuildingRenderer.removeVisual(id),
    spawnGoldMineClusterAndAnnounce: () =>
      host.resourceEntityRenderer.spawnGoldMineClusterAndAnnounce(),
    showFloatingText: (x, y, text, color) => host.effectsRenderer.showFloatingText(x, y, text, color),
    playExplosionAt: (x, y) => host.effectsRenderer.playExplosionAt(x, y),
    addThreat: (amount) => host.systems.waveSystem.addThreat(amount, true),
    emitThreatOrb: (wx, wy, amt) => host.effectsRenderer.emitThreatOrbFromWorld(wx, wy, amt),
    broadcastUnlock: (id, by, ownerId) =>
      host.systems.multiplayerSync?.broadcastUnlock(id, by, ownerId),
    broadcastVillageUpgrade: (id, tier) =>
      host.systems.multiplayerSync?.broadcastVillageUpgrade(id, tier),
    broadcastBuildingConstructed: (cb) =>
      host.systems.multiplayerSync?.broadcastBuildingConstructed(cb),
    isHost: () => host.systems.waveSystem.getIsHost(),
    getConstructedVisualContainer: (id) => host.constructedBuildingRenderer.getContainer(id),
    shakeObject: (target) => host.effectsRenderer.shakeObject(target),
    broadcastBuildingHpSync: (buildingId, hp, maxHp, damageDelta) =>
      host.systems.multiplayerSync?.broadcastBuildingHpSync(buildingId, hp, maxHp, damageDelta),
    broadcastBuildingDestroyed: (buildingId) =>
      host.systems.multiplayerSync?.broadcastBuildingDestroyed(buildingId),
    broadcastCoreHpSync: (territoryId, coreHp, coreMaxHp, damageDelta) =>
      host.systems.multiplayerSync?.broadcastCoreHpSync(territoryId, coreHp, coreMaxHp, damageDelta),
    broadcastRepairTerritoryRequest: (territoryId) =>
      host.systems.multiplayerSync?.broadcastRepairTerritoryRequest(territoryId),
  });

  const buildingRepair = new BuildingRepairController({
    getConstructedBuildings: host.getConstructedBuildings,
    getInventory: host.getInventory,
    spendInventory: host.spendResources,
    updateConstructedBuildingHpBar: (id) => host.constructedBuildingRenderer.updateHpBar(id),
    showFloatingText: (x, y, text, color = '#ffffff') =>
      host.effectsRenderer.showFloatingText(x, y, text, color),
    saveWorldState: (immediate = false) => host.persistence.saveWorldState(immediate),
    emitWorldStateToReact: (immediate = false) => host.persistence.emitWorldStateToReact(immediate),
    broadcastBuildingHpSync: (buildingId, hp, maxHp) =>
      host.systems.multiplayerSync?.broadcastBuildingHpSync(buildingId, hp, maxHp),
    shakeObject: (target) => host.effectsRenderer.shakeObject(target),
    getConstructedVisualContainer: (id) => host.constructedBuildingRenderer.getContainer(id),
  });

  playerInteraction = new PlayerInteractionController({
    scene: host.scene,
    getPlayerId: host.getPlayerId,
    getPlayerPosition: () => playerMovement.getPosition(),
    getPlayerName: host.getPlayerName,
    isPlayerFainted: () => host.systems.playerHealthSystem.isFainted(),
    getCurrentAction: () => playerMovement.getCurrentAction(),
    playPlayerAnimation: (action) => playerMovement.playAnimation(action),
    markInteractTime: (now) => playerMovement.markInteractTime(now),
    getIslands: host.getIslands,
    getConstructedBuildings: host.getConstructedBuildings,
    getInventory: host.getInventory,
    spendInventory: host.spendResources,
    addHarvestedResource: host.addHarvestedResource,
    tryRepairNearestWall: (px, py) => buildingRepair.repairNearestDamagedWall(px, py),
    getMonsterVisuals: () => host.systems.waveSystem.getMonsterVisuals(),
    damageMonster: (id, dmg, attacker, attackerId, hitMeta) =>
      host.systems.waveSystem.damageMonster(id, dmg, attacker, false, attackerId, hitMeta),
    getPlayerClassDef: () => host.systems.playerProgressionSystem.getClassDef(),
    getPlayerAttackDamage: () => host.systems.playerProgressionSystem.getTotalAttack(),
    getEffectiveAttackCooldownMs: () =>
      host.systems.playerProgressionSystem.getEffectiveAttackCooldownMs(),
    getEffectiveAttackRange: () =>
      host.systems.playerProgressionSystem.getEffectiveAttackRange(),
    rollNormalAttackWithAffixes: (baseDamage) =>
      host.systems.playerProgressionSystem.rollDamageWithAffixes(baseDamage),
    healPlayer: (amount) => host.systems.playerHealthSystem.healPlayer(amount),
    tryAttackCampCore: (px, py, rangePx, dmg) =>
      host.systems.monsterCampSystem.tryAttackNearestCampCore(px, py, rangePx, dmg),
    projectileSystem: host.systems.projectileSystem,
    findGatherableEntityVisual: (x, y) =>
      host.resourceEntityRenderer.findGatherableVisual(x, y),
    updateEntityHpBar: (id) => host.resourceEntityRenderer.updateHpBar(id),
    removeAndRespawnEntity: (ent) => host.resourceEntityRenderer.removeAndRespawn(ent),
    addThreat: (amount) => host.systems.waveSystem.addThreat(amount, true),
    emitThreatOrb: (wx, wy, amt) => host.effectsRenderer.emitThreatOrbFromWorld(wx, wy, amt),
    broadcastEntityHit: (id, dmg) => host.systems.multiplayerSync?.broadcastHit(id, dmg),
    unlockIslandLocally: (id, by, local) => territoryAction.unlockIslandLocally(id, by, local),
    updateCoreGemVisual: (id) => host.systems.coreGemSystem.updateCoreGemVisual(id),
    saveWorldState: (immediate = false) => host.persistence.saveWorldState(immediate),
    emitWorldStateToReact: (immediate = false) => host.persistence.emitWorldStateToReact(immediate),
    shakeObject: (target) => host.effectsRenderer.shakeObject(target),
    showFloatingText: (x, y, text, color) => host.effectsRenderer.showFloatingText(x, y, text, color),
    spawnResourceDropFx: (params) => host.resourceDropEffectsRenderer.spawnResourceDrops(params),
  });

  const towerPlacement = new TowerPlacementController({
    scene: host.scene,
    getPlayerId: host.getPlayerId,
    getPlayerStandingTerritoryId: () => playerMovement.getCurrentStandingTerritoryId(),
    getIslands: host.getIslands,
    getConstructedBuildings: host.getConstructedBuildings,
    getInventory: host.getInventory,
    onConstructAt: (territoryId, type, pos, slotIndex) =>
      territoryAction.handleConstructBuilding(
        territoryId,
        type,
        slotIndex,
        true,
        slotIndex !== undefined ? undefined : pos
      ),
    showFloatingText: (x, y, text, color) => host.effectsRenderer.showFloatingText(x, y, text, color),
  });

  playerMovement = new PlayerMovementController({
    scene: host.scene,
    isSceneAlive: host.isSceneAlive,
    getPlayerName: host.getPlayerName,
    getPlayerColor: host.getPlayerColor,
    getMoveSpeed: () => host.systems.playerProgressionSystem.getTotalSpeed(),
    getInitialZoom: host.getInitialZoom,
    getBuildingColliders: () => host.territoryStructureRenderer.getBuildingColliders(),
    getWallColliders: host.getWallColliders,
    getWaterColliders: () => host.terrainRenderer.getWaterColliders(),
    getWaterBodies: host.getWaterBodies,
    getIslands: host.getIslands,
    getMonsterVisuals: () => host.systems.waveSystem.getMonsterVisuals(),
    findTappedEntityVisual: (wx, wy) => host.resourceEntityRenderer.findTappedVisual(wx, wy),
    isWithinEntityGatherRange: (px, py, visual) =>
      host.resourceEntityRenderer.isWithinGatherRange(px, py, visual),
    getEntityInteractionPoint: (visual) =>
      host.resourceEntityRenderer.getEntityInteractionPoint(visual),
    onInteract: () => playerInteraction.tryInteract(),
    isPlacementActive: () => towerPlacement.isActive(),
    getAttackRange: (isBoss) => {
      const baseRange = host.systems.playerProgressionSystem.getEffectiveAttackRange();
      return isBoss ? Math.max(baseRange, PLAYER_COMBAT_CONFIG.meleeRangeBoss) : baseRange;
    },
    getConstructedBuildings: host.getConstructedBuildings,
    grantDashInvincibility: (durationMs) =>
      host.systems.playerHealthSystem.grantTemporaryInvincibility(durationMs),
    findNearestDamagedWall: (wx, wy, maxDist) =>
      buildingRepair.getNearbyDamagedWall(wx, wy, maxDist),
  });

  const eventBus = new WorldEventBusController({
    isSceneAlive: host.isSceneAlive,
    setPlayerProfile: (name, color) => {
      host.setPlayerProfile(name, color);
      playerMovement.refreshProfileVisuals();
    },
    setTargetZoom: (zoom) => playerMovement.setTargetZoom(zoom),
    setInventory: (inv) => {
      host.setInventory(inv);
      host.refreshTerritoryDecorations();
    },
    addTestResources: () => {
      host.addResources(500, 500, 500);
      host.systems.playerProgressionSystem.gainExp(200);
      host.refreshTerritoryDecorations();
      const { x, y } = playerMovement.getPosition();
      host.effectsRenderer.showFloatingText(
        x,
        y - 50,
        '🎁 테스트 자원 & 경험치 지급! (+🪵500 +🪨500 +🪙500 +200EXP)',
        '#fde047'
      );
    },
    setJoystickVector: (vector) => playerMovement.setJoystickVector(vector),
    tryInteract: () => playerInteraction.tryInteract(),
    upgradeVillage: (id) => territoryAction.handleUpgradeVillage(id, true),
    constructBuilding: (id, type, slot, customPos) =>
      territoryAction.handleConstructBuilding(id, type, slot, true, customPos),
    enterTowerPlacement: (id, type) => towerPlacement.enter(id, type),
    cancelTowerPlacement: () => towerPlacement.cancel(),
    confirmTowerPlacement: () => {
      towerPlacement.confirm();
    },
    repairTerritoryCore: (id) => territoryAction.handleRepairCore(id),
    repairBuilding: (id) => buildingRepair.repairBuildingById(id, true),
    triggerRegularWave: () => host.systems.waveSystem.triggerRegularWave(),
    triggerBossWave: () => host.systems.waveSystem.triggerBossWave(),
    summonEarlyWave: (isBoss) => host.systems.waveSystem.summonEarlyWave(isBoss),
    addThreat: (amount) => host.systems.waveSystem.addThreat(amount, true),
    damageTerritoryCore: (id, dmg) =>
      host.systems.coreGemSystem.damageTerritoryCore(id, dmg, '마물 침공 테스트', true),
    selectPlayerClass: (classId) => host.systems.playerProgressionSystem.selectClass(classId),
    equipItem: (instanceId) => host.systems.playerProgressionSystem.equipItem(instanceId),
    unequipSlot: (slot) => host.systems.playerProgressionSystem.unequipSlot(slot),
    salvageItem: (instanceId) => host.systems.playerProgressionSystem.salvageItem(instanceId),
    equipRecommendedItems: () =>
      host.systems.playerProgressionSystem.equipRecommendedItems(),
    salvageInferiorItems: () =>
      host.systems.playerProgressionSystem.salvageInferiorItems(),
    castActiveSkill: () => host.systems.playerProgressionSystem.castActiveSkill(),
    buyPotion: (potionId) => host.systems.playerProgressionSystem.buyPotion(potionId),
    usePotion: (potionId) => host.systems.playerProgressionSystem.usePotion(potionId),
    onWindowUnload: () => {},
  });

  const viewportCulling = new ViewportCullingController({
    scene: host.scene,
    syncTerrainChunks: (viewport, maxNewBakes) =>
      host.terrainRenderer.syncChunksToViewport(viewport, maxNewBakes),
    getResourceVisuals: () => host.resourceEntityRenderer.getEntityVisuals(),
    getTerritoryBuildingVisuals: () => host.territoryStructureRenderer.getBuildingVisuals(),
    getConstructedVisuals: () => host.constructedBuildingRenderer.getVisuals(),
    getAltarCardContainers: () => host.altarRenderer.getCardContainers(),
    getMonsterVisuals: () => host.systems.waveSystem.getMonsterVisuals(),
  });

  return {
    territoryPassive,
    territoryAction,
    buildingRepair,
    playerInteraction,
    playerMovement,
    towerPlacement,
    viewportCulling,
    eventBus,
  };
}
