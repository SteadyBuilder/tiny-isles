import Phaser from 'phaser';
import { ConstructedBuilding, Island } from '../../../types/game';
import { getBlueprint } from '../../constants';
import { CONSTRUCTED_DEPTH_BIAS, ySortDepth } from '../../depthLayers';
import {
  getConstructedBuildingFootprintBox,
  getPerimeterWallSpan,
  getWallCollisionBoxes,
} from '../../wallCollisionGeometry';
import { ConstructedVisualRef } from '../../systems/TowerDefenseSystem';
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
      cv.colliders?.forEach((col) => col.destroy());
      cv.extraVisuals?.forEach((ev) => ev.destroy());
      cv.container.destroy();
    });
    this.visuals.clear();
    this.wallColliders.clear(true, true);
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
      const isHorizontal = cb.slotIndex === 0 || cb.slotIndex === 1;
      if (cb.type === 'wood_wall') {
        this.renderWoodPalisade(container, cb.slotIndex, isHorizontal, extraVisuals);
      } else {
        this.renderStoneWall(container, cb.slotIndex, isHorizontal, extraVisuals);
      }

      const wallBoxes = getWallCollisionBoxes(cb);
      for (const box of wallBoxes) {
        const wallCol = this.scene.physics.add.staticSprite(
          box.x + box.w / 2,
          box.y + box.h / 2,
          ''
        );
        wallCol.setVisible(false);
        wallCol.setDisplaySize(box.w, box.h);
        wallCol.refreshBody();
        this.wallColliders.add(wallCol);
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
      }

      const footBox = getConstructedBuildingFootprintBox(cb);
      const footCol = this.scene.physics.add.staticSprite(
        footBox.x + footBox.w / 2,
        footBox.y + footBox.h / 2,
        ''
      );
      footCol.setVisible(false);
      footCol.setDisplaySize(footBox.w, footBox.h);
      footCol.refreshBody();
      this.wallColliders.add(footCol);
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
    for (const cv of this.visuals.values()) {
      if (!cv.timerGraphics || !cv.container.visible) continue;
      this.drawResourceTimer(cv.timerGraphics, cv.building.type, clamped);
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

  private renderWoodPalisade(
    container: Phaser.GameObjects.Container,
    slotIndex: number,
    isHorizontal: boolean,
    extraVisuals: Phaser.GameObjects.Image[]
  ): void {
    this.renderPerimeterWallSprites(
      container,
      slotIndex,
      isHorizontal,
      {
        gateH: 'woodPalisadeGate',
        gateV: 'woodPalisadeGateV',
        wingH: 'woodPalisadeH',
        wingV: 'woodPalisadeV',
        corner: 'woodPalisadeCorner',
        standalone: 'woodPalisade',
      },
      extraVisuals
    );
  }

  private renderStoneWall(
    container: Phaser.GameObjects.Container,
    slotIndex: number,
    isHorizontal: boolean,
    extraVisuals: Phaser.GameObjects.Image[]
  ): void {
    this.renderPerimeterWallSprites(
      container,
      slotIndex,
      isHorizontal,
      {
        gateH: 'stoneWallGate',
        gateV: 'stoneWallGateV',
        wingH: 'stoneWallH',
        wingV: 'stoneWallV',
        corner: 'stoneWallCorner',
        standalone: 'stoneWall',
      },
      extraVisuals
    );
  }

  private renderPerimeterWallSprites(
    container: Phaser.GameObjects.Container,
    slotIndex: number,
    isHorizontal: boolean,
    keys: {
      gateH: string;
      gateV: string;
      wingH: string;
      wingV: string;
      corner: string;
      standalone: string;
    },
    extraVisuals: Phaser.GameObjects.Image[]
  ): void {
    const span = getPerimeterWallSpan(slotIndex);

    if (isHorizontal && span) {
      const gate = this.scene.add.image(0, 0, keys.gateH);
      gate.setDisplaySize(128, 64);
      gate.setDepth(2);
      container.add(gate);

      this.addHorizontalWallWing(container, span.negCorner + 32, -60, keys.wingH);
      this.addHorizontalWallWing(container, 60, span.posCorner - 32, keys.wingH);

      const leftCorner = this.scene.add.image(span.negCorner, 0, keys.corner);
      leftCorner.setDisplaySize(64, 64);
      leftCorner.setDepth(3);
      container.add(leftCorner);

      const rightCorner = this.scene.add.image(span.posCorner, 0, keys.corner);
      rightCorner.setDisplaySize(64, 64);
      rightCorner.setDepth(3);
      container.add(rightCorner);
    } else if ((slotIndex === 2 || slotIndex === 3) && span) {
      const gate = this.scene.add.image(0, 0, keys.gateV);
      gate.setDisplaySize(64, 128);
      gate.setDepth(2);
      container.add(gate);

      this.addVerticalWallWing(container, span.negCorner, -60, keys.wingV, extraVisuals);
      this.addVerticalWallWing(container, 60, span.posCorner, keys.wingV, extraVisuals);
    } else {
      const standalone = this.scene.add.image(0, -10, keys.standalone);
      standalone.setDisplaySize(128, 128);
      container.add(standalone);
    }
  }

  private addHorizontalWallWing(
    container: Phaser.GameObjects.Container,
    startX: number,
    endX: number,
    textureKey: string
  ): void {
    const totalW = Math.max(64, endX - startX);
    const segments = Math.max(1, Math.round(totalW / 192));
    const segW = totalW / segments;
    for (let i = 0; i < segments; i++) {
      const cx = startX + (i + 0.5) * segW;
      const wing = this.scene.add.image(cx, 0, textureKey);
      wing.setDisplaySize(segW + 2, 64);
      wing.setDepth(1);
      container.add(wing);
    }
  }

  private addVerticalWallWing(
    container: Phaser.GameObjects.Container,
    startY: number,
    endY: number,
    textureKey: string,
    extraVisuals: Phaser.GameObjects.Image[]
  ): void {
    const totalH = Math.max(64, endY - startY);
    const segments = Math.max(1, Math.round(totalH / 192));
    const segH = totalH / segments;
    for (let i = 0; i < segments; i++) {
      const cy = startY + (i + 0.5) * segH;
      const worldY = container.y + cy;
      const wing = this.scene.add.image(container.x, worldY, textureKey);
      wing.setDisplaySize(64, segH + 2);
      wing.setDepth(ySortDepth(worldY, CONSTRUCTED_DEPTH_BIAS.WALL));
      extraVisuals.push(wing);
    }
  }
}
