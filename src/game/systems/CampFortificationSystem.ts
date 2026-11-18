import Phaser from 'phaser';
import { CAMP_RING_TEMPLATES } from '../../data/monsterCamps';
import { MonsterCampState } from '../../types/game';
import { sound } from '../../lib/sound';
import { TERRITORY_CENTER_X, TERRITORY_CENTER_Y, getIslandOrigin } from '../constants';
import { ySortDepth } from '../depthLayers';
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
  getLocalPlayerPosition: () => { x: number; y: number };
  isLocalPlayerFainted: () => boolean;
  damageLocalPlayer: (damage: number, attackerName: string) => void;
  onStructureDamaged?: (territoryId: number) => void;
  onStructureHitFeedback?: (x: number, y: number, isSkill: boolean) => void;
  playExplosionAt: (x: number, y: number) => void;
  shakeObject: (target: Phaser.GameObjects.Container) => void;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
}

/**
 * 사냥 특화 모드: 몬스터 부락의 방어벽(4방향) 및 적 방어 타워 관리 시스템
 */
export class CampFortificationSystem {
  private ctx: ICampFortificationContext;
  private structures = new Map<string, CampStructure>();

  constructor(ctx: ICampFortificationContext) {
    this.ctx = ctx;
  }

  public getStructures(): ReadonlyMap<string, CampStructure> {
    return this.structures;
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

    const tpl = CAMP_RING_TEMPLATES[camp.ring];
    const fort = tpl.fortification;
    const clearScale = 1 + camp.clearCount * 0.25;
    const origin = getIslandOrigin(camp.gridX, camp.gridY);
    const cx = origin.x + TERRITORY_CENTER_X;
    const cy = origin.y + TERRITORY_CENTER_Y;

    // 1. 4방향 방어벽 (북, 남, 동, 서 반경 215px)
    const wallOffsets = [
      { dx: 0, dy: -215, isHoriz: true },
      { dx: 0, dy: 215, isHoriz: true },
      { dx: 215, dy: 0, isHoriz: false },
      { dx: -215, dy: 0, isHoriz: false },
    ];
    const wallHp = Math.round(fort.wallHp * clearScale * hpMult);
    wallOffsets.forEach((wo, idx) => {
      const wx = cx + wo.dx;
      const wy = cy + wo.dy;
      const id = `cwall_${camp.territoryId}_${idx}`;
      this.createStructure({
        id,
        territoryId: camp.territoryId,
        kind: 'wall',
        x: wx,
        y: wy,
        hp: wallHp,
        spriteKey: fort.wallSprite,
        isHoriz: wo.isHoriz,
        ring: camp.ring,
        attack: 0,
        rangePx: 0,
        fireRateMs: 0,
      }, false);
    });

    // 2. 적 방어 타워 (본진 주변 대각선 2~4개)
    const towerOffsets = [
      { dx: -135, dy: -135 },
      { dx: 135, dy: 135 },
      { dx: 135, dy: -135 },
      { dx: -135, dy: 135 },
    ].slice(0, fort.towerCount);
    const towerHp = Math.round(fort.towerHp * clearScale * hpMult);
    const towerAtk = Math.round(fort.towerAttack * clearScale * atkMult);

    towerOffsets.forEach((to, idx) => {
      const tx = cx + to.dx;
      const ty = cy + to.dy;
      const id = `ctower_${camp.territoryId}_${idx}`;
      this.createStructure({
        id,
        territoryId: camp.territoryId,
        kind: 'tower',
        x: tx,
        y: ty,
        hp: towerHp,
        spriteKey: 'blackTower',
        isHoriz: true,
        ring: camp.ring,
        attack: towerAtk,
        rangePx: fort.towerRangePx,
        fireRateMs: fort.towerFireRateMs,
      }, false);
    });

    if (refreshColliders) {
      this.refreshWallColliders();
    }
  }

  private createStructure(
    params: {
      id: string;
      territoryId: number;
      kind: 'wall' | 'tower';
      x: number;
      y: number;
      hp: number;
      spriteKey: string;
      isHoriz: boolean;
      ring: 1 | 2 | 3 | 4;
      attack: number;
      rangePx: number;
      fireRateMs: number;
    },
    refreshCollider = true
  ): void {
    const { scene } = this.ctx;
    const container = scene.add.container(params.x, params.y);
    container.setDepth(ySortDepth(params.y, params.kind === 'tower' ? 140 : 60));

    const directionalKey =
      params.kind === 'wall'
        ? `${params.spriteKey}${params.isHoriz ? 'H' : 'V'}`
        : params.spriteKey;
    const resolvedKey = scene.textures.exists(directionalKey) ? directionalKey : params.spriteKey;
    const tex = scene.textures.exists(resolvedKey) ? resolvedKey : 'tower';
    const sprite = scene.add.image(0, params.kind === 'tower' ? -18 : -8, tex);
    if (params.kind === 'tower') {
      sprite.setDisplaySize(96, 136);
      sprite.setTint(params.ring >= 3 ? 0xc084fc : 0xfca5a5);
    } else {
      const w = params.isHoriz ? 165 : 52;
      const h = params.isHoriz ? 58 : 145;
      sprite.setDisplaySize(w, h);
      sprite.setTint(params.ring >= 3 ? 0xc084fc : 0xfca5a5);
    }
    container.add(sprite);

    const hpBar = scene.add.graphics();
    container.add(hpBar);

    let collider: Phaser.Physics.Arcade.Sprite | undefined;
    if (this.ctx.wallColliders) {
      const colW = params.kind === 'tower' ? 68 : params.isHoriz ? 155 : 46;
      const colH = params.kind === 'tower' ? 64 : params.isHoriz ? 44 : 135;
      collider = scene.physics.add.staticSprite(params.x, params.y, '');
      collider.setVisible(false);
      collider.setDisplaySize(colW, colH);
      collider.refreshBody();
      this.ctx.wallColliders.add(collider);
      if (refreshCollider) {
        this.ctx.wallColliders.refresh();
      }
    }

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
      container,
      hpBar,
      collider,
    };
    this.structures.set(params.id, st);
    this.updateHpBar(st);
  }

  public update(time: number): void {
    if (this.structures.size === 0 || this.ctx.isLocalPlayerFainted()) return;
    const ps = this.ctx.projectileSystem;
    if (!ps) return;

    const { x: px, y: py } = this.ctx.getLocalPlayerPosition();
    for (const st of this.structures.values()) {
      if (st.kind !== 'tower' || st.hp <= 0) continue;
      if (time - st.lastFireTime < st.fireRateMs) continue;

      const d = Math.hypot(px - st.x, py - st.y);
      if (d <= st.rangePx) {
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

  public tryAttackNearest(px: number, py: number, rangePx: number, damage: number): boolean {
    for (const st of this.structures.values()) {
      if (st.hp <= 0) continue;
      const hitPad = st.kind === 'wall' ? 70 : 45;
      if (Math.hypot(px - st.x, py - st.y) <= rangePx + hitPad) {
        this.damageStructure(st, damage, false);
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
        this.damageStructure(st, damage, true);
        hitAny = true;
      }
    }
    return hitAny;
  }

  private damageStructure(st: CampStructure, damage: number, isSkill: boolean): void {
    st.hp = Math.max(0, st.hp - damage);
    this.ctx.shakeObject(st.container);
    this.ctx.onStructureHitFeedback?.(st.x, st.y, isSkill);
    this.ctx.showFloatingText(st.x, st.y - 36, `💥 -${damage}`, '#fb923c');
    this.ctx.onStructureDamaged?.(st.territoryId);
    this.updateHpBar(st);

    if (st.hp <= 0) {
      this.ctx.playExplosionAt(st.x, st.y);
      sound.playBreak();
      this.removeStructure(st.id);
    }
  }

  private updateHpBar(st: CampStructure): void {
    const ratio = Math.max(0, Math.min(1, st.hp / Math.max(1, st.maxHp)));
    const w = st.kind === 'tower' ? 64 : 84;
    const y = st.kind === 'tower' ? -72 : -44;
    st.hpBar.clear();
    st.hpBar.fillStyle(0x0f172a, 0.9);
    st.hpBar.fillRect(-w / 2 - 1, y - 1, w + 2, 7);
    st.hpBar.fillStyle(0xf43f5e, 1);
    st.hpBar.fillRect(-w / 2, y, Math.max(2, w * ratio), 5);
  }

  private removeStructure(id: string, refreshCollider = true): boolean {
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
  }
}
