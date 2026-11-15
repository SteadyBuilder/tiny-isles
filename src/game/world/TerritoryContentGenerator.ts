import { Building, VillageTier } from '../../types/game';
import { VILLAGE_TIER_CONFIGS } from '../../data/buildings';
import {
  TERRITORY_CORE_REL_X,
  TERRITORY_CORE_REL_Y,
  getIslandOrigin,
} from './territoryGrid';

export interface CollisionBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 마을 발전 단계(VillageTier)에 따른 중심 건축물 생성
 */
export function generateTerritoryBuildings(
  islandId: number,
  gridX: number,
  gridY: number,
  villageTier: VillageTier = islandId === 0 ? 2 : 0
): Building[] {
  const origin = getIslandOrigin(gridX, gridY);
  const cx = origin.x + TERRITORY_CORE_REL_X;
  const cy = origin.y + TERRITORY_CORE_REL_Y;
  const buildings: Building[] = [];
  const tierInfo = VILLAGE_TIER_CONFIGS[villageTier];

  if (villageTier === 0) {
    // 마을 건설 전 (점령지 상태): 나무로 된 허름한 임시 막사 배치
    buildings.push({
      id: `b_${islandId}_outpost_lv0`,
      type: 'woodOutpost',
      name: `${tierInfo.badge} 임시 막사`,
      x: cx - 64,
      y: cy - 245,
      width: 128,
      height: 192,
      islandId,
    });
    return buildings;
  }

  if (villageTier === 1) {
    // 1단계: 개척마을
    buildings.push({
      id: `b_${islandId}_hall_lv1`,
      type: 'woodHut',
      name: `${tierInfo.badge} 회관`,
      x: cx - 64,
      y: cy - 260,
      width: 128,
      height: 192,
      islandId,
    });
  } else if (villageTier === 2) {
    // 2단계: 중소마을 (중심 마을 초기 상태!)
    buildings.push({
      id: `b_${islandId}_hall_lv2`,
      type: islandId === 0 ? 'castle' : 'house2',
      name: islandId === 0 ? '중심 중소마을 본관' : `${tierInfo.badge} 중심회관`,
      x: cx - (islandId === 0 ? 160 : 64),
      y: cy - (islandId === 0 ? 305 : 265),
      width: islandId === 0 ? 320 : 128,
      height: islandId === 0 ? 240 : 192,
      islandId,
    });
    buildings.push({
      id: `b_${islandId}_sub_lv2`,
      type: 'house1',
      name: '중소마을 민가',
      x: cx - 320,
      y: cy - 170,
      width: 120,
      height: 180,
      islandId,
    });
  } else if (villageTier === 3) {
    // 3단계: 큰마을
    buildings.push({
      id: `b_${islandId}_hall_lv3`,
      type: 'castle',
      name: `${tierInfo.badge} 영주관`,
      x: cx - 160,
      y: cy - 305,
      width: 320,
      height: 240,
      islandId,
    });
    buildings.push({
      id: `b_${islandId}_sub1_lv3`,
      type: 'market',
      name: '큰마을 상점가',
      x: cx - 350,
      y: cy - 175,
      width: 150,
      height: 150,
      islandId,
    });
    buildings.push({
      id: `b_${islandId}_sub2_lv3`,
      type: 'blacksmith',
      name: '큰마을 대장간',
      x: cx + 210,
      y: cy - 175,
      width: 150,
      height: 150,
      islandId,
    });
  } else if (villageTier >= 4) {
    // 4단계 소도시 / 5단계 중소도시 / 6단계 대도시
    buildings.push({
      id: `b_${islandId}_hall_city`,
      type: 'castle',
      name: `${tierInfo.badge} 중앙 성채`,
      x: cx - 160,
      y: cy - 310,
      width: 320,
      height: 250,
      islandId,
    });
    buildings.push({
      id: `b_${islandId}_west_city`,
      type: villageTier >= 5 ? 'barracks' : 'windmill',
      name: `${tierInfo.name} 서구획`,
      x: cx - 360,
      y: cy - 190,
      width: 140,
      height: 190,
      islandId,
    });
    buildings.push({
      id: `b_${islandId}_east_city`,
      type: villageTier >= 6 ? 'monastery' : 'archery',
      name: `${tierInfo.name} 동구획`,
      x: cx + 220,
      y: cy - 190,
      width: 140,
      height: 190,
      islandId,
    });
  }

  return buildings;
}

export function getBuildingCollisionBox(b: Building): CollisionBox {
  switch (b.type) {
    case 'castle':
      return { x: b.x + 28, y: b.y + 115, w: b.width - 56, h: 90 };
    case 'house1':
    case 'house2':
    case 'house3':
    case 'woodOutpost':
    case 'woodHut':
      return { x: b.x + 20, y: b.y + 85, w: b.width - 40, h: 75 };
    case 'market':
    case 'blacksmith':
    case 'lumberCamp':
    case 'stoneWorks':
      return { x: b.x + 18, y: b.y + 65, w: b.width - 36, h: 65 };
    case 'tower':
    case 'magicTower':
      return { x: b.x + 24, y: b.y + 140, w: b.width - 48, h: 80 };
    case 'barracks':
    case 'archery':
    case 'windmill':
    case 'alchemistLab':
      return { x: b.x + 24, y: b.y + 120, w: b.width - 48, h: 95 };
    case 'monastery':
      return { x: b.x + 24, y: b.y + 150, w: b.width - 48, h: 110 };
    default:
      return { x: b.x + 16, y: b.y + 80, w: b.width - 32, h: 75 };
  }
}
