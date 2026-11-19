import Phaser from 'phaser';
import { PERFORMANCE_CONFIG } from '../../../data/performanceConfig';
import { ConstructedBuilding, Island } from '../../../types/game';
import { getBlueprint } from '../../constants';
import { CONSTRUCTED_DEPTH_BIAS, ySortDepth } from '../../depthLayers';
import {
  getConstructedBuildingFootprintBox,
  getWallCollisionBoxes,
} from '../../wallCollisionGeometry';
import { ConstructedVisualRef } from '../../systems/TowerDefenseSystem';
import { renderPerimeterWallSprites } from './PerimeterWallRenderer';
import { attachSanctuaryAuraEffect } from './SanctuaryAuraEffect';

/**
 * 플레이어가 건설한 건물(방어 타워, 나무 방책, 석조 성벽, 기본/특수 건물)의
 * 스프라이트, 성벽 물리 콜라이더 및 HP 게이지 렌더링 전담 렌더러
 */
export class ConstructedBuildingRenderer {
  private scene: Phaser.Scene;
  private wallColliders: Phaser.Physics.Arcade.StaticGroup;
  private visuals = new Map<string, ConstructedVisualRef>();

  constructor(scene: Phaser.Scene, wallColliders: Phaser.Physics.Arcade.StaticGroup) {
    this.scene = scene;
    this.wallColliders = wallColliders;
  }

  public getVisuals(): Map<string, ConstructedVisualRef> {
    return this.visuals;
  }

  public getContainer(buildingId: string): Phaser.GameObjects.Container | undefined {
    return this.visuals.get(buildingId)?.container;
  }

  public clear(): void {
    this.visuals.forEach((cv) => {
      cv.colliders?.forEach((col) => {
        if (col.active) {
          this.wallColliders.remove(col, true, true);
        } else {
          col.destroy();
        }
      });
      cv.extraVisuals?.forEach((ev) => ev.destroy());
      cv.container.destroy();
    });
    this.visuals.clear();
  }

  public spawnAll(buildings: ConstructedBuilding[], islands: Island[]): void {
    this.clear();

    for (const cb of buildings) {
      const isl = islands.find((i) => i.id === cb.territoryId);
      if (isl && isl.unlocked) {
        this.spawnOne(cb, false);
      }
    }
    this.wallColliders.refresh();
  }

  public spawnOne(cb: ConstructedBuilding, refreshColliders = true): void {
    const bp = getBlueprint(cb.type);
    const container = this.scene.add.container(cb.x, cb.y);
    const depthBias =
      cb.category === 'tower'
        ? CONSTRUCTED_DEPTH_BIAS.TOWER
        : cb.category === 'wall'
          ? CONSTRUCTED_DEPTH_BIAS.WALL
          : CONSTRUCTED_DEPTH_BIAS.BUILDING;
    container.setDepth(ySortDepth(cb.y, depthBias));
    const colliders: Phaser.Physics.Arcade.Sprite[] = [];
    const extraVisuals: Phaser.GameObjects.Image[] = [];

    if (cb.category === 'wall') {
      renderPerimeterWallSprites({
        scene: this.scene,
        container,
        slotIndex: cb.slotIndex,
        style: cb.type === 'wood_wall' ? 'woodPalisade' : 'stoneWall',
        extraVisuals,
      });

      const wallBoxes = getWallCollisionBoxes(cb);
      for (const box of wallBoxes) {
        const wallCol = this.scene.physics.add.staticSprite(
          box.x + box.w / 2,
          box.y + box.h / 2,
          ''
        );
        wallCol.setVisible(false);
        this.wallColliders.add(wallCol);
        wallCol.setDisplaySize(box.w, box.h);
        wallCol.refreshBody();
        const body = wallCol.body as Phaser.Physics.Arcade.StaticBody | null;
        if (body) {
          body.setSize(box.w, box.h, true);
        }
        colliders.push(wallCol);
      }
      if (refreshColliders && colliders.length > 0) {
        this.wallColliders.refresh();
      }
    } else {
      const img = this.scene.add.image(0, -20, bp.spriteKey);
      const size = cb.category === 'tower' ? 110 : 120;
      const height = cb.category === 'tower' ? 170 : 150;
      img.setDisplaySize(size, height);
      if (cb.type === 'magic_tower') img.setTint(0xc084fc);
      if (cb.type === 'special_goldmine') img.setTint(0xfde047);
      container.add(img);

      if (cb.category === 'tower' && bp.range) {
        const rangeRing = this.scene.add.graphics();
        rangeRing.lineStyle(1, cb.type === 'magic_tower' ? 0xc084fc : 0x38bdf8, 0.18);
        rangeRing.strokeCircle(0, 0, bp.range);
        container.add(rangeRing);
      }

      if (cb.type === 'special_sanctuary') {
        const auraRing = this.scene.add.graphics();
        auraRing.lineStyle(1.5, 0xfde047, 0.24);
        auraRing.strokeCircle(0, 0, 300);
        container.add(auraRing);
        attachSanctuaryAuraEffect(this.scene, container);
      }

      if (cb.type === 'job_hall') {
        const badge = this.scene.add
          .text(0, -104, '🏛️ 왕국 전직소 [E]', {
            fontFamily: 'Pretendard, sans-serif',
            fontSize: '12px',
            fontStyle: 'bold',
            color: '#fde047',
            stroke: '#000000',
            strokeThickness: 3,
          })
          .setOrigin(0.5);
        container.add(badge);
      } else if (cb.type === 'tool_shop') {
        const badge = this.scene.add
          .text(0, -104, '🧪 도구 상점 [E]', {
            fontFamily: 'Pretendard, sans-serif',
            fontSize: '12px',
            fontStyle: 'bold',
            color: '#6ee7b7',
            stroke: '#000000',
            strokeThickness: 3,
          })
          .setOrigin(0.5);
        container.add(badge);
      } else if (cb.type === 'mercenary_guild') {
        const badge = this.scene.add
          .text(0, -104, '🛡️ 용병 길드 [E]', {
            fontFamily: 'Pretendard, sans-serif',
            fontSize: '12px',
            fontStyle: 'bold',
            color: '#fda4af',
            stroke: '#000000',
            strokeThickness: 3,
          })
          .setOrigin(0.5);
        container.add(badge);
      }

      const footBox = getConstructedBuildingFootprintBox(cb);
      const footCol = this.scene.physics.add.staticSprite(
        footBox.x + footBox.w / 2,
        footBox.y + footBox.h / 2,
        ''
      );
      footCol.setVisible(false);
      this.wallColliders.add(footCol);
      footCol.setDisplaySize(footBox.w, footBox.h);
      footCol.refreshBody();
      const footBody = footCol.body as Phaser.Physics.Arcade.StaticBody | null;
      if (footBody) {
        footBody.setSize(footBox.w, footBox.h, true);
      }
      colliders.push(footCol);
      if (refreshColliders) {
        this.wallColliders.refresh();
      }
    }

    const hpBar = this.scene.add.graphics();
    container.add(hpBar);

    const isResourceGenerator =
      cb.type === 'lumber_camp' ||
      cb.type === 'stone_works' ||
      cb.type === 'special_goldmine';
    const timerGraphics = isResourceGenerator ? this.scene.add.graphics() : undefined;
    if (timerGraphics) {
      container.add(timerGraphics);
    }

    this.visuals.set(cb.id, {
      building: cb,
      container,
      hpBar,
      lastFireTime: 0,
      lastTimerStep: timerGraphics ? 0 : undefined,
      colliders,
      extraVisuals: extraVisuals.length > 0 ? extraVisuals : undefined,
      timerGraphics,
    });

    this.updateHpBar(cb.id);
    if (timerGraphics) {
      this.drawResourceTimer(timerGraphics, cb.type, 0);
    }
  }

  public updateResourceTimers(progress: number): void {
    const clamped = Math.max(0, Math.min(1, progress));
    const steps = PERFORMANCE_CONFIG.resourceTimerQuantizationSteps;
    const step = Math.round(clamped * steps);
    const quantizedProgress = step / steps;
    for (const cv of this.visuals.values()) {
      if (!cv.timerGraphics || !cv.container.visible) continue;
      if (cv.lastTimerStep === step) continue;
      cv.lastTimerStep = step;
      this.drawResourceTimer(cv.timerGraphics, cv.building.type, quantizedProgress);
    }
  }

  private drawResourceTimer(
    g: Phaser.GameObjects.Graphics,
    type: ConstructedBuilding['type'],
    progress: number
  ): void {
    const cx = 0;
    const cy = -74;
    const radius = 11;
    const fillHex =
      type === 'lumber_camp' ? 0x4ade80 : type === 'stone_works' ? 0x94a3b8 : 0xfde047;

    g.clear();
    g.fillStyle(0x0f172a, 0.85);
    g.fillCircle(cx, cy, radius + 2);
    g.lineStyle(1.5, 0x334155, 0.9);
    g.strokeCircle(cx, cy, radius);

    if (progress > 0.01) {
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + Math.PI * 2 * progress;
      g.lineStyle(3, fillHex, 1);
      g.beginPath();
      g.arc(cx, cy, radius - 1.5, startAngle, endAngle, false);
      g.strokePath();
    }

    // 작은 중앙 시계 바늘 포인트
    const handAngle = -Math.PI / 2 + Math.PI * 2 * progress;
    g.lineStyle(1.5, 0xffffff, 0.9);
    g.lineBetween(cx, cy, cx + Math.cos(handAngle) * (radius - 4), cy + Math.sin(handAngle) * (radius - 4));
  }

  public updateHpBar(buildingId: string): void {
    const cv = this.visuals.get(buildingId);
    if (!cv) return;

    const cb = cv.building;
    const ratio = Math.max(0, Math.min(1, cb.hp / Math.max(1, cb.maxHp)));
    const barW = 64;
    const barH = 6;
    const barX = -barW / 2;
    const barY = cb.category === 'wall' ? -28 : -52;

    cv.hpBar.clear();
    cv.hpBar.fillStyle(0x0f172a, 0.88);
    cv.hpBar.fillRoundedRect(barX - 2, barY - 2, barW + 4, barH + 4, 3);
    cv.hpBar.fillStyle(ratio > 0.5 ? 0x4ade80 : ratio > 0.25 ? 0xfacc15 : 0xef4444, 1);
    cv.hpBar.fillRect(barX, barY, Math.max(2, barW * ratio), barH);
  }

  public removeVisual(buildingId: string): void {
    const cv = this.visuals.get(buildingId);
    if (!cv) return;
    if (cv.colliders && cv.colliders.length > 0) {
      cv.colliders.forEach((col) => this.wallColliders.remove(col, true, true));
      this.wallColliders.refresh();
    }
    cv.extraVisuals?.forEach((ev) => ev.destroy());
    cv.container.destroy();
    this.visuals.delete(buildingId);
  }
}
