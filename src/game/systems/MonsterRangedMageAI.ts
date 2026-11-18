import { DUNGEON_INVASION_CONFIG, HUNTING_AI_CONFIG } from '../../data/monsterCamps';
import { resolveMonsterCombatRole } from '../../data/monsterClassSkills';
import { sound } from '../../lib/sound';
import { ConstructedBuilding } from '../../types/game';
import { ActivePlayerTarget, MonsterPlayerAttackPayload } from '../../types/monsterSync';
import { setDepthIfChanged, ySortDepth } from '../depthLayers';
import { MonsterAttackFxRenderer } from '../phaser/renderers/MonsterAttackFxRenderer';
import {
  canMonsterStrikeInRange,
  resetMonsterAttackEntry,
  resolveMonsterPlayerAttackRange,
  resolveMonsterWaveAttackRange,
} from '../utils/monsterCombatRangeUtils';
import { findTargetPlayerForMonster } from '../utils/monsterSyncUtils';
import { resolveMonsterWallClamping } from '../wallCollisionGeometry';
import { MonsterVisual, MonsterVisualManager } from './MonsterVisualManager';
import { ProjectileSystem } from './ProjectileSystem';

export interface IMonsterRangedMageContext {
  getMonsters: () => Map<string, MonsterVisual>;
  getLocalPlayerId?: () => string;
  getLocalPlayerPosition: () => { x: number; y: number };
  isLocalPlayerFainted: () => boolean;
  getActivePlayers?: () => ActivePlayerTarget[];
  damageLocalPlayer: (damage: number, attackerName: string) => void;
  broadcastMonsterPlayerAttack?: (payload: MonsterPlayerAttackPayload) => void;
  healCampCore?: (territoryId: number, amount: number) => void;
  clearMonsterAggro?: (monsterId: string) => void;
  projectileSystem?: ProjectileSystem;
  fxRenderer?: MonsterAttackFxRenderer;
  playExplosionAt: (x: number, y: number) => void;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
}

/**
 * 몬스터 부락 수비병(isCampMonster)의 영역 순찰/어그로/귀환 및
 * 병과별(흑기사 근거리 참격, 창기병 중거리 창격, 원거리 궁수 화살 사격, 흑마법사 장판 폭발·주술 치유) 전투 AI 전담 모듈
 */
export class MonsterRangedMageAI {
  private ctx: IMonsterRangedMageContext;
  private returningHome = new Set<string>();

  constructor(ctx: IMonsterRangedMageContext) {
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
    for (const id of this.returningHome) {
      if (!validIds.has(id)) {
        this.returningHome.delete(id);
      }
    }
  }

  /**
   * 부락 수비 몬스터(isCampMonster)의 행동 처리.
   * 부락 몬스터인 경우 true를 반환하여 일반 웨이브 본진 진격 로직을 건너뜁니다.
   */
  public tryUpdateCampMonster(
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
    if (!m.isCampMonster) return false;

    const role = resolveMonsterCombatRole(m);
    const homeX = m.homeX ?? m.x;
    const homeY = m.homeY ?? m.y;
    const distFromHome = Math.hypot(m.x - homeX, m.y - homeY);

    // 마법사 주술 치유: 4.5초마다 주변 부락 동료 및 부락 본진 체력 회복
    if (role === 'mage' && time - (mv.lastHealTime ?? 0) >= 4500) {
      mv.lastHealTime = time;
      this.performMageSupportHeal(mv);
    }

    // 추격 한계(보이지 않는 벽)에 도달하면 어그로를 해제하고 빠른 속도로 스폰 부락으로 복귀
    if (distFromHome > HUNTING_AI_CONFIG.campLeashRadiusPx) {
      this.returningHome.add(m.id);
      this.ctx.clearMonsterAggro?.(m.id);
    }

    if (this.returningHome.has(m.id)) {
      resetMonsterAttackEntry(mv);
      if (distFromHome <= HUNTING_AI_CONFIG.campReturnArrivalRadiusPx) {
        this.returningHome.delete(m.id);
      } else {
        const returnSpeed = m.speed * HUNTING_AI_CONFIG.campReturnSpeedMultiplier;
        const vx = ((homeX - m.x) / distFromHome) * returnSpeed;
        const vy = ((homeY - m.y) / distFromHome) * returnSpeed;
        m.x += vx * dt;
        m.y += vy * dt;
        m.direction = vx < 0 ? 'left' : 'right';
        mv.container.setPosition(m.x, m.y);
        setDepthIfChanged(mv.container, ySortDepth(m.y, 28));
        mv.sprite.setFlipX(m.direction === 'left');
        return true;
      }
    }

    const aggroDetectRadius = activeAggroPlayerId
      ? HUNTING_AI_CONFIG.campLeashRadiusPx
      : HUNTING_AI_CONFIG.campAggroRadiusPx;

    const targetMatch = findTargetPlayerForMonster(
      m.x,
      m.y,
      activePlayers ?? this.resolveActivePlayers(),
      aggroDetectRadius,
      activeAggroPlayerId ?? undefined
    );

    // 플레이어가 기절했거나 탐지 반경을 벗어난 경우 본래 위치로 귀환
    if (!targetMatch) {
      resetMonsterAttackEntry(mv);
      if (distFromHome > 18) {
        const vx = ((homeX - m.x) / distFromHome) * m.speed * 1.1;
        const vy = ((homeY - m.y) / distFromHome) * m.speed * 1.1;
        m.x += vx * dt;
        m.y += vy * dt;
        m.direction = vx < 0 ? 'left' : 'right';
        mv.container.setPosition(m.x, m.y);
        setDepthIfChanged(mv.container, ySortDepth(m.y, 28));
        mv.sprite.setFlipX(m.direction === 'left');
      }
      return true;
    }

    const playerPos = targetMatch.player;
    const distToPlayer = targetMatch.dist;
    const desiredRange = resolveMonsterPlayerAttackRange(role, m.isBoss);

    // 원거리 궁수 카이팅: 플레이어가 너무 붙으면(110px 이내) 뒤로 물러남
    if (role === 'ranged' && distToPlayer < 110 && distFromHome < 420) {
      const vx = ((m.x - playerPos.x) / Math.max(1, distToPlayer)) * m.speed * 0.75 + sepX;
      const vy = ((m.y - playerPos.y) / Math.max(1, distToPlayer)) * m.speed * 0.75 + sepY;
      const clamp = resolveMonsterWallClamping(m.x, m.y, m.x + vx * dt, m.y + vy * dt, 16, aliveWalls);
      m.x = clamp.x;
      m.y = clamp.y;
      m.direction = playerPos.x < m.x ? 'left' : 'right';
      mv.container.setPosition(m.x, m.y);
      setDepthIfChanged(mv.container, ySortDepth(m.y, 28));
      mv.sprite.setFlipX(m.direction === 'left');
    } else if (distToPlayer > desiredRange) {
      resetMonsterAttackEntry(mv);
      const vx = ((playerPos.x - m.x) / distToPlayer) * m.speed + sepX;
      const vy = ((playerPos.y - m.y) / distToPlayer) * m.speed + sepY;
      const clamp = resolveMonsterWallClamping(m.x, m.y, m.x + vx * dt, m.y + vy * dt, 16, aliveWalls);
      m.x = clamp.x;
      m.y = clamp.y;
      m.direction = vx < 0 ? 'left' : 'right';
      mv.container.setPosition(m.x, m.y);
      setDepthIfChanged(mv.container, ySortDepth(m.y, 28));
      mv.sprite.setFlipX(m.direction === 'left');
      return true;
    }

    const baseCooldownMs = role === 'mage' ? 1850 : role === 'ranged' ? 1400 : 1100;
    const cooldownMs = m.eliteAffix === 'berserker' ? Math.round(baseCooldownMs * 0.8) : baseCooldownMs;
    if (canMonsterStrikeInRange(mv, time, cooldownMs)) {
      mv.lastAttackTime = time;
      this.executeRoleAttackOnPlayer(mv, playerPos.x, playerPos.y, playerPos.id);
    }
    return true;
  }

  /**
   * 웨이브 진격 몬스터의 직업 및 보스 여부에 따른 건물·성벽 공격 사거리 반환
   */
  public getWaveRoleAttackRange(mv: MonsterVisual, defaultRange: number): number {
    const role = resolveMonsterCombatRole(mv.monster);
    return resolveMonsterWaveAttackRange(role, defaultRange, mv.monster.isBoss);
  }

  private applyVampiricHeal(mv: MonsterVisual): void {
    const m = mv.monster;
    if (m.eliteAffix !== 'vampiric' || m.hp <= 0 || m.hp >= m.maxHp) return;
    const heal = Math.max(8, Math.round(m.attack * 0.5));
    m.hp = Math.min(m.maxHp, m.hp + heal);
    MonsterVisualManager.updateHpBar(mv);
    this.ctx.showFloatingText(m.x, m.y - 36, `🩸 +${heal}`, '#fb7185');
  }

  public executeRoleAttackOnPlayer(
    mv: MonsterVisual,
    targetX: number,
    targetY: number,
    targetPlayerId?: string
  ): void {
    const m = mv.monster;
    const role = resolveMonsterCombatRole(m);
    const localPlayerId = this.ctx.getLocalPlayerId?.();
    const isRemoteTarget = Boolean(targetPlayerId && localPlayerId && targetPlayerId !== localPlayerId);
    const hasCoopPeers = this.resolveActivePlayers().length > 1;

    MonsterVisualManager.playAttackAnimation(mv, targetX);
    this.ctx.fxRenderer?.playBasicAttackFx({
      role,
      isBoss: m.isBoss || m.isElite,
      startX: m.x,
      startY: m.y,
      targetX,
      targetY,
    });

    if (role === 'ranged' && this.ctx.projectileSystem) {
      sound.playBowRelease();
      if (hasCoopPeers) {
        this.ctx.broadcastMonsterPlayerAttack?.({
          targetPlayerId: targetPlayerId ?? '*',
          monsterId: m.id,
          monsterName: m.name,
          role: 'ranged',
          damage: m.attack,
          startX: m.x,
          startY: m.y - 16,
          targetX,
          targetY,
          projectileTint: m.isBoss ? 0xfbbf24 : 0xf87171,
          projectileSize: m.isBoss ? 40 : 32,
          trailColor: 0xfb923c,
          impactColor: 0xf87171,
          impactRadius: 36,
        });
      }
      this.ctx.projectileSystem.fireProjectile({
        startX: m.x,
        startY: m.y - 16,
        targetX,
        targetY,
        durationMs: 250,
        tint: m.isBoss ? 0xfbbf24 : 0xf87171,
        size: m.isBoss ? 40 : 32,
        trailColor: 0xfb923c,
        impactColor: 0xf87171,
        impactRadius: 36,
        onArrive: () => {
          if (!this.ctx.isLocalPlayerFainted()) {
            const curPlayer = this.ctx.getLocalPlayerPosition();
            if (Math.hypot(curPlayer.x - targetX, curPlayer.y - targetY) <= 58) {
              this.ctx.damageLocalPlayer(m.attack, m.name);
              this.applyVampiricHeal(mv);
              return;
            }
          }
          if (isRemoteTarget && targetPlayerId) {
            const targetNow = this.resolveActivePlayers().find((p) => p.id === targetPlayerId);
            if (targetNow && !targetNow.isFainted && Math.hypot(targetNow.x - targetX, targetNow.y - targetY) <= 58) {
              this.applyVampiricHeal(mv);
            }
          }
        },
      });
      return;
    }

    if (role === 'mage' && this.ctx.projectileSystem) {
      sound.playMagicCast();
      const strikeX = targetX;
      const strikeY = targetY;
      const radius = m.isBoss ? 96 : 78;
      if (this.ctx.broadcastMonsterPlayerAttack && hasCoopPeers) {
        this.ctx.broadcastMonsterPlayerAttack({
          targetPlayerId: '*',
          monsterId: m.id,
          monsterName: m.name,
          role: 'mage',
          damage: m.attack,
          startX: m.x,
          startY: m.y - 18,
          targetX: strikeX,
          targetY: strikeY,
          telegraphRadius: radius,
          telegraphDurationMs: 920,
          telegraphColor: 0xa855f7,
          projectileTint: 0xd946ef,
          projectileSize: m.isBoss ? 50 : 42,
          trailColor: 0xc084fc,
          impactColor: 0xd946ef,
          impactRadius: 56,
        });
      }
      this.ctx.projectileSystem.fireProjectile({
        startX: m.x,
        startY: m.y - 18,
        targetX: strikeX,
        targetY: strikeY,
        durationMs: 310,
        tint: 0xd946ef,
        size: m.isBoss ? 50 : 42,
        isMagic: true,
        trailColor: 0xc084fc,
        impactColor: 0xd946ef,
        impactRadius: 56,
        onArrive: () => {},
      });
      this.ctx.projectileSystem.spawnTelegraphZone({
        x: strikeX,
        y: strikeY,
        radius,
        durationMs: 920,
        color: 0xa855f7,
        onDetonate: () => {
          this.ctx.playExplosionAt(strikeX, strikeY);
          this.ctx.fxRenderer?.playSkillDetonateFx({
            x: strikeX,
            y: strikeY,
            radius,
          });
          if (!this.ctx.isLocalPlayerFainted()) {
            const curPlayer = this.ctx.getLocalPlayerPosition();
            if (Math.hypot(curPlayer.x - strikeX, curPlayer.y - strikeY) <= radius + 4) {
              this.ctx.damageLocalPlayer(m.attack, m.name);
              this.applyVampiricHeal(mv);
            }
          }
        },
      });
      return;
    }

    if (role === 'lancer') {
      sound.playLanceThrust();
    } else {
      sound.playSwordSlash();
    }

    if (isRemoteTarget && targetPlayerId) {
      this.ctx.broadcastMonsterPlayerAttack?.({
        targetPlayerId,
        monsterId: m.id,
        monsterName: m.name,
        role,
        damage: m.attack,
        startX: m.x,
        startY: m.y,
        targetX,
        targetY,
      });
      this.applyVampiricHeal(mv);
      return;
    }

    if (hasCoopPeers) {
      this.ctx.broadcastMonsterPlayerAttack?.({
        targetPlayerId: targetPlayerId ?? localPlayerId ?? 'local',
        monsterId: m.id,
        monsterName: m.name,
        role,
        damage: m.attack,
        startX: m.x,
        startY: m.y,
        targetX,
        targetY,
      });
    }

    this.ctx.damageLocalPlayer(m.attack, m.name);
    this.applyVampiricHeal(mv);
  }

  private performMageSupportHeal(mageMv: MonsterVisual): void {
    const m = mageMv.monster;
    const healAmt = DUNGEON_INVASION_CONFIG.mageHealAmount;
    let healedAny = false;

    for (const ally of this.ctx.getMonsters().values()) {
      if (ally.monster.hp <= 0 || ally.monster.hp >= ally.monster.maxHp) continue;
      if (Math.hypot(ally.monster.x - m.x, ally.monster.y - m.y) <= 240) {
        ally.monster.hp = Math.min(ally.monster.maxHp, ally.monster.hp + healAmt);
        MonsterVisualManager.updateHpBar(ally);
        healedAny = true;
      }
    }

    if (m.campTerritoryId !== undefined) {
      this.ctx.healCampCore?.(m.campTerritoryId, healAmt);
    }

    if (healedAny) {
      this.ctx.fxRenderer?.playAnim('healFx', 'heal_anim', m.x, m.y - 10, 130, 0xc084fc);
      this.ctx.showFloatingText(m.x, m.y - 38, `✨ 주술 치유 +${healAmt}`, '#c084fc');
    }
  }
}
