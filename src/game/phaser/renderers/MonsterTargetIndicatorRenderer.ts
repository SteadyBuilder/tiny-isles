import Phaser from 'phaser';
import { MONSTER_INDICATOR_CONFIG } from '../../../data/monsterIndicator';
import { DEPTH } from '../../depthLayers';
import { MonsterVisual } from '../../systems/MonsterVisualManager';
import {
  CameraWorldBounds,
  MonsterIndicatorPlacement,
  computeMonsterIndicatorPlacement,
} from '../../utils/monsterIndicatorUtils';

/**
 * 몬스터 웨이브 시 화면 내(머리 위 ▼) 및 화면 밖(가장자리 방향 지시) 붉은색 타게팅 화살표 전담 렌더러
 */
export class MonsterTargetIndicatorRenderer {
  private scene: Phaser.Scene;
  private isSceneAlive: () => boolean;
  private graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, isSceneAlive: () => boolean) {
    this.scene = scene;
    this.isSceneAlive = isSceneAlive;
    this.graphics = this.scene.add.graphics();
    this.graphics.setDepth(DEPTH.MONSTER_INDICATOR);
  }

  public update(timeMs: number, monsterVisuals: Map<string, MonsterVisual>): void {
    if (!this.isSceneAlive()) return;
    this.graphics.clear();

    if (monsterVisuals.size === 0) return;

    const cam = this.scene.cameras?.main;
    if (!cam) return;

    const wv = cam.worldView;
    const view: CameraWorldBounds = {
      x: wv.x,
      y: wv.y,
      width: wv.width,
      height: wv.height,
      right: wv.right,
      bottom: wv.bottom,
      centerX: wv.centerX,
      centerY: wv.centerY,
    };

    for (const mv of monsterVisuals.values()) {
      const m = mv.monster;
      if (m.hp <= 0) continue;

      const placement = computeMonsterIndicatorPlacement(
        { id: m.id, x: m.x, y: m.y, isBoss: m.isBoss },
        view,
        cam.zoom,
        timeMs,
        MONSTER_INDICATOR_CONFIG
      );

      this.drawArrow(placement);
    }
  }

  private drawArrow(placement: MonsterIndicatorPlacement): void {
    const { x, y, angle, worldSize: s, worldStrokeWidth, style } = placement;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // 기준 화살표 모양 (0 rad = 오른쪽 방향)
    const localPoints: Array<{ lx: number; ly: number }> = [
      { lx: s, ly: 0 },
      { lx: -s * 0.65, ly: -s * 0.72 },
      { lx: -s * 0.3, ly: 0 },
      { lx: -s * 0.65, ly: s * 0.72 },
    ];

    const worldPoints = localPoints.map((pt) => ({
      x: x + pt.lx * cos - pt.ly * sin,
      y: y + pt.lx * sin + pt.ly * cos,
    }));

    this.graphics.fillStyle(style.fillColor, 0.94);
    this.graphics.lineStyle(worldStrokeWidth, style.strokeColor, 0.98);
    this.graphics.beginPath();
    worldPoints.forEach((pt, idx) => {
      if (idx === 0) {
        this.graphics.moveTo(pt.x, pt.y);
      } else {
        this.graphics.lineTo(pt.x, pt.y);
      }
    });
    this.graphics.closePath();
    this.graphics.fillPath();
    this.graphics.strokePath();
  }

  public destroy(): void {
    this.graphics.destroy();
  }
}
