import Phaser from 'phaser';
import { GARRISON_CONFIG } from '../../data/worldRules';
import { GarrisonUnit } from '../../types/game';
import { DEPTH, ySortDepth } from '../depthLayers';
import { sound } from '../../lib/sound';
import { MonsterVisual, WaveSystem } from './WaveSystem';

interface GarrisonVisualRef {
  unit: GarrisonUnit;
  homeX: number;
  homeY: number;
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  lastAttackTime: number;
  currentAnim: 'idle' | 'run' | 'axe';
}

export interface IGarrisonContext {
  scene: Phaser.Scene;
}

/**
 * 오프라인 유저들이 남긴 비동기 AI 수비대(Garrison) 렌더링 및 자동 요격 시스템
 */
export class GarrisonSystem {
  private ctx: IGarrisonContext;
  private waveSystem: WaveSystem;
  private visuals = new Map<string, GarrisonVisualRef>();

  constructor(ctx: IGarrisonContext, waveSystem: WaveSystem) {
    this.ctx = ctx;
    this.waveSystem = waveSystem;
  }

  public getActiveCount(): number {
    return this.visuals.size;
  }

  public setGarrisons(units: GarrisonUnit[]) {
    for (const ref of this.visuals.values()) {
      ref.sprite.destroy();
      ref.label.destroy();
    }
    this.visuals.clear();

    if (!this.ctx.scene.sys || !this.ctx.scene.scene?.isActive()) return;

    const limited = units.slice(0, GARRISON_CONFIG.maxActiveGarrisons);
    for (const unit of limited) {
      const spriteKey = unit.color === 'red' ? 'redPawnIdle' : 'bluePawnIdle';
      const sprite = this.ctx.scene.add.sprite(unit.x, unit.y, spriteKey);
      sprite.setDisplaySize(136, 136);
      sprite.setAlpha(0.92);
      sprite.setDepth(ySortDepth(unit.y, 22));
      if (this.ctx.scene.anims.exists(`${unit.color}_idle`)) {
        sprite.play(`${unit.color}_idle`);
      }

      const label = this.ctx.scene.add
        .text(unit.x, unit.y - 40, `🛡️ ${unit.name}`, {
          fontSize: '11px',
          fontFamily: 'system-ui, sans-serif',
          fontStyle: 'bold',
          color: '#7dd3fc',
          backgroundColor: 'rgba(15, 23, 42, 0.78)',
          padding: { x: 5, y: 2 },
        })
        .setOrigin(0.5)
        .setDepth(ySortDepth(unit.y, 29));

      this.visuals.set(unit.playerId, {
        unit: { ...unit },
        homeX: unit.x,
        homeY: unit.y,
        sprite,
        label,
        lastAttackTime: 0,
        currentAnim: 'idle',
      });
    }

    this.waveSystem.setActiveGarrisonCount(this.visuals.size);
  }

  public update(time: number, delta: number) {
    if (this.visuals.size === 0) return;

    const dt = delta / 1000;
    const monsters = this.waveSystem.getMonsterVisuals();

    for (const ref of this.visuals.values()) {
      const nearest = this.findNearestMonster(ref.sprite.x, ref.sprite.y, monsters);

      if (nearest) {
        const dx = nearest.monster.x - ref.sprite.x;
        const dy = nearest.monster.y - ref.sprite.y;
        const dist = Math.hypot(dx, dy);
        ref.sprite.setFlipX(dx < 0);

        if (dist <= GARRISON_CONFIG.attackRange) {
          this.playAnim(ref, 'idle');
          if (time - ref.lastAttackTime >= GARRISON_CONFIG.attackCooldownMs) {
            ref.lastAttackTime = time;
            this.fireGarrisonStrike(ref, nearest);
          }
        } else {
          this.moveToward(ref, nearest.monster.x, nearest.monster.y, dt);
        }
      } else {
        const homeDist = Math.hypot(ref.homeX - ref.sprite.x, ref.homeY - ref.sprite.y);
        if (homeDist > 12) {
          this.moveToward(ref, ref.homeX, ref.homeY, dt);
        } else {
          this.playAnim(ref, 'idle');
        }
      }
    }
  }

  private findNearestMonster(
    gx: number,
    gy: number,
    monsters: Map<string, MonsterVisual>
  ): MonsterVisual | null {
    if (monsters.size === 0) return null;
    let best: MonsterVisual | null = null;
    let minDist: number = GARRISON_CONFIG.aggroRange;

    for (const mv of monsters.values()) {
      if (mv.monster.hp <= 0) continue;
      const d = Math.hypot(mv.monster.x - gx, mv.monster.y - gy);
      if (d <= minDist) {
        minDist = d;
        best = mv;
      }
    }
    return best;
  }

  private moveToward(ref: GarrisonVisualRef, tx: number, ty: number, dt: number) {
    const dx = tx - ref.sprite.x;
    const dy = ty - ref.sprite.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 1) return;

    const step = Math.min(dist, GARRISON_CONFIG.moveSpeed * dt);
    ref.sprite.x += (dx / dist) * step;
    ref.sprite.y += (dy / dist) * step;
    ref.sprite.setFlipX(dx < 0);
    ref.sprite.setDepth(ySortDepth(ref.sprite.y, 22));
    ref.label.setPosition(ref.sprite.x, ref.sprite.y - 40).setDepth(ySortDepth(ref.sprite.y, 29));
    this.playAnim(ref, 'run');
  }

  private playAnim(ref: GarrisonVisualRef, state: 'idle' | 'run' | 'axe') {
    if (ref.currentAnim === state) return;
    ref.currentAnim = state;
    const key = `${ref.unit.color}_${state}`;
    if (this.ctx.scene.anims.exists(key)) {
      ref.sprite.play(key);
    }
  }

  private fireGarrisonStrike(ref: GarrisonVisualRef, targetMv: MonsterVisual) {
    const scene = this.ctx.scene;
    if (!scene.sys || !scene.scene?.isActive()) return;
    const targetId = targetMv.monster.id;
    const startX = ref.sprite.x;
    const startY = ref.sprite.y - 16;

    this.playAnim(ref, 'axe');
    sound.playTowerShoot();

    const proj = scene.add.image(startX, startY, 'arrowProj');
    proj.setDepth(DEPTH.PROJECTILE);
    proj.setDisplaySize(28, 28);
    proj.setTint(0x38bdf8);
    proj.setRotation(
      Phaser.Math.Angle.Between(startX, startY, targetMv.monster.x, targetMv.monster.y)
    );

    scene.tweens.add({
      targets: proj,
      x: targetMv.monster.x,
      y: targetMv.monster.y - 10,
      duration: 180,
      onComplete: () => {
        if (proj.scene) proj.destroy();
        if (!scene.sys || !scene.scene?.isActive()) return;
        this.waveSystem.damageMonster(
          targetId,
          GARRISON_CONFIG.baseAttack,
          `${ref.unit.name} 수비대`
        );
      },
    });
  }

  public destroy() {
    for (const ref of this.visuals.values()) {
      ref.sprite.destroy();
      ref.label.destroy();
    }
    this.visuals.clear();
  }
}
