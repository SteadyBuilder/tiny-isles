import Phaser from 'phaser';
import { INSTANCE_ROOM_DEFAULTS, getDifficultyConfig } from '../../../data/missions';
import { computeMetaBonuses } from '../../../data/metaProgression';
import { saveRepository } from '../../../lib/repositories/LocalStorageSaveRepository';
import { storage } from '../../../lib/storage';
import {
  ConstructedBuilding,
  Inventory,
  Island,
  PlayerColor,
} from '../../../types/game';
import { MetaBonusSummary, RoomConfig } from '../../../types/room';
import { getTerritoryCorePos } from '../../constants';
import { GameEvents } from '../../events/gameEvents';
import { MissionSystem } from '../../systems/MissionSystem';
import { WORLD_BOUNDS } from '../../worldBounds';
import { generateWorldTerrain, WorldTerrainMap } from '../../world/MapTerrainGenerator';
import { WorldPersistenceController } from '../controllers/WorldPersistenceController';
import { CombatFeedbackRenderer } from '../renderers/CombatFeedbackRenderer';
import { ConstructedBuildingRenderer } from '../renderers/ConstructedBuildingRenderer';
import { ExpansionAltarRenderer } from '../renderers/ExpansionAltarRenderer';
import { LootChestDropRenderer } from '../renderers/LootChestDropRenderer';
import { MonsterTargetIndicatorRenderer } from '../renderers/MonsterTargetIndicatorRenderer';
import { PlayerCelebrationEffects } from '../renderers/PlayerCelebrationEffects';
import { ResourceEntityRenderer } from '../renderers/ResourceEntityRenderer';
import { ResourceDropEffectsRenderer } from '../renderers/ResourceDropEffectsRenderer';
import { SkillEffectsRenderer } from '../renderers/SkillEffectsRenderer';
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

  private roomConfig: RoomConfig = {
    roomId: 'solo_local',
    mode: 'solo',
    missionId: INSTANCE_ROOM_DEFAULTS.defaultMissionId,
    difficulty: INSTANCE_ROOM_DEFAULTS.defaultDifficulty,
    maxPlayers: INSTANCE_ROOM_DEFAULTS.maxPlayers,
    hostPlayerId: '',
  };
  private metaBonuses: MetaBonusSummary = computeMetaBonuses(saveRepository.loadMetaProgression());
  private missionSystem!: MissionSystem;
  private isPaused = false;
  private onPauseToggled = (paused: boolean) => {
    if (this.roomConfig.mode !== 'solo') return;
    this.isPaused = paused;
    if (this.physics?.world) {
      if (paused) this.physics.world.pause();
      else this.physics.world.resume();
    }
  };

  private islands: Island[] = [];
  private constructedBuildings: ConstructedBuilding[] = [];
  private inventory: Inventory = { wood: 30, stone: 20, gold: 10, meat: 0 };
  private wallColliders: Phaser.Physics.Arcade.StaticGroup | null = null;

  private terrainMap!: WorldTerrainMap;
  private terrainRenderer!: TerrainRenderer;
  private altarRenderer!: ExpansionAltarRenderer;
  private effectsRenderer!: WorldEffectsRenderer;
  private combatFeedbackRenderer!: CombatFeedbackRenderer;
  private skillEffectsRenderer!: SkillEffectsRenderer;
  private lootChestRenderer!: LootChestDropRenderer;
  private celebrationEffects!: PlayerCelebrationEffects;
  private territoryStructureRenderer!: TerritoryStructureRenderer;
  private constructedBuildingRenderer!: ConstructedBuildingRenderer;
  private resourceEntityRenderer!: ResourceEntityRenderer;
  private resourceDropEffectsRenderer!: ResourceDropEffectsRenderer;
  private monsterIndicatorRenderer!: MonsterTargetIndicatorRenderer;

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
    this.isPaused = false;
    this.playerId = storage.getPlayerId();
    const profile = storage.loadProfile();
    this.playerName = data?.playerName || profile.name || '수호자';
    this.playerColor = data?.playerColor || profile.color || 'blue';
    this.initialZoom = data?.zoom || storage.loadZoom() || 1.0;

    const regRoom = this.registry.get('roomConfig') as RoomConfig | undefined;
    if (regRoom) {
      this.roomConfig = regRoom;
    } else {
      this.roomConfig = {
        ...this.roomConfig,
        hostPlayerId: this.playerId,
      };
    }

    const regBonuses = this.registry.get('metaBonuses') as MetaBonusSummary | undefined;
    this.metaBonuses = regBonuses ?? computeMetaBonuses(saveRepository.loadMetaProgression());

    this.inventory = {
      wood: 30 + this.metaBonuses.bonusWood,
      stone: 20 + this.metaBonuses.bonusStone,
      gold: 10 + this.metaBonuses.bonusGold,
      meat: 0,
    };
  }

  public create(): void {
    this.input.addPointer(2);
    this.missionSystem = new MissionSystem(this.roomConfig);

    this.persistence = new WorldPersistenceController({
      isSceneAlive: () => this.isSceneAlive(),
      isInstanceSession: () => true,
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

    const difficultyCfg = getDifficultyConfig(this.roomConfig.difficulty);
    const loaded = this.persistence.loadInitialWorldData({
      isInstanceSession: true,
      coreHpBonusRatio: this.metaBonuses.coreHpBonusRatio,
      unlockCostDiscount: difficultyCfg.unlockCostDiscount,
    });
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
    this.combatFeedbackRenderer = new CombatFeedbackRenderer(this, () => this.isSceneAlive());
    this.skillEffectsRenderer = new SkillEffectsRenderer(this, () => this.isSceneAlive());
    this.lootChestRenderer = new LootChestDropRenderer(this, () => this.isSceneAlive());
    this.resourceDropEffectsRenderer = new ResourceDropEffectsRenderer({
      scene: this,
      isSceneAlive: () => this.isSceneAlive(),
      getPlayerPosition: () =>
        this.controllers?.playerMovement.getPosition() ?? getTerritoryCorePos(0, 0),
    });
    this.celebrationEffects = new PlayerCelebrationEffects(this, () => this.isSceneAlive());
    this.monsterIndicatorRenderer = new MonsterTargetIndicatorRenderer(this, () => this.isSceneAlive());
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
      isHost: () => this.systems?.waveSystem.getIsHost() ?? true,
      broadcastEntityRespawned: (entity) =>
        this.systems?.multiplayerSync?.broadcastEntityRespawned(entity),
      shakeObject: (target) => this.effectsRenderer.shakeObject(target),
      showFloatingText: (x, y, text, color) =>
        this.effectsRenderer.showFloatingText(x, y, text, color),
    });

    // 2. Core Gameplay Systems & Multiplayer
    this.systems = createWorldSystemsBundle({
      scene: this,
      isSceneAlive: () => this.isSceneAlive(),
      isHuntingMode: () => this.missionSystem.isHuntingMode(),
      getDifficultyConfig: () => this.missionSystem.getDifficulty(),
      getPlayerId: () => this.playerId,
      getPlayerName: () => this.playerName,
      getPlayerColor: () => this.playerColor,
      getRoomId: () => this.roomConfig.roomId,
      getRoomMode: () => this.roomConfig.mode,
      onCoreDestroyed: () => this.missionSystem?.failByCoreDestroyed(),
      getPlayerPosition: () => this.controllers?.playerMovement.getPosition() ?? getTerritoryCorePos(0, 0),
      getPlayerDirection: () => this.controllers?.playerMovement.getDirection() ?? 'right',
      triggerSkillSurge: (dirX, dirY, speedPx, durationMs) =>
        this.controllers?.playerMovement.triggerSkillSurge(dirX, dirY, speedPx, durationMs),
      respawnPlayerAt: (x, y) => this.controllers?.playerMovement.respawnAt(x, y),
      onPlayerFaintedVisual: (fainted) => this.controllers?.playerMovement.setFaintedVisual(fainted),
      onPlayerHitVisual: () => this.controllers?.playerMovement.playHitVisual(),
      onPlayerCastVisual: (durationMs) =>
        this.controllers?.playerMovement.playCastVisual(durationMs),
      onPlayerClassVisualChanged: (classId) =>
        this.controllers?.playerMovement.setPlayerClassVisual(classId),
      getLocalPlayerState: () => this.controllers.playerMovement.getState(),
      getCurrentTerritoryId: () => this.controllers?.playerMovement.getCurrentTerritory().id ?? 0,
      getIslands: () => this.islands,
      getTerrainMap: () => this.terrainMap,
      getConstructedBuildings: () => this.constructedBuildings,
      getInventory: () => this.inventory,
      spendResources: (wood, stone, gold) => this.spendResources(wood, stone, gold),
      applySyncedWorldState: (updatedIslands, updatedBuildings) => {
        if (!this.isSceneAlive()) return;
        this.islands = updatedIslands;
        this.constructedBuildings = updatedBuildings;
        this.territoryStructureRenderer.spawnAllTerritoryCores(
          this.islands,
          this.systems.coreGemSystem
        );
        this.constructedBuildingRenderer.spawnAll(this.constructedBuildings, this.islands);
        this.refreshTerritoryDecorations();
        this.territoryStructureRenderer.spawnAllBuildings(
          this.islands,
          this.systems?.coreGemSystem
        );
        this.persistence.saveWorldState(true);
        this.persistence.emitWorldStateToReact(true);
      },
      addResources: (wood, stone, gold) => this.addResources(wood, stone, gold),
      destroyConstructedBuilding: (id) =>
        this.controllers.territoryAction.destroyConstructedBuilding(id),
      refreshTerritoryDecorations: () => {
        this.refreshTerritoryDecorations();
        this.territoryStructureRenderer.spawnAllBuildings(
          this.islands,
          this.systems?.coreGemSystem
        );
      },
      saveWorldState: (immediate = false) => this.persistence.saveWorldState(immediate),
      emitWorldStateToReact: (immediate = false) =>
        this.persistence.emitWorldStateToReact(immediate),
      unlockIslandLocally: (id, by, local, ownerId) =>
        this.controllers.territoryAction.unlockIslandLocally(id, by, local, ownerId),
      upgradeVillageRemotely: (id) =>
        this.controllers.territoryAction.handleUpgradeVillage(id, false),
      onRemoteBuildingConstructed: (cb) =>
        this.controllers?.territoryAction.handleRemoteBuildingConstructed(cb),
      onRemoteBuildingHpSync: (buildingId, hp, maxHp, damageDelta) =>
        this.controllers?.territoryAction.applyRemoteBuildingHpSync(
          buildingId,
          hp,
          maxHp,
          damageDelta
        ),
      onRemoteBuildingDestroyed: (buildingId) =>
        this.controllers?.territoryAction.destroyConstructedBuilding(buildingId, false),
      onRemoteRepairTerritoryRequest: (territoryId) =>
        this.controllers?.territoryAction.handleRemoteRepairTerritoryRequest(territoryId),
      effectsRenderer: this.effectsRenderer,
      combatFeedbackRenderer: this.combatFeedbackRenderer,
      skillEffectsRenderer: this.skillEffectsRenderer,
      lootChestRenderer: this.lootChestRenderer,
      celebrationEffects: this.celebrationEffects,
      territoryStructureRenderer: this.territoryStructureRenderer,
      constructedBuildingRenderer: this.constructedBuildingRenderer,
      resourceEntityRenderer: this.resourceEntityRenderer,
      wallColliders: this.wallColliders,
      onMonstersChanged: () => this.controllers?.viewportCulling.cullMonstersNow(),
    });

    // 3. Spawn World Cores, Monster Camps & Field Monsters (Hunting Mode) & Resource Entities
    this.systems.monsterCampSystem.initializeCamps();
    this.systems.fieldMonsterSystem.initializeFieldMonsters();
    this.territoryStructureRenderer.spawnAllTerritoryCores(
      this.islands,
      this.systems.coreGemSystem
    );
    this.resourceEntityRenderer.spawnAll();

    // 4. Wire Controllers, Player, Camera & EventBus
    this.controllers = createWorldControllersBundle({
      scene: this,
      isSceneAlive: () => this.isSceneAlive(),
      getPlayerId: () => this.playerId,
      getPlayerName: () => this.playerName,
      getPlayerColor: () => this.playerColor,
      getMetaBonuses: () => this.metaBonuses,
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
      spendMeatAndGold: (meat, gold) => this.spendMeatAndGold(meat, gold),
      addHarvestedResource: (resKey, amount) => {
        this.inventory = { ...this.inventory, [resKey]: this.inventory[resKey] + amount };
        GameEvents.emit('inventory-updated', this.inventory);
        this.refreshTerritoryDecorations();
      },
      refreshTerritoryDecorations: () => this.refreshTerritoryDecorations(),
      drawTerrainDecorations: () => this.drawTerrainDecorations(),
      drawExpansionAltars: () => this.drawExpansionAltars(),
      getWallColliders: () => this.wallColliders,
      getWaterBodies: () => this.terrainMap.waterBodies,
      terrainRenderer: this.terrainRenderer,
      altarRenderer: this.altarRenderer,
      effectsRenderer: this.effectsRenderer,
      territoryStructureRenderer: this.territoryStructureRenderer,
      constructedBuildingRenderer: this.constructedBuildingRenderer,
      resourceEntityRenderer: this.resourceEntityRenderer,
      resourceDropEffectsRenderer: this.resourceDropEffectsRenderer,
      systems: this.systems,
      persistence: this.persistence,
    });

    this.controllers.playerMovement.createPlayer();
    this.effectsRenderer.createClouds();
    this.controllers.playerMovement.setupCamera();
    this.controllers.playerMovement.setupInputs();
    this.controllers.eventBus.setup();
    this.controllers.viewportCulling.forceCullNow();
    this.persistence.exposeTestHook();

    this.unbindWebGLGuard = attachWebGLContextGuard({
      scene: this,
      onRestored: () => {
        if (this.isSceneAlive()) this.terrainRenderer?.refreshChunksOnContextRestore();
      },
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupScene());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanupScene());

    // 5. Notify React & Initialize Instance Mission
    GameEvents.on('game-pause-toggled', this.onPauseToggled);
    GameEvents.emit('scene-ready', this);
    GameEvents.emit('inventory-updated', this.inventory);
    GameEvents.emit('mission-progress-updated', this.missionSystem.getProgressState());
    const initialMaxHp = this.systems.playerProgressionSystem.getTotalMaxHp();
    this.systems.playerHealthSystem.setMaxHp(initialMaxHp, initialMaxHp);
    this.systems.playerProgressionSystem.emitState();
    this.persistence.emitWorldStateToReact(true);
    this.systems.waveSystem.emitWaveState();
  }

  public update(time: number, delta: number): void {
    if (this.isPaused) return;
    this.systems.waveSystem.update(time, delta);
    this.systems.projectileSystem.update(time, delta);
    this.systems.playerProgressionSystem.update(delta);
    this.systems.monsterCampSystem.update(delta);
    this.systems.fieldMonsterSystem.update(delta);
    this.systems.towerDefenseSystem.update(time, delta);
    this.systems.garrisonSystem.update(time, delta);
    this.systems.mercenarySystem.update(time, delta);
    this.missionSystem.setCampConqueredCount(
      this.systems.monsterCampSystem.getFirstClearedCampCount()
    );
    this.missionSystem.update(delta, this.systems.waveSystem.getWaveState(), this.islands);
    this.controllers.territoryPassive.update(delta);
    this.constructedBuildingRenderer.updateResourceTimers(
      this.controllers.territoryPassive.getCycleProgress()
    );
    this.controllers.playerMovement.update(time, delta);
    this.controllers.skillTargeting.update();
    this.controllers.viewportCulling.update(time);
    this.resourceEntityRenderer.updateSheepWandering(time, delta, (x, y) =>
      !this.terrainMap.waterBodies.some(
        (w) => x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h
      )
    );
    this.effectsRenderer.updateClouds(delta);
    this.resourceDropEffectsRenderer.update(delta);
    this.monsterIndicatorRenderer.update(time, this.systems.waveSystem.getMonsterVisuals(), {
      isHuntingMode: this.missionSystem.isHuntingMode(),
      campTargets: this.systems.monsterCampSystem.getActiveCampTargets(),
      dungeonPortal: this.systems.waveSystem.getDungeonPortalState(),
    });
    this.systems.multiplayerSync?.maybeBroadcastPlayerMove(time);
  }

  private addResources(wood: number, stone: number, gold: number): void {
    this.inventory = {
      wood: this.inventory.wood + wood,
      stone: this.inventory.stone + stone,
      gold: this.inventory.gold + gold,
      meat: this.inventory.meat,
    };
    GameEvents.emit('inventory-updated', this.inventory);
    this.refreshTerritoryDecorations();
  }

  private spendResources(wood: number, stone: number, gold: number): void {
    this.inventory = {
      wood: this.inventory.wood - wood,
      stone: this.inventory.stone - stone,
      gold: this.inventory.gold - gold,
      meat: this.inventory.meat,
    };
    GameEvents.emit('inventory-updated', this.inventory);
    this.refreshTerritoryDecorations();
  }

  private spendMeatAndGold(meat: number, gold: number): void {
    this.inventory = {
      ...this.inventory,
      meat: Math.max(0, this.inventory.meat - meat),
      gold: Math.max(0, this.inventory.gold - gold),
    };
    GameEvents.emit('inventory-updated', this.inventory);
    this.refreshTerritoryDecorations();
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
    GameEvents.off('game-pause-toggled', this.onPauseToggled);
    this.persistence?.flushAndDestroy();
    this.isCleanedUp = true;
    this.controllers?.eventBus?.destroy();
    this.unbindWebGLGuard?.();
    this.unbindWebGLGuard = null;
    this.controllers?.playerMovement?.destroy();
    this.controllers?.towerPlacement?.destroy();
    this.controllers?.skillTargeting?.destroy();
    this.systems?.playerHealthSystem?.destroy();
    this.systems?.projectileSystem?.destroy();
    this.systems?.towerDefenseSystem?.destroy();
    this.systems?.mercenarySystem?.destroy();
    this.systems?.monsterCampSystem?.destroy();
    this.systems?.fieldMonsterSystem?.destroy();
    this.systems?.waveSystem?.destroy();
    this.systems?.coreGemSystem?.clearAllVisuals();
    this.territoryStructureRenderer?.destroy();
    this.constructedBuildingRenderer?.clear();
    this.resourceEntityRenderer?.destroy();
    this.altarRenderer?.destroy();
    this.terrainRenderer?.destroy();
    this.effectsRenderer?.destroy();
    this.combatFeedbackRenderer?.destroy();
    this.skillEffectsRenderer?.destroy();
    this.lootChestRenderer?.destroy();
    this.resourceDropEffectsRenderer?.destroy();
    this.celebrationEffects?.destroy();
    this.monsterIndicatorRenderer?.destroy();
    this.systems?.multiplayerSync?.destroy();
  }
}
