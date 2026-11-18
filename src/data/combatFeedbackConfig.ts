import { PlayerClassId } from '../types/hunting';

/**
 * 전투 타격감, 카메라 진동, 몬스터 HP 트레일, 피격 점멸, 순간 대시 및 스킬 이펙트 밸런스 데이터
 * [AI Guideline]: 수치·색상·강도 조정은 로직 파일이 아닌 이 데이터 파일에서만 수행합니다.
 */
export const COMBAT_CAMERA_SHAKE_CONFIG = {
  /** 일반 공격 적중 시 미세 화면 흔들림 */
  basicHit: {
    durationMs: 75,
    intensity: 0.0022,
    cooldownMs: 70,
  },
  /** 치명타 적중 시 약간 더 강한 흔들림 */
  critHit: {
    durationMs: 110,
    intensity: 0.0038,
    cooldownMs: 70,
  },
  /** 액티브 스킬 공격 성공 시 강한 화면 진동 */
  skillHit: {
    durationMs: 260,
    intensity: 0.0095,
    cooldownMs: 120,
  },
  /** 플레이어 피격 시 화면 진동 */
  playerDamaged: {
    durationMs: 210,
    intensity: 0.0075,
    cooldownMs: 120,
  },
} as const;

export const MONSTER_HIT_FEEDBACK_CONFIG = {
  /** 피격 순간 몬스터 흰색 플래시 지속 시간 (ms) */
  whiteFlashDurationMs: 75,
  /** 피격 순간 몬스터 스케일 펀치 비율 */
  scalePunchFactor: 1.14,
  /** 피격 순간 미세 넉백 거리 (px) */
  knockbackPx: 7,
  /** 몹 HP 게이지 지연 감소 트레일 속도 (초당 비율) */
  hpTrailDrainPerSec: 1.35,
  /** HP 게이지 감소 시 플래시 지속 시간 (ms) */
  hpBarFlashDurationMs: 220,
  /** HP 게이지 피격 바운스 높이 (px) */
  hpBarPopOffsetY: 3.5,
} as const;

export const PLAYER_DAMAGED_OVERLAY_CONFIG = {
  /** 전체화면 붉은 점멸 기본 지속 시간 (ms) */
  flashDurationMs: 360,
  /** 연속 피격/치명적 피해 기준 비율 */
  heavyDamageRatioThreshold: 0.22,
} as const;

export const WAVE_INVASION_OVERLAY_CONFIG = {
  /** 일반 웨이브 침공 시 1회 점멸(펄스) 지속 시간 (ms) */
  regularPulseDurationMs: 650,
  /** 일반 웨이브 점멸 반복 횟수 */
  regularPulseCount: 2,
  /** 일반 웨이브 붉은 비네트 최대 투명도 */
  regularMaxAlpha: 0.55,
  /** 보스/던전 웨이브 침공 시 1회 점멸(펄스) 지속 시간 (ms) */
  bossPulseDurationMs: 700,
  /** 보스/던전 웨이브 점멸 반복 횟수 */
  bossPulseCount: 3,
  /** 보스/던전 웨이브 붉은 비네트 최대 투명도 */
  bossMaxAlpha: 0.72,
} as const;

export const PLAYER_DASH_CONFIG = {
  /** 대시 지속 시간 (ms) */
  durationMs: 185,
  /** 대시 중 무적(i-frame) 유지 시간 (ms) */
  invincibleMs: 250,
  /** 대시 재사용 대기시간 (ms) */
  cooldownMs: 2500,
  /** 기본 이동 속도 대비 대시 속도 배율 */
  speedMultiplier: 3.35,
  /** 최소 보장 대시 속도 (px/s) */
  minDashSpeedPx: 780,
  /** 대시 중 잔상 생성 간격 (ms) */
  afterimageIntervalMs: 38,
} as const;

export const SKILL_FX_STYLE_CONFIG: Record<
  PlayerClassId,
  {
    primaryHex: number;
    secondaryHex: number;
    accentHex: number;
    chargeDurationMs: number;
    lancerDashDistancePx: number;
  }
> = {
  pawn: {
    primaryHex: 0xfde047,
    secondaryHex: 0xf97316,
    accentHex: 0xffffff,
    chargeDurationMs: 120,
    lancerDashDistancePx: 0,
  },
  guardian: {
    primaryHex: 0x38bdf8,
    secondaryHex: 0xfbbf24,
    accentHex: 0xe0f2fe,
    chargeDurationMs: 150,
    lancerDashDistancePx: 0,
  },
  lancer: {
    primaryHex: 0x22d3ee,
    secondaryHex: 0x3b82f6,
    accentHex: 0xfef08a,
    chargeDurationMs: 110,
    lancerDashDistancePx: 165,
  },
  ranger: {
    primaryHex: 0x34d399,
    secondaryHex: 0x38bdf8,
    accentHex: 0xecfdf5,
    chargeDurationMs: 140,
    lancerDashDistancePx: 0,
  },
  archmage: {
    primaryHex: 0xc084fc,
    secondaryHex: 0xf97316,
    accentHex: 0xfef08a,
    chargeDurationMs: 260,
    lancerDashDistancePx: 0,
  },
};
