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
  private sparkParticles: Array<{
    x: number;
    y: number;
    color: number;
    remainingMs: number;
  }> = [];

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
      popped.setActive(true);
      popped.setVisible(true);
      return popped;
    }
    const img = this.scene.add.image(0, 0, texKey);
    img.setDepth(DEPTH.PROJECTILE);
    return img;
  }

  private releaseSprite(sprite: Phaser.GameObjects.Image): void {
    if (!sprite.scene) return;
    sprite.setActive(false);
    sprite.setVisible(false);
    if (this.pool.length < 180) {
      this.pool.push(sprite);
    } else {
      sprite.destroy();
    }
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
    onArrive: () => void;
  }): void {
    const durationMs = Math.max(80, params.durationMs ?? 210);
    const dx = params.targetX - params.startX;
    const dy = params.targetY - params.startY;
    const vx = (dx / durationMs) * 1000;
    const vy = (dy / durationMs) * 1000;
    const angle = Math.atan2(dy, dx);

    const sprite = this.acquireSprite(Boolean(params.isMagic));
    const size = params.size ?? (params.isMagic ? 44 : 34);
    sprite.setPosition(params.startX, params.startY);
    sprite.setDisplaySize(size, size);
    sprite.setRotation(angle);
    if (params.tint !== undefined) {
      sprite.setTint(params.tint);
    } else {
      sprite.clearTint();
    }

    this.activeProjectiles.push({
      sprite,
      x: params.startX,
      y: params.startY,
      targetX: params.targetX,
      targetY: params.targetY,
      vx,
      vy,
      remainingMs: durationMs,
      isMagic: Boolean(params.isMagic),
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

  public spawnSpark(x: number, y: number, isMagic: boolean): void {
    if (this.sparkParticles.length >= 40) return;
    const cam = this.scene.cameras?.main?.worldView;
    if (cam && cam.width > 0) {
      if (
        x < cam.x - 100 ||
        x > cam.x + cam.width + 100 ||
        y < cam.y - 100 ||
        y > cam.y + cam.height + 100
      ) {
        return;
      }
    }
    this.sparkParticles.push({
      x,
      y,
      color: isMagic ? 0xc084fc : 0xfde047,
      remainingMs: 140,
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
        this.spawnSpark(p.targetX, p.targetY, p.isMagic);
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
      }
    }

    // 2. 단일 Graphics 컨텍스트로 모든 장판 + 스파크 일괄 렌더링 (드로우콜 1회)
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
        const alpha = sp.remainingMs / 140;
        this.fxGraphics.fillStyle(sp.color, alpha);
        this.fxGraphics.fillCircle(sp.x - 8, sp.y - 6, 3.5);
        this.fxGraphics.fillCircle(sp.x + 8, sp.y + 6, 3.5);
        this.fxGraphics.fillCircle(sp.x + 7, sp.y - 7, 3);
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
    if (this.fxGraphics?.scene) {
      this.fxGraphics.destroy();
    }
  }
}
