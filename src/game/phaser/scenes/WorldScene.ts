import Phaser from 'phaser';
import confetti from 'canvas-confetti';
import { GameEventPayloads, GameEvents } from '../../events/gameEvents';
import {
  INITIAL_ISLANDS,
  VILLAGE_TIER_CONFIGS,
  getTerritoryCorePos,
  getIslandOrigin,
} from '../../constants';
import { BuildingSystem } from '../../BuildingSystem';
import {
  ConstructableType,
  ConstructedBuilding,
  Inventory,
  Island,
  PlayerColor,
  VillageTier,
} from '../../../types/game';
import { sound } from '../../../lib/sound';
import { storage } from '../../../lib/storage';
import { serverSync } from '../../../lib/serverSync';
import { WaveSystem } from '../../systems/WaveSystem';
import { TowerDefenseSystem } from '../../systems/TowerDefenseSystem';
import { CoreGemSystem } from '../../systems/CoreGemSystem';
import { GarrisonSystem } from '../../systems/GarrisonSystem';
import { LivingWorldCoordinator } from '../../systems/LivingWorldCoordinator';
import { ACTIVE_WAVE_ACCELERATION_CONFIG } from '../../../data/worldRules';
import { GOLD_MINE_BIOME_CONFIG } from '../../../data/biomes';
import { WORLD_BOUNDS } from '../../worldBounds';
import { generateWorldTerrain, WorldTerrainMap } from '../../world/MapTerrainGenerator';
import { TerrainRenderer } from '../renderers/TerrainRenderer';
import { ExpansionAltarRenderer } from '../renderers/ExpansionAltarRenderer';
import { ConstructedBuildingRenderer } from '../renderers/ConstructedBuildingRenderer';
import { WorldEffectsRenderer } from '../renderers/WorldEffectsRenderer';
import { TerritoryStructureRenderer } from '../renderers/TerritoryStructureRenderer';
import { ResourceEntityRenderer } from '../renderers/ResourceEntityRenderer';
import { MultiplayerSyncController } from '../controllers/MultiplayerSyncController';
import { PlayerMovementController } from '../controllers/PlayerMovementController';
import { PlayerInteractionController } from '../controllers/PlayerInteractionController';
import { attachWebGLContextGuard } from '../utils/webglContextGuard';

export class WorldScene extends Phaser.Scene {
  // Player Profile
  private playerColor: PlayerColor = 'blue';
  private playerName: string = '수호자';
  private playerId: string = '';

  // World Data
  private islands: Island[] = [];
  private wallColliders: Phaser.Physics.Arcade.StaticGroup | null = null;

  // Subsystems & Controllers (SRP Modular Architecture)
  private coreGemSystem!: CoreGemSystem;
  private waveSystem!: WaveSystem;
  private towerDefenseSystem!: TowerDefenseSystem;
  private garrisonSystem!: GarrisonSystem;
  private livingWorldCoordinator!: LivingWorldCoordinator;
  private constructedBuildingRenderer!: ConstructedBuildingRenderer;
  private territoryStructureRenderer!: TerritoryStructureRenderer;
  private resourceEntityRenderer!: ResourceEntityRenderer;
  private effectsRenderer!: WorldEffectsRenderer;
  private multiplayerSync!: MultiplayerSyncController;
  private playerMovement!: PlayerMovementController;
  private playerInteraction!: PlayerInteractionController;

  // Constructed Buildings
  private constructedBuildings: ConstructedBuilding[] = [];

  private passiveTickAccum = 0;

  // Procedural Terrain & Graphics Layers
  private terrainMap!: WorldTerrainMap;
  private terrainRenderer!: TerrainRenderer;
  private altarRenderer!: ExpansionAltarRenderer;

  // Inventory & State Cache
  private inventory: Inventory = { wood: 30, stone: 20, gold: 10 };
  private initialZoom = 1.0;
  private unbindEventBus: Array<() => void> = [];
  private unbindWebGLGuard: (() => void) | null = null;
  private saveWorldTimer: ReturnType<typeof setTimeout> | null = null;
  private emitWorldTimer: ReturnType<typeof setTimeout> | null = null;
  private hasPendingSaveWorld = false;
  private isCleanedUp = false;

  constructor() {
    super('WorldScene');
  }

  init(data?: { playerName?: string; playerColor?: PlayerColor; zoom?: number }) {
    this.isCleanedUp = false;
    this.unbindEventBus = [];
    this.playerId = storage.getPlayerId();
    const profile = storage.loadProfile();
    this.playerName = data?.playerName || profile.name || '수호자';
    this.playerColor = data?.playerColor || profile.color || 'blue';
    this.initialZoom = data?.zoom || storage.loadZoom() || 1.0;
    this.inventory = storage.loadInventory();
  }

  create() {
    this.input.addPointer(2);
    const savedUnlocked = storage.loadUnlockedIslands();
    const savedTiers = storage.loadVillageTiers();
    const savedCoreHps = storage.loadCoreHps();
    this.constructedBuildings = storage.loadConstructedBuildings();

    this.islands = INITIAL_ISLANDS.map((isl: Island) => {
      const isUnlocked = savedUnlocked.includes(isl.id) || isl.id === 0;
      const defaultTier: VillageTier = isl.id === 0 ? 2 : 0;
      const tier: VillageTier = isUnlocked
        ? (savedTiers[isl.id] !== undefined ? savedTiers[isl.id] : defaultTier)
        : 0;
      const maxHp = VILLAGE_TIER_CONFIGS[tier].coreMaxHp;
      const curHp =
        savedCoreHps[isl.id] !== undefined
          ? Math.min(maxHp, Math.max(1, savedCoreHps[isl.id]))
          : maxHp;

      return {
        ...isl,
        unlocked: isUnlocked,
        villageTier: tier,
        coreHp: curHp,
        coreMaxHp: maxHp,
      };
    }).map((isl: Island) => BuildingSystem.ensureCentralVillageState(isl));

    // Setup Physics World Bounds for expanded territory map
    const { min: worldMin, width: worldWidth } = WORLD_BOUNDS;
    this.physics.world.setBounds(worldMin, worldMin, worldWidth, worldWidth);

    // 1. Necesse-style Procedural Biomes, Lakes, Bridges & Roads
    this.terrainMap = generateWorldTerrain(WORLD_BOUNDS, this.islands);
    this.terrainRenderer = new TerrainRenderer(this, this.terrainMap);
    this.terrainRenderer.bakeTerrainChunks();
    this.terrainRenderer.buildWaterColliders();

    // 2. Invasion & Territory Overlay Graphics & Effects Renderer
    this.effectsRenderer = new WorldEffectsRenderer(this, () => this.isSceneAlive());
    this.drawTerrainDecorations();

    // 3. Buildings Static Physics Group (Village Hall & Constructed Buildings)
    const buildingColliders = this.physics.add.staticGroup();
    this.territoryStructureRenderer = new TerritoryStructureRenderer(this, buildingColliders);
    this.wallColliders = this.physics.add.staticGroup();
    this.constructedBuildingRenderer = new ConstructedBuildingRenderer(this, this.wallColliders);
    this.spawnAllBuildings();
    this.spawnAllConstructedBuildings();

    // 4. Territory Expansion Altars & Resource Entity Renderers
    this.altarRenderer = new ExpansionAltarRenderer(this);
    this.drawExpansionAltars();
    this.resourceEntityRenderer = new ResourceEntityRenderer({
      scene: this,
      terrainMap: this.terrainMap,
      isSceneAlive: () => this.isSceneAlive(),
      getIslands: () => this.islands,
      getConstructedBuildings: () => this.constructedBuildings,
      shakeObject: (target) => this.shakeObject(target),
      showFloatingText: (x, y, text, color) => this.showFloatingText(x, y, text, color),
    });

    // 5. Initialize Core Systems (Modular AI-Friendly Architecture)
    this.coreGemSystem = new CoreGemSystem({
      getIslands: () => this.islands,
      getConstructedBuildings: () => this.constructedBuildings,
      removeConstructedBuilding: (buildingId: string) => this.destroyConstructedBuilding(buildingId),
      removeEntityVisualsForIsland: (islandId: number) =>
        this.resourceEntityRenderer.removeForIsland(islandId),
      showFloatingText: (x, y, text, color) => this.showFloatingText(x, y, text, color),
      shakeObject: (target) => this.shakeObject(target),
      playExplosionAt: (x, y) => this.playExplosionAt(x, y),
      saveWorldState: (immediate = false) => this.saveWorldState(immediate),
      emitWorldState: (immediate = false) => this.emitWorldStateToReact(immediate),
      refreshTerritoryDecorations: () => {
        this.drawTerrainDecorations();
        this.drawExpansionAltars();
        this.spawnAllBuildings();
      },
      broadcastTerritoryLost: (territoryId: number) =>
        this.multiplayerSync?.broadcastTerritoryLost(territoryId),
    });

    this.waveSystem = new WaveSystem(
      {
        scene: this,
        getIslands: () => this.islands,
        getConstructedBuildings: () => this.constructedBuildings,
        destroyConstructedBuilding: (buildingId: string) => this.destroyConstructedBuilding(buildingId),
        updateConstructedBuildingHpBar: (buildingId: string) =>
          this.updateConstructedBuildingHpBar(buildingId),
        onBuildingDamaged: () => {
          this.saveWorldState(false);
          this.emitWorldStateToReact(false);
        },
        getConstructedVisualContainer: (buildingId: string) =>
          this.constructedBuildingRenderer.getContainer(buildingId),
        showFloatingText: (x, y, text, color) => this.showFloatingText(x, y, text, color),
        shakeObject: (target) => this.shakeObject(target),
        playExplosionAt: (x, y) => this.playExplosionAt(x, y),
        addRewardResources: (wood, stone, gold) => {
          this.inventory = {
            wood: this.inventory.wood + wood,
            stone: this.inventory.stone + stone,
            gold: this.inventory.gold + gold,
          };
          GameEvents.emit('inventory-updated', this.inventory);
        },
        broadcastWaveSpawn: (isBossWave) => this.multiplayerSync?.broadcastWaveSpawn(isBossWave),
        broadcastMonstersSync: (monsters, waveCount, bossWaveCount) =>
          this.multiplayerSync?.broadcastMonstersSync(monsters, waveCount, bossWaveCount),
        broadcastMonsterHit: (monsterId, damage, attackerName) =>
          this.multiplayerSync?.broadcastMonsterHit(monsterId, damage, attackerName),
        onMonstersChanged: () => this.livingWorldCoordinator?.requestImmediateSnapshot(),
      },
      this.coreGemSystem
    );

    this.towerDefenseSystem = new TowerDefenseSystem(
      {
        scene: this,
        getConstructedBuildings: () => this.constructedBuildings,
        getConstructedVisuals: () => this.constructedBuildingRenderer.getVisuals(),
        showFloatingText: (x, y, text, color) => this.showFloatingText(x, y, text, color),
        playExplosionAt: (x, y) => this.playExplosionAt(x, y),
      },
      this.waveSystem
    );

    this.garrisonSystem = new GarrisonSystem(
      {
        scene: this,
      },
      this.waveSystem
    );

    this.livingWorldCoordinator = new LivingWorldCoordinator(
      {
        getPlayerId: () => this.playerId,
        getPlayerName: () => this.playerName,
        getPlayerColor: () => this.playerColor,
        getPlayerPosition: () => this.playerMovement?.getPosition() ?? { x: 320, y: 350 },
        getCurrentTerritoryId: () => this.playerMovement?.getCurrentTerritory().id ?? 0,
        getIslands: () => this.islands,
        getConstructedBuildings: () => this.constructedBuildings,
        applyOfflineWorldUpdate: (updatedIslands, updatedBuildings, passiveGain) => {
          if (!this.isSceneAlive()) return;
          this.islands = updatedIslands;
          this.constructedBuildings = updatedBuildings;
          if (passiveGain.wood > 0 || passiveGain.stone > 0 || passiveGain.gold > 0) {
            this.inventory = {
              wood: this.inventory.wood + passiveGain.wood,
              stone: this.inventory.stone + passiveGain.stone,
              gold: this.inventory.gold + passiveGain.gold,
            };
            GameEvents.emit('inventory-updated', this.inventory);
          }
          this.spawnAllTerritoryCores();
          this.spawnAllConstructedBuildings();
          this.drawTerrainDecorations();
          this.drawExpansionAltars();
          this.spawnAllBuildings();
          this.saveWorldState(true);
          this.emitWorldStateToReact(true);
        },
      },
      this.waveSystem,
      this.garrisonSystem
    );

    // 6. Territory Core Gems (One per occupied territory!)
    this.spawnAllTerritoryCores();

    // 7. Spawn Resource Entities
    this.spawnAllEntities();

    // 8. Initialize Player Interaction & Movement Controllers
    this.playerInteraction = new PlayerInteractionController({
      scene: this,
      getPlayerPosition: () => this.playerMovement.getPosition(),
      getPlayerName: () => this.playerName,
      getCurrentAction: () => this.playerMovement.getCurrentAction(),
      playPlayerAnimation: (action) => this.playerMovement.playAnimation(action),
      markInteractTime: (now) => this.playerMovement.markInteractTime(now),
      getIslands: () => this.islands,
      getInventory: () => this.inventory,
      spendInventory: (wood, stone, gold) => {
        this.inventory = {
          wood: this.inventory.wood - wood,
          stone: this.inventory.stone - stone,
          gold: this.inventory.gold - gold,
        };
        GameEvents.emit('inventory-updated', this.inventory);
      },
      addHarvestedResource: (resKey, amount) => {
        this.inventory = {
          ...this.inventory,
          [resKey]: this.inventory[resKey] + amount,
        };
        GameEvents.emit('inventory-updated', this.inventory);
      },
      getMonsterVisuals: () => this.waveSystem.getMonsterVisuals(),
      damageMonster: (monsterId, damage, attackerName) =>
        this.waveSystem.damageMonster(monsterId, damage, attackerName),
      findNearestEntityVisual: (x, y, maxDist) =>
        this.resourceEntityRenderer.findNearestVisual(x, y, maxDist),
      updateEntityHpBar: (entityId) => this.resourceEntityRenderer.updateHpBar(entityId),
      removeAndRespawnEntity: (ent) => this.resourceEntityRenderer.removeAndRespawn(ent),
      reduceWaveCooldown: (seconds) => this.waveSystem.reduceCooldown(seconds),
      broadcastEntityHit: (entityId, damage) => this.multiplayerSync?.broadcastHit(entityId, damage),
      unlockIslandLocally: (islandId, unlockedBy, isLocalTrigger) =>
        this.unlockIslandLocally(islandId, unlockedBy, isLocalTrigger),
      updateCoreGemVisual: (territoryId) => this.updateCoreGemVisual(territoryId),
      saveWorldState: (immediate = false) => this.saveWorldState(immediate),
      emitWorldStateToReact: (immediate = false) => this.emitWorldStateToReact(immediate),
      shakeObject: (target) => this.shakeObject(target),
      showFloatingText: (x, y, text, color) => this.showFloatingText(x, y, text, color),
    });

    this.playerMovement = new PlayerMovementController({
      scene: this,
      getPlayerName: () => this.playerName,
      getPlayerColor: () => this.playerColor,
      getInitialZoom: () => this.initialZoom,
      getBuildingColliders: () => this.territoryStructureRenderer.getBuildingColliders(),
      getWallColliders: () => this.wallColliders,
      getWaterColliders: () => this.terrainRenderer.getWaterColliders(),
      getIslands: () => this.islands,
      getMonsterVisuals: () => this.waveSystem.getMonsterVisuals(),
      findNearestEntityVisual: (x, y, maxDist) =>
        this.resourceEntityRenderer.findNearestVisual(x, y, maxDist),
      onInteract: () => this.playerInteraction.tryInteract(),
    });

    this.playerMovement.createPlayer();

    // 9. Create Ambient Drifting Clouds
    this.createClouds();

    // 10. Camera & Pointer Setup
    this.playerMovement.setupCamera();

    // 11. Controls & Input Listeners
    this.playerMovement.setupInputs();

    // 12. EventBus Listeners (Bridge with React)
    this.setupEventBus();

    // 13. Multiplayer Setup
    this.setupMultiplayer();

    // 14. Expose Debug / Test API on window for automated verification
    this.exposeTestHook();

    // 14.5. WebGL context loss/restore guard & clean teardown on shutdown/destroy
    this.unbindWebGLGuard = attachWebGLContextGuard({
      scene: this,
      onRestored: () => {
        if (this.isSceneAlive()) {
          this.terrainRenderer?.refreshChunksOnContextRestore();
        }
      },
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupScene());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanupScene());

    if (typeof window !== 'undefined') {
      const handleUnload = () => {
        if (this.waveSystem?.getIsHost()) {
          void this.livingWorldCoordinator?.persistAllSnapshots();
        }
      };
      window.addEventListener('pagehide', handleUnload);
      window.addEventListener('beforeunload', handleUnload);
      this.unbindEventBus.push(() => {
        window.removeEventListener('pagehide', handleUnload);
        window.removeEventListener('beforeunload', handleUnload);
      });
    }

    // 15. Notify React scene is ready & emit initial states
    GameEvents.emit('scene-ready', this);
    this.emitWorldStateToReact(true);
    this.emitWaveStateToReact();

    // 16. Living Isles: 오프라인 정산, 스냅샷 복원 및 비동기 수비대 배치
    void this.livingWorldCoordinator.initialize();
  }

  private cleanupScene(): void {
    if (this.isCleanedUp) return;

    if (this.saveWorldTimer) {
      clearTimeout(this.saveWorldTimer);
      this.saveWorldTimer = null;
    }
    if (this.emitWorldTimer) {
      clearTimeout(this.emitWorldTimer);
      this.emitWorldTimer = null;
    }
    if (this.hasPendingSaveWorld) {
      this.persistWorldStateNow();
    }

    this.isCleanedUp = true;

    for (const unbind of this.unbindEventBus) {
      unbind();
    }
    this.unbindEventBus = [];

    this.unbindWebGLGuard?.();
    this.unbindWebGLGuard = null;

    this.playerMovement?.destroy();
    this.livingWorldCoordinator?.destroy();
    this.waveSystem?.destroy();
    this.coreGemSystem?.clearAllVisuals();
    this.territoryStructureRenderer?.destroy();
    this.constructedBuildingRenderer?.clear();
    this.resourceEntityRenderer?.destroy();
    this.altarRenderer?.destroy();
    this.terrainRenderer?.destroy();
    this.effectsRenderer?.destroy();
    this.multiplayerSync?.destroy();
  }

  private isSceneAlive(): boolean {
    return !this.isCleanedUp && Boolean(this.sys && this.add && this.scene?.isActive());
  }

  private exposeTestHook() {
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__GAME_DEBUG__ = {
        getIslands: () => this.islands,
        getConstructedBuildings: () => this.constructedBuildings,
        getEntities: () => this.resourceEntityRenderer.getEntities(),
        getTerrainSummary: () => ({
          cols: this.terrainMap.cols,
          rows: this.terrainMap.rows,
          waterBodies: this.terrainMap.waterBodies.length,
          bridges: this.terrainMap.bridges.length,
        }),
        getMonsters: () => this.waveSystem.getMonsters(),
        getWaveState: () => this.waveSystem.getWaveState(),
        getInventory: () => this.inventory,
        triggerRegularWave: () => this.waveSystem.triggerRegularWave(),
        triggerBossWave: () => this.waveSystem.triggerBossWave(),
        damageTerritoryCore: (territoryId: number, dmg: number) =>
          this.coreGemSystem.damageTerritoryCore(territoryId, dmg, '마물 군단', true),
        unlockTerritory: (territoryId: number) =>
          this.unlockIslandLocally(territoryId, this.playerName, true),
        upgradeVillage: (territoryId: number) =>
          this.handleUpgradeVillage(territoryId, true),
        constructBuilding: (territoryId: number, type: ConstructableType, slotIndex?: number) =>
          this.handleConstructBuilding(territoryId, type, slotIndex, true),
        setInventory: (inv: Inventory) => {
          this.inventory = { ...inv };
          GameEvents.emit('inventory-updated', this.inventory);
          this.drawTerrainDecorations();
          this.drawExpansionAltars();
        },
      };
    }
  }

  private emitWorldStateToReact(immediate = true) {
    if (immediate) {
      if (this.emitWorldTimer) {
        clearTimeout(this.emitWorldTimer);
        this.emitWorldTimer = null;
      }
      this.emitWorldStateNow();
      return;
    }

    if (this.emitWorldTimer) return;
    this.emitWorldTimer = setTimeout(() => {
      this.emitWorldTimer = null;
      if (!this.isSceneAlive()) return;
      this.emitWorldStateNow();
    }, 350);
  }

  private emitWorldStateNow() {
    const unlockedIds = this.islands.filter((i) => i.unlocked).map((i) => i.id);
    GameEvents.emit('unlocked-islands', { ids: unlockedIds, total: this.islands.length });
    GameEvents.emit('territories-updated', [...this.islands]);
    GameEvents.emit('constructed-buildings-updated', [...this.constructedBuildings]);
  }

  private emitWaveStateToReact() {
    this.waveSystem.emitWaveState();
  }

  private saveWorldState(immediate = true) {
    if (immediate) {
      if (this.saveWorldTimer) {
        clearTimeout(this.saveWorldTimer);
        this.saveWorldTimer = null;
      }
      this.persistWorldStateNow();
      return;
    }

    this.hasPendingSaveWorld = true;
    if (this.saveWorldTimer) return;
    this.saveWorldTimer = setTimeout(() => {
      this.saveWorldTimer = null;
      if (!this.isSceneAlive()) return;
      this.persistWorldStateNow();
    }, 1200);
  }

  private persistWorldStateNow() {
    this.hasPendingSaveWorld = false;
    const unlockedIds = this.islands.filter((i) => i.unlocked).map((i) => i.id);
    storage.saveUnlockedIslands(unlockedIds);

    const tiers: Record<number, VillageTier> = {};
    const coreHps: Record<number, number> = {};
    for (const isl of this.islands) {
      if (isl.unlocked) {
        tiers[isl.id] = isl.villageTier;
        coreHps[isl.id] = isl.coreHp;
      }
    }
    storage.saveVillageTiers(tiers);
    storage.saveCoreHps(coreHps);
    storage.saveConstructedBuildings(this.constructedBuildings);
  }

  private drawTerrainDecorations() {
    if (!this.isSceneAlive()) return;
    this.terrainRenderer.renderTerritoryOverlays(this.islands, this.inventory);
    this.drawOuterPerimeterWarning();
  }

  private drawOuterPerimeterWarning() {
    this.effectsRenderer.drawOuterPerimeterWarning(this.islands);
  }

  private drawExpansionAltars() {
    if (!this.isSceneAlive()) return;
    this.altarRenderer.render(this.islands, this.inventory);
  }

  /**
   * 모든 점령한 땅에 코어 보석(Core Gem) 생성
   * 점령한 땅의 코어 보석이 부숴지면 땅을 잃게 됨!
   */
  private spawnAllTerritoryCores() {
    this.territoryStructureRenderer.spawnAllTerritoryCores(this.islands, this.coreGemSystem);
  }

  private createTerritoryCoreForIsland(isl: Island) {
    this.territoryStructureRenderer.createTerritoryCoreForIsland(isl, this.coreGemSystem);
  }

  private updateCoreGemVisual(territoryId: number) {
    this.coreGemSystem.updateCoreGemVisual(territoryId);
  }

  private spawnAllBuildings() {
    this.territoryStructureRenderer.spawnAllBuildings(this.islands);
  }

  /**
   * 플레이어가 건설한 건물(방어 타워, 성벽/나무 방책, 기본건물, 특수건물) 스폰
   */
  private spawnAllConstructedBuildings() {
    this.constructedBuildingRenderer.spawnAll(this.constructedBuildings, this.islands);
  }

  private spawnConstructedBuildingVisual(cb: ConstructedBuilding) {
    this.constructedBuildingRenderer.spawnOne(cb);
  }

  private updateConstructedBuildingHpBar(buildingId: string) {
    this.constructedBuildingRenderer.updateHpBar(buildingId);
  }

  private spawnAllEntities() {
    this.resourceEntityRenderer.spawnAll();
  }

  private createClouds() {
    this.effectsRenderer.createClouds();
  }

  private registerEventBus<K extends keyof GameEventPayloads>(
    event: K,
    fn: (payload: GameEventPayloads[K]) => void
  ): void {
    GameEvents.on(event, fn);
    this.unbindEventBus.push(() => GameEvents.off(event, fn));
  }

  private setupEventBus() {
    this.registerEventBus('set-player-profile', (data: { name: string; color: PlayerColor }) => {
      if (!this.isSceneAlive()) return;
      this.playerName = data.name;
      this.playerColor = data.color;
      this.playerMovement.refreshProfileVisuals();
    });

    this.registerEventBus('set-zoom', (newZoom: number) => {
      if (!this.isSceneAlive()) return;
      this.playerMovement.setTargetZoom(newZoom);
    });

    this.registerEventBus('set-inventory', (newInv: Inventory) => {
      if (!this.isSceneAlive()) return;
      this.inventory = { ...newInv };
      this.drawTerrainDecorations();
      this.drawExpansionAltars();
    });

    this.registerEventBus('joystick-move', (vector: { x: number; y: number }) => {
      if (!this.isSceneAlive()) return;
      this.playerMovement.setJoystickVector(vector);
    });

    this.registerEventBus('trigger-interact', () => {
      if (!this.isSceneAlive()) return;
      this.playerInteraction.tryInteract();
    });

    // 마을 발전 (점령지 -> 마을 -> 중소마을 -> 큰마을 -> 소도시 -> 중소도시 -> 대도시)
    this.registerEventBus('upgrade-village', (territoryId: number) => {
      if (!this.isSceneAlive()) return;
      this.handleUpgradeVillage(territoryId, true);
    });

    // 건물 건설 (방어 타워, 성벽, 기본건물, 특수건물)
    this.registerEventBus(
      'construct-building',
      (data: { territoryId: number; type: ConstructableType; slotIndex?: number }) => {
        if (!this.isSceneAlive()) return;
        this.handleConstructBuilding(data.territoryId, data.type, data.slotIndex, true);
      }
    );

    // 코어 보석 및 성벽 수리
    this.registerEventBus('repair-territory-core', (territoryId: number) => {
      if (!this.isSceneAlive()) return;
      this.handleRepairCore(territoryId);
    });

    // 웨이브 즉시 호출 & 타이머 배속 제어 (30분 일반 웨이브 / 60분 보스 웨이브 검증용 치트)
    this.registerEventBus('trigger-regular-wave', () => {
      if (!this.isSceneAlive()) return;
      this.waveSystem.triggerRegularWave();
    });

    this.registerEventBus('trigger-boss-wave', () => {
      if (!this.isSceneAlive()) return;
      this.waveSystem.triggerBossWave();
    });

    this.registerEventBus('summon-early-wave', (data: { isBossWave: boolean }) => {
      if (!this.isSceneAlive()) return;
      this.waveSystem.summonEarlyWave(Boolean(data?.isBossWave));
    });

    this.registerEventBus('reduce-wave-cooldown', (seconds: number) => {
      if (!this.isSceneAlive()) return;
      this.waveSystem.reduceCooldown(seconds);
    });

    this.registerEventBus('set-wave-timescale', (scale: number) => {
      if (!this.isSceneAlive()) return;
      this.waveSystem.setTimeScale(scale);
    });

    this.registerEventBus(
      'damage-territory-core',
      (data: { territoryId: number; damage: number }) => {
        if (!this.isSceneAlive()) return;
        this.coreGemSystem.damageTerritoryCore(data.territoryId, data.damage, '마물 침공 테스트', true);
      }
    );

    this.registerEventBus('add-test-resources', () => {
      if (!this.isSceneAlive()) return;
      this.inventory = {
        wood: this.inventory.wood + 500,
        stone: this.inventory.stone + 500,
        gold: this.inventory.gold + 500,
      };
      GameEvents.emit('inventory-updated', this.inventory);
      this.drawTerrainDecorations();
      this.drawExpansionAltars();
      const { x, y } = this.playerMovement.getPosition();
      this.showFloatingText(
        x,
        y - 50,
        '🎁 테스트 자원 지급! (+🪵500 +🪨500 +🪙500)',
        '#fde047'
      );
    });
  }

  /**
   * 마을 발전 처리:
   * 점령지(0) -> 개척마을(1) -> 중소마을(2) -> 큰마을(3) -> 소도시(4) -> 중소도시(5) -> 대도시(6)
   */
  public handleUpgradeVillage(territoryId: number, isLocalTrigger = true): boolean {
    const isl = this.islands.find((i) => i.id === territoryId);
    if (!isl || !isl.unlocked) return false;

    if (isl.villageTier >= 6) {
      if (isLocalTrigger) {
        const cPos = getTerritoryCorePos(isl.gridX, isl.gridY);
        this.showFloatingText(cPos.x, cPos.y - 60, '이미 최고 단계(대도시)에 도달했습니다.', '#f87171');
      }
      return false;
    }

    let nextTier = (isl.villageTier + 1) as VillageTier;
    if (isLocalTrigger) {
      const check = BuildingSystem.checkUpgrade(isl, this.inventory);
      if (!check.canUpgrade || !check.nextTier) {
        const cPos = getTerritoryCorePos(isl.gridX, isl.gridY);
        this.showFloatingText(cPos.x, cPos.y - 60, check.reason || '마을 승급 불가', '#f87171');
        return false;
      }
      nextTier = check.nextTier;
      this.inventory = {
        wood: this.inventory.wood - check.costWood,
        stone: this.inventory.stone - check.costStone,
        gold: this.inventory.gold - check.costGold,
      };
      GameEvents.emit('inventory-updated', this.inventory);
    }

    const nextCfg = VILLAGE_TIER_CONFIGS[nextTier];

    isl.villageTier = nextTier;
    isl.coreMaxHp = nextCfg.coreMaxHp;
    isl.coreHp = nextCfg.coreMaxHp; // 발전 시 코어 보석 완전 회복!

    this.saveWorldState();
    this.drawTerrainDecorations();
    this.spawnAllBuildings();
    this.updateCoreGemVisual(isl.id);
    this.emitWorldStateToReact();

    sound.playUnlock();
    confetti({ particleCount: 70, spread: 65, origin: { y: 0.6 } });

    const cPos = getTerritoryCorePos(isl.gridX, isl.gridY);
    const msg =
      nextTier === 1
        ? `🏡 [${isl.name}]에 새로운 '개척마을'을 세웠습니다!`
        : `🎉 [${isl.name}]이(가) '${nextCfg.name}'(으)로 발전했습니다! (코어 HP ${isl.coreMaxHp}, 슬롯 ${nextCfg.maxBuildings}개)`;
    this.showFloatingText(cPos.x, cPos.y - 75, msg, '#4ade80');
    GameEvents.emit('game-alert', msg);

    if (isLocalTrigger) {
      this.multiplayerSync?.broadcastVillageUpgrade(territoryId, nextTier);
    }
    return true;
  }

  /**
   * 점령한 땅에 방어 타워, 성벽, 기본건물, 특수건물 건설
   */
  public handleConstructBuilding(
    territoryId: number,
    type: ConstructableType,
    preferredSlotIndex?: number | boolean,
    isLocalTrigger = true
  ): boolean {
    const isl = this.islands.find((i) => i.id === territoryId);
    if (!isl || !isl.unlocked) return false;

    const slotIdx = typeof preferredSlotIndex === 'number' ? preferredSlotIndex : undefined;
    const isLocal = typeof preferredSlotIndex === 'boolean' ? preferredSlotIndex : isLocalTrigger;

    const check = BuildingSystem.checkBuild(
      isl,
      type,
      this.inventory,
      this.constructedBuildings,
      slotIdx
    );

    if (!check.canBuild || check.slotIndex === undefined) {
      const cPos = getTerritoryCorePos(isl.gridX, isl.gridY);
      this.showFloatingText(cPos.x, cPos.y - 60, check.reason || '건설 불가', '#f87171');
      return false;
    }

    const bp = check.blueprint;
    const finalSlotIndex = check.slotIndex;

    if (isLocal) {
      this.inventory = {
        wood: this.inventory.wood - bp.costWood,
        stone: this.inventory.stone - bp.costStone,
        gold: this.inventory.gold - bp.costGold,
      };
      GameEvents.emit('inventory-updated', this.inventory);
    }

    const newBuilding = BuildingSystem.createConstructedBuilding(isl, type, finalSlotIndex);
    this.constructedBuildings.push(newBuilding);
    this.spawnConstructedBuildingVisual(newBuilding);
    this.saveWorldState();
    this.emitWorldStateToReact();

    sound.playUnlock();
    this.showFloatingText(
      newBuilding.x,
      newBuilding.y - 45,
      `🏗️ [${bp.categoryLabel}] ${bp.name} 건설 완료! (#${finalSlotIndex} 슬롯)`,
      '#38bdf8'
    );

    if (isLocal) {
      this.multiplayerSync?.broadcastBuildingConstructed(newBuilding);
      this.waveSystem.reduceCooldown(ACTIVE_WAVE_ACCELERATION_CONFIG.buildCooldownReductionSec);
    }
    return true;
  }

  private handleRepairCore(territoryId: number) {
    const isl = this.islands.find((i) => i.id === territoryId);
    if (!isl || !isl.unlocked) return;
    const hasDamagedBuilding = this.constructedBuildings.some(
      (cb) => cb.territoryId === territoryId && cb.hp < cb.maxHp
    );
    if (isl.coreHp >= isl.coreMaxHp && !hasDamagedBuilding) {
      this.showFloatingText(
        getTerritoryCorePos(isl.gridX, isl.gridY).x,
        getTerritoryCorePos(isl.gridX, isl.gridY).y - 60,
        '💎 코어 보석과 방책이 이미 최대 체력입니다!',
        '#38bdf8'
      );
      return;
    }

    if (this.inventory.wood < 5 || this.inventory.stone < 5) {
      this.showFloatingText(
        getTerritoryCorePos(isl.gridX, isl.gridY).x,
        getTerritoryCorePos(isl.gridX, isl.gridY).y - 60,
        '수리 자원 부족 (🪵5 🪨5 필요)',
        '#f87171'
      );
      return;
    }

    this.inventory = {
      ...this.inventory,
      wood: this.inventory.wood - 5,
      stone: this.inventory.stone - 5,
    };
    GameEvents.emit('inventory-updated', this.inventory);

    isl.coreHp = Math.min(isl.coreMaxHp, isl.coreHp + 100);
    // 영지 내 성벽/방책도 함께 수리
    for (const cb of this.constructedBuildings) {
      if (cb.territoryId === territoryId) {
        cb.hp = Math.min(cb.maxHp, cb.hp + 80);
        this.updateConstructedBuildingHpBar(cb.id);
      }
    }

    this.updateCoreGemVisual(territoryId);
    this.saveWorldState();
    this.emitWorldStateToReact();
    sound.playUnlock();
    const cPos = getTerritoryCorePos(isl.gridX, isl.gridY);
    this.showFloatingText(cPos.x, cPos.y - 60, '✨ 코어 보석 및 방책 수리 완료! (+100 HP)', '#4ade80');
  }

  /**
   * 현실 시간 30분 마물 웨이브 & 60분 보스몬스터 출현 스폰 (WaveSystem 위임)
   */
  public spawnMonsterWave(isBossWave: boolean, isLocalTrigger = true) {
    this.waveSystem.spawnMonsterWave(isBossWave, isLocalTrigger);
  }

  /**
   * 점령한 땅의 코어 보석 피격 및 파괴 시 땅 상실 처리 (CoreGemSystem 위임)
   */
  public damageTerritoryCore(
    territoryId: number,
    damage: number,
    attackerName = '마물',
    isLocalTrigger = false
  ) {
    return this.coreGemSystem.damageTerritoryCore(territoryId, damage, attackerName, isLocalTrigger);
  }

  public loseTerritoryByCoreDestruction(
    territoryId: number,
    attackerName: string,
    isLocalTrigger: boolean
  ) {
    this.coreGemSystem.loseTerritory(territoryId, attackerName, isLocalTrigger);
  }

  private playExplosionAt(x: number, y: number) {
    this.effectsRenderer.playExplosionAt(x, y);
  }

  private setupMultiplayer() {
    this.multiplayerSync = new MultiplayerSyncController({
      scene: this,
      getPlayerId: () => this.playerId,
      getPlayerName: () => this.playerName,
      getPlayerColor: () => this.playerColor,
      getLocalPlayerState: () => this.playerMovement.getState(),
      onOnlineCountChanged: (count) => this.waveSystem.setOnlineCount(count),
      onHostStatusChanged: (isHost) => {
        this.waveSystem.setHostMode(isHost);
        if (isHost) {
          this.livingWorldCoordinator?.requestImmediateSnapshot();
        }
      },
      onRemoteEntityHit: (entityId, damage, hitByName) =>
        this.handleRemoteHit(entityId, damage, hitByName),
      onRemoteIslandUnlocked: (islandId, unlockedBy) =>
        this.unlockIslandLocally(islandId, unlockedBy, false),
      onRemoteVillageUpgraded: (territoryId) =>
        this.handleUpgradeVillage(territoryId, false),
      onRemoteBuildingConstructed: (cb) => {
        if (cb && !this.constructedBuildings.some((b) => b.id === cb.id)) {
          this.constructedBuildings.push(cb);
          this.spawnConstructedBuildingVisual(cb);
          this.saveWorldState();
          this.emitWorldStateToReact();
        }
      },
      onRemoteWaveSpawned: (isBossWave) => {
        sound.playBreak();
        GameEvents.emit(
          'game-alert',
          isBossWave
            ? '👹 외곽 영지에서 보스 군단 침공이 시작되었습니다!'
            : '🧟 외곽 영지 경계에서 마물 웨이브가 진입했습니다!'
        );
      },
      onRemoteMonstersSync: (monsters, waveCount, bossWaveCount) =>
        this.waveSystem.applyRemoteMonstersSync(monsters, waveCount, bossWaveCount),
      onRemoteMonsterHit: (monsterId, damage, attackerName) => {
        if (this.waveSystem.getIsHost()) {
          this.waveSystem.damageMonster(monsterId, damage, attackerName, true);
        }
      },
      onRemoteTerritoryLost: (territoryId, reason) =>
        this.loseTerritoryByCoreDestruction(territoryId, reason, false),
    });
    this.multiplayerSync.setup();
  }

  update(time: number, delta: number) {
    // 1. Update Wave System (30m & 60m Countdown, Spawning & 3-stage Monster AI)
    this.waveSystem.update(time, delta);

    // 2. Update Tower Defense System (Archer/Magic Towers & Barracks Synergies)
    this.towerDefenseSystem.update(time, delta);

    // 2.5. Update Async Offline Garrisons & Living World Snapshots
    this.garrisonSystem.update(time, delta);
    this.livingWorldCoordinator.update(delta);

    // 3. Update Territory Passive Resource Gains & Sanctuary/House Buffs
    this.updatePassives(delta);

    // 4. Process Local Player Movement, Camera Zoom & Territory Tracking
    this.playerMovement.update(time);

    this.effectsRenderer.updateClouds();

    this.multiplayerSync?.maybeBroadcastPlayerMove(time);
  }

  private destroyConstructedBuilding(buildingId: string) {
    const idx = this.constructedBuildings.findIndex((b) => b.id === buildingId);
    if (idx === -1) return;
    const removed = this.constructedBuildings[idx];
    this.constructedBuildings.splice(idx, 1);

    if (this.constructedBuildingRenderer.getContainer(buildingId)) {
      this.playExplosionAt(removed.x, removed.y);
      this.constructedBuildingRenderer.removeVisual(buildingId);
    }

    sound.playBreak();
    this.showFloatingText(removed.x, removed.y - 40, `💥 ${removed.name} 파괴됨!`, '#ef4444');
    this.saveWorldState(false);
    this.emitWorldStateToReact(false);
  }

  /**
   * 영지 및 특수 건물(성소, 벌목소, 석공소, 금광) 주기적 자원 생산 및 치유 (6초마다)
   */
  private updatePassives(delta: number) {
    this.passiveTickAccum += delta;
    if (this.passiveTickAccum >= 6000) {
      this.passiveTickAccum = 0;

      let totalWoodGain = 0;
      let totalStoneGain = 0;
      let totalGoldGain = 0;

      // 점령지 마을 단계별 기본 생산
      for (const isl of this.islands) {
        if (!isl.unlocked) continue;
        const cfg = VILLAGE_TIER_CONFIGS[isl.villageTier];
        totalWoodGain += cfg.passiveWood;
        totalStoneGain += cfg.passiveStone;
        totalGoldGain += cfg.passiveGold;
      }

      // 기본건물 & 특수건물 효과
      let healStateDirty = false;
      for (const cb of this.constructedBuildings) {
        const isl = this.islands.find((i) => i.id === cb.territoryId && i.unlocked);
        if (!isl) continue;

        if (cb.type === 'lumber_camp') {
          totalWoodGain += 2;
          this.showFloatingText(cb.x, cb.y - 35, '🪵 +2', '#86efac');
        } else if (cb.type === 'stone_works') {
          totalStoneGain += 2;
          this.showFloatingText(cb.x, cb.y - 35, '🪨 +2', '#cbd5e1');
        } else if (cb.type === 'special_goldmine') {
          totalGoldGain += 2;
          this.showFloatingText(cb.x, cb.y - 35, '🪙 +2', '#fde047');
        } else if (cb.type === 'basic_house') {
          if (isl.coreHp < isl.coreMaxHp) {
            isl.coreHp = Math.min(isl.coreMaxHp, isl.coreHp + 6);
            this.updateCoreGemVisual(isl.id);
            healStateDirty = true;
          }
        } else if (cb.type === 'special_sanctuary') {
          // 성소: 코어 보석 및 성벽 회복
          if (isl.coreHp < isl.coreMaxHp) {
            isl.coreHp = Math.min(isl.coreMaxHp, isl.coreHp + 20);
            this.updateCoreGemVisual(isl.id);
            healStateDirty = true;
          }
          for (const other of this.constructedBuildings) {
            if (other.territoryId === isl.id && other.hp < other.maxHp) {
              other.hp = Math.min(other.maxHp, other.hp + 35);
              this.updateConstructedBuildingHpBar(other.id);
              healStateDirty = true;
            }
          }
          this.showFloatingText(cb.x, cb.y - 35, '✨ 성소 치유 오라', '#38bdf8');
        }
      }

      if (healStateDirty) {
        this.saveWorldState(false);
        this.emitWorldStateToReact(false);
      }

      if (totalWoodGain > 0 || totalStoneGain > 0 || totalGoldGain > 0) {
        this.inventory = {
          wood: this.inventory.wood + totalWoodGain,
          stone: this.inventory.stone + totalStoneGain,
          gold: this.inventory.gold + totalGoldGain,
        };
        GameEvents.emit('inventory-updated', this.inventory);
      }
    }
  }

  public unlockIslandLocally(islandId: number, unlockedBy: string, isLocalTrigger: boolean) {
    const target = this.islands.find((i) => i.id === islandId);
    if (!target || target.unlocked) return;

    target.unlocked = true;
    target.villageTier = 0; // 새로 점령한 땅은 '점령지(0)'로 시작하며 이후 마을->중소마을->큰마을->소도시->중소도시->대도시로 발전 가능!
    target.coreMaxHp = VILLAGE_TIER_CONFIGS[0].coreMaxHp;
    target.coreHp = target.coreMaxHp;

    this.saveWorldState();
    this.drawTerrainDecorations();
    this.drawExpansionAltars();

    // 새 점령지에 코어 보석 생성 (마을 점령은 건물 건설 및 방어 거점 구축용)
    this.createTerritoryCoreForIsland(target);
    this.spawnAllBuildings();
    this.emitWorldStateToReact();

    sound.playUnlock();
    confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });

    const origin = getIslandOrigin(target.gridX, target.gridY);
    const msg = `🚩 ${unlockedBy}님이 '${target.name}' 영지를 점령했습니다! 건물을 세우고 마을로 발전시키세요!`;
    this.showFloatingText(origin.x + 320, origin.y + 240, msg, '#ffd700');

    if (islandId === GOLD_MINE_BIOME_CONFIG.unlockTerritoryId) {
      this.resourceEntityRenderer.spawnGoldMineClusterAndAnnounce();
    } else {
      GameEvents.emit('game-alert', msg);
    }

    if (isLocalTrigger) {
      serverSync.saveUnlockedIsland(islandId, target.name, unlockedBy);
      this.multiplayerSync?.broadcastUnlock(islandId, unlockedBy);
    }
  }

  private shakeObject(target: Phaser.GameObjects.Container) {
    this.effectsRenderer.shakeObject(target);
  }

  private showFloatingText(x: number, y: number, text: string, color: string) {
    this.effectsRenderer.showFloatingText(x, y, text, color);
  }

  private handleRemoteHit(entityId: string, damage: number, _hitByName: string) {
    this.resourceEntityRenderer.handleRemoteHit(entityId, damage);
  }
}
