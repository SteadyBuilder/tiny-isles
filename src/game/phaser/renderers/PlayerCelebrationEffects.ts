import Phaser from 'phaser';
import confetti from 'canvas-confetti';
import { PLAYER_CLASS_DEFINITIONS } from '../../../data/classes';
import { PlayerClassId } from '../../../types/game';
import { DEPTH } from '../../depthLayers';
import { PhaserFxPool } from '../utils/fxObjectPool';

const CLASS_FX_PALETTE: Record<
  PlayerClassId,
  { primary: number; secondary: number; textColor: string }
> = {
  pawn: { primary: 0xfde047, secondary: 0xfbbf24, textColor: '#fde047' },
  guardian: { primary: 0x38bdf8, secondary: 0xfbbf24, textColor: '#7dd3fc' },
  lancer: { primary: 0x22d3ee, secondary: 0xfde047, textColor: '#67e8f9' },
  ranger: { primary: 0x34d399, secondary: 0x38bdf8, textColor: '#6ee7b7' },
  archmage: { primary: 0xc084fc, secondary: 0xf472b6, textColor: '#e879f9' },
};

/**
 * 플레이어 레벨업 및 전직 완료 시 화려한 다층 비주얼 이펙트·머리 위 텍스트 연출 전담 모듈
 */
export class PlayerCelebrationEffects {
  private scene: Phaser.Scene;
  private isSceneAlive: () => boolean;
  private activeTimers = new Set<Phaser.Time.TimerEvent>();
  private fxPool: PhaserFxPool;

  constructor(scene: Phaser.Scene, isSceneAlive: () => boolean) {
    this.scene = scene;
    this.isSceneAlive = isSceneAlive;
    this.fxPool = new PhaserFxPool(scene, isSceneAlive);
  }

  public playLevelUpEffect(x: number, y: number, level: number, delayMs = 0): void {
    if (!this.isSceneAlive()) return;
    if (delayMs > 0) {
      const timer = this.scene.time.delayedCall(delayMs, () => {
        this.activeTimers.delete(timer);
        this.spawnLevelUpVisual(x, y, level);
      });
      this.activeTimers.add(timer);
      return;
    }
    this.spawnLevelUpVisual(x, y, level);
  }

  public playClassAdvancementEffect(x: number, y: number, classId: PlayerClassId): void {
    if (!this.isSceneAlive()) return;

    const { scene } = this;
    const palette = CLASS_FX_PALETTE[classId] ?? CLASS_FX_PALETTE.guardian;
    const classDef = PLAYER_CLASS_DEFINITIONS[classId];

    // 1. 웅장한 하늘 빛기둥 + 중심 오라
    const pillar = this.fxPool.acquireGraphics(x, y, DEPTH.EXPLOSION);
    if (pillar) {
      pillar.fillStyle(palette.primary, 0.34);
      pillar.fillRect(-38, -320, 76, 330);
      pillar.fillStyle(0xffffff, 0.45);
      pillar.fillRect(-14, -320, 28, 330);
      scene.tweens.add({
        targets: pillar,
        scaleX: 1.8,
        alpha: 0,
        duration: 850,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this.fxPool.releaseGraphics(pillar);
        },
      });
    }

    // 2. 다중 확장 충격파 링
    this.spawnExpandingRing(x, y, palette.primary, 130, 520, 5);
    const ringTimer = scene.time.delayedCall(120, () => {
      this.activeTimers.delete(ringTimer);
      if (!this.isSceneAlive()) return;
      this.spawnExpandingRing(x, y, palette.secondary, 175, 620, 4);
    });
    this.activeTimers.add(ringTimer);

    // 3. 스프라이트 성광/폭발/빛기둥 애니메이션 결합
    this.fxPool.playSpriteAnim({
      texKey: 'levelUpPillarFx',
      animKey: 'levelup_pillar_anim',
      x,
      y: y - 92,
      width: 210,
      height: 280,
      depth: DEPTH.EXPLOSION + 2,
      tint: palette.primary,
      skipIfOffscreen: false,
    });
    this.fxPool.playSpriteAnim({
      texKey: 'healFx',
      animKey: 'heal_anim',
      x,
      y: y - 10,
      width: 230,
      depth: DEPTH.EXPLOSION + 1,
      tint: palette.primary,
      skipIfOffscreen: false,
    });
    this.fxPool.playSpriteAnim({
      texKey: 'critStarBurstFx',
      animKey: 'crit_star_burst_anim',
      x,
      y: y - 22,
      width: 180,
      depth: DEPTH.EXPLOSION + 3,
      tint: palette.secondary,
      skipIfOffscreen: false,
    });

    // 4. 방사형 빛 파편 파티클 16개
    this.spawnRadialParticles(x, y - 16, palette.primary, palette.secondary, 16, 120);

    // 5. 카메라 미세 플래시/흔들림 + 폭죽 컨페티
    const cam = scene.cameras?.main;
    if (cam) {
      cam.shake(220, 0.004);
      cam.flash(240, 255, 250, 220, false);
    }

    try {
      confetti({
        particleCount: 50,
        spread: 75,
        origin: { y: 0.62 },
      });
    } catch {
      // 헤드리스/Canvas 미지원 환경 무시
    }

    // 6. 머리 위 웅장한 전직 완료 텍스트
    this.spawnOverheadBanner(
      x,
      y - 78,
      `✨ ${classDef.icon} [${classDef.name}] 전직 완료! ✨`,
      palette.textColor,
      '17px',
      1700
    );
  }

  private spawnLevelUpVisual(x: number, y: number, level: number): void {
    if (!this.isSceneAlive()) return;
    const { scene } = this;

    // 상승하는 황금빛 기둥 & 발밑 오라 링
    const pillar = this.fxPool.acquireGraphics(x, y, DEPTH.EXPLOSION);
    if (pillar) {
      pillar.fillStyle(0xfde047, 0.28);
      pillar.fillRect(-22, -160, 44, 165);
      pillar.fillStyle(0xffffff, 0.35);
      pillar.fillRect(-8, -150, 16, 155);

      scene.tweens.add({
        targets: pillar,
        scaleX: 1.5,
        alpha: 0,
        duration: 620,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this.fxPool.releaseGraphics(pillar);
        },
      });
    }

    this.spawnExpandingRing(x, y, 0xfde047, 82, 460, 3.5);
    this.spawnRadialParticles(x, y - 12, 0xfde047, 0xfbbf24, 10, 74);

    this.fxPool.playSpriteAnim({
      texKey: 'levelUpPillarFx',
      animKey: 'levelup_pillar_anim',
      x,
      y: y - 74,
      width: 160,
      height: 210,
      depth: DEPTH.EXPLOSION + 2,
      skipIfOffscreen: false,
    });
    this.fxPool.playSpriteAnim({
      texKey: 'healFx',
      animKey: 'heal_anim',
      x,
      y: y - 6,
      width: 150,
      depth: DEPTH.EXPLOSION + 1,
      tint: 0xfde047,
      skipIfOffscreen: false,
    });

    this.spawnOverheadBanner(x, y - 68, `🌟 LEVEL UP! Lv.${level}`, '#fde047', '16px', 1450);
  }

  private spawnExpandingRing(
    x: number,
    y: number,
    color: number,
    maxRadius: number,
    duration: number,
    strokeWidth: number
  ): void {
    const ring = this.fxPool.acquireGraphics(x, y, DEPTH.EXPLOSION);
    if (!ring) return;
    ring.lineStyle(strokeWidth, color, 0.95);
    ring.strokeCircle(0, 0, 16);
    ring.fillStyle(color, 0.16);
    ring.fillCircle(0, 0, 16);

    this.scene.tweens.add({
      targets: ring,
      scale: maxRadius / 16,
      alpha: 0,
      duration,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.fxPool.releaseGraphics(ring);
      },
    });
  }

  private spawnRadialParticles(
    x: number,
    y: number,
    colorA: number,
    colorB: number,
    count: number,
    maxDist: number
  ): void {
    for (let i = 0; i < count; i++) {
      const spark = this.fxPool.acquireGraphics(x, y, DEPTH.SPARK);
      if (!spark) break;
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.2;
      const dist = maxDist * (0.65 + Math.random() * 0.45);
      spark.fillStyle(i % 2 === 0 ? colorA : colorB, 1);
      spark.fillCircle(0, 0, i % 3 === 0 ? 5 : 3.5);

      this.scene.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist - 28,
        alpha: 0,
        scale: 0.25,
        duration: 580,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.fxPool.releaseGraphics(spark);
        },
      });
    }
  }

  private spawnOverheadBanner(
    x: number,
    y: number,
    text: string,
    color: string,
    fontSize: string,
    duration: number
  ): void {
    const banner = this.scene.add
      .text(x, y, text, {
        fontFamily: 'Pretendard, sans-serif',
        fontSize,
        fontStyle: 'bold',
        color,
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    banner.setDepth(DEPTH.FLOATING_TEXT + 5);
    banner.setScale(0.75);

    this.scene.tweens.add({
      targets: banner,
      scale: 1.12,
      duration: 180,
      yoyo: true,
      ease: 'Back.easeOut',
    });

    this.scene.tweens.add({
      targets: banner,
      y: y - 54,
      alpha: 0,
      duration,
      delay: 180,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (banner.scene) banner.destroy();
      },
    });
  }

  public destroy(): void {
    for (const timer of this.activeTimers) {
      timer.remove(false);
    }
    this.activeTimers.clear();
    this.fxPool.destroy();
  }
}
