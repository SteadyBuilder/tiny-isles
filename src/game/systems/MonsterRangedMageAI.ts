import { DUNGEON_INVASION_CONFIG, HUNTING_AI_CONFIG } from '../../data/monsterCamps';
import { ConstructedBuilding } from '../../types/game';
import { setDepthIfChanged, ySortDepth } from '../depthLayers';
import { resolveMonsterWallClamping } from '../wallCollisionGeometry';
import { MonsterVisual, MonsterVisualManager } from './MonsterVisualManager';
import { ProjectileSystem } from './ProjectileSystem';

export interface IMonsterRangedMageContext {
  getMonsters: () => Map<string, MonsterVisual>;
  getLocalPlayerPosition: () => { x: number; y: number };
  isLocalPlayerFainted: () => boolean;
  damageLocalPlayer: (damage: number, attackerName: string) => void;
  healCampCore?: (territoryId: number, amount: number) => void;
  clearMonsterAggro?: (monsterId: string) => void;
  projectileSystem?: ProjectileSystem;
  playExplosionAt: (x: number, y: number) => void;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
}

/**
 * 몬스터 부락 수비병(isCampMonster)의 영역 순찰/어그로/귀환 및
 * 병과별(원거리 궁수 화살 사격, 마법사 장판 폭발·주술 치유) 특수 전투 AI 전담 모듈
 */
export class MonsterRangedMageAI {
  private ctx: IMonsterRangedMageContext;
  private returningHome = new Set<string>();

  constructor(ctx: IMonsterRangedMageContext) {
    this.ctx = ctx;
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
    hasActiveAggro = false
  ): boolean {
    const m = mv.monster;
    if (!m.isCampMonster) return false;

    const homeX = m.homeX ?? m.x;
    const homeY = m.homeY ?? m.y;
    const playerPos = this.ctx.getLocalPlayerPosition();
    const playerFainted = this.ctx.isLocalPlayerFainted();
    const distToPlayer = Math.hypot(playerPos.x - m.x, playerPos.y - m.y);
    const distFromHome = Math.hypot(m.x - homeX, m.y - homeY);

    // 마법사 주술 치유: 4.5초마다 주변 부락 동료 및 부락 본진 체력 회복
    if (m.role === 'mage' && time - (mv.lastHealTime ?? 0) >= 4500) {
      mv.lastHealTime = time;
      this.performMageSupportHeal(mv);
    }

    // 추격 한계(보이지 않는 벽)에 도달하면 어그로를 해제하고 빠른 속도로 스폰 부락으로 복귀
    if (distFromHome > HUNTING_AI_CONFIG.campLeashRadiusPx) {
      this.returningHome.add(m.id);
      this.ctx.clearMonsterAggro?.(m.id);
    }

    if (this.returningHome.has(m.id)) {
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

    const aggroDetectRadius = hasActiveAggro
      ? HUNTING_AI_CONFIG.campLeashRadiusPx
      : HUNTING_AI_CONFIG.campAggroRadiusPx;

    // 플레이어가 기절했거나 탐지 반경을 벗어난 경우 본래 위치로 귀환
    if (playerFainted || distToPlayer > aggroDetectRadius) {
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

    // 병과별 사거리 산정 (근접 56px, 창병 95px, 원거리 265px, 마법사 295px)
    const desiredRange =
      m.role === 'mage'
        ? DUNGEON_INVASION_CONFIG.mageAttackRangePx
        : m.role === 'ranged'
        ? DUNGEON_INVASION_CONFIG.rangedAttackRangePx
        : m.role === 'lancer'
        ? 95
        : 58;

    // 원거리 궁수 카이팅: 플레이어가 너무 붙으면(110px 이내) 뒤로 물러남
    if (m.role === 'ranged' && distToPlayer < 110 && distFromHome < 420) {
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

    const baseCooldownMs = m.role === 'mage' ? 1850 : m.role === 'ranged' ? 1400 : 1100;
    const cooldownMs = m.eliteAffix === 'berserker' ? Math.round(baseCooldownMs * 0.8) : baseCooldownMs;
    if (time - mv.lastAttackTime >= cooldownMs) {
      mv.lastAttackTime = time;
      this.executeRoleAttackOnPlayer(mv, playerPos.x, playerPos.y);
    }
    return true;
  }

  /**
   * 웨이브 진격 몬스터 중 원거리/마법사 병과가 성벽이나 본진을 원거리에서 포격할 수 있도록 사거리 반환
   */
  public getWaveRoleAttackRange(mv: MonsterVisual, defaultRange: number): number {
    const role = mv.monster.role;
    if (role === 'mage') return 220;
    if (role === 'ranged') return 195;
    if (role === 'lancer') return 82;
    return defaultRange;
  }

  private applyVampiricHeal(mv: MonsterVisual): void {
    const m = mv.monster;
    if (m.eliteAffix !== 'vampiric' || m.hp <= 0 || m.hp >= m.maxHp) return;
    const heal = Math.max(8, Math.round(m.attack * 0.5));
    m.hp = Math.min(m.maxHp, m.hp + heal);
    MonsterVisualManager.updateHpBar(mv);
    this.ctx.showFloatingText(m.x, m.y - 36, `🩸 +${heal}`, '#fb7185');
  }

  public executeRoleAttackOnPlayer(mv: MonsterVisual, targetX: number, targetY: number): void {
    const m = mv.monster;

    if (m.role === 'ranged' && this.ctx.projectileSystem) {
      this.ctx.projectileSystem.fireProjectile({
        startX: m.x,
        startY: m.y - 16,
        targetX,
        targetY,
        durationMs: 260,
        tint: 0xf87171,
        size: 32,
        onArrive: () => {
          const curPlayer = this.ctx.getLocalPlayerPosition();
          if (Math.hypot(curPlayer.x - targetX, curPlayer.y - targetY) <= 58) {
            this.ctx.damageLocalPlayer(m.attack, m.name);
            this.applyVampiricHeal(mv);
          }
        },
      });
      return;
    }

    if (m.role === 'mage' && this.ctx.projectileSystem) {
      const strikeX = targetX;
      const strikeY = targetY;
      if (mv.sprite.scene?.anims.exists('monster_archmage_cast')) {
        mv.sprite.play('monster_archmage_cast', true);
        mv.sprite.once('animationcomplete', () => {
          if (mv.sprite.active && mv.sprite.scene?.anims.exists('monster_archmage_run')) {
            mv.sprite.play('monster_archmage_run', true);
          }
        });
      }
      this.ctx.projectileSystem.fireProjectile({
        startX: m.x,
        startY: m.y - 18,
        targetX: strikeX,
        targetY: strikeY,
        durationMs: 320,
        tint: 0xd946ef,
        size: 42,
        isMagic: true,
        onArrive: () => {},
      });
      this.ctx.projectileSystem.spawnTelegraphZone({
        x: strikeX,
        y: strikeY,
        radius: 78,
        durationMs: 950,
        color: 0xa855f7,
        onDetonate: () => {
          this.ctx.playExplosionAt(strikeX, strikeY);
          const curPlayer = this.ctx.getLocalPlayerPosition();
          if (Math.hypot(curPlayer.x - strikeX, curPlayer.y - strikeY) <= 82) {
            this.ctx.damageLocalPlayer(m.attack, m.name);
            this.applyVampiricHeal(mv);
          }
        },
      });
      return;
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
      this.ctx.showFloatingText(m.x, m.y - 38, `✨ 주술 치유 +${healAmt}`, '#c084fc');
    }
  }
}
