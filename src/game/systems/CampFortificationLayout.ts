import { CAMP_RING_TEMPLATES } from '../../data/monsterCamps';
import { MonsterCampState } from '../../types/game';
import { TERRITORY_CENTER_X, TERRITORY_CENTER_Y, getIslandOrigin } from '../constants';

export interface CampStructureSpec {
  id: string;
  territoryId: number;
  kind: 'wall' | 'tower';
  x: number;
  y: number;
  hp: number;
  spriteKey: string;
  isHoriz: boolean;
  ring: 1 | 2 | 3 | 4;
  attack: number;
  rangePx: number;
  fireRateMs: number;
}

const WALL_OFFSETS = [
  { dx: 0, dy: -215, isHoriz: true },
  { dx: 0, dy: 215, isHoriz: true },
  { dx: 215, dy: 0, isHoriz: false },
  { dx: -215, dy: 0, isHoriz: false },
] as const;

const TOWER_OFFSETS = [
  { dx: -135, dy: -135 },
  { dx: 135, dy: 135 },
  { dx: 135, dy: -135 },
  { dx: -135, dy: 135 },
] as const;

/**
 * 몬스터 부락 반경별 방어벽·적 방어 타워 배치 및 스케일링 스펙 생성 순수 함수
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
  WALL_OFFSETS.forEach((wo, idx) => {
    specs.push({
      id: `cwall_${camp.territoryId}_${idx}`,
      territoryId: camp.territoryId,
      kind: 'wall',
      x: cx + wo.dx,
      y: cy + wo.dy,
      hp: wallHp,
      spriteKey: fort.wallSprite,
      isHoriz: wo.isHoriz,
      ring: camp.ring,
      attack: 0,
      rangePx: 0,
      fireRateMs: 0,
    });
  });

  const towerHp = Math.round(fort.towerHp * clearScale * hpMult);
  const towerAtk = Math.round(fort.towerAttack * clearScale * atkMult);
  TOWER_OFFSETS.slice(0, fort.towerCount).forEach((to, idx) => {
    specs.push({
      id: `ctower_${camp.territoryId}_${idx}`,
      territoryId: camp.territoryId,
      kind: 'tower',
      x: cx + to.dx,
      y: cy + to.dy,
      hp: towerHp,
      spriteKey: 'blackTower',
      isHoriz: true,
      ring: camp.ring,
      attack: towerAtk,
      rangePx: fort.towerRangePx,
      fireRateMs: fort.towerFireRateMs,
    });
  });

  return specs;
}
