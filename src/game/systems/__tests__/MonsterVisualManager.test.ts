import assert from 'node:assert/strict';
import test from 'node:test';
import type Phaser from 'phaser';
import { Monster } from '../../../types/game';
import { MonsterVisualManager } from '../MonsterVisualManager';

function makeMonster(overrides: Partial<Monster> = {}): Monster {
  return {
    id: 'mv_1',
    type: 'goblin',
    name: '고블린',
    isBoss: false,
    x: 100,
    y: 200,
    hp: 100,
    maxHp: 100,
    attack: 10,
    speed: 70,
    targetTerritoryId: 0,
    spawnTerritoryId: 0,
    direction: 'right',
    isFieldMonster: true,
    ...overrides,
  };
}

interface MockVisualEnv {
  scene: Phaser.Scene;
  graphicsCreated: number;
  textCreated: number;
  imageKeys: string[];
  canvasTexturesCreated: string[];
}

function createMockVisualEnv(): MockVisualEnv {
  const existingTextures = new Set<string>(['unit_shadow_tex', 'boss_aura_tex']);
  const env: MockVisualEnv = {
    scene: null as unknown as Phaser.Scene,
    graphicsCreated: 0,
    textCreated: 0,
    imageKeys: [],
    canvasTexturesCreated: [],
  };

  const mockScene = {
    textures: {
      exists: (key: string) => existingTextures.has(key),
      createCanvas: (key: string, _w: number, _h: number) => {
        existingTextures.add(key);
        env.canvasTexturesCreated.push(key);
        const dummyCtx = {
          clearRect: () => {},
          strokeText: () => {},
          fillText: () => {},
          font: '',
          textAlign: 'center',
          textBaseline: 'middle',
          lineJoin: 'round',
          lineWidth: 0,
          strokeStyle: '',
          fillStyle: '',
        };
        return {
          getContext: () => dummyCtx,
          refresh: () => {},
        };
      },
    },
    anims: {
      exists: () => false,
    },
    add: {
      container: (x: number, y: number) => {
        const c = {
          scene: mockScene,
          x,
          y,
          depth: 0,
          destroyed: false,
          setPosition(nx: number, ny: number) {
            c.x = nx;
            c.y = ny;
          },
          setDepth(d: number) {
            c.depth = d;
          },
          add: () => {},
          destroy() {
            c.destroyed = true;
            c.scene = undefined as unknown as typeof mockScene;
          },
        };
        return c;
      },
      image: (_x: number, _y: number, key: string) => {
        env.imageKeys.push(key);
        return {
          setScale: () => {},
          setAlpha: () => {},
          setTint: () => {},
        };
      },
      sprite: () => ({
        setDisplaySize: () => {},
        setTint: () => {},
        setFlipX: () => {},
        play: () => {},
      }),
      graphics: () => {
        env.graphicsCreated++;
        return {
          clear: () => {},
          setVisible: () => {},
          fillStyle: () => {},
          fillRect: () => {},
          lineStyle: () => {},
          strokeRect: () => {},
        };
      },
      text: () => {
        env.textCreated++;
        return {
          setOrigin: () => ({}),
        };
      },
    },
  };

  env.scene = mockScene as unknown as Phaser.Scene;
  return env;
}

test('MonsterVisualManager defers hpBar allocation for healthy regular monsters until damaged', () => {
  MonsterVisualManager.clearTrackedVisuals();
  const env = createMockVisualEnv();

  const mv = MonsterVisualManager.create(env.scene, makeMonster({ hp: 100, maxHp: 100 }));
  assert.equal(mv.hpBar, null);
  assert.equal(env.graphicsCreated, 0);
  assert.equal(MonsterVisualManager.getTrackedTrailCount(), 0);

  mv.monster.hp = 60;
  MonsterVisualManager.updateHpBar(mv, true);
  assert.notEqual(mv.hpBar, null);
  assert.equal(env.graphicsCreated, 1);
  assert.equal(MonsterVisualManager.getTrackedTrailCount(), 1);

  MonsterVisualManager.disposeVisual(mv);
  assert.equal(MonsterVisualManager.getTrackedTrailCount(), 0);
});

test('MonsterVisualManager shares elite badge textures and cleans settled trails in updateHpTrails', () => {
  MonsterVisualManager.clearTrackedVisuals();
  const env = createMockVisualEnv();

  const elite1 = MonsterVisualManager.create(
    env.scene,
    makeMonster({ id: 'e_1', isElite: true, eliteAffix: 'berserker', hp: 200, maxHp: 200 })
  );
  const elite2 = MonsterVisualManager.create(
    env.scene,
    makeMonster({ id: 'e_2', isElite: true, eliteAffix: 'berserker', hp: 200, maxHp: 200 })
  );

  // Elite badge canvas texture is baked only once for identical affix ID, zero Text objects allocated
  assert.equal(env.canvasTexturesCreated.length, 1);
  assert.equal(env.canvasTexturesCreated[0], 'elite_badge_berserker');
  assert.equal(env.textCreated, 0);
  assert.notEqual(elite1.hpBar, null);
  assert.notEqual(elite2.hpBar, null);

  // Damage elite1 -> enters activeTrailVisuals -> simulate elapsed time to settle trail & flash
  const origNow = performance.now.bind(performance);
  let fakeNow = 1000;
  performance.now = () => fakeNow;
  try {
    elite1.monster.hp = 150;
    MonsterVisualManager.updateHpBar(elite1, true);
    assert.equal(MonsterVisualManager.getTrackedTrailCount(), 1);

    fakeNow = 5000;
    MonsterVisualManager.updateHpTrails(new Map(), 5000);
    assert.equal(MonsterVisualManager.getTrackedTrailCount(), 0);
    assert.equal(elite1.hpTrailRatio, 150 / 200);
  } finally {
    performance.now = origNow;
    MonsterVisualManager.disposeVisual(elite1);
    MonsterVisualManager.disposeVisual(elite2);
    MonsterVisualManager.clearTrackedVisuals();
  }
});

test('MonsterVisualManager playAttackAnimation faces target, plays attack anim, and restores run anim on complete', () => {
  const existingAnims = new Set([
    'monster_zombie_run',
    'monster_zombie_attack',
    'monster_lancer_run',
    'monster_lancer_attack',
  ]);
  const played: Array<{ key: string; ignoreIfPlaying?: boolean }> = [];
  const listeners = new Map<string, Array<() => void>>();
  let flipped = false;

  const mockSprite = {
    active: true,
    scene: {
      anims: {
        exists: (key: string) => existingAnims.has(key),
      },
    },
    setFlipX: (val: boolean) => {
      flipped = val;
    },
    play: (key: string, ignoreIfPlaying?: boolean) => {
      played.push({ key, ignoreIfPlaying });
    },
    off: (event: string) => {
      listeners.delete(event);
    },
    once: (event: string, fn: () => void) => {
      const list = listeners.get(event) ?? [];
      list.push(fn);
      listeners.set(event, list);
    },
  };

  const mv = {
    monster: makeMonster({ id: 'atk_1', type: 'lancer', role: 'lancer', x: 200, direction: 'right' }),
    container: {} as Phaser.GameObjects.Container,
    sprite: mockSprite as unknown as Phaser.GameObjects.Sprite,
    hpBar: null,
    baseTint: null,
    hpTrailRatio: 1,
    hpFlashUntil: 0,
    lastAttackTime: 0,
  };

  MonsterVisualManager.playAttackAnimation(mv, 120);
  assert.equal(mv.monster.direction, 'left');
  assert.equal(flipped, true);
  assert.deepEqual(played, [{ key: 'monster_lancer_attack', ignoreIfPlaying: false }]);

  const completeCbs = listeners.get('animationcomplete') ?? [];
  assert.equal(completeCbs.length, 1);
  completeCbs[0]();
  assert.deepEqual(played, [
    { key: 'monster_lancer_attack', ignoreIfPlaying: false },
    { key: 'monster_lancer_run', ignoreIfPlaying: true },
  ]);
});

