import Phaser from 'phaser';
import { PERFORMANCE_CONFIG } from '../../data/performanceConfig';
import { MONSTER_KILL_REWARDS } from '../../data/waves';
import { PLAYER_COMBAT_CONFIG } from '../../data/worldRules';
import { ConstructedBuilding, Island } from '../../types/game';
import { sound } from '../../lib/sound';
import {
  getBuildingCollisionBox,
  getTerritoryMainBuilding,
} from '../constants';
import { setDepthIfChanged, ySortDepth } from '../depthLayers';
import { findNextInwardTargetTerritory } from '../utils/waveUtils';
import {
  getMonsterWallCollisionBox,
  nearestPointOnCollisionBox,
  resolveMonsterWallClamping,
} from '../wallCollisionGeometry';
import { MonsterVisual, MonsterVisualManager } from './MonsterVisualManager';

export interface IMonsterCombatContext {
  getMonsters: () => Map<string, MonsterVisual>;
  getIslands: () => Island[];
  getConstructedBuildings: () => ConstructedBuilding[];
  updateConstructedBuildingHpBar: (buildingId: string) => void;
  getConstructedVisualContainer: (buildingId: string) => Phaser.GameObjects.Container | undefined;
  destroyConstructedBuilding: (buildingId: string) => void;
  onBuildingDamaged?: (buildingId: string, hp: number, maxHp: number, damageDelta: number) => void;
  isHost: () => boolean;
  damageTerritoryCore: (territoryId: number, damage: number, attackerName: string) => void;
  getLocalPlayerId: () => string;
  getLocalPlayerPosition: () => { x: number; y: number };
  isLocalPlayerFainted: () => boolean;
  damageLocalPlayer: (damage: number, attackerName: string) => void;
  onMonsterDamaged?: () => void;
  onMonsterKilled?: (x: number, y: number, isBoss: boolean) => void;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
  shakeObject: (target: Phaser.GameObjects.Container) => void;
  playExplosionAt: (x: number, y: number) => void;
  addRewardResources: (wood: number, stone: number, gold: number) => void;
  broadcastMonsterHit?: (monsterId: string, damage: number, attackerName: string) => void;
}

interface CachedBlockerTarget {
  lastSearchTime: number;
  buildingId: string | null;
  targetX: number;
  targetY: number;
}

interface MonsterAggroTarget {
  playerId: string;
  expiresAt: number;
}

/**
 * 마물 웨이브 유닛의 목표 영지 추적, 플레이어 반격 어그로, 성벽 충돌 클램핑, 방책/건물/본진 공격 AI 전담 모듈
 */
export class MonsterCombatAI {
  private ctx: IMonsterCombatContext;
  private blockerCache = new Map<string, CachedBlockerTarget>();
  private aggroTargets = new Map<string, MonsterAggroTarget>();

  constructor(ctx: IMonsterCombatContext) {
    this.ctx = ctx;
  }

  public updateMonsters(time: number, delta: number): void {
    const dt = delta / 1000;
    const islands = this.ctx.getIslands();
    const constructedBuildings = this.ctx.getConstructedBuildings();
    const aliveWalls = constructedBuildings.filter(
      (cb) => cb.category === 'wall' && cb.hp > 0
    );

    for (const mv of this.ctx.getMonsters().values()) {
      const m = mv.monster;

      // 0순위: 플레이어에게 피격당한 몬스터의 반격 어그로 처리
      if (this.tryUpdatePlayerAggro(mv, time, dt, aliveWalls)) {
        continue;
      }

      // 타겟 영지가 이미 상실된 경우 다음 안쪽 영지(중심 마을 방향)로 재설정
      let targetIsl = islands.find((i) => i.id === m.targetTerritoryId && i.unlocked);
      if (!targetIsl) {
        m.targetTerritoryId = findNextInwardTargetTerritory(m.x, m.y, islands);
        targetIsl = islands.find((i) => i.id === m.targetTerritoryId) || islands[0];
      }

      // 2순위 목표: 영지 본진 건물 피격 범위 콜라이더(스프라이트 크기별)의 가장 가까운 외곽점
      const mainBld = getTerritoryMainBuilding(
        targetIsl.id,
        targetIsl.gridX,
        targetIsl.gridY,
        targetIsl.villageTier
      );
      const mainHitBox = getBuildingCollisionBox(mainBld);
      const mainHit = nearestPointOnCollisionBox(m.x, m.y, mainHitBox);

      // 1순위: 전 영지 성벽 및 목표 영지 내 방해 건물 탐색 (150ms 주기 캐싱으로 O(M*B) 프레임 부하 절감)
      let blockingBuilding: ConstructedBuilding | null = null;
      let blockingTargetX = mainHit.x;
      let blockingTargetY = mainHit.y;

      const cached = this.blockerCache.get(m.id);
      const canUseCache =
        cached &&
        time - cached.lastSearchTime < PERFORMANCE_CONFIG.monsterTargetSearchIntervalMs;

      if (canUseCache) {
        if (cached.buildingId) {
          const found = constructedBuildings.find(
            (cb) => cb.id === cached.buildingId && cb.hp > 0
          );
          if (found) {
            blockingBuilding = found;
            blockingTargetX = cached.targetX;
            blockingTargetY = cached.targetY;
          }
        }
      } else {
        let minBldDist = 96;
        for (const cb of constructedBuildings) {
          if (cb.hp <= 0) continue;
          if (cb.category !== 'wall' && cb.territoryId !== targetIsl.id) continue;

          let nearestX = cb.x;
          let nearestY = cb.y;
          let d = Math.hypot(m.x - cb.x, m.y - cb.y);

          if (cb.category === 'wall') {
            const solidBox = getMonsterWallCollisionBox(cb);
            if (solidBox) {
              const hit = nearestPointOnCollisionBox(m.x, m.y, solidBox);
              d = hit.dist;
              nearestX = hit.x;
              nearestY = hit.y;
            }
          }

          const threshold = cb.category === 'wall' ? 96 : 85;
          if (d < threshold && d < minBldDist) {
            minBldDist = d;
            blockingBuilding = cb;
            blockingTargetX = nearestX;
            blockingTargetY = nearestY;
          }
        }

        this.blockerCache.set(m.id, {
          lastSearchTime: time,
          buildingId: blockingBuilding ? blockingBuilding.id : null,
          targetX: blockingTargetX,
          targetY: blockingTargetY,
        });
      }

      let targetX = blockingBuilding ? blockingTargetX : mainHit.x;
      let targetY = blockingBuilding ? blockingTargetY : mainHit.y;
      const distToTarget = Math.hypot(targetX - m.x, targetY - m.y);
      const attackRange = blockingBuilding
        ? blockingBuilding.category === 'wall'
          ? 36
          : 52
        : 36;

      let canAttackNow = distToTarget <= attackRange;

      if (!canAttackNow) {
        const vx = ((targetX - m.x) / distToTarget) * m.speed;
        const vy = ((targetY - m.y) / distToTarget) * m.speed;
        const nextX = m.x + vx * dt;
        const nextY = m.y + vy * dt;

        // 성벽 관통 방지 클램핑 (전 영지 살아있는 성벽 대상)
        const clamp = resolveMonsterWallClamping(m.x, m.y, nextX, nextY, 16, aliveWalls);
        m.x = clamp.x;
        m.y = clamp.y;
        m.direction = vx < 0 ? 'left' : 'right';

        mv.container.setPosition(m.x, m.y);
        setDepthIfChanged(mv.container, ySortDepth(m.y, 28));
        mv.sprite.setFlipX(m.direction === 'left');

        if (clamp.blockedBy) {
          blockingBuilding = clamp.blockedBy;
          const solidBox = getMonsterWallCollisionBox(clamp.blockedBy);
          if (solidBox) {
            const hit = nearestPointOnCollisionBox(m.x, m.y, solidBox);
            targetX = hit.x;
            targetY = hit.y;
          } else {
            targetX = clamp.blockedBy.x;
            targetY = clamp.blockedBy.y;
          }
          this.blockerCache.set(m.id, {
            lastSearchTime: time,
            buildingId: clamp.blockedBy.id,
            targetX,
            targetY,
          });
          canAttackNow = true;
        }
      }

      if (canAttackNow && time - mv.lastAttackTime >= 1100) {
        mv.lastAttackTime = time;
        if (!this.ctx.isHost()) continue;

        if (blockingBuilding) {
          blockingBuilding.hp = Math.max(0, blockingBuilding.hp - m.attack);
          this.ctx.updateConstructedBuildingHpBar(blockingBuilding.id);
          const bCont = this.ctx.getConstructedVisualContainer(blockingBuilding.id);
          if (bCont) this.ctx.shakeObject(bCont);

          this.ctx.showFloatingText(targetX, targetY - 30, `🛡️ -${m.attack}`, '#fb923c');

          if (blockingBuilding.hp <= 0) {
            this.ctx.destroyConstructedBuilding(blockingBuilding.id);
          } else {
            this.ctx.onBuildingDamaged?.(
              blockingBuilding.id,
              blockingBuilding.hp,
              blockingBuilding.maxHp,
              m.attack
            );
          }
        } else {
          // 2순위: 점령 영지의 코어 보석 직접 공격
          this.ctx.damageTerritoryCore(targetIsl.id, m.attack, m.name);
        }
      }
    }
  }

  public damageMonster(params: {
    monsterId: string;
    damage: number;
    sourceName: string;
    attackerId?: string;
    fromRemote: boolean;
    isHost: boolean;
    bonusMultiplier: number;
  }): boolean {
    const monsters = this.ctx.getMonsters();
    const mv = monsters.get(params.monsterId);
    if (!mv) return false;

    if (params.attackerId) {
      this.aggroTargets.set(params.monsterId, {
        playerId: params.attackerId,
        expiresAt: performance.now() + PLAYER_COMBAT_CONFIG.monsterAggroDurationMs,
      });
    }

    // 게스트는 호스트에게 피격 이벤트를 전송하되, 즉각적인 타격감을 위해 로컬 HP 바를 낙관적으로 반영
    if (!params.isHost && !params.fromRemote) {
      mv.monster.hp = Math.max(1, mv.monster.hp - params.damage);
      MonsterVisualManager.updateHpBar(mv);
      this.ctx.showFloatingText(
        mv.monster.x,
        mv.monster.y - 25,
        `-${params.damage}`,
        mv.monster.isBoss ? '#f43f5e' : '#fbbf24'
      );
      this.ctx.shakeObject(mv.container);
      this.ctx.broadcastMonsterHit?.(params.monsterId, params.damage, params.sourceName);
      return false;
    }

    mv.monster.hp = Math.max(0, mv.monster.hp - params.damage);
    this.ctx.showFloatingText(
      mv.monster.x,
      mv.monster.y - 25,
      `-${params.damage}`,
      mv.monster.isBoss ? '#f43f5e' : '#fbbf24'
    );

    if (mv.monster.hp > 0) {
      this.ctx.shakeObject(mv.container);
      MonsterVisualManager.updateHpBar(mv);
      this.ctx.onMonsterDamaged?.();
      return false;
    }

    const deadM = mv.monster;
    this.ctx.playExplosionAt(deadM.x, deadM.y);
    mv.container.destroy();
    monsters.delete(params.monsterId);
    this.blockerCache.delete(params.monsterId);
    this.aggroTargets.delete(params.monsterId);

    const rewardTier = deadM.isBoss ? MONSTER_KILL_REWARDS.boss : MONSTER_KILL_REWARDS.regular;
    const rewardWood = Math.round(rewardTier.wood * params.bonusMultiplier);
    const rewardStone = Math.round(rewardTier.stone * params.bonusMultiplier);
    const rewardGold = Math.round(rewardTier.gold * params.bonusMultiplier);

    this.ctx.addRewardResources(rewardWood, rewardStone, rewardGold);
    sound.playUnlock();
    const rewardText = deadM.isBoss
      ? `🏆 보스 처치! (+🪵${rewardWood} +🪨${rewardStone} +🪙${rewardGold})`
      : `⚔️ 마물 처치! (+🪵${rewardWood} +🪨${rewardStone} +🪙${rewardGold})`;
    this.ctx.showFloatingText(deadM.x, deadM.y - 45, rewardText, '#4ade80');
    this.ctx.onMonsterKilled?.(deadM.x, deadM.y, deadM.isBoss);
    return true;
  }

  public retargetFromLostTerritory(territoryId: number): void {
    const islands = this.ctx.getIslands();
    for (const mv of this.ctx.getMonsters().values()) {
      if (mv.monster.targetTerritoryId === territoryId) {
        mv.monster.targetTerritoryId = findNextInwardTargetTerritory(
          mv.monster.x,
          mv.monster.y,
          islands
        );
      }
    }
  }

  public pruneStaleMonsterState(validIds: Set<string>): void {
    for (const id of this.blockerCache.keys()) {
      if (!validIds.has(id)) {
        this.blockerCache.delete(id);
      }
    }
    for (const id of this.aggroTargets.keys()) {
      if (!validIds.has(id)) {
        this.aggroTargets.delete(id);
      }
    }
  }

  private tryUpdatePlayerAggro(
    mv: MonsterVisual,
    time: number,
    dt: number,
    aliveWalls: ConstructedBuilding[]
  ): boolean {
    const m = mv.monster;
    const aggro = this.aggroTargets.get(m.id);
    if (!aggro) return false;

    if (aggro.playerId !== this.ctx.getLocalPlayerId()) {
      return false;
    }

    if (this.ctx.isLocalPlayerFainted() || performance.now() > aggro.expiresAt) {
      this.aggroTargets.delete(m.id);
      return false;
    }

    const playerPos = this.ctx.getLocalPlayerPosition();
    const dist = Math.hypot(playerPos.x - m.x, playerPos.y - m.y);
    if (dist > PLAYER_COMBAT_CONFIG.monsterAggroMaxDistance) {
      this.aggroTargets.delete(m.id);
      return false;
    }

    const attackRange = m.isBoss
      ? PLAYER_COMBAT_CONFIG.monsterBossPlayerAttackRange
      : PLAYER_COMBAT_CONFIG.monsterPlayerAttackRange;

    if (dist > attackRange) {
      const vx = ((playerPos.x - m.x) / dist) * m.speed;
      const vy = ((playerPos.y - m.y) / dist) * m.speed;
      const clamp = resolveMonsterWallClamping(
        m.x,
        m.y,
        m.x + vx * dt,
        m.y + vy * dt,
        16,
        aliveWalls
      );
      m.x = clamp.x;
      m.y = clamp.y;
      m.direction = vx < 0 ? 'left' : 'right';
      mv.container.setPosition(m.x, m.y);
      setDepthIfChanged(mv.container, ySortDepth(m.y, 28));
      mv.sprite.setFlipX(m.direction === 'left');
      return true;
    }

    if (time - mv.lastAttackTime >= PLAYER_COMBAT_CONFIG.monsterAttackCooldownMs) {
      mv.lastAttackTime = time;
      this.ctx.damageLocalPlayer(m.attack, m.name);
    }
    return true;
  }
}
