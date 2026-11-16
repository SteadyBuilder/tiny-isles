import { ONLINE_SCALING_PROFILES } from '../../data/worldRules';
import { DynamicScalingProfile } from '../../types/game';

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
