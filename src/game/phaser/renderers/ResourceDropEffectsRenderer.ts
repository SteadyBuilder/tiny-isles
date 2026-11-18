import Phaser from 'phaser';
import {
  GatherableResourceType,
  RESOURCE_DROP_PHYSICS,
  RESOURCE_DROP_VISUALS,
} from '../../../data/resourceDropFxConfig';
import { sound } from '../../../lib/sound';
import { DEPTH, setDepthIfChanged, ySortDepth } from '../../depthLayers';
import { PhaserFxPool } from '../utils/fxObjectPool';

export interface ResourceDropSpawnParams {
  resourceType: GatherableResourceType;
  x: number;
  y: number;
  isBreak?: boolean;
}

export interface IResourceDropContext {
  scene: Phaser.Scene;
  isSceneAlive: () => boolean;
  getPlayerPosition: () => { x: number; y: number };
}

type DropPhase = 'dropping' | 'holding' | 'magnet';

interface DropParticle {
  container: Phaser.GameObjects.Container;
  icon: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  glow: Phaser.GameObjects.Image | null;
  glowColor: number;
  baseScale: number;
  phase: DropPhase;
  elapsedMs: number;
  startX: number;
  startY: number;
  landX: number;
  landY: number;
  holdDurationMs: number;
  speedPx: number;
  spinSign: number;
}

/**
 * 자원 채집 시 잘려진 통나무·작은 광석 파티클 드랍 후 플레이어에게 자석처럼 흡수되는 이펙트 전담 렌더러
 */
export class ResourceDropEffectsRenderer {
  private ctx: IResourceDropContext;
  private particles: DropParticle[] = [];
  private lastPickupSoundAt = 0;
  private fxPool: PhaserFxPool;

  constructor(ctx: IResourceDropContext) {
    this.ctx = ctx;
    this.fxPool = new PhaserFxPool(ctx.scene, ctx.isSceneAlive);
  }

  public spawnResourceDrops(params: ResourceDropSpawnParams): void {
    if (!this.ctx.isSceneAlive()) return;

    const spec = RESOURCE_DROP_VISUALS[params.resourceType];
    const textureKey = spec.textureKeys.find((key) => this.ctx.scene.textures.exists(key));
    if (!textureKey) return;

    const count = spec.hitDropCount + (params.isBreak ? spec.breakBonusCount : 0);
    for (let i = 0; i < count; i++) {
      this.enforceParticleLimit();
      this.createParticle(params.x, params.y, textureKey, spec.displaySizePx, spec.glowColor, i, count);
    }
  }

  public update(delta: number): void {
    if (!this.ctx.isSceneAlive() || this.particles.length === 0) return;

    const dtMs = Math.min(64, Math.max(1, delta));
    const dtSec = dtMs / 1000;
    const playerPos = this.ctx.getPlayerPosition();
    const targetX = playerPos.x;
    const targetY = playerPos.y + RESOURCE_DROP_PHYSICS.playerTargetOffsetY;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p.container.scene) {
        this.particles.splice(i, 1);
        continue;
      }

      p.elapsedMs += dtMs;

      if (p.phase === 'dropping') {
        this.updateDroppingPhase(p);
      } else if (p.phase === 'holding') {
        if (p.elapsedMs >= p.holdDurationMs) {
          p.phase = 'magnet';
          p.elapsedMs = 0;
          p.shadow.setVisible(false);
        }
      } else {
        const pickedUp = this.updateMagnetPhase(p, targetX, targetY, dtSec);
        if (pickedUp) {
          this.completePickup(p, targetX, targetY);
          this.particles.splice(i, 1);
        }
      }
    }
  }

  public destroy(): void {
    for (const p of this.particles) {
      if (p.container.scene) {
        p.container.destroy();
      }
    }
    this.particles = [];
    this.fxPool.destroy();
  }

  private createParticle(
    originX: number,
    originY: number,
    textureKey: string,
    displaySizePx: number,
    glowColor: number,
    index: number,
    total: number
  ): void {
    const { scene } = this.ctx;
    const cfg = RESOURCE_DROP_PHYSICS;

    const baseAngle = (Math.PI * 2 * index) / Math.max(1, total);
    const angle = baseAngle + (Math.random() - 0.5) * 0.85;
    const dist = cfg.scatterMinPx + Math.random() * (cfg.scatterMaxPx - cfg.scatterMinPx);
    const landX = originX + Math.cos(angle) * dist;
    const landY = originY + Math.sin(angle) * dist * 0.65 + 10;

    const startX = originX;
    const startY = originY - 10;

    const container = scene.add.container(startX, startY);
    container.setDepth(ySortDepth(landY, 175));

    const shadow = scene.add.ellipse(0, 6, displaySizePx * 0.72, displaySizePx * 0.34, 0x000000, 0.28);
    container.add(shadow);

    let glow: Phaser.GameObjects.Image | null = null;
    if (scene.textures.exists('loot_glow_tex')) {
      glow = scene.add.image(0, 0, 'loot_glow_tex');
      glow.setTint(glowColor);
      glow.setScale(0.28);
      glow.setAlpha(0.55);
      container.add(glow);
    }

    const icon = scene.add.image(0, 0, textureKey);
    icon.setDisplaySize(displaySizePx, displaySizePx);
    const baseScale = icon.scaleX;
    container.add(icon);

    const holdDurationMs =
      cfg.idleHoldMinMs + Math.random() * (cfg.idleHoldMaxMs - cfg.idleHoldMinMs);

    this.particles.push({
      container,
      icon,
      shadow,
      glow,
      glowColor,
      baseScale,
      phase: 'dropping',
      elapsedMs: 0,
      startX,
      startY,
      landX,
      landY,
      holdDurationMs,
      speedPx: cfg.magnetInitialSpeedPx,
      spinSign: Math.random() < 0.5 ? -1 : 1,
    });
  }

  private updateDroppingPhase(p: DropParticle): void {
    const cfg = RESOURCE_DROP_PHYSICS;
    const t = Math.min(1, p.elapsedMs / cfg.dropDurationMs);
    const easedX = 1 - Math.pow(1 - t, 2);

    const curX = p.startX + (p.landX - p.startX) * easedX;
    const curY = p.startY + (p.landY - p.startY) * easedX;
    const arcY = -Math.sin(t * Math.PI) * cfg.jumpArcHeightPx;

    p.container.setPosition(curX, curY);
    p.icon.y = arcY;
    p.icon.angle = p.spinSign * t * 180;
    if (p.glow) {
      p.glow.y = arcY;
    }

    const shadowScale = 0.65 + (1 - Math.sin(t * Math.PI)) * 0.35;
    p.shadow.setScale(shadowScale, shadowScale);
    setDepthIfChanged(p.container, ySortDepth(curY, 175));

    if (t >= 1) {
      p.container.setPosition(p.landX, p.landY);
      p.icon.y = 0;
      p.icon.angle = 0;
      if (p.glow) p.glow.y = 0;
      p.shadow.setScale(1, 1);
      p.phase = 'holding';
      p.elapsedMs = 0;
    }
  }

  private updateMagnetPhase(
    p: DropParticle,
    targetX: number,
    targetY: number,
    dtSec: number
  ): boolean {
    const cfg = RESOURCE_DROP_PHYSICS;
    if (p.elapsedMs >= cfg.maxMagnetDurationMs) {
      return true;
    }

    p.speedPx = Math.min(cfg.magnetMaxSpeedPx, p.speedPx + cfg.magnetAccelPx * dtSec);

    const dx = targetX - p.container.x;
    const dy = targetY - p.container.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= cfg.pickupRadiusPx || dist <= p.speedPx * dtSec) {
      return true;
    }

    const nx = dx / dist;
    const ny = dy / dist;
    const nextX = p.container.x + nx * p.speedPx * dtSec;
    const nextY = p.container.y + ny * p.speedPx * dtSec;

    p.container.setPosition(nextX, nextY);
    p.icon.angle += p.spinSign * 360 * dtSec;

    if (dist < 56) {
      const shrink = Math.max(0.45, dist / 56);
      p.icon.setScale(p.baseScale * shrink);
      if (p.glow) p.glow.setAlpha(0.55 * shrink);
    }

    setDepthIfChanged(p.container, ySortDepth(nextY, 190));
    return false;
  }

  private completePickup(p: DropParticle, pickupX: number, pickupY: number): void {
    const { scene } = this.ctx;
    const now = scene.time.now;
    if (now - this.lastPickupSoundAt >= 75) {
      this.lastPickupSoundAt = now;
      sound.playPop();
    }

    const spark = this.fxPool.acquireGraphics(pickupX, pickupY, DEPTH.SPARK);
    if (spark) {
      spark.fillStyle(p.glowColor, 0.9);
      spark.fillCircle(0, 0, 5);
      spark.lineStyle(2, 0xffffff, 0.85);
      spark.strokeCircle(0, 0, 7);

      scene.tweens.add({
        targets: spark,
        scale: 2.1,
        alpha: 0,
        duration: 180,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.fxPool.releaseGraphics(spark);
        },
      });
    }

    if (p.container.scene) {
      p.container.destroy();
    }
  }

  private enforceParticleLimit(): void {
    while (this.particles.length >= RESOURCE_DROP_PHYSICS.maxActiveParticles) {
      const oldest = this.particles.shift();
      if (oldest?.container.scene) {
        oldest.container.destroy();
      }
    }
  }
}
