import {
  FIELD_MONSTER_CONFIG,
  FIELD_NEAR_VILLAGE_PACK_TEMPLATES,
  FIELD_PACK_TEMPLATES,
} from '../../data/fieldMonsters';
import { computeCampRing } from '../../data/monsterCamps';
import { Island } from '../../types/game';
import { FieldMonsterPackTemplate, FieldSpawnZone } from '../../types/hunting';
import { getTerritoryCorePos, TERRITORY_PX } from '../constants';
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
  zone: FieldSpawnZone;
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
 * 존(Zone) 및 링(1~4)에 대응하는 야생 몬스터 무리 템플릿 선택
 */
export function pickFieldPackTemplateForZone(
  zone: FieldSpawnZone,
  ring: 1 | 2 | 3 | 4
): FieldMonsterPackTemplate {
  if (zone === 'near_village') {
    const idx = Math.floor(Math.random() * FIELD_NEAR_VILLAGE_PACK_TEMPLATES.length);
    return FIELD_NEAR_VILLAGE_PACK_TEMPLATES[idx] ?? FIELD_NEAR_VILLAGE_PACK_TEMPLATES[0];
  }

  const ringPool = FIELD_PACK_TEMPLATES[ring] ?? FIELD_PACK_TEMPLATES[1];
  const zoneFiltered = ringPool.filter((tpl) => tpl.zone === zone);
  const pool = zoneFiltered.length > 0 ? zoneFiltered : ringPool;
  return pool[Math.floor(Math.random() * pool.length)] ?? FIELD_PACK_TEMPLATES[1][0];
}

export function pickFieldPackTemplate(ring: 1 | 2 | 3 | 4): FieldMonsterPackTemplate {
  return pickFieldPackTemplateForZone('mid_field', ring);
}

/**
 * 중심 마을(0,0) 방책 및 방어타워 사거리 내부인지 판별 (순수 함수)
 */
export function isInsideCenterVillageSafeZone(
  wx: number,
  wy: number,
  territoryMarginPx: number = FIELD_MONSTER_CONFIG.centerTerritoryExclusionMarginPx,
  coreSafeRadiusPx: number = FIELD_MONSTER_CONFIG.centerSafeRadiusPx
): boolean {
  const center = getTerritoryCorePos(0, 0);
  if (Math.hypot(wx - center.x, wy - center.y) < coreSafeRadiusPx) {
    return true;
  }
  return (
    wx >= -territoryMarginPx &&
    wx <= TERRITORY_PX + territoryMarginPx &&
    wy >= -territoryMarginPx &&
    wy <= TERRITORY_PX + territoryMarginPx
  );
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

  if (isInsideCenterVillageSafeZone(wx, wy)) {
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

function isTooCloseToSpots(
  wx: number,
  wy: number,
  minSpacing: number,
  existingSpots: ReadonlyArray<{ x: number; y: number }>,
  pickedSpots: ReadonlyArray<{ x: number; y: number }>
): boolean {
  for (const spot of existingSpots) {
    if (Math.hypot(wx - spot.x, wy - spot.y) < minSpacing) return true;
  }
  for (const picked of pickedSpots) {
    if (Math.hypot(wx - picked.x, wy - picked.y) < minSpacing) return true;
  }
  return false;
}

/**
 * 지정된 존(near_village / mid_field / near_camp) 규칙에 맞춰 스폰 좌표를 추첨합니다.
 */
export function pickZoneFieldSpawnSpots(params: {
  zone: FieldSpawnZone;
  desiredCount: number;
  existingSpots: ReadonlyArray<{ x: number; y: number }>;
  terrain: WorldTerrainMap;
  islands: ReadonlyArray<Island>;
  bounds: WorldBounds;
}): FieldPackSpawnPoint[] {
  const { zone, desiredCount, existingSpots, terrain, islands, bounds } = params;
  const results: FieldPackSpawnPoint[] = [];
  if (desiredCount <= 0) return results;

  const minSpacing = FIELD_MONSTER_CONFIG.minPackSpacingPx;
  const span = bounds.max - bounds.min - 280;
  const maxAttempts = desiredCount * 48;
  const centerCore = getTerritoryCorePos(0, 0);
  const camps = islands.filter((i) => i.id !== 0);

  for (let attempt = 0; attempt < maxAttempts && results.length < desiredCount; attempt++) {
    let wx: number;
    let wy: number;
    let ring: 1 | 2 | 3 | 4;

    if (zone === 'near_village') {
      const angle = Math.random() * Math.PI * 2;
      const r =
        FIELD_MONSTER_CONFIG.nearVillageMinRadiusPx +
        Math.random() *
          (FIELD_MONSTER_CONFIG.nearVillageMaxRadiusPx - FIELD_MONSTER_CONFIG.nearVillageMinRadiusPx);
      wx = centerCore.x + Math.cos(angle) * r;
      wy = centerCore.y + Math.sin(angle) * r;
      ring = 1;
    } else if (zone === 'near_camp' && camps.length > 0) {
      const camp = camps[Math.floor(Math.random() * camps.length)] ?? camps[0];
      const campCore = getTerritoryCorePos(camp.gridX, camp.gridY);
      const angle = Math.random() * Math.PI * 2;
      const r =
        FIELD_MONSTER_CONFIG.nearCampMinRadiusPx +
        Math.random() *
          (FIELD_MONSTER_CONFIG.nearCampMaxRadiusPx - FIELD_MONSTER_CONFIG.nearCampMinRadiusPx);
      wx = campCore.x + Math.cos(angle) * r;
      wy = campCore.y + Math.sin(angle) * r;
      ring = computeCampRing(camp.gridX, camp.gridY);
    } else {
      wx = bounds.min + 140 + Math.random() * span;
      wy = bounds.min + 140 + Math.random() * span;
      ring = computeFieldDistanceRing(wx, wy);
    }

    if (!isValidFieldMonsterSpot(wx, wy, terrain, islands, bounds)) continue;
    if (isTooCloseToSpots(wx, wy, minSpacing, existingSpots, results)) continue;

    results.push({
      x: Math.round(wx),
      y: Math.round(wy),
      ring,
      zone,
    });
  }

  return results;
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
  return pickZoneFieldSpawnSpots({
    ...params,
    zone: 'mid_field',
  });
}
