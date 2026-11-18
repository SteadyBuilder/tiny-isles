import { DEDICATED_MONSTER_SPRITES } from '../../data/monsterSprites';
import { Monster } from '../../types/game';

export interface MonsterAnimPair {
  readonly runAnimKey: string;
  readonly attackAnimKey: string;
}

type MonsterAnimDescriptor = Pick<Monster, 'isBoss' | 'bossSpriteKey' | 'type' | 'role'>;

const TEX_TO_ANIM_MAP: Record<string, MonsterAnimPair> = {
  enemyLancerRun: {
    runAnimKey: 'monster_lancer_run',
    attackAnimKey: 'monster_lancer_attack',
  },
  enemyArchmageRun: {
    runAnimKey: 'monster_archmage_run',
    attackAnimKey: 'monster_archmage_cast',
  },
  enemyArcherRun: {
    runAnimKey: 'monster_skeleton_run',
    attackAnimKey: 'monster_skeleton_attack',
  },
  enemyBlackWarriorRun: {
    runAnimKey: 'monster_zombie_run',
    attackAnimKey: 'monster_zombie_attack',
  },
  enemyPurpleWarriorRun: {
    runAnimKey: 'monster_boss_run',
    attackAnimKey: 'monster_boss_attack',
  },
};

/**
 * 몬스터 병과·보스 외형 키에 대응하는 이동(run) 및 무기 휘두르기/공격(attack) 애니메이션 키를 반환합니다.
 */
export function resolveMonsterAnimKeys(monster: MonsterAnimDescriptor): MonsterAnimPair {
  if (monster.isBoss) {
    const candidateKey = monster.bossSpriteKey || 'enemyPurpleWarriorRun';
    return TEX_TO_ANIM_MAP[candidateKey] ?? TEX_TO_ANIM_MAP.enemyPurpleWarriorRun;
  }

  if (monster.type in DEDICATED_MONSTER_SPRITES) {
    const spec =
      DEDICATED_MONSTER_SPRITES[monster.type as keyof typeof DEDICATED_MONSTER_SPRITES];
    return {
      runAnimKey: spec.runAnimKey,
      attackAnimKey: spec.attackAnimKey,
    };
  }

  if (monster.type === 'lancer' || monster.role === 'lancer') {
    return TEX_TO_ANIM_MAP.enemyLancerRun;
  }
  if (monster.type === 'archmage' || monster.role === 'mage') {
    return TEX_TO_ANIM_MAP.enemyArchmageRun;
  }
  if (monster.role === 'ranged') {
    return TEX_TO_ANIM_MAP.enemyArcherRun;
  }

  return {
    runAnimKey: DEDICATED_MONSTER_SPRITES.goblin.runAnimKey,
    attackAnimKey: DEDICATED_MONSTER_SPRITES.goblin.attackAnimKey,
  };
}
