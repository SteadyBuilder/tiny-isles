import { MERCENARY_GUILD_CONFIG } from '../../data/mercenaries';
import { ConstructedBuilding } from '../../types/game';

export interface MercenaryGuildProximityStatus {
  hasBuilt: boolean;
  isNear: boolean;
  nearestBuilding: ConstructedBuilding | null;
}

/**
 * 플레이어가 건설된 용병 길드(mercenary_guild) 앞에 충분히 가까이 있는지 판정하는 순수 함수
 */
export function checkMercenaryGuildProximity(
  px: number,
  py: number,
  buildings: ReadonlyArray<ConstructedBuilding>,
  radiusPx: number = MERCENARY_GUILD_CONFIG.interactionRadiusPx
): MercenaryGuildProximityStatus {
  let hasBuilt = false;
  let nearestBuilding: ConstructedBuilding | null = null;
  let bestDist = Infinity;

  for (const cb of buildings) {
    if (cb.type !== 'mercenary_guild' || cb.hp <= 0) continue;
    hasBuilt = true;
    const dist = Math.hypot(px - cb.x, py - cb.y);
    if (dist <= radiusPx && dist < bestDist) {
      bestDist = dist;
      nearestBuilding = cb;
    }
  }

  return {
    hasBuilt,
    isNear: nearestBuilding !== null,
    nearestBuilding,
  };
}
