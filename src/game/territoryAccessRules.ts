import { TERRITORY_BUILD_SLOTS } from '../data/buildings';
import { Island } from '../types/game';
import { getIslandOrigin } from './world/territoryGrid';

export const MAIN_VILLAGE_ID = 0;

export interface TerritoryAccessResult {
  allowed: boolean;
  reason?: string;
}

export interface TerritoryWallBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const WALL_SLOTS = TERRITORY_BUILD_SLOTS.filter((slot) => slot.role === 'wall');
const REL_WALL_MIN_X = Math.min(...WALL_SLOTS.map((slot) => slot.relX));
const REL_WALL_MAX_X = Math.max(...WALL_SLOTS.map((slot) => slot.relX));
const REL_WALL_MIN_Y = Math.min(...WALL_SLOTS.map((slot) => slot.relY));
const REL_WALL_MAX_Y = Math.max(...WALL_SLOTS.map((slot) => slot.relY));

/**
 * 영지 외곽 목책/성벽 슬롯(TERRITORY_BUILD_SLOTS) 기준 월드 좌표 사각 경계 반환
 */
export function getTerritoryWallBounds(gridX: number, gridY: number): TerritoryWallBounds {
  const origin = getIslandOrigin(gridX, gridY);
  return {
    minX: origin.x + REL_WALL_MIN_X,
    maxX: origin.x + REL_WALL_MAX_X,
    minY: origin.y + REL_WALL_MIN_Y,
    maxY: origin.y + REL_WALL_MAX_Y,
  };
}

/**
 * 월드 좌표(x, y)가 해당 영지의 목책/성벽 울타리 내부에 있는지 판별 (순수 함수)
 */
export function isPointInsideTerritoryWalls(
  x: number,
  y: number,
  territory: Pick<Island, 'gridX' | 'gridY'>
): boolean {
  const bounds = getTerritoryWallBounds(territory.gridX, territory.gridY);
  return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
}

/**
 * 월드 좌표(x, y)를 둘러싼 영지(목책/성벽 내부)를 조회 (순수 함수)
 */
export function findTerritoryInsideWalls(
  x: number,
  y: number,
  territories: ReadonlyArray<Island>
): Island | undefined {
  return territories.find((t) => isPointInsideTerritoryWalls(x, y, t));
}

/**
 * 메인 마을(#0) 여부 확인
 */
export function isMainVillage(territoryId: number): boolean {
  return territoryId === MAIN_VILLAGE_ID;
}

/**
 * 특정 플레이어가 해당 영지를 점령(소유)하고 있는지 확인
 */
export function isTerritoryOwnedByPlayer(
  territory: Island | undefined,
  playerId: string
): boolean {
  if (!territory || !territory.unlocked) return false;
  return Boolean(territory.ownerId && territory.ownerId === playerId);
}

/**
 * 플레이어가 현재 점령 중인 개인 영지(메인 마을 제외) 조회
 */
export function getPlayerOwnedTerritory(
  islands: Island[],
  playerId: string
): Island | undefined {
  return islands.find(
    (isl) => isl.id !== MAIN_VILLAGE_ID && isl.unlocked && isl.ownerId === playerId
  );
}

/**
 * 건설/마을 승급/타워 배치/코어 수리 권한 및 플레이어 현재 위치 검증 (순수 함수)
 * - 메인 마을(#0) 또는 본인이 점령한 마을 영역에서만 허용
 * - 플레이어가 현재 해당 마을 영역 안에 위치해 있을 때만 허용
 */
export function canBuildInTerritory(
  territory: Island | undefined,
  playerId: string,
  playerStandingTerritoryId: number | null
): TerritoryAccessResult {
  if (!territory || !territory.unlocked) {
    return {
      allowed: false,
      reason: '미점령 영지에서는 건설할 수 없습니다.',
    };
  }

  const hasOwnership =
    isMainVillage(territory.id) || isTerritoryOwnedByPlayer(territory, playerId);
  if (!hasOwnership) {
    return {
      allowed: false,
      reason: '메인 마을과 본인이 점령한 마을 영역 안에서만 건설할 수 있습니다.',
    };
  }

  if (playerStandingTerritoryId !== territory.id) {
    return {
      allowed: false,
      reason: '현재 플레이어가 위치한 마을 영역에서만 건설할 수 있습니다.',
    };
  }

  return { allowed: true };
}

/**
 * 새 영지 점령 가능 여부 검증 (플레이어당 1곳만 점령 가능)
 */
export function canClaimTerritory(
  islands: Island[],
  targetTerritory: Island | undefined,
  playerId: string
): TerritoryAccessResult {
  if (!targetTerritory) {
    return { allowed: false, reason: '존재하지 않는 영지입니다.' };
  }
  if (targetTerritory.unlocked) {
    return { allowed: false, reason: '이미 점령된 영지입니다.' };
  }

  const existingOwned = getPlayerOwnedTerritory(islands, playerId);
  if (existingOwned) {
    return {
      allowed: false,
      reason: `이미 점령한 영지(#${existingOwned.id} ${existingOwned.name})가 있습니다. 1인당 1곳만 점령할 수 있습니다.`,
    };
  }

  return { allowed: true };
}
