import Phaser from 'phaser';
import { HUNTING_AI_CONFIG } from '../../data/monsterCamps';
import { PERFORMANCE_CONFIG } from '../../data/performanceConfig';
import { MONSTER_KILL_REWARDS } from '../../data/waves';
import { PLAYER_COMBAT_CONFIG } from '../../data/worldRules';
import { CombatHitFeedbackOptions } from '../../types/combat';
import { ConstructedBuilding, Island } from '../../types/game';
import { sound } from '../../lib/sound';
import {
  getBuildingCollisionBox,
  getTerritoryMainBuilding,
} from '../constants';
import { setDepthIfChanged, ySortDepth } from '../depthLayers';
import { MonsterSpatialGrid } from '../utils/spatialGrid';
import { findNextInwardTargetTerritory } from '../utils/waveUtils';
import {
  getMonsterWallCollisionBox,
  nearestPointOnCollisionBox,
  resolveMonsterWallClamping,
} from '../wallCollisionGeometry';
import { MonsterRangedMageAI } from './MonsterRangedMageAI';
import { MonsterVisual, MonsterVisualManager } from './MonsterVisualManager';
import { ProjectileSystem } from './ProjectileSystem';

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
  healCampCore?: (territoryId: number, amount: number) => void;
  projectileSystem?: ProjectileSystem;
  onMonsterDamaged?: () => void;
  onMonsterHitImpact?: (opts: CombatHitFeedbackOptions, restoreTint?: number | null) => void;
  onMonsterKilled?: (
    x: number,
    y: number,
    isBoss: boolean,
    expReward: number,
    isCampMonster: boolean,
    meta?: { isElite: boolean; campRing?: 1 | 2 | 3 | 4 }
  ) => void;
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
 * 마물 웨이브 유닛의 목표 영지 추적, 플레이어 반격 어그로, 부락 수비병 AI,
 * 100마리 군집 분리(SpatialGrid Separation) 및 성벽/건물/본진 공격 AI 전담 모듈
 */
export class MonsterCombatAI {
  private ctx: IMonsterCombatContext;
  private blockerCache = new Map<string, CachedBlockerTarget>();
  private aggroTargets = new Map<string, MonsterAggroTarget>();
  private spatialGrid = new MonsterSpatialGrid();
  private rangedMageAI: MonsterRangedMageAI;

  constructor(ctx: IMonsterCombatContext) {
    this.ctx = ctx;
    this.rangedMageAI = new MonsterRangedMageAI({
      getMonsters: ctx.getMonsters,
      getLocalPlayerPosition: ctx.getLocalPlayerPosition,
      isLocalPlayerFainted: ctx.isLocalPlayerFainted,
      damageLocalPlayer: ctx.damageLocalPlayer,
      healCampCore: ctx.healCampCore,
      projectileSystem: ctx.projectileSystem,
      playExplosionAt: ctx.playExplosionAt,
      showFloatingText: ctx.showFloatingText,
    });
  }

  public getSpatialGrid(): MonsterSpatialGrid {
    return this.spatialGrid;
  }

  public updateMonsters(time: number, delta: number): void {
    const dt = delta / 1000;
    const monstersMap = this.ctx.getMonsters();
    if (monstersMap.size === 0) return;

    this.spatialGrid.rebuild(monstersMap);

    const islands = this.ctx.getIslands();
    const constructedBuildings = this.ctx.getConstructedBuildings();
    const aliveWalls = constructedBuildings.filter(
      (cb) => cb.category === 'wall' && cb.hp > 0
    );

    for (const mv of monstersMap.values()) {
      const m = mv.monster;
      const sep = this.spatialGrid.computeSeparation(m.id, m.x, m.y);

      const existingAggro = this.aggroTargets.get(m.id);
      const hasActiveAggro =
        Boolean(existingAggro) &&
        existingAggro!.playerId === this.ctx.getLocalPlayerId() &&
        performance.now() <= existingAggro!.expiresAt;

      // 0-A순위: 몬스터 부락 주둔 수비병(근거리/창병/원거리/마법사) AI
      if (
        this.rangedMageAI.tryUpdateCampMonster(
          mv,
          time,
          dt,
          aliveWalls,
          sep.pushX,
          sep.pushY,
          hasActiveAggro
        )
      ) {
        continue;
      }

      // 0-B순위: 플레이어에게 피격당했거나 근접한 웨이브/던전 몬스터의 플레이어 추격·공격 처리
      if (this.tryUpdatePlayerAggro(mv, time, dt, aliveWalls, sep.pushX, sep.pushY)) {
        continue;
      }

      let targetIsl = islands.find((i) => i.id === m.targetTerritoryId && i.unlocked);
      if (!targetIsl) {
        m.targetTerritoryId = findNextInwardTargetTerritory(m.x, m.y, islands);
        targetIsl = islands.find((i) => i.id === m.targetTerritoryId) || islands[0];
      }

      const mainBld = getTerritoryMainBuilding(
        targetIsl.id,
        targetIsl.gridX,
        targetIsl.gridY,
        targetIsl.villageTier
      );
      const mainHitBox = getBuildingCollisionBox(mainBld);
      const mainHit = nearestPointOnCollisionBox(m.x, m.y, mainHitBox);

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
      const distToTarget = Math.max(1, Math.hypot(targetX - m.x, targetY - m.y));
      const baseAttackRange = blockingBuilding
        ? blockingBuilding.category === 'wall'
          ? 36
          : 52
        : 36;
      const attackRange = this.rangedMageAI.getWaveRoleAttackRange(mv, baseAttackRange);

      let canAttackNow = distToTarget <= attackRange;

      if (!canAttackNow) {
        const vx = ((targetX - m.x) / distToTarget) * m.speed + sep.pushX;
        const vy = ((targetY - m.y) / distToTarget) * m.speed + sep.pushY;
        const nextX = m.x + vx * dt;
        const nextY = m.y + vy * dt;

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

      if (canAttackNow && time - mv.lastAttackTime >= 1150) {
        mv.lastAttackTime = time;
        if (!this.ctx.isHost()) continue;

        if ((m.role === 'ranged' || m.role === 'mage') && this.ctx.projectileSystem) {
          this.ctx.projectileSystem.fireProjectile({
            startX: m.x,
            startY: m.y - 16,
            targetX,
            targetY,
            durationMs: 210,
            tint: m.role === 'mage' ? 0xc084fc : 0xf87171,
            size: 30,
            isMagic: m.role === 'mage',
            onArrive: () => {},
          });
        }

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
    hitMeta?: { isSkill?: boolean; isCrit?: boolean };
  }): boolean {
    const monsters = this.ctx.getMonsters();
    const mv = monsters.get(params.monsterId);
    if (!mv) return false;

    const isLocalPlayerAttack = Boolean(
      !params.fromRemote && params.attackerId && params.attackerId === this.ctx.getLocalPlayerId()
    );
    const playerPos = this.ctx.getLocalPlayerPosition();

    if (params.attackerId) {
      this.aggroTargets.set(params.monsterId, {
        playerId: params.attackerId,
        expiresAt: performance.now() + PLAYER_COMBAT_CONFIG.monsterAggroDurationMs,
      });
      if (mv.monster.campTerritoryId !== undefined) {
        this.aggroCampMonsters(mv.monster.campTerritoryId, params.attackerId);
      }
    }

    const triggerHitFeedback = () => {
      this.ctx.onMonsterHitImpact?.(
        {
          x: mv.monster.x,
          y: mv.monster.y,
          damage: params.damage,
          isCrit: params.hitMeta?.isCrit,
          isSkill: params.hitMeta?.isSkill,
          isLocalPlayerAttack,
          attackerX: playerPos.x,
          attackerY: playerPos.y,
          targetSprite: mv.sprite,
          targetContainer: mv.container,
        },
        mv.baseTint
      );
    };

    if (!params.isHost && !params.fromRemote) {
      mv.monster.hp = Math.max(1, mv.monster.hp - params.damage);
      MonsterVisualManager.updateHpBar(mv, true);
      this.ctx.showFloatingText(
        mv.monster.x,
        mv.monster.y - 25,
        `-${params.damage}`,
        mv.monster.isBoss ? '#f43f5e' : '#fbbf24'
      );
      this.ctx.shakeObject(mv.container);
      triggerHitFeedback();
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
      MonsterVisualManager.updateHpBar(mv, true);
      triggerHitFeedback();
      this.ctx.onMonsterDamaged?.();
      return false;
    }

    triggerHitFeedback();
    const deadM = mv.monster;
    this.ctx.playExplosionAt(deadM.x, deadM.y);
    mv.container.destroy();
    monsters.delete(params.monsterId);
    this.blockerCache.delete(params.monsterId);
    this.aggroTargets.delete(params.monsterId);

    // 정예 '비전 폭발' 능력: 사망 시 1.1초 예고 후 110px 반경 폭발 피해
    if (deadM.eliteAffix === 'arcane_nova' && this.ctx.projectileSystem) {
      const novaX = deadM.x;
      const novaY = deadM.y;
      const novaDamage = Math.round(deadM.attack * 1.45);
      this.ctx.showFloatingText(novaX, novaY - 40, '💀 비전 폭발 경고!', '#e879f9');
      this.ctx.projectileSystem.spawnTelegraphZone({
        x: novaX,
        y: novaY,
        radius: 110,
        durationMs: 1100,
        color: 0xd946ef,
        onDetonate: () => {
          this.ctx.playExplosionAt(novaX, novaY);
          const curPlayer = this.ctx.getLocalPlayerPosition();
          if (Math.hypot(curPlayer.x - novaX, curPlayer.y - novaY) <= 112) {
            this.ctx.damageLocalPlayer(novaDamage, `${deadM.name} (비전 폭발)`);
          }
        },
      });
    }

    const rewardTier = deadM.isBoss ? MONSTER_KILL_REWARDS.boss : MONSTER_KILL_REWARDS.regular;
    const rewardWood = Math.round(rewardTier.wood * params.bonusMultiplier);
    const rewardStone = Math.round(rewardTier.stone * params.bonusMultiplier);
    const rewardGold = Math.round(rewardTier.gold * params.bonusMultiplier);
    const expReward = deadM.expReward ?? (deadM.isBoss ? 120 : 16);

    this.ctx.addRewardResources(rewardWood, rewardStone, rewardGold);
    sound.playUnlock();
    const rewardText = deadM.isBoss
      ? `🏆 보스 처치! (+🪵${rewardWood} +🪨${rewardStone} +🪙${rewardGold} +✨${expReward}EXP)`
      : `⚔️ +🪵${rewardWood} +🪨${rewardStone} +🪙${rewardGold} (+${expReward}EXP)`;
    this.ctx.showFloatingText(deadM.x, deadM.y - 45, rewardText, '#4ade80');
    this.ctx.onMonsterKilled?.(deadM.x, deadM.y, deadM.isBoss, expReward, Boolean(deadM.isCampMonster), {
      isElite: Boolean(deadM.isElite),
      campRing: deadM.campRing,
    });
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

  public aggroCampMonsters(campTerritoryId: number, playerId: string): void {
    const expiresAt = performance.now() + HUNTING_AI_CONFIG.campAlertDurationMs;
    for (const mv of this.ctx.getMonsters().values()) {
      if (mv.monster.campTerritoryId === campTerritoryId) {
        this.aggroTargets.set(mv.monster.id, { playerId, expiresAt });
      }
    }
  }

  private tryUpdatePlayerAggro(
    mv: MonsterVisual,
    time: number,
    dt: number,
    aliveWalls: ConstructedBuilding[],
    sepX: number,
    sepY: number
  ): boolean {
    if (this.ctx.isLocalPlayerFainted()) {
      this.aggroTargets.delete(mv.monster.id);
      return false;
    }

    const m = mv.monster;
    const playerPos = this.ctx.getLocalPlayerPosition();
    const dist = Math.hypot(playerPos.x - m.x, playerPos.y - m.y);
    let aggro = this.aggroTargets.get(m.id);

    // 근접 어그로: 웨이브/던전 몬스터가 진격 중 일정 반경 내 플레이어를 발견하면 즉시 추격·공격
    if (!aggro && dist <= HUNTING_AI_CONFIG.waveProximityAggroRadiusPx) {
      aggro = {
        playerId: this.ctx.getLocalPlayerId(),
        expiresAt: performance.now() + PLAYER_COMBAT_CONFIG.monsterAggroDurationMs,
      };
      this.aggroTargets.set(m.id, aggro);
    }

    if (!aggro || aggro.playerId !== this.ctx.getLocalPlayerId()) return false;

    if (performance.now() > aggro.expiresAt || dist > HUNTING_AI_CONFIG.waveProximityChaseMaxPx) {
      this.aggroTargets.delete(m.id);
      return false;
    }

    const baseRange = m.isBoss
      ? PLAYER_COMBAT_CONFIG.monsterBossPlayerAttackRange
      : PLAYER_COMBAT_CONFIG.monsterPlayerAttackRange;
    const attackRange = this.rangedMageAI.getWaveRoleAttackRange(mv, baseRange);

    if (dist > attackRange) {
      const vx = ((playerPos.x - m.x) / dist) * m.speed + sepX;
      const vy = ((playerPos.y - m.y) / dist) * m.speed + sepY;
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
      this.rangedMageAI.executeRoleAttackOnPlayer(mv, playerPos.x, playerPos.y);
    }
    return true;
  }
}
