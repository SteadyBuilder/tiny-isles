import { MonsterType } from '../types/game';

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
    baseHp: 900,
    hpPerBossWave: 250,
    baseAttack: 45,
    attackPerBossWave: 8,
    speed: 38,
    title: '멸망을 부르는 파괴자',
  },
  {
    id: 'boss_lich_king',
    name: '👑 불사의 리치 킹',
    type: 'skeleton',
    baseHp: 750,
    hpPerBossWave: 220,
    baseAttack: 55,
    attackPerBossWave: 9,
    speed: 42,
    title: '망자들의 군주',
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

