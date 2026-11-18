import { MonsterType } from '../types/game';

export interface MonsterSpriteSpec {
  readonly runTexKey: string;
  readonly attackTexKey: string;
  readonly runPath: string;
  readonly attackPath: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly runFrames: number;
  readonly attackFrames: number;
  readonly runFrameRate: number;
  readonly attackFrameRate: number;
  readonly runAnimKey: string;
  readonly attackAnimKey: string;
  readonly displaySize: number;
  readonly defaultTintHex: number | null;
}

/**
 * 일반 몬스터 전용 스프라이트·애니메이션 스펙 (데이터 순수 분리)
 */
export const DEDICATED_MONSTER_SPRITES: Record<
  Extract<MonsterType, 'zombie' | 'skeleton' | 'goblin' | 'lizardman' | 'slime'>,
  MonsterSpriteSpec
> = {
  zombie: {
    runTexKey: 'enemyZombieRun',
    attackTexKey: 'enemyZombieAttack',
    runPath: '/assets/units/enemies/Zombie_Run.png',
    attackPath: '/assets/units/enemies/Zombie_Attack.png',
    frameWidth: 192,
    frameHeight: 192,
    runFrames: 4,
    attackFrames: 4,
    runFrameRate: 7,
    attackFrameRate: 10,
    runAnimKey: 'monster_zombie_run',
    attackAnimKey: 'monster_zombie_attack',
    displaySize: 120,
    defaultTintHex: null,
  },
  skeleton: {
    runTexKey: 'enemySkeletonRun',
    attackTexKey: 'enemySkeletonAttack',
    runPath: '/assets/units/enemies/Skeleton_Run.png',
    attackPath: '/assets/units/enemies/Skeleton_Attack.png',
    frameWidth: 192,
    frameHeight: 192,
    runFrames: 4,
    attackFrames: 4,
    runFrameRate: 9,
    attackFrameRate: 12,
    runAnimKey: 'monster_skeleton_run',
    attackAnimKey: 'monster_skeleton_attack',
    displaySize: 120,
    defaultTintHex: null,
  },
  goblin: {
    runTexKey: 'enemyGoblinRun',
    attackTexKey: 'enemyGoblinAttack',
    runPath: '/assets/units/enemies/Goblin_Run.png',
    attackPath: '/assets/units/enemies/Goblin_Attack.png',
    frameWidth: 192,
    frameHeight: 192,
    runFrames: 4,
    attackFrames: 4,
    runFrameRate: 9,
    attackFrameRate: 12,
    runAnimKey: 'monster_goblin_run',
    attackAnimKey: 'monster_goblin_attack',
    displaySize: 116,
    defaultTintHex: null,
  },
  lizardman: {
    runTexKey: 'enemyLizardmanRun',
    attackTexKey: 'enemyLizardmanAttack',
    runPath: '/assets/units/enemies/Lizardman_Run.png',
    attackPath: '/assets/units/enemies/Lizardman_Attack.png',
    frameWidth: 192,
    frameHeight: 192,
    runFrames: 4,
    attackFrames: 4,
    runFrameRate: 9,
    attackFrameRate: 11,
    runAnimKey: 'monster_lizardman_run',
    attackAnimKey: 'monster_lizardman_attack',
    displaySize: 126,
    defaultTintHex: null,
  },
  slime: {
    runTexKey: 'enemySlimeRun',
    attackTexKey: 'enemySlimeAttack',
    runPath: '/assets/units/enemies/Slime_Run.png',
    attackPath: '/assets/units/enemies/Slime_Attack.png',
    frameWidth: 192,
    frameHeight: 192,
    runFrames: 4,
    attackFrames: 4,
    runFrameRate: 8,
    attackFrameRate: 11,
    runAnimKey: 'monster_slime_run',
    attackAnimKey: 'monster_slime_attack',
    displaySize: 108,
    defaultTintHex: null,
  },
};
