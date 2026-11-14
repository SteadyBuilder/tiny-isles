import Phaser from 'phaser';
import confetti from 'canvas-confetti';
import { EventBus } from '../EventBus';
import {
  TERRITORY_STEP,
  INITIAL_ISLANDS,
  VILLAGE_TIER_CONFIGS,
  getTerritoryCorePos,
  generateTerritoryBuildings,
  getIslandOrigin,
  getBuildingCollisionBox,
} from '../../constants';
import { BuildingSystem } from '../../BuildingSystem';
import {
  Building,
  ConstructableType,
  ConstructedBuilding,
  Entity,
  Inventory,
  Island,
  PlayerAction,
  PlayerColor,
  VillageTier,
} from '../../../types/game';
import { sound } from '../../../lib/sound';
import { storage } from '../../../lib/storage';
import { serverSync } from '../../../lib/serverSync';
import { WaveSystem, MonsterVisual } from '../../systems/WaveSystem';
import { TowerDefenseSystem } from '../../systems/TowerDefenseSystem';
import { CoreGemSystem, CoreGemVisualRef } from '../../systems/CoreGemSystem';
import { GarrisonSystem } from '../../systems/GarrisonSystem';
import { LivingWorldCoordinator } from '../../systems/LivingWorldCoordinator';
import { ACTIVE_WAVE_ACCELERATION_CONFIG } from '../../../data/worldRules';
import { getOuterPerimeterSpawns } from '../../utils/waveUtils';
import {
  GOLD_MINE_BIOME_CONFIG,
  RESOURCE_DISTRIBUTION_CONFIG,
} from '../../../data/biomes';
import { WORLD_BOUNDS } from '../../worldBounds';
import { DEPTH, ySortDepth } from '../../depthLayers';
import { generateWorldTerrain, WorldTerrainMap } from '../../world/MapTerrainGenerator';
import {
  generateGoldMineClusterEntities,
  generateWorldResourceEntities,
  pickRespawnSpot,
} from '../../world/ResourceDistributionSystem';
import { TerrainRenderer } from '../renderers/TerrainRenderer';
import { ExpansionAltarRenderer } from '../renderers/ExpansionAltarRenderer';
import { ConstructedBuildingRenderer } from '../renderers/ConstructedBuildingRenderer';
import { MultiplayerSyncController } from '../controllers/MultiplayerSyncController';
import { attachWebGLContextGuard } from '../utils/webglContextGuard';

interface EntityVisual {
  entity: Entity;
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  hpBar?: Phaser.GameObjects.Graphics;
}

const MAX_ACTIVE_FLOATING_TEXTS = 24;

export class WorldScene extends Phaser.Scene {
  // Player
  private playerSprite!: Phaser.Physics.Arcade.Sprite;
  private playerNameTag!: Phaser.GameObjects.Text;
  private playerIndicator!: Phaser.GameObjects.Text;
  private playerColor: PlayerColor = 'blue';
  private playerName: string = '수호자';
  private playerId: string = '';
  private currentAction: PlayerAction = 'idle';
  private currentDirection: 'left' | 'right' = 'right';

  // World Data
  private islands: Island[] = [];
  private buildings: Building[] = [];
  private buildingColliders: Phaser.Physics.Arcade.StaticGroup | null = null;
  private wallColliders: Phaser.Physics.Arcade.StaticGroup | null = null;
  private buildingVisuals: Phaser.GameObjects.Container[] = [];
  private entityVisuals = new Map<string, EntityVisual>();

  // Subsystems & Controllers (SRP Modular Architecture)
  private coreGemSystem!: CoreGemSystem;
  private waveSystem!: WaveSystem;
  private towerDefenseSystem!: TowerDefenseSystem;
  private garrisonSystem!: GarrisonSystem;
  private livingWorldCoordinator!: LivingWorldCoordinator;
  private constructedBuildingRenderer!: ConstructedBuildingRenderer;
  private multiplayerSync!: MultiplayerSyncController;

  // Constructed Buildings
  private constructedBuildings: ConstructedBuilding[] = [];

  private passiveTickAccum = 0;

  // Procedural Terrain & Graphics Layers
  private terrainMap!: WorldTerrainMap;
  private terrainRenderer!: TerrainRenderer;
  private altarRenderer!: ExpansionAltarRenderer;
  private invasionGraphics!: Phaser.GameObjects.Graphics;
  private clouds: { sprite: Phaser.GameObjects.Image; speed: number }[] = [];

  // Controls & Inputs
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: { [key: string]: Phaser.Input.Keyboard.Key };
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private eKey!: Phaser.Input.Keyboard.Key;
  private bKey!: Phaser.Input.Keyboard.Key;
  private joystickVector = { x: 0, y: 0 };
  private mouseTarget: { x: number; y: number; active: boolean } = { x: 0, y: 0, active: false };
  private touchIndicator!: Phaser.GameObjects.Image;
  private touchTargetObj: { x: number; y: number } | null = null;
  private isActionHolding = false;

  // Inventory & State Cache
  private inventory: Inventory = { wood: 30, stone: 20, gold: 10 };
  private targetZoom = 1.0;
  private lastGridPos = { gridX: 0, gridY: 0 };
  private lastNearIsland: Island | null = null;
  private lastInvasionSignature = '';
  private lastInteractTime = 0;
  private unbindEventBus: Array<() => void> = [];
  private unbindWebGLGuard: (() => void) | null = null;
  private saveWorldTimer: ReturnType<typeof setTimeout> | null = null;
  private emitWorldTimer: ReturnType<typeof setTimeout> | null = null;
  private hasPendingSaveWorld = false;
  private activeFloatingTexts: Phaser.GameObjects.Text[] = [];
  private isCleanedUp = false;

  constructor() {
    super('WorldScene');
  }

  init(data?: { playerName?: string; playerColor?: PlayerColor; zoom?: number }) {
    this.isCleanedUp = false;
    this.lastInvasionSignature = '';
    this.unbindEventBus = [];
    this.playerId = storage.getPlayerId();
    const profile = storage.loadProfile();
    this.playerName = data?.playerName || profile.name || '수호자';
    this.playerColor = data?.playerColor || profile.color || 'blue';
    this.targetZoom = data?.zoom || storage.loadZoom() || 1.0;
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

    // 2. Invasion & Territory Overlay Graphics
    this.invasionGraphics = this.add.graphics();
    this.invasionGraphics.setDepth(DEPTH.INVASION_OVERLAY);
    this.drawTerrainDecorations();

    // 3. Buildings Static Physics Group (Village Hall & Constructed Buildings)
    this.buildingColliders = this.physics.add.staticGroup();
    this.wallColliders = this.physics.add.staticGroup();
    this.constructedBuildingRenderer = new ConstructedBuildingRenderer(this, this.wallColliders);
    this.spawnAllBuildings();
    this.spawnAllConstructedBuildings();

    // 4. Territory Expansion Altars Renderer
    this.altarRenderer = new ExpansionAltarRenderer(this);
    this.drawExpansionAltars();

    // 5. Initialize Core Systems (Modular AI-Friendly Architecture)
    this.coreGemSystem = new CoreGemSystem({
      getIslands: () => this.islands,
      getConstructedBuildings: () => this.constructedBuildings,
      removeConstructedBuilding: (buildingId: string) => this.destroyConstructedBuilding(buildingId),
      removeEntityVisualsForIsland: (islandId: number) => {
        for (const [entId, ev] of this.entityVisuals.entries()) {
          if (ev.entity.islandId === islandId) {
            ev.container.destroy();
            this.entityVisuals.delete(entId);
          }
        }
      },
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
          EventBus.emit('inventory-updated', this.inventory);
        },
        broadcastWaveSpawn: (isBossWave) => this.multiplayerSync?.broadcastWaveSpawn(isBossWave),
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
        getPlayerPosition: () => ({
          x: this.playerSprite?.x ?? 320,
          y: this.playerSprite?.y ?? 350,
        }),
        getCurrentTerritoryId: () => {
          const px = this.playerSprite?.x ?? 320;
          const py = this.playerSprite?.y ?? 350;
          const gx = Math.round((px - 320) / TERRITORY_STEP);
          const gy = Math.round((py - 320) / TERRITORY_STEP);
          const found = this.islands.find((i) => i.unlocked && i.gridX === gx && i.gridY === gy);
          return found ? found.id : 0;
        },
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
            EventBus.emit('inventory-updated', this.inventory);
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

    // 8. Create Local Player
    this.createPlayer();

    // 9. Create Ambient Drifting Clouds
    this.createClouds();

    // 10. Camera Setup
    this.setupCamera();

    // 11. Controls & Input Listeners
    this.setupInputs();

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

    // 15. Notify React scene is ready & emit initial states
    EventBus.emit('scene-ready', this);
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

    this.livingWorldCoordinator?.destroy();
    this.waveSystem?.destroy();
    this.coreGemSystem?.clearAllVisuals();
    this.constructedBuildingRenderer?.clear();
    this.altarRenderer?.destroy();
    this.terrainRenderer?.destroy();
    this.multiplayerSync?.destroy();

    for (const ft of this.activeFloatingTexts) {
      if (ft.scene) {
        ft.destroy();
      }
    }
    this.activeFloatingTexts = [];
  }

  private isSceneAlive(): boolean {
    return !this.isCleanedUp && Boolean(this.sys && this.add && this.scene?.isActive());
  }

  private exposeTestHook() {
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__GAME_DEBUG__ = {
        getIslands: () => this.islands,
        getConstructedBuildings: () => this.constructedBuildings,
        getEntities: () => Array.from(this.entityVisuals.values()).map((ev) => ev.entity),
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
          EventBus.emit('inventory-updated', this.inventory);
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
    EventBus.emit('unlocked-islands', unlockedIds, this.islands.length);
    EventBus.emit('territories-updated', [...this.islands]);
    EventBus.emit('constructed-buildings-updated', [...this.constructedBuildings]);
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
    if (!this.isSceneAlive()) return;
    const signature = this.islands
      .filter((i) => i.unlocked)
      .map((i) => i.id)
      .join(',');
    if (signature === this.lastInvasionSignature) return;
    this.lastInvasionSignature = signature;

    const ig = this.invasionGraphics;
    ig.clear();

    const outerSpawns = getOuterPerimeterSpawns(this.islands);
    for (const sp of outerSpawns) {
      // Draw subtle outer invasion entry indicator on the perimeter of occupied territories
      ig.fillStyle(0xef4444, 0.18);
      ig.fillCircle(sp.spawnX, sp.spawnY, 26);
      ig.lineStyle(2, 0xef4444, 0.5);
      ig.strokeCircle(sp.spawnX, sp.spawnY, 26);
    }
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
    this.coreGemSystem.clearAllVisuals();

    for (const isl of this.islands) {
      if (isl.unlocked) {
        this.createTerritoryCoreForIsland(isl);
      }
    }
  }

  private createTerritoryCoreForIsland(isl: Island) {
    const corePos = getTerritoryCorePos(isl.gridX, isl.gridY);
    const container = this.add.container(corePos.x, corePos.y);
    container.setDepth(ySortDepth(corePos.y, 24));

    const isCentral = isl.id === 0;
    const gemColor = isCentral ? 0x38bdf8 : 0x34d399;

    // Glowing Aura
    const aura = this.add.graphics();
    aura.fillStyle(gemColor, 0.24);
    aura.fillCircle(0, 0, 50);
    container.add(aura);

    this.tweens.add({
      targets: aura,
      scaleX: 1.22,
      scaleY: 1.22,
      alpha: 0.1,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Floating Magical Core Gem Crystal
    const points = [
      { x: 0, y: -22 },
      { x: 15, y: 0 },
      { x: 0, y: 22 },
      { x: -15, y: 0 },
    ];
    const crystal = this.add.polygon(0, -24, points, gemColor);
    crystal.setStrokeStyle(2.5, 0xe0f2fe);
    container.add(crystal);

    this.tweens.add({
      targets: crystal,
      y: -34,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Compact Core Badge (Icon + Lv + HP Gauge)
    const badge = this.add.graphics();
    badge.fillStyle(0x0f172a, 0.88);
    badge.fillRoundedRect(-44, -76, 88, 36, 8);
    badge.lineStyle(1.5, gemColor, 0.95);
    badge.strokeRoundedRect(-44, -76, 88, 36, 8);
    container.add(badge);

    const tierText = this.add.text(
      0,
      -63,
      `${isCentral ? '🏰' : '💎'} Lv.${isl.villageTier}`,
      {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#ffffff',
      }
    ).setOrigin(0.5);
    container.add(tierText);

    const hpBar = this.add.graphics();
    container.add(hpBar);

    const coreRef: CoreGemVisualRef = {
      territoryId: isl.id,
      container,
      crystal,
      aura,
      hpBar,
      tierText,
    };
    this.coreGemSystem.registerVisual(isl.id, coreRef);
    this.coreGemSystem.updateCoreGemVisual(isl.id);
  }

  private updateCoreGemVisual(territoryId: number) {
    this.coreGemSystem.updateCoreGemVisual(territoryId);
  }

  private spawnAllBuildings() {
    this.buildings = [];
    this.buildingVisuals.forEach((c) => c.destroy());
    this.buildingVisuals = [];
    this.buildingColliders?.clear(true, true);

    for (const isl of this.islands) {
      if (isl.unlocked) {
        const blds = generateTerritoryBuildings(isl.id, isl.gridX, isl.gridY, isl.villageTier);
        this.buildings.push(...blds);
      }
    }

    for (const b of this.buildings) {
      const container = this.add.container(b.x, b.y);

      let bDepthBias = b.height - 20;
      if (b.type === 'castle' || b.type === 'tower') bDepthBias = 240;
      else if (b.type === 'monastery') bDepthBias = 290;
      else if (b.type === 'barracks' || b.type === 'archery') bDepthBias = 230;
      container.setDepth(ySortDepth(b.y, bDepthBias));

      const img = this.add.image(0, 0, b.type).setOrigin(0, 0);
      img.setDisplaySize(b.width, b.height);
      container.add(img);

      this.buildingVisuals.push(container);

      const box = getBuildingCollisionBox(b);
      const colliderSprite = this.physics.add.staticSprite(
        box.x + box.w / 2,
        box.y + box.h / 2,
        ''
      );
      colliderSprite.setVisible(false);
      colliderSprite.body.setSize(box.w, box.h);
      colliderSprite.refreshBody();
      this.buildingColliders?.add(colliderSprite);
    }
    this.buildingColliders?.refresh();
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

  private isGoldMineUnlocked(): boolean {
    return this.islands.some(
      (i) => i.id === GOLD_MINE_BIOME_CONFIG.unlockTerritoryId && i.unlocked
    );
  }

  private spawnAllEntities() {
    this.entityVisuals.forEach((ev) => ev.container.destroy());
    this.entityVisuals.clear();

    const allEntities = generateWorldResourceEntities(
      this.terrainMap,
      this.islands,
      WORLD_BOUNDS,
      this.constructedBuildings,
      this.isGoldMineUnlocked()
    );

    for (const ent of allEntities) {
      this.spawnEntity(ent);
    }
  }

  private spawnEntity(ent: Entity) {
    const container = this.add.container(ent.x, ent.y);
    let entDepthBias = 16;
    if (ent.type === 'rock' || ent.type === 'gold_rock') entDepthBias = 20;
    container.setDepth(ySortDepth(ent.y, entDepthBias));

    let sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;

    if (ent.type === 'tree') {
      const isTree3 = ent.id.includes('2') || ent.id.includes('4');
      const key = isTree3 ? 'tree3' : 'tree';
      const animKey = isTree3 ? 'tree3_anim' : 'tree_anim';
      const drawH = isTree3 ? 150 : 185;

      const treeSprite = this.add.sprite(16, 40 - drawH / 2, key);
      treeSprite.setDisplaySize(145, drawH);
      if (this.anims.exists(animKey)) {
        treeSprite.play(animKey);
      }
      sprite = treeSprite;
    } else if (ent.type === 'rock') {
      const isRock2 = ent.id.includes('2') || ent.id.includes('5');
      const rockKey = isRock2 ? 'rock2' : 'rock1';

      const rockImg = this.add.image(32, 16, rockKey);
      rockImg.setDisplaySize(64, 64);
      sprite = rockImg;
    } else if (ent.type === 'gold_rock') {
      const useVariant2 = ent.id.includes('2') || ent.id.includes('4') || ent.id.includes('6');
      const goldKey =
        useVariant2 && this.textures.exists('goldResource2')
          ? 'goldResource2'
          : 'goldResource';
      if (this.textures.exists(goldKey)) {
        const goldImg = this.add.image(32, 14, goldKey);
        goldImg.setDisplaySize(96, 96);
        sprite = goldImg;
      } else {
        const rockImg = this.add.image(32, 16, 'rock2');
        rockImg.setDisplaySize(64, 64);
        rockImg.setTint(0xffd700);
        sprite = rockImg;
      }
    } else {
      const sheepSprite = this.add.sprite(32, 24, 'sheep');
      sheepSprite.setDisplaySize(96, 96);
      if (this.anims.exists('sheep_anim')) {
        sheepSprite.play('sheep_anim');
      }
      sprite = sheepSprite;
    }

    container.add(sprite);

    const hpBar = this.add.graphics();
    container.add(hpBar);

    this.entityVisuals.set(ent.id, {
      entity: ent,
      container,
      sprite,
      hpBar,
    });

    this.updateEntityHpBar(ent.id);
  }

  private updateEntityHpBar(entityId: string) {
    const visual = this.entityVisuals.get(entityId);
    if (!visual || !visual.hpBar) return;

    visual.hpBar.clear();
    const ent = visual.entity;
    if (ent.hp < ent.maxHp && ent.type !== 'sheep') {
      const barW = 40;
      const barH = 5;
      const barX = 16 - barW / 2;
      const barY = -12;

      visual.hpBar.fillStyle(0x000000, 0.6);
      visual.hpBar.fillRect(barX, barY, barW, barH);
      visual.hpBar.fillStyle(0x4caf50, 1);
      visual.hpBar.fillRect(barX, barY, (ent.hp / ent.maxHp) * barW, barH);
    }
  }

  private createPlayer() {
    const startX = 320;
    const startY = 430;

    this.playerSprite = this.physics.add.sprite(startX, startY, `${this.playerColor}PawnIdle`);
    this.playerSprite.setDisplaySize(128, 128);
    this.playerSprite.setCollideWorldBounds(true);
    this.playerSprite.setSize(36, 24);
    this.playerSprite.setOffset(78, 96);

    if (this.buildingColliders) {
      this.physics.add.collider(this.playerSprite, this.buildingColliders);
    }
    if (this.wallColliders) {
      this.physics.add.collider(this.playerSprite, this.wallColliders);
    }
    this.physics.add.collider(this.playerSprite, this.terrainRenderer.getWaterColliders());

    this.playerNameTag = this.add.text(startX, startY - 42, this.playerName, {
      fontFamily: 'Pretendard, sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#38bdf8',
      stroke: '#000000',
      strokeThickness: 2.5,
    }).setOrigin(0.5);

    this.playerIndicator = this.add.text(startX, startY - 54, '▼', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#fde047',
      stroke: '#000000',
      strokeThickness: 1.5,
    }).setOrigin(0.5);

    this.playPlayerAnimation('idle');
  }

  private createClouds() {
    const cloudConfigs = [
      { x: -1600, y: -800, speed: 0.35, scale: 0.9, type: 'cloud1' },
      { x: 300, y: 200, speed: 0.42, scale: 1.1, type: 'cloud2' },
      { x: 2200, y: -200, speed: 0.3, scale: 0.85, type: 'cloud1' },
      { x: -500, y: 1800, speed: 0.38, scale: 1.0, type: 'cloud2' },
      { x: 1800, y: 2200, speed: 0.28, scale: 0.95, type: 'cloud1' },
      { x: -2200, y: 800, speed: 0.34, scale: 1.05, type: 'cloud2' },
    ];

    for (const c of cloudConfigs) {
      const sprite = this.add.image(c.x, c.y, c.type);
      sprite.setScale(c.scale);
      sprite.setAlpha(0.55);
      sprite.setDepth(DEPTH.CLOUDS);
      this.clouds.push({ sprite, speed: c.speed });
    }
  }

  private setupCamera() {
    this.cameras.main.startFollow(this.playerSprite, true, 0.1, 0.1);
    this.cameras.main.setZoom(this.targetZoom);
    // Camera bounds follow the full expanded world (all 21 territories), not just the central 3x3
    this.cameras.main.setBounds(WORLD_BOUNDS.min, WORLD_BOUNDS.min, WORLD_BOUNDS.width, WORLD_BOUNDS.width);

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: unknown, _deltaX: number, deltaY: number) => {
      const step = 0.12;
      const next = deltaY < 0 ? this.targetZoom + step : this.targetZoom - step;
      this.targetZoom = Math.min(2.0, Math.max(0.5, Number(next.toFixed(2))));
      EventBus.emit('zoom-changed', this.targetZoom);
    });

    this.touchIndicator = this.add
      .image(0, 0, 'cursorTarget')
      .setVisible(false)
      .setDepth(DEPTH.TOUCH_INDICATOR)
      .setScale(0.35)
      .setAlpha(0.85);

    const handlePointerAction = (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;

      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;
      if (p1?.isDown && p2?.isDown) {
        this.mouseTarget.active = false;
        this.touchIndicator.setVisible(false);
        return;
      }

      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

      // 1. Check if user touched an active Monster
      let touchedMonster: MonsterVisual | null = null;
      let minMonDist = 65;
      this.waveSystem.getMonsterVisuals().forEach((mv) => {
        const d = Math.hypot(worldPoint.x - mv.monster.x, worldPoint.y - mv.monster.y);
        if (d < minMonDist) {
          minMonDist = d;
          touchedMonster = mv;
        }
      });

      if (touchedMonster) {
        const tm = touchedMonster as MonsterVisual;
        const distFromPlayer = Math.hypot(
          this.playerSprite.x - tm.monster.x,
          this.playerSprite.y - tm.monster.y
        );
        this.touchTargetObj = { x: tm.monster.x, y: tm.monster.y };
        if (distFromPlayer < 115) {
          this.mouseTarget.active = false;
          this.tryInteract();
        } else {
          this.mouseTarget = { x: tm.monster.x, y: tm.monster.y, active: true };
        }
        return;
      }

      // 2. Check if user touched an Entity, Core Gem, or Territory Altar
      let touchedEntity: EntityVisual | null = null;
      let minEntDist = 55;
      this.entityVisuals.forEach((ev) => {
        const d = Math.hypot(worldPoint.x - (ev.entity.x + 16), worldPoint.y - (ev.entity.y + 16));
        if (d < minEntDist) {
          minEntDist = d;
          touchedEntity = ev;
        }
      });

      let touchedCoreIsl: Island | null = null;
      for (const isl of this.islands) {
        if (isl.unlocked) {
          const cPos = getTerritoryCorePos(isl.gridX, isl.gridY);
          if (Math.hypot(worldPoint.x - cPos.x, worldPoint.y - cPos.y) < 60) {
            touchedCoreIsl = isl;
            break;
          }
        }
      }

      let touchedIslandSign: Island | null = null;
      for (const isl of this.islands) {
        if (!isl.unlocked) {
          const origin = getIslandOrigin(isl.gridX, isl.gridY);
          const signX = origin.x + 320;
          const signY = origin.y + 320;
          if (Math.hypot(worldPoint.x - signX, worldPoint.y - signY) < 75) {
            touchedIslandSign = isl;
            break;
          }
        }
      }

      const px = this.playerSprite.x;
      const py = this.playerSprite.y;

      if (touchedEntity || touchedCoreIsl || touchedIslandSign) {
        let targetX = 0;
        let targetY = 0;
        if (touchedEntity) {
          targetX = (touchedEntity as EntityVisual).entity.x + 16;
          targetY = (touchedEntity as EntityVisual).entity.y + 16;
        } else if (touchedCoreIsl) {
          const cPos = getTerritoryCorePos(touchedCoreIsl.gridX, touchedCoreIsl.gridY);
          targetX = cPos.x;
          targetY = cPos.y;
          EventBus.emit('open-village-modal', touchedCoreIsl.id);
        } else if (touchedIslandSign) {
          const orig = getIslandOrigin(touchedIslandSign.gridX, touchedIslandSign.gridY);
          targetX = orig.x + 320;
          targetY = orig.y + 320;
        }

        const distFromPlayer = Math.hypot(px - targetX, py - targetY);
        this.touchTargetObj = { x: targetX, y: targetY };

        this.touchIndicator.setPosition(targetX, targetY).setVisible(true).setAlpha(1).setScale(0.45);

        if (distFromPlayer < 100) {
          this.mouseTarget.active = false;
          this.tryInteract();
        } else {
          this.mouseTarget = { x: targetX, y: targetY, active: true };
        }
      } else {
        this.touchTargetObj = null;
        this.mouseTarget = { x: worldPoint.x, y: worldPoint.y, active: true };
        this.touchIndicator.setPosition(worldPoint.x, worldPoint.y).setVisible(true).setAlpha(0.9).setScale(0.42);
      }
    };

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      handlePointerAction(pointer);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;
      if (p1?.isDown && p2?.isDown) {
        this.mouseTarget.active = false;
        this.touchIndicator.setVisible(false);
        return;
      }

      if (pointer.isDown && !this.touchTargetObj) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.mouseTarget = { x: worldPoint.x, y: worldPoint.y, active: true };
        this.touchIndicator.setPosition(worldPoint.x, worldPoint.y).setVisible(true);
      }
    });
  }

  private setupInputs() {
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasdKeys = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
      this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.eKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
      this.bKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B);

      this.spaceKey.on('down', () => this.tryInteract());
      this.eKey.on('down', () => this.tryInteract());
      this.bKey.on('down', () => {
        const curIsl = this.getCurrentPlayerTerritory();
        EventBus.emit('open-village-modal', curIsl.id);
      });
    }

    const handlePlayerAction = () => {
      this.tryInteract();
    };
    const handleActionStart = () => {
      this.isActionHolding = true;
    };
    const handleActionStop = () => {
      this.isActionHolding = false;
    };
    window.addEventListener('player-action', handlePlayerAction);
    window.addEventListener('player-action-start', handleActionStart);
    window.addEventListener('player-action-stop', handleActionStop);
    EventBus.on('player-action-start', handleActionStart);
    EventBus.on('player-action-stop', handleActionStop);

    this.events.once('shutdown', () => {
      window.removeEventListener('player-action', handlePlayerAction);
      window.removeEventListener('player-action-start', handleActionStart);
      window.removeEventListener('player-action-stop', handleActionStop);
      EventBus.off('player-action-start', handleActionStart);
      EventBus.off('player-action-stop', handleActionStop);
    });
  }

  private getCurrentPlayerTerritory(): Island {
    const gx = Math.round((this.playerSprite.x - 320) / TERRITORY_STEP);
    const gy = Math.round((this.playerSprite.y - 320) / TERRITORY_STEP);
    return (
      this.islands.find((i) => i.gridX === gx && i.gridY === gy && i.unlocked) ||
      this.islands.find((i) => i.unlocked) ||
      this.islands[0]
    );
  }

  private registerEventBus<TArgs extends unknown[]>(
    event: string,
    fn: (...args: TArgs) => void
  ): void {
    EventBus.on(event, fn);
    this.unbindEventBus.push(() => EventBus.off(event, fn));
  }

  private setupEventBus() {
    this.registerEventBus('set-player-profile', (data: { name: string; color: PlayerColor }) => {
      if (!this.isSceneAlive()) return;
      this.playerName = data.name;
      this.playerColor = data.color;
      this.playerNameTag.setText(this.playerName);
      this.playPlayerAnimation(this.currentAction);
    });

    this.registerEventBus('set-zoom', (newZoom: number) => {
      if (!this.isSceneAlive()) return;
      this.targetZoom = newZoom;
    });

    this.registerEventBus('set-inventory', (newInv: Inventory) => {
      if (!this.isSceneAlive()) return;
      this.inventory = { ...newInv };
      this.drawTerrainDecorations();
      this.drawExpansionAltars();
    });

    this.registerEventBus('joystick-move', (vector: { x: number; y: number }) => {
      if (!this.isSceneAlive()) return;
      this.joystickVector = vector;
    });

    this.registerEventBus('trigger-interact', () => {
      if (!this.isSceneAlive()) return;
      this.tryInteract();
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
      EventBus.emit('inventory-updated', this.inventory);
      this.drawTerrainDecorations();
      this.drawExpansionAltars();
      this.showFloatingText(
        this.playerSprite.x,
        this.playerSprite.y - 50,
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
      EventBus.emit('inventory-updated', this.inventory);
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
    EventBus.emit('game-alert', msg);

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
      EventBus.emit('inventory-updated', this.inventory);
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
    EventBus.emit('inventory-updated', this.inventory);

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
    if (this.textures.exists('explosionFx') && this.anims.exists('explosion_anim')) {
      const exp = this.add.sprite(x, y, 'explosionFx');
      exp.setDepth(DEPTH.EXPLOSION);
      exp.setDisplaySize(140, 140);
      exp.play('explosion_anim');
      exp.once('animationcomplete', () => exp.destroy());
    }
  }

  private setupMultiplayer() {
    this.multiplayerSync = new MultiplayerSyncController({
      scene: this,
      getPlayerId: () => this.playerId,
      getPlayerName: () => this.playerName,
      getPlayerColor: () => this.playerColor,
      getLocalPlayerState: () => ({
        x: this.playerSprite.x,
        y: this.playerSprite.y,
        direction: this.currentDirection,
        action: this.currentAction,
      }),
      onOnlineCountChanged: (count) => this.waveSystem.setOnlineCount(count),
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
      onRemoteWaveSpawned: (isBossWave) => this.spawnMonsterWave(isBossWave, false),
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

    // 4. Process Local Player Movement
    const speed = 250;
    let vx = 0;
    let vy = 0;

    if (this.cursors.left.isDown || this.wasdKeys.A?.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.wasdKeys.D?.isDown) vx += 1;
    if (this.cursors.up.isDown || this.wasdKeys.W?.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.wasdKeys.S?.isDown) vy += 1;

    if (Math.abs(this.joystickVector.x) > 0.05 || Math.abs(this.joystickVector.y) > 0.05) {
      vx += this.joystickVector.x;
      vy += this.joystickVector.y;
      this.mouseTarget.active = false;
    }

    if (vx !== 0 || vy !== 0) {
      this.mouseTarget.active = false;
    }

    if (this.mouseTarget.active) {
      const dist = Phaser.Math.Distance.Between(
        this.playerSprite.x,
        this.playerSprite.y,
        this.mouseTarget.x,
        this.mouseTarget.y
      );

      if (this.touchTargetObj && dist < 90) {
        this.mouseTarget.active = false;
        this.touchTargetObj = null;
        this.touchIndicator.setVisible(false);
        this.tryInteract();
      } else if (dist <= 14) {
        this.mouseTarget.active = false;
        this.touchIndicator.setVisible(false);
      } else {
        vx = (this.mouseTarget.x - this.playerSprite.x) / dist;
        vy = (this.mouseTarget.y - this.playerSprite.y) / dist;
      }
    }

    if (vx !== 0 || vy !== 0) {
      const len = Math.hypot(vx, vy);
      const factor = Math.min(1, len);
      this.playerSprite.setVelocity(
        (vx / len) * speed * factor,
        (vy / len) * speed * factor
      );

      if (vx < 0) this.currentDirection = 'left';
      else if (vx > 0) this.currentDirection = 'right';
      this.playerSprite.setFlipX(this.currentDirection === 'left');

      if (this.currentAction !== 'axe' && this.currentAction !== 'pickaxe') {
        this.playPlayerAnimation('run');
      }
    } else {
      this.playerSprite.setVelocity(0, 0);
      if (this.currentAction === 'run') {
        this.playPlayerAnimation('idle');
      }
    }

    // Synchronize Player Visuals & Depth sorting
    const px = this.playerSprite.x;
    const py = this.playerSprite.y;
    this.playerSprite.setDepth(ySortDepth(py, 24));
    this.playerNameTag.setPosition(px, py - 42).setDepth(ySortDepth(py, 30));
    this.playerIndicator.setPosition(px, py - 54).setDepth(ySortDepth(py, 30));

    // Continuous interaction when Space, E or Mobile Action Button is held
    const isHoldInput =
      this.spaceKey?.isDown || this.eKey?.isDown || this.isActionHolding;
    if (isHoldInput && time - this.lastInteractTime >= 240) {
      this.tryInteract();
    }

    // Smooth Camera Zoom
    const currentCamZoom = this.cameras.main.zoom;
    if (Math.abs(currentCamZoom - this.targetZoom) > 0.005) {
      this.cameras.main.setZoom(Phaser.Math.Linear(currentCamZoom, this.targetZoom, 0.1));
    }

    this.checkTerritoryAndGridUpdates();

    for (const c of this.clouds) {
      c.sprite.x += c.speed;
      if (c.sprite.x > 3800) {
        c.sprite.x = -3800;
        c.sprite.y = -1500 + Math.random() * 4500;
      }
    }

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
        EventBus.emit('inventory-updated', this.inventory);
      }
    }
  }

  private playPlayerAnimation(action: PlayerAction) {
    this.currentAction = action;
    const animKey = `${this.playerColor}_${action}`;
    if (this.anims.exists(animKey)) {
      this.playerSprite.play(animKey, true);
    }
  }

  private checkTerritoryAndGridUpdates() {
    const px = this.playerSprite.x;
    const py = this.playerSprite.y;

    let nearLocked: Island | null = null;
    for (const isl of this.islands) {
      if (!isl.unlocked) {
        const origin = getIslandOrigin(isl.gridX, isl.gridY);
        const signX = origin.x + 320;
        const signY = origin.y + 320;
        const dist = Math.hypot(px - signX, py - signY);
        if (dist < 260) {
          nearLocked = isl;
          break;
        }
      }
    }

    if (nearLocked?.id !== this.lastNearIsland?.id) {
      this.lastNearIsland = nearLocked;
      EventBus.emit('near-island-changed', nearLocked);
    }

    const gridX = Math.round((px - 320) / TERRITORY_STEP);
    const gridY = Math.round((py - 320) / TERRITORY_STEP);
    if (gridX !== this.lastGridPos.gridX || gridY !== this.lastGridPos.gridY) {
      this.lastGridPos = { gridX, gridY };
      EventBus.emit('player-grid-pos-changed', { gridX, gridY });
    }
  }

  private tryInteract() {
    this.lastInteractTime = this.time.now;
    const px = this.playerSprite.x;
    const py = this.playerSprite.y;

    // 1. 마물 직접 타격 (전투 최우선!)
    let nearestMonster: MonsterVisual | null = null;
    let minMonDist = 115;
    for (const mv of this.waveSystem.getMonsterVisuals().values()) {
      const d = Math.hypot(px - mv.monster.x, py - mv.monster.y);
      if (d < minMonDist) {
        minMonDist = d;
        nearestMonster = mv;
      }
    }

    if (nearestMonster) {
      this.playPlayerAnimation('axe');
      this.time.delayedCall(260, () => {
        if (this.currentAction === 'axe') this.playPlayerAnimation('idle');
      });
      sound.playChop();
      this.waveSystem.damageMonster(nearestMonster.monster.id, 35, this.playerName);
      return;
    }

    // 2. 미점령 영지 개척 제단 확인 (땅을 넓혀가며 자원을 확보)
    for (const isl of this.islands) {
      if (!isl.unlocked) {
        const origin = getIslandOrigin(isl.gridX, isl.gridY);
        const signX = origin.x + 320;
        const signY = origin.y + 320;
        const dist = Math.hypot(px - signX, py - signY);

        if (dist < 260) {
          if (
            this.inventory.wood >= isl.costWood &&
            this.inventory.stone >= isl.costStone &&
            this.inventory.gold >= isl.costGold
          ) {
            this.inventory = {
              wood: this.inventory.wood - isl.costWood,
              stone: this.inventory.stone - isl.costStone,
              gold: this.inventory.gold - isl.costGold,
            };
            EventBus.emit('inventory-updated', this.inventory);
            this.unlockIslandLocally(isl.id, this.playerName, true);
            return;
          } else {
            this.showFloatingText(
              signX,
              signY - 40,
              `자원 부족! (🪵${isl.costWood} 🪨${isl.costStone}${isl.costGold > 0 ? ` 🪙${isl.costGold}` : ''})`,
              '#ff5252'
            );
            return;
          }
        }
      }
    }

    // 3. 자원 엔티티 채집 (맵 전역 야외 필드에서 점령 여부와 무관하게 채집 가능)
    let nearestVisual: EntityVisual | null = null;
    let minDist = 95;

    this.entityVisuals.forEach((ev) => {
      const dist = Math.hypot(px - (ev.entity.x + 16), py - (ev.entity.y + 16));
      if (dist < minDist) {
        minDist = dist;
        nearestVisual = ev;
      }
    });

    if (nearestVisual) {
      const ent = (nearestVisual as EntityVisual).entity;

      if (ent.type === 'sheep') {
        sound.playClick();
        this.shakeObject((nearestVisual as EntityVisual).container);
        this.showFloatingText(ent.x + 16, ent.y - 20, '🐑 음메에~ ❤️', '#f472b6');
        return;
      }

      const toolAction: PlayerAction = ent.type === 'tree' ? 'axe' : 'pickaxe';
      this.playPlayerAnimation(toolAction);
      this.time.delayedCall(280, () => {
        if (this.currentAction === toolAction) {
          this.playPlayerAnimation('idle');
        }
      });

      const damage = 1;
      ent.hp -= damage;
      this.shakeObject((nearestVisual as EntityVisual).container);
      this.updateEntityHpBar(ent.id);

      if (ent.type === 'tree') sound.playChop();
      else sound.playMine();

      const resKey = ent.type === 'tree' ? 'wood' : ent.type === 'gold_rock' ? 'gold' : 'stone';
      const harvestAmount = 1;
      this.inventory = {
        ...this.inventory,
        [resKey]: this.inventory[resKey] + harvestAmount,
      };
      EventBus.emit('inventory-updated', this.inventory);

      const icon =
        resKey === 'wood'
          ? `🪵 +${harvestAmount}`
          : resKey === 'gold'
          ? `🪙 +${harvestAmount}`
          : `🪨 +${harvestAmount}`;
      const color = resKey === 'wood' ? '#8bc34a' : resKey === 'gold' ? '#ffd700' : '#cfd8dc';
      this.showFloatingText(ent.x + 16, ent.y, icon, color);

      this.multiplayerSync?.broadcastHit(ent.id, damage);

      if (ent.hp <= 0) {
        sound.playBreak();
        this.removeAndRespawnEntity(ent);
        this.waveSystem.reduceCooldown(ACTIVE_WAVE_ACCELERATION_CONFIG.gatherCooldownReductionSec);
      }
      return;
    }

    // 4. 점령한 땅의 코어 보석 근처에서 상호작용 시 코어 회복 및 마을/건설 창 열기
    for (const isl of this.islands) {
      if (!isl.unlocked) continue;
      const cPos = getTerritoryCorePos(isl.gridX, isl.gridY);
      if (Math.hypot(px - cPos.x, py - cPos.y) < 95) {
        sound.playUnlock();
        if (isl.coreHp < isl.coreMaxHp) {
          isl.coreHp = Math.min(isl.coreMaxHp, isl.coreHp + 15);
          this.updateCoreGemVisual(isl.id);
          this.saveWorldState(false);
          this.emitWorldStateToReact(false);
        }
        this.showFloatingText(cPos.x, cPos.y - 60, `💎 [${isl.name}] 마을/건설 관리`, '#38bdf8');
        EventBus.emit('open-village-modal', isl.id);
        return;
      }
    }

    this.playPlayerAnimation('axe');
    this.time.delayedCall(280, () => {
      if (this.currentAction === 'axe') this.playPlayerAnimation('idle');
    });
  }

  private removeAndRespawnEntity(ent: Entity) {
    const visual = this.entityVisuals.get(ent.id);
    if (visual) {
      visual.container.destroy();
      this.entityVisuals.delete(ent.id);
    }

    this.time.delayedCall(RESOURCE_DISTRIBUTION_CONFIG.respawnDelayMs, () => {
      if (!this.isSceneAlive()) return;
      const activeEntities = Array.from(this.entityVisuals.values()).map((ev) => ev.entity);
      const nextSpot = pickRespawnSpot(
        ent.type,
        activeEntities,
        this.terrainMap,
        this.islands,
        WORLD_BOUNDS,
        this.constructedBuildings,
        {
          goldMineUnlocked: this.isGoldMineUnlocked(),
          zoneTag: ent.zoneTag,
        }
      );
      if (nextSpot) {
        ent.x = nextSpot.x;
        ent.y = nextSpot.y;
        ent.type = nextSpot.type;
        ent.hp = nextSpot.maxHp;
        ent.maxHp = nextSpot.maxHp;
        ent.zoneTag = nextSpot.zoneTag;
        this.spawnEntity(ent);
      }
    });
  }

  private spawnGoldMineClusterAndAnnounce() {
    const activeEntities = Array.from(this.entityVisuals.values()).map((ev) => ev.entity);
    const hasCluster = activeEntities.some((e) => e.zoneTag === 'gold_mine');
    if (!hasCluster) {
      const mineNodes = generateGoldMineClusterEntities(
        this.terrainMap,
        this.islands,
        WORLD_BOUNDS,
        activeEntities,
        this.constructedBuildings
      );
      for (const node of mineNodes) {
        this.spawnEntity(node);
      }
    }

    const gm = GOLD_MINE_BIOME_CONFIG;
    confetti({ particleCount: 130, spread: 95, origin: { y: 0.55 } });
    this.showFloatingText(gm.centerX, gm.centerY - 40, `⛏️ ${gm.announcementText}`, '#fde047');
    EventBus.emit('game-alert', gm.announcementText);
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
      this.spawnGoldMineClusterAndAnnounce();
    } else {
      EventBus.emit('game-alert', msg);
    }

    if (isLocalTrigger) {
      serverSync.saveUnlockedIsland(islandId, target.name, unlockedBy);
      this.multiplayerSync?.broadcastUnlock(islandId, unlockedBy);
    }
  }

  private shakeObject(target: Phaser.GameObjects.Container) {
    if (!target || !target.scene || !this.isSceneAlive()) return;
    const wasTweening = this.tweens.isTweening(target);
    const existingBaseX = wasTweening
      ? (target.getData('shakeBaseX') as number | undefined)
      : undefined;
    this.tweens.killTweensOf(target);

    const baseX = typeof existingBaseX === 'number' ? existingBaseX : target.x;
    target.setData('shakeBaseX', baseX);
    target.x = baseX;

    this.tweens.add({
      targets: target,
      x: baseX + 6,
      duration: 40,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        if (target.scene) {
          target.setData('shakeBaseX', undefined);
          target.x = baseX;
        }
      },
    });
  }

  private showFloatingText(x: number, y: number, text: string, color: string) {
    if (!this.isSceneAlive()) return;

    while (this.activeFloatingTexts.length >= MAX_ACTIVE_FLOATING_TEXTS) {
      const oldest = this.activeFloatingTexts.shift();
      if (oldest && oldest.scene) {
        this.tweens.killTweensOf(oldest);
        oldest.destroy();
      }
    }

    const ft = this.add.text(x, y, text, {
      fontFamily: 'Pretendard, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    ft.setDepth(DEPTH.FLOATING_TEXT);
    this.activeFloatingTexts.push(ft);

    this.tweens.add({
      targets: ft,
      y: y - 50,
      alpha: 0,
      duration: 1300,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        const idx = this.activeFloatingTexts.indexOf(ft);
        if (idx !== -1) {
          this.activeFloatingTexts.splice(idx, 1);
        }
        if (ft.scene) {
          ft.destroy();
        }
      },
    });
  }

  private handleRemoteHit(entityId: string, damage: number, _hitByName: string) {
    const visual = this.entityVisuals.get(entityId);
    if (!visual) return;

    visual.entity.hp -= damage;
    this.shakeObject(visual.container);
    this.updateEntityHpBar(entityId);

    if (visual.entity.type === 'tree') sound.playChop();
    else sound.playMine();

    if (visual.entity.hp <= 0) {
      sound.playBreak();
      this.removeAndRespawnEntity(visual.entity);
    }
  }
}
