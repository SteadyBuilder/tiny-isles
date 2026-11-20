import { DynamicScalingProfile } from '../types/game';

/**
 * 리빙 아일즈(Living Isles) 월드 동기화 주기 설정
 * [AI Guideline]: 수치·밸런스 변경은 로직 파일이 아닌 이 데이터 파일에서만 수행하세요.
 */
export const WORLD_CLOCK_CONFIG = {
  passiveTickIntervalMs: 30_000,                     // 30초마다 특수 생산/회복 건물 주기 정산
  worldSnapshotIntervalMs: 10_000,                   // 10초마다 월드 상태 스냅샷 저장
  garrisonSyncIntervalMs: 25_000,                    // 25초마다 내 수비대 위치 갱신
  monsterSyncIntervalMs: 180,                        // 호스트 -> 게스트 몬스터 상태 브로드캐스트 주기
} as const;

/**
 * 멀티플레이 몬스터 동기화 청킹·델타·보간 설정
 */
export const MONSTER_SYNC_CONFIG = {
  /** 전체 동기화 1회 브로드캐스트당 최대 몬스터 수 (Supabase 페이로드 제한 방지) */
  fullSyncChunkSize: 120,
  /** 다중 청크 전체 동기화 시 청크 간 페이싱 간격 (ms) - 레이트리밋 유실 방지 */
  fullSyncChunkPaceMs: 65,
  /** 진행 중인 다중 청크 전체 동기화 종료 후 예약된 후속 전체 동기화 시작 지연 (ms) */
  fullSyncFollowUpDelayMs: 180,
  /** 델타 동기화 1회 브로드캐스트당 최대 위치/HP 업데이트 수 */
  deltaUpdateChunkSize: 160,
  /** 델타 동기화 1회 브로드캐스트당 최대 신규 스폰 수 */
  deltaSpawnChunkSize: 80,
  /** 피격/처치 즉시 델타 플러시 최소 병합 간격 (ms) - 4인 동시 타격 폭주 방지 */
  deltaFlushMinIntervalMs: 55,
  /** 게스트가 전체 동기화를 재요청하는 최소 간격 (ms) */
  guestSyncRequestThrottleMs: 2000,
  /** 호스트가 중복 전체 동기화 요청을 무시하는 최소 간격 (ms) */
  hostFullSyncCooldownMs: 1500,
  /** 누락 몬스터 ID 단건 복구 요청 병합 디바운스 (ms) */
  repairRequestDebounceMs: 120,
  /** 누락 몬스터 ID 단건 복구 요청 최소 전송 간격 (ms) */
  repairRequestThrottleMs: 400,
  /** 1회 단건 복구 요청에 포함할 최대 몬스터 ID 수 */
  repairMaxBatchIds: 35,
  /** 누락 몬스터 ID가 임계치를 초과하면 단건 복구 대신 전체 동기화로 전환 */
  repairFallbackFullSyncThreshold: 40,
  /** 게스트 로컬 선타격 후 호스트의 이전 HP 패킷으로 되감기는 현상을 막는 유예 시간 (ms) */
  localHitHpGraceMs: 260,
  /** 처치/제거된 몬스터 ID가 역순 지연 패킷으로 부활하는 것을 막는 툼스톤 유지 시간 (ms) */
  killTombstoneTtlMs: 6500,
  /** 마릿수 또는 ID 다이제스트 불일치 연속 감지 시 자동 전체 재동기화 임계 횟수 */
  digestMismatchTriggerCount: 2,
  /** 게스트 측 몬스터 보간 순간이동(Snap) 임계 거리 (px) */
  remoteSnapThresholdPx: 260,
  /** 게스트 측 몬스터 보간 속도 계수 (180ms 델타 주기에 맞춘 연속 이동 감쇠값) */
  remoteLerpSpeedPerSec: 9.5,
  /** 협동 처치 시 주변 팀원과 보상/경험치 공유 반경 (px) */
  coopKillShareRadiusPx: 550,
  /** 미완성 분할 전체 동기화 배치를 폐기하는 만료 시간 (ms) */
  fullSyncBatchTtlMs: 8000,
} as const;

/**
 * 실시간 방장 생존 감시(Watchdog)·모바일 백그라운드 이양·재연결 복구 설정
 */
export const HOST_SYNC_CONFIG = {
  /** 호스트가 생존 신호 및 몬스터 ID 다이제스트를 송신하는 주기 (ms) */
  heartbeatIntervalMs: 1500,
  /** 포그라운드 게스트가 방장 무응답을 판정해 자동 승계를 시작하는 기준 시간 (ms) */
  failoverTimeoutMs: 7500,
  /** 다수 게스트 동시 승계 충돌을 막기 위한 후보 순위별 지연 간격 (ms) */
  failoverCandidateStaggerMs: 650,
  /** 동일 게스트의 중복 방장 승계 요청 최소 쿨다운 (ms) */
  failoverClaimCooldownMs: 3000,
  /** 협동 게임 시작 직후 모바일 에셋·지형 로딩 편차를 고려해 로비 방장 입장을 대기하는 게스트 유예 시간 (ms) */
  initialLobbyHostGraceMs: 12_000,
  /** 게스트 입장 후 호스트의歡迎(host_welcome/monsters_sync) 응답 전まで join_hello 출석 재송신 주기 (ms) */
  joinHelloRetryIntervalMs: 1200,
  /** 게스트 초기 월드 동기화 배너 자동 해제 안전 타임아웃 (ms) */
  initialSyncBannerTimeoutMs: 6500,
  /** 채널 끊김 시 지수 백오프 기본 재연결 대기 시간 (ms) */
  reconnectBaseDelayMs: 800,
  /** 채널 재연결 백오프 상한 (ms) */
  reconnectMaxDelayMs: 6000,
  /** 모바일 백그라운드 복귀 직후 프레임 delta 급등 방지를 위한 상한 (ms) */
  maxFrameDeltaMs: 100,
} as const;

/**
 * 실시간 플레이어 이동 동기화(변경 감지 + 정지 시 저빈도 하트비트) 설정
 */
export const PLAYER_SYNC_CONFIG = {
  /** 상태 변경 시 최소 위치 브로드캐스트 간격 (ms) */
  moveBroadcastIntervalMs: 85,
  /** 3~4인 협동 시 채널 여유 확보를 위한 위치 브로드캐스트 간격 (ms) */
  coopMoveBroadcastIntervalMs: 100,
  /** 고빈도 전투/피격 이벤트 배치 묶음 전송 주기 (ms) */
  eventBatchFlushMs: 80,
  /** 정지/동일 상태 유지 시 keep-alive 하트비트 전송 주기 (ms) */
  idleHeartbeatMs: 5000,
} as const;

/**
 * 접속자 수(onlineCount)에 따른 실시간 웨이브 난이도 스케일링 테이블
 */
export const ONLINE_SCALING_PROFILES: DynamicScalingProfile[] = [
  { minPlayers: 1, maxPlayers: 1, countMultiplier: 1.0, hpMultiplier: 1.0, attackMultiplier: 1.0, label: '1인 수호' },
  { minPlayers: 2, maxPlayers: 2, countMultiplier: 1.35, hpMultiplier: 1.35, attackMultiplier: 1.15, label: '2인 협동' },
  { minPlayers: 3, maxPlayers: 3, countMultiplier: 1.7, hpMultiplier: 1.7, attackMultiplier: 1.28, label: '3인 연합' },
  { minPlayers: 4, maxPlayers: 99, countMultiplier: 2.1, hpMultiplier: 2.1, attackMultiplier: 1.4, label: '4인+ 총력전' },
];

/**
 * 비동기 수비대(Garrison) AI 밸런스
 */
export const GARRISON_CONFIG = {
  /** 월드에 동시 소환되는 최대 수비대 수 */
  maxActiveGarrisons: 5,
  /** 수비대 기본 공격력 */
  baseAttack: 18,
  /** 탐지 및 교전 사거리 (px) */
  aggroRange: 260,
  /** 투사체/근접 요격 사거리 (px) */
  attackRange: 175,
  /** 공격 주기 (ms) */
  attackCooldownMs: 1150,
  /** 순찰/추격 이동 속도 (px/s) */
  moveSpeed: 76,
  /** 수비대 1기당 기본 방어력 */
  offlineDefensePowerPerGarrison: 110,
  /** 수비대 기록 유효 기간 (일) */
  staleDays: 14,
} as const;

/**
 * 활동 기반 마물 위협도(Threat %) 및 웨이브 소환 설정
 */
export const THREAT_WAVE_CONFIG = {
  /** 웨이브가 발동되는 최대 위협도 (%) */
  maxThreat: 100,
  /** "곧 마물 대군이 몰려옵니다" 경고가 뜨는 임계치 (%) */
  warningThreshold: 80,
  /** 자원 채집(나무/바위/금광 파괴) 1회당 위협도 증가량 (%) */
  gatherThreatGain: 4,
  /** 마물 사냥(처치) 1회당 위협도 증가량 (%) */
  huntThreatGain: 2,
  /** 건물 건설 1회당 위협도 증가량 (%) */
  buildThreatGain: 12,
  /** 새 마을(영지) 해금 1회당 위협도 증가량 (%) */
  unlockThreatGain: 25,
  /** 마을 승급 1회당 위협도 증가량 (%) */
  upgradeThreatGain: 15,
  /** 위협도 100% 도달 후 실제 침공까지 카운트다운 유예 시간 (초) */
  imminentCountdownSec: 15,
  /** 정규 웨이브 N회마다 보스 웨이브 출현 (예: 3 -> 3번째마다 보스 침공) */
  bossEveryNWaves: 3,
  /** 조기 소환(즉시 침공 맞이하기) 시 처치 보상 보너스 배율 */
  earlySummonRewardMultiplier: 1.35,
} as const;

/**
 * 플레이어 전투, 체력(HP), 기절·리스폰 및 마물 반격 어그로 설정
 */
export const PLAYER_COMBAT_CONFIG = {
  /** 플레이어 최대 체력 */
  maxHp: 100,
  /** 플레이어 근접 공격 기본 데미지 */
  meleeDamage: 28,
  /** 일반 몬스터 근접 공격 사거리 (px) - 견습 모험가 기본 사거리와 동일 */
  meleeRangeRegular: 72,
  /** 보스 몬스터 근접 공격 사거리 (px) */
  meleeRangeBoss: 95,
  /** 기절 후 메인 마을 리스폰 대기 시간 (ms) */
  faintRespawnDelayMs: 1500,
  /** 리스폰 직후 무적 유지 시간 (ms) */
  respawnInvincibleMs: 2000,
  /** 공격받은 몬스터가 플레이어를 추격하는 최대 거리 (px) */
  monsterAggroMaxDistance: 350,
  /** 어그로 최대 유지 시간 (ms) */
  monsterAggroDurationMs: 10_000,
  /** 일반 근접 몬스터의 플레이어 공격 사거리 (px) */
  monsterPlayerAttackRange: 44,
  /** 창병 몬스터의 플레이어 공격 사거리 (px) */
  monsterLancerPlayerAttackRange: 56,
  /** 보스 몬스터의 플레이어 공격 사거리 (px) */
  monsterBossPlayerAttackRange: 64,
  /** 몬스터가 사거리에 처음 진입했을 때 첫 공격까지의 반응 유예 시간 (ms) */
  monsterFirstStrikeDelayMs: 400,
  /** 몬스터의 플레이어/건물 공격 쿨다운 (ms) */
  monsterAttackCooldownMs: 1100,
  /** 메인 마을 리스폰 좌표 */
  mainVillageSpawn: { x: 320, y: 430 },
} as const;

