import { ConstructedBuilding } from '../../types/game';

/** 왕국 전직소(job_hall) 상호작용 및 전직 허용 반경 (px) */
export const JOB_HALL_INTERACT_RADIUS_PX = 155;

export interface JobHallProximityStatus {
  hasBuilt: boolean;
  isNear: boolean;
  nearestBuilding: ConstructedBuilding | null;
}

/**
 * 플레이어가 건설된 왕국 전직소(job_hall) 앞에 충분히 가까이 있는지 판정하는 순수 함수
 */
export function checkJobHallProximity(
  px: number,
  py: number,
  buildings: ReadonlyArray<ConstructedBuilding>,
  radiusPx: number = JOB_HALL_INTERACT_RADIUS_PX
): JobHallProximityStatus {
  let hasBuilt = false;
  let nearestBuilding: ConstructedBuilding | null = null;
  let bestDist = Infinity;

  for (const cb of buildings) {
    if (cb.type !== 'job_hall' || cb.hp <= 0) continue;
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
