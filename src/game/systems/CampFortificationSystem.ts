import Phaser from 'phaser';
import {
  CampStructureHitPayload,
  CampStructureHpSyncPayload,
  CampStructureSnapshot,
} from '../../types/campSync';
import { MonsterCampState } from '../../types/game';
import { sound } from '../../lib/sound';
import {
  createCampStructureVisual,
  updateCampStructureHpBar,
} from '../phaser/renderers/CampVisualHelper';
import { CampFortificationSyncPlan } from '../utils/campSyncUtils';
import { CampStructureSpec, buildCampFortificationSpecs } from './CampFortificationLayout';
import { CampStructureSyncCallbacks, CampStructureSyncHelper } from './CampStructureSyncHelper';
import { ProjectileSystem } from './ProjectileSystem';

export interface CampStructure {
  id: string;
  territoryId: number;
  kind: 'wall' | 'tower';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attack: number;
  rangePx: number;
  fireRateMs: number;
  lastFireTime: number;
  container: Phaser.GameObjects.Container;
  hpBar: Phaser.GameObjects.Graphics;
  collider?: Phaser.Physics.Arcade.Sprite;
}

export interface ICampFortificationContext {
  scene: Phaser.Scene;
  wallColliders?: Phaser.Physics.Arcade.StaticGroup;
  projectileSystem?: ProjectileSystem;
  isHost?: () => boolean;
  getLocalPlayerId?: () => string;
  getLocalPlayerPosition: () => { x: number; y: number };
  isLocalPlayerFainted: () => boolean;
  damageLocalPlayer: (damage: number, attackerName: string) => void;
  onStructureDamaged?: (territoryId: number, attackerId?: string) => void;
  onStructureHitFeedback?: (x: number, y: number, isSkill: boolean, isLocalAttack?: boolean) => void;
  onStructureSyncBroadcast?: (payload: CampStructureHpSyncPayload) => void;
  onRemoteStructureHit?: (payload: CampStructureHitPayload) => void;
  playExplosionAt: (x: number, y: number) => void;
  shakeObject: (target: Phaser.GameObjects.Container) => void;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
}

/**
 * 사냥 특화 모드: 몬스터 부락의 방어벽(4방향) 및 적 방어 타워 관리/동기화 시스템
 */
export class CampFortificationSystem {
  private ctx: ICampFortificationContext;
  private structures = new Map<string, CampStructure>();
  private syncHelper = new CampStructureSyncHelper();
  private syncCallbacks: CampStructureSyncCallbacks;

  constructor(ctx: ICampFortificationContext) {
    this.ctx = ctx;
    this.syncCallbacks = {
      getLocalPlayerId: () => this.ctx.getLocalPlayerId?.() ?? '',
      playExplosionAt: (x, y) => this.ctx.playExplosionAt(x, y),
      shakeObject: (target) => this.ctx.shakeObject(target),
      showFloatingText: (x, y, text, color) => this.ctx.showFloatingText(x, y, text, color),
      removeStructure: (id, refreshCollider) => this.removeStructure(id, refreshCollider),
      spawnForCamp: (camp, hpMult, atkMult, refresh) =>
        this.spawnForCamp(camp, hpMult, atkMult, refresh),
      refreshWallColliders: () => this.refreshWallColliders(),
    };
  }

  private isHost(): boolean {
    return this.ctx.isHost?.() ?? true;
  }

  public getStructures(): ReadonlyMap<string, CampStructure> {
    return this.structures;
  }

  public exportSnapshots(): CampStructureSnapshot[] {
    return this.syncHelper.exportSnapshots(this.structures);
  }

  public getSnapshotsForCamp(territoryId: number): Array<{ id: string }> {
    const list: Array<{ id: string }> = [];
    for (const st of this.structures.values()) {
      if (st.territoryId === territoryId) {
        list.push({ id: st.id });
      }
    }
    return list;
  }

  public refreshWallColliders(): void {
    this.ctx.wallColliders?.refresh();
  }

  public spawnForCamp(
    camp: MonsterCampState,
    hpMult: number,
    atkMult: number,
    refreshColliders = true
  ): void {
    this.clearForCamp(camp.territoryId, false);
    const specs = buildCampFortificationSpecs(camp, hpMult, atkMult);
    for (const spec of specs) {
      this.createStructure(spec);
    }
    if (refreshColliders) {
      this.refreshWallColliders();
    }
  }

  private createStructure(params: CampStructureSpec): void {
    const visual = createCampStructureVisual({
      scene: this.ctx.scene,
      wallColliders: this.ctx.wallColliders,
      kind: params.kind,
      x: params.x,
      y: params.y,
      spriteKey: params.spriteKey,
      isHoriz: params.isHoriz,
      ring: params.ring,
      refreshCollider: false,
    });

    const st: CampStructure = {
      id: params.id,
      territoryId: params.territoryId,
      kind: params.kind,
      x: params.x,
      y: params.y,
      hp: params.hp,
      maxHp: params.hp,
      attack: params.attack,
      rangePx: params.rangePx,
      fireRateMs: params.fireRateMs,
      lastFireTime: 0,
      container: visual.container,
      hpBar: visual.hpBar,
      collider: visual.collider,
    };
    this.structures.set(params.id, st);
    updateCampStructureHpBar(st.hpBar, st.kind, st.hp, st.maxHp);
  }

  public update(time: number): void {
    this.syncHelper.flushDeferred(this.structures);
    if (this.structures.size === 0 || this.ctx.isLocalPlayerFainted()) return;
    const ps = this.ctx.projectileSystem;
    if (!ps) return;

    const { x: px, y: py } = this.ctx.getLocalPlayerPosition();
    for (const st of this.structures.values()) {
      if (st.kind !== 'tower' || st.hp <= 0) continue;
      if (time - st.lastFireTime < st.fireRateMs) continue;

      if (Math.hypot(px - st.x, py - st.y) <= st.rangePx) {
        st.lastFireTime = time;
        ps.fireProjectile({
          startX: st.x,
          startY: st.y - 38,
          targetX: px,
          targetY: py,
          durationMs: 240,
          tint: 0xf43f5e,
          size: 32,
          isMagic: true,
          onArrive: () => {
            if (!this.ctx.isLocalPlayerFainted()) {
              const cur = this.ctx.getLocalPlayerPosition();
              if (Math.hypot(cur.x - px, cur.y - py) <= 55) {
                this.ctx.damageLocalPlayer(st.attack, '💀 부락 방어 타워');
              }
            }
          },
        });
      }
    }
  }

  public findNearestTargetPos(px: number, py: number, rangePx: number): { x: number; y: number } | null {
    for (const st of this.structures.values()) {
      if (st.hp <= 0) continue;
      const hitPad = st.kind === 'wall' ? 70 : 45;
      if (Math.hypot(px - st.x, py - st.y) <= rangePx + hitPad) {
        return { x: st.x, y: st.y };
      }
    }
    return null;
  }

  public tryAttackNearest(px: number, py: number, rangePx: number, damage: number): boolean {
    for (const st of this.structures.values()) {
      if (st.hp <= 0) continue;
      const hitPad = st.kind === 'wall' ? 70 : 45;
      if (Math.hypot(px - st.x, py - st.y) <= rangePx + hitPad) {
        this.applyLocalAttack(st, damage, false);
        return true;
      }
    }
    return false;
  }

  public damageInRadius(x: number, y: number, radiusPx: number, damage: number): boolean {
    let hitAny = false;
    for (const st of Array.from(this.structures.values())) {
      if (st.hp <= 0) continue;
      const hitPad = st.kind === 'wall' ? 60 : 40;
      if (Math.hypot(x - st.x, y - st.y) <= radiusPx + hitPad) {
        this.applyLocalAttack(st, damage, true);
        hitAny = true;
      }
    }
    return hitAny;
  }

  private applyLocalAttack(st: CampStructure, damage: number, isSkill: boolean): void {
    const localPlayerId = this.ctx.getLocalPlayerId?.() ?? 'local';
    if (this.isHost()) {
      this.applyAuthoritativeDamage(st, damage, isSkill, localPlayerId, true);
      return;
    }

    // 게스트 낙관적 선타격: 호스트 승인 전 0으로 로컬 파괴하지 않고 HP >= 1로 유지
    st.hp = Math.max(1, st.hp - damage);
    this.syncHelper.markLocalHit(st.id);
    this.ctx.shakeObject(st.container);
    this.ctx.onStructureHitFeedback?.(st.x, st.y, isSkill, true);
    this.ctx.showFloatingText(st.x, st.y - 36, `💥 -${damage}`, '#fb923c');
    updateCampStructureHpBar(st.hpBar, st.kind, st.hp, st.maxHp);
    this.ctx.onRemoteStructureHit?.({
      structureId: st.id,
      territoryId: st.territoryId,
      damage,
      attackerId: localPlayerId,
      isSkill,
    });
  }

  public applyRemoteStructureHit(payload: CampStructureHitPayload): void {
    if (!this.isHost()) return;
    const st = this.structures.get(payload.structureId);
    if (!st || st.hp <= 0) return;

    const damage = Math.max(1, Math.round(payload.damage));
    this.applyAuthoritativeDamage(
      st,
      damage,
      Boolean(payload.isSkill),
      payload.attackerId,
      false
    );
  }

  private applyAuthoritativeDamage(
    st: CampStructure,
    damage: number,
    isSkill: boolean,
    attackerId: string,
    isLocalAttack: boolean
  ): void {
    const prevHp = st.hp;
    st.hp = Math.max(0, st.hp - damage);
    const damageDelta = Math.max(0, prevHp - st.hp);
    const destroyed = st.hp <= 0;

    this.ctx.shakeObject(st.container);
    this.ctx.onStructureHitFeedback?.(st.x, st.y, isSkill, isLocalAttack);
    this.ctx.showFloatingText(st.x, st.y - 36, `💥 -${damage}`, '#fb923c');
    this.ctx.onStructureDamaged?.(st.territoryId, attackerId);
    updateCampStructureHpBar(st.hpBar, st.kind, st.hp, st.maxHp);

    this.ctx.onStructureSyncBroadcast?.({
      structureId: st.id,
      territoryId: st.territoryId,
      hp: st.hp,
      maxHp: st.maxHp,
      destroyed,
      damageDelta,
      attackerId,
    });

    if (destroyed) {
      this.ctx.playExplosionAt(st.x, st.y);
      sound.playBreak();
      this.removeStructure(st.id);
    }
  }

  public applyRemoteStructureHpSync(payload: CampStructureHpSyncPayload): void {
    if (this.isHost()) return;
    this.syncHelper.applyRemoteHpSync(this.structures, payload, this.syncCallbacks);
  }

  public applySyncPlan(
    camp: MonsterCampState,
    plan: CampFortificationSyncPlan,
    hpMult: number,
    atkMult: number,
    refreshColliders = false
  ): void {
    if (plan.action === 'clear') {
      this.clearForCamp(camp.territoryId, refreshColliders);
      return;
    }
    this.syncHelper.applySyncPlan(
      this.structures,
      camp,
      plan,
      hpMult,
      atkMult,
      refreshColliders,
      this.syncCallbacks
    );
  }

  private removeStructure(id: string, refreshCollider = true): boolean {
    this.syncHelper.clearStructure(id);
    const st = this.structures.get(id);
    if (!st) return false;
    let removedCollider = false;
    if (st.collider && this.ctx.wallColliders) {
      this.ctx.wallColliders.remove(st.collider, true, true);
      removedCollider = true;
      if (refreshCollider) {
        this.ctx.wallColliders.refresh();
      }
    }
    st.container.destroy();
    this.structures.delete(id);
    return removedCollider;
  }

  public clearForCamp(territoryId: number, refreshColliders = true): void {
    let removedAnyCollider = false;
    for (const [id, st] of Array.from(this.structures.entries())) {
      if (st.territoryId === territoryId) {
        if (this.removeStructure(id, false)) {
          removedAnyCollider = true;
        }
      }
    }
    if (removedAnyCollider && refreshColliders) {
      this.refreshWallColliders();
    }
  }

  public destroy(): void {
    for (const id of Array.from(this.structures.keys())) {
      this.removeStructure(id, false);
    }
    this.syncHelper.clearAll();
  }
}
