import { CAMP_RING_TEMPLATES } from '../../data/monsterCamps';
import {
  CampCoreHitPayload,
  CampCoreSyncPayload,
  CampFullSyncPayload,
} from '../../types/campSync';
import { MonsterCampState } from '../../types/game';
import { HuntingScalingFactors } from '../../types/hunting';
import { IMonsterCampContext } from '../../types/monsterCamp';
import {
  CampVisualNode,
  updateCampHpVisualNode,
} from '../phaser/renderers/CampVisualHelper';
import { computeHuntingScaling } from '../utils/huntingScalingUtils';
import { spawnCampGarrisonMonsters } from './CampGarrisonSpawner';
import {
  drainCampHpTrails,
  executeCampClearedPresentationAndRewards,
  initializeCampVisualNodes,
  scaleCampsForOnlineCount,
  tickDestroyedCampRespawns,
} from './CampLifecycleHelper';
import { CampSyncCoordinator } from './CampSyncCoordinator';

export type { CampVisualNode, IMonsterCampContext };

/**
 * 사냥 특화 모드 전용: 주변 20개 영지를 병과별 몬스터 부락으로 전환하고
 * 부락 본진 파괴 보상, 강화 리스폰, 호스트-게스트 부락 동기화를 담당하는 시스템
 */
export class MonsterCampSystem {
  private ctx: IMonsterCampContext;
  private campNodes = new Map<number, CampVisualNode>();
  private syncCoordinator = new CampSyncCoordinator();
  private respawnAccumMs = 0;
  private onlineCount = 1;
  private appliedHpMult = 1;
  private appliedAtkMult = 1;
  private garrisonsInitialized = false;

  constructor(ctx: IMonsterCampContext) {
    this.ctx = ctx;
  }

  public getCampVisuals(): ReadonlyMap<number, CampVisualNode> {
    return this.campNodes;
  }

  private isHost(): boolean {
    return this.ctx.isHost?.() ?? true;
  }

  private getDifficultyMultipliers(): HuntingScalingFactors {
    return computeHuntingScaling(this.ctx.getDifficultyConfig?.(), this.onlineCount);
  }

  public setOnlineCount(count: number): void {
    const nextCount = Math.max(1, count);
    if (nextCount === this.onlineCount) return;

    const prevHpMult = this.appliedHpMult;
    const prevAtkMult = this.appliedAtkMult;
    this.onlineCount = nextCount;
    if (!this.ctx.isHuntingMode() || this.campNodes.size === 0) return;

    const scaling = this.getDifficultyMultipliers();
    const hpRatio = prevHpMult > 0 ? scaling.hpMult / prevHpMult : 1;
    const atkRatio = prevAtkMult > 0 ? scaling.atkMult / prevAtkMult : 1;
    this.appliedHpMult = scaling.hpMult;
    this.appliedAtkMult = scaling.atkMult;
    if (Math.abs(hpRatio - 1) <= 0.01 && Math.abs(atkRatio - 1) <= 0.01) return;

    scaleCampsForOnlineCount({
      campNodes: this.campNodes,
      islands: this.ctx.getIslands(),
      monsters: this.ctx.getMonsters(),
      hpRatio,
      atkRatio,
      isHost: this.isHost(),
    });
  }

  public initializeCamps(): void {
    if (!this.ctx.isHuntingMode()) return;

    this.syncCoordinator.clearAll();
    const scaling = this.getDifficultyMultipliers();
    this.appliedHpMult = scaling.hpMult;
    this.appliedAtkMult = scaling.atkMult;
    const hostAuthoritative = this.isHost();

    initializeCampVisualNodes({
      scene: this.ctx.scene,
      islands: this.ctx.getIslands(),
      campNodes: this.campNodes,
      scaling,
      hostAuthoritative,
      onSpawnFortification: (campState, hp, atk) =>
        this.ctx.fortification?.spawnForCamp(campState, hp, atk, false),
      onSpawnGarrison: (campState) => this.spawnCampGarrison(campState),
    });

    this.ctx.fortification?.refreshWallColliders();
    this.garrisonsInitialized = hostAuthoritative;
    this.ctx.emitTerritoriesUpdated();
  }

  public ensureHostGarrisonsSpawned(): void {
    if (!this.ctx.isHuntingMode() || !this.isHost() || this.garrisonsInitialized) return;
    if (this.campNodes.size === 0) return;

    const hasMigratedCampMonsters = Array.from(this.ctx.getMonsters().values()).some(
      (mv) => mv.monster.isCampMonster && mv.monster.hp > 0
    );
    if (!hasMigratedCampMonsters) {
      for (const node of this.campNodes.values()) {
        if (!node.camp.destroyed) {
          this.spawnCampGarrison(node.camp);
        }
      }
    }
    this.garrisonsInitialized = true;
  }

  public resetGuestGarrisonState(): void {
    this.garrisonsInitialized = false;
    this.syncCoordinator.clearAll();
  }

  private spawnCampGarrison(camp: MonsterCampState): void {
    spawnCampGarrisonMonsters({
      scene: this.ctx.scene,
      camp,
      monsters: this.ctx.getMonsters(),
      scaling: this.getDifficultyMultipliers(),
    });
  }

  public tryAttackNearestCampCore(px: number, py: number, rangePx: number, damage: number): boolean {
    if (!this.ctx.isHuntingMode()) return false;
    if (this.ctx.fortification?.tryAttackNearest(px, py, rangePx, damage)) {
      return true;
    }

    for (const node of this.campNodes.values()) {
      if (node.camp.destroyed) continue;
      if (Math.hypot(px - node.container.x, py - node.container.y) <= rangePx + 55) {
        this.applyLocalCampCoreAttack(node, damage, false);
        return true;
      }
    }
    return false;
  }

  public damageCampCoresInRadius(x: number, y: number, radiusPx: number, damage: number, isSkill = true): boolean {
    if (!this.ctx.isHuntingMode()) return false;
    let hitAny = this.ctx.fortification?.damageInRadius(x, y, radiusPx, damage) ?? false;
    for (const node of this.campNodes.values()) {
      if (node.camp.destroyed) continue;
      if (Math.hypot(x - node.container.x, y - node.container.y) <= radiusPx + 45) {
        this.applyLocalCampCoreAttack(node, damage, isSkill);
        hitAny = true;
      }
    }
    return hitAny;
  }

  private applyLocalCampCoreAttack(node: CampVisualNode, damage: number, isSkill: boolean): void {
    const localPlayerId = this.ctx.getLocalPlayerId?.() ?? 'local';
    if (this.isHost()) {
      this.damageCampCore(node, damage, isSkill, localPlayerId, true);
      return;
    }

    // 게스트 낙관적 선타격: 호스트 승인 전 0으로 로컬 토벌 처리하지 않고 HP >= 1로 유지
    const { camp, container } = node;
    camp.coreHp = Math.max(1, camp.coreHp - damage);
    this.syncCoordinator.markLocalHit(camp.territoryId);
    this.ctx.shakeObject(container);
    this.ctx.onCampCoreHitFeedback?.(container.x, container.y, isSkill, true);
    this.ctx.showFloatingText(container.x, container.y - 60, `💥 -${damage}`, '#fbbf24');
    updateCampHpVisualNode(node, true);
    this.ctx.broadcastCampCoreHit?.({
      territoryId: camp.territoryId,
      damage,
      attackerId: localPlayerId,
      isSkill,
    });
  }

  public applyRemoteCampCoreHit(payload: CampCoreHitPayload): void {
    if (!this.isHost() || !this.ctx.isHuntingMode()) return;
    const node = this.campNodes.get(payload.territoryId);
    if (!node || node.camp.destroyed) return;
    this.damageCampCore(
      node,
      Math.max(1, Math.round(payload.damage)),
      Boolean(payload.isSkill),
      payload.attackerId,
      false
    );
  }

  private damageCampCore(
    node: CampVisualNode,
    damage: number,
    isSkill: boolean,
    attackerId: string,
    isLocalAttack: boolean
  ): void {
    const { camp, container } = node;
    const prevHp = camp.coreHp;
    camp.coreHp = Math.max(0, camp.coreHp - damage);
    const damageDelta = Math.max(0, prevHp - camp.coreHp);
    const isl = this.ctx.getIslands().find((i) => i.id === camp.territoryId);
    if (isl) isl.coreHp = camp.coreHp;

    this.ctx.shakeObject(container);
    this.ctx.onCampCoreHitFeedback?.(container.x, container.y, isSkill, isLocalAttack);
    this.ctx.showFloatingText(container.x, container.y - 60, `💥 -${damage}`, '#fbbf24');
    updateCampHpVisualNode(node, true);
    this.ctx.onCampCoreDamaged?.(camp.territoryId, attackerId);

    if (camp.coreHp <= 0) {
      this.handleCampDestroyed(node, attackerId, damageDelta);
      return;
    }

    this.ctx.broadcastCampCoreSync?.(
      this.syncCoordinator.toCoreSyncPayload(camp, { damageDelta, attackerId })
    );
  }

  private handleCampDestroyed(node: CampVisualNode, attackerId: string, damageDelta: number): void {
    const { camp } = node;
    const tpl = CAMP_RING_TEMPLATES[camp.ring];

    camp.destroyed = true;
    camp.clearCount += 1;
    camp.firstCleared = true;
    camp.respawnRemainingSec = tpl.respawnSec;

    this.ctx.addThreat(tpl.threatGainOnClear);
    this.runCampClearedPresentation(node);
    this.ctx.broadcastCampCoreSync?.(
      this.syncCoordinator.toCoreSyncPayload(camp, { damageDelta, attackerId })
    );
  }

  private runCampClearedPresentation(node: CampVisualNode): void {
    this.syncCoordinator.clearCamp(node.camp.territoryId);
    this.ctx.fortification?.clearForCamp(node.camp.territoryId);
    executeCampClearedPresentationAndRewards(node, {
      islands: this.ctx.getIslands(),
      campNodes: this.campNodes,
      playExplosionAt: this.ctx.playExplosionAt,
      addResources: this.ctx.addResources,
      gainExp: this.ctx.gainExp,
      grantRewardItem: this.ctx.grantRewardItem,
      playChestDropAt: this.ctx.playChestDropAt,
      emitTerritoriesUpdated: this.ctx.emitTerritoriesUpdated,
    });
  }

  public applyRemoteCampCoreSync(payload: CampCoreSyncPayload): void {
    if (this.isHost() || !this.ctx.isHuntingMode()) return;
    const node = this.campNodes.get(payload.territoryId);
    if (!node) return;
    const { hpMult, atkMult } = this.getDifficultyMultipliers();

    this.syncCoordinator.applyRemoteCoreSync({
      payload,
      node,
      islands: this.ctx.getIslands(),
      localPlayerId: this.ctx.getLocalPlayerId?.() ?? '',
      fortification: this.ctx.fortification,
      hpMult,
      atkMult,
      onClearFirstTime: () => this.runCampClearedPresentation(node),
      onShakeAndText: (x, y, delta) => {
        this.ctx.shakeObject(node.container);
        this.ctx.showFloatingText(x, y - 60, `💥 -${delta}`, '#fbbf24');
      },
      onTerritoriesUpdated: this.ctx.emitTerritoriesUpdated,
    });
  }

  public broadcastFullCampSync(force = false): void {
    if (!this.isHost() || !this.ctx.isHuntingMode() || this.campNodes.size === 0) return;
    const structures = this.ctx.fortification?.exportSnapshots() ?? [];
    const payload = this.syncCoordinator.buildFullSyncPayload(this.campNodes, structures, force);
    if (payload) {
      this.ctx.broadcastCampFullSync?.(payload);
    }
  }

  public applyRemoteCampFullSync(payload: CampFullSyncPayload): void {
    if (this.isHost() || !this.ctx.isHuntingMode()) return;
    const { hpMult, atkMult } = this.getDifficultyMultipliers();
    const applied = this.syncCoordinator.applyRemoteFullSync({
      payload,
      campNodes: this.campNodes,
      islands: this.ctx.getIslands(),
      fortification: this.ctx.fortification,
      hpMult,
      atkMult,
    });
    if (applied) {
      this.ctx.emitTerritoriesUpdated();
    }
  }

  public getFirstClearedCampCount(): number {
    let count = 0;
    for (const node of this.campNodes.values()) {
      if (node.camp.firstCleared) count++;
    }
    return count;
  }

  public getActiveCampTargets(): Array<{ id: number; x: number; y: number; ring: 1 | 2 | 3 | 4 }> {
    const targets: Array<{ id: number; x: number; y: number; ring: 1 | 2 | 3 | 4 }> = [];
    for (const node of this.campNodes.values()) {
      if (node.camp.destroyed) continue;
      targets.push({ id: node.camp.territoryId, x: node.container.x, y: node.container.y, ring: node.camp.ring });
    }
    return targets;
  }

  public healCampCore(territoryId: number, amount: number): void {
    if (!this.isHost()) return;
    const node = this.campNodes.get(territoryId);
    if (!node || node.camp.destroyed) return;
    if (node.camp.coreHp < node.camp.coreMaxHp) {
      node.camp.coreHp = Math.min(node.camp.coreMaxHp, node.camp.coreHp + amount);
      const isl = this.ctx.getIslands().find((i) => i.id === territoryId);
      if (isl) isl.coreHp = node.camp.coreHp;
      updateCampHpVisualNode(node);
      this.ctx.broadcastCampCoreSync?.(
        this.syncCoordinator.toCoreSyncPayload(node.camp, { healed: true })
      );
    }
  }

  public update(deltaMs: number): void {
    if (!this.ctx.isHuntingMode() || this.campNodes.size === 0) return;

    this.ctx.fortification?.update(this.ctx.scene.time.now);
    this.syncCoordinator.flushDeferredCoreHps(this.campNodes, this.ctx.getIslands());
    drainCampHpTrails(this.campNodes, deltaMs);

    this.respawnAccumMs += deltaMs;
    if (this.respawnAccumMs < 1000) return;
    this.respawnAccumMs -= 1000;

    const anyChanged = tickDestroyedCampRespawns({
      campNodes: this.campNodes,
      islands: this.ctx.getIslands(),
      hostAuthoritative: this.isHost(),
      getScaling: () => this.getDifficultyMultipliers(),
      onRebuildCamp: (camp, hpMult, atkMult) => {
        this.ctx.fortification?.spawnForCamp(camp, hpMult, atkMult);
        this.spawnCampGarrison(camp);
      },
      onCampRespawned: (camp) => {
        this.ctx.broadcastCampCoreSync?.(
          this.syncCoordinator.toCoreSyncPayload(camp, { respawned: true })
        );
      },
    });

    if (anyChanged) {
      this.ctx.emitTerritoriesUpdated();
    }
  }

  public destroy(): void {
    this.syncCoordinator.clearAll();
    this.ctx.fortification?.destroy();
    for (const node of this.campNodes.values()) {
      if (node.container.scene) node.container.destroy();
    }
    this.campNodes.clear();
  }
}
