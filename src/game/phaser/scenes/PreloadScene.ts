import Phaser from 'phaser';
import { EventBus } from '../EventBus';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    // Loading progress events
    this.load.on('progress', (value: number) => {
      EventBus.emit('load-progress', value);
    });

    this.load.on('complete', () => {
      EventBus.emit('load-complete');
    });

    // Player Spritesheets (192x192, 6 frames each)
    this.load.spritesheet('bluePawnIdle', '/assets/units/blue/Pawn_Idle.png', {
      frameWidth: 192,
      frameHeight: 192,
    });
    this.load.spritesheet('bluePawnRun', '/assets/units/blue/Pawn_Run.png', {
      frameWidth: 192,
      frameHeight: 192,
    });
    this.load.spritesheet('bluePawnAxe', '/assets/units/blue/Pawn_Interact_Axe.png', {
      frameWidth: 192,
      frameHeight: 192,
    });
    this.load.spritesheet('bluePawnPickaxe', '/assets/units/blue/Pawn_Interact_Pickaxe.png', {
      frameWidth: 192,
      frameHeight: 192,
    });

    this.load.spritesheet('redPawnIdle', '/assets/units/red/Pawn_Idle.png', {
      frameWidth: 192,
      frameHeight: 192,
    });
    this.load.spritesheet('redPawnRun', '/assets/units/red/Pawn_Run.png', {
      frameWidth: 192,
      frameHeight: 192,
    });
    this.load.spritesheet('redPawnAxe', '/assets/units/red/Pawn_Interact_Axe.png', {
      frameWidth: 192,
      frameHeight: 192,
    });
    this.load.spritesheet('redPawnPickaxe', '/assets/units/red/Pawn_Interact_Pickaxe.png', {
      frameWidth: 192,
      frameHeight: 192,
    });

    // Monster & Boss Spritesheets
    this.load.spritesheet('enemyBlackWarriorRun', '/assets/units/enemies/Black_Warrior_Run.png', {
      frameWidth: 192,
      frameHeight: 192,
    });
    this.load.spritesheet('enemyBlackWarriorAttack', '/assets/units/enemies/Black_Warrior_Attack.png', {
      frameWidth: 192,
      frameHeight: 192,
    });
    this.load.spritesheet('enemyPurpleWarriorRun', '/assets/units/enemies/Purple_Warrior_Run.png', {
      frameWidth: 192,
      frameHeight: 192,
    });
    this.load.spritesheet('enemyPurpleWarriorAttack', '/assets/units/enemies/Purple_Warrior_Attack.png', {
      frameWidth: 192,
      frameHeight: 192,
    });
    this.load.spritesheet('enemyArcherRun', '/assets/units/enemies/Black_Archer_Run.png', {
      frameWidth: 192,
      frameHeight: 192,
    });

    // Projectiles & FX
    this.load.image('arrowProj', '/assets/fx/Arrow.png');
    this.load.spritesheet('explosionFx', '/assets/fx/Explosion_01.png', {
      frameWidth: 192,
      frameHeight: 192,
    });

    // Entity Spritesheets
    this.load.spritesheet('tree', '/assets/decorations/Tree1.png', {
      frameWidth: 192,
      frameHeight: 256,
    });
    this.load.spritesheet('tree3', '/assets/decorations/Tree3.png', {
      frameWidth: 192,
      frameHeight: 192,
    });
    this.load.spritesheet('sheep', '/assets/resources/Sheep_Idle.png', {
      frameWidth: 128,
      frameHeight: 128,
    });

    // Static Decor & Resources
    this.load.image('rock1', '/assets/decorations/Rock1.png');
    this.load.image('rock2', '/assets/decorations/Rock2.png');
    this.load.image('rock3', '/assets/decorations/Rock3.png');
    this.load.image('rock4', '/assets/decorations/Rock4.png');
    this.load.image('bush', '/assets/decorations/Bushe1.png');
    this.load.image('bush2', '/assets/decorations/Bushe2.png');
    this.load.image('goldResource', '/assets/resources/Gold_Stone_6.png');
    this.load.image('goldResource2', '/assets/resources/Gold_Stone_5.png');
    this.load.image('woodResource', '/assets/resources/Wood Resource.png');

    // Buildings
    this.load.image('castle', '/assets/buildings/Castle.png');
    this.load.image('house1', '/assets/buildings/House1.png');
    this.load.image('house2', '/assets/buildings/House2.png');
    this.load.image('house3', '/assets/buildings/House3.png');
    this.load.image('tower', '/assets/buildings/Tower.png');
    this.load.image('barracks', '/assets/buildings/Barracks.png');
    this.load.image('archery', '/assets/buildings/Archery.png');
    this.load.image('monastery', '/assets/buildings/Monastery.png');
    this.load.image('woodPalisade', '/assets/buildings/Wood_Palisade.png');
    this.load.image('woodPalisadeH', '/assets/buildings/Wood_Palisade_H.png');
    this.load.image('woodPalisadeV', '/assets/buildings/Wood_Palisade_V.png');
    this.load.image('woodPalisadeGate', '/assets/buildings/Wood_Palisade_Gate.png');
    this.load.image('woodPalisadeGateV', '/assets/buildings/Wood_Palisade_Gate_V.png');
    this.load.image('woodPalisadeCorner', '/assets/buildings/Wood_Palisade_Corner.png');

    // Terrain & Environment
    this.load.image('grassSeamless', '/assets/terrain/Grass_Seamless.png');
    this.load.image('tilemap', '/assets/terrain/Tilemap_color1.png');
    this.load.image('waterBg', '/assets/terrain/Water_Background_color.png');
    this.load.image('waterFoam', '/assets/terrain/Water_Foam.png');
    this.load.image('cloud1', '/assets/decorations/Clouds_01.png');
    this.load.image('cloud2', '/assets/decorations/Clouds_02.png');

    // UI Elements
    this.load.image('cursorTarget', '/assets/ui/Cursors/Cursor_04.png');
  }

  create() {
    this.createAnimations();
    this.scene.start('WorldScene');
  }

  private createAnimations() {
    const colors = ['blue', 'red'] as const;
    colors.forEach((color) => {
      const cap = color === 'blue' ? 'bluePawn' : 'redPawn';

      this.anims.create({
        key: `${color}_idle`,
        frames: this.anims.generateFrameNumbers(`${cap}Idle`, { start: 0, end: 5 }),
        frameRate: 6,
        repeat: -1,
      });

      this.anims.create({
        key: `${color}_run`,
        frames: this.anims.generateFrameNumbers(`${cap}Run`, { start: 0, end: 5 }),
        frameRate: 8,
        repeat: -1,
      });

      this.anims.create({
        key: `${color}_axe`,
        frames: this.anims.generateFrameNumbers(`${cap}Axe`, { start: 0, end: 5 }),
        frameRate: 12,
        repeat: 0,
      });

      this.anims.create({
        key: `${color}_pickaxe`,
        frames: this.anims.generateFrameNumbers(`${cap}Pickaxe`, { start: 0, end: 5 }),
        frameRate: 12,
        repeat: 0,
      });
    });

    // Enemy Monster Animations
    if (this.textures.exists('enemyBlackWarriorRun')) {
      this.anims.create({
        key: 'monster_zombie_run',
        frames: this.anims.generateFrameNumbers('enemyBlackWarriorRun', { start: 0, end: 5 }),
        frameRate: 7,
        repeat: -1,
      });
    }
    if (this.textures.exists('enemyBlackWarriorAttack')) {
      this.anims.create({
        key: 'monster_zombie_attack',
        frames: this.anims.generateFrameNumbers('enemyBlackWarriorAttack', { start: 0, end: 3 }),
        frameRate: 10,
        repeat: 0,
      });
    }
    if (this.textures.exists('enemyArcherRun')) {
      this.anims.create({
        key: 'monster_skeleton_run',
        frames: this.anims.generateFrameNumbers('enemyArcherRun', { start: 0, end: 3 }),
        frameRate: 9,
        repeat: -1,
      });
    }
    if (this.textures.exists('enemyPurpleWarriorRun')) {
      this.anims.create({
        key: 'monster_boss_run',
        frames: this.anims.generateFrameNumbers('enemyPurpleWarriorRun', { start: 0, end: 5 }),
        frameRate: 6,
        repeat: -1,
      });
    }
    if (this.textures.exists('enemyPurpleWarriorAttack')) {
      this.anims.create({
        key: 'monster_boss_attack',
        frames: this.anims.generateFrameNumbers('enemyPurpleWarriorAttack', { start: 0, end: 3 }),
        frameRate: 9,
        repeat: 0,
      });
    }
    if (this.textures.exists('explosionFx')) {
      this.anims.create({
        key: 'explosion_anim',
        frames: this.anims.generateFrameNumbers('explosionFx', { start: 0, end: 7 }),
        frameRate: 16,
        repeat: 0,
      });
    }

    // Trees
    if (this.textures.exists('tree')) {
      this.anims.create({
        key: 'tree_anim',
        frames: this.anims.generateFrameNumbers('tree', { start: 0, end: 7 }),
        frameRate: 4,
        repeat: -1,
      });
    }

    if (this.textures.exists('tree3')) {
      this.anims.create({
        key: 'tree3_anim',
        frames: this.anims.generateFrameNumbers('tree3', { start: 0, end: 7 }),
        frameRate: 4,
        repeat: -1,
      });
    }

    // Sheep
    if (this.textures.exists('sheep')) {
      this.anims.create({
        key: 'sheep_anim',
        frames: this.anims.generateFrameNumbers('sheep', { start: 0, end: 5 }),
        frameRate: 5,
        repeat: -1,
      });
    }
  }
}
