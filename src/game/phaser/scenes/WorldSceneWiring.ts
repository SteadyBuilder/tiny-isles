import Phaser from 'phaser';
import {
  ConstructedBuilding,
  Inventory,
  Island,
  PlayerColor,
} from '../../../types/game';
import { PlayerInteractionController } from '../controllers/PlayerInteractionController';
import { PlayerMovementController } from '../controllers/PlayerMovementController';
import { TerritoryActionController } from '../controllers/TerritoryActionController';
import { TerritoryPassiveSystem } from '../controllers/TerritoryPassiveSystem';
import { WorldEventBusController } from '../controllers/WorldEventBusController';
import { WorldPersistenceController } from '../controllers/WorldPersistenceController';
import { ConstructedBuildingRenderer } from '../renderers/ConstructedBuildingRenderer';
import { ResourceEntityRenderer } from '../renderers/ResourceEntityRenderer';
import { TerrainRenderer } from '../renderers/TerrainRenderer';
import { TerritoryStructureRenderer } from '../renderers/TerritoryStructureRenderer';
import { WorldEffectsRenderer } from '../renderers/WorldEffectsRenderer';
import { WorldSystemsBundle } from './WorldSceneSystemsFactory';

export interface IWorldControllersHost {
  scene: Phaser.Scene;
  isSceneAlive: () => boolean;
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
  terrainRenderer: TerrainRenderer;
  effectsRenderer: WorldEffectsRenderer;
  territoryStructureRenderer: TerritoryStructureRenderer;
  constructedBuildingRenderer: ConstructedBuildingRenderer;
  resourceEntityRenderer: ResourceEntityRenderer;
  systems: WorldSystemsBundle;
  persistence: WorldPersistenceController;
}

export interface WorldControllersBundle {
  territoryPassive: TerritoryPassiveSystem;
  territoryAction: TerritoryActionController;
  playerInteraction: PlayerInteractionController;
  playerMovement: PlayerMovementController;
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
    addResources: host.addResources,
    updateCoreGemVisual: (id) => host.systems.coreGemSystem.updateCoreGemVisual(id),
    updateConstructedBuildingHpBar: (id) => host.constructedBuildingRenderer.updateHpBar(id),
    showFloatingText: (x, y, text, color) => host.effectsRenderer.showFloatingText(x, y, text, color),
    saveWorldState: (immediate = false) => host.persistence.saveWorldState(immediate),
    emitWorldStateToReact: (immediate = false) => host.persistence.emitWorldStateToReact(immediate),
  });

  territoryAction = new TerritoryActionController({
    getIslands: host.getIslands,
    getConstructedBuildings: host.getConstructedBuildings,
    getInventory: host.getInventory,
    spendInventory: host.spendResources,
    saveWorldState: (immediate = true) => host.persistence.saveWorldState(immediate),
    emitWorldStateToReact: (immediate = true) => host.persistence.emitWorldStateToReact(immediate),
    drawTerrainDecorations: host.drawTerrainDecorations,
    drawExpansionAltars: host.drawExpansionAltars,
    spawnAllBuildings: () => host.territoryStructureRenderer.spawnAllBuildings(host.getIslands()),
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
    reduceWaveCooldown: (seconds) => host.systems.waveSystem.reduceCooldown(seconds),
    broadcastUnlock: (id, by) => host.systems.multiplayerSync?.broadcastUnlock(id, by),
    broadcastVillageUpgrade: (id, tier) =>
      host.systems.multiplayerSync?.broadcastVillageUpgrade(id, tier),
    broadcastBuildingConstructed: (cb) =>
      host.systems.multiplayerSync?.broadcastBuildingConstructed(cb),
  });

  playerInteraction = new PlayerInteractionController({
    scene: host.scene,
    getPlayerPosition: () => playerMovement.getPosition(),
    getPlayerName: host.getPlayerName,
    getCurrentAction: () => playerMovement.getCurrentAction(),
    playPlayerAnimation: (action) => playerMovement.playAnimation(action),
    markInteractTime: (now) => playerMovement.markInteractTime(now),
    getIslands: host.getIslands,
    getInventory: host.getInventory,
    spendInventory: host.spendResources,
    addHarvestedResource: host.addHarvestedResource,
    getMonsterVisuals: () => host.systems.waveSystem.getMonsterVisuals(),
    damageMonster: (id, dmg, attacker) => host.systems.waveSystem.damageMonster(id, dmg, attacker),
    findNearestEntityVisual: (x, y, maxDist) =>
      host.resourceEntityRenderer.findNearestVisual(x, y, maxDist),
    updateEntityHpBar: (id) => host.resourceEntityRenderer.updateHpBar(id),
    removeAndRespawnEntity: (ent) => host.resourceEntityRenderer.removeAndRespawn(ent),
    reduceWaveCooldown: (seconds) => host.systems.waveSystem.reduceCooldown(seconds),
    broadcastEntityHit: (id, dmg) => host.systems.multiplayerSync?.broadcastHit(id, dmg),
    unlockIslandLocally: (id, by, local) => territoryAction.unlockIslandLocally(id, by, local),
    updateCoreGemVisual: (id) => host.systems.coreGemSystem.updateCoreGemVisual(id),
    saveWorldState: (immediate = false) => host.persistence.saveWorldState(immediate),
    emitWorldStateToReact: (immediate = false) => host.persistence.emitWorldStateToReact(immediate),
    shakeObject: (target) => host.effectsRenderer.shakeObject(target),
    showFloatingText: (x, y, text, color) => host.effectsRenderer.showFloatingText(x, y, text, color),
  });

  playerMovement = new PlayerMovementController({
    scene: host.scene,
    getPlayerName: host.getPlayerName,
    getPlayerColor: host.getPlayerColor,
    getInitialZoom: host.getInitialZoom,
    getBuildingColliders: () => host.territoryStructureRenderer.getBuildingColliders(),
    getWallColliders: host.getWallColliders,
    getWaterColliders: () => host.terrainRenderer.getWaterColliders(),
    getIslands: host.getIslands,
    getMonsterVisuals: () => host.systems.waveSystem.getMonsterVisuals(),
    findNearestEntityVisual: (x, y, maxDist) =>
      host.resourceEntityRenderer.findNearestVisual(x, y, maxDist),
    onInteract: () => playerInteraction.tryInteract(),
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
      host.refreshTerritoryDecorations();
      const { x, y } = playerMovement.getPosition();
      host.effectsRenderer.showFloatingText(
        x,
        y - 50,
        '🎁 테스트 자원 지급! (+🪵500 +🪨500 +🪙500)',
        '#fde047'
      );
    },
    setJoystickVector: (vector) => playerMovement.setJoystickVector(vector),
    tryInteract: () => playerInteraction.tryInteract(),
    upgradeVillage: (id) => territoryAction.handleUpgradeVillage(id, true),
    constructBuilding: (id, type, slot) =>
      territoryAction.handleConstructBuilding(id, type, slot, true),
    repairTerritoryCore: (id) => territoryAction.handleRepairCore(id),
    triggerRegularWave: () => host.systems.waveSystem.triggerRegularWave(),
    triggerBossWave: () => host.systems.waveSystem.triggerBossWave(),
    summonEarlyWave: (isBoss) => host.systems.waveSystem.summonEarlyWave(isBoss),
    reduceWaveCooldown: (sec) => host.systems.waveSystem.reduceCooldown(sec),
    setWaveTimeScale: (scale) => host.systems.waveSystem.setTimeScale(scale),
    damageTerritoryCore: (id, dmg) =>
      host.systems.coreGemSystem.damageTerritoryCore(id, dmg, '마물 침공 테스트', true),
    onWindowUnload: () => {
      if (host.systems.waveSystem?.getIsHost()) {
        void host.systems.livingWorldCoordinator?.persistAllSnapshots();
      }
    },
  });

  return {
    territoryPassive,
    territoryAction,
    playerInteraction,
    playerMovement,
    eventBus,
  };
}
