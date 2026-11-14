import Phaser from 'phaser';
import { ConstructedBuilding, Island } from '../../types/game';
import { sound } from '../../lib/sound';
import { getTerritoryCorePos } from '../constants';
import { ySortDepth } from '../depthLayers';
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
  onBuildingDamaged?: () => void;
  damageTerritoryCore: (territoryId: number, damage: number, attackerName: string) => void;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
  shakeObject: (target: Phaser.GameObjects.Container) => void;
  playExplosionAt: (x: number, y: number) => void;
  addRewardResources: (wood: number, stone: number, gold: number) => void;
  broadcastMonsterHit?: (monsterId: string, damage: number, attackerName: string) => void;
}

/**
 * 마물 웨이브 유닛의 목표 영지 추적, 성벽 충돌 클램핑, 방책/건물/코어 공격 AI 전담 모듈
 */
export class MonsterCombatAI {
  private ctx: IMonsterCombatContext;

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

      // 타겟 영지가 이미 상실된 경우 다음 안쪽 영지(중심 마을 방향)로 재설정
      let targetIsl = islands.find((i) => i.id === m.targetTerritoryId && i.unlocked);
      if (!targetIsl) {
        m.targetTerritoryId = findNextInwardTargetTerritory(m.x, m.y, islands);
        targetIsl = islands.find((i) => i.id === m.targetTerritoryId) || islands[0];
      }

      const corePos = getTerritoryCorePos(targetIsl.gridX, targetIsl.gridY);

      // 1순위: 전 영지 성벽(성문 포함 닫힌 방책) 및 목표 영지 내 방해 건물 탐색
      let blockingBuilding: ConstructedBuilding | null = null;
      let blockingTargetX = corePos.x;
      let blockingTargetY = corePos.y;
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

      let targetX = blockingBuilding ? blockingTargetX : corePos.x;
      let targetY = blockingBuilding ? blockingTargetY : corePos.y;
      const distToTarget = Math.hypot(targetX - m.x, targetY - m.y);
      const attackRange = blockingBuilding
        ? blockingBuilding.category === 'wall'
          ? 36
          : 52
        : 56;

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
        mv.container.setDepth(ySortDepth(m.y, 28));
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
          canAttackNow = true;
        }
      }

      if (canAttackNow && time - mv.lastAttackTime >= 1100) {
        mv.lastAttackTime = time;
        this.ctx.shakeObject(mv.container);

        if (blockingBuilding) {
          blockingBuilding.hp = Math.max(0, blockingBuilding.hp - m.attack);
          this.ctx.updateConstructedBuildingHpBar(blockingBuilding.id);
          const bCont = this.ctx.getConstructedVisualContainer(blockingBuilding.id);
          if (bCont) this.ctx.shakeObject(bCont);

          this.ctx.showFloatingText(targetX, targetY - 30, `🛡️ -${m.attack}`, '#fb923c');

          if (blockingBuilding.hp <= 0) {
            this.ctx.destroyConstructedBuilding(blockingBuilding.id);
          } else {
            this.ctx.onBuildingDamaged?.();
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
    fromRemote: boolean;
    isHost: boolean;
    bonusMultiplier: number;
  }): boolean {
    const monsters = this.ctx.getMonsters();
    const mv = monsters.get(params.monsterId);
    if (!mv) return false;

    // 게스트는 몬스터 HP를 직접 깎지 않고 호스트에게 피격 이벤트만 전송
    if (!params.isHost && !params.fromRemote) {
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
      return false;
    }

    const deadM = mv.monster;
    this.ctx.playExplosionAt(deadM.x, deadM.y);
    mv.container.destroy();
    monsters.delete(params.monsterId);

    const rewardWood = Math.round((deadM.isBoss ? 25 : 3) * params.bonusMultiplier);
    const rewardStone = Math.round((deadM.isBoss ? 25 : 3) * params.bonusMultiplier);
    const rewardGold = Math.round((deadM.isBoss ? 35 : 4) * params.bonusMultiplier);

    this.ctx.addRewardResources(rewardWood, rewardStone, rewardGold);
    sound.playUnlock();
    const rewardText = deadM.isBoss
      ? `🏆 보스 처치! (+🪵${rewardWood} +🪨${rewardStone} +🪙${rewardGold})`
      : `⚔️ 마물 처치! (+🪵${rewardWood} +🪨${rewardStone} +🪙${rewardGold})`;
    this.ctx.showFloatingText(deadM.x, deadM.y - 45, rewardText, '#4ade80');
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
}
