import Phaser from 'phaser';
import { SKILL_FX_STYLE_CONFIG } from '../../../data/combatFeedbackConfig';
import { SkillEffectContext } from '../../../types/combat';
import { DEPTH } from '../../depthLayers';
import type { ProjectileSystem } from '../../systems/ProjectileSystem';
import { PhaserFxPool, isPointInSceneViewport } from '../utils/fxObjectPool';

/**
 * 5대 클래스별 화려한 픽셀아트 다층 스킬 이펙트 전담 렌더러
 */
export class SkillEffectsRenderer {
  private scene: Phaser.Scene;
  private isSceneAlive: () => boolean;
  private activeTimers = new Set<Phaser.Time.TimerEvent>();
  private fxPool: PhaserFxPool;
  private projectileSystem?: ProjectileSystem;

  constructor(scene: Phaser.Scene, isSceneAlive: () => boolean) {
    this.scene = scene;
    this.isSceneAlive = isSceneAlive;
    this.fxPool = new PhaserFxPool(scene, isSceneAlive);
  }

  public setProjectileSystem(ps: ProjectileSystem): void {
    this.projectileSystem = ps;
  }

  public playClassSkill(ctx: SkillEffectContext): void {
    if (!this.isSceneAlive()) return;

    switch (ctx.classId) {
      case 'guardian':
        this.playGuardianWhirlwind(ctx);
        break;
      case 'lancer':
        this.playLancerDragonCharge(ctx);
        break;
      case 'ranger':
        this.playRangerArrowStorm(ctx);
        break;
      case 'archmage':
        this.playArchmageMeteorNova(ctx);
        break;
      case 'pawn':
      default:
        this.playPawnPowerStrike(ctx);
        break;
    }
  }

  private playPawnPowerStrike(ctx: SkillEffectContext): void {
    const { casterX: x, casterY: y, facingDir, radius } = ctx;
    const style = SKILL_FX_STYLE_CONFIG.pawn;
    const dir = facingDir === 'left' ? Math.PI : 0;

    this.playSpriteAnim('slashArcFx', 'slash_arc_anim', x, y - 10, 210, style.primaryHex, dir);
    this.playSpriteAnim(
      'slashArcFx',
      'slash_arc_anim',
      x,
      y - 10,
      195,
      style.secondaryHex,
      dir + Math.PI * 0.82
    );

    this.schedule(style.chargeDurationMs, () => {
      this.playSpriteAnim('shockwaveRingFx', 'shockwave_ring_anim', x, y, radius * 1.9, style.primaryHex);
      this.playSpriteAnim('explosionFx', 'explosion_anim', x, y - 8, 150, style.primaryHex);
      this.playSpriteAnim('critStarBurstFx', 'crit_star_burst_anim', x, y - 10, 145, style.primaryHex);
      this.spawnBurstSparks(x, y, style.primaryHex, style.secondaryHex, 12, radius * 0.7);
      ctx.onImpact?.();
    });
  }

  private playGuardianWhirlwind(ctx: SkillEffectContext): void {
    const { casterX: x, casterY: y, radius } = ctx;
    const style = SKILL_FX_STYLE_CONFIG.guardian;

    const circle = this.spawnRotatingCircle(x, y, radius * 1.35, style.primaryHex, 460);
    this.playSpriteAnim('whirlwindSlashFx', 'whirlwind_slash_anim', x, y - 8, radius * 2.15, style.accentHex);

    this.schedule(style.chargeDurationMs, () => {
      this.playSpriteAnim('whirlwindSlashFx', 'whirlwind_slash_anim', x, y - 8, radius * 2.35, style.secondaryHex, 1.1);
      this.playSpriteAnim('frostNovaFx', 'frost_nova_anim', x, y, radius * 2.1, style.primaryHex);
      this.playSpriteAnim('shockwaveRingFx', 'shockwave_ring_anim', x, y, radius * 2.05, style.secondaryHex);
      this.playSpriteAnim('healFx', 'heal_anim', x, y - 12, 165, style.primaryHex);
      this.spawnBurstSparks(x, y, style.primaryHex, style.secondaryHex, 16, radius * 0.8);
      if (circle && circle.scene && circle.active) circle.setAlpha(0.75);
      ctx.onImpact?.();
    });
  }

  private playLancerDragonCharge(ctx: SkillEffectContext): void {
    const { casterX: x, casterY: y, facingDir, radius, targetPoints } = ctx;
    const style = SKILL_FX_STYLE_CONFIG.lancer;

    let angle = facingDir === 'left' ? Math.PI : 0;
    if (targetPoints && targetPoints.length > 0) {
      const nearest = targetPoints[0];
      const d = Math.hypot(nearest.x - x, nearest.y - y);
      if (d > 10) {
        angle = Math.atan2(nearest.y - y, nearest.x - x);
      }
    }

    const forwardX = x + Math.cos(angle) * 95;
    const forwardY = y + Math.sin(angle) * 95;

    this.playSpriteAnim('dustFx2', 'dust2_anim', x, y + 14, 96, style.primaryHex);
    this.playSpriteAnim('lanceBeamFx', 'lance_beam_anim', forwardX, forwardY - 12, 320, style.primaryHex, angle, 150);

    if (this.projectileSystem) {
      for (let i = -1; i <= 1; i++) {
        const boltAngle = angle + i * 0.14;
        this.schedule(Math.abs(i) * 28, () => {
          this.projectileSystem?.fireProjectile({
            startX: x,
            startY: y - 12,
            targetX: x + Math.cos(boltAngle) * 215,
            targetY: y + Math.sin(boltAngle) * 215,
            durationMs: 155,
            tint: i === 0 ? style.accentHex : style.primaryHex,
            size: i === 0 ? 48 : 38,
            isMagic: true,
            trailColor: style.primaryHex,
            impactColor: style.accentHex,
            impactRadius: 56,
            onArrive: () => {},
          });
        });
      }
    }

    this.schedule(style.chargeDurationMs, () => {
      const tipX = x + Math.cos(angle) * 145;
      const tipY = y + Math.sin(angle) * 145;
      this.playSpriteAnim('lightningStrikeFx', 'lightning_strike_anim', tipX, tipY - 82, 132, style.primaryHex, 0, 240);
      this.playSpriteAnim('shockwaveRingFx', 'shockwave_ring_anim', tipX, tipY, radius * 1.4, style.primaryHex);
      this.playSpriteAnim('explosionFx2', 'explosion2_anim', tipX, tipY - 10, 175, style.primaryHex);
      this.spawnBurstSparks(tipX, tipY, style.primaryHex, style.accentHex, 16, radius * 0.65);
      ctx.onImpact?.();
    });
  }

  private playRangerArrowStorm(ctx: SkillEffectContext): void {
    const { casterX: x, casterY: y, radius, targetPoints } = ctx;
    const tx = ctx.targetX ?? x;
    const ty = ctx.targetY ?? y;
    const style = SKILL_FX_STYLE_CONFIG.ranger;

    this.spawnRotatingCircle(tx, ty, radius * 1.45, style.primaryHex, 440);

    const targets =
      targetPoints && targetPoints.length > 0
        ? targetPoints.slice(0, 10)
        : Array.from({ length: 8 }, (_, idx) => {
            const ang = (Math.PI * 2 * idx) / 8;
            const r = radius * 0.56;
            return { x: tx + Math.cos(ang) * r, y: ty + Math.sin(ang) * r };
          });

    targets.forEach((pt, idx) => {
      const delay = idx * 24;
      this.schedule(delay, () => {
        if (this.projectileSystem) {
          this.projectileSystem.fireProjectile({
            startX: x,
            startY: y - 18,
            targetX: pt.x,
            targetY: pt.y,
            durationMs: 145,
            tint: idx % 2 === 0 ? style.primaryHex : style.secondaryHex,
            size: 42,
            isMagic: false,
            trailColor: style.primaryHex,
            impactColor: style.accentHex,
            impactRadius: 46,
            onArrive: () => {},
          });
        }
        this.dropSkyArrow(pt.x, pt.y, style.primaryHex, style.secondaryHex);
      });
    });

    this.schedule(style.chargeDurationMs, () => {
      this.playSpriteAnim('critStarBurstFx', 'crit_star_burst_anim', tx, ty - 14, 165, style.primaryHex);
      ctx.onImpact?.();
    });
  }

  private playArchmageMeteorNova(ctx: SkillEffectContext): void {
    const { casterX: x, casterY: y, radius } = ctx;
    const tx = ctx.targetX ?? x;
    const ty = ctx.targetY ?? y;
    const style = SKILL_FX_STYLE_CONFIG.archmage;

    this.spawnRotatingCircle(tx, ty, radius * 1.95, style.primaryHex, 780);
    this.dropMeteor(tx, ty, style.chargeDurationMs, style.primaryHex, style.secondaryHex);

    this.schedule(style.chargeDurationMs, () => {
      this.playSpriteAnim('lightningStrikeFx', 'lightning_strike_anim', tx, ty - 96, 156, style.primaryHex, 0, 280);
      this.playSpriteAnim('explosionFx2', 'explosion2_anim', tx, ty - 16, radius * 1.65, 0xffffff);
      this.playSpriteAnim('frostNovaFx', 'frost_nova_anim', tx, ty, radius * 2.0, style.primaryHex);
      this.playSpriteAnim('shockwaveRingFx', 'shockwave_ring_anim', tx, ty, radius * 2.1, style.secondaryHex);
      this.playSpriteAnim('voidSlashFx', 'void_slash_anim', tx, ty - 12, radius * 1.35, style.primaryHex);
      this.playSpriteAnim('healFx', 'heal_anim', x, y - 14, 185, style.primaryHex);

      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI * 2 * i) / 6;
        const dist = radius * 0.56;
        const fx = tx + Math.cos(ang) * dist;
        const fy = ty + Math.sin(ang) * dist;
        this.schedule(i * 30, () => {
          this.playSpriteAnim('fireFx3', 'fire3_anim', fx, fy - 12, 110, 0xffffff);
          this.playSpriteAnim('fireFx2', 'fire2_anim', fx, fy, 92, style.accentHex);
        });
      }

      if (this.projectileSystem) {
        for (let i = 0; i < 8; i++) {
          const ang = (Math.PI * 2 * i) / 8;
          const dist = radius * 0.92;
          this.projectileSystem.fireProjectile({
            startX: tx,
            startY: ty - 14,
            targetX: tx + Math.cos(ang) * dist,
            targetY: ty + Math.sin(ang) * dist,
            durationMs: 260,
            tint: i % 2 === 0 ? style.primaryHex : style.secondaryHex,
            size: 48,
            isMagic: true,
            trailColor: style.accentHex,
            impactColor: style.secondaryHex,
            impactRadius: 68,
            onArrive: () => {},
          });
        }
      }

      this.spawnBurstSparks(tx, ty, style.secondaryHex, style.primaryHex, 22, radius * 0.9);
      ctx.onImpact?.();
    });
  }

  private dropSkyArrow(tx: number, ty: number, colorA: number, colorB: number): void {
    if (!this.isSceneAlive() || !isPointInSceneViewport(this.scene, tx, ty)) return;
    const arrow = this.fxPool.acquireSprite('arrowStormFx', tx - 85, ty - 220, DEPTH.EXPLOSION + 2);
    if (!arrow) return;
    arrow.setDisplaySize(88, 88);
    arrow.setTint(colorA);
    if (this.scene.anims.exists('arrow_storm_anim')) {
      arrow.play('arrow_storm_anim');
    }

    this.scene.tweens.add({
      targets: arrow,
      x: tx,
      y: ty - 8,
      duration: 145,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.fxPool.releaseSprite(arrow);
        if (!this.isSceneAlive()) return;
        this.playSpriteAnim('hitSparkFx', 'hit_spark_anim', tx, ty - 6, 84, colorA);
        this.playSpriteAnim('shockwaveRingFx', 'shockwave_ring_anim', tx, ty, 92, colorB);
        this.spawnBurstSparks(tx, ty, colorA, colorB, 6, 40);
      },
    });
  }

  private dropMeteor(
    tx: number,
    ty: number,
    durationMs: number,
    colorA: number,
    colorB: number
  ): void {
    if (!this.isSceneAlive() || !isPointInSceneViewport(this.scene, tx, ty)) return;
    const startX = tx - 110;
    const startY = ty - 340;
    const meteor = this.fxPool.acquireSprite('meteorRockFx', startX, startY, DEPTH.EXPLOSION + 4);
    if (!meteor) return;
    meteor.setDisplaySize(136, 136);
    if (this.scene.anims.exists('meteor_rock_anim')) {
      meteor.play('meteor_rock_anim');
    }

    for (let i = 1; i <= 3; i++) {
      const t = i * 0.25;
      this.schedule(Math.round(durationMs * t), () => {
        const mx = startX + (tx - startX) * t;
        const my = startY + (ty - 14 - startY) * t;
        this.playSpriteAnim('fireFx3', 'fire3_anim', mx, my, 82, colorB);
        this.spawnBurstSparks(mx, my, colorA, colorB, 4, 28);
      });
    }

    this.scene.tweens.add({
      targets: meteor,
      x: tx,
      y: ty - 14,
      scaleX: meteor.scaleX * 1.32,
      scaleY: meteor.scaleY * 1.32,
      duration: durationMs,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.fxPool.releaseSprite(meteor);
      },
    });
  }

  private spawnRotatingCircle(
    x: number,
    y: number,
    sizePx: number,
    tint: number,
    lifeMs: number
  ): Phaser.GameObjects.Sprite | null {
    if (!this.isSceneAlive() || !isPointInSceneViewport(this.scene, x, y)) return null;
    const circle = this.fxPool.acquireSprite('magicCircleFx', x, y, DEPTH.SLASH - 5);
    if (!circle) return null;
    circle.setDisplaySize(sizePx * 0.5, sizePx * 0.5);
    circle.setTint(tint);
    circle.setAlpha(0.9);
    if (this.scene.anims.exists('magic_circle_anim')) {
      circle.play('magic_circle_anim');
    }

    this.scene.tweens.add({
      targets: circle,
      displayWidth: sizePx,
      displayHeight: sizePx,
      angle: 110,
      duration: lifeMs * 0.55,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (!circle.scene || !circle.active) return;
        this.scene.tweens.add({
          targets: circle,
          alpha: 0,
          angle: 190,
          duration: lifeMs * 0.45,
          onComplete: () => {
            this.fxPool.releaseSprite(circle);
          },
        });
      },
    });
    return circle;
  }

  private playSpriteAnim(
    texKey: string,
    animKey: string,
    x: number,
    y: number,
    sizeW: number,
    tint = 0xffffff,
    rotationRad = 0,
    sizeH = sizeW
  ): void {
    this.fxPool.playSpriteAnim({
      texKey,
      animKey,
      x,
      y,
      width: sizeW,
      height: sizeH,
      depth: DEPTH.EXPLOSION + 1,
      tint,
      rotationRad,
    });
  }

  private spawnBurstSparks(
    x: number,
    y: number,
    colorA: number,
    colorB: number,
    count: number,
    maxDist: number
  ): void {
    if (!this.isSceneAlive() || !isPointInSceneViewport(this.scene, x, y)) return;
    for (let i = 0; i < count; i++) {
      const spark = this.fxPool.acquireGraphics(x, y - 10, DEPTH.SPARK + 2);
      if (!spark) break;
      const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.35;
      const dist = maxDist * (0.45 + Math.random() * 0.65);
      spark.fillStyle(i % 2 === 0 ? colorA : colorB, 1);
      spark.fillRect(-3.5, -3.5, 7, 7);

      this.scene.tweens.add({
        targets: spark,
        x: x + Math.cos(ang) * dist,
        y: y - 10 + Math.sin(ang) * dist,
        alpha: 0,
        scale: 0.2,
        duration: 380,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this.fxPool.releaseGraphics(spark);
        },
      });
    }
  }

  private schedule(delayMs: number, fn: () => void): void {
    if (delayMs <= 0) {
      if (this.isSceneAlive()) fn();
      return;
    }
    const timer = this.scene.time.delayedCall(delayMs, () => {
      this.activeTimers.delete(timer);
      if (this.isSceneAlive()) fn();
    });
    this.activeTimers.add(timer);
  }

  public destroy(): void {
    for (const timer of this.activeTimers) {
      timer.remove(false);
    }
    this.activeTimers.clear();
    this.fxPool.destroy();
  }
}
