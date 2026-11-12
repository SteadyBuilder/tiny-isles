import Phaser from 'phaser';
import confetti from 'canvas-confetti';
import { EventBus } from '../EventBus';
import {
  TERRITORY_PX,
  INITIAL_ISLANDS,
  CENTRAL_CORE,
  generateIslandEntities,
  generateTerritoryBuildings,
  getIslandOrigin,
  getBuildingCollisionBox,
} from '../../constants';
import {
  Building,
  Entity,
  Inventory,
  Island,
  Player,
  PlayerAction,
  PlayerColor,
} from '../../../types/game';
import { sound } from '../../../lib/sound';
import { supabase } from '../../../lib/supabase';
import { storage } from '../../../lib/storage';
import { serverSync } from '../../../lib/serverSync';

interface RemotePlayerVisual {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  nameTag: Phaser.GameObjects.Text;
  shadow: Phaser.GameObjects.Graphics;
  data: Player;
}

interface EntityVisual {
  entity: Entity;
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Graphics;
  hpBar?: Phaser.GameObjects.Graphics;
}

export class WorldScene extends Phaser.Scene {
  // Player
  private playerSprite!: Phaser.Physics.Arcade.Sprite;
  private playerShadow!: Phaser.GameObjects.Graphics;
  private playerNameTag!: Phaser.GameObjects.Text;
  private playerIndicator!: Phaser.GameObjects.Text;
  private playerColor: PlayerColor = 'blue';
  private playerName: string = '탐험가';
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

  // Graphics Layers
  private terrainGraphics!: Phaser.GameObjects.Graphics;
  private altarCardsContainer!: Phaser.GameObjects.Container;
  private clouds: { shadow: Phaser.GameObjects.Graphics; sprite: Phaser.GameObjects.Image; speed: number }[] = [];

  // Core Visuals
  private coreContainer!: Phaser.GameObjects.Container;
  private coreCrystal!: Phaser.GameObjects.Polygon;
  private coreAura!: Phaser.GameObjects.Graphics;

  // Controls & Inputs
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: { [key: string]: Phaser.Input.Keyboard.Key };
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private eKey!: Phaser.Input.Keyboard.Key;
  private joystickVector = { x: 0, y: 0 };
  private mouseTarget: { x: number; y: number; active: boolean } = { x: 0, y: 0, active: false };

  // Multiplayer Channels
  private localBus: BroadcastChannel | null = null;
  private supabaseChannel: ReturnType<typeof supabase.channel> | null = null;
  private isSubscribed = false;
  private lastBroadcastTime = 0;

  // Inventory & State Cache
  private inventory: Inventory = { wood: 0, stone: 0, gold: 0 };
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
    this.playerName = data?.playerName || profile.name || '탐험가';
    this.playerColor = data?.playerColor || profile.color || 'blue';
    this.targetZoom = data?.zoom || storage.loadZoom() || 1.0;
    this.inventory = storage.loadInventory();
  }

  create() {
    const savedUnlocked = storage.loadUnlockedIslands();
    this.islands = INITIAL_ISLANDS.map((isl: Island) => ({
      ...isl,
      unlocked: savedUnlocked.includes(isl.id) || isl.id === 0,
    }));

    // Setup Physics World Bounds (-1300 to 1940)
    const worldMin = -2 * TERRITORY_PX + 24;
    const worldMax = 3 * TERRITORY_PX - 24;
    const worldWidth = worldMax - worldMin;
    this.physics.world.setBounds(worldMin, worldMin, worldWidth, worldWidth);

    // 1. Seamless Grass Tile Background
    const bgPadding = 600;
    const bgTile = this.add.tileSprite(
      worldMin - bgPadding / 2 + worldWidth / 2,
      worldMin - bgPadding / 2 + worldWidth / 2,
      worldWidth + bgPadding,
      worldWidth + bgPadding,
      'grassSeamless'
    );
    bgTile.setDepth(-100);

    // 2. Terrain Graphics (Roads, Plazas, Border lines)
    this.terrainGraphics = this.add.graphics();
    this.terrainGraphics.setDepth(-50);
    this.drawTerrainDecorations();

    // 3. Buildings Static Physics Group
    this.buildingColliders = this.physics.add.staticGroup();
    this.spawnAllBuildings();

    // 4. Territory Expansion Altars Container
    this.altarCardsContainer = this.add.container(0, 0);
    this.altarCardsContainer.setDepth(-20);
    this.drawExpansionAltars();

    // 5. Central Territory Core
    this.createTerritoryCore();

    // 6. Spawn Resource Entities
    this.spawnAllEntities();

    // 7. Create Local Player
    this.createPlayer();

    // 8. Create Ambient Drifting Clouds
    this.createClouds();

    // 9. Camera Setup
    this.setupCamera();

    // 10. Controls & Input Listeners
    this.setupInputs();

    // 11. EventBus Listeners (Bridge with React)
    this.setupEventBus();

    // 12. Multiplayer Setup
    this.setupMultiplayer();

    // 13. Notify React scene is ready
    EventBus.emit('scene-ready', this);
    const unlockedIds = this.islands.filter((i) => i.unlocked).map((i) => i.id);
    EventBus.emit('unlocked-islands', unlockedIds, this.islands.length);
  }

  private drawTerrainDecorations() {
    const g = this.terrainGraphics;
    g.clear();

    const origin0 = getIslandOrigin(0, 0);

    // Cobblestone Plaza around Core
    g.fillStyle(0xa8a29e, 0.45);
    g.fillCircle(origin0.x + 320, origin0.y + 350, 64);
    g.lineStyle(4, 0x78716c, 0.55);
    g.strokeCircle(origin0.x + 320, origin0.y + 350, 64);

    // Road connecting Castle entrance to Core Plaza
    g.fillStyle(0xa8a29e, 0.38);
    g.fillRect(origin0.x + 320 - 24, origin0.y + 220, 48, 130);

    // Crossroads branching outwards
    g.fillRect(origin0.x, origin0.y + 350 - 20, 320, 40); // West
    g.fillRect(origin0.x + 320, origin0.y + 350 - 20, 320, 40); // East
    g.fillRect(origin0.x + 320 - 20, origin0.y + 350, 40, 290); // South
    g.fillRect(origin0.x + 320 - 20, origin0.y, 40, 220); // North

    // Roads to adjacent unlocked territories
    for (const isl of this.islands) {
      if (!isl.unlocked || isl.id === 0) continue;
      const origin = getIslandOrigin(isl.gridX, isl.gridY);
      g.fillStyle(0xa8a29e, 0.32);
      if (isl.gridX === 1) g.fillRect(origin.x, origin.y + 350 - 18, 320, 36);
      if (isl.gridX === -1) g.fillRect(origin.x + 320, origin.y + 350 - 18, 320, 36);
      if (isl.gridY === 1) g.fillRect(origin.x + 320 - 18, origin.y, 36, 320);
      if (isl.gridY === -1) g.fillRect(origin.x + 320 - 18, origin.y + 320, 36, 320);
    }

    // Territory Borders
    for (const isl of this.islands) {
      const origin = getIslandOrigin(isl.gridX, isl.gridY);
      if (isl.unlocked) {
        // Subtle boundary
        g.lineStyle(2, 0xffffff, 0.12);
        g.strokeRect(origin.x, origin.y, TERRITORY_PX, TERRITORY_PX);

        // Corner stones
        g.fillStyle(0xcbd5e1, 0.45);
        g.fillCircle(origin.x, origin.y, 6);
        g.fillCircle(origin.x + TERRITORY_PX, origin.y, 6);
        g.fillCircle(origin.x, origin.y + TERRITORY_PX, 6);
        g.fillCircle(origin.x + TERRITORY_PX, origin.y + TERRITORY_PX, 6);
      } else {
        // Fog overlay for locked territories
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
      shadow.fillEllipse(0, 40, 160, 40);
      card.add(shadow);

      // Background Card
      const bg = this.add.graphics();
      bg.fillStyle(0x0f172a, 0.88);
      bg.fillRoundedRect(-125, -56, 250, 108, 14);
      bg.lineStyle(canAfford ? 3 : 2, canAfford ? 0x4ade80 : 0xfbbf24, 1);
      bg.strokeRoundedRect(-125, -56, 250, 108, 14);
      card.add(bg);

      // Territory Name
      const nameText = this.add.text(0, -32, `🚩 ${isl.name}`, {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5);
      card.add(nameText);

      // Cost Text
      const costStr = `필요: 🪵${isl.costWood}  🪨${isl.costStone}${isl.costGold > 0 ? `  🪙${isl.costGold}` : ''}`;
      const costText = this.add.text(0, -6, costStr, {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: canAfford ? '#86efac' : '#fde047',
      }).setOrigin(0.5);
      card.add(costText);

      // Action Prompt
      const actionStr = canAfford ? '✨ 개척 가능! [E 키 / 액션 터치]' : '자원 부족 (주변 자원 채집 필요)';
      const actionText = this.add.text(0, 22, actionStr, {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: canAfford ? '#4ade80' : '#f87171',
      }).setOrigin(0.5);
      card.add(actionText);

      this.altarCardsContainer.add(card);
    }
  }

  private createTerritoryCore() {
    this.coreContainer = this.add.container(CENTRAL_CORE.x, CENTRAL_CORE.y);
    this.coreContainer.setDepth(CENTRAL_CORE.y + 24);

    // Glowing Aura
    this.coreAura = this.add.graphics();
    this.coreAura.fillStyle(0x38bdf8, 0.25);
    this.coreAura.fillCircle(0, 0, 52);
    this.coreContainer.add(this.coreAura);

    // Aura pulse tween
    this.tweens.add({
      targets: this.coreAura,
      scaleX: 1.25,
      scaleY: 1.25,
      alpha: 0.1,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Shadow
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.22);
    shadow.fillEllipse(0, 10, 24, 8);
    this.coreContainer.add(shadow);

    // Floating Magical Diamond Crystal
    const points = [
      { x: 0, y: -22 },
      { x: 14, y: 0 },
      { x: 0, y: 22 },
      { x: -14, y: 0 },
    ];
    this.coreCrystal = this.add.polygon(0, -26, points, 0x38bdf8);
    this.coreCrystal.setStrokeStyle(2.5, 0xe0f2fe);
    this.coreContainer.add(this.coreCrystal);

    // Crystal floating tween
    this.tweens.add({
      targets: this.coreCrystal,
      y: -36,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Core Title Badge
    const badge = this.add.graphics();
    badge.fillStyle(0x0f172a, 0.85);
    badge.fillRoundedRect(-70, -74, 140, 36, 8);
    badge.lineStyle(1.5, 0x38bdf8, 1);
    badge.strokeRoundedRect(-70, -74, 140, 36, 8);
    this.coreContainer.add(badge);

    const titleText = this.add.text(0, -62, '💎 영지 코어 Lv.1', {
      fontFamily: 'Pretendard, sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.coreContainer.add(titleText);

    const subText = this.add.text(0, -46, '[E] 코어 공명', {
      fontFamily: 'Pretendard, sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#38bdf8',
    }).setOrigin(0.5);
    this.coreContainer.add(subText);
  }

  private spawnAllBuildings() {
    this.buildings = [];
    this.buildingVisuals.forEach((c) => c.destroy());
    this.buildingVisuals = [];
    this.buildingColliders?.clear(true, true);

    const savedUnlocked = storage.loadUnlockedIslands();
    for (const isl of this.islands) {
      if (savedUnlocked.includes(isl.id) || isl.id === 0) {
        const buildings = generateTerritoryBuildings(isl.id, isl.gridX, isl.gridY);
        this.buildings.push(...buildings);
      }
    }

    for (const b of this.buildings) {
      const container = this.add.container(b.x, b.y);

      // Depth
      let bDepth = b.y + b.height - 20;
      if (b.type === 'castle' || b.type === 'tower') bDepth = b.y + 240;
      else if (b.type === 'monastery') bDepth = b.y + 290;
      else if (b.type === 'barracks' || b.type === 'archery') bDepth = b.y + 230;
      container.setDepth(bDepth);

      // Shadow
      const shadow = this.add.graphics();
      shadow.fillStyle(0x000000, 0.22);
      let shadowY = b.height - 20;
      let shadowW = b.width * 0.75;
      let shadowH = 20;

      if (b.type === 'castle') {
        shadowY = 248;
        shadowW = 260;
        shadowH = 22;
      } else if (b.type === 'house1') {
        shadowY = 172;
        shadowW = 88;
        shadowH = 16;
      } else if (b.type === 'house2') {
        shadowY = 177;
        shadowW = 92;
        shadowH = 16;
      } else if (b.type === 'house3') {
        shadowY = 174;
        shadowW = 90;
        shadowH = 16;
      } else if (b.type === 'tower') {
        shadowY = 228;
        shadowW = 76;
        shadowH = 18;
      } else if (b.type === 'barracks' || b.type === 'archery') {
        shadowY = 230;
        shadowW = 140;
        shadowH = 20;
      } else if (b.type === 'monastery') {
        shadowY = 290;
        shadowW = 180;
        shadowH = 22;
      }

      shadow.fillEllipse(b.width / 2, shadowY, shadowW, shadowH);
      container.add(shadow);

      // Building Image
      const img = this.add.image(0, 0, b.type).setOrigin(0, 0);
      img.setDisplaySize(b.width, b.height);
      container.add(img);

      // Castle Title
      if (b.type === 'castle') {
        const castleBadge = this.add.graphics();
        castleBadge.fillStyle(0x0f172a, 0.85);
        castleBadge.fillRoundedRect(b.width / 2 - 95, -30, 190, 26, 6);
        castleBadge.lineStyle(1.5, 0x38bdf8, 1);
        castleBadge.strokeRoundedRect(b.width / 2 - 95, -30, 190, 26, 6);
        container.add(castleBadge);

        const castleTitle = this.add.text(b.width / 2, -17, b.name, {
          fontFamily: 'Pretendard, sans-serif',
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#f8fafc',
        }).setOrigin(0.5);
        container.add(castleTitle);
      }

      this.buildingVisuals.push(container);

      // Add Static Collider for building hitbox
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

  private spawnAllEntities() {
    this.entityVisuals.forEach((ev) => ev.container.destroy());
    this.entityVisuals.clear();

    const savedUnlocked = storage.loadUnlockedIslands();
    const allEntities: Entity[] = [];
    for (const isl of this.islands) {
      if (savedUnlocked.includes(isl.id) || isl.id === 0) {
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

    // Shadow
    const shadow = this.add.graphics();
    container.add(shadow);

    let sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;

    if (ent.type === 'tree') {
      const isTree3 = ent.id.includes('2') || ent.id.includes('4');
      const key = isTree3 ? 'tree3' : 'tree';
      const animKey = isTree3 ? 'tree3_anim' : 'tree_anim';
      const drawH = isTree3 ? 160 : 200;
      const groundY = 26;
      const trunkOriginY = isTree3 ? 170 / 192 : 241 / 256;

      // Tree shadow: 접지선 바로 밑 아담한 타원
      shadow.fillStyle(0x000000, 0.22);
      shadow.fillEllipse(16, groundY, 42, 12);

      const treeSprite = this.add.sprite(16, groundY, key);
      treeSprite.setDisplaySize(160, drawH);
      treeSprite.setOrigin(0.5, trunkOriginY);
      if (this.anims.exists(animKey)) {
        treeSprite.play(animKey);
      }
      sprite = treeSprite;
    } else if (ent.type === 'rock') {
      const isRock2 = ent.id.includes('2');
      const rockKey = isRock2 ? 'rock2' : 'rock1';
      const groundY = 26;
      const rockOriginY = isRock2 ? 53 / 64 : 51 / 64;

      // Rock shadow: 바위 바닥에 딱 맞는 그림자
      shadow.fillStyle(0x000000, 0.22);
      shadow.fillEllipse(32, groundY, isRock2 ? 38 : 28, 9);

      const rockImg = this.add.image(32, groundY, rockKey);
      rockImg.setDisplaySize(64, 64);
      rockImg.setOrigin(0.5, rockOriginY);
      sprite = rockImg;
    } else if (ent.type === 'gold_rock') {
      const groundY = 26;
      const rockOriginY = 53 / 64;

      shadow.fillStyle(0x000000, 0.22);
      shadow.fillEllipse(32, groundY, 40, 10);

      if (this.textures.exists('goldResource')) {
        const goldImg = this.add.image(32, groundY, 'goldResource');
        goldImg.setDisplaySize(72, 72);
        goldImg.setOrigin(0.5, 0.76);
        sprite = goldImg;
      } else {
        const rockImg = this.add.image(32, groundY, 'rock2');
        rockImg.setDisplaySize(64, 64);
        rockImg.setOrigin(0.5, rockOriginY);
        rockImg.setTint(0xffd700);
        sprite = rockImg;
      }
    } else {
      // Sheep (128x128 frame, bbox: 41, 40, 86, 84 -> actual foot is at y=84)
      const groundY = 26;
      const sheepOriginY = 84 / 128; // 0.65625

      // Sheep shadow: 양 발 바로 아래 꼭 맞는 크기
      shadow.fillStyle(0x000000, 0.24);
      shadow.fillEllipse(32, groundY, 26, 8);

      const sheepSprite = this.add.sprite(32, groundY, 'sheep');
      sheepSprite.setDisplaySize(96, 96);
      sheepSprite.setOrigin(0.5, sheepOriginY);
      if (this.anims.exists('sheep_anim')) {
        sheepSprite.play('sheep_anim');
      }
      sprite = sheepSprite;
    }

    container.add(sprite);

    // HP Bar
    const hpBar = this.add.graphics();
    container.add(hpBar);

    this.entityVisuals.set(ent.id, {
      entity: ent,
      container,
      sprite,
      shadow,
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
    const startY = 420;

    // Ground Shadow (Foot is at py + 25)
    this.playerShadow = this.add.graphics();
    this.playerShadow.fillStyle(0x000000, 0.25);
    this.playerShadow.fillEllipse(0, 0, 28, 9);
    this.playerShadow.setPosition(startX, startY + 25);

    // Arcade Physics Sprite directly in world!
    this.playerSprite = this.physics.add.sprite(startX, startY, `${this.playerColor}PawnIdle`);
    this.playerSprite.setDisplaySize(128, 128);
    this.playerSprite.setCollideWorldBounds(true);
    // Foot hitbox for clean top-down movement
    this.playerSprite.setSize(36, 24);
    this.playerSprite.setOffset(78, 96);

    // Collide with buildings
    if (this.buildingColliders) {
      this.physics.add.collider(this.playerSprite, this.buildingColliders);
    }

    // Name Tag
    this.playerNameTag = this.add.text(startX, startY - 42, this.playerName, {
      fontFamily: 'Pretendard, sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#38bdf8',
      stroke: '#000000',
      strokeThickness: 2.5,
    }).setOrigin(0.5);

    // Local Player Indicator Marker '▼'
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
      { x: -400, y: -200, speed: 0.35, scale: 0.9, type: 'cloud1' },
      { x: 150, y: 100, speed: 0.42, scale: 1.1, type: 'cloud2' },
      { x: 800, y: -80, speed: 0.3, scale: 0.85, type: 'cloud1' },
      { x: -100, y: 650, speed: 0.38, scale: 1.0, type: 'cloud2' },
      { x: 600, y: 800, speed: 0.28, scale: 0.95, type: 'cloud1' },
      { x: -700, y: 350, speed: 0.34, scale: 1.05, type: 'cloud2' },
    ];

    for (const c of cloudConfigs) {
      // Ground shadow: depth -10 so it casts on the ground, below entities/players
      const shadow = this.add.graphics();
      shadow.setDepth(-10);

      // Sky cloud: depth 2000 so it floats in the sky above everything
      const sprite = this.add.image(c.x, c.y, c.type);
      sprite.setScale(c.scale);
      sprite.setAlpha(0.65);
      sprite.setDepth(2000);

      this.clouds.push({ shadow, sprite, speed: c.speed });
    }
  }

  private setupCamera() {
    this.cameras.main.startFollow(this.playerSprite, true, 0.1, 0.1);
    this.cameras.main.setZoom(this.targetZoom);
    this.cameras.main.setBounds(-1300, -1300, 3300, 3300);

    // Wheel Zoom
    this.input.on('wheel', (pointer: Phaser.Input.Pointer, gameObjects: unknown, deltaX: number, deltaY: number) => {
      const step = 0.12;
      const next = deltaY < 0 ? this.targetZoom + step : this.targetZoom - step;
      this.targetZoom = Math.min(2.0, Math.max(0.5, Number(next.toFixed(2))));
      EventBus.emit('zoom-changed', this.targetZoom);
    });

    // Click / Pointer move to position
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.mouseTarget = { x: worldPoint.x, y: worldPoint.y, active: true };
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

      this.spaceKey.on('down', () => this.tryInteract());
      this.eKey.on('down', () => this.tryInteract());
    }

    // Window action event for mobile action button
    const handlePlayerAction = () => {
      this.tryInteract();
    };
    window.addEventListener('player-action', handlePlayerAction);
    this.events.once('shutdown', () => {
      window.removeEventListener('player-action', handlePlayerAction);
    });
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
      .on('broadcast', { event: 'player_move' }, ({ payload }: { payload: Player }) => {
        this.handleRemotePlayerMove(payload);
      })
      .on(
        'broadcast',
        { event: 'entity_hit' },
        ({ payload }: { payload: { entityId: string; damage: number; hitBy: string } }) => {
          const { entityId, damage, hitBy } = payload;
          this.handleRemoteHit(entityId, damage, hitBy);
        }
      )
      .on(
        'broadcast',
        { event: 'island_unlocked' },
        ({ payload }: { payload: { islandId: number; unlockedBy: string } }) => {
          const { islandId, unlockedBy } = payload;
          this.unlockIslandLocally(islandId, unlockedBy, false);
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
    // 1. Process Local Movement
    const speed = 250;
    let vx = 0;
    let vy = 0;

    if (this.cursors.left.isDown || this.wasdKeys.A?.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.wasdKeys.D?.isDown) vx += 1;
    if (this.cursors.up.isDown || this.wasdKeys.W?.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.wasdKeys.S?.isDown) vy += 1;

    // Joystick input
    if (Math.abs(this.joystickVector.x) > 0.05 || Math.abs(this.joystickVector.y) > 0.05) {
      vx += this.joystickVector.x;
      vy += this.joystickVector.y;
      this.mouseTarget.active = false;
    }

    if (vx !== 0 || vy !== 0) {
      this.mouseTarget.active = false;
    }

    // Pointer move
    if (this.mouseTarget.active) {
      const dist = Phaser.Math.Distance.Between(
        this.playerSprite.x,
        this.playerSprite.y,
        this.mouseTarget.x,
        this.mouseTarget.y
      );
      if (dist > 12) {
        vx = (this.mouseTarget.x - this.playerSprite.x) / dist;
        vy = (this.mouseTarget.y - this.playerSprite.y) / dist;
      } else {
        this.mouseTarget.active = false;
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
    this.playerShadow.setPosition(px, py + 25).setDepth(py + 20);
    this.playerNameTag.setPosition(px, py - 42).setDepth(py + 30);
    this.playerIndicator.setPosition(px, py - 54).setDepth(py + 30);

    // Continuous interaction when Space or E held
    if ((this.spaceKey?.isDown || this.eKey?.isDown) && time - this.lastInteractTime >= 240) {
      this.tryInteract();
    }

    // Smooth Camera Zoom
    const currentCamZoom = this.cameras.main.zoom;
    if (Math.abs(currentCamZoom - this.targetZoom) > 0.005) {
      this.cameras.main.setZoom(Phaser.Math.Linear(currentCamZoom, this.targetZoom, 0.1));
    }

    // Check Nearest Locked Territory & Player Grid Position
    this.checkTerritoryAndGridUpdates();

    // Update Drifting Clouds
    for (const c of this.clouds) {
      c.sprite.x += c.speed;
      if (c.sprite.x > 2200) {
        c.sprite.x = -2200;
        c.sprite.y = -800 + Math.random() * 2400;
      }
      c.shadow.clear();
      c.shadow.fillStyle(0x000000, 0.12);
      c.shadow.fillEllipse(
        c.sprite.x,
        c.sprite.y + 120,
        c.sprite.displayWidth / 2.2,
        c.sprite.displayHeight / 3
      );
    }

    // Throttle Multiplayer Position Broadcast (60ms)
    if (time - this.lastBroadcastTime > 60) {
      this.lastBroadcastTime = time;
      this.broadcastPlayerMove();
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

    // Track nearest locked territory
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

    // Track grid coordinates
    const gridX = Math.floor(px / TERRITORY_PX);
    const gridY = Math.floor(py / TERRITORY_PX);
    if (gridX !== this.lastGridPos.gridX || gridY !== this.lastGridPos.gridY) {
      this.lastGridPos = { gridX, gridY };
      EventBus.emit('player-grid-pos-changed', { gridX, gridY });
    }
  }

  private tryInteract() {
    this.lastInteractTime = this.time.now;
    const px = this.playerSprite.x;
    const py = this.playerSprite.y;

    // 1. Check Territory Core Resonance
    const distToCore = Math.hypot(px - CENTRAL_CORE.x, py - CENTRAL_CORE.y);
    if (distToCore < 90) {
      sound.playUnlock();
      this.showFloatingText(CENTRAL_CORE.x, CENTRAL_CORE.y - 60, '✨ 영지 코어 공명 완료! (+100)', '#38bdf8');

      // Core wave effect
      const wave = this.add.graphics();
      wave.setDepth(CENTRAL_CORE.y + 20);
      this.tweens.addCounter({
        from: 10,
        to: 280,
        duration: 800,
        onUpdate: (tween) => {
          const r = tween.getValue() ?? 0;
          wave.clear();
          wave.lineStyle(4 * (1 - r / 280), 0x38bdf8, 1 - r / 280);
          wave.strokeCircle(CENTRAL_CORE.x, CENTRAL_CORE.y, r);
        },
        onComplete: () => wave.destroy(),
      });
      return;
    }

    // 2. Check Territory Unlock
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
              `자원이 부족합니다! (🪵${isl.costWood} 🪨${isl.costStone}${isl.costGold > 0 ? ` 🪙${isl.costGold}` : ''})`,
              '#ff5252'
            );
            return;
          }
        }
      }
    }

    // 3. Find Nearest Entity
    let nearestVisual: EntityVisual | null = null;
    let minDist = 90;

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
        this.showFloatingText(ent.x + 16, ent.y - 20, '🔒 먼저 이 영지를 개척해야 합니다!', '#f59e0b');
        return;
      }

      if (ent.type === 'sheep') {
        sound.playClick();
        this.shakeObject((nearestVisual as EntityVisual).container);
        this.showFloatingText(ent.x + 16, ent.y - 20, '🐑 음메에~ ❤️', '#f472b6');
        return;
      }

      // Action Tool Swing
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
      this.inventory[resKey] += 1;
      EventBus.emit('inventory-updated', this.inventory);

      const icon = resKey === 'wood' ? '🪵 +1' : resKey === 'gold' ? '🪙 +1' : '🪨 +1';
      const color = resKey === 'wood' ? '#8bc34a' : resKey === 'gold' ? '#ffd700' : '#cfd8dc';
      this.showFloatingText(ent.x + 16, ent.y, icon, color);

      // Broadcast Hit
      this.broadcastHit(ent.id, damage);

      if (ent.hp <= 0) {
        sound.playBreak();
        this.removeAndRespawnEntity(ent);
      }
    } else {
      this.playPlayerAnimation('axe');
      this.time.delayedCall(280, () => {
        if (this.currentAction === 'axe') this.playPlayerAnimation('idle');
      });
    }
  }

  private removeAndRespawnEntity(ent: Entity) {
    const visual = this.entityVisuals.get(ent.id);
    if (visual) {
      visual.container.destroy();
      this.entityVisuals.delete(ent.id);
    }

    this.time.delayedCall(15000, () => {
      const isl = this.islands.find((i) => i.id === ent.islandId);
      if (isl && isl.unlocked) {
        ent.hp = ent.maxHp;
        this.spawnEntity(ent);
      }
    });
  }

  private unlockIslandLocally(islandId: number, unlockedBy: string, isLocalTrigger: boolean) {
    const target = this.islands.find((i) => i.id === islandId);
    if (!target || target.unlocked) return;

    target.unlocked = true;

    // Save and emit unlocked island stats
    const unlockedIds = this.islands.filter((i) => i.unlocked).map((i) => i.id);
    storage.saveUnlockedIslands(unlockedIds);
    EventBus.emit('unlocked-islands', unlockedIds, this.islands.length);

    // Redraw terrain and altar cards
    this.drawTerrainDecorations();
    this.drawExpansionAltars();

    // Spawn new entities and buildings
    const newEntities = generateIslandEntities(target.id, target.gridX, target.gridY);
    for (const ent of newEntities) {
      this.spawnEntity(ent);
    }

    this.spawnAllBuildings();

    // Celebratory Effects
    sound.playUnlock();
    confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });

    const origin = getIslandOrigin(target.gridX, target.gridY);
    this.showFloatingText(
      origin.x + 320,
      origin.y + 240,
      `🎉 ${unlockedBy}님이 ${target.name}을 개척했습니다!`,
      '#ffd700'
    );

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
      fontSize: '15px',
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
      duration: 1200,
      ease: 'Cubic.easeOut',
      onComplete: () => ft.destroy(),
    });
  }

  private handleRemotePlayerMove(data: Player) {
    if (data.id === this.playerId) return;

    let visual = this.remotePlayers.get(data.id);
    if (!visual) {
      const container = this.add.container(data.x, data.y);

      const shadow = this.add.graphics();
      shadow.fillStyle(0x000000, 0.25);
      shadow.fillEllipse(0, 25, 28, 9);
      container.add(shadow);

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

      visual = { container, sprite, nameTag, shadow, data };
      this.remotePlayers.set(data.id, visual);
    }

    visual.container.setPosition(data.x, data.y);
    visual.container.setDepth(data.y + 24);
    visual.sprite.setFlipX(data.direction === 'left');
    visual.nameTag.setText(data.name);

    const animKey = `${data.color}_${data.action}`;
    if (this.anims.exists(animKey)) {
      visual.sprite.play(animKey, true);
    }
  }

  private removeRemotePlayer(id: string) {
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
      this.supabaseChannel.send({
        type: 'broadcast',
        event: 'player_move',
        payload,
      });
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
}
