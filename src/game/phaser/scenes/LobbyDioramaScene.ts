import Phaser from 'phaser';
import { DEPTH } from '../../depthLayers';

interface WanderActor {
  sprite: Phaser.GameObjects.Sprite;
  homeX: number;
  homeY: number;
  targetX: number;
  targetY: number;
  speed: number;
  pauseTimer: number;
  idleAnim: string;
  runAnim: string;
}

interface DriftCloud {
  sprite: Phaser.GameObjects.Image;
  speed: number;
  minX: number;
  maxX: number;
}

const TILE = 64;
const ISLAND_COLS = 14;
const ISLAND_ROWS = 10;
const TEX_KEY = 'lobby_diorama_terrain';

/**
 * Necesse-style live animated title screen diorama featuring a coastal Tiny Isles settlement,
 * patrolling guardians, wandering sheep, swaying trees, drifting clouds, and gentle camera drift.
 */
export class LobbyDioramaScene extends Phaser.Scene {
  private actors: WanderActor[] = [];
  private clouds: DriftCloud[] = [];
  private isDragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private baseCenterX = 0;
  private baseCenterY = 0;
  private elapsedSec = 0;

  constructor() {
    super('LobbyDioramaScene');
  }

  preload() {
    this.load.image('d_water', '/assets/terrain/Water_Background_color.png');
    this.load.image('d_tilemap1', '/assets/terrain/Tilemap_color1.png');
    this.load.image('d_tilemap2', '/assets/terrain/Tilemap_color2.png');
    this.load.image('d_waterRock1', '/assets/terrain/Water_Rocks_01.png');
    this.load.image('d_bush1', '/assets/decorations/Bushe1.png');
    this.load.image('d_bush2', '/assets/decorations/Bushe2.png');
    this.load.image('d_rock1', '/assets/decorations/Rock1.png');
    this.load.image('d_castle', '/assets/buildings/Castle.png');
    this.load.image('d_house1', '/assets/buildings/House1.png');
    this.load.image('d_house2', '/assets/buildings/House2.png');
    this.load.image('d_tower', '/assets/buildings/Tower.png');
    this.load.image('d_windmill', '/assets/buildings/Windmill.png');
    this.load.image('d_palisade', '/assets/buildings/Wood_Palisade.png');
    this.load.image('d_cloud1', '/assets/decorations/Clouds_01.png');
    this.load.image('d_cloud2', '/assets/decorations/Clouds_02.png');

    this.load.spritesheet('d_tree1', '/assets/decorations/Tree1.png', {
      frameWidth: 192,
      frameHeight: 256,
    });
    this.load.spritesheet('d_tree3', '/assets/decorations/Tree3.png', {
      frameWidth: 192,
      frameHeight: 192,
    });
    this.load.spritesheet('d_sheep', '/assets/resources/Sheep_Idle.png', {
      frameWidth: 128,
      frameHeight: 128,
    });
    this.load.spritesheet('d_blueIdle', '/assets/units/blue/Pawn_Idle.png', {
      frameWidth: 192,
      frameHeight: 192,
    });
    this.load.spritesheet('d_blueRun', '/assets/units/blue/Pawn_Run.png', {
      frameWidth: 192,
      frameHeight: 192,
    });
    this.load.spritesheet('d_redIdle', '/assets/units/red/Pawn_Idle.png', {
      frameWidth: 192,
      frameHeight: 192,
    });
    this.load.spritesheet('d_redRun', '/assets/units/red/Pawn_Run.png', {
      frameWidth: 192,
      frameHeight: 192,
    });
  }

  create() {
    this.createDioramaAnimations();
    this.buildWaterAndIslands();
    this.populateSettlement();
    this.setupCameraAndDrag();
  }

  private createDioramaAnimations() {
    const safeAnim = (
      key: string,
      sheet: string,
      start: number,
      end: number,
      frameRate: number
    ) => {
      if (this.anims.exists(key) || !this.textures.exists(sheet)) return;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(sheet, { start, end }),
        frameRate,
        repeat: -1,
      });
    };

    safeAnim('d_tree1_anim', 'd_tree1', 0, 7, 4);
    safeAnim('d_tree3_anim', 'd_tree3', 0, 7, 4);
    safeAnim('d_sheep_anim', 'd_sheep', 0, 5, 5);
    safeAnim('d_blue_idle', 'd_blueIdle', 0, 5, 6);
    safeAnim('d_blue_run', 'd_blueRun', 0, 5, 8);
    safeAnim('d_red_idle', 'd_redIdle', 0, 5, 6);
    safeAnim('d_red_run', 'd_redRun', 0, 5, 8);
  }

  private buildWaterAndIslands() {
    const worldW = 2400;
    const worldH = 1600;
    this.baseCenterX = worldW / 2;
    this.baseCenterY = worldH / 2;

    this.add
      .tileSprite(worldW / 2, worldH / 2, worldW, worldH, 'd_water')
      .setDepth(DEPTH.BACKGROUND - 10);

    const islandW = ISLAND_COLS * TILE;
    const islandH = ISLAND_ROWS * TILE;
    if (this.textures.exists(TEX_KEY)) this.textures.remove(TEX_KEY);
    const canvasTex = this.textures.createCanvas(TEX_KEY, islandW, islandH);
    if (canvasTex) {
      const ctx = canvasTex.getContext();
      const sheet = this.textures.get('d_tilemap1').getSourceImage() as CanvasImageSource;
      for (let ry = 0; ry < ISLAND_ROWS; ry++) {
        for (let rx = 0; rx < ISLAND_COLS; rx++) {
          const isWaterEdge =
            (rx === 0 && ry === 0) ||
            (rx === ISLAND_COLS - 1 && ry === 0) ||
            (rx === 0 && ry === ISLAND_ROWS - 1) ||
            (rx === ISLAND_COLS - 1 && ry === ISLAND_ROWS - 1);
          if (isWaterEdge) continue;

          const col = rx === 0 ? 0 : rx === ISLAND_COLS - 1 ? 2 : 1;
          const row = ry === 0 ? 0 : ry === ISLAND_ROWS - 1 ? 2 : 1;
          ctx.drawImage(sheet, col * 64, row * 64, 64, 64, rx * TILE, ry * TILE, TILE, TILE);
        }
      }
      canvasTex.refresh();
    }

    const ox = this.baseCenterX - islandW / 2;
    const oy = this.baseCenterY - islandH / 2;
    this.add.image(ox, oy, TEX_KEY).setOrigin(0, 0).setDepth(DEPTH.BACKGROUND);

    // Decorative water rocks around the shore
    const waterRocks = [
      [ox - 90, oy + 140],
      [ox + islandW + 85, oy + 220],
      [ox + 140, oy + islandH + 70],
      [ox + islandW - 110, oy - 65],
    ];
    for (const [wx, wy] of waterRocks) {
      this.add.image(wx, wy, 'd_waterRock1').setDepth(DEPTH.BACKGROUND + 1);
    }
  }

  private populateSettlement() {
    const cx = this.baseCenterX;
    const cy = this.baseCenterY;

    // Scenic village buildings (kept slightly left/right/top so center menu frames nicely)
    const placements: Array<{ x: number; y: number; key: string; scale?: number }> = [
      { x: cx - 20, y: cy - 120, key: 'd_castle', scale: 0.92 },
      { x: cx - 260, y: cy - 30, key: 'd_windmill', scale: 0.9 },
      { x: cx + 240, y: cy - 60, key: 'd_tower', scale: 0.95 },
      { x: cx - 220, y: cy + 140, key: 'd_house1', scale: 0.95 },
      { x: cx + 220, y: cy + 125, key: 'd_house2', scale: 0.95 },
      { x: cx - 320, y: cy + 65, key: 'd_palisade', scale: 0.9 },
      { x: cx + 310, y: cy + 50, key: 'd_palisade', scale: 0.9 },
    ];
    for (const p of placements) {
      const img = this.add.image(p.x, p.y, p.key).setScale(p.scale ?? 1);
      img.setDepth(p.y + 40);
    }

    // Swaying trees & bushes
    const trees = [
      { x: cx - 360, y: cy - 170, anim: 'd_tree1_anim', tex: 'd_tree1' },
      { x: cx + 340, y: cy - 165, anim: 'd_tree3_anim', tex: 'd_tree3' },
      { x: cx - 345, y: cy + 205, anim: 'd_tree3_anim', tex: 'd_tree3' },
      { x: cx + 350, y: cy + 195, anim: 'd_tree1_anim', tex: 'd_tree1' },
      { x: cx - 120, y: cy - 210, anim: 'd_tree3_anim', tex: 'd_tree3' },
      { x: cx + 140, y: cy - 215, anim: 'd_tree1_anim', tex: 'd_tree1' },
    ];
    trees.forEach((t, i) => {
      const sp = this.add.sprite(t.x, t.y, t.tex).setScale(0.85);
      sp.setDepth(t.y + 30);
      sp.play({ key: t.anim, startFrame: i % 6 });
    });

    const bushes = [
      [cx - 140, cy + 185, 'd_bush1'],
      [cx + 120, cy + 175, 'd_bush2'],
      [cx - 295, cy - 120, 'd_bush2'],
      [cx + 285, cy + 175, 'd_rock1'],
    ] as const;
    for (const [bx, by, key] of bushes) {
      this.add.image(bx, by, key).setScale(0.7).setDepth(by);
    }

    // Wandering sheep & patrolling blue/red pawns
    this.spawnActor(cx - 110, cy + 75, 'd_blueIdle', 'd_blue_idle', 'd_blue_run', 55);
    this.spawnActor(cx + 125, cy + 60, 'd_redIdle', 'd_red_idle', 'd_red_run', 52);
    this.spawnActor(cx - 190, cy + 195, 'd_sheep', 'd_sheep_anim', 'd_sheep_anim', 24, 0.72);
    this.spawnActor(cx + 175, cy + 210, 'd_sheep', 'd_sheep_anim', 'd_sheep_anim', 22, 0.72);

    // Drifting clouds
    const cloudConfigs = [
      { x: cx - 420, y: cy - 260, key: 'd_cloud1', speed: 14, alpha: 0.48 },
      { x: cx + 180, y: cy + 240, key: 'd_cloud2', speed: 11, alpha: 0.42 },
      { x: cx - 80, y: cy - 330, key: 'd_cloud2', speed: 9, alpha: 0.36 },
    ];
    for (const c of cloudConfigs) {
      const img = this.add.image(c.x, c.y, c.key).setAlpha(c.alpha).setDepth(9000);
      this.clouds.push({
        sprite: img,
        speed: c.speed,
        minX: cx - 720,
        maxX: cx + 720,
      });
    }
  }

  private spawnActor(
    x: number,
    y: number,
    tex: string,
    idleAnim: string,
    runAnim: string,
    speed: number,
    scale = 0.68
  ) {
    const sprite = this.add.sprite(x, y, tex).setScale(scale);
    sprite.setDepth(y);
    sprite.play(idleAnim);
    this.actors.push({
      sprite,
      homeX: x,
      homeY: y,
      targetX: x,
      targetY: y,
      speed,
      pauseTimer: Phaser.Math.FloatBetween(0.4, 2.0),
      idleAnim,
      runAnim,
    });
  }

  private setupCameraAndDrag() {
    const cam = this.cameras.main;
    cam.setZoom(1.1);
    cam.centerOn(this.baseCenterX, this.baseCenterY);

    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.lastPointerX = ptr.x;
      this.lastPointerY = ptr.y;
    });
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!this.isDragging || !ptr.isDown) return;
      const dx = (ptr.x - this.lastPointerX) / cam.zoom;
      const dy = (ptr.y - this.lastPointerY) / cam.zoom;
      this.dragOffsetX = Phaser.Math.Clamp(this.dragOffsetX - dx, -260, 260);
      this.dragOffsetY = Phaser.Math.Clamp(this.dragOffsetY - dy, -180, 180);
      this.lastPointerX = ptr.x;
      this.lastPointerY = ptr.y;
    });
    this.input.on('pointerup', () => {
      this.isDragging = false;
    });
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta, 50) / 1000;
    this.elapsedSec += dt;

    // Gentle Necesse-style scenic camera drift + user drag offset
    const driftX = Math.sin(this.elapsedSec * 0.16) * 110;
    const driftY = Math.cos(this.elapsedSec * 0.12) * 55;
    this.cameras.main.centerOn(
      this.baseCenterX + driftX + this.dragOffsetX,
      this.baseCenterY + driftY + this.dragOffsetY
    );

    for (const c of this.clouds) {
      c.sprite.x += c.speed * dt;
      if (c.sprite.x > c.maxX) c.sprite.x = c.minX;
    }

    for (const a of this.actors) {
      if (a.pauseTimer > 0) {
        a.pauseTimer -= dt;
        if (a.pauseTimer <= 0) {
          a.targetX = a.homeX + Phaser.Math.Between(-95, 95);
          a.targetY = a.homeY + Phaser.Math.Between(-55, 55);
          if (a.sprite.anims.currentAnim?.key !== a.runAnim) a.sprite.play(a.runAnim);
        }
        continue;
      }

      const dx = a.targetX - a.sprite.x;
      const dy = a.targetY - a.sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 4) {
        a.pauseTimer = Phaser.Math.FloatBetween(1.2, 2.8);
        if (a.sprite.anims.currentAnim?.key !== a.idleAnim) a.sprite.play(a.idleAnim);
      } else {
        a.sprite.x += (dx / dist) * a.speed * dt;
        a.sprite.y += (dy / dist) * a.speed * dt;
        a.sprite.setFlipX(dx < -1);
        a.sprite.setDepth(a.sprite.y);
      }
    }
  }
}
