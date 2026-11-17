import { FIELD_MONSTER_CONFIG, FIELD_PACK_TEMPLATES } from '../../data/fieldMonsters';
import { Island } from '../../types/game';
import { FieldMonsterPackTemplate } from '../../types/hunting';
import { getTerritoryCorePos } from '../constants';
import { WorldBounds } from '../worldBounds';
import {
  getTerrainCellAtWorld,
  TerritoryGridRef,
  WorldTerrainMap,
} from '../world/MapTerrainGenerator';
import { isInsideAnyTerritory } from '../world/ResourcePlacementRules';

export interface FieldPackSpawnPoint {
  x: number;
  y: number;
  ring: 1 | 2 | 3 | 4;
}

/**
 * 중심 마을(0,0) 코어로부터의 유클리드 거리 기반 야생 필드 위험 등급(1~4링) 산정 (순수 함수)
 */
export function computeFieldDistanceRing(wx: number, wy: number): 1 | 2 | 3 | 4 {
  const center = getTerritoryCorePos(0, 0);
  const dist = Math.hypot(wx - center.x, wy - center.y);
  if (dist < 2200) return 1;
  if (dist < 3800) return 2;
  if (dist < 5300) return 3;
  return 4;
}

/**
 * 거리 링(1~4)에 대응하는 야생 몬스터 무리 템플릿 선택
 */
export function pickFieldPackTemplate(ring: 1 | 2 | 3 | 4): FieldMonsterPackTemplate {
  const pool = FIELD_PACK_TEMPLATES[ring];
  return pool[Math.floor(Math.random() * pool.length)] ?? FIELD_PACK_TEMPLATES[1][0];
}

/**
 * 야생 필드 몬스터 무리 스폰 가능 좌표 판별 (물·도로·다리·영지 내부·중심마을 안전반경 제외)
 */
export function isValidFieldMonsterSpot(
  wx: number,
  wy: number,
  terrain: WorldTerrainMap,
  territories: ReadonlyArray<TerritoryGridRef>,
  bounds: WorldBounds
): boolean {
  const edgePad = 140;
  if (
    wx < bounds.min + edgePad ||
    wx > bounds.max - edgePad ||
    wy < bounds.min + edgePad ||
    wy > bounds.max - edgePad
  ) {
    return false;
  }

  const center = getTerritoryCorePos(0, 0);
  if (Math.hypot(wx - center.x, wy - center.y) < FIELD_MONSTER_CONFIG.centerSafeRadiusPx) {
    return false;
  }

  if (
    isInsideAnyTerritory(
      wx,
      wy,
      territories,
      FIELD_MONSTER_CONFIG.territoryExclusionMarginPx
    )
  ) {
    return false;
  }

  const probeOffsets = [
    [0, 0],
    [55, 0],
    [-55, 0],
    [0, 55],
    [0, -55],
  ];
  for (const [dx, dy] of probeOffsets) {
    const cell = getTerrainCellAtWorld(terrain, wx + dx, wy + dy);
    if (!cell || cell.biome === 'water' || cell.isVillagePlot || cell.isBridge) {
      return false;
    }
    if (dx === 0 && dy === 0 && cell.isRoad) {
      return false;
    }
  }

  return true;
}

/**
 * 기존 스폰 지점과 최소 간격을 유지하며 목표 개수만큼 야생 필드 무리 좌표를 추첨합니다.
 */
export function pickWildernessFieldSpawnSpots(params: {
  desiredCount: number;
  existingSpots: ReadonlyArray<{ x: number; y: number }>;
  terrain: WorldTerrainMap;
  islands: ReadonlyArray<Island>;
  bounds: WorldBounds;
}): FieldPackSpawnPoint[] {
  const { desiredCount, existingSpots, terrain, islands, bounds } = params;
  const results: FieldPackSpawnPoint[] = [];
  if (desiredCount <= 0) return results;

  const minSpacing = FIELD_MONSTER_CONFIG.minPackSpacingPx;
  const span = bounds.max - bounds.min - 280;
  const maxAttempts = desiredCount * 36;

  for (let attempt = 0; attempt < maxAttempts && results.length < desiredCount; attempt++) {
    const wx = bounds.min + 140 + Math.random() * span;
    const wy = bounds.min + 140 + Math.random() * span;

    if (!isValidFieldMonsterSpot(wx, wy, terrain, islands, bounds)) continue;

    let tooClose = false;
    for (const spot of existingSpots) {
      if (Math.hypot(wx - spot.x, wy - spot.y) < minSpacing) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    for (const picked of results) {
      if (Math.hypot(wx - picked.x, wy - picked.y) < minSpacing) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    results.push({
      x: Math.round(wx),
      y: Math.round(wy),
      ring: computeFieldDistanceRing(wx, wy),
    });
  }

  return results;
}
