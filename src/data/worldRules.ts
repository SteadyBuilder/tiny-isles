import { DynamicScalingProfile } from '../types/game';
import { BOSS_WAVE_INTERVAL_SEC, REGULAR_WAVE_INTERVAL_SEC } from './waves';

/**
 * 리빙 아일즈(Living Isles) 하이브리드 월드 밸런스 데이터
 * [AI Guideline]: 수치·밸런스 변경은 로직 파일이 아닌 이 데이터 파일에서만 수행하세요.
 */
export const WORLD_CLOCK_CONFIG = {
  regularWaveIntervalSec: REGULAR_WAVE_INTERVAL_SEC, // 1800초 (30분)
  bossWaveIntervalSec: BOSS_WAVE_INTERVAL_SEC,       // 3600초 (60분)
  worldSnapshotIntervalMs: 30_000,                   // 30초마다 월드 상태 스냅샷 저장
  garrisonSyncIntervalMs: 25_000,                    // 25초마다 내 수비대 위치 갱신
} as const;

/**
 * 접속자 수(onlineCount)에 따른 실시간 웨이브 난이도 스케일링 테이블
 */
export const ONLINE_SCALING_PROFILES: DynamicScalingProfile[] = [
  { minPlayers: 1, maxPlayers: 1, countMultiplier: 1.0, hpMultiplier: 1.0, attackMultiplier: 1.0, label: '1인 수호' },
  { minPlayers: 2, maxPlayers: 2, countMultiplier: 1.4, hpMultiplier: 1.25, attackMultiplier: 1.1, label: '2인 협동' },
  { minPlayers: 3, maxPlayers: 3, countMultiplier: 1.8, hpMultiplier: 1.5, attackMultiplier: 1.2, label: '3인 연합' },
  { minPlayers: 4, maxPlayers: 99, countMultiplier: 2.2, hpMultiplier: 1.85, attackMultiplier: 1.3, label: '4인+ 총력전' },
];

/**
 * 오프라인(무인) 휴면 및 복귀 정산 밸런스
 */
export const OFFLINE_RESOLUTION_CONFIG = {
  /** 이 시간(초) 이상 전원 오프라인이었다가 복귀할 때만 오프라인 정산 모달 표시 (5분) */
  minOfflineSecondsForReport: 5 * 60,
  /** 장기간 미접속 시 무한 누적 방지를 위한 최대 정산 웨이브 수 (최대 6시간분 = 12웨이브) */
  maxSimulatedWaves: 12,
  /** 중심 마을(#0) 코어 보호 하한 비율 (오프라인 정산으로는 절대 전멸하지 않음) */
  homeCoreMinHpRatio: 0.15,
  /** 1회 오프라인 정산 세션당 상실 가능한 최대 외곽 섬 수 */
  maxOuterIslandsLostPerSession: 2,
  /** 웨이브 1회당 마을 티어 패시브 생산 보상 배율 */
  passiveYieldMultiplierPerWave: 1.0,
  /** 타워·성벽·수비대 방어력 대비 몬스터 1웨이브 기본 위협 전력 */
  baseWaveThreatPower: 140,
  /** 웨이브 차수당 위협 전력 증가량 */
  threatPowerPerWave: 32,
  /** 보스 웨이브 추가 위협 전력 */
  bossExtraThreatPower: 220,
} as const;

/**
 * 비동기 오프라인 수비대(Garrison) AI 밸런스
 */
export const GARRISON_CONFIG = {
  /** 월드에 동시 소환되는 최대 오프라인 유저 수비대 수 */
  maxActiveGarrisons: 5,
  /** 오프라인 수비대 기본 공격력 */
  baseAttack: 18,
  /** 탐지 및 교전 사거리 (px) */
  aggroRange: 260,
  /** 투사체/근접 요격 사거리 (px) */
  attackRange: 175,
  /** 공격 주기 (ms) */
  attackCooldownMs: 1150,
  /** 순찰/추격 이동 속도 (px/s) */
  moveSpeed: 76,
  /** 오프라인 정산 시 수비대 1기당 방어력 기여도 */
  offlineDefensePowerPerGarrison: 110,
  /** 수비대 기록 유효 기간 (일) */
  staleDays: 14,
} as const;

/**
 * 능동적 웨이브 가속 및 조기 소환 설정
 */
export const ACTIVE_WAVE_ACCELERATION_CONFIG = {
  /** 자원 채집(나무/바위 파괴) 1회당 다음 웨이브 대기시간 단축(초) */
  gatherCooldownReductionSec: 10,
  /** 건물 건설 1회당 다음 웨이브 대기시간 단축(초) */
  buildCooldownReductionSec: 45,
  /** 조기 소환(즉시 침공 맞이하기) 시 처치 보상 보너스 배율 */
  earlySummonRewardMultiplier: 1.35,
} as const;
