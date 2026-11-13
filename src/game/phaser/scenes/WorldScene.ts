import Phaser from 'phaser';
import confetti from 'canvas-confetti';
import { EventBus } from '../EventBus';
import {
  TERRITORY_PX,
  TERRITORY_GAP,
  TERRITORY_STEP,
  INITIAL_ISLANDS,
  REGULAR_WAVE_INTERVAL_SEC,
  BOSS_WAVE_INTERVAL_SEC,
  VILLAGE_TIER_CONFIGS,
  TERRITORY_BUILD_SLOTS,
  getBlueprint,
  getTerritoryCorePos,
  generateIslandEntities,
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
  Monster,
  MonsterType,
  Player,
  PlayerAction,
  PlayerColor,
  VillageTier,
  WaveState,
} from '../../../types/game';
import { sound } from '../../../lib/sound';
import { supabase } from '../../../lib/supabase';
import { storage } from '../../../lib/storage';
import { serverSync } from '../../../lib/serverSync';
import { WaveSystem, MonsterVisual } from '../../systems/WaveSystem';
import { TowerDefenseSystem, ConstructedVisualRef } from '../../systems/TowerDefenseSystem';
import { CoreGemSystem, CoreGemVisualRef } from '../../systems/CoreGemSystem';
import { getOuterPerimeterSpawns } from '../../utils/waveUtils';

interface RemotePlayerVisual {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  nameTag: Phaser.GameObjects.Text;
  data: Player;
}

interface EntityVisual {
  entity: Entity;
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  hpBar?: Phaser.GameObjects.Graphics;
}

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

  // Remote Players
  private remotePlayers = new Map<string, RemotePlayerVisual>();

  // World Data
  private islands: Island[] = [];
  private buildings: Building[] = [];
  private buildingColliders: Phaser.Physics.Arcade.StaticGroup | null = null;
  private buildingVisuals: Phaser.GameObjects.Container[] = [];
  private entityVisuals = new Map<string, EntityVisual>();

  // Subsystems (SRP Modular Architecture)
  private coreGemSystem!: CoreGemSystem;
  private waveSystem!: WaveSystem;
  private towerDefenseSystem!: TowerDefenseSystem;

  // Constructed Buildings & Visuals
  private constructedBuildings: ConstructedBuilding[] = [];
  private constructedVisuals = new Map<string, ConstructedVisualRef>();

  private passiveTickAccum = 0;

  // Graphics Layers
  private terrainGraphics!: Phaser.GameObjects.Graphics;
  private invasionGraphics!: Phaser.GameObjects.Graphics;
  private altarCardsContainer!: Phaser.GameObjects.Container;
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
  private pinchStartDist: number | null = null;
  private pinchStartZoom: number = 1.0;
  private isActionHolding = false;

  // Multiplayer Channels
  private localBus: BroadcastChannel | null = null;
  private supabaseChannel: ReturnType<typeof supabase.channel> | null = null;
  private isSubscribed = false;
  private lastBroadcastTime = 0;

  // Inventory & State Cache
  private inventory: Inventory = { wood: 30, stone: 20, gold: 10 };
  private targetZoom = 1.0;
  private lastGridPos = { gridX: 0, gridY: 0 };
  private lastNearIsland: Island | null = null;
  private lastInteractTime = 0;

  constructor() {
    super('WorldScene');
  }

  init(data?: { playerName?: string; playerColor?: PlayerColor; zoom?: number }) {
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
    const worldMin = -2 * TERRITORY_STEP - 200;
    const worldMax = 2 * TERRITORY_STEP + TERRITORY_PX + 200;
    const worldWidth = worldMax - worldMin;
    this.physics.world.setBounds(worldMin, worldMin, worldWidth, worldWidth);

    // 1. Seamless Grass Tile Background covering full expanded plains
    const bgPadding = 800;
    const bgTile = this.add.tileSprite(
      (worldMin + worldMax) / 2,
      (worldMin + worldMax) / 2,
      worldWidth + bgPadding,
      worldWidth + bgPadding,
      'grassSeamless'
    );
    bgTile.setDepth(-100);

    // 2. Terrain Graphics (Roads, Plazas, Border lines)
    this.terrainGraphics = this.add.graphics();
    this.terrainGraphics.setDepth(-50);
    this.invasionGraphics = this.add.graphics();
    this.invasionGraphics.setDepth(-40);
    this.drawTerrainDecorations();

    // 3. Buildings Static Physics Group (Village Hall & Constructed Buildings)
    this.buildingColliders = this.physics.add.staticGroup();
    this.spawnAllBuildings();
    this.spawnAllConstructedBuildings();

    // 4. Territory Expansion Altars Container
    this.altarCardsContainer = this.add.container(0, 0);
    this.altarCardsContainer.setDepth(-20);
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
      saveWorldState: () => this.saveWorldState(),
      emitWorldState: () => this.emitWorldStateToReact(),
      refreshTerritoryDecorations: () => {
        this.drawTerrainDecorations();
        this.drawExpansionAltars();
        this.spawnAllBuildings();
      },
      broadcastTerritoryLost: (territoryId: number) => this.broadcastTerritoryLost(territoryId),
    });

    this.waveSystem = new WaveSystem(
      {
        scene: this,
        getIslands: () => this.islands,
        getConstructedBuildings: () => this.constructedBuildings,
        destroyConstructedBuilding: (buildingId: string) => this.destroyConstructedBuilding(buildingId),
        updateConstructedBuildingHpBar: (buildingId: string) => this.updateConstructedBuildingHpBar(buildingId),
        getConstructedVisualContainer: (buildingId: string) => this.constructedVisuals.get(buildingId)?.container,
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
        broadcastWaveSpawn: (isBossWave) => this.broadcastWaveSpawn(isBossWave),
      },
      this.coreGemSystem
    );

    this.towerDefenseSystem = new TowerDefenseSystem(
      {
        scene: this,
        getConstructedBuildings: () => this.constructedBuildings,
        getConstructedVisuals: () => this.constructedVisuals,
        showFloatingText: (x, y, text, color) => this.showFloatingText(x, y, text, color),
        playExplosionAt: (x, y) => this.playExplosionAt(x, y),
      },
      this.waveSystem
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

    // 15. Notify React scene is ready & emit initial states
    EventBus.emit('scene-ready', this);
    this.emitWorldStateToReact();
    this.emitWaveStateToReact();
  }

  private exposeTestHook() {
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__GAME_DEBUG__ = {
        getIslands: () => this.islands,
        getConstructedBuildings: () => this.constructedBuildings,
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

  private emitWorldStateToReact() {
    const unlockedIds = this.islands.filter((i) => i.unlocked).map((i) => i.id);
    EventBus.emit('unlocked-islands', unlockedIds, this.islands.length);
    EventBus.emit('territories-updated', [...this.islands]);
    EventBus.emit('constructed-buildings-updated', [...this.constructedBuildings]);
  }

  private emitWaveStateToReact() {
    this.waveSystem.emitWaveState();
  }

  private saveWorldState() {
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
    const g = this.terrainGraphics;
    g.clear();

    // Territory Plazas, Roads & Borders
    for (const isl of this.islands) {
      const origin = getIslandOrigin(isl.gridX, isl.gridY);
      if (isl.unlocked) {
        // Cobblestone Plaza around each occupied territory's Core Gem
        const plazaRadius = 56 + isl.villageTier * 8;
        g.fillStyle(0xa8a29e, 0.45);
        g.fillCircle(origin.x + 320, origin.y + 350, plazaRadius);
        g.lineStyle(3, 0x78716c, 0.55);
        g.strokeCircle(origin.x + 320, origin.y + 350, plazaRadius);

        // Crossroads branching outwards connecting across village gaps
        g.fillStyle(0xa8a29e, 0.34);
        g.fillRect(origin.x - TERRITORY_GAP / 2, origin.y + 350 - 18, TERRITORY_STEP, 36); // West-East Road
        g.fillRect(origin.x + 320 - 18, origin.y - TERRITORY_GAP / 2, 36, TERRITORY_STEP); // North-South Road

        // Rich resource zone subtle golden-green border glow
        if (isl.isAdjacentRich) {
          g.lineStyle(3, 0x34d399, 0.35);
          g.strokeRect(origin.x + 6, origin.y + 6, TERRITORY_PX - 12, TERRITORY_PX - 12);
        } else {
          g.lineStyle(2, 0xffffff, 0.16);
          g.strokeRect(origin.x, origin.y, TERRITORY_PX, TERRITORY_PX);
        }

        // Build slot markers (subtle circles showing where towers/buildings/walls stand)
        for (let idx = 0; idx < TERRITORY_BUILD_SLOTS.length; idx++) {
          const slot = TERRITORY_BUILD_SLOTS[idx];
          const sx = origin.x + slot.relX;
          const sy = origin.y + slot.relY;
          if (slot.role === 'wall') {
            g.lineStyle(1.5, 0xfbbf24, 0.22);
            g.strokeCircle(sx, sy, 18);
          } else if (idx < 4 + VILLAGE_TIER_CONFIGS[isl.villageTier].maxBuildings) {
            g.lineStyle(1, 0x94a3b8, 0.2);
            g.strokeCircle(sx, sy, 16);
          }
        }
      } else {
        // Fog overlay for unoccupied territories
        g.fillStyle(0x102016, 0.62);
        g.fillRect(origin.x, origin.y, TERRITORY_PX, TERRITORY_PX);

        const canAfford =
          this.inventory.wood >= isl.costWood &&
          this.inventory.stone >= isl.costStone &&
          this.inventory.gold >= isl.costGold;

        g.lineStyle(canAfford ? 3 : 2, canAfford ? 0x4ade80 : 0xfbbf24, canAfford ? 0.85 : 0.65);
        g.strokeRect(origin.x + 4, origin.y + 4, TERRITORY_PX - 8, TERRITORY_PX - 8);
      }
    }

    this.drawOuterPerimeterWarning();
  }

  private drawOuterPerimeterWarning() {
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
    this.altarCardsContainer.removeAll(true);

    for (const isl of this.islands) {
      if (isl.unlocked) continue;

      const origin = getIslandOrigin(isl.gridX, isl.gridY);
      const signX = origin.x + 320;
      const signY = origin.y + 320;

      const canAfford =
        this.inventory.wood >= isl.costWood &&
        this.inventory.stone >= isl.costStone &&
        this.inventory.gold >= isl.costGold;

      const card = this.add.container(signX, signY);

      // Shadow
      const shadow = this.add.graphics();
      shadow.fillStyle(0x000000, 0.35);
      shadow.fillEllipse(0, 48, 180, 40);
      card.add(shadow);

      // Background Card
      const bg = this.add.graphics();
      bg.fillStyle(0x0f172a, 0.9);
      bg.fillRoundedRect(-140, -64, 280, 124, 14);
      bg.lineStyle(canAfford ? 3 : 2, canAfford ? 0x4ade80 : 0xfbbf24, 1);
      bg.strokeRoundedRect(-140, -64, 280, 124, 14);
      card.add(bg);

      // Territory Name
      const nameText = this.add.text(0, -42, `🚩 ${isl.name}`, {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5);
      card.add(nameText);

      // Rich Resource Badge (중심 마을 인접 땅은 자원이 풍부함!)
      const richStr = isl.isAdjacentRich
        ? '🌟 중심 마을 인접 [자원 풍요지 - 채집 2배]'
        : '🗺️ 외곽 자원 영지 (마을 건설 가능)';
      const richText = this.add.text(0, -20, richStr, {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: isl.isAdjacentRich ? '#34d399' : '#93c5fd',
      }).setOrigin(0.5);
      card.add(richText);

      // Cost Text
      const costStr = `점령 비용: 🪵${isl.costWood}  🪨${isl.costStone}${isl.costGold > 0 ? `  🪙${isl.costGold}` : ''}`;
      const costText = this.add.text(0, 4, costStr, {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: canAfford ? '#86efac' : '#fde047',
      }).setOrigin(0.5);
      card.add(costText);

      // Action Prompt
      const actionStr = canAfford
        ? '✨ 점령 가능! [E 키 / 클릭하여 땅 점령]'
        : '자원 부족 (인접 자원 채집으로 확보)';
      const actionText = this.add.text(0, 30, actionStr, {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: canAfford ? '#4ade80' : '#f87171',
      }).setOrigin(0.5);
      card.add(actionText);

      this.altarCardsContainer.add(card);
    }
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
    container.setDepth(corePos.y + 24);

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

    // Core Info Badge
    const badge = this.add.graphics();
    badge.fillStyle(0x0f172a, 0.9);
    badge.fillRoundedRect(-92, -92, 184, 54, 9);
    badge.lineStyle(1.5, gemColor, 1);
    badge.strokeRoundedRect(-92, -92, 184, 54, 9);
    container.add(badge);

    const tierCfg = VILLAGE_TIER_CONFIGS[isl.villageTier];
    const tierText = this.add.text(
      0,
      -78,
      `💎 [${tierCfg.name}] 코어 보석`,
      {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ffffff',
      }
    ).setOrigin(0.5);
    container.add(tierText);

    const hpBar = this.add.graphics();
    container.add(hpBar);

    const hpText = this.add.text(
      0,
      -49,
      `HP ${isl.coreHp}/${isl.coreMaxHp} · [B] 마을/건설`,
      {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#7dd3fc',
      }
    ).setOrigin(0.5);
    container.add(hpText);

    const coreRef: CoreGemVisualRef = {
      territoryId: isl.id,
      container,
      crystal,
      aura,
      hpBar,
      tierText,
      hpText,
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

      let bDepth = b.y + b.height - 20;
      if (b.type === 'castle' || b.type === 'tower') bDepth = b.y + 240;
      else if (b.type === 'monastery') bDepth = b.y + 290;
      else if (b.type === 'barracks' || b.type === 'archery') bDepth = b.y + 230;
      container.setDepth(bDepth);

      const img = this.add.image(0, 0, b.type).setOrigin(0, 0);
      img.setDisplaySize(b.width, b.height);
      container.add(img);

      // Village Hall Title Badge
      const badge = this.add.graphics();
      badge.fillStyle(0x0f172a, 0.85);
      badge.fillRoundedRect(b.width / 2 - 90, -26, 180, 24, 6);
      badge.lineStyle(1.5, 0xfbbf24, 1);
      badge.strokeRoundedRect(b.width / 2 - 90, -26, 180, 24, 6);
      container.add(badge);

      const title = this.add.text(b.width / 2, -14, b.name, {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#fef08a',
      }).setOrigin(0.5);
      container.add(title);

      this.buildingVisuals.push(container);

      const box = getBuildingCollisionBox(b);
      const colliderSprite = this.physics.add.staticSprite(
        box.x + box.w / 2,
        box.y + box.h / 2,
        ''
      );
      colliderSprite.setVisible(false);
      colliderSprite.body.setSize(box.w, box.h);
      this.buildingColliders?.add(colliderSprite);
    }
  }

  /**
   * 플레이어가 건설한 건물(방어 타워, 성벽/나무 방책, 기본건물, 특수건물) 스폰
   */
  private spawnAllConstructedBuildings() {
    this.constructedVisuals.forEach((cv) => cv.container.destroy());
    this.constructedVisuals.clear();

    for (const cb of this.constructedBuildings) {
      const isl = this.islands.find((i) => i.id === cb.territoryId);
      if (isl && isl.unlocked) {
        this.spawnConstructedBuildingVisual(cb);
      }
    }
  }

  private spawnConstructedBuildingVisual(cb: ConstructedBuilding) {
    const bp = getBlueprint(cb.type);
    const container = this.add.container(cb.x, cb.y);
    container.setDepth(cb.y + 30);

    if (cb.category === 'wall') {
      const isHorizontal = cb.slotIndex === 0 || cb.slotIndex === 1;
      const isWood = cb.type === 'wood_wall';

      if (isWood) {
        // Tiny Swords 나무 목책 (Palisade) 스프라이트 렌더링
        if (isHorizontal) {
          // [북쪽 / 남쪽 외곽 방책선] - 마을 외곽을 완벽하게 감싸도록 양 모서리(-268, +268)까지 연장
          // 중앙 수평 게이트 (가로 통로용 문, 128x64 비율 유지)
          const gate = this.add.image(0, 0, 'woodPalisadeGate');
          gate.setDisplaySize(128, 64);
          gate.setDepth(2);
          container.add(gate);

          // 좌측 수평 방책 날개 (중심: -164, 너비: 208 -> 게이트 및 코너와 2px 오버랩 밀폐)
          const leftWing = this.add.image(-164, 0, 'woodPalisadeH');
          leftWing.setDisplaySize(208, 64);
          leftWing.setDepth(1);
          container.add(leftWing);

          // 우측 수평 방책 날개 (중심: 164, 너비: 208 -> 게이트 및 코너와 2px 오버랩 밀폐)
          const rightWing = this.add.image(164, 0, 'woodPalisadeH');
          rightWing.setDisplaySize(208, 64);
          rightWing.setDepth(1);
          container.add(rightWing);

          // 좌/우 모서리 연결 코너 기둥 (64x64 정밀 모서리 기둥)
          const leftCorner = this.add.image(-268, 0, 'woodPalisadeCorner');
          leftCorner.setDisplaySize(64, 64);
          leftCorner.setDepth(3);
          container.add(leftCorner);

          const rightCorner = this.add.image(268, 0, 'woodPalisadeCorner');
          rightCorner.setDisplaySize(64, 64);
          rightCorner.setDepth(3);
          container.add(rightCorner);
        } else if (cb.slotIndex === 2 || cb.slotIndex === 3) {
          // [동쪽 / 서쪽 외곽 방책선] - 상단 코너(-298)부터 하단 코너(+238)까지 틈새 0px 결합
          // 중앙 세로 게이트 (Wood_Palisade_Gate_V: 56x128 원본 -> 폭 64, 높이 128로 세로 방책과 폭 일치)
          const gate = this.add.image(0, 0, 'woodPalisadeGateV');
          gate.setDisplaySize(64, 128);
          gate.setDepth(2);
          container.add(gate);

          // 상단 수직 방책 날개 (y: -298 ~ -64 -> 중심: -178, 높이: 242로 상단 코너 및 게이트와 4px 오버랩)
          const topWing = this.add.image(0, -178, 'woodPalisadeV');
          topWing.setDisplaySize(64, 242);
          topWing.setDepth(1);
          container.add(topWing);

          // 하단 수직 방책 날개 (y: +64 ~ +238 -> 중심: 148, 높이: 182로 게이트 및 하단 코너와 4px 오버랩)
          const bottomWing = this.add.image(0, 148, 'woodPalisadeV');
          bottomWing.setDisplaySize(64, 182);
          bottomWing.setDepth(1);
          container.add(bottomWing);
        } else {
          // 내부 슬롯에 지어진 단일 방책 요새
          const palisade = this.add.image(0, -10, 'woodPalisade');
          palisade.setDisplaySize(128, 128);
          container.add(palisade);
        }
      } else {
        // 석조 성벽(stone_wall) 바리케이드 그래픽스 시각화
        const wallGraphics = this.add.graphics();
        const mainColor = 0x64748b;
        const borderColor = 0xe2e8f0;

        if (isHorizontal) {
          // 좌우로 뻗은 성벽 (중앙 통로 게이트 표현 + 양 날개 방책)
          wallGraphics.fillStyle(mainColor, 0.92);
          wallGraphics.lineStyle(2.5, borderColor, 0.95);
          wallGraphics.fillRoundedRect(-268, -14, 218, 28, 6);
          wallGraphics.strokeRoundedRect(-268, -14, 218, 28, 6);
          wallGraphics.fillRoundedRect(50, -14, 218, 28, 6);
          wallGraphics.strokeRoundedRect(50, -14, 218, 28, 6);

          // 중앙 성문 바리케이드
          wallGraphics.fillStyle(0x475569, 0.85);
          wallGraphics.fillRoundedRect(-50, -10, 100, 20, 4);
          wallGraphics.strokeRoundedRect(-50, -10, 100, 20, 4);

          for (let px = -250; px <= 250; px += 24) {
            wallGraphics.fillStyle(0x94a3b8, 1);
            wallGraphics.fillCircle(px, 0, 5);
          }
        } else {
          // 상하로 뻗은 성벽
          wallGraphics.fillStyle(mainColor, 0.92);
          wallGraphics.lineStyle(2.5, borderColor, 0.95);
          wallGraphics.fillRoundedRect(-14, -298, 28, 248, 6);
          wallGraphics.strokeRoundedRect(-14, -298, 28, 248, 6);
          wallGraphics.fillRoundedRect(-14, 50, 28, 188, 6);
          wallGraphics.strokeRoundedRect(-14, 50, 28, 188, 6);

          wallGraphics.fillStyle(0x475569, 0.85);
          wallGraphics.fillRoundedRect(-10, -50, 20, 100, 4);
          wallGraphics.strokeRoundedRect(-10, -50, 20, 100, 4);

          for (let py = -280; py <= 220; py += 24) {
            wallGraphics.fillStyle(0x94a3b8, 1);
            wallGraphics.fillCircle(0, py, 5);
          }
        }
        container.add(wallGraphics);
      }
    } else {
      // 방어 타워 / 기본건물 / 특수건물 스프라이트
      const img = this.add.image(0, -20, bp.spriteKey);
      const size = cb.category === 'tower' ? 110 : 120;
      const height = cb.category === 'tower' ? 170 : 150;
      img.setDisplaySize(size, height);
      if (cb.type === 'magic_tower') img.setTint(0xc084fc);
      if (cb.type === 'special_goldmine') img.setTint(0xfde047);
      container.add(img);

      // 방어 타워 사거리 링 표시 (은은한 원)
      if (cb.category === 'tower' && bp.range) {
        const rangeRing = this.add.graphics();
        rangeRing.lineStyle(1, cb.type === 'magic_tower' ? 0xc084fc : 0x38bdf8, 0.18);
        rangeRing.strokeCircle(0, 0, bp.range);
        container.add(rangeRing);
      }
    }

    // Label & HP Bar
    const labelBg = this.add.graphics();
    labelBg.fillStyle(0x0f172a, 0.86);
    labelBg.fillRoundedRect(-68, -68, 136, 32, 6);
    container.add(labelBg);

    const titleText = this.add.text(0, -58, `${bp.icon} ${bp.name}`, {
      fontFamily: 'Pretendard, sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#f8fafc',
    }).setOrigin(0.5);
    container.add(titleText);

    const hpBar = this.add.graphics();
    container.add(hpBar);

    const hpText = this.add.text(0, -44, `${cb.hp}/${cb.maxHp}`, {
      fontFamily: 'Pretendard, sans-serif',
      fontSize: '9px',
      fontStyle: 'bold',
      color: '#86efac',
    }).setOrigin(0.5);
    container.add(hpText);

    this.constructedVisuals.set(cb.id, {
      building: cb,
      container,
      hpBar,
      hpText,
      lastFireTime: 0,
    });

    this.updateConstructedBuildingHpBar(cb.id);
  }

  private updateConstructedBuildingHpBar(buildingId: string) {
    const cv = this.constructedVisuals.get(buildingId);
    if (!cv) return;

    const cb = cv.building;
    const ratio = Math.max(0, Math.min(1, cb.hp / Math.max(1, cb.maxHp)));
    cv.hpBar.clear();
    cv.hpBar.fillStyle(0x1e293b, 0.9);
    cv.hpBar.fillRect(-54, -49, 108, 5);
    cv.hpBar.fillStyle(ratio > 0.5 ? 0x4ade80 : ratio > 0.25 ? 0xfacc15 : 0xef4444, 1);
    cv.hpBar.fillRect(-54, -49, Math.max(2, 108 * ratio), 5);
    cv.hpText.setText(`${Math.max(0, cb.hp)}/${cb.maxHp}`);
  }

  private spawnAllEntities() {
    this.entityVisuals.forEach((ev) => ev.container.destroy());
    this.entityVisuals.clear();

    const allEntities: Entity[] = [];
    for (const isl of this.islands) {
      if (isl.unlocked) {
        allEntities.push(...generateIslandEntities(isl.id, isl.gridX, isl.gridY));
      }
    }

    for (const ent of allEntities) {
      this.spawnEntity(ent);
    }
  }

  private spawnEntity(ent: Entity) {
    const container = this.add.container(ent.x, ent.y);
    let entDepth = ent.y + 16;
    if (ent.type === 'rock' || ent.type === 'gold_rock') entDepth = ent.y + 20;
    container.setDepth(entDepth);

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
      const isRock2 = ent.id.includes('2');
      const rockKey = isRock2 ? 'rock2' : 'rock1';

      const rockImg = this.add.image(32, 16, rockKey);
      rockImg.setDisplaySize(64, 64);
      sprite = rockImg;
    } else if (ent.type === 'gold_rock') {
      if (this.textures.exists('goldResource')) {
        const goldImg = this.add.image(32, 12, 'goldResource');
        goldImg.setDisplaySize(72, 72);
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
      sprite.setDepth(2000);
      this.clouds.push({ sprite, speed: c.speed });
    }
  }

  private setupCamera() {
    this.cameras.main.startFollow(this.playerSprite, true, 0.1, 0.1);
    this.cameras.main.setZoom(this.targetZoom);
    this.cameras.main.setBounds(-1300, -1300, 3300, 3300);

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: unknown, _deltaX: number, deltaY: number) => {
      const step = 0.12;
      const next = deltaY < 0 ? this.targetZoom + step : this.targetZoom - step;
      this.targetZoom = Math.min(2.0, Math.max(0.5, Number(next.toFixed(2))));
      EventBus.emit('zoom-changed', this.targetZoom);
    });

    this.touchIndicator = this.add
      .image(0, 0, 'cursorTarget')
      .setVisible(false)
      .setDepth(9999)
      .setScale(0.35)
      .setAlpha(0.85);

    const handlePointerAction = (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;

      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;
      if (p1?.isDown && p2?.isDown) {
        this.pinchStartDist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        this.pinchStartZoom = this.targetZoom;
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
        const curDist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        if (this.pinchStartDist && this.pinchStartDist > 0) {
          const factor = curDist / this.pinchStartDist;
          const next = Math.min(2.0, Math.max(0.5, Number((this.pinchStartZoom * factor).toFixed(2))));
          this.targetZoom = next;
          EventBus.emit('zoom-changed', this.targetZoom);
        }
        return;
      }

      if (pointer.isDown && !this.touchTargetObj) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.mouseTarget = { x: worldPoint.x, y: worldPoint.y, active: true };
        this.touchIndicator.setPosition(worldPoint.x, worldPoint.y).setVisible(true);
      }
    });

    this.input.on('pointerup', () => {
      this.pinchStartDist = null;
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
    const gx = Math.round(this.playerSprite.x / TERRITORY_STEP);
    const gy = Math.round(this.playerSprite.y / TERRITORY_STEP);
    return (
      this.islands.find((i) => i.gridX === gx && i.gridY === gy && i.unlocked) ||
      this.islands.find((i) => i.unlocked) ||
      this.islands[0]
    );
  }

  private setupEventBus() {
    EventBus.on('set-player-profile', (data: { name: string; color: PlayerColor }) => {
      this.playerName = data.name;
      this.playerColor = data.color;
      this.playerNameTag.setText(this.playerName);
      this.playPlayerAnimation(this.currentAction);
    });

    EventBus.on('set-zoom', (newZoom: number) => {
      this.targetZoom = newZoom;
    });

    EventBus.on('set-inventory', (newInv: Inventory) => {
      this.inventory = newInv;
      this.drawTerrainDecorations();
      this.drawExpansionAltars();
    });

    EventBus.on('joystick-move', (vector: { x: number; y: number }) => {
      this.joystickVector = vector;
    });

    EventBus.on('trigger-interact', () => {
      this.tryInteract();
    });

    // 마을 발전 (점령지 -> 마을 -> 중소마을 -> 큰마을 -> 소도시 -> 중소도시 -> 대도시)
    EventBus.on('upgrade-village', (territoryId: number) => {
      this.handleUpgradeVillage(territoryId, true);
    });

    // 건물 건설 (방어 타워, 성벽, 기본건물, 특수건물)
    EventBus.on(
      'construct-building',
      (data: { territoryId: number; type: ConstructableType; slotIndex?: number }) => {
        this.handleConstructBuilding(data.territoryId, data.type, data.slotIndex, true);
      }
    );

    EventBus.on(
      'BUILDING_PLACED',
      (data: { territoryId: number; type: ConstructableType; slotIndex?: number }) => {
        this.handleConstructBuilding(data.territoryId, data.type, data.slotIndex, true);
      }
    );

    // 코어 보석 및 성벽 수리
    EventBus.on('repair-territory-core', (territoryId: number) => {
      this.coreGemSystem.repairCore(territoryId);
    });

    // 웨이브 즉시 호출 & 타이머 배속 제어 (30분 일반 웨이브 / 60분 보스 웨이브 검증용 치트)
    EventBus.on('trigger-regular-wave', () => {
      this.waveSystem.triggerRegularWave();
    });

    EventBus.on('trigger-boss-wave', () => {
      this.waveSystem.triggerBossWave();
    });

    EventBus.on('set-wave-timescale', (scale: number) => {
      this.waveSystem.setTimeScale(scale);
    });

    EventBus.on(
      'damage-territory-core',
      (data: { territoryId: number; damage: number }) => {
        this.coreGemSystem.damageTerritoryCore(data.territoryId, data.damage, '마물 침공 테스트', true);
      }
    );

    EventBus.on('add-test-resources', () => {
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

    const check = BuildingSystem.checkUpgrade(isl, this.inventory);
    if (!check.canUpgrade) {
      const cPos = getTerritoryCorePos(isl.gridX, isl.gridY);
      this.showFloatingText(cPos.x, cPos.y - 60, check.reason || '마을 승급 불가', '#f87171');
      return false;
    }

    const nextTier = check.nextTier!;
    const nextCfg = VILLAGE_TIER_CONFIGS[nextTier];

    if (isLocalTrigger) {
      this.inventory = {
        wood: this.inventory.wood - check.costWood,
        stone: this.inventory.stone - check.costStone,
        gold: this.inventory.gold - check.costGold,
      };
      EventBus.emit('inventory-updated', this.inventory);
    }

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
      this.broadcastVillageUpgrade(territoryId, nextTier);
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
      this.broadcastBuildingConstructed(newBuilding);
    }
    return true;
  }

  private handleRepairCore(territoryId: number) {
    const isl = this.islands.find((i) => i.id === territoryId);
    if (!isl || !isl.unlocked) return;
    if (isl.coreHp >= isl.coreMaxHp) {
      this.showFloatingText(
        getTerritoryCorePos(isl.gridX, isl.gridY).x,
        getTerritoryCorePos(isl.gridX, isl.gridY).y - 60,
        '💎 코어 보석이 이미 최대 체력입니다!',
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
      exp.setDepth(3500);
      exp.setDisplaySize(140, 140);
      exp.play('explosion_anim');
      exp.once('animationcomplete', () => exp.destroy());
    }
  }

  private setupMultiplayer() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.localBus = new BroadcastChannel('tiny_isles_multiplayer');
      this.localBus.onmessage = (event) => {
        const { data } = event;
        if (!data || data.senderId === this.playerId) return;
        if (data.type === 'player_move') {
          this.handleRemotePlayerMove(data.payload);
        } else if (data.type === 'hit') {
          const { entityId, damage, hitBy } = data.payload;
          this.handleRemoteHit(entityId, damage, hitBy);
        } else if (data.type === 'island_unlocked') {
          const { islandId, unlockedBy } = data.payload;
          this.unlockIslandLocally(islandId, unlockedBy, false);
        } else if (data.type === 'village_upgraded') {
          const { territoryId } = data.payload;
          this.handleUpgradeVillage(territoryId, false);
        } else if (data.type === 'building_constructed') {
          const cb: ConstructedBuilding = data.payload;
          if (!this.constructedBuildings.some((b) => b.id === cb.id)) {
            this.constructedBuildings.push(cb);
            this.spawnConstructedBuildingVisual(cb);
            this.saveWorldState();
            this.emitWorldStateToReact();
          }
        } else if (data.type === 'wave_spawned') {
          this.spawnMonsterWave(data.payload.isBossWave, false);
        } else if (data.type === 'territory_lost') {
          this.loseTerritoryByCoreDestruction(data.payload.territoryId, '마물 군단', false);
        }
      };
    }

    const roomId = 'tiny_isles_global_hub';
    const channel = supabase.channel(roomId, {
      config: {
        broadcast: { self: false },
        presence: { key: this.playerId },
      },
    });
    this.supabaseChannel = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const count = Math.max(1, Object.keys(presenceState).length);
        EventBus.emit('online-count-changed', count);
      })
      .on('presence', { event: 'leave' }, ({ key }: { key: string }) => {
        this.removeRemotePlayer(key);
      })
      .on('broadcast', { event: 'player_move' }, ({ payload }: { payload: any }) => {
        if (!serverSync.isValidIncomingEvent(payload.eventId, payload.senderId, this.playerId)) return;
        this.handleRemotePlayerMove(payload);
      })
      .on(
        'broadcast',
        { event: 'entity_hit' },
        ({ payload }: { payload: { entityId: string; damage: number; hitBy: string; eventId?: string; senderId?: string } }) => {
          if (!serverSync.isValidIncomingEvent(payload.eventId, payload.senderId, this.playerId)) return;
          const { entityId, damage, hitBy } = payload;
          this.handleRemoteHit(entityId, damage, hitBy);
        }
      )
      .on(
        'broadcast',
        { event: 'island_unlocked' },
        ({ payload }: { payload: { islandId: number; unlockedBy: string; eventId?: string; senderId?: string } }) => {
          if (!serverSync.isValidIncomingEvent(payload.eventId, payload.senderId, this.playerId)) return;
          const { islandId, unlockedBy } = payload;
          this.unlockIslandLocally(islandId, unlockedBy, false);
        }
      )
      .on(
        'broadcast',
        { event: 'village_upgraded' },
        ({ payload }: { payload: { territoryId: number; tier: VillageTier; eventId?: string; senderId?: string } }) => {
          if (!serverSync.isValidIncomingEvent(payload.eventId, payload.senderId, this.playerId)) return;
          this.handleUpgradeVillage(payload.territoryId, false);
        }
      )
      .on(
        'broadcast',
        { event: 'building_constructed' },
        ({ payload }: { payload: { building: ConstructedBuilding; eventId?: string; senderId?: string } }) => {
          if (!serverSync.isValidIncomingEvent(payload.eventId, payload.senderId, this.playerId)) return;
          const cb: ConstructedBuilding = payload.building;
          if (cb && !this.constructedBuildings.some((b) => b.id === cb.id)) {
            this.constructedBuildings.push(cb);
            this.spawnConstructedBuildingVisual(cb);
            this.saveWorldState();
            this.emitWorldStateToReact();
          }
        }
      )
      .on(
        'broadcast',
        { event: 'wave_spawned' },
        ({ payload }: { payload: { isBossWave: boolean; eventId?: string; senderId?: string } }) => {
          if (!serverSync.isValidIncomingEvent(payload.eventId, payload.senderId, this.playerId)) return;
          this.spawnMonsterWave(payload.isBossWave, false);
        }
      )
      .on(
        'broadcast',
        { event: 'territory_lost' },
        ({ payload }: { payload: { territoryId: number; reason?: string; eventId?: string; senderId?: string } }) => {
          if (!serverSync.isValidIncomingEvent(payload.eventId, payload.senderId, this.playerId)) return;
          this.loseTerritoryByCoreDestruction(payload.territoryId, payload.reason || '마물 군단', false);
        }
      )
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          this.isSubscribed = true;
          await channel.track({
            name: this.playerName,
            color: this.playerColor,
            joinedAt: Date.now(),
          });
        }
      });
  }

  update(time: number, delta: number) {
    // 1. Update Wave System (30m & 60m Countdown, Spawning & 3-stage Monster AI)
    this.waveSystem.update(time, delta);

    // 2. Update Tower Defense System (Archer/Magic Towers & Barracks Synergies)
    this.towerDefenseSystem.update(time, delta);

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
    this.playerSprite.setDepth(py + 24);
    this.playerNameTag.setPosition(px, py - 42).setDepth(py + 30);
    this.playerIndicator.setPosition(px, py - 54).setDepth(py + 30);

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

    if (time - this.lastBroadcastTime > 60) {
      this.lastBroadcastTime = time;
      this.broadcastPlayerMove();
    }
  }

  private destroyConstructedBuilding(buildingId: string) {
    const idx = this.constructedBuildings.findIndex((b) => b.id === buildingId);
    if (idx === -1) return;
    const removed = this.constructedBuildings[idx];
    this.constructedBuildings.splice(idx, 1);

    const cv = this.constructedVisuals.get(buildingId);
    if (cv) {
      this.playExplosionAt(removed.x, removed.y);
      cv.container.destroy();
      this.constructedVisuals.delete(buildingId);
    }

    sound.playBreak();
    this.showFloatingText(removed.x, removed.y - 40, `💥 ${removed.name} 파괴됨!`, '#ef4444');
    this.saveWorldState();
    this.emitWorldStateToReact();
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
          }
        } else if (cb.type === 'special_sanctuary') {
          // 성소: 코어 보석 및 성벽 회복
          if (isl.coreHp < isl.coreMaxHp) {
            isl.coreHp = Math.min(isl.coreMaxHp, isl.coreHp + 20);
            this.updateCoreGemVisual(isl.id);
          }
          for (const other of this.constructedBuildings) {
            if (other.territoryId === isl.id && other.hp < other.maxHp) {
              other.hp = Math.min(other.maxHp, other.hp + 35);
              this.updateConstructedBuildingHpBar(other.id);
            }
          }
          this.showFloatingText(cb.x, cb.y - 35, '✨ 성소 치유 오라', '#38bdf8');
        }
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

    const gridX = Math.round(px / TERRITORY_STEP);
    const gridY = Math.round(py / TERRITORY_STEP);
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

    // 3. 자원 엔티티 채집 (중심 마을 인접 땅은 자원이 풍부하여 채집량 2배!)
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
      const isl = this.islands.find((i) => i.id === ent.islandId);
      if (isl && !isl.unlocked) {
        this.showFloatingText(ent.x + 16, ent.y - 20, '🔒 먼저 이 땅을 점령해야 합니다!', '#f59e0b');
        return;
      }

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
      // 중심 마을과 인접한 땅(isAdjacentRich)은 자원이 풍부하여 채집 시 +2 획득!
      const harvestAmount = isl?.isAdjacentRich ? 2 : 1;
      this.inventory[resKey] += harvestAmount;
      EventBus.emit('inventory-updated', this.inventory);

      const icon =
        resKey === 'wood'
          ? `🪵 +${harvestAmount}`
          : resKey === 'gold'
          ? `🪙 +${harvestAmount}`
          : `🪨 +${harvestAmount}`;
      const richTag = isl?.isAdjacentRich ? ' (풍요지 보너스!)' : '';
      const color = resKey === 'wood' ? '#8bc34a' : resKey === 'gold' ? '#ffd700' : '#cfd8dc';
      this.showFloatingText(ent.x + 16, ent.y, `${icon}${richTag}`, color);

      this.broadcastHit(ent.id, damage);

      if (ent.hp <= 0) {
        sound.playBreak();
        this.removeAndRespawnEntity(ent);
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
          this.saveWorldState();
          this.emitWorldStateToReact();
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

    this.time.delayedCall(12000, () => {
      const isl = this.islands.find((i) => i.id === ent.islandId);
      if (isl && isl.unlocked) {
        ent.hp = ent.maxHp;
        this.spawnEntity(ent);
      }
    });
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

    // 새 점령지에 코어 보석 생성!
    this.createTerritoryCoreForIsland(target);

    // 새 점령지에 자원 엔티티 및 건물 생성
    const newEntities = generateIslandEntities(target.id, target.gridX, target.gridY);
    for (const ent of newEntities) {
      this.spawnEntity(ent);
    }
    this.spawnAllBuildings();
    this.emitWorldStateToReact();

    sound.playUnlock();
    confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });

    const origin = getIslandOrigin(target.gridX, target.gridY);
    const msg = `🚩 ${unlockedBy}님이 '${target.name}' 땅을 점령했습니다! 코어 보석을 지키고 마을을 세우세요!`;
    this.showFloatingText(origin.x + 320, origin.y + 240, msg, '#ffd700');
    EventBus.emit('game-alert', msg);

    if (isLocalTrigger) {
      serverSync.saveUnlockedIsland(islandId, target.name, unlockedBy);
      this.broadcastUnlock(islandId, unlockedBy);
    }
  }

  private shakeObject(target: Phaser.GameObjects.Container) {
    const startX = target.x;
    this.tweens.add({
      targets: target,
      x: startX + 6,
      duration: 40,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        target.x = startX;
      },
    });
  }

  private showFloatingText(x: number, y: number, text: string, color: string) {
    const ft = this.add.text(x, y, text, {
      fontFamily: 'Pretendard, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    ft.setDepth(3000);

    this.tweens.add({
      targets: ft,
      y: y - 50,
      alpha: 0,
      duration: 1300,
      ease: 'Cubic.easeOut',
      onComplete: () => ft.destroy(),
    });
  }

  private handleRemotePlayerMove(data: Player) {
    if (data.id === this.playerId) return;
    if (!serverSync.isLatestMove(data.id, data.lastUpdated || Date.now())) return;

    let visual = this.remotePlayers.get(data.id);
    if (!visual) {
      const container = this.add.container(data.x, data.y);

      const sprite = this.add.sprite(0, 0, `${data.color}PawnIdle`);
      sprite.setDisplaySize(128, 128);
      container.add(sprite);

      const nameTag = this.add.text(0, -42, data.name, {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#f87171',
        stroke: '#000000',
        strokeThickness: 2.5,
      }).setOrigin(0.5);
      container.add(nameTag);

      visual = { container, sprite, nameTag, data };
      this.remotePlayers.set(data.id, visual);
    }

    // 고스트 텔레포트 방지: 임계치(280px) 초과 시만 Snap 순간이동, 그 외에는 부드러운 Tween 선형 보간
    if (serverSync.shouldSnapTeleport(visual.container.x, visual.container.y, data.x, data.y, 280)) {
      visual.container.setPosition(data.x, data.y);
    } else {
      this.tweens.add({
        targets: visual.container,
        x: data.x,
        y: data.y,
        duration: 120,
        ease: 'Linear',
      });
    }

    visual.container.setDepth(data.y + 24);
    visual.sprite.setFlipX(data.direction === 'left');
    visual.nameTag.setText(data.name);

    const animKey = `${data.color}_${data.action}`;
    if (this.anims.exists(animKey)) {
      visual.sprite.play(animKey, true);
    }
  }

  private removeRemotePlayer(id: string) {
    serverSync.removePlayerCache(id);
    const visual = this.remotePlayers.get(id);
    if (visual) {
      visual.container.destroy();
      this.remotePlayers.delete(id);
    }
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

  private broadcastPlayerMove() {
    const payload: Player = {
      id: this.playerId,
      name: this.playerName,
      x: Math.round(this.playerSprite.x),
      y: Math.round(this.playerSprite.y),
      direction: this.currentDirection,
      action: this.currentAction,
      color: this.playerColor,
      lastUpdated: Date.now(),
    };

    if (this.localBus) {
      this.localBus.postMessage({
        type: 'player_move',
        senderId: this.playerId,
        payload,
      });
    }

    if (this.supabaseChannel && this.isSubscribed) {
      serverSync.broadcast(this.supabaseChannel, 'player_move', payload, this.playerId);
    }
  }

  private broadcastHit(entityId: string, damage: number) {
    const payload = { entityId, damage, hitBy: this.playerName };
    if (this.localBus) {
      this.localBus.postMessage({
        type: 'hit',
        senderId: this.playerId,
        payload,
      });
    }
    if (this.supabaseChannel && this.isSubscribed) {
      this.supabaseChannel.send({
        type: 'broadcast',
        event: 'entity_hit',
        payload,
      });
    }
  }

  private broadcastUnlock(islandId: number, unlockedBy: string) {
    const payload = { islandId, unlockedBy };
    if (this.localBus) {
      this.localBus.postMessage({
        type: 'island_unlocked',
        senderId: this.playerId,
        payload,
      });
    }
    if (this.supabaseChannel && this.isSubscribed) {
      this.supabaseChannel.send({
        type: 'broadcast',
        event: 'island_unlocked',
        payload,
      });
    }
  }

  private broadcastVillageUpgrade(territoryId: number, tier: VillageTier) {
    const payload = { territoryId, tier };
    if (this.localBus) {
      this.localBus.postMessage({
        type: 'village_upgraded',
        senderId: this.playerId,
        payload,
      });
    }
    if (this.supabaseChannel && this.isSubscribed) {
      serverSync.broadcast(this.supabaseChannel, 'village_upgraded', payload, this.playerId);
    }
  }

  private broadcastBuildingConstructed(building: ConstructedBuilding) {
    const payload = { building };
    if (this.localBus) {
      this.localBus.postMessage({
        type: 'building_constructed',
        senderId: this.playerId,
        payload: building,
      });
    }
    if (this.supabaseChannel && this.isSubscribed) {
      serverSync.broadcast(this.supabaseChannel, 'building_constructed', payload, this.playerId);
    }
  }

  private broadcastWaveSpawn(isBossWave: boolean) {
    const payload = { isBossWave };
    if (this.localBus) {
      this.localBus.postMessage({
        type: 'wave_spawned',
        senderId: this.playerId,
        payload,
      });
    }
    if (this.supabaseChannel && this.isSubscribed) {
      serverSync.broadcast(this.supabaseChannel, 'wave_spawned', payload, this.playerId);
    }
  }

  private broadcastTerritoryLost(territoryId: number) {
    const payload = { territoryId, reason: '마물 군단' };
    if (this.localBus) {
      this.localBus.postMessage({
        type: 'territory_lost',
        senderId: this.playerId,
        payload,
      });
    }
    if (this.supabaseChannel && this.isSubscribed) {
      serverSync.broadcast(this.supabaseChannel, 'territory_lost', payload, this.playerId);
    }
  }
}
