import { MonsterType } from '../types/game';

/**
 * 웨이브 주기 및 시간 상수
 */
export const REGULAR_WAVE_INTERVAL_SEC = 30 * 60; // 30분 (1,800초) 마다 정규 마물 침공
export const BOSS_WAVE_INTERVAL_SEC = 60 * 60;    // 60분 (3,600초) 마다 보스 마물 출현

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
    speed: 42,
    title: '망자들의 군주',
  },
];
