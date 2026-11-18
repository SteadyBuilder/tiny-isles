import assert from 'node:assert/strict';
import test from 'node:test';
import type Phaser from 'phaser';
import { PERFORMANCE_CONFIG } from '../../../../data/performanceConfig';
import { PhaserFxPool, isPointInViewportBounds } from '../fxObjectPool';

interface MockFxEnv {
  scene: Phaser.Scene;
  createdGraphics: number;
  createdImages: number;
  createdSprites: number;
  destroyedCount: number;
}

function createMockFxEnv(): MockFxEnv {
  const env: MockFxEnv = {
    scene: null as unknown as Phaser.Scene,
    createdGraphics: 0,
    createdImages: 0,
    createdSprites: 0,
    destroyedCount: 0,
  };

  const makeBase = () => {
    const listeners = new Map<string, Array<() => void>>();
    const obj: Record<string, unknown> = {
      scene: null as unknown,
      x: 0,
      y: 0,
      depth: 0,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      active: true,
      visible: true,
      cleared: 0,
      blendMode: 0,
      setPosition(x: number, y: number) {
        obj.x = x;
        obj.y = y;
        return obj;
      },
      setDepth(d: number) {
        obj.depth = d;
        return obj;
      },
      setScale(sx: number, sy = sx) {
        obj.scaleX = sx;
        obj.scaleY = sy;
        return obj;
      },
      setRotation(r: number) {
        obj.rotation = r;
        return obj;
      },
      setAlpha(a: number) {
        obj.alpha = a;
        return obj;
      },
      setActive(v: boolean) {
        obj.active = v;
        return obj;
      },
      setVisible(v: boolean) {
        obj.visible = v;
        return obj;
      },
      setOrigin() {
        return obj;
      },
      setDisplaySize() {
        return obj;
      },
      setFlip() {
        return obj;
      },
      clearTint() {
        obj.tint = undefined;
        return obj;
      },
      setTint(t: number) {
        obj.tint = t;
        return obj;
      },
      setBlendMode(b: number) {
        obj.blendMode = b;
        return obj;
      },
      setTexture(key: string) {
        obj.textureKey = key;
        return obj;
      },
      clear() {
        obj.cleared = (obj.cleared as number) + 1;
        return obj;
      },
      anims: {
        stop: () => {},
      },
      once(event: string, fn: () => void) {
        const arr = listeners.get(event) ?? [];
        arr.push(fn);
        listeners.set(event, arr);
        return obj;
      },
      off(event: string) {
        listeners.delete(event);
        return obj;
      },
      emit(event: string) {
        const arr = listeners.get(event) ?? [];
        listeners.delete(event);
        for (const fn of arr) fn();
      },
      play() {
        return obj;
      },
      destroy() {
        env.destroyedCount++;
        obj.scene = undefined;
      },
    };
    return obj;
  };

  const mockScene = {
    cameras: {
      main: {
        worldView: { x: 0, y: 0, width: 1000, height: 800 },
      },
    },
    textures: {
      exists: (key: string) => key !== 'missing_tex',
    },
    anims: {
      exists: (key: string) => key !== 'missing_anim',
    },
    tweens: {
      killTweensOf: () => {},
    },
    add: {
      graphics: () => {
        env.createdGraphics++;
        const g = makeBase();
        g.scene = mockScene;
        return g;
      },
      image: (x: number, y: number, key: string) => {
        env.createdImages++;
        const img = makeBase();
        img.scene = mockScene;
        img.x = x;
        img.y = y;
        img.textureKey = key;
        return img;
      },
      sprite: (x: number, y: number, key: string) => {
        env.createdSprites++;
        const s = makeBase();
        s.scene = mockScene;
        s.x = x;
        s.y = y;
        s.textureKey = key;
        return s;
      },
    },
  };

  env.scene = mockScene as unknown as Phaser.Scene;
  return env;
}

test('isPointInViewportBounds gates outside margin and falls back cleanly on missing bounds', () => {
  assert.equal(isPointInViewportBounds(9999, 9999, null), true);
  assert.equal(isPointInViewportBounds(9999, 9999, { x: 0, y: 0, width: 0, height: 0 }), true);

  const bounds = { x: 100, y: 200, width: 800, height: 600 };
  assert.equal(isPointInViewportBounds(500, 500, bounds, 100), true);
  assert.equal(isPointInViewportBounds(10, 200, bounds, 100), true);
  assert.equal(isPointInViewportBounds(-1, 200, bounds, 100), false);
  assert.equal(isPointInViewportBounds(1001, 500, bounds, 100), false);
});

test('PhaserFxPool reuses graphics/images, guards double release, enforces pool caps, and cleans up on destroy', () => {
  const env = createMockFxEnv();
  const pool = new PhaserFxPool(env.scene, () => true);

  const g1 = pool.acquireGraphics(10, 20, 5)!;
  g1.setAlpha(0.2);
  g1.setScale(2, 3);
  g1.setRotation(1.2);
  pool.releaseGraphics(g1);
  // Double release must not duplicate entry
  pool.releaseGraphics(g1);
  assert.equal(pool.getPoolCounts().graphics, 1);

  const gReused = pool.acquireGraphics(40, 50, 12)!;
  assert.equal(gReused, g1);
  assert.equal(env.createdGraphics, 1);
  assert.equal((gReused as unknown as { alpha: number }).alpha, 1);
  assert.equal((gReused as unknown as { scaleX: number }).scaleX, 1);
  assert.equal((gReused as unknown as { rotation: number }).rotation, 0);
  pool.releaseGraphics(gReused);

  // Pool cap enforcement destroys excess graphics instead of growing unbounded
  const batch: Phaser.GameObjects.Graphics[] = [];
  for (let i = 0; i < PERFORMANCE_CONFIG.maxFxGraphicsPool + 5; i++) {
    batch.push(pool.acquireGraphics(i, i, 1)!);
  }
  for (const g of batch) {
    pool.releaseGraphics(g);
  }
  assert.equal(pool.getPoolCounts().graphics, PERFORMANCE_CONFIG.maxFxGraphicsPool);
  assert.equal(env.destroyedCount, 5);

  // Image pooling resets tint/blendMode
  const img1 = pool.acquireImage('slash_fx', 100, 100, 10)!;
  img1.setTint(0xff0000);
  img1.setBlendMode(2);
  pool.releaseImage(img1);
  const img2 = pool.acquireImage('hit_fx', 200, 200, 15)!;
  assert.equal(img2, img1);
  assert.equal(env.createdImages, 1);
  assert.equal((img2 as unknown as { tint?: number }).tint, undefined);
  assert.equal((img2 as unknown as { blendMode: number }).blendMode, 0);
  pool.releaseImage(img2);

  pool.destroy();
  assert.deepEqual(pool.getPoolCounts(), { graphics: 0, images: 0, sprites: 0 });
  assert.equal(pool.acquireGraphics(0, 0, 1), null);
});

test('PhaserFxPool playSpriteAnim skips offscreen by default and auto-releases sprites on animationcomplete', () => {
  const env = createMockFxEnv();
  const pool = new PhaserFxPool(env.scene, () => true);

  // Far outside mock camera (0..1000, 0..800) + default margin -> skipped
  const offscreen = pool.playSpriteAnim({
    texKey: 'hit_fx',
    animKey: 'hit_anim',
    x: 5000,
    y: 5000,
    width: 64,
    depth: 20,
  });
  assert.equal(offscreen, null);
  assert.equal(env.createdSprites, 0);

  let completed = 0;
  const sprite1 = pool.playSpriteAnim({
    texKey: 'hit_fx',
    animKey: 'hit_anim',
    x: 200,
    y: 200,
    width: 64,
    depth: 20,
    tint: 0x38bdf8,
    onComplete: () => {
      completed++;
    },
  });
  assert.ok(sprite1);
  assert.equal(env.createdSprites, 1);

  (sprite1 as unknown as { emit: (e: string) => void }).emit('animationcomplete');
  assert.equal(completed, 1);
  assert.equal(pool.getPoolCounts().sprites, 1);

  // Second playback reuses pooled sprite
  const sprite2 = pool.playSpriteAnim({
    texKey: 'hit_fx',
    animKey: 'hit_anim',
    x: 250,
    y: 250,
    width: 48,
    depth: 20,
  });
  assert.equal(sprite2, sprite1);
  assert.equal(env.createdSprites, 1);
  assert.equal((sprite2 as unknown as { tint?: number }).tint, undefined);

  pool.destroy();
});
