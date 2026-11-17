import Phaser from 'phaser';
import {
  DIORAMA_ACTORS,
  DIORAMA_BUILDINGS,
  DIORAMA_CLOUDS,
  DIORAMA_DECORS,
  DIORAMA_TREES,
  DIORAMA_WORLD,
} from '../../../data/lobbyDioramaLayout';
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

interface PulseAura {
  gfx: Phaser.GameObjects.Graphics;
  baseAlpha: number;
  phase: number;
}

const TEX_KEY = 'lobby_diorama_plains';

/**
 * Live animated title screen diorama showcasing a max-tier (Lv.6 대도시)
 * grassland citadel with stone walls, special buildings, and defense towers.
 */
export class LobbyDioramaScene extends Phaser.Scene {
  private actors: WanderActor[] = [];
  private clouds: DriftCloud[] = [];
  private auras: PulseAura[] = [];
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
    this.load.image('d_tilemap1', '/assets/terrain/Tilemap_color1.png');
    this.load.image('d_bush1', '/assets/decorations/Bushe1.png');
    this.load.image('d_bush2', '/assets/decorations/Bushe2.png');
    this.load.image('d_rock1', '/assets/decorations/Rock1.png');
    this.load.image('d_rock3', '/assets/decorations/Rock3.png');

    // Buildings & Towers
    this.load.image('d_castle', '/assets/buildings/Castle.png');
    this.load.image('d_barracks', '/assets/buildings/Barracks.png');
    this.load.image('d_monastery', '/assets/buildings/Monastery.png');
    this.load.image('d_alchemistLab', '/assets/buildings/Alchemist_Lab.png');
    this.load.image('d_blacksmith', '/assets/buildings/Blacksmith.png');
    this.load.image('d_lumberCamp', '/assets/buildings/Lumber_Camp.png');
    this.load.image('d_stoneWorks', '/assets/buildings/Stone_Works.png');
    this.load.image('d_market', '/assets/buildings/Market.png');
    this.load.image('d_windmill', '/assets/buildings/Windmill.png');
    this.load.image('d_archery', '/assets/buildings/Archery.png');
    this.load.image('d_house1', '/assets/buildings/House1.png');
    this.load.image('d_house2', '/assets/buildings/House2.png');
    this.load.image('d_house3', '/assets/buildings/House3.png');
    this.load.image('d_tower', '/assets/buildings/Tower.png');
    this.load.image('d_magicTower', '/assets/buildings/Magic_Tower.png');

    // Stone Wall Perimeter
    this.load.image('d_stoneWallH', '/assets/buildings/Stone_Wall_H.png');
    this.load.image('d_stoneWallV', '/assets/buildings/Stone_Wall_V.png');
    this.load.image('d_stoneWallGate', '/assets/buildings/Stone_Wall_Gate.png');
    this.load.image('d_stoneWallGateV', '/assets/buildings/Stone_Wall_Gate_V.png');
    this.load.image('d_stoneWallCorner', '/assets/buildings/Stone_Wall_Corner.png');

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
    this.actors = [];
    this.clouds = [];
    this.auras = [];
    this.createDioramaAnimations();
    this.buildGrasslandTerrain();
    this.buildStoneWallPerimeter();
    this.populateCitadel();
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

  private buildGrasslandTerrain() {
    const { width: worldW, height: worldH, tileSize } = DIORAMA_WORLD;
    this.baseCenterX = worldW / 2;
    this.baseCenterY = worldH / 2;

    if (this.textures.exists(TEX_KEY)) this.textures.remove(TEX_KEY);
    const canvasTex = this.textures.createCanvas(TEX_KEY, worldW, worldH);
    if (canvasTex) {
      const ctx = canvasTex.getContext();
      const sheet = this.textures.get('d_tilemap1').getSourceImage() as CanvasImageSource;
      const cols = Math.ceil(worldW / tileSize);
      const rows = Math.ceil(worldH / tileSize);

      // Continuous plains interior tile (col=1, row=1) matching TerrainChunkPainter
      for (let ry = 0; ry < rows; ry++) {
        for (let rx = 0; rx < cols; rx++) {
          ctx.drawImage(sheet, 64, 64, 64, 64, rx * tileSize, ry * tileSize, tileSize, tileSize);
        }
      }

      // Subtle gameplay-style dirt roads leading through the 4 gates and central plaza
      this.drawRoadStrip(ctx, this.baseCenterX - 34, 0, 68, worldH);
      this.drawRoadStrip(ctx, 0, this.baseCenterY - 30, worldW, 60);

      // Central stone-paved citadel courtyard
      ctx.fillStyle = 'rgba(194, 178, 146, 0.42)';
      ctx.fillRect(this.baseCenterX - 180, this.baseCenterY - 120, 360, 240);
      ctx.strokeStyle = 'rgba(148, 134, 108, 0.35)';
      ctx.lineWidth = 3;
      ctx.strokeRect(this.baseCenterX - 180, this.baseCenterY - 120, 360, 240);

      canvasTex.refresh();
    }

    this.add.image(0, 0, TEX_KEY).setOrigin(0, 0).setDepth(DEPTH.BACKGROUND);
  }

  private drawRoadStrip(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ) {
    ctx.fillStyle = 'rgba(194, 178, 146, 0.56)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(148, 134, 108, 0.36)';
    if (w > h) {
      ctx.fillRect(x, y, w, 3);
      ctx.fillRect(x, y + h - 3, w, 3);
    } else {
      ctx.fillRect(x, y, 3, h);
      ctx.fillRect(x + w - 3, y, 3, h);
    }
  }

  private buildStoneWallPerimeter() {
    const cx = this.baseCenterX;
    const cy = this.baseCenterY;
    const { wallHalfW, wallHalfH } = DIORAMA_WORLD;

    const topY = cy - wallHalfH;
    const bottomY = cy + wallHalfH;
    const leftX = cx - wallHalfW;
    const rightX = cx + wallHalfW;

    // Top & Bottom horizontal walls with gates
    for (const wy of [topY, bottomY]) {
      const depth = wy + 10;
      this.add.image(cx, wy, 'd_stoneWallGate').setDisplaySize(128, 64).setDepth(depth + 2);
      this.addHorizontalWing(cx - wallHalfW + 32, cx - 64, wy, depth);
      this.addHorizontalWing(cx + 64, cx + wallHalfW - 32, wy, depth);
      this.add.image(leftX, wy, 'd_stoneWallCorner').setDisplaySize(64, 64).setDepth(depth + 3);
      this.add.image(rightX, wy, 'd_stoneWallCorner').setDisplaySize(64, 64).setDepth(depth + 3);
    }

    // Left & Right vertical walls with gates
    for (const wx of [leftX, rightX]) {
      this.add.image(wx, cy, 'd_stoneWallGateV').setDisplaySize(64, 128).setDepth(cy + 12);
      this.addVerticalWing(wx, topY + 32, cy - 64);
      this.addVerticalWing(wx, cy + 64, bottomY - 32);
    }
  }

  private addHorizontalWing(startX: number, endX: number, y: number, depth: number) {
    const totalW = Math.max(64, endX - startX);
    const segments = Math.max(1, Math.round(totalW / 192));
    const segW = totalW / segments;
    for (let i = 0; i < segments; i++) {
      const sx = startX + (i + 0.5) * segW;
      this.add.image(sx, y, 'd_stoneWallH').setDisplaySize(segW + 2, 64).setDepth(depth);
    }
  }

  private addVerticalWing(x: number, startY: number, endY: number) {
    const totalH = Math.max(64, endY - startY);
    const segments = Math.max(1, Math.round(totalH / 192));
    const segH = totalH / segments;
    for (let i = 0; i < segments; i++) {
      const sy = startY + (i + 0.5) * segH;
      this.add.image(x, sy, 'd_stoneWallV').setDisplaySize(64, segH + 2).setDepth(sy + 10);
    }
  }

  private populateCitadel() {
    const cx = this.baseCenterX;
    const cy = this.baseCenterY;

    // Lv.6 Citadel, special buildings & defense towers
    DIORAMA_BUILDINGS.forEach((b, idx) => {
      const bx = cx + b.dx;
      const by = cy + b.dy;

      if (b.auraColor && b.auraRadius) {
        const aura = this.add.graphics();
        aura.setPosition(bx, by + 16);
        aura.lineStyle(2, b.auraColor, 0.24);
        aura.strokeCircle(0, 0, b.auraRadius);
        aura.fillStyle(b.auraColor, 0.05);
        aura.fillCircle(0, 0, b.auraRadius);
        aura.setDepth(DEPTH.BACKGROUND + 5);
        this.auras.push({ gfx: aura, baseAlpha: 1, phase: idx * 0.9 });
      }

      const img = this.add.image(bx, by, b.key).setDisplaySize(b.width, b.height);
      if (b.tint) img.setTint(b.tint);
      img.setDepth(by + (b.depthBias ?? 50));
    });

    // Swaying trees around the grassland perimeter
    DIORAMA_TREES.forEach((t, i) => {
      const sp = this.add.sprite(cx + t.dx, cy + t.dy, t.tex).setScale(t.scale ?? 0.88);
      sp.setDepth(cy + t.dy + 30);
      sp.play({ key: t.anim, startFrame: i % 6 });
    });

    // Bushes & rocks
    for (const d of DIORAMA_DECORS) {
      this.add
        .image(cx + d.dx, cy + d.dy, d.key)
        .setScale(d.scale)
        .setDepth(cy + d.dy);
    }

    // Patrolling blue/red guardians & wandering sheep
    for (const a of DIORAMA_ACTORS) {
      this.spawnActor(cx + a.dx, cy + a.dy, a.tex, a.idleAnim, a.runAnim, a.speed, a.scale);
    }

    // Drifting clouds
    for (const c of DIORAMA_CLOUDS) {
      const img = this.add.image(cx + c.dx, cy + c.dy, c.key).setAlpha(c.alpha).setDepth(9000);
      this.clouds.push({
        sprite: img,
        speed: c.speed,
        minX: cx - 860,
        maxX: cx + 860,
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
    cam.setZoom(1.0);
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
      this.dragOffsetX = Phaser.Math.Clamp(this.dragOffsetX - dx, -320, 320);
      this.dragOffsetY = Phaser.Math.Clamp(this.dragOffsetY - dy, -220, 220);
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

    // Gentle scenic camera drift + user drag offset
    const driftX = Math.sin(this.elapsedSec * 0.16) * 95;
    const driftY = Math.cos(this.elapsedSec * 0.12) * 48;
    this.cameras.main.centerOn(
      this.baseCenterX + driftX + this.dragOffsetX,
      this.baseCenterY + driftY + this.dragOffsetY
    );

    // Subtle pulsing magic & sanctuary auras
    for (const aura of this.auras) {
      const pulse = 0.65 + 0.35 * Math.sin(this.elapsedSec * 2.1 + aura.phase);
      aura.gfx.setAlpha(aura.baseAlpha * pulse);
    }

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
