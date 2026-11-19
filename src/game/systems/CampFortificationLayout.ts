import { TERRITORY_BUILD_SLOTS } from '../../data/buildings';
import { CAMP_RING_TEMPLATES } from '../../data/monsterCamps';
import { MonsterCampState } from '../../types/game';
import { CollisionBox, TERRITORY_CENTER_X, TERRITORY_CENTER_Y, getIslandOrigin } from '../constants';
import { getSolidPerimeterWallCollisionBox } from '../wallCollisionGeometry';

export interface CampStructureSpec {
  id: string;
  territoryId: number;
  kind: 'wall' | 'tower';
  slotIndex?: number;
  x: number;
  y: number;
  hp: number;
  spriteKey: string;
  isHoriz: boolean;
  ring: 1 | 2 | 3 | 4;
  attack: number;
  rangePx: number;
  fireRateMs: number;
  collisionBox: CollisionBox;
}

const CAMP_WALL_SLOT_INDICES = [0, 1, 2, 3] as const;

const TOWER_OFFSETS = [
  { dx: -135, dy: -135 },
  { dx: 135, dy: 135 },
  { dx: 135, dy: -135 },
  { dx: -135, dy: 135 },
] as const;

const CAMP_TOWER_COLLIDER_W = 68;
const CAMP_TOWER_COLLIDER_H = 64;

/**
 * 몬스터 부락 반경별 외곽 방어벽(플레이어 본진과 동일한 영지 외곽 4면)·적 방어 타워 배치 및 스케일링 스펙 생성 순수 함수
 */
export function buildCampFortificationSpecs(
  camp: MonsterCampState,
  hpMult: number,
  atkMult: number
): CampStructureSpec[] {
  const tpl = CAMP_RING_TEMPLATES[camp.ring];
  const fort = tpl.fortification;
  const clearScale = 1 + camp.clearCount * 0.25;
  const origin = getIslandOrigin(camp.gridX, camp.gridY);
  const cx = origin.x + TERRITORY_CENTER_X;
  const cy = origin.y + TERRITORY_CENTER_Y;

  const specs: CampStructureSpec[] = [];
  const wallHp = Math.round(fort.wallHp * clearScale * hpMult);
  CAMP_WALL_SLOT_INDICES.forEach((slotIndex, idx) => {
    const slot = TERRITORY_BUILD_SLOTS[slotIndex];
    const x = origin.x + slot.relX;
    const y = origin.y + slot.relY;
    const isHoriz = slotIndex === 0 || slotIndex === 1;
    const collisionBox = getSolidPerimeterWallCollisionBox(x, y, slotIndex) ?? {
      x: x - 44,
      y: y - 20,
      w: 88,
      h: 40,
    };

    specs.push({
      id: `cwall_${camp.territoryId}_${idx}`,
      territoryId: camp.territoryId,
      kind: 'wall',
      slotIndex,
      x,
      y,
      hp: wallHp,
      spriteKey: fort.wallSprite,
      isHoriz,
      ring: camp.ring,
      attack: 0,
      rangePx: 0,
      fireRateMs: 0,
      collisionBox,
    });
  });

  const towerHp = Math.round(fort.towerHp * clearScale * hpMult);
  const towerAtk = Math.round(fort.towerAttack * clearScale * atkMult);
  TOWER_OFFSETS.slice(0, fort.towerCount).forEach((to, idx) => {
    const x = cx + to.dx;
    const y = cy + to.dy;
    specs.push({
      id: `ctower_${camp.territoryId}_${idx}`,
      territoryId: camp.territoryId,
      kind: 'tower',
      x,
      y,
      hp: towerHp,
      spriteKey: 'blackTower',
      isHoriz: true,
      ring: camp.ring,
      attack: towerAtk,
      rangePx: fort.towerRangePx,
      fireRateMs: fort.towerFireRateMs,
      collisionBox: {
        x: x - CAMP_TOWER_COLLIDER_W / 2,
        y: y - CAMP_TOWER_COLLIDER_H / 2,
        w: CAMP_TOWER_COLLIDER_W,
        h: CAMP_TOWER_COLLIDER_H,
      },
    });
  });

  return specs;
}
