import Phaser from 'phaser';
import { storage } from '../../../lib/storage';
import {
  ConstructedBuilding,
  Inventory,
  Island,
  PlayerColor,
} from '../../../types/game';
import { GameEvents } from '../../events/gameEvents';
import { WORLD_BOUNDS } from '../../worldBounds';
import { generateWorldTerrain, WorldTerrainMap } from '../../world/MapTerrainGenerator';
import { WorldPersistenceController } from '../controllers/WorldPersistenceController';
import { ConstructedBuildingRenderer } from '../renderers/ConstructedBuildingRenderer';
import { ExpansionAltarRenderer } from '../renderers/ExpansionAltarRenderer';
import { ResourceEntityRenderer } from '../renderers/ResourceEntityRenderer';
import { TerrainRenderer } from '../renderers/TerrainRenderer';
import { TerritoryStructureRenderer } from '../renderers/TerritoryStructureRenderer';
import { WorldEffectsRenderer } from '../renderers/WorldEffectsRenderer';
import { attachWebGLContextGuard } from '../utils/webglContextGuard';
import { WorldSystemsBundle, createWorldSystemsBundle } from './WorldSceneSystemsFactory';
import { WorldControllersBundle, createWorldControllersBundle } from './WorldSceneWiring';

/**
 * 게임 메인 씬 오케스트레이터 (렌더러, 시스템, 컨트롤러 조합 및 생명주기 관리)
 */
export class WorldScene extends Phaser.Scene {
  private playerColor: PlayerColor = 'blue';
  private playerName = '수호자';
  private playerId = '';
  private initialZoom = 1.0;

  private islands: Island[] = [];
  private constructedBuildings: ConstructedBuilding[] = [];
  private inventory: Inventory = { wood: 30, stone: 20, gold: 10 };
  private wallColliders: Phaser.Physics.Arcade.StaticGroup | null = null;

  private terrainMap!: WorldTerrainMap;
  private terrainRenderer!: TerrainRenderer;
  private altarRenderer!: ExpansionAltarRenderer;
  private effectsRenderer!: WorldEffectsRenderer;
  private territoryStructureRenderer!: TerritoryStructureRenderer;
  private constructedBuildingRenderer!: ConstructedBuildingRenderer;
  private resourceEntityRenderer!: ResourceEntityRenderer;

  private systems!: WorldSystemsBundle;
  private controllers!: WorldControllersBundle;
  private persistence!: WorldPersistenceController;

  private unbindWebGLGuard: (() => void) | null = null;
  private isCleanedUp = false;

  constructor() {
    super('WorldScene');
  }

  public init(data?: { playerName?: string; playerColor?: PlayerColor; zoom?: number }): void {
    this.isCleanedUp = false;
    this.playerId = storage.getPlayerId();
    const profile = storage.loadProfile();
    this.playerName = data?.playerName || profile.name || '수호자';
    this.playerColor = data?.playerColor || profile.color || 'blue';
    this.initialZoom = data?.zoom || storage.loadZoom() || 1.0;
    this.inventory = storage.loadInventory();
  }

  public create(): void {
    this.input.addPointer(2);

    this.persistence = new WorldPersistenceController({
      isSceneAlive: () => this.isSceneAlive(),
      getPlayerName: () => this.playerName,
      getIslands: () => this.islands,
      getConstructedBuildings: () => this.constructedBuildings,
      getEntities: () => this.resourceEntityRenderer.getEntities(),
      getTerrainMap: () => this.terrainMap,
      getMonsters: () => this.systems.waveSystem.getMonsters(),
      getWaveState: () => this.systems.waveSystem.getWaveState(),
      getInventory: () => this.inventory,
      setInventory: (inv) => {
        this.inventory = { ...inv };
        GameEvents.emit('inventory-updated', this.inventory);
        this.refreshTerritoryDecorations();
      },
      triggerRegularWave: () => this.systems.waveSystem.triggerRegularWave(),
      triggerBossWave: () => this.systems.waveSystem.triggerBossWave(),
      damageTerritoryCore: (id, dmg) =>
        this.systems.coreGemSystem.damageTerritoryCore(id, dmg, '마물 군단', true),
      unlockTerritory: (id, unlockedBy) =>
        this.controllers.territoryAction.unlockIslandLocally(id, unlockedBy, true),
      upgradeVillage: (id) => this.controllers.territoryAction.handleUpgradeVillage(id, true),
      constructBuilding: (id, type, slot) =>
        this.controllers.territoryAction.handleConstructBuilding(id, type, slot, true),
    });

    const loaded = this.persistence.loadInitialWorldData();
    this.islands = loaded.islands;
    this.constructedBuildings = loaded.constructedBuildings;

    const { min: worldMin, width: worldWidth } = WORLD_BOUNDS;
    this.physics.world.setBounds(worldMin, worldMin, worldWidth, worldWidth);

    // 1. Procedural Terrain, Effects, Buildings, Altars & Resource Entities
    this.terrainMap = generateWorldTerrain(WORLD_BOUNDS, this.islands);
    this.terrainRenderer = new TerrainRenderer(this, this.terrainMap);
    this.terrainRenderer.bakeTerrainChunks();
    this.terrainRenderer.buildWaterColliders();

    this.effectsRenderer = new WorldEffectsRenderer(this, () => this.isSceneAlive());
    this.drawTerrainDecorations();

    const buildingColliders = this.physics.add.staticGroup();
    this.territoryStructureRenderer = new TerritoryStructureRenderer(this, buildingColliders);
    this.wallColliders = this.physics.add.staticGroup();
    this.constructedBuildingRenderer = new ConstructedBuildingRenderer(this, this.wallColliders);
    this.territoryStructureRenderer.spawnAllBuildings(this.islands);
    this.constructedBuildingRenderer.spawnAll(this.constructedBuildings, this.islands);

    this.altarRenderer = new ExpansionAltarRenderer(this);
    this.drawExpansionAltars();

    this.resourceEntityRenderer = new ResourceEntityRenderer({
      scene: this,
      terrainMap: this.terrainMap,
      isSceneAlive: () => this.isSceneAlive(),
      getIslands: () => this.islands,
      getConstructedBuildings: () => this.constructedBuildings,
      shakeObject: (target) => this.effectsRenderer.shakeObject(target),
      showFloatingText: (x, y, text, color) =>
        this.effectsRenderer.showFloatingText(x, y, text, color),
    });

    // 2. Core Gameplay Systems & Multiplayer
    this.systems = createWorldSystemsBundle({
      scene: this,
      isSceneAlive: () => this.isSceneAlive(),
      getPlayerId: () => this.playerId,
      getPlayerName: () => this.playerName,
      getPlayerColor: () => this.playerColor,
      getPlayerPosition: () => this.controllers?.playerMovement.getPosition() ?? { x: 320, y: 350 },
      getLocalPlayerState: () => this.controllers.playerMovement.getState(),
      getCurrentTerritoryId: () => this.controllers?.playerMovement.getCurrentTerritory().id ?? 0,
      getIslands: () => this.islands,
      getConstructedBuildings: () => this.constructedBuildings,
      applyOfflineWorldUpdate: (updatedIslands, updatedBuildings, passiveGain) => {
        if (!this.isSceneAlive()) return;
        this.islands = updatedIslands;
        this.constructedBuildings = updatedBuildings;
        if (passiveGain.wood > 0 || passiveGain.stone > 0 || passiveGain.gold > 0) {
          this.addResources(passiveGain.wood, passiveGain.stone, passiveGain.gold);
        }
        this.territoryStructureRenderer.spawnAllTerritoryCores(
          this.islands,
          this.systems.coreGemSystem
        );
        this.constructedBuildingRenderer.spawnAll(this.constructedBuildings, this.islands);
        this.refreshTerritoryDecorations();
        this.territoryStructureRenderer.spawnAllBuildings(this.islands);
        this.persistence.saveWorldState(true);
        this.persistence.emitWorldStateToReact(true);
      },
      addResources: (wood, stone, gold) => this.addResources(wood, stone, gold),
      destroyConstructedBuilding: (id) =>
        this.controllers.territoryAction.destroyConstructedBuilding(id),
      refreshTerritoryDecorations: () => {
        this.refreshTerritoryDecorations();
        this.territoryStructureRenderer.spawnAllBuildings(this.islands);
      },
      saveWorldState: (immediate = false) => this.persistence.saveWorldState(immediate),
      emitWorldStateToReact: (immediate = false) =>
        this.persistence.emitWorldStateToReact(immediate),
      unlockIslandLocally: (id, by, local) =>
        this.controllers.territoryAction.unlockIslandLocally(id, by, local),
      upgradeVillageRemotely: (id) =>
        this.controllers.territoryAction.handleUpgradeVillage(id, false),
      onRemoteBuildingConstructed: (cb) => {
        if (cb && !this.constructedBuildings.some((b) => b.id === cb.id)) {
          this.constructedBuildings.push(cb);
          this.constructedBuildingRenderer.spawnOne(cb);
          this.persistence.saveWorldState();
          this.persistence.emitWorldStateToReact();
        }
      },
      effectsRenderer: this.effectsRenderer,
      territoryStructureRenderer: this.territoryStructureRenderer,
      constructedBuildingRenderer: this.constructedBuildingRenderer,
      resourceEntityRenderer: this.resourceEntityRenderer,
    });

    // 3. Spawn World Cores & Resource Entities
    this.territoryStructureRenderer.spawnAllTerritoryCores(
      this.islands,
      this.systems.coreGemSystem
    );
    this.resourceEntityRenderer.spawnAll();

    // 4. Wire Controllers, Player, Camera & EventBus
    this.controllers = createWorldControllersBundle({
      scene: this,
      isSceneAlive: () => this.isSceneAlive(),
      getPlayerName: () => this.playerName,
      getPlayerColor: () => this.playerColor,
      setPlayerProfile: (name, color) => {
        this.playerName = name;
        this.playerColor = color;
      },
      getInitialZoom: () => this.initialZoom,
      getIslands: () => this.islands,
      getConstructedBuildings: () => this.constructedBuildings,
      getInventory: () => this.inventory,
      setInventory: (inv) => {
        this.inventory = { ...inv };
      },
      addResources: (wood, stone, gold) => this.addResources(wood, stone, gold),
      spendResources: (wood, stone, gold) => this.spendResources(wood, stone, gold),
      addHarvestedResource: (resKey, amount) => {
        this.inventory = { ...this.inventory, [resKey]: this.inventory[resKey] + amount };
        GameEvents.emit('inventory-updated', this.inventory);
      },
      refreshTerritoryDecorations: () => this.refreshTerritoryDecorations(),
      drawTerrainDecorations: () => this.drawTerrainDecorations(),
      drawExpansionAltars: () => this.drawExpansionAltars(),
      getWallColliders: () => this.wallColliders,
      terrainRenderer: this.terrainRenderer,
      effectsRenderer: this.effectsRenderer,
      territoryStructureRenderer: this.territoryStructureRenderer,
      constructedBuildingRenderer: this.constructedBuildingRenderer,
      resourceEntityRenderer: this.resourceEntityRenderer,
      systems: this.systems,
      persistence: this.persistence,
    });

    this.controllers.playerMovement.createPlayer();
    this.effectsRenderer.createClouds();
    this.controllers.playerMovement.setupCamera();
    this.controllers.playerMovement.setupInputs();
    this.controllers.eventBus.setup();
    this.persistence.exposeTestHook();

    this.unbindWebGLGuard = attachWebGLContextGuard({
      scene: this,
      onRestored: () => {
        if (this.isSceneAlive()) this.terrainRenderer?.refreshChunksOnContextRestore();
      },
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupScene());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanupScene());

    // 5. Notify React & Initialize Living Isles Coordinator
    GameEvents.emit('scene-ready', this);
    this.persistence.emitWorldStateToReact(true);
    this.systems.waveSystem.emitWaveState();
    void this.systems.livingWorldCoordinator.initialize();
  }

  public update(time: number, delta: number): void {
    this.systems.waveSystem.update(time, delta);
    this.systems.towerDefenseSystem.update(time, delta);
    this.systems.garrisonSystem.update(time, delta);
    this.systems.livingWorldCoordinator.update(delta);
    this.controllers.territoryPassive.update(delta);
    this.controllers.playerMovement.update(time);
    this.effectsRenderer.updateClouds();
    this.systems.multiplayerSync?.maybeBroadcastPlayerMove(time);
  }

  private addResources(wood: number, stone: number, gold: number): void {
    this.inventory = {
      wood: this.inventory.wood + wood,
      stone: this.inventory.stone + stone,
      gold: this.inventory.gold + gold,
    };
    GameEvents.emit('inventory-updated', this.inventory);
  }

  private spendResources(wood: number, stone: number, gold: number): void {
    this.inventory = {
      wood: this.inventory.wood - wood,
      stone: this.inventory.stone - stone,
      gold: this.inventory.gold - gold,
    };
    GameEvents.emit('inventory-updated', this.inventory);
  }

  private drawTerrainDecorations(): void {
    if (!this.isSceneAlive()) return;
    this.terrainRenderer.renderTerritoryOverlays(this.islands, this.inventory);
    this.effectsRenderer.drawOuterPerimeterWarning(this.islands);
  }

  private drawExpansionAltars(): void {
    if (!this.isSceneAlive()) return;
    this.altarRenderer.render(this.islands, this.inventory);
  }

  private refreshTerritoryDecorations(): void {
    this.drawTerrainDecorations();
    this.drawExpansionAltars();
  }

  private isSceneAlive(): boolean {
    return !this.isCleanedUp && Boolean(this.sys && this.add && this.scene?.isActive());
  }

  private cleanupScene(): void {
    if (this.isCleanedUp) return;
    this.persistence?.flushAndDestroy();
    this.isCleanedUp = true;
    this.controllers?.eventBus?.destroy();
    this.unbindWebGLGuard?.();
    this.unbindWebGLGuard = null;
    this.controllers?.playerMovement?.destroy();
    this.systems?.livingWorldCoordinator?.destroy();
    this.systems?.waveSystem?.destroy();
    this.systems?.coreGemSystem?.clearAllVisuals();
    this.territoryStructureRenderer?.destroy();
    this.constructedBuildingRenderer?.clear();
    this.resourceEntityRenderer?.destroy();
    this.altarRenderer?.destroy();
    this.terrainRenderer?.destroy();
    this.effectsRenderer?.destroy();
    this.systems?.multiplayerSync?.destroy();
  }
}
