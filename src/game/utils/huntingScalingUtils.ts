import { ELITE_SPAWN_CHANCE_BY_DIFFICULTY } from '../../data/elites';
import { HUNTING_AI_CONFIG } from '../../data/monsterCamps';
import { HuntingScalingFactors } from '../../types/hunting';
import { MissionDifficultyConfig } from '../../types/room';
import { getDynamicScalingProfile } from './worldClockUtils';

/**
 * 사냥 특화 모드(부락·야생 필드·던전) 공통 난이도 + 인원수(onlineCount) 스케일링 배율 계산 순수 함수
 */
export function computeHuntingScaling(
  difficulty: MissionDifficultyConfig | undefined,
  onlineCount: number
): HuntingScalingFactors {
  const diffId = difficulty?.id ?? 'normal';
  const diffHpMult = difficulty?.monsterHpMultiplier ?? 1;
  const diffAtkMult = difficulty?.monsterAttackMultiplier ?? 1;
  const diffCountMult = HUNTING_AI_CONFIG.campCountMultiplierByDifficulty[diffId] ?? 1;
  const baseEliteChance = ELITE_SPAWN_CHANCE_BY_DIFFICULTY[diffId] ?? 0.2;

  const onlineProfile = getDynamicScalingProfile(onlineCount);
  const coOpEliteBonus = Math.min(0.18, Math.max(0, onlineCount - 1) * 0.05);

  return {
    hpMult: diffHpMult * onlineProfile.hpMultiplier,
    atkMult: diffAtkMult * onlineProfile.attackMultiplier,
    countMult: diffCountMult * onlineProfile.countMultiplier,
    eliteChance: Math.min(0.65, baseEliteChance + coOpEliteBonus),
    scalingLabel: onlineProfile.label,
  };
}
