import { MONSTER_SYNC_CONFIG } from '../../data/worldRules';
import type {
  CampCoreSyncPayload,
  CampFullSyncPayload,
  CampStructureSnapshot,
} from '../../types/campSync';
import type { Island, MonsterCampState } from '../../types/game';
import {
  CampVisualNode,
  updateCampHpVisualNode,
} from '../phaser/renderers/CampVisualHelper';
import {
  applyCampSnapshotToState,
  groupStructureSnapshotsByTerritory,
  planCampFortificationSync,
  toCampStateSnapshot,
} from '../utils/campSyncUtils';
import type { CampFortificationSystem } from './CampFortificationSystem';
import { applyCampRebuildAlert, applyCampRebuildState } from './CampLifecycleHelper';

interface DeferredCampCoreHp {
  coreHp: number;
  coreMaxHp: number;
  applyAfter: number;
}

/**
 * 몬스터 부락 본진 HP 동기화(호스트 스냅샷 빌드, 게스트 선타격 유예·보류 정합, 중도 난입 풀 동기화) 전담 코디네이터
 */
export class CampSyncCoordinator {
  private localHitGraceUntil = new Map<number, number>();
  private deferredCoreHps = new Map<number, DeferredCampCoreHp>();
  private lastFullSyncSentAt = 0;

  public clearAll(): void {
    this.localHitGraceUntil.clear();
    this.deferredCoreHps.clear();
    this.lastFullSyncSentAt = 0;
  }

  public clearCamp(territoryId: number): void {
    this.localHitGraceUntil.delete(territoryId);
    this.deferredCoreHps.delete(territoryId);
  }

  public markLocalHit(territoryId: number): void {
    this.localHitGraceUntil.set(
      territoryId,
      performance.now() + MONSTER_SYNC_CONFIG.localHitHpGraceMs
    );
  }

  public shouldDeferAuthoritativeHp(
    territoryId: number,
    incomingHp: number,
    incomingMaxHp: number,
    currentHp: number
  ): boolean {
    const graceUntil = this.localHitGraceUntil.get(territoryId) ?? 0;
    if (performance.now() < graceUntil && incomingHp > currentHp) {
      this.deferredCoreHps.set(territoryId, {
        coreHp: incomingHp,
        coreMaxHp: incomingMaxHp,
        applyAfter: graceUntil,
      });
      return true;
    }
    this.deferredCoreHps.delete(territoryId);
    return false;
  }

  public flushDeferredCoreHps(
    campNodes: ReadonlyMap<number, CampVisualNode>,
    islands: ReadonlyArray<Island>
  ): void {
    if (this.deferredCoreHps.size === 0) return;
    const now = performance.now();
    for (const [territoryId, deferred] of this.deferredCoreHps.entries()) {
      const effectiveUntil = Math.max(
        deferred.applyAfter,
        this.localHitGraceUntil.get(territoryId) ?? 0
      );
      if (now < effectiveUntil) continue;
      this.deferredCoreHps.delete(territoryId);
      this.localHitGraceUntil.delete(territoryId);

      const node = campNodes.get(territoryId);
      if (!node || node.camp.destroyed) continue;
      const prevHp = node.camp.coreHp;
      node.camp.coreMaxHp = Math.max(1, deferred.coreMaxHp);
      node.camp.coreHp = Math.max(0, Math.min(node.camp.coreMaxHp, deferred.coreHp));
      const isl = islands.find((i) => i.id === territoryId);
      if (isl) {
        isl.coreMaxHp = node.camp.coreMaxHp;
        isl.coreHp = node.camp.coreHp;
      }
      if (node.camp.coreHp !== prevHp) {
        updateCampHpVisualNode(node, node.camp.coreHp < prevHp);
      }
    }
  }

  public toCoreSyncPayload(
    camp: MonsterCampState,
    extra?: {
      damageDelta?: number;
      attackerId?: string;
      healed?: boolean;
      respawned?: boolean;
    }
  ): CampCoreSyncPayload {
    return {
      territoryId: camp.territoryId,
      level: camp.level,
      coreHp: camp.coreHp,
      coreMaxHp: camp.coreMaxHp,
      destroyed: camp.destroyed,
      respawnRemainingSec: camp.respawnRemainingSec,
      firstCleared: camp.firstCleared,
      clearCount: camp.clearCount,
      ...extra,
    };
  }

  public buildFullSyncPayload(
    campNodes: ReadonlyMap<number, CampVisualNode>,
    structures: CampStructureSnapshot[],
    force: boolean
  ): CampFullSyncPayload | null {
    const now = performance.now();
    if (!force && now - this.lastFullSyncSentAt < MONSTER_SYNC_CONFIG.hostFullSyncCooldownMs) {
      return null;
    }
    this.lastFullSyncSentAt = now;
    const camps = Array.from(campNodes.values()).map((node) => toCampStateSnapshot(node.camp));
    return { camps, structures };
  }

  public applyRemoteCoreSync(params: {
    payload: CampCoreSyncPayload;
    node: CampVisualNode;
    islands: Island[];
    localPlayerId: string;
    fortification?: CampFortificationSystem;
    hpMult: number;
    atkMult: number;
    onClearFirstTime: () => void;
    onShakeAndText: (x: number, y: number, delta: number) => void;
    onTerritoriesUpdated: () => void;
  }): void {
    const {
      payload,
      node,
      islands,
      localPlayerId,
      fortification,
      hpMult,
      atkMult,
      onClearFirstTime,
      onShakeAndText,
      onTerritoriesUpdated,
    } = params;
    const { camp, container } = node;
    const isl = islands.find((i) => i.id === camp.territoryId);
    const isSelfEcho = Boolean(payload.attackerId && localPlayerId && payload.attackerId === localPlayerId);
    const wasDestroyed = camp.destroyed;

    camp.level = payload.level;
    camp.coreMaxHp = Math.max(1, payload.coreMaxHp);
    camp.firstCleared = payload.firstCleared;
    camp.clearCount = Math.max(0, payload.clearCount);
    if (isl) {
      isl.campLevel = camp.level;
      isl.coreMaxHp = camp.coreMaxHp;
    }

    if (payload.destroyed) {
      camp.coreHp = 0;
      camp.destroyed = true;
      camp.respawnRemainingSec = payload.respawnRemainingSec;
      if (!wasDestroyed) {
        onClearFirstTime();
      } else {
        if (isl) {
          isl.campDestroyed = true;
          isl.campRespawnSec = payload.respawnRemainingSec;
        }
        updateCampHpVisualNode(node, false);
      }
      return;
    }

    if (payload.respawned || wasDestroyed) {
      this.clearCamp(camp.territoryId);
      applyCampRebuildState(node, islands, {
        level: camp.level,
        coreHp: payload.coreHp,
        coreMaxHp: camp.coreMaxHp,
      });
      fortification?.spawnForCamp(camp, hpMult, atkMult);
      updateCampHpVisualNode(node, false);
      applyCampRebuildAlert(camp);
      onTerritoriesUpdated();
      return;
    }

    if (!isSelfEcho && payload.damageDelta && payload.damageDelta > 0) {
      onShakeAndText(container.x, container.y, payload.damageDelta);
    }

    const prevHp = camp.coreHp;
    const clampedHp = Math.max(0, Math.min(camp.coreMaxHp, payload.coreHp));
    if (payload.healed) {
      this.clearCamp(camp.territoryId);
    } else if (this.shouldDeferAuthoritativeHp(camp.territoryId, clampedHp, camp.coreMaxHp, prevHp)) {
      return;
    }

    camp.coreHp = clampedHp;
    if (isl) isl.coreHp = clampedHp;
    updateCampHpVisualNode(node, clampedHp < prevHp);
  }

  public applyRemoteFullSync(params: {
    payload: CampFullSyncPayload;
    campNodes: ReadonlyMap<number, CampVisualNode>;
    islands: ReadonlyArray<Island>;
    fortification?: CampFortificationSystem;
    hpMult: number;
    atkMult: number;
  }): boolean {
    const { payload, campNodes, islands, fortification, hpMult, atkMult } = params;
    if (!payload.camps || payload.camps.length === 0) return false;

    const groupedStructures = groupStructureSnapshotsByTerritory(payload.structures || []);
    for (const snap of payload.camps) {
      const node = campNodes.get(snap.territoryId);
      if (!node) continue;

      const isl = islands.find((i) => i.id === snap.territoryId);
      const prevRatio = node.camp.coreHp / Math.max(1, node.camp.coreMaxHp);
      const applyResult = applyCampSnapshotToState(node.camp, snap, isl);
      this.clearCamp(snap.territoryId);

      if (fortification) {
        const currentStructures = fortification.getSnapshotsForCamp(snap.territoryId);
        const incomingStructures = groupedStructures.get(snap.territoryId) ?? [];
        const plan = planCampFortificationSync(
          currentStructures,
          incomingStructures,
          node.camp.destroyed,
          applyResult.respawned,
          applyResult.clearCountChanged
        );
        fortification.applySyncPlan(node.camp, plan, hpMult, atkMult, false);
      }

      const nextRatio = node.camp.coreHp / Math.max(1, node.camp.coreMaxHp);
      if (applyResult.respawned || nextRatio > prevRatio) {
        node.hpTrailRatio = nextRatio;
        node.hpFlashUntil = 0;
      }
      updateCampHpVisualNode(node, false);
    }

    fortification?.refreshWallColliders();
    return true;
  }
}
