import Phaser from 'phaser';
import { ITEM_CATALOG } from '../../../data/items';
import { POTION_LIST, RESOURCE_BUNDLE_SPRITES } from '../../../data/potions';

/**
 * 사냥·전투 모드(특화 마물 병과, 스킬 FX, 아이템/물약, 부락 본진, 경량 배칭 텍스처) 에셋 로더 및 애니메이션 등록기
 * - 플레이어 전직 클래스 시트(4직업 x 2색상)는 classAssetLoader를 통해 전직 시 온디맨드 로드합니다.
 */
export function preloadHuntingModeAssets(scene: Phaser.Scene, isHuntingMode = true): void {
  // 특화 마물 병과 (보스·사냥 병과 공용)
  scene.load.spritesheet('enemyLancerRun', '/assets/units/enemies/Black_Lancer_Run.png', {
    frameWidth: 320,
    frameHeight: 320,
  });
  scene.load.spritesheet('enemyArchmageRun', '/assets/units/enemies/Black_Archmage_Run.png', {
    frameWidth: 192,
    frameHeight: 192,
  });
  scene.load.spritesheet('enemyArchmageCast', '/assets/units/enemies/Black_Archmage_Cast.png', {
    frameWidth: 192,
    frameHeight: 192,
  });

  // 스킬, 회피 대시 및 마법 이펙트
  scene.load.spritesheet('fireFx2', '/assets/fx/Fire_02.png', { frameWidth: 64, frameHeight: 64 });
  scene.load.spritesheet('fireFx3', '/assets/fx/Fire_03.png', { frameWidth: 64, frameHeight: 64 });
  scene.load.spritesheet('explosionFx2', '/assets/fx/Explosion_02.png', {
    frameWidth: 192,
    frameHeight: 192,
  });
  scene.load.spritesheet('dustFx2', '/assets/fx/Dust_02.png', { frameWidth: 64, frameHeight: 64 });
  scene.load.spritesheet('healFx', '/assets/fx/Heal_Effect.png', {
    frameWidth: 192,
    frameHeight: 192,
  });
  scene.load.spritesheet('slashArcFx', '/assets/fx/Slash_Arc.png', {
    frameWidth: 192,
    frameHeight: 192,
  });
  scene.load.spritesheet('whirlwindSlashFx', '/assets/fx/Whirlwind_Slash.png', {
    frameWidth: 256,
    frameHeight: 256,
  });
  scene.load.spritesheet('lanceBeamFx', '/assets/fx/Lance_Beam.png', {
    frameWidth: 256,
    frameHeight: 128,
  });
  scene.load.spritesheet('magicCircleFx', '/assets/fx/Magic_Circle.png', {
    frameWidth: 256,
    frameHeight: 256,
  });
  scene.load.spritesheet('meteorRockFx', '/assets/fx/Meteor_Rock.png', {
    frameWidth: 128,
    frameHeight: 128,
  });
  scene.load.spritesheet('shockwaveRingFx', '/assets/fx/Shockwave_Ring.png', {
    frameWidth: 192,
    frameHeight: 192,
  });
  scene.load.spritesheet('arrowStormFx', '/assets/fx/Arrow_Storm.png', {
    frameWidth: 96,
    frameHeight: 96,
  });
  scene.load.spritesheet('hitSparkFx', '/assets/fx/Hit_Spark.png', {
    frameWidth: 96,
    frameHeight: 96,
  });
  scene.load.spritesheet('critStarBurstFx', '/assets/fx/Crit_Star_Burst.png', {
    frameWidth: 128,
    frameHeight: 128,
  });
  scene.load.spritesheet('lightningStrikeFx', '/assets/fx/Lightning_Strike.png', {
    frameWidth: 128,
    frameHeight: 256,
  });
  scene.load.spritesheet('frostNovaFx', '/assets/fx/Frost_Nova.png', {
    frameWidth: 192,
    frameHeight: 192,
  });
  scene.load.spritesheet('levelUpPillarFx', '/assets/fx/LevelUp_Pillar.png', {
    frameWidth: 192,
    frameHeight: 256,
  });
  scene.load.spritesheet('voidSlashFx', '/assets/fx/Void_Slash.png', {
    frameWidth: 128,
    frameHeight: 128,
  });
  scene.load.spritesheet('waterSplashFx', '/assets/fx/Water_Splash.png', {
    frameWidth: 192,
    frameHeight: 192,
  });

  // 몬스터 부락 본진 건물 (사냥 특화 모드 전용)
  if (isHuntingMode) {
    scene.load.image('blackCastle', '/assets/buildings/Black_Castle.png');
    scene.load.image('blackTower', '/assets/buildings/Black_Tower.png');
    scene.load.image('purpleCastle', '/assets/buildings/Purple_Castle.png');
  }

  // 장비·물약·자원 꾸러미 스프라이트
  const loadedKeys = new Set<string>();
  for (const item of ITEM_CATALOG) {
    if (!loadedKeys.has(item.textureKey)) {
      loadedKeys.add(item.textureKey);
      scene.load.image(item.textureKey, item.spritePath);
    }
  }
  for (const potion of POTION_LIST) {
    if (!loadedKeys.has(potion.textureKey)) {
      loadedKeys.add(potion.textureKey);
      scene.load.image(potion.textureKey, potion.spritePath);
    }
  }
  for (const bundle of RESOURCE_BUNDLE_SPRITES) {
    if (!loadedKeys.has(bundle.textureKey)) {
      loadedKeys.add(bundle.textureKey);
      scene.load.image(bundle.textureKey, bundle.spritePath);
    }
  }
}

export function registerHuntingModeAnimations(scene: Phaser.Scene): void {
  // 경량 배칭용 그림자 텍스처 베이킹 (Graphics 드로우콜 절감)
  if (!scene.textures.exists('unit_shadow_tex')) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(24, 12, 46, 20);
    g.generateTexture('unit_shadow_tex', 48, 24);
    g.destroy();
  }
  if (!scene.textures.exists('boss_aura_tex')) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xdc2626, 0.28);
    g.fillCircle(60, 60, 56);
    g.lineStyle(3, 0xf87171, 0.85);
    g.strokeCircle(60, 60, 56);
    g.generateTexture('boss_aura_tex', 120, 120);
    g.destroy();
  }
  if (!scene.textures.exists('loot_glow_tex')) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xffffff, 0.16);
    g.fillCircle(48, 48, 46);
    g.fillStyle(0xffffff, 0.28);
    g.fillCircle(48, 48, 30);
    g.fillStyle(0xffffff, 0.45);
    g.fillCircle(48, 48, 16);
    g.generateTexture('loot_glow_tex', 96, 96);
    g.destroy();
  }
  if (!scene.textures.exists('loot_chest_closed')) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(24, 42, 36, 10);
    g.fillStyle(0x78350f, 1);
    g.fillRoundedRect(8, 20, 32, 20, 3);
    g.fillStyle(0x92400e, 1);
    g.fillRoundedRect(7, 13, 34, 11, 4);
    g.fillStyle(0x451a03, 0.55);
    g.fillRect(9, 25, 30, 2);
    g.fillRect(9, 32, 30, 2);
    g.lineStyle(2, 0xfbbf24, 1);
    g.strokeRoundedRect(8, 14, 32, 26, 3);
    g.fillStyle(0xfbbf24, 1);
    g.fillRect(13, 14, 3, 25);
    g.fillRect(32, 14, 3, 25);
    g.fillRect(8, 22, 32, 3);
    g.fillStyle(0xfde047, 1);
    g.fillRoundedRect(20, 20, 8, 9, 2);
    g.fillStyle(0x451a03, 1);
    g.fillRect(23, 23, 2, 4);
    g.generateTexture('loot_chest_closed', 48, 48);
    g.destroy();
  }
  if (!scene.textures.exists('loot_chest_open')) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(24, 42, 36, 10);
    g.fillStyle(0x78350f, 1);
    g.fillRoundedRect(8, 6, 32, 11, 3);
    g.lineStyle(2, 0xfbbf24, 1);
    g.strokeRoundedRect(8, 6, 32, 11, 3);
    g.fillStyle(0xfef08a, 0.95);
    g.fillRect(11, 16, 26, 8);
    g.fillStyle(0xffffff, 0.85);
    g.fillRect(15, 17, 18, 5);
    g.fillStyle(0x78350f, 1);
    g.fillRoundedRect(8, 22, 32, 18, 3);
    g.lineStyle(2, 0xfbbf24, 1);
    g.strokeRoundedRect(8, 22, 32, 18, 3);
    g.fillStyle(0xfbbf24, 1);
    g.fillRect(13, 22, 3, 17);
    g.fillRect(32, 22, 3, 17);
    g.fillStyle(0xfde047, 1);
    g.fillRoundedRect(21, 22, 6, 5, 1);
    g.generateTexture('loot_chest_open', 48, 48);
    g.destroy();
  }

  // 마물 특화 병과 애니메이션
  if (scene.textures.exists('enemyLancerRun')) {
    scene.anims.create({
      key: 'monster_lancer_run',
      frames: scene.anims.generateFrameNumbers('enemyLancerRun', { start: 0, end: 5 }),
      frameRate: 9,
      repeat: -1,
    });
  }
  if (scene.textures.exists('enemyArchmageRun')) {
    scene.anims.create({
      key: 'monster_archmage_run',
      frames: scene.anims.generateFrameNumbers('enemyArchmageRun', { start: 0, end: 5 }),
      frameRate: 9,
      repeat: -1,
    });
  }
  if (scene.textures.exists('enemyArchmageCast')) {
    scene.anims.create({
      key: 'monster_archmage_cast',
      frames: scene.anims.generateFrameNumbers('enemyArchmageCast', { start: 0, end: 4 }),
      frameRate: 11,
      repeat: 0,
    });
  }

  const fxAnimSpecs: ReadonlyArray<{
    tex: string;
    key: string;
    end: number;
    frameRate: number;
    repeat: number;
  }> = [
    { tex: 'fireFx2', key: 'fire2_anim', end: 9, frameRate: 18, repeat: 0 },
    { tex: 'fireFx3', key: 'fire3_anim', end: 11, frameRate: 20, repeat: 0 },
    { tex: 'explosionFx2', key: 'explosion2_anim', end: 9, frameRate: 20, repeat: 0 },
    { tex: 'dustFx2', key: 'dust2_anim', end: 9, frameRate: 20, repeat: 0 },
    { tex: 'healFx', key: 'heal_anim', end: 10, frameRate: 16, repeat: 0 },
    { tex: 'slashArcFx', key: 'slash_arc_anim', end: 5, frameRate: 22, repeat: 0 },
    { tex: 'whirlwindSlashFx', key: 'whirlwind_slash_anim', end: 5, frameRate: 20, repeat: 0 },
    { tex: 'lanceBeamFx', key: 'lance_beam_anim', end: 5, frameRate: 22, repeat: 0 },
    { tex: 'magicCircleFx', key: 'magic_circle_anim', end: 3, frameRate: 12, repeat: -1 },
    { tex: 'meteorRockFx', key: 'meteor_rock_anim', end: 3, frameRate: 16, repeat: -1 },
    { tex: 'shockwaveRingFx', key: 'shockwave_ring_anim', end: 5, frameRate: 20, repeat: 0 },
    { tex: 'arrowStormFx', key: 'arrow_storm_anim', end: 3, frameRate: 16, repeat: -1 },
    { tex: 'hitSparkFx', key: 'hit_spark_anim', end: 5, frameRate: 24, repeat: 0 },
    { tex: 'critStarBurstFx', key: 'crit_star_burst_anim', end: 5, frameRate: 22, repeat: 0 },
    { tex: 'lightningStrikeFx', key: 'lightning_strike_anim', end: 5, frameRate: 20, repeat: 0 },
    { tex: 'frostNovaFx', key: 'frost_nova_anim', end: 5, frameRate: 20, repeat: 0 },
    { tex: 'levelUpPillarFx', key: 'levelup_pillar_anim', end: 7, frameRate: 16, repeat: 0 },
    { tex: 'voidSlashFx', key: 'void_slash_anim', end: 5, frameRate: 22, repeat: 0 },
    { tex: 'waterSplashFx', key: 'water_splash_anim', end: 8, frameRate: 18, repeat: 0 },
  ];

  for (const spec of fxAnimSpecs) {
    if (scene.textures.exists(spec.tex) && !scene.anims.exists(spec.key)) {
      scene.anims.create({
        key: spec.key,
        frames: scene.anims.generateFrameNumbers(spec.tex, { start: 0, end: spec.end }),
        frameRate: spec.frameRate,
        repeat: spec.repeat,
      });
    }
  }
}
