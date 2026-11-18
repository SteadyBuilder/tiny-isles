import { BossSkillId, MonsterCombatRole, MonsterSkillId, MonsterType } from '../types/game';

export interface MonsterClassCombatProfile {
  role: MonsterCombatRole;
  classLabel: string;
  rangeCategoryLabel: '근거리' | '중거리' | '원거리';
  skillId: MonsterSkillId;
  skillName: string;
  skillCallout: string;
  skillCalloutColor: string;
  skillCooldownMs: number;
  eliteSkillCooldownMs: number;
  skillTriggerRangePx: number;
  skillDamageMultiplier: number;
  telegraphDurationMs: number;
  telegraphRadiusPx: number;
  primaryHex: number;
  secondaryHex: number;
  accentHex: number;
}

/**
 * 몬스터 직업(흑기사/창기병/암흑궁수/흑마법병)별 근거리·중거리·원거리 기본 공격 및 고유 액티브 스킬 데이터
 * [AI Guideline]: 몬스터 직업별 스킬 밸런스·사거리·색상 이펙트 조정은 이 데이터 파일에서만 수행하세요.
 */
export const MONSTER_CLASS_COMBAT_PROFILES: Record<MonsterCombatRole, MonsterClassCombatProfile> = {
  melee: {
    role: 'melee',
    classLabel: '흑기사',
    rangeCategoryLabel: '근거리',
    skillId: 'dark_cleave',
    skillName: '암흑 회전참',
    skillCallout: '⚔️ 암흑 회전참!',
    skillCalloutColor: '#f87171',
    skillCooldownMs: 6800,
    eliteSkillCooldownMs: 5200,
    skillTriggerRangePx: 120,
    skillDamageMultiplier: 1.35,
    telegraphDurationMs: 620,
    telegraphRadiusPx: 96,
    primaryHex: 0xef4444,
    secondaryHex: 0xa855f7,
    accentHex: 0xfca5a5,
  },
  lancer: {
    role: 'lancer',
    classLabel: '흑철 창기병',
    rangeCategoryLabel: '중거리',
    skillId: 'piercing_thrust',
    skillName: '심연 관통창',
    skillCallout: '🔱 심연 관통창!',
    skillCalloutColor: '#fbbf24',
    skillCooldownMs: 6400,
    eliteSkillCooldownMs: 4900,
    skillTriggerRangePx: 185,
    skillDamageMultiplier: 1.38,
    telegraphDurationMs: 580,
    telegraphRadiusPx: 78,
    primaryHex: 0xf59e0b,
    secondaryHex: 0xfde047,
    accentHex: 0x38bdf8,
  },
  ranged: {
    role: 'ranged',
    classLabel: '암흑 명사수',
    rangeCategoryLabel: '원거리',
    skillId: 'volley_shot',
    skillName: '저주의 일제사격',
    skillCallout: '🏹 저주의 일제사격!',
    skillCalloutColor: '#fb923c',
    skillCooldownMs: 7000,
    eliteSkillCooldownMs: 5400,
    skillTriggerRangePx: 250,
    skillDamageMultiplier: 0.88,
    telegraphDurationMs: 0,
    telegraphRadiusPx: 60,
    primaryHex: 0xf87171,
    secondaryHex: 0xfb923c,
    accentHex: 0xfef08a,
  },
  mage: {
    role: 'mage',
    classLabel: '흑마법병',
    rangeCategoryLabel: '원거리',
    skillId: 'abyss_orb',
    skillName: '심연 마력진 폭발',
    skillCallout: '🔮 심연 마력진 폭발!',
    skillCalloutColor: '#e879f9',
    skillCooldownMs: 6500,
    eliteSkillCooldownMs: 5000,
    skillTriggerRangePx: 270,
    skillDamageMultiplier: 1.42,
    telegraphDurationMs: 820,
    telegraphRadiusPx: 98,
    primaryHex: 0xc084fc,
    secondaryHex: 0xd946ef,
    accentHex: 0x38bdf8,
  },
};

/**
 * 보스 몬스터의 주 스킬에 대응하는 보조 연계 스킬 매핑 (보스는 주 스킬과 보조 스킬을 번갈아 구사)
 */
export const BOSS_SECONDARY_SKILL_MAP: Record<BossSkillId, BossSkillId> = {
  shockwave: 'void_barrage',
  frost_nova: 'meteor_rain',
  void_barrage: 'shockwave',
  summon_minions: 'void_barrage',
  meteor_rain: 'lightning_judgment',
  lightning_judgment: 'shockwave',
};

/**
 * 몬스터에 role이 명시되지 않은 경우 type과 bossSpriteKey로부터 직업을 일관되게 판별하는 순수 함수
 */
export function resolveMonsterCombatRole(monster: {
  role?: MonsterCombatRole;
  type: MonsterType;
  bossSpriteKey?: string;
}): MonsterCombatRole {
  if (monster.role) return monster.role;
  if (monster.type === 'archmage' || monster.bossSpriteKey === 'enemyArchmageRun') return 'mage';
  if (monster.type === 'lancer' || monster.bossSpriteKey === 'enemyLancerRun') return 'lancer';
  if (monster.type === 'skeleton' || monster.bossSpriteKey === 'enemyArcherRun') return 'ranged';
  return 'melee';
}
