import { BossSkillId, MonsterType } from '../types/game';

/**
 * 몬스터 기본 스탯 템플릿 인터페이스
 */
export interface MonsterDataTemplate {
  type: MonsterType;
  name: string;
  baseHp: number;
  hpPerWave: number;
  baseAttack: number;
  attackPerWave: number;
  speed: number;
  description: string;
}

/**
 * 정규 마물 템플릿 정의 (AI Guideline: 신규 몬스터 추가 시 이 배열에 스펙을 등록하세요)
 */
export const REGULAR_MONSTER_TEMPLATES: MonsterDataTemplate[] = [
  {
    type: 'zombie',
    name: '🧟 부패한 좀비',
    baseHp: 90,
    hpPerWave: 15,
    baseAttack: 14,
    attackPerWave: 2,
    speed: 48,
    description: '느리지만 끈질긴 생명력으로 성벽을 갉아먹는 기본 언데드 마물',
  },
  {
    type: 'skeleton',
    name: '💀 저주받은 스켈레톤',
    baseHp: 70,
    hpPerWave: 12,
    baseAttack: 18,
    attackPerWave: 2,
    speed: 64,
    description: '빠른 기동력으로 외곽 방어선을 우회하여 중심부로 쇄도하는 골격 병사',
  },
  {
    type: 'goblin',
    name: '👺 암흑 마물병',
    baseHp: 80,
    hpPerWave: 14,
    baseAttack: 16,
    attackPerWave: 2,
    speed: 58,
    description: '균형 잡힌 공격력과 속도로 건물을 집중 파괴하는 전위대',
  },
];

/**
 * 출현 가능한 보스 몬스터 목록 데이터
 */
export interface BossMonsterDataTemplate {
  id: string;
  name: string;
  type: MonsterType;
  spriteKey: string;
  tintHex: number;
  scale: number;
  skillId: BossSkillId;
  baseHp: number;
  hpPerBossWave: number;
  baseAttack: number;
  attackPerBossWave: number;
  speed: number;
  title: string;
}

export const BOSS_MONSTER_TEMPLATES: BossMonsterDataTemplate[] = [
  {
    id: 'boss_dark_knight',
    name: '⚔️ 암흑의 거인 기사',
    type: 'goblin',
    spriteKey: 'enemyBlackWarriorRun',
    tintHex: 0xfca5a5,
    scale: 1.0,
    skillId: 'shockwave',
    baseHp: 950,
    hpPerBossWave: 320,
    baseAttack: 44,
    attackPerBossWave: 10,
    speed: 40,
    title: '멸망을 부르는 파괴자',
  },
  {
    id: 'boss_lich_king',
    name: '🔮 불사의 리치 킹',
    type: 'archmage',
    spriteKey: 'enemyArchmageRun',
    tintHex: 0xc084fc,
    scale: 1.05,
    skillId: 'frost_nova',
    baseHp: 1150,
    hpPerBossWave: 360,
    baseAttack: 52,
    attackPerBossWave: 12,
    speed: 43,
    title: '혹한의 대마법 군주',
  },
  {
    id: 'boss_abyss_lancer',
    name: '🔱 심연의 창기병 군주',
    type: 'lancer',
    spriteKey: 'enemyLancerRun',
    tintHex: 0xfbbf24,
    scale: 1.1,
    skillId: 'void_barrage',
    baseHp: 1400,
    hpPerBossWave: 410,
    baseAttack: 58,
    attackPerBossWave: 14,
    speed: 50,
    title: '전장을 꿰뚫는 파멸창',
  },
  {
    id: 'boss_crimson_archer',
    name: '🏹 핏빛 명사수 군주',
    type: 'skeleton',
    spriteKey: 'enemyArcherRun',
    tintHex: 0xf87171,
    scale: 1.12,
    skillId: 'summon_minions',
    baseHp: 1650,
    hpPerBossWave: 460,
    baseAttack: 64,
    attackPerBossWave: 15,
    speed: 48,
    title: '군단을 부르는 사냥꾼',
  },
  {
    id: 'boss_void_tyrant',
    name: '☄️ 공허의 폭군',
    type: 'goblin',
    spriteKey: 'enemyPurpleWarriorRun',
    tintHex: 0xa855f7,
    scale: 1.18,
    skillId: 'meteor_rain',
    baseHp: 2000,
    hpPerBossWave: 520,
    baseAttack: 72,
    attackPerBossWave: 17,
    speed: 45,
    title: '하늘을 가르는 운석 군주',
  },
  {
    id: 'boss_deathlord',
    name: '💀 종말의 대군주',
    type: 'boss_deathlord',
    spriteKey: 'enemyPurpleWarriorRun',
    tintHex: 0xef4444,
    scale: 1.25,
    skillId: 'lightning_judgment',
    baseHp: 2500,
    hpPerBossWave: 620,
    baseAttack: 82,
    attackPerBossWave: 20,
    speed: 47,
    title: '심연의 최종 지배자',
  },
];

/**
 * 웨이브 스폰 수 스케일링 및 처치 보상 데이터
 */
export const WAVE_SPAWN_SCALING_CONFIG = {
  baseRegularCount: 5,
  baseBossWaveMinionCount: 6,
  extraCountPerUnlockedTerritory: 0.4,
  extraCountPerWave: 0.25,
  maxBaseCountBeforeOnlineScaling: 18,
} as const;

export const MONSTER_KILL_REWARDS = {
  regular: { wood: 5, stone: 4, gold: 5 },
  boss: { wood: 50, stone: 45, gold: 60 },
} as const;

/**
 * 지도 외곽(WORLD_BOUNDS) 기반 웨이브 스폰 영역 설정 데이터
 */
export const MAP_OUTER_SPAWN_CONFIG = {
  /** 지도 최외곽 경계선으로부터 안쪽 여백 (px) */
  edgeMarginPx: 80,
  /** 각 외곽 변(동·서·남·북)에서 중앙 기준 좌우/상하 랜덤 분포 반폭 (px) */
  spreadHalfWidthPx: 2560,
  /** 스폰 좌표 미세 랜덤 흔들림 (px) */
  jitterPx: 35,
} as const;

