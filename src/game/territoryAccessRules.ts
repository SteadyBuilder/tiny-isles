import { Island } from '../types/game';

export const MAIN_VILLAGE_ID = 0;

export interface TerritoryAccessResult {
  allowed: boolean;
  reason?: string;
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
