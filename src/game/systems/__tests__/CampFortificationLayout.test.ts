import assert from 'node:assert/strict';
import test from 'node:test';
import { TERRITORY_BUILD_SLOTS } from '../../../data/buildings';
import { MonsterCampState } from '../../../types/game';
import { getIslandOrigin } from '../../constants';
import {
  WALL_COLLIDER_THICKNESS,
  getSolidPerimeterWallCollisionBox,
  nearestPointOnCollisionBox,
} from '../../wallCollisionGeometry';
import { buildCampFortificationSpecs } from '../CampFortificationLayout';

const makeCamp = (overrides: Partial<MonsterCampState> = {}): MonsterCampState => ({
  territoryId: 101,
  gridX: 1,
  gridY: 0,
  ring: 1,
  level: 2,
  name: '초급 마물 전초기지',
  coreHp: 1560,
  coreMaxHp: 1560,
  destroyed: false,
  respawnRemainingSec: null,
  firstCleared: false,
  clearCount: 0,
  ...overrides,
});

test('몬스터 부락 목책/성벽은 플레이어 본진과 동일한 영지 외곽 4면 슬롯 전체를 둘러친다', () => {
  const camp = makeCamp({ territoryId: 201, gridX: 1, gridY: -1, ring: 2 });
  const origin = getIslandOrigin(camp.gridX, camp.gridY);
  const specs = buildCampFortificationSpecs(camp, 1, 1);
  const walls = specs.filter((s) => s.kind === 'wall');

  assert.equal(walls.length, 4);

  for (let slotIndex = 0; slotIndex < 4; slotIndex++) {
    const wall = walls[slotIndex];
    const slot = TERRITORY_BUILD_SLOTS[slotIndex];
    const expectedX = origin.x + slot.relX;
    const expectedY = origin.y + slot.relY;
    const expectedBox = getSolidPerimeterWallCollisionBox(expectedX, expectedY, slotIndex);

    assert.equal(wall.id, `cwall_201_${slotIndex}`);
    assert.equal(wall.slotIndex, slotIndex);
    assert.equal(wall.x, expectedX);
    assert.equal(wall.y, expectedY);
    assert.equal(wall.isHoriz, slotIndex === 0 || slotIndex === 1);
    assert.equal(wall.spriteKey, 'stoneWall');
    assert.deepEqual(wall.collisionBox, expectedBox);
  }

  // 북/남 벽은 서쪽 코너(52) ~ 동쪽 코너(1228) 전체 구간 + 벽 두께를 포함해야 한다
  const north = walls[0].collisionBox;
  const south = walls[1].collisionBox;
  const east = walls[2].collisionBox;
  const west = walls[3].collisionBox;

  const expectedSpan = 1228 - 52 + WALL_COLLIDER_THICKNESS;
  assert.equal(north.w, expectedSpan);
  assert.equal(south.w, expectedSpan);
  assert.equal(east.h, expectedSpan);
  assert.equal(west.h, expectedSpan);
});

test('링 1 부락은 나무 목책(woodPalisade)으로 외곽 전체를 둘러치며 모서리 부근에서도 타격 판정이 가능하다', () => {
  const camp = makeCamp({ territoryId: 105, gridX: 0, gridY: 1, ring: 1 });
  const origin = getIslandOrigin(camp.gridX, camp.gridY);
  const specs = buildCampFortificationSpecs(camp, 1, 1);
  const walls = specs.filter((s) => s.kind === 'wall');

  assert.equal(walls.every((w) => w.spriteKey === 'woodPalisade'), true);

  // 북쪽 벽의 서쪽 모서리 근처(origin.x + 80, origin.y + 52)에서 타격 시 거리 0으로 최근접 지점 판정
  const northWall = walls[0];
  const cornerHit = nearestPointOnCollisionBox(origin.x + 80, origin.y + 52, northWall.collisionBox);
  assert.equal(cornerHit.dist, 0);
  assert.equal(cornerHit.x, origin.x + 80);
});
