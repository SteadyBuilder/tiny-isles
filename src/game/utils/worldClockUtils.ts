import {
  ONLINE_SCALING_PROFILES,
  WORLD_CLOCK_CONFIG,
} from '../../data/worldRules';
import { DynamicScalingProfile } from '../../types/game';

/**
 * UTC 글로벌 시계 기준으로 다음 웨이브까지 남은 시간(초)을 계산하는 순수 함수.
 * 예: regularWaveIntervalSec=1800 -> 매시 :00, :30 정각 기준 잔여 초 반환
 */
export function getGlobalClockRemainingSec(
  nowMs: number,
  intervalSec: number = WORLD_CLOCK_CONFIG.regularWaveIntervalSec
): number {
  const safeInterval = Math.max(1, intervalSec);
  const epochSec = Math.floor(nowMs / 1000);
  const elapsedInCycle = epochSec % safeInterval;
  const remaining = safeInterval - elapsedInCycle;
  return remaining === 0 ? safeInterval : remaining;
}

/**
 * UTC 시계 기준 현재까지 경과한 웨이브 슬롯 인덱스를 반환합니다.
 */
export function getGlobalClockSlotIndex(
  nowMs: number,
  intervalSec: number
): number {
  const safeInterval = Math.max(1, intervalSec);
  return Math.floor(Math.floor(nowMs / 1000) / safeInterval);
}

/**
 * 두 시각 사이에 지난 UTC 웨이브 경계 횟수를 계산합니다.
 */
export function countCrossedWaveBoundaries(
  lastActiveMs: number,
  nowMs: number,
  intervalSec: number,
  maxWaves: number
): number {
  if (nowMs <= lastActiveMs) return 0;
  const startSlot = getGlobalClockSlotIndex(lastActiveMs, intervalSec);
  const endSlot = getGlobalClockSlotIndex(nowMs, intervalSec);
  const rawCount = Math.max(0, endSlot - startSlot);
  return Math.min(maxWaves, rawCount);
}

/**
 * 현재 접속자 수(onlineCount)에 대응하는 동적 웨이브 난이도 스케일링 프로필 반환
 */
export function getDynamicScalingProfile(onlineCount: number): DynamicScalingProfile {
  const safeCount = Math.max(1, Math.floor(onlineCount));
  const found = ONLINE_SCALING_PROFILES.find(
    (p) => safeCount >= p.minPlayers && safeCount <= p.maxPlayers
  );
  return found ?? ONLINE_SCALING_PROFILES[ONLINE_SCALING_PROFILES.length - 1];
}
