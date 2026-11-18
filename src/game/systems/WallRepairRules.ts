import { ConstructedBuilding, ConstructableType, Inventory } from '../../types/game';
import { getMonsterWallCollisionBox, nearestPointOnCollisionBox } from '../wallCollisionGeometry';

export interface WallRepairCost {
  wood: number;
  stone: number;
  gold: number;
  healAmount: number;
}

export interface WallRepairCheckResult {
  canRepair: boolean;
  reason?: string;
  cost?: WallRepairCost;
  nextHp?: number;
}

/**
 * 목책(wood_wall) 및 석조 성벽(stone_wall) 수리 비용 및 회복량 데이터 설정
 */
export const WALL_REPAIR_CONFIG: Record<'wood_wall' | 'stone_wall', WallRepairCost> = {
  wood_wall: {
    wood: 2,
    stone: 1,
    gold: 0,
    healAmount: 100,
  },
  stone_wall: {
    wood: 2,
    stone: 4,
    gold: 0,
    healAmount: 150,
  },
};

/**
 * 건물이 목책 또는 성벽인지 판별하는 순수 함수
 */
export function isWallType(type: ConstructableType | string): type is 'wood_wall' | 'stone_wall' {
  return type === 'wood_wall' || type === 'stone_wall';
}

export function isWallBuilding(building: ConstructedBuilding): boolean {
  return building.category === 'wall' || isWallType(building.type);
}

/**
 * 특정 건물 타입의 수리 설정 조회
 */
export function getWallRepairConfig(type: ConstructableType | string): WallRepairCost | null {
  if (isWallType(type)) {
    return WALL_REPAIR_CONFIG[type];
  }
  return null;
}

/**
 * 목책 또는 성벽 수리 가능 여부 및 필요 자원 검사 (순수 함수)
 */
export function checkWallRepair(
  building: ConstructedBuilding,
  inventory: Inventory
): WallRepairCheckResult {
  if (!isWallBuilding(building)) {
    return {
      canRepair: false,
      reason: '목책 또는 성벽만 수리할 수 있습니다.',
    };
  }

  const cost = getWallRepairConfig(building.type);
  if (!cost) {
    return {
      canRepair: false,
      reason: '수리 설정이 정의되지 않은 방벽입니다.',
    };
  }

  if (building.hp >= building.maxHp) {
    return {
      canRepair: false,
      reason: `${building.name}의 내구도가 이미 최대치입니다.`,
      cost,
    };
  }

  const hasEnoughWood = inventory.wood >= cost.wood;
  const hasEnoughStone = inventory.stone >= cost.stone;
  const hasEnoughGold = inventory.gold >= cost.gold;

  if (!hasEnoughWood || !hasEnoughStone || !hasEnoughGold) {
    const goldText = cost.gold > 0 ? ` 🪙${cost.gold}` : '';
    return {
      canRepair: false,
      reason: `수리 자원 부족 (필요: 🪵${cost.wood} 🪨${cost.stone}${goldText})`,
      cost,
    };
  }

  const nextHp = Math.min(building.maxHp, building.hp + cost.healAmount);

  return {
    canRepair: true,
    cost,
    nextHp,
  };
}

/**
 * 플레이어 위치(px, py) 기준으로 가장 가까운 손상된 방벽 탐색 (순수 함수)
 */
export function findNearestDamagedWall(
  px: number,
  py: number,
  buildings: ConstructedBuilding[],
  maxDistance = 90
): { building: ConstructedBuilding; dist: number; hitX: number; hitY: number } | null {
  let nearest: { building: ConstructedBuilding; dist: number; hitX: number; hitY: number } | null =
    null;
  let minDist = maxDistance;

  for (const b of buildings) {
    if (!isWallBuilding(b) || b.hp >= b.maxHp) continue;

    const solidBox = getMonsterWallCollisionBox(b);
    if (!solidBox) {
      const d = Math.hypot(px - b.x, py - b.y);
      if (d < minDist) {
        minDist = d;
        nearest = { building: b, dist: d, hitX: b.x, hitY: b.y };
      }
      continue;
    }

    const hit = nearestPointOnCollisionBox(px, py, solidBox);
    if (hit.dist < minDist) {
      minDist = hit.dist;
      nearest = {
        building: b,
        dist: hit.dist,
        hitX: hit.x,
        hitY: hit.y,
      };
    }
  }

  return nearest;
}
