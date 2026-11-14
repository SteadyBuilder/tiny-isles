import { Entity } from '../../types/game';
import { getIslandOrigin } from './territoryGrid';
import { resolveOutdoorRelPos } from '../resourceSpawnRules';

/**
 * 영지별 자원 엔티티 생성 (마을 영역 `TERRITORY_PX` 외부 야외 평원 벨트에만 스폰)
 * - 마을 내부(0..TERRITORY_PX 건축/거주 구역)에는 자원이 스폰되지 않으며, 성문 바깥 야외 평원에 분포합니다.
 * - 중심 마을(id: 0) 외곽 평원에는 기본 시작 자원이 배치됩니다.
 * - 중심 마을과 인접한 땅(id: 1~8) 외곽 평원은 자원이 매우 풍부합니다!
 * - 외곽 땅(id: 9~20)도 넓혀가며 야외 자원을 대량 확보할 수 있도록 구성합니다.
 */
export function generateIslandEntities(islandId: number, gridX: number, gridY: number): Entity[] {
  const origin = getIslandOrigin(gridX, gridY);
  const entities: Entity[] = [];
  let slotCounter = islandId * 3;

  const toWorldOutdoor = (relX: number, relY: number) => {
    const out = resolveOutdoorRelPos(relX, relY, slotCounter++);
    return { x: origin.x + out.relX, y: origin.y + out.relY };
  };

  const addTree = (idSuffix: string, relX: number, relY: number, hp = 3) => {
    const pos = toWorldOutdoor(relX, relY);
    entities.push({
      id: `t_${islandId}_${idSuffix}`,
      type: 'tree',
      x: pos.x,
      y: pos.y,
      hp,
      maxHp: hp,
      islandId,
    });
  };

  const addRock = (idSuffix: string, relX: number, relY: number, hp = 4) => {
    const pos = toWorldOutdoor(relX, relY);
    entities.push({
      id: `r_${islandId}_${idSuffix}`,
      type: 'rock',
      x: pos.x,
      y: pos.y,
      hp,
      maxHp: hp,
      islandId,
    });
  };

  const addGoldRock = (idSuffix: string, relX: number, relY: number, hp = 5) => {
    const pos = toWorldOutdoor(relX, relY);
    entities.push({
      id: `g_${islandId}_${idSuffix}`,
      type: 'gold_rock',
      x: pos.x,
      y: pos.y,
      hp,
      maxHp: hp,
      islandId,
    });
  };

  const addSheep = (idSuffix: string, relX: number, relY: number) => {
    const pos = toWorldOutdoor(relX, relY);
    entities.push({
      id: `s_${islandId}_${idSuffix}`,
      type: 'sheep',
      x: pos.x,
      y: pos.y,
      hp: 3,
      maxHp: 3,
      islandId,
    });
  };

  switch (islandId) {
    case 0: // 중심 마을 외곽 야외 평원 시작 자원
      addTree('1', -130, 220);
      addTree('2', 210, 760);
      addTree('3', 440, 760);
      addRock('1', 760, 210);
      addRock('2', 760, 480);
      addGoldRock('1', 190, -135);
      addSheep('1', -135, 480);
      break;

    case 1: // [인접 풍요지] 동쪽 풍요의 삼림 외곽 평원
      addTree('1', 110, -120, 4);
      addTree('2', 225, -160, 4);
      addTree('3', 430, -160, 4);
      addTree('4', 545, -120, 4);
      addTree('5', -135, 180, 4);
      addTree('6', 765, 180, 4);
      addTree('7', 115, 755, 4);
      addTree('8', 235, 790, 4);
      addTree('9', 435, 790, 4);
      addRock('1', 545, 755, 5);
      addRock('2', -150, 470, 5);
      addGoldRock('1', 775, 470, 5);
      break;

    case 2: // [인접 풍요지] 남쪽 풍요의 채석 외곽 평원
      addRock('1', 110, -120, 5);
      addRock('2', 225, -155, 5);
      addRock('3', 430, -155, 5);
      addRock('4', 545, -120, 5);
      addRock('5', -140, 200, 5);
      addRock('6', 765, 200, 5);
      addRock('7', 120, 755, 5);
      addGoldRock('1', 435, 780, 6);
      addGoldRock('2', 550, 745, 6);
      addTree('1', 230, 780, 4);
      addTree('2', -145, 480, 4);
      break;

    case 3: // [인접 풍요지] 서쪽 풍요의 황금 외곽 평원
      addGoldRock('1', 110, -120, 6);
      addGoldRock('2', 225, -160, 6);
      addGoldRock('3', 430, -160, 6);
      addGoldRock('4', 545, -120, 6);
      addGoldRock('5', 120, 755, 6);
      addGoldRock('6', 540, 755, 6);
      addRock('1', -145, 210, 5);
      addRock('2', 770, 210, 5);
      addTree('1', 235, 785, 4);
      addTree('2', 425, 785, 4);
      break;

    case 4: // [인접 풍요지] 북쪽 풍요의 고원 외곽 평원
      addGoldRock('1', 110, -125, 6);
      addGoldRock('2', 545, -125, 6);
      addGoldRock('3', -150, 210, 6);
      addGoldRock('4', 775, 210, 6);
      addRock('1', 225, -160, 5);
      addRock('2', 430, -160, 5);
      addRock('3', 120, 755, 5);
      addRock('4', 540, 755, 5);
      addTree('1', -145, 475, 4);
      addTree('2', 770, 475, 4);
      addTree('3', 235, 785, 4);
      addTree('4', 425, 785, 4);
      break;

    case 5:
    case 6:
    case 7:
    case 8:
      addTree('1', 110, -120, 4);
      addTree('2', 225, -160, 4);
      addTree('3', 545, -120, 4);
      addTree('4', 120, 755, 4);
      addRock('1', 430, -160, 5);
      addRock('2', -145, 210, 5);
      addRock('3', 770, 210, 5);
      addRock('4', 235, 785, 5);
      addGoldRock('1', 430, 785, 6);
      addGoldRock('2', 545, 750, 6);
      addGoldRock('3', -150, 475, 6);
      break;

    default:
      addTree('1', 115, -125, 4);
      addTree('2', 535, -125, 4);
      addTree('3', 115, 755, 4);
      addRock('1', 230, -155, 5);
      addRock('2', 420, -155, 5);
      addRock('3', 230, 780, 5);
      addGoldRock('1', 535, 755, 6);
      addGoldRock('2', 420, 780, 6);
      addGoldRock('3', -145, 220, 6);
      break;
  }

  return entities;
}
