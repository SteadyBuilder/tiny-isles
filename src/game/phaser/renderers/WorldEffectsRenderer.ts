import Phaser from 'phaser';
import { Island } from '../../../types/game';
import { DEPTH } from '../../depthLayers';
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
    const cloudConfigs = [
      { x: -1600, y: -800, speed: 0.35, scale: 0.9, type: 'cloud1' },
      { x: 300, y: 200, speed: 0.42, scale: 1.1, type: 'cloud2' },
      { x: 2200, y: -200, speed: 0.3, scale: 0.85, type: 'cloud1' },
      { x: -500, y: 1800, speed: 0.38, scale: 1.0, type: 'cloud2' },
      { x: 1800, y: 2200, speed: 0.28, scale: 0.95, type: 'cloud1' },
      { x: -2200, y: 800, speed: 0.34, scale: 1.05, type: 'cloud2' },
    ];

    for (const c of cloudConfigs) {
      const sprite = this.scene.add.image(c.x, c.y, c.type);
      sprite.setScale(c.scale);
      sprite.setAlpha(0.55);
      sprite.setDepth(DEPTH.CLOUDS);
      this.clouds.push({ sprite, speed: c.speed });
    }
  }

  public updateClouds(): void {
    for (const c of this.clouds) {
      c.sprite.x += c.speed;
      if (c.sprite.x > 3800) {
        c.sprite.x = -3800;
        c.sprite.y = -1500 + Math.random() * 4500;
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
    if (this.scene.textures.exists('explosionFx') && this.scene.anims.exists('explosion_anim')) {
      const exp = this.scene.add.sprite(x, y, 'explosionFx');
      exp.setDepth(DEPTH.EXPLOSION);
      exp.setDisplaySize(140, 140);
      exp.play('explosion_anim');
      exp.once('animationcomplete', () => exp.destroy());
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
