import Phaser from 'phaser';
import { SKILL_FX_STYLE_CONFIG } from '../../../data/combatFeedbackConfig';
import { SkillEffectContext } from '../../../types/combat';
import { DEPTH } from '../../depthLayers';

/**
 * 5대 클래스별 화려한 픽셀아트 다층 스킬 이펙트 전담 렌더러
 */
export class SkillEffectsRenderer {
  private scene: Phaser.Scene;
  private isSceneAlive: () => boolean;
  private activeTimers = new Set<Phaser.Time.TimerEvent>();

  constructor(scene: Phaser.Scene, isSceneAlive: () => boolean) {
    this.scene = scene;
    this.isSceneAlive = isSceneAlive;
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
      this.playSpriteAnim('shockwaveRingFx', 'shockwave_ring_anim', x, y, radius * 2.05, style.secondaryHex);
      this.playSpriteAnim('healFx', 'heal_anim', x, y - 12, 165, style.primaryHex);
      this.spawnBurstSparks(x, y, style.primaryHex, style.secondaryHex, 16, radius * 0.8);
      if (circle && circle.scene) circle.setAlpha(0.75);
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

    this.schedule(style.chargeDurationMs, () => {
      const tipX = x + Math.cos(angle) * 145;
      const tipY = y + Math.sin(angle) * 145;
      this.playSpriteAnim('shockwaveRingFx', 'shockwave_ring_anim', tipX, tipY, radius * 1.4, style.primaryHex);
      this.playSpriteAnim('explosionFx2', 'explosion2_anim', tipX, tipY - 10, 175, style.primaryHex);
      this.spawnBurstSparks(tipX, tipY, style.primaryHex, style.accentHex, 16, radius * 0.65);
      ctx.onImpact?.();
    });
  }

  private playRangerArrowStorm(ctx: SkillEffectContext): void {
    const { casterX: x, casterY: y, radius, targetPoints } = ctx;
    const style = SKILL_FX_STYLE_CONFIG.ranger;

    this.spawnRotatingCircle(x, y, 130, style.primaryHex, 420);

    const targets =
      targetPoints && targetPoints.length > 0
        ? targetPoints.slice(0, 10)
        : Array.from({ length: 8 }, (_, idx) => {
            const ang = (Math.PI * 2 * idx) / 8;
            const r = radius * 0.48;
            return { x: x + Math.cos(ang) * r, y: y + Math.sin(ang) * r };
          });

    targets.forEach((pt, idx) => {
      const delay = idx * 24;
      this.schedule(delay, () => {
        this.dropSkyArrow(pt.x, pt.y, style.primaryHex, style.secondaryHex);
      });
    });

    this.schedule(style.chargeDurationMs, () => {
      ctx.onImpact?.();
    });
  }

  private playArchmageMeteorNova(ctx: SkillEffectContext): void {
    const { casterX: x, casterY: y, radius } = ctx;
    const style = SKILL_FX_STYLE_CONFIG.archmage;

    this.spawnRotatingCircle(x, y, radius * 1.95, style.primaryHex, 780);
    this.dropMeteor(x, y, style.chargeDurationMs);

    this.schedule(style.chargeDurationMs, () => {
      this.playSpriteAnim('explosionFx2', 'explosion2_anim', x, y - 16, radius * 1.65, 0xffffff);
      this.playSpriteAnim('shockwaveRingFx', 'shockwave_ring_anim', x, y, radius * 2.1, style.secondaryHex);
      this.playSpriteAnim('healFx', 'heal_anim', x, y - 14, 185, style.primaryHex);

      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI * 2 * i) / 6;
        const dist = radius * 0.56;
        const fx = x + Math.cos(ang) * dist;
        const fy = y + Math.sin(ang) * dist;
        this.schedule(i * 30, () => {
          this.playSpriteAnim('fireFx3', 'fire3_anim', fx, fy - 12, 110, 0xffffff);
          this.playSpriteAnim('fireFx2', 'fire2_anim', fx, fy, 92, style.accentHex);
        });
      }

      this.spawnBurstSparks(x, y, style.secondaryHex, style.primaryHex, 22, radius * 0.9);
      ctx.onImpact?.();
    });
  }

  private dropSkyArrow(tx: number, ty: number, colorA: number, colorB: number): void {
    if (!this.isSceneAlive() || !this.scene.textures.exists('arrowStormFx')) return;
    const arrow = this.scene.add.sprite(tx - 85, ty - 220, 'arrowStormFx');
    arrow.setDepth(DEPTH.EXPLOSION + 2);
    arrow.setDisplaySize(84, 84);
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
        if (arrow.scene) arrow.destroy();
        if (!this.isSceneAlive()) return;
        this.playSpriteAnim('shockwaveRingFx', 'shockwave_ring_anim', tx, ty, 78, colorB);
        this.spawnBurstSparks(tx, ty, colorA, colorB, 5, 36);
      },
    });
  }

  private dropMeteor(tx: number, ty: number, durationMs: number): void {
    if (!this.isSceneAlive() || !this.scene.textures.exists('meteorRockFx')) return;
    const meteor = this.scene.add.sprite(tx - 110, ty - 340, 'meteorRockFx');
    meteor.setDepth(DEPTH.EXPLOSION + 4);
    meteor.setDisplaySize(136, 136);
    if (this.scene.anims.exists('meteor_rock_anim')) {
      meteor.play('meteor_rock_anim');
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
        if (meteor.scene) meteor.destroy();
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
    if (!this.isSceneAlive() || !this.scene.textures.exists('magicCircleFx')) return null;
    const circle = this.scene.add.sprite(x, y, 'magicCircleFx');
    circle.setDepth(DEPTH.SLASH - 5);
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
        if (!circle.scene) return;
        this.scene.tweens.add({
          targets: circle,
          alpha: 0,
          angle: 190,
          duration: lifeMs * 0.45,
          onComplete: () => {
            if (circle.scene) circle.destroy();
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
    if (!this.isSceneAlive()) return;
    if (!this.scene.textures.exists(texKey) || !this.scene.anims.exists(animKey)) return;

    const fx = this.scene.add.sprite(x, y, texKey);
    fx.setDepth(DEPTH.EXPLOSION + 1);
    fx.setDisplaySize(sizeW, sizeH);
    fx.setRotation(rotationRad);
    if (tint !== 0xffffff) {
      fx.setTint(tint);
    }
    fx.play(animKey);
    fx.once('animationcomplete', () => {
      if (fx.scene) fx.destroy();
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
    if (!this.isSceneAlive()) return;
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.35;
      const dist = maxDist * (0.45 + Math.random() * 0.65);
      const spark = this.scene.add.graphics();
      spark.setPosition(x, y - 10);
      spark.setDepth(DEPTH.SPARK + 2);
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
          if (spark.scene) spark.destroy();
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
  }
}
