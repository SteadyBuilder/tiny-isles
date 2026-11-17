import Phaser from 'phaser';
import {
  COMBAT_CAMERA_SHAKE_CONFIG,
  MONSTER_HIT_FEEDBACK_CONFIG,
} from '../../../data/combatFeedbackConfig';
import { CombatHitFeedbackOptions } from '../../../types/combat';
import { DEPTH } from '../../depthLayers';

/**
 * 전투 타격감(미세/강한 카메라 쉐이크, 히트 플래시, 스케일 펀치, 타격 스파크/슬래시) 전담 렌더러
 */
export class CombatFeedbackRenderer {
  private scene: Phaser.Scene;
  private isSceneAlive: () => boolean;
  private lastBasicShakeAt = 0;
  private lastSkillShakeAt = 0;
  private lastPlayerHitShakeAt = 0;

  constructor(scene: Phaser.Scene, isSceneAlive: () => boolean) {
    this.scene = scene;
    this.isSceneAlive = isSceneAlive;
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

    // 2. 피격 대상 흰색 히트 플래시 & 스케일 펀치
    if (opts.targetSprite && opts.targetSprite.scene) {
      this.flashAndPunchSprite(opts.targetSprite, restoreTint);
    }

    // 3. 타격 임팩트 슬래시 & 비산 스파크
    this.spawnHitBurst(
      opts.x,
      opts.y,
      Boolean(opts.isCrit),
      Boolean(opts.isSkill),
      opts.attackerX,
      opts.attackerY
    );
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

    // 1. 타격 방향 미니 참격 호/선
    const baseAngle =
      attackerX !== undefined && attackerY !== undefined
        ? Math.atan2(y - attackerY, x - attackerX)
        : Math.random() * Math.PI * 2;

    const slash = scene.add.graphics();
    slash.setPosition(x, hitY);
    slash.setRotation(baseAngle + (Math.random() - 0.5) * 0.6);
    slash.setDepth(DEPTH.SLASH);
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
        if (slash.scene) slash.destroy();
      },
    });

    // 2. 타격 비산 스파크 (4~6개)
    const count = isCrit || isSkill ? 6 : 4;
    for (let i = 0; i < count; i++) {
      const ang = baseAngle + (Math.random() - 0.5) * 1.9;
      const dist = (isCrit ? 34 : 24) + Math.random() * 14;
      const spark = scene.add.graphics();
      spark.setPosition(x, hitY);
      spark.setDepth(DEPTH.SPARK);
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
          if (spark.scene) spark.destroy();
        },
      });
    }
  }
}
