import Phaser from 'phaser';
import { ConstructedBuilding } from '../../types/game';
import { getBlueprint } from '../constants';
import { DEPTH } from '../depthLayers';
import { PhaserFxPool, isPointInSceneViewport } from '../phaser/utils/fxObjectPool';
import { sound } from '../../lib/sound';
import { ProjectileSystem } from './ProjectileSystem';
import { MonsterVisual, WaveSystem } from './WaveSystem';

export interface ConstructedVisualRef {
  building: ConstructedBuilding;
  container: Phaser.GameObjects.Container;
  hpBar: Phaser.GameObjects.Graphics;
  lastFireTime: number;
  lastTimerStep?: number;
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
  getTowerDamageMultiplier?: () => number;
}

/**
 * 영지 내 궁수 타워, 마법 포격 타워 및 수비대 병영의 자동 요격 전담 시스템
 * - ProjectileSystem 및 PhaserFxPool 오브젝트 풀 + 공간 해시 그리드를 활용하여 100마리 대군 교전 시에도 프레임 드랍 없이 동작합니다.
 */
export class TowerDefenseSystem {
  private ctx: ITowerDefenseContext;
  private waveSystem: WaveSystem;
  private fxPool: PhaserFxPool;

  constructor(ctx: ITowerDefenseContext, waveSystem: WaveSystem) {
    this.ctx = ctx;
    this.waveSystem = waveSystem;
    this.fxPool = new PhaserFxPool(
      ctx.scene,
      () => Boolean(ctx.scene.sys && ctx.scene.scene?.isActive())
    );
  }

  public update(time: number, _delta: number) {
    const monsters = this.waveSystem.getMonsterVisuals();
    if (monsters.size === 0) return;

    const isHost = this.waveSystem.getIsHost();
    const constructedVisuals = this.ctx.getConstructedVisuals();
    const constructedBuildings = this.ctx.getConstructedBuildings();
    const towerDamageMultiplier = this.ctx.getTowerDamageMultiplier?.() ?? 1;

    for (const cv of constructedVisuals.values()) {
      if (!isHost && !cv.container.visible) continue;
      const cb = cv.building;
      const bp = getBlueprint(cb.type);

      if (!bp.attack || !bp.range || !bp.fireRateMs) continue;
      if (time - cv.lastFireTime < bp.fireRateMs) continue;

      const nearestMonster = this.waveSystem
        .getSpatialGrid(time)
        .findNearestInRadius(cb.x, cb.y, bp.range);

      if (nearestMonster) {
        cv.lastFireTime = time;

        const hasBarracksBuff =
          cb.category === 'tower' &&
          constructedBuildings.some(
            (b) => b.territoryId === cb.territoryId && b.type === 'special_barracks'
          );
        const finalDamage = Math.round(
          bp.attack * (hasBarracksBuff ? 1.25 : 1.0) * towerDamageMultiplier
        );

        this.fireTowerProjectile(cb, nearestMonster, finalDamage, hasBarracksBuff, cv.container.visible);
      }
    }
  }

  private fireTowerProjectile(
    source: ConstructedBuilding,
    targetMv: MonsterVisual,
    damage: number,
    hasBarracksBuff: boolean,
    isTowerVisible: boolean
  ) {
    const targetMonsterId = targetMv.monster.id;
    const isEffectVisible = isTowerVisible || targetMv.container.visible;
    if (isEffectVisible) {
      sound.playTowerShoot();
      if (source.type === 'special_barracks') {
        this.playSlashEffect(source.x, source.y - 20, targetMv.monster.x, targetMv.monster.y);
      }
    }

    const isMagicTower = source.type === 'magic_tower';
    const tint = isMagicTower
      ? 0xc084fc
      : source.type === 'special_barracks'
      ? 0xf59e0b
      : hasBarracksBuff
      ? 0x67e8f9
      : 0xffffff;

    if (this.ctx.projectileSystem && isEffectVisible) {
      this.ctx.projectileSystem.fireProjectile({
        startX: source.x,
        startY: source.y - 30,
        targetX: targetMv.monster.x,
        targetY: targetMv.monster.y,
        durationMs: isMagicTower ? 220 : 200,
        tint,
        size: isMagicTower ? 46 : 36,
        isMagic: isMagicTower,
        trailColor: isMagicTower ? 0xe879f9 : hasBarracksBuff ? 0x67e8f9 : undefined,
        impactColor: isMagicTower ? 0xc084fc : undefined,
        impactRadius: isMagicTower ? 48 : undefined,
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
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    if (!isPointInSceneViewport(scene, midX, midY)) return;

    const slash = this.fxPool.acquireGraphics(midX, midY, DEPTH.SLASH);
    if (!slash) return;

    slash.lineStyle(3, 0xfde047, 0.9);
    slash.beginPath();
    slash.arc(0, 0, 26, 0, Math.PI, false);
    slash.strokePath();

    scene.tweens.add({
      targets: slash,
      alpha: 0,
      scaleX: 1.4,
      scaleY: 1.4,
      duration: 180,
      onComplete: () => {
        this.fxPool.releaseGraphics(slash);
      },
    });
  }

  public destroy(): void {
    this.fxPool.destroy();
  }
}
