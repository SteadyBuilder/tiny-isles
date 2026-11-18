import Phaser from 'phaser';
import {
  COMBAT_CAMERA_SHAKE_CONFIG,
  MONSTER_HIT_FEEDBACK_CONFIG,
} from '../../../data/combatFeedbackConfig';
import { PERFORMANCE_CONFIG } from '../../../data/performanceConfig';
import { CombatHitFeedbackOptions } from '../../../types/combat';
import { DEPTH } from '../../depthLayers';
import { PhaserFxPool, isPointInSceneViewport } from '../utils/fxObjectPool';

/**
 * 전투 타격감(미세/강한 카메라 쉐이크, 히트 플래시, 스케일 펀치, 타격 스파크/슬래시) 전담 렌더러
 */
export class CombatFeedbackRenderer {
  private scene: Phaser.Scene;
  private isSceneAlive: () => boolean;
  private fxPool: PhaserFxPool;
  private activeHitBurstCount = 0;
  private lastBasicShakeAt = 0;
  private lastSkillShakeAt = 0;
  private lastPlayerHitShakeAt = 0;

  constructor(scene: Phaser.Scene, isSceneAlive: () => boolean) {
    this.scene = scene;
    this.isSceneAlive = isSceneAlive;
    this.fxPool = new PhaserFxPool(scene, isSceneAlive);
  }

  public playHitImpact(
    opts: CombatHitFeedbackOptions,
    restoreTint?: number | null
  ): void {
    if (!this.isSceneAlive()) return;

    // 1. 로컬 플레이어 공격 성공 시 카메라 흔들림
    if (opts.isLocalPlayerAttack) {
      if (opts.isSkill) {
        this.triggerSkillImpactShake();
      } else {
        this.triggerBasicHitShake(Boolean(opts.isCrit));
      }
    }

    // 2. 피격 대상 흰색 히트 플래시 & 스케일 펀치 (가시 영역에 있는 스프라이트만 처리)
    if (opts.targetSprite && opts.targetSprite.scene && opts.targetSprite.visible) {
      this.flashAndPunchSprite(opts.targetSprite, restoreTint);
    }

    // 3. 타격 임팩트 슬래시 & 비산 스파크 (화면 내 + 동시 버스트 상한 이내일 때만 생성)
    if (
      isPointInSceneViewport(this.scene, opts.x, opts.y) &&
      this.activeHitBurstCount < PERFORMANCE_CONFIG.maxConcurrentHitBursts
    ) {
      this.spawnHitBurst(
        opts.x,
        opts.y,
        Boolean(opts.isCrit),
        Boolean(opts.isSkill),
        opts.attackerX,
        opts.attackerY
      );
    }
  }

  public triggerBasicHitShake(isCrit = false): void {
    if (!this.isSceneAlive()) return;
    const cam = this.scene.cameras?.main;
    if (!cam) return;

    const now = this.scene.time.now;
    const cfg = isCrit
      ? COMBAT_CAMERA_SHAKE_CONFIG.critHit
      : COMBAT_CAMERA_SHAKE_CONFIG.basicHit;
    if (now - this.lastBasicShakeAt < cfg.cooldownMs) return;

    this.lastBasicShakeAt = now;
    cam.shake(cfg.durationMs, cfg.intensity);
  }

  public triggerSkillImpactShake(): void {
    if (!this.isSceneAlive()) return;
    const cam = this.scene.cameras?.main;
    if (!cam) return;

    const now = this.scene.time.now;
    const cfg = COMBAT_CAMERA_SHAKE_CONFIG.skillHit;
    if (now - this.lastSkillShakeAt < cfg.cooldownMs) return;

    this.lastSkillShakeAt = now;
    cam.shake(cfg.durationMs, cfg.intensity);
  }

  public triggerPlayerDamagedShake(): void {
    if (!this.isSceneAlive()) return;
    const cam = this.scene.cameras?.main;
    if (!cam) return;

    const now = this.scene.time.now;
    const cfg = COMBAT_CAMERA_SHAKE_CONFIG.playerDamaged;
    if (now - this.lastPlayerHitShakeAt < cfg.cooldownMs) return;

    this.lastPlayerHitShakeAt = now;
    cam.shake(cfg.durationMs, cfg.intensity);
  }

  private flashAndPunchSprite(
    sprite: Phaser.GameObjects.Sprite,
    restoreTint?: number | null
  ): void {
    const savedTint =
      restoreTint !== undefined
        ? restoreTint
        : sprite.isTinted
        ? sprite.tintTopLeft
        : null;

    if (sprite.getData('baseScaleX') === undefined) {
      sprite.setData('baseScaleX', sprite.scaleX);
      sprite.setData('baseScaleY', sprite.scaleY);
    }
    const baseScaleX = sprite.getData('baseScaleX') as number;
    const baseScaleY = sprite.getData('baseScaleY') as number;

    sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    const prevTimer = sprite.getData('hitFlashTimer') as Phaser.Time.TimerEvent | undefined;
    if (prevTimer) {
      prevTimer.remove(false);
    }

    const flashTimer = this.scene.time.delayedCall(
      MONSTER_HIT_FEEDBACK_CONFIG.whiteFlashDurationMs,
      () => {
        if (!sprite.scene || !this.isSceneAlive()) return;
        sprite.setData('hitFlashTimer', undefined);
        sprite.setTintMode(Phaser.TintModes.MULTIPLY);
        if (savedTint !== null) {
          sprite.setTint(savedTint);
        } else {
          sprite.clearTint();
        }
      }
    );
    sprite.setData('hitFlashTimer', flashTimer);

    this.scene.tweens.killTweensOf(sprite);
    sprite.setScale(baseScaleX, baseScaleY);
    const punch = MONSTER_HIT_FEEDBACK_CONFIG.scalePunchFactor;
    this.scene.tweens.add({
      targets: sprite,
      scaleX: baseScaleX * punch,
      scaleY: baseScaleY * (2 - punch * 0.94),
      duration: 55,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (sprite.scene) {
          sprite.setScale(baseScaleX, baseScaleY);
        }
      },
    });
  }

  private spawnHitBurst(
    x: number,
    y: number,
    isCrit: boolean,
    isSkill: boolean,
    attackerX?: number,
    attackerY?: number
  ): void {
    const { scene } = this;
    const hitY = y - 10;
    const slashColor = isSkill ? 0x38bdf8 : isCrit ? 0xfde047 : 0xffffff;
    const sparkColor = isSkill ? 0x67e8f9 : isCrit ? 0xf97316 : 0xfde047;

    // 1. 타격 방향 미니 참격 호/선 + 픽셀아트 타격 스파크 스프라이트
    const baseAngle =
      attackerX !== undefined && attackerY !== undefined
        ? Math.atan2(y - attackerY, x - attackerX)
        : Math.random() * Math.PI * 2;

    this.fxPool.playSpriteAnim({
      texKey: 'hitSparkFx',
      animKey: 'hit_spark_anim',
      x,
      y: hitY,
      width: isSkill ? 96 : isCrit ? 84 : 64,
      depth: DEPTH.SPARK + 1,
      rotationRad: baseAngle + (Math.random() - 0.5) * 0.5,
      tint: isSkill ? 0x67e8f9 : isCrit ? 0xfde047 : undefined,
      skipIfOffscreen: false,
    });

    if (isCrit || isSkill) {
      this.fxPool.playSpriteAnim({
        texKey: 'critStarBurstFx',
        animKey: 'crit_star_burst_anim',
        x,
        y: hitY,
        width: isSkill ? 116 : 98,
        depth: DEPTH.SPARK + 2,
        tint: isSkill ? 0x38bdf8 : 0xfbbf24,
        skipIfOffscreen: false,
      });
    }

    const slash = this.fxPool.acquireGraphics(x, hitY, DEPTH.SLASH);
    if (slash) {
      this.activeHitBurstCount += 1;
      slash.setRotation(baseAngle + (Math.random() - 0.5) * 0.6);
      const radius = isCrit || isSkill ? 28 : 20;
      slash.lineStyle(isCrit ? 4 : 3, slashColor, 0.95);
      slash.beginPath();
      slash.arc(0, 0, radius, -0.85, 0.85, false);
      slash.strokePath();

      scene.tweens.add({
        targets: slash,
        scale: 1.45,
        alpha: 0,
        duration: 140,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this.activeHitBurstCount = Math.max(0, this.activeHitBurstCount - 1);
          this.fxPool.releaseGraphics(slash);
        },
      });
    }

    // 2. 타격 비산 스파크 (4~6개)
    const count = isCrit || isSkill ? 6 : 4;
    for (let i = 0; i < count; i++) {
      const spark = this.fxPool.acquireGraphics(x, hitY, DEPTH.SPARK);
      if (!spark) break;
      const ang = baseAngle + (Math.random() - 0.5) * 1.9;
      const dist = (isCrit ? 34 : 24) + Math.random() * 14;
      spark.fillStyle(i % 2 === 0 ? 0xffffff : sparkColor, 1);
      spark.fillRect(-2.5, -2.5, 5, 5);

      scene.tweens.add({
        targets: spark,
        x: x + Math.cos(ang) * dist,
        y: hitY + Math.sin(ang) * dist,
        alpha: 0,
        scale: 0.25,
        duration: 170,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.fxPool.releaseGraphics(spark);
        },
      });
    }
  }

  public destroy(): void {
    this.activeHitBurstCount = 0;
    this.fxPool.destroy();
  }
}
