import { ConstructedBuilding, Island } from '../types/game';
import {
  TERRITORY_CENTER_X,
  TERRITORY_CORE_REL_Y,
  TERRITORY_PX,
  getIslandOrigin,
} from './world/territoryGrid';
import {
  generateTerritoryBuildings,
  getBuildingCollisionBox,
} from './world/TerritoryContentGenerator';

/**
 * 방어 타워 외곽 자유 배치 규칙 상수 (1280x1280 영지 기준)
 */
export const OUTER_TOWER_BAND_CONFIG = {
  /** 영지 외곽선으로부터 최소 여백 (성벽 라인 52px 포함) */
  outerMargin: 44,
  /** 외곽 배치 가능 밴드 안쪽 경계 (44 ~ 205px 구간) */
  innerMargin: 205,
  /** 성문 및 십자 도로 통로 보호 반경 */
  gateExclusionHalfWidth: 78,
  /** 다른 타워/건물과의 최소 이격 거리 (px) */
  minBuildingSpacing: 72,
} as const;

export interface TowerPlacementValidation {
  valid: boolean;
  reason?: string;
  relX: number;
  relY: number;
  worldX: number;
  worldY: number;
}

export interface BandRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 영지 외곽 배치 가능 영역 사각형 목록 반환 (렌더링 가이드용, 순수 함수)
 */
export function getOuterPerimeterBandRects(originX: number, originY: number): BandRect[] {
  const { outerMargin, innerMargin } = OUTER_TOWER_BAND_CONFIG;
  const bandW = innerMargin - outerMargin;
  const fullSpan = TERRITORY_PX - outerMargin * 2;
  const sideH = TERRITORY_PX - innerMargin * 2;

  return [
    // 북쪽 외곽 밴드
    { x: originX + outerMargin, y: originY + outerMargin, w: fullSpan, h: bandW },
    // 남쪽 외곽 밴드
    { x: originX + outerMargin, y: originY + TERRITORY_PX - innerMargin, w: fullSpan, h: bandW },
    // 서쪽 외곽 밴드 (북/남과 겹치지 않는 중간 구간)
    { x: originX + outerMargin, y: originY + innerMargin, w: bandW, h: sideH },
    // 동쪽 외곽 밴드
    { x: originX + TERRITORY_PX - innerMargin, y: originY + innerMargin, w: bandW, h: sideH },
  ];
}

/**
 * 선택한 월드 좌표가 해당 영지 외곽에 방어 타워를 배치할 수 있는 위치인지 검증 (순수 함수)
 */
export function validateOuterTowerPosition(
  worldX: number,
  worldY: number,
  territory: Island,
  constructedBuildings: ConstructedBuilding[]
): TowerPlacementValidation {
  const origin = getIslandOrigin(territory.gridX, territory.gridY);
  const relX = Math.round(worldX - origin.x);
  const relY = Math.round(worldY - origin.y);
  const { outerMargin, innerMargin, gateExclusionHalfWidth, minBuildingSpacing } =
    OUTER_TOWER_BAND_CONFIG;

  // 1. 영지 외곽 경계 내부인지 확인
  const insideBounds =
    relX >= outerMargin &&
    relX <= TERRITORY_PX - outerMargin &&
    relY >= outerMargin &&
    relY <= TERRITORY_PX - outerMargin;

  if (!insideBounds) {
    return {
      valid: false,
      reason: '영지 외곽 경계 안쪽을 선택하세요.',
      relX,
      relY,
      worldX: origin.x + relX,
      worldY: origin.y + relY,
    };
  }

  // 2. 외곽 밴드(북/남/동/서 둘레) 내부인지 확인
  const inOuterBand =
    relX <= innerMargin ||
    relX >= TERRITORY_PX - innerMargin ||
    relY <= innerMargin ||
    relY >= TERRITORY_PX - innerMargin;

  if (!inOuterBand) {
    return {
      valid: false,
      reason: '마을 외곽(초록 영역)에만 방어 타워를 배치할 수 있습니다.',
      relX,
      relY,
      worldX: origin.x + relX,
      worldY: origin.y + relY,
    };
  }

  // 3. 성문 및 십자 도로 통로 침범 여부 확인
  const blocksNorthSouthGate =
    Math.abs(relX - TERRITORY_CENTER_X) < gateExclusionHalfWidth &&
    (relY <= innerMargin + 20 || relY >= TERRITORY_PX - innerMargin - 20);
  const blocksEastWestGate =
    Math.abs(relY - TERRITORY_CORE_REL_Y) < gateExclusionHalfWidth &&
    (relX <= innerMargin + 20 || relX >= TERRITORY_PX - innerMargin - 20);

  if (blocksNorthSouthGate || blocksEastWestGate) {
    return {
      valid: false,
      reason: '성문과 도로 통로에는 배치할 수 없습니다.',
      relX,
      relY,
      worldX: origin.x + relX,
      worldY: origin.y + relY,
    };
  }

  // 4. 기존 건설 건물(성벽 제외)과의 중첩 여부 확인
  for (const cb of constructedBuildings) {
    if (cb.territoryId !== territory.id || cb.category === 'wall') continue;
    if (Math.hypot(worldX - cb.x, worldY - cb.y) < minBuildingSpacing) {
      return {
        valid: false,
        reason: '다른 건물과 너무 가깝습니다.',
        relX,
        relY,
        worldX: origin.x + relX,
        worldY: origin.y + relY,
      };
    }
  }

  // 5. 기본 마을 건물과의 중첩 여부 확인
  const staticBuildings = generateTerritoryBuildings(
    territory.id,
    territory.gridX,
    territory.gridY,
    territory.villageTier
  );
  for (const b of staticBuildings) {
    const box = getBuildingCollisionBox(b);
    const pad = 28;
    if (
      worldX >= box.x - pad &&
      worldX <= box.x + box.w + pad &&
      worldY >= box.y - pad &&
      worldY <= box.y + box.h + pad
    ) {
      return {
        valid: false,
        reason: '기존 마을 건물과 겹칩니다.',
        relX,
        relY,
        worldX: origin.x + relX,
        worldY: origin.y + relY,
      };
    }
  }

  return {
    valid: true,
    relX,
    relY,
    worldX: origin.x + relX,
    worldY: origin.y + relY,
  };
}

export interface WallSlotPlacementValidation extends TowerPlacementValidation {
  slotIndex: number;
}

/**
 * 선택한 월드 좌표에서 가장 가까운 성벽 방어선(북/남/동/서 슬롯 0~3) 검증 (순수 함수)
 */
export function validateWallSlotPosition(
  worldX: number,
  worldY: number,
  territory: Island,
  constructedBuildings: ConstructedBuilding[],
  wallSlots: ReadonlyArray<{ relX: number; relY: number; role: 'wall' | 'inner' }>
): WallSlotPlacementValidation {
  const origin = getIslandOrigin(territory.gridX, territory.gridY);
  let bestSlotIndex = 0;
  let bestDist = Infinity;

  for (let i = 0; i < wallSlots.length; i++) {
    const s = wallSlots[i];
    if (s.role !== 'wall') continue;
    const sx = origin.x + s.relX;
    const sy = origin.y + s.relY;
    const d = Math.hypot(worldX - sx, worldY - sy);
    if (d < bestDist) {
      bestDist = d;
      bestSlotIndex = i;
    }
  }

  const chosen = wallSlots[bestSlotIndex];
  const snapX = origin.x + chosen.relX;
  const snapY = origin.y + chosen.relY;
  const occupied = constructedBuildings.some(
    (b) => b.territoryId === territory.id && b.slotIndex === bestSlotIndex
  );

  return {
    valid: !occupied,
    reason: occupied ? '이미 성벽이 건설된 방어선입니다.' : undefined,
    slotIndex: bestSlotIndex,
    relX: chosen.relX,
    relY: chosen.relY,
    worldX: snapX,
    worldY: snapY,
  };
}

/**
 * 기본/특수 건물의 영지 내부 자유 배치 위치 검증 (순수 함수)
 */
export function validateInnerBuildingPosition(
  worldX: number,
  worldY: number,
  territory: Island,
  constructedBuildings: ConstructedBuilding[]
): TowerPlacementValidation {
  const origin = getIslandOrigin(territory.gridX, territory.gridY);
  const relX = Math.round(worldX - origin.x);
  const relY = Math.round(worldY - origin.y);
  const innerPad = 110;
  const minSpacing = OUTER_TOWER_BAND_CONFIG.minBuildingSpacing;

  const insideInner =
    relX >= innerPad &&
    relX <= TERRITORY_PX - innerPad &&
    relY >= innerPad &&
    relY <= TERRITORY_PX - innerPad;

  if (!insideInner) {
    return {
      valid: false,
      reason: '영지 내부 구역(초록 영역) 안쪽을 선택하세요.',
      relX,
      relY,
      worldX: origin.x + relX,
      worldY: origin.y + relY,
    };
  }

  // 중앙 십자 도로 통로 보호
  if (
    Math.abs(relX - TERRITORY_CENTER_X) < 58 ||
    Math.abs(relY - TERRITORY_CORE_REL_Y) < 58
  ) {
    return {
      valid: false,
      reason: '중앙 도로 통로에는 배치할 수 없습니다.',
      relX,
      relY,
      worldX: origin.x + relX,
      worldY: origin.y + relY,
    };
  }

  for (const cb of constructedBuildings) {
    if (cb.territoryId !== territory.id || cb.category === 'wall') continue;
    if (Math.hypot(worldX - cb.x, worldY - cb.y) < minSpacing) {
      return {
        valid: false,
        reason: '다른 건물과 너무 가깝습니다.',
        relX,
        relY,
        worldX: origin.x + relX,
        worldY: origin.y + relY,
      };
    }
  }

  const staticBuildings = generateTerritoryBuildings(
    territory.id,
    territory.gridX,
    territory.gridY,
    territory.villageTier
  );
  for (const b of staticBuildings) {
    const box = getBuildingCollisionBox(b);
    const pad = 36;
    if (
      worldX >= box.x - pad &&
      worldX <= box.x + box.w + pad &&
      worldY >= box.y - pad &&
      worldY <= box.y + box.h + pad
    ) {
      return {
        valid: false,
        reason: '기존 마을 건물과 겹칩니다.',
        relX,
        relY,
        worldX: origin.x + relX,
        worldY: origin.y + relY,
      };
    }
  }

  return {
    valid: true,
    relX,
    relY,
    worldX: origin.x + relX,
    worldY: origin.y + relY,
  };
}

