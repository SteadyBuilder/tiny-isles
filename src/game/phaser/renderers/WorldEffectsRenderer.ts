import Phaser from 'phaser';
import { WORLD_CLOUD_BOUNDS, WORLD_CLOUD_CONFIGS } from '../../../data/cloudConfig';
import { Island } from '../../../types/game';
import { DEPTH } from '../../depthLayers';
import { GameEvents } from '../../events/gameEvents';
import { getOuterPerimeterSpawns } from '../../utils/waveUtils';

const MAX_ACTIVE_FLOATING_TEXTS = 24;

interface CloudItem {
  sprite: Phaser.GameObjects.Image;
  speed: number;
}

/**
 * 구름, 폭발, 쉐이크, 플로팅 텍스트, 외곽 침공 경고선 등 월드 비주얼 이펙트 전담 렌더러
 */
export class WorldEffectsRenderer {
  private scene: Phaser.Scene;
  private isSceneAlive: () => boolean;
  private invasionGraphics: Phaser.GameObjects.Graphics;
  private lastInvasionSignature = '';
  private clouds: CloudItem[] = [];
  private activeFloatingTexts: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene, isSceneAlive: () => boolean) {
    this.scene = scene;
    this.isSceneAlive = isSceneAlive;
    this.invasionGraphics = this.scene.add.graphics();
    this.invasionGraphics.setDepth(DEPTH.INVASION_OVERLAY);
  }

  public createClouds(): void {
    for (const c of WORLD_CLOUD_CONFIGS) {
      const sprite = this.scene.add.image(c.x, c.y, c.type);
      sprite.setScale(c.scale);
      sprite.setAlpha(c.alpha);
      sprite.setScrollFactor(c.scrollFactor);
      sprite.setDepth(DEPTH.CLOUDS);
      this.clouds.push({ sprite, speed: c.speed });
    }
  }

  public updateClouds(delta: number = 16.6667): void {
    const dtScale = Math.min(4, Math.max(0.1, delta / 16.6667));
    const { wrapMinX, wrapMaxX, wrapMinY, wrapMaxY } = WORLD_CLOUD_BOUNDS;
    const spanY = wrapMaxY - wrapMinY;
    for (const c of this.clouds) {
      c.sprite.x += c.speed * dtScale;
      if (c.sprite.x > wrapMaxX) {
        c.sprite.x = wrapMinX;
        c.sprite.y = wrapMinY + Math.random() * spanY;
      }
    }
  }

  public drawOuterPerimeterWarning(islands: Island[]): void {
    if (!this.isSceneAlive()) return;
    const signature = islands
      .filter((i) => i.unlocked)
      .map((i) => i.id)
      .join(',');
    if (signature === this.lastInvasionSignature) return;
    this.lastInvasionSignature = signature;

    const ig = this.invasionGraphics;
    ig.clear();

    const outerSpawns = getOuterPerimeterSpawns(islands);
    for (const sp of outerSpawns) {
      ig.fillStyle(0xef4444, 0.18);
      ig.fillCircle(sp.spawnX, sp.spawnY, 26);
      ig.lineStyle(2, 0xef4444, 0.5);
      ig.strokeCircle(sp.spawnX, sp.spawnY, 26);
    }
  }

  public playExplosionAt(x: number, y: number): void {
    if (!this.isSceneAlive()) return;
    if (this.scene.textures.exists('explosionFx') && this.scene.anims.exists('explosion_anim')) {
      const exp = this.scene.add.sprite(x, y, 'explosionFx');
      exp.setDepth(DEPTH.EXPLOSION);
      exp.setDisplaySize(140, 140);
      exp.play('explosion_anim');
      exp.once('animationcomplete', () => exp.destroy());
    }
    if (this.scene.textures.exists('shockwaveRingFx') && this.scene.anims.exists('shockwave_ring_anim')) {
      const ring = this.scene.add.sprite(x, y + 6, 'shockwaveRingFx');
      ring.setDepth(DEPTH.EXPLOSION - 1);
      ring.setDisplaySize(128, 128);
      ring.setTint(0xfbbf24);
      ring.setAlpha(0.75);
      ring.play('shockwave_ring_anim');
      ring.once('animationcomplete', () => ring.destroy());
    }
  }

  public playWaterSplashAt(x: number, y: number, size = 110): void {
    if (!this.isSceneAlive()) return;
    if (this.scene.textures.exists('waterSplashFx') && this.scene.anims.exists('water_splash_anim')) {
      const splash = this.scene.add.sprite(x, y, 'waterSplashFx');
      splash.setDepth(DEPTH.EXPLOSION);
      splash.setDisplaySize(size, size);
      splash.play('water_splash_anim');
      splash.once('animationcomplete', () => splash.destroy());
    }
  }

  public playVoidSlashAt(x: number, y: number, tint = 0xc084fc, size = 128): void {
    if (!this.isSceneAlive()) return;
    if (this.scene.textures.exists('voidSlashFx') && this.scene.anims.exists('void_slash_anim')) {
      const fx = this.scene.add.sprite(x, y, 'voidSlashFx');
      fx.setDepth(DEPTH.EXPLOSION + 1);
      fx.setDisplaySize(size, size);
      fx.setTint(tint);
      fx.play('void_slash_anim');
      fx.once('animationcomplete', () => fx.destroy());
    }
  }

  public playLightningAt(x: number, y: number, tint = 0x38bdf8): void {
    if (!this.isSceneAlive()) return;
    if (this.scene.textures.exists('lightningStrikeFx') && this.scene.anims.exists('lightning_strike_anim')) {
      const bolt = this.scene.add.sprite(x, y - 90, 'lightningStrikeFx');
      bolt.setDepth(DEPTH.EXPLOSION + 2);
      bolt.setDisplaySize(136, 250);
      bolt.setTint(tint);
      bolt.play('lightning_strike_anim');
      bolt.once('animationcomplete', () => bolt.destroy());
    }
  }

  public shakeObject(target: Phaser.GameObjects.Container): void {
    if (!target || !target.scene || !this.isSceneAlive()) return;
    const wasTweening = this.scene.tweens.isTweening(target);
    const existingBaseX = wasTweening
      ? (target.getData('shakeBaseX') as number | undefined)
      : undefined;
    this.scene.tweens.killTweensOf(target);

    const baseX = typeof existingBaseX === 'number' ? existingBaseX : target.x;
    target.setData('shakeBaseX', baseX);
    target.x = baseX;

    this.scene.tweens.add({
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

  public showFloatingText(x: number, y: number, text: string, color: string): void {
    if (!this.isSceneAlive()) return;

    while (this.activeFloatingTexts.length >= MAX_ACTIVE_FLOATING_TEXTS) {
      const oldest = this.activeFloatingTexts.shift();
      if (oldest && oldest.scene) {
        this.scene.tweens.killTweensOf(oldest);
        oldest.destroy();
      }
    }

    const ft = this.scene.add
      .text(x, y, text, {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color,
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    ft.setDepth(DEPTH.FLOATING_TEXT);
    this.activeFloatingTexts.push(ft);

    this.scene.tweens.add({
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

  public emitThreatOrbFromWorld(worldX: number, worldY: number, amount: number): void {
    if (!this.isSceneAlive() || amount <= 0) return;
    const cam = this.scene.cameras?.main;
    const canvas = this.scene.game?.canvas;
    if (!cam || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / Math.max(1, cam.width);
    const scaleY = rect.height / Math.max(1, cam.height);

    const camX = (worldX - cam.worldView.x) * cam.zoom;
    const camY = (worldY - cam.worldView.y) * cam.zoom;

    const startX = rect.left + camX * scaleX;
    const startY = rect.top + camY * scaleY;

    GameEvents.emit('threat-orb-fx', { startX, startY, amount });
  }

  public destroy(): void {
    this.lastInvasionSignature = '';
    for (const ft of this.activeFloatingTexts) {
      if (ft.scene) {
        ft.destroy();
      }
    }
    this.activeFloatingTexts = [];
    for (const c of this.clouds) {
      if (c.sprite.scene) {
        c.sprite.destroy();
      }
    }
    this.clouds = [];
    if (this.invasionGraphics?.scene) {
      this.invasionGraphics.destroy();
    }
  }
}
