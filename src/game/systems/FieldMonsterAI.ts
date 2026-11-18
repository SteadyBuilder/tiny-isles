import { FIELD_MONSTER_CONFIG } from '../../data/fieldMonsters';
import { resolveMonsterCombatRole } from '../../data/monsterClassSkills';
import { ConstructedBuilding } from '../../types/game';
import { ActivePlayerTarget } from '../../types/monsterSync';
import { setDepthIfChanged, ySortDepth } from '../depthLayers';
import { isInsideCenterVillageSafeZone } from '../utils/fieldSpawnUtils';
import {
  canMonsterStrikeInRange,
  resetMonsterAttackEntry,
  resolveMonsterPlayerAttackRange,
} from '../utils/monsterCombatRangeUtils';
import { findTargetPlayerForMonster } from '../utils/monsterSyncUtils';
import { resolveMonsterWallClamping } from '../wallCollisionGeometry';
import { MonsterVisual } from './MonsterVisualManager';

export interface IFieldMonsterAIContext {
  getLocalPlayerPosition: () => { x: number; y: number };
  isLocalPlayerFainted: () => boolean;
  getLocalPlayerId?: () => string;
  getActivePlayers?: () => ActivePlayerTarget[];
  clearMonsterAggro?: (monsterId: string) => void;
  executeRoleAttackOnPlayer: (
    mv: MonsterVisual,
    targetX: number,
    targetY: number,
    targetPlayerId?: string
  ) => void;
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
  private returningHome = new Set<string>();

  constructor(ctx: IFieldMonsterAIContext) {
    this.ctx = ctx;
  }

  private resolveActivePlayers(): ActivePlayerTarget[] {
    if (this.ctx.getActivePlayers) {
      return this.ctx.getActivePlayers();
    }
    const pos = this.ctx.getLocalPlayerPosition();
    return [
      {
        id: this.ctx.getLocalPlayerId?.() ?? 'local',
        x: pos.x,
        y: pos.y,
        isFainted: this.ctx.isLocalPlayerFainted(),
      },
    ];
  }

  public pruneStaleState(validIds: Set<string>): void {
    for (const id of this.patrolTargets.keys()) {
      if (!validIds.has(id)) {
        this.patrolTargets.delete(id);
      }
    }
    for (const id of this.returningHome) {
      if (!validIds.has(id)) {
        this.returningHome.delete(id);
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
    activeAggroPlayerId?: string | null,
    activePlayers?: ReadonlyArray<ActivePlayerTarget>
  ): boolean {
    const m = mv.monster;
    if (!m.isFieldMonster) return false;

    const homeX = m.homeX ?? m.x;
    const homeY = m.homeY ?? m.y;
    const distFromHome = Math.hypot(m.x - homeX, m.y - homeY);

    const enteredCenterSafeZone = isInsideCenterVillageSafeZone(
      m.x,
      m.y,
      FIELD_MONSTER_CONFIG.centerReturnTriggerMarginPx,
      FIELD_MONSTER_CONFIG.centerSafeRadiusPx - 60
    );

    if (distFromHome > FIELD_MONSTER_CONFIG.fieldLeashRadiusPx || enteredCenterSafeZone) {
      this.returningHome.add(m.id);
      this.ctx.clearMonsterAggro?.(m.id);
    }

    if (this.returningHome.has(m.id)) {
      resetMonsterAttackEntry(mv);
      if (distFromHome <= FIELD_MONSTER_CONFIG.fieldReturnArrivalRadiusPx && !enteredCenterSafeZone) {
        this.returningHome.delete(m.id);
      } else {
        const returnSpeed = m.speed * FIELD_MONSTER_CONFIG.fieldReturnSpeedMultiplier;
        const vx = ((homeX - m.x) / Math.max(1, distFromHome)) * returnSpeed;
        const vy = ((homeY - m.y) / Math.max(1, distFromHome)) * returnSpeed;
        this.moveMonster(mv, vx, vy, dt, aliveWalls);
        return true;
      }
    }

    const aggroRadius = activeAggroPlayerId
      ? FIELD_MONSTER_CONFIG.fieldLeashRadiusPx
      : FIELD_MONSTER_CONFIG.fieldAggroRadiusPx;

    const targetMatch = findTargetPlayerForMonster(
      m.x,
      m.y,
      activePlayers ?? this.resolveActivePlayers(),
      aggroRadius,
      activeAggroPlayerId ?? undefined
    );

    if (!targetMatch) {
      resetMonsterAttackEntry(mv);
      this.updatePatrolOrReturn(mv, time, dt, homeX, homeY, distFromHome, aliveWalls);
      return true;
    }

    const targetPlayer = targetMatch.player;
    const distToPlayer = targetMatch.dist;
    const desiredRange = resolveMonsterPlayerAttackRange(m.role, m.isBoss);

    if (m.role === 'ranged' && distToPlayer < 110 && distFromHome < 420) {
      const vx = ((m.x - targetPlayer.x) / Math.max(1, distToPlayer)) * m.speed * 0.75 + sepX;
      const vy = ((m.y - targetPlayer.y) / Math.max(1, distToPlayer)) * m.speed * 0.75 + sepY;
      this.moveMonster(mv, vx, vy, dt, aliveWalls, targetPlayer.x < m.x ? 'left' : 'right');
    } else if (distToPlayer > desiredRange) {
      resetMonsterAttackEntry(mv);
      const vx = ((targetPlayer.x - m.x) / Math.max(1, distToPlayer)) * m.speed + sepX;
      const vy = ((targetPlayer.y - m.y) / Math.max(1, distToPlayer)) * m.speed + sepY;
      this.moveMonster(mv, vx, vy, dt, aliveWalls);
      return true;
    }

    const baseCooldownMs = m.role === 'mage' ? 1800 : m.role === 'ranged' ? 1350 : 1080;
    const cooldownMs = m.eliteAffix === 'berserker' ? Math.round(baseCooldownMs * 0.8) : baseCooldownMs;
    if (canMonsterStrikeInRange(mv, time, cooldownMs)) {
      mv.lastAttackTime = time;
      this.ctx.executeRoleAttackOnPlayer(mv, targetPlayer.x, targetPlayer.y, targetPlayer.id);
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
