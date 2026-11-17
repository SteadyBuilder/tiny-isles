import { SANCTUARY_HEAL_CONFIG } from '../../data/potions';
import { ConstructedBuilding } from '../../types/game';

export interface SanctuaryHealCheckResult {
  inRange: boolean;
  healAmount: number;
  sanctuary: ConstructedBuilding | null;
}

/**
 * 플레이어가 파괴되지 않은 신성 치유 성소(special_sanctuary) 치유 반경 내에 있는지 판정하고
 * 회복량을 계산하는 순수 함수
 */
export function checkSanctuaryPlayerHeal(
  px: number,
  py: number,
  maxHp: number,
  buildings: ReadonlyArray<ConstructedBuilding>,
  radiusPx: number = SANCTUARY_HEAL_CONFIG.healRadiusPx
): SanctuaryHealCheckResult {
  let nearest: ConstructedBuilding | null = null;
  let bestDist = Infinity;

  for (const cb of buildings) {
    if (cb.type !== 'special_sanctuary' || cb.hp <= 0) continue;
    const dist = Math.hypot(px - cb.x, py - cb.y);
    if (dist <= radiusPx && dist < bestDist) {
      bestDist = dist;
      nearest = cb;
    }
  }

  if (!nearest) {
    return { inRange: false, healAmount: 0, sanctuary: null };
  }

  const healAmount = Math.max(
    SANCTUARY_HEAL_CONFIG.flatHealAmount,
    SANCTUARY_HEAL_CONFIG.flatHealAmount +
      Math.round(maxHp * SANCTUARY_HEAL_CONFIG.maxHpHealRatio)
  );

  return {
    inRange: true,
    healAmount,
    sanctuary: nearest,
  };
}
