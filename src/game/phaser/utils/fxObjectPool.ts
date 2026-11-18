import type Phaser from 'phaser';
import { PERFORMANCE_CONFIG } from '../../../data/performanceConfig';

export interface ViewportBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PooledSpriteAnimOptions {
  texKey: string;
  animKey: string;
  x: number;
  y: number;
  width: number;
  height?: number;
  depth: number;
  tint?: number;
  alpha?: number;
  rotationRad?: number;
  blendMode?: number;
  skipIfOffscreen?: boolean;
  viewportMarginPx?: number;
  onComplete?: () => void;
}

/**
 * 월드 좌표 (x, y)가 카메라 뷰포트 + 여유 마진 영역 안에 있는지 판정하는 순수 함수
 */
export function isPointInViewportBounds(
  x: number,
  y: number,
  bounds: ViewportBounds | null | undefined,
  marginPx: number = PERFORMANCE_CONFIG.fxViewportMarginPx
): boolean {
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) return true;
  return (
    x >= bounds.x - marginPx &&
    x <= bounds.x + bounds.width + marginPx &&
    y >= bounds.y - marginPx &&
    y <= bounds.y + bounds.height + marginPx
  );
}

export function isPointInSceneViewport(
  scene: Phaser.Scene | null | undefined,
  x: number,
  y: number,
  marginPx: number = PERFORMANCE_CONFIG.fxViewportMarginPx
): boolean {
  const wv = scene?.cameras?.main?.worldView;
  return isPointInViewportBounds(x, y, wv, marginPx);
}

/**
 * 일회성 이펙트(Graphics / Image / Animated Sprite)의 생성·파괴 GC 스파이크를 억제하는 공용 오브젝트 풀
 */
export class PhaserFxPool {
  private scene: Phaser.Scene;
  private isSceneAlive: () => boolean;
  private graphicsPool: Phaser.GameObjects.Graphics[] = [];
  private imagePool: Phaser.GameObjects.Image[] = [];
  private spritePool: Phaser.GameObjects.Sprite[] = [];
  private pooledSet = new WeakSet<object>();
  private destroyed = false;

  constructor(scene: Phaser.Scene, isSceneAlive: () => boolean) {
    this.scene = scene;
    this.isSceneAlive = isSceneAlive;
  }

  public getPoolCounts(): { graphics: number; images: number; sprites: number } {
    return {
      graphics: this.graphicsPool.length,
      images: this.imagePool.length,
      sprites: this.spritePool.length,
    };
  }

  public acquireGraphics(x: number, y: number, depth: number): Phaser.GameObjects.Graphics | null {
    if (this.destroyed || !this.isSceneAlive()) return null;

    while (this.graphicsPool.length > 0) {
      const reused = this.graphicsPool.pop()!;
      this.pooledSet.delete(reused);
      if (!reused.scene) continue;
      reused.clear();
      reused.setPosition(x, y);
      reused.setDepth(depth);
      reused.setScale(1, 1);
      reused.setRotation(0);
      reused.setAlpha(1);
      reused.setActive(true);
      reused.setVisible(true);
      return reused;
    }

    const g = this.scene.add.graphics();
    g.setPosition(x, y);
    g.setDepth(depth);
    return g;
  }

  public releaseGraphics(g: Phaser.GameObjects.Graphics | null | undefined): void {
    if (!g || this.pooledSet.has(g)) return;
    if (this.destroyed || !g.scene) {
      if (g.scene) g.destroy();
      return;
    }
    this.scene.tweens?.killTweensOf?.(g);
    g.clear();
    g.setActive(false);
    g.setVisible(false);
    g.setScale(1, 1);
    g.setRotation(0);
    g.setAlpha(1);

    if (this.graphicsPool.length < PERFORMANCE_CONFIG.maxFxGraphicsPool) {
      this.pooledSet.add(g);
      this.graphicsPool.push(g);
    } else {
      g.destroy();
    }
  }

  public acquireImage(
    texKey: string,
    x: number,
    y: number,
    depth: number,
    frame?: string | number
  ): Phaser.GameObjects.Image | null {
    if (this.destroyed || !this.isSceneAlive()) return null;
    if (!this.scene.textures.exists(texKey)) return null;

    while (this.imagePool.length > 0) {
      const reused = this.imagePool.pop()!;
      this.pooledSet.delete(reused);
      if (!reused.scene) continue;
      reused.setOrigin(0.5, 0.5);
      reused.clearTint();
      reused.setBlendMode(0);
      reused.setFlip(false, false);
      reused.setScale(1, 1);
      reused.setRotation(0);
      reused.setAlpha(1);
      reused.setTexture(texKey, frame);
      reused.setPosition(x, y);
      reused.setDepth(depth);
      reused.setActive(true);
      reused.setVisible(true);
      return reused;
    }

    const img = this.scene.add.image(x, y, texKey, frame);
    img.setDepth(depth);
    return img;
  }

  public releaseImage(img: Phaser.GameObjects.Image | null | undefined): void {
    if (!img || this.pooledSet.has(img)) return;
    if (this.destroyed || !img.scene) {
      if (img.scene) img.destroy();
      return;
    }
    this.scene.tweens?.killTweensOf?.(img);
    img.clearTint();
    img.setBlendMode(0);
    img.setActive(false);
    img.setVisible(false);
    img.setScale(1, 1);
    img.setRotation(0);
    img.setAlpha(1);

    if (this.imagePool.length < PERFORMANCE_CONFIG.maxFxImagePool) {
      this.pooledSet.add(img);
      this.imagePool.push(img);
    } else {
      img.destroy();
    }
  }

  public acquireSprite(
    texKey: string,
    x: number,
    y: number,
    depth: number,
    frame?: string | number
  ): Phaser.GameObjects.Sprite | null {
    if (this.destroyed || !this.isSceneAlive()) return null;
    if (!this.scene.textures.exists(texKey)) return null;

    while (this.spritePool.length > 0) {
      const reused = this.spritePool.pop()!;
      this.pooledSet.delete(reused);
      if (!reused.scene) continue;
      reused.anims?.stop?.();
      reused.off?.('animationcomplete');
      reused.setOrigin(0.5, 0.5);
      reused.clearTint();
      reused.setBlendMode(0);
      reused.setFlip(false, false);
      reused.setScale(1, 1);
      reused.setRotation(0);
      reused.setAlpha(1);
      reused.setTexture(texKey, frame);
      reused.setPosition(x, y);
      reused.setDepth(depth);
      reused.setActive(true);
      reused.setVisible(true);
      return reused;
    }

    const sprite = this.scene.add.sprite(x, y, texKey, frame);
    sprite.setDepth(depth);
    return sprite;
  }

  public releaseSprite(sprite: Phaser.GameObjects.Sprite | null | undefined): void {
    if (!sprite || this.pooledSet.has(sprite)) return;
    sprite.off?.('animationcomplete');
    if (this.destroyed || !sprite.scene) {
      if (sprite.scene) sprite.destroy();
      return;
    }
    sprite.anims?.stop?.();
    this.scene.tweens?.killTweensOf?.(sprite);
    sprite.clearTint();
    sprite.setBlendMode(0);
    sprite.setActive(false);
    sprite.setVisible(false);
    sprite.setScale(1, 1);
    sprite.setRotation(0);
    sprite.setAlpha(1);

    if (this.spritePool.length < PERFORMANCE_CONFIG.maxFxSpritePool) {
      this.pooledSet.add(sprite);
      this.spritePool.push(sprite);
    } else {
      sprite.destroy();
    }
  }

  public playSpriteAnim(opts: PooledSpriteAnimOptions): Phaser.GameObjects.Sprite | null {
    if (this.destroyed || !this.isSceneAlive()) return null;
    if (
      opts.skipIfOffscreen !== false &&
      !isPointInSceneViewport(this.scene, opts.x, opts.y, opts.viewportMarginPx)
    ) {
      return null;
    }
    if (!this.scene.anims.exists(opts.animKey)) return null;

    const sprite = this.acquireSprite(opts.texKey, opts.x, opts.y, opts.depth);
    if (!sprite) return null;

    sprite.setDisplaySize(opts.width, opts.height ?? opts.width);
    sprite.setRotation(opts.rotationRad ?? 0);
    sprite.setAlpha(opts.alpha ?? 1);
    if (opts.tint !== undefined && opts.tint !== 0xffffff) {
      sprite.setTint(opts.tint);
    } else {
      sprite.clearTint();
    }
    if (opts.blendMode !== undefined) {
      sprite.setBlendMode(opts.blendMode);
    }

    sprite.once('animationcomplete', () => {
      this.releaseSprite(sprite);
      opts.onComplete?.();
    });
    sprite.play(opts.animKey);
    return sprite;
  }

  public destroy(): void {
    this.destroyed = true;
    for (const g of this.graphicsPool) {
      this.pooledSet.delete(g);
      if (g.scene) g.destroy();
    }
    this.graphicsPool.length = 0;

    for (const img of this.imagePool) {
      this.pooledSet.delete(img);
      if (img.scene) img.destroy();
    }
    this.imagePool.length = 0;

    for (const s of this.spritePool) {
      this.pooledSet.delete(s);
      s.off?.('animationcomplete');
      if (s.scene) s.destroy();
    }
    this.spritePool.length = 0;
  }
}
