import { FIELD_MONSTER_CONFIG } from '../../data/fieldMonsters';
import { DUNGEON_INVASION_CONFIG } from '../../data/monsterCamps';
import { ConstructedBuilding } from '../../types/game';
import { setDepthIfChanged, ySortDepth } from '../depthLayers';
import { resolveMonsterWallClamping } from '../wallCollisionGeometry';
import { MonsterVisual } from './MonsterVisualManager';

export interface IFieldMonsterAIContext {
  getLocalPlayerPosition: () => { x: number; y: number };
  isLocalPlayerFainted: () => boolean;
  executeRoleAttackOnPlayer: (mv: MonsterVisual, targetX: number, targetY: number) => void;
}

interface PatrolTarget {
  x: number;
  y: number;
  nextChangeAt: number;
}

/**
 * 야생 필드 몬스터(isFieldMonster)의 영역 순찰(배회), 근접 선공, 카이팅 및 귀환 AI 전담 모듈
 */
export class FieldMonsterAI {
  private ctx: IFieldMonsterAIContext;
  private patrolTargets = new Map<string, PatrolTarget>();

  constructor(ctx: IFieldMonsterAIContext) {
    this.ctx = ctx;
  }

  public pruneStaleState(validIds: Set<string>): void {
    for (const id of this.patrolTargets.keys()) {
      if (!validIds.has(id)) {
        this.patrolTargets.delete(id);
      }
    }
  }

  public tryUpdateFieldMonster(
    mv: MonsterVisual,
    time: number,
    dt: number,
    aliveWalls: ConstructedBuilding[],
    sepX: number,
    sepY: number,
    hasActiveAggro: boolean
  ): boolean {
    const m = mv.monster;
    if (!m.isFieldMonster) return false;

    const homeX = m.homeX ?? m.x;
    const homeY = m.homeY ?? m.y;
    const playerPos = this.ctx.getLocalPlayerPosition();
    const playerFainted = this.ctx.isLocalPlayerFainted();
    const distToPlayer = Math.hypot(playerPos.x - m.x, playerPos.y - m.y);
    const distFromHome = Math.hypot(m.x - homeX, m.y - homeY);

    const aggroRadius = hasActiveAggro
      ? FIELD_MONSTER_CONFIG.fieldLeashRadiusPx
      : FIELD_MONSTER_CONFIG.fieldAggroRadiusPx;

    const shouldChase =
      !playerFainted &&
      distToPlayer <= aggroRadius &&
      distFromHome <= FIELD_MONSTER_CONFIG.fieldLeashRadiusPx;

    if (!shouldChase) {
      this.updatePatrolOrReturn(mv, time, dt, homeX, homeY, distFromHome, aliveWalls);
      return true;
    }

    const desiredRange =
      m.role === 'mage'
        ? DUNGEON_INVASION_CONFIG.mageAttackRangePx
        : m.role === 'ranged'
        ? DUNGEON_INVASION_CONFIG.rangedAttackRangePx
        : m.role === 'lancer'
        ? 95
        : 58;

    if (m.role === 'ranged' && distToPlayer < 110 && distFromHome < 420) {
      const vx = ((m.x - playerPos.x) / Math.max(1, distToPlayer)) * m.speed * 0.75 + sepX;
      const vy = ((m.y - playerPos.y) / Math.max(1, distToPlayer)) * m.speed * 0.75 + sepY;
      this.moveMonster(mv, vx, vy, dt, aliveWalls, playerPos.x < m.x ? 'left' : 'right');
    } else if (distToPlayer > desiredRange) {
      const vx = ((playerPos.x - m.x) / Math.max(1, distToPlayer)) * m.speed + sepX;
      const vy = ((playerPos.y - m.y) / Math.max(1, distToPlayer)) * m.speed + sepY;
      this.moveMonster(mv, vx, vy, dt, aliveWalls);
      return true;
    }

    const baseCooldownMs = m.role === 'mage' ? 1800 : m.role === 'ranged' ? 1350 : 1080;
    const cooldownMs = m.eliteAffix === 'berserker' ? Math.round(baseCooldownMs * 0.8) : baseCooldownMs;
    if (time - mv.lastAttackTime >= cooldownMs) {
      mv.lastAttackTime = time;
      this.ctx.executeRoleAttackOnPlayer(mv, playerPos.x, playerPos.y);
    }
    return true;
  }

  private updatePatrolOrReturn(
    mv: MonsterVisual,
    time: number,
    dt: number,
    homeX: number,
    homeY: number,
    distFromHome: number,
    aliveWalls: ConstructedBuilding[]
  ): void {
    const m = mv.monster;
    const patrolRadius = m.patrolRadiusPx ?? FIELD_MONSTER_CONFIG.patrolRadiusPx;

    if (distFromHome > patrolRadius + 30) {
      const vx = ((homeX - m.x) / distFromHome) * m.speed * 0.9;
      const vy = ((homeY - m.y) / distFromHome) * m.speed * 0.9;
      this.moveMonster(mv, vx, vy, dt, aliveWalls);
      return;
    }

    let patrol = this.patrolTargets.get(m.id);
    if (!patrol || time >= patrol.nextChangeAt) {
      const angle = Math.random() * Math.PI * 2;
      const r = 35 + Math.random() * Math.max(40, patrolRadius - 35);
      patrol = {
        x: homeX + Math.cos(angle) * r,
        y: homeY + Math.sin(angle) * r,
        nextChangeAt: time + FIELD_MONSTER_CONFIG.patrolStepIntervalMs + Math.random() * 1600,
      };
      this.patrolTargets.set(m.id, patrol);
    }

    const dx = patrol.x - m.x;
    const dy = patrol.y - m.y;
    const distToWaypoint = Math.hypot(dx, dy);
    if (distToWaypoint > 14) {
      const patrolSpeed = m.speed * 0.45;
      this.moveMonster(
        mv,
        (dx / distToWaypoint) * patrolSpeed,
        (dy / distToWaypoint) * patrolSpeed,
        dt,
        aliveWalls
      );
    }
  }

  private moveMonster(
    mv: MonsterVisual,
    vx: number,
    vy: number,
    dt: number,
    aliveWalls: ConstructedBuilding[],
    forcedDirection?: 'left' | 'right'
  ): void {
    const m = mv.monster;
    const clamp = resolveMonsterWallClamping(m.x, m.y, m.x + vx * dt, m.y + vy * dt, 16, aliveWalls);
    m.x = clamp.x;
    m.y = clamp.y;
    m.direction = forcedDirection ?? (vx < 0 ? 'left' : 'right');
    mv.container.setPosition(m.x, m.y);
    setDepthIfChanged(mv.container, ySortDepth(m.y, 28));
    mv.sprite.setFlipX(m.direction === 'left');
  }
}
