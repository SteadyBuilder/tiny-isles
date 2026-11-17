import Phaser from 'phaser';
import { ConstructedBuilding } from '../../types/game';
import { getBlueprint } from '../constants';
import { DEPTH } from '../depthLayers';
import { sound } from '../../lib/sound';
import { ProjectileSystem } from './ProjectileSystem';
import { MonsterVisual, WaveSystem } from './WaveSystem';

export interface ConstructedVisualRef {
  building: ConstructedBuilding;
  container: Phaser.GameObjects.Container;
  hpBar: Phaser.GameObjects.Graphics;
  lastFireTime: number;
  colliders?: Phaser.Physics.Arcade.Sprite[];
  extraVisuals?: Phaser.GameObjects.Image[];
  timerGraphics?: Phaser.GameObjects.Graphics;
}

export interface ITowerDefenseContext {
  scene: Phaser.Scene;
  getConstructedBuildings: () => ConstructedBuilding[];
  getConstructedVisuals: () => Map<string, ConstructedVisualRef>;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
  playExplosionAt?: (x: number, y: number) => void;
  projectileSystem?: ProjectileSystem;
}

/**
 * 영지 내 궁수 타워, 마법 포격 타워 및 수비대 병영의 자동 요격 전담 시스템
 * - ProjectileSystem 오브젝트 풀을 활용하여 100마리 대군 교전 시에도 프레임 드랍 없이 동작합니다.
 */
export class TowerDefenseSystem {
  private ctx: ITowerDefenseContext;
  private waveSystem: WaveSystem;

  constructor(ctx: ITowerDefenseContext, waveSystem: WaveSystem) {
    this.ctx = ctx;
    this.waveSystem = waveSystem;
  }

  public update(time: number, _delta: number) {
    const monsters = this.waveSystem.getMonsterVisuals();
    if (monsters.size === 0) return;

    const constructedVisuals = this.ctx.getConstructedVisuals();
    const constructedBuildings = this.ctx.getConstructedBuildings();

    for (const cv of constructedVisuals.values()) {
      const cb = cv.building;
      const bp = getBlueprint(cb.type);

      if (!bp.attack || !bp.range || !bp.fireRateMs) continue;
      if (time - cv.lastFireTime < bp.fireRateMs) continue;

      let nearestMonster: MonsterVisual | null = null;
      let minDist = bp.range;

      for (const mv of monsters.values()) {
        const d = Math.hypot(mv.monster.x - cb.x, mv.monster.y - cb.y);
        if (d <= minDist) {
          minDist = d;
          nearestMonster = mv;
        }
      }

      if (nearestMonster) {
        cv.lastFireTime = time;

        const hasBarracksBuff =
          cb.category === 'tower' &&
          constructedBuildings.some(
            (b) => b.territoryId === cb.territoryId && b.type === 'special_barracks'
          );
        const finalDamage = Math.round(bp.attack * (hasBarracksBuff ? 1.25 : 1.0));

        this.fireTowerProjectile(cb, nearestMonster, finalDamage, hasBarracksBuff);
      }
    }
  }

  private fireTowerProjectile(
    source: ConstructedBuilding,
    targetMv: MonsterVisual,
    damage: number,
    hasBarracksBuff: boolean
  ) {
    const targetMonsterId = targetMv.monster.id;
    sound.playTowerShoot();

    if (source.type === 'special_barracks') {
      this.playSlashEffect(source.x, source.y - 20, targetMv.monster.x, targetMv.monster.y);
    }

    const tint =
      source.type === 'magic_tower'
        ? 0xc084fc
        : source.type === 'special_barracks'
        ? 0xf59e0b
        : hasBarracksBuff
        ? 0x67e8f9
        : 0xffffff;

    if (this.ctx.projectileSystem) {
      this.ctx.projectileSystem.fireProjectile({
        startX: source.x,
        startY: source.y - 30,
        targetX: targetMv.monster.x,
        targetY: targetMv.monster.y,
        durationMs: 200,
        tint,
        size: 36,
        isMagic: source.type === 'magic_tower',
        onArrive: () => {
          if (this.waveSystem.getIsHost()) {
            this.waveSystem.damageMonster(targetMonsterId, damage, source.name);
          }
        },
      });
    } else if (this.waveSystem.getIsHost()) {
      this.waveSystem.damageMonster(targetMonsterId, damage, source.name);
    }
  }

  private playSlashEffect(x1: number, y1: number, x2: number, y2: number) {
    const scene = this.ctx.scene;
    if (!scene.sys || !scene.scene?.isActive()) return;
    const slash = scene.add.graphics();
    slash.setDepth(DEPTH.SLASH);

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    slash.lineStyle(3, 0xfde047, 0.9);
    slash.beginPath();
    slash.arc(midX, midY, 26, 0, Math.PI, false);
    slash.strokePath();

    scene.tweens.add({
      targets: slash,
      alpha: 0,
      scaleX: 1.4,
      scaleY: 1.4,
      duration: 180,
      onComplete: () => {
        if (slash.scene) slash.destroy();
      },
    });
  }
}
