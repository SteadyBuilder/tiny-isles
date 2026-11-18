import { MONSTER_SYNC_CONFIG } from '../../data/worldRules';
import { sound } from '../../lib/sound';
import { CampStructureHpSyncPayload, CampStructureSnapshot } from '../../types/campSync';
import { MonsterCampState } from '../../types/game';
import { updateCampStructureHpBar } from '../phaser/renderers/CampVisualHelper';
import { CampFortificationSyncPlan } from '../utils/campSyncUtils';
import type { CampStructure } from './CampFortificationSystem';

export interface CampStructureSyncCallbacks {
  getLocalPlayerId: () => string;
  playExplosionAt: (x: number, y: number) => void;
  shakeObject: (target: Phaser.GameObjects.Container) => void;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
  removeStructure: (id: string, refreshCollider: boolean) => boolean;
  spawnForCamp: (camp: MonsterCampState, hpMult: number, atkMult: number, refreshColliders: boolean) => void;
  refreshWallColliders: () => void;
}

/**
 * 몬스터 부락 방어 구조물(벽·타워)의 게스트 선타격 유예, 보류 HP 정합 및 풀 스냅샷 계획 적용 헬퍼
 */
export class CampStructureSyncHelper {
  private localHitGraceUntil = new Map<string, number>();
  private deferredStructureHps = new Map<string, { hp: number; maxHp: number; applyAfter: number }>();

  public clearAll(): void {
    this.localHitGraceUntil.clear();
    this.deferredStructureHps.clear();
  }

  public clearStructure(id: string): void {
    this.localHitGraceUntil.delete(id);
    this.deferredStructureHps.delete(id);
  }

  public markLocalHit(id: string): void {
    this.localHitGraceUntil.set(
      id,
      performance.now() + MONSTER_SYNC_CONFIG.localHitHpGraceMs
    );
  }

  public applyRemoteHpSync(
    structures: Map<string, CampStructure>,
    payload: CampStructureHpSyncPayload,
    cb: CampStructureSyncCallbacks
  ): void {
    const st = structures.get(payload.structureId);
    if (!st) {
      this.clearStructure(payload.structureId);
      return;
    }

    const localPlayerId = cb.getLocalPlayerId();
    const isSelfEcho = Boolean(payload.attackerId && localPlayerId && payload.attackerId === localPlayerId);

    if (payload.destroyed || payload.hp <= 0) {
      this.clearStructure(st.id);
      st.hp = 0;
      cb.playExplosionAt(st.x, st.y);
      sound.playBreak();
      cb.removeStructure(st.id, true);
      return;
    }

    if (!isSelfEcho && payload.damageDelta && payload.damageDelta > 0) {
      cb.shakeObject(st.container);
      cb.showFloatingText(st.x, st.y - 36, `💥 -${payload.damageDelta}`, '#fb923c');
    }

    const maxHp = Math.max(1, payload.maxHp);
    const incomingHp = Math.max(0, Math.min(maxHp, payload.hp));
    const graceUntil = this.localHitGraceUntil.get(st.id) ?? 0;
    if (performance.now() < graceUntil && incomingHp > st.hp) {
      this.deferredStructureHps.set(st.id, { hp: incomingHp, maxHp, applyAfter: graceUntil });
      return;
    }

    this.deferredStructureHps.delete(st.id);
    st.maxHp = maxHp;
    st.hp = incomingHp;
    updateCampStructureHpBar(st.hpBar, st.kind, st.hp, st.maxHp);
  }

  public applySyncPlan(
    structures: Map<string, CampStructure>,
    camp: MonsterCampState,
    plan: CampFortificationSyncPlan,
    hpMult: number,
    atkMult: number,
    refreshColliders: boolean,
    cb: CampStructureSyncCallbacks
  ): void {
    if (plan.action === 'respawn_then_reconcile') {
      cb.spawnForCamp(camp, hpMult, atkMult, false);
      const keepIds = new Set(plan.updates.map((u) => u.id));
      for (const [id, st] of Array.from(structures.entries())) {
        if (st.territoryId === camp.territoryId && !keepIds.has(id)) {
          cb.removeStructure(id, false);
        }
      }
    } else {
      for (const removeId of plan.removeIds) {
        cb.removeStructure(removeId, false);
      }
    }

    for (const snap of plan.updates) {
      const st = structures.get(snap.id);
      if (!st) continue;
      this.clearStructure(snap.id);
      st.maxHp = Math.max(1, snap.maxHp);
      st.hp = Math.max(0, Math.min(st.maxHp, snap.hp));
      if (st.hp <= 0) {
        cb.removeStructure(st.id, false);
      } else {
        updateCampStructureHpBar(st.hpBar, st.kind, st.hp, st.maxHp);
      }
    }

    if (refreshColliders) {
      cb.refreshWallColliders();
    }
  }

  public flushDeferred(structures: Map<string, CampStructure>): void {
    if (this.deferredStructureHps.size === 0) return;
    const now = performance.now();
    for (const [id, deferred] of this.deferredStructureHps.entries()) {
      const effectiveUntil = Math.max(deferred.applyAfter, this.localHitGraceUntil.get(id) ?? 0);
      if (now < effectiveUntil) continue;
      this.clearStructure(id);

      const st = structures.get(id);
      if (!st || st.hp <= 0) continue;
      st.maxHp = deferred.maxHp;
      st.hp = Math.max(0, Math.min(st.maxHp, deferred.hp));
      updateCampStructureHpBar(st.hpBar, st.kind, st.hp, st.maxHp);
    }
  }

  public exportSnapshots(structures: Map<string, CampStructure>): CampStructureSnapshot[] {
    const snapshots: CampStructureSnapshot[] = [];
    for (const st of structures.values()) {
      if (st.hp <= 0) continue;
      snapshots.push({ id: st.id, territoryId: st.territoryId, hp: st.hp, maxHp: st.maxHp });
    }
    return snapshots;
  }
}
