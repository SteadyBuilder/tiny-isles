import Phaser from 'phaser';
import { MONSTER_INDICATOR_CONFIG } from '../../../data/monsterIndicator';
import { DungeonPortalState } from '../../../types/game';
import { DEPTH } from '../../depthLayers';
import { MonsterVisual } from '../../systems/MonsterVisualManager';
import {
  CameraWorldBounds,
  MonsterIndicatorPlacement,
  MonsterIndicatorTarget,
  computeMonsterIndicatorPlacementInto,
} from '../../utils/monsterIndicatorUtils';

export interface HuntingIndicatorTargets {
  isHuntingMode: boolean;
  campTargets: ReadonlyArray<{ id: number; x: number; y: number }>;
  dungeonPortal: DungeonPortalState | null;
}

/**
 * 타게팅 화살표 렌더러
 * - 사냥 특화 모드: 활성 몬스터 부락, 던전 게이트, 던전 수문장 보스(생존 시)만 가리킴
 * - 일반/클래식 모드: 각 침공 몬스터를 가리킴
 */
export class MonsterTargetIndicatorRenderer {
  private scene: Phaser.Scene;
  private isSceneAlive: () => boolean;
  private graphics: Phaser.GameObjects.Graphics;
  private viewBounds: CameraWorldBounds = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    right: 0,
    bottom: 0,
    centerX: 0,
    centerY: 0,
  };
  private targetScratch: MonsterIndicatorTarget = {
    id: '',
    x: 0,
    y: 0,
    isBoss: false,
    kind: undefined,
  };
  private placementScratch: MonsterIndicatorPlacement = {
    mode: 'overhead',
    x: 0,
    y: 0,
    angle: 0,
    worldSize: 0,
    worldStrokeWidth: 0,
    style: MONSTER_INDICATOR_CONFIG.normalStyle,
  };

  constructor(scene: Phaser.Scene, isSceneAlive: () => boolean) {
    this.scene = scene;
    this.isSceneAlive = isSceneAlive;
    this.graphics = this.scene.add.graphics();
    this.graphics.setDepth(DEPTH.MONSTER_INDICATOR);
  }

  public update(
    timeMs: number,
    monsterVisuals: Map<string, MonsterVisual>,
    huntingTargets?: HuntingIndicatorTargets
  ): void {
    if (!this.isSceneAlive()) return;
    this.graphics.clear();

    const cam = this.scene.cameras?.main;
    if (!cam) return;

    const wv = cam.worldView;
    const view = this.viewBounds;
    view.x = wv.x;
    view.y = wv.y;
    view.width = wv.width;
    view.height = wv.height;
    view.right = wv.right;
    view.bottom = wv.bottom;
    view.centerX = wv.centerX;
    view.centerY = wv.centerY;

    const target = this.targetScratch;

    if (huntingTargets?.isHuntingMode) {
      for (const camp of huntingTargets.campTargets) {
        target.id = '';
        target.x = camp.x;
        target.y = camp.y;
        target.isBoss = false;
        target.kind = 'camp';
        computeMonsterIndicatorPlacementInto(
          target,
          view,
          cam.zoom,
          timeMs,
          MONSTER_INDICATOR_CONFIG,
          this.placementScratch
        );
        this.drawArrow(this.placementScratch);
      }

      if (huntingTargets.dungeonPortal?.active) {
        const portal = huntingTargets.dungeonPortal;
        target.id = 'dungeon_portal';
        target.x = portal.x;
        target.y = portal.y;
        target.isBoss = false;
        target.kind = 'dungeon';
        computeMonsterIndicatorPlacementInto(
          target,
          view,
          cam.zoom,
          timeMs,
          MONSTER_INDICATOR_CONFIG,
          this.placementScratch
        );
        this.drawArrow(this.placementScratch);
      }

      for (const mv of monsterVisuals.values()) {
        const m = mv.monster;
        if (m.hp <= 0 || !m.isBoss) continue;
        target.id = m.id;
        target.x = m.x;
        target.y = m.y;
        target.isBoss = true;
        target.kind = 'dungeon';
        computeMonsterIndicatorPlacementInto(
          target,
          view,
          cam.zoom,
          timeMs,
          MONSTER_INDICATOR_CONFIG,
          this.placementScratch
        );
        this.drawArrow(this.placementScratch);
      }
      return;
    }

    if (monsterVisuals.size === 0) return;

    for (const mv of monsterVisuals.values()) {
      const m = mv.monster;
      if (m.hp <= 0) continue;

      target.id = m.id;
      target.x = m.x;
      target.y = m.y;
      target.isBoss = m.isBoss;
      target.kind = undefined;
      computeMonsterIndicatorPlacementInto(
        target,
        view,
        cam.zoom,
        timeMs,
        MONSTER_INDICATOR_CONFIG,
        this.placementScratch
      );

      this.drawArrow(this.placementScratch);
    }
  }

  private drawArrow(placement: MonsterIndicatorPlacement): void {
    const { x, y, angle, worldSize: s, worldStrokeWidth, style } = placement;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const tailX = -s * 0.65;
    const tailY = s * 0.72;
    const notchX = -s * 0.3;

    const p0x = x + s * cos;
    const p0y = y + s * sin;
    const p1x = x + tailX * cos + tailY * sin;
    const p1y = y + tailX * sin - tailY * cos;
    const p2x = x + notchX * cos;
    const p2y = y + notchX * sin;
    const p3x = x + tailX * cos - tailY * sin;
    const p3y = y + tailX * sin + tailY * cos;

    this.graphics.fillStyle(style.fillColor, 0.94);
    this.graphics.lineStyle(worldStrokeWidth, style.strokeColor, 0.98);
    this.graphics.beginPath();
    this.graphics.moveTo(p0x, p0y);
    this.graphics.lineTo(p1x, p1y);
    this.graphics.lineTo(p2x, p2y);
    this.graphics.lineTo(p3x, p3y);
    this.graphics.closePath();
    this.graphics.fillPath();
    this.graphics.strokePath();
  }

  public destroy(): void {
    this.graphics.destroy();
  }
}
