import Phaser from 'phaser';
import { DEPTH } from '../depthLayers';

export interface ActiveProjectile {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  remainingMs: number;
  isMagic: boolean;
  trailColor?: number;
  trailAccumMs: number;
  impactColor?: number;
  impactRadius?: number;
  onArrive: () => void;
}

export interface ActiveTelegraphZone {
  x: number;
  y: number;
  radius: number;
  elapsedMs: number;
  durationMs: number;
  color: number;
  onDetonate: () => void;
}

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: number;
  remainingMs: number;
  maxMs: number;
}

interface ImpactRing {
  x: number;
  y: number;
  maxRadius: number;
  color: number;
  remainingMs: number;
  maxMs: number;
}

/**
 * 오브젝트 풀(Object Pool) 및 단일 루프(Zero-Tween) 기반 고성능 투사체·마법 장판 시스템
 * - 타워, 원거리/마법 몬스터, 궁수/마법사 플레이어가 공용으로 사용하여 GC 및 드로우콜 폭증을 차단합니다.
 */
export class ProjectileSystem {
  private scene: Phaser.Scene;
  private pool: Phaser.GameObjects.Image[] = [];
  private activeProjectiles: ActiveProjectile[] = [];
  private activeZones: ActiveTelegraphZone[] = [];
  private fxGraphics: Phaser.GameObjects.Graphics;
  private sparkParticles: SparkParticle[] = [];
  private impactRings: ImpactRing[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.fxGraphics = scene.add.graphics();
    this.fxGraphics.setDepth(DEPTH.SPARK);
  }

  private acquireSprite(isMagic = false): Phaser.GameObjects.Image {
    const texKey =
      isMagic && this.scene.textures.exists('magicProj') ? 'magicProj' : 'arrowProj';
    const popped = this.pool.pop();
    if (popped && popped.scene) {
      popped.setTexture(texKey);
      popped.setBlendMode(isMagic ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
      popped.setActive(true);
      popped.setVisible(true);
      return popped;
    }
    const img = this.scene.add.image(0, 0, texKey);
    img.setDepth(DEPTH.PROJECTILE);
    img.setBlendMode(isMagic ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    return img;
  }

  private releaseSprite(sprite: Phaser.GameObjects.Image): void {
    if (!sprite.scene) return;
    sprite.setActive(false);
    sprite.setVisible(false);
    sprite.setBlendMode(Phaser.BlendModes.NORMAL);
    if (this.pool.length < 180) {
      this.pool.push(sprite);
    } else {
      sprite.destroy();
    }
  }

  private isInFxViewport(x: number, y: number): boolean {
    const cam = this.scene.cameras?.main?.worldView;
    if (!cam || cam.width <= 0) return true;
    return (
      x >= cam.x - 120 &&
      x <= cam.x + cam.width + 120 &&
      y >= cam.y - 120 &&
      y <= cam.y + cam.height + 120
    );
  }

  public fireProjectile(params: {
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    durationMs?: number;
    tint?: number;
    size?: number;
    isMagic?: boolean;
    trailColor?: number;
    impactColor?: number;
    impactRadius?: number;
    onArrive: () => void;
  }): void {
    const durationMs = Math.max(80, params.durationMs ?? 210);
    const dx = params.targetX - params.startX;
    const dy = params.targetY - params.startY;
    const vx = (dx / durationMs) * 1000;
    const vy = (dy / durationMs) * 1000;
    const angle = Math.atan2(dy, dx);
    const isMagic = Boolean(params.isMagic);

    const sprite = this.acquireSprite(isMagic);
    const size = params.size ?? (isMagic ? 44 : 34);
    sprite.setPosition(params.startX, params.startY);
    sprite.setDisplaySize(size, size);
    sprite.setRotation(angle);
    if (params.tint !== undefined) {
      sprite.setTint(params.tint);
    } else if (isMagic) {
      sprite.setTint(0xa855f7);
    } else {
      sprite.clearTint();
    }

    const resolvedTrailColor = params.trailColor ?? (isMagic ? params.tint ?? 0xc084fc : undefined);

    this.activeProjectiles.push({
      sprite,
      x: params.startX,
      y: params.startY,
      targetX: params.targetX,
      targetY: params.targetY,
      vx,
      vy,
      remainingMs: durationMs,
      isMagic,
      trailColor: resolvedTrailColor,
      trailAccumMs: 0,
      impactColor: params.impactColor ?? params.tint,
      impactRadius: params.impactRadius,
      onArrive: params.onArrive,
    });
  }

  /**
   * 흑마법사 몬스터 또는 아크메이지의 범위 예고 장판 등록 (예고 시간 후 폭발)
   */
  public spawnTelegraphZone(params: {
    x: number;
    y: number;
    radius: number;
    durationMs: number;
    color?: number;
    onDetonate: () => void;
  }): void {
    if (this.activeZones.length >= 25) return;
    this.activeZones.push({
      x: params.x,
      y: params.y,
      radius: params.radius,
      elapsedMs: 0,
      durationMs: Math.max(200, params.durationMs),
      color: params.color ?? 0xef4444,
      onDetonate: params.onDetonate,
    });
  }

  public spawnSpark(
    x: number,
    y: number,
    isMagic: boolean,
    customColor?: number,
    impactRadius?: number
  ): void {
    if (!this.isInFxViewport(x, y)) return;

    const color = customColor ?? (isMagic ? 0xc084fc : 0xfde047);
    if ((isMagic || impactRadius) && this.impactRings.length < 24) {
      this.impactRings.push({
        x,
        y,
        maxRadius: impactRadius ?? (isMagic ? 34 : 20),
        color,
        remainingMs: 210,
        maxMs: 210,
      });
    }

    const burstCount = isMagic ? 6 : 3;
    for (let i = 0; i < burstCount; i++) {
      if (this.sparkParticles.length >= 90) break;
      const ang = (Math.PI * 2 * i) / burstCount + (Math.random() - 0.5) * 0.45;
      const speed = (isMagic ? 78 : 48) + Math.random() * 42;
      this.sparkParticles.push({
        x,
        y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        radius: isMagic ? 3.8 : 2.8,
        color: i % 2 === 0 ? color : 0xffffff,
        remainingMs: isMagic ? 190 : 140,
        maxMs: isMagic ? 190 : 140,
      });
    }
  }

  private emitTrailParticle(x: number, y: number, color: number, isMagic: boolean): void {
    if (this.sparkParticles.length >= 90 || !this.isInFxViewport(x, y)) return;
    this.sparkParticles.push({
      x: x + (Math.random() - 0.5) * (isMagic ? 8 : 4),
      y: y + (Math.random() - 0.5) * (isMagic ? 8 : 4),
      vx: (Math.random() - 0.5) * 18,
      vy: (Math.random() - 0.5) * 18,
      radius: isMagic ? 3.4 : 2.2,
      color,
      remainingMs: isMagic ? 165 : 110,
      maxMs: isMagic ? 165 : 110,
    });
  }

  public update(_time: number, delta: number): void {
    const dt = delta / 1000;

    // 1. 투사체 선형 이동 및 도착 판정 (역순 순회로 O(1) swap-remove)
    for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
      const p = this.activeProjectiles[i];
      p.remainingMs -= delta;
      if (p.remainingMs <= 0) {
        this.releaseSprite(p.sprite);
        this.spawnSpark(p.targetX, p.targetY, p.isMagic, p.impactColor, p.impactRadius);
        const lastIdx = this.activeProjectiles.length - 1;
        if (i !== lastIdx) {
          this.activeProjectiles[i] = this.activeProjectiles[lastIdx];
        }
        this.activeProjectiles.pop();
        p.onArrive();
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.sprite.setPosition(p.x, p.y);
        if (p.trailColor !== undefined) {
          p.trailAccumMs += delta;
          const intervalMs = p.isMagic ? 22 : 34;
          if (p.trailAccumMs >= intervalMs) {
            p.trailAccumMs = 0;
            this.emitTrailParticle(p.x, p.y, p.trailColor, p.isMagic);
          }
        }
      }
    }

    // 2. 단일 Graphics 컨텍스트로 모든 장판 + 착탄 링 + 스파크 일괄 렌더링 (드로우콜 1회)
    this.fxGraphics.clear();

    for (let i = this.activeZones.length - 1; i >= 0; i--) {
      const z = this.activeZones[i];
      z.elapsedMs += delta;
      const ratio = Math.min(1, z.elapsedMs / z.durationMs);

      this.fxGraphics.fillStyle(z.color, 0.14 + ratio * 0.22);
      this.fxGraphics.fillCircle(z.x, z.y, z.radius * ratio);
      this.fxGraphics.lineStyle(2, z.color, 0.75);
      this.fxGraphics.strokeCircle(z.x, z.y, z.radius);

      if (z.elapsedMs >= z.durationMs) {
        const lastIdx = this.activeZones.length - 1;
        if (i !== lastIdx) {
          this.activeZones[i] = this.activeZones[lastIdx];
        }
        this.activeZones.pop();
        z.onDetonate();
      }
    }

    for (let i = this.impactRings.length - 1; i >= 0; i--) {
      const r = this.impactRings[i];
      r.remainingMs -= delta;
      if (r.remainingMs <= 0) {
        const lastIdx = this.impactRings.length - 1;
        if (i !== lastIdx) {
          this.impactRings[i] = this.impactRings[lastIdx];
        }
        this.impactRings.pop();
      } else {
        const progress = 1 - r.remainingMs / r.maxMs;
        const alpha = (1 - progress) * 0.85;
        const curRadius = 6 + r.maxRadius * progress;
        this.fxGraphics.lineStyle(2.5, r.color, alpha);
        this.fxGraphics.strokeCircle(r.x, r.y, curRadius);
        this.fxGraphics.fillStyle(r.color, alpha * 0.22);
        this.fxGraphics.fillCircle(r.x, r.y, curRadius * 0.55);
      }
    }

    for (let i = this.sparkParticles.length - 1; i >= 0; i--) {
      const sp = this.sparkParticles[i];
      sp.remainingMs -= delta;
      if (sp.remainingMs <= 0) {
        const lastIdx = this.sparkParticles.length - 1;
        if (i !== lastIdx) {
          this.sparkParticles[i] = this.sparkParticles[lastIdx];
        }
        this.sparkParticles.pop();
      } else {
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        const ratio = sp.remainingMs / sp.maxMs;
        this.fxGraphics.fillStyle(sp.color, ratio);
        this.fxGraphics.fillCircle(sp.x, sp.y, sp.radius * (0.4 + ratio * 0.6));
      }
    }
  }

  public destroy(): void {
    for (const p of this.activeProjectiles) {
      if (p.sprite.scene) p.sprite.destroy();
    }
    this.activeProjectiles = [];
    for (const s of this.pool) {
      if (s.scene) s.destroy();
    }
    this.pool = [];
    this.activeZones = [];
    this.sparkParticles = [];
    this.impactRings = [];
    if (this.fxGraphics?.scene) {
      this.fxGraphics.destroy();
    }
  }
}
