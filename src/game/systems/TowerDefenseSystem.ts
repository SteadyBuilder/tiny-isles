import Phaser from 'phaser';
import { ConstructedBuilding } from '../../types/game';
import { getBlueprint } from '../constants';
import { DEPTH } from '../depthLayers';
import { sound } from '../../lib/sound';
import { MonsterVisual, WaveSystem } from './WaveSystem';

export interface ConstructedVisualRef {
  building: ConstructedBuilding;
  container: Phaser.GameObjects.Container;
  hpBar: Phaser.GameObjects.Graphics;
  lastFireTime: number;
  colliders?: Phaser.Physics.Arcade.Sprite[];
}

export interface ITowerDefenseContext {
  scene: Phaser.Scene;
  getConstructedBuildings: () => ConstructedBuilding[];
  getConstructedVisuals: () => Map<string, ConstructedVisualRef>;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
  playExplosionAt?: (x: number, y: number) => void;
}

/**
 * 영지 내 궁수 타워, 마법 포격 타워 및 수비대 병영의 자동 요격 전담 시스템
 */
export class TowerDefenseSystem {
  private ctx: ITowerDefenseContext;
  private waveSystem: WaveSystem;

  constructor(ctx: ITowerDefenseContext, waveSystem: WaveSystem) {
    this.ctx = ctx;
    this.waveSystem = waveSystem;
  }

  /**
   * 매 프레임 타워들의 사거리 탐색 및 주기적 요격 사격 처리
   */
  public update(time: number, _delta: number) {
    const monsters = this.waveSystem.getMonsterVisuals();
    if (monsters.size === 0) return;

    const constructedVisuals = this.ctx.getConstructedVisuals();
    const constructedBuildings = this.ctx.getConstructedBuildings();

    for (const cv of constructedVisuals.values()) {
      const cb = cv.building;
      const bp = getBlueprint(cb.type);

      // 공격력, 사거리, 발사 주기가 있는 방어 건물 또는 수비대 병영
      if (!bp.attack || !bp.range || !bp.fireRateMs) continue;
      if (time - cv.lastFireTime < bp.fireRateMs) continue;

      // 사거리 내 가장 가까운 마물 탐색
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

        // 왕국 수비대 병영(special_barracks) 존재 시 영지 내 타워 공격력 25% 버프!
        const hasBarracksBuff = constructedBuildings.some(
          (b) => b.territoryId === cb.territoryId && b.type === 'special_barracks'
        );
        const finalDamage = Math.round(bp.attack * (hasBarracksBuff ? 1.25 : 1.0));

        this.fireTowerProjectile(cb, nearestMonster, finalDamage, hasBarracksBuff);
      }
    }
  }

  /**
   * 투사체 생성 및 비행 트윈, 적중 시 대미지 전달
   */
  private fireTowerProjectile(
    source: ConstructedBuilding,
    targetMv: MonsterVisual,
    damage: number,
    hasBarracksBuff: boolean
  ) {
    const scene = this.ctx.scene;
    const targetMonsterId = targetMv.monster.id;

    sound.playTowerShoot();

    // 수비대 병영의 근접 참격 시각 효과 연출
    if (source.type === 'special_barracks') {
      this.playSlashEffect(source.x, source.y - 20, targetMv.monster.x, targetMv.monster.y);
    }

    const startX = source.x;
    const startY = source.y - 30;
    const proj = scene.add.image(startX, startY, 'arrowProj');
    proj.setDepth(DEPTH.PROJECTILE);
    proj.setDisplaySize(36, 36);

    // 타워 타입 및 버프별 투사체 색상 차별화
    if (source.type === 'magic_tower') {
      proj.setTint(0xc084fc); // 마법 보라 탄환
    } else if (source.type === 'special_barracks') {
      proj.setTint(0xf59e0b); // 골드 기사 참격/투석구
    } else {
      proj.setTint(hasBarracksBuff ? 0x67e8f9 : 0xffffff); // 궁수 타워 (병영 버프 시 푸른 오라)
    }

    const angle = Phaser.Math.Angle.Between(
      startX,
      startY,
      targetMv.monster.x,
      targetMv.monster.y
    );
    proj.setRotation(angle);

    scene.tweens.add({
      targets: proj,
      x: targetMv.monster.x,
      y: targetMv.monster.y,
      duration: 220,
      ease: 'Linear',
      onComplete: () => {
        if (proj.scene) proj.destroy();
        if (!scene.sys || !scene.scene?.isActive()) return;

        // 적중 파티클 스파크 연출
        this.playHitSpark(targetMv.monster.x, targetMv.monster.y, source.type === 'magic_tower');

        // WaveSystem의 damageMonster 호출 (호스트만 권위 데미지 연산)
        if (this.waveSystem.getIsHost()) {
          this.waveSystem.damageMonster(targetMonsterId, damage, source.name);
        }
      },
    });
  }

  /**
   * 왕국 수비대 병영 근접 참격 시각효과
   */
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

  /**
   * 화살/마법탄 적중 스파크 이펙트
   */
  private playHitSpark(x: number, y: number, isMagic: boolean) {
    const scene = this.ctx.scene;
    if (!scene.sys || !scene.scene?.isActive()) return;
    const spark = scene.add.graphics();
    spark.setDepth(DEPTH.SPARK);
    spark.fillStyle(isMagic ? 0xc084fc : 0xfde047, 0.85);

    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI / 2) * i + Math.random() * 0.4;
      const dist = 12 + Math.random() * 8;
      spark.fillCircle(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist, 3);
    }

    scene.tweens.add({
      targets: spark,
      alpha: 0,
      duration: 160,
      onComplete: () => {
        if (spark.scene) spark.destroy();
      },
    });
  }
}
