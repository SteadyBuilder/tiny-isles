import Phaser from 'phaser';
import { ConstructedBuilding, Island } from '../../../types/game';
import { getBlueprint } from '../../constants';
import { ySortDepth } from '../../depthLayers';
import {
  getConstructedBuildingFootprintBox,
  getPerimeterWallSpan,
  getWallCollisionBoxes,
  WALL_GATE_HALF_OPENING,
} from '../../wallCollisionGeometry';
import { ConstructedVisualRef } from '../../systems/TowerDefenseSystem';

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
    container.setDepth(ySortDepth(cb.y, 30));
    const colliders: Phaser.Physics.Arcade.Sprite[] = [];

    if (cb.category === 'wall') {
      const isHorizontal = cb.slotIndex === 0 || cb.slotIndex === 1;
      if (cb.type === 'wood_wall') {
        this.renderWoodPalisade(container, cb.slotIndex, isHorizontal);
      } else {
        this.renderStoneWall(container, cb.slotIndex, isHorizontal);
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

    this.visuals.set(cb.id, {
      building: cb,
      container,
      hpBar,
      lastFireTime: 0,
      colliders,
    });

    this.updateHpBar(cb.id);
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
    cv.container.destroy();
    this.visuals.delete(buildingId);
  }

  private renderWoodPalisade(
    container: Phaser.GameObjects.Container,
    slotIndex: number,
    isHorizontal: boolean
  ): void {
    const span = getPerimeterWallSpan(slotIndex);

    if (isHorizontal && span) {
      const gate = this.scene.add.image(0, 0, 'woodPalisadeGate');
      gate.setDisplaySize(128, 64);
      gate.setDepth(2);
      container.add(gate);

      this.addHorizontalPalisadeWing(container, span.negCorner + 32, -60);
      this.addHorizontalPalisadeWing(container, 60, span.posCorner - 32);

      const leftCorner = this.scene.add.image(span.negCorner, 0, 'woodPalisadeCorner');
      leftCorner.setDisplaySize(64, 64);
      leftCorner.setDepth(3);
      container.add(leftCorner);

      const rightCorner = this.scene.add.image(span.posCorner, 0, 'woodPalisadeCorner');
      rightCorner.setDisplaySize(64, 64);
      rightCorner.setDepth(3);
      container.add(rightCorner);
    } else if ((slotIndex === 2 || slotIndex === 3) && span) {
      const gate = this.scene.add.image(0, 0, 'woodPalisadeGateV');
      gate.setDisplaySize(64, 128);
      gate.setDepth(2);
      container.add(gate);

      this.addVerticalPalisadeWing(container, span.negCorner, -60);
      this.addVerticalPalisadeWing(container, 60, span.posCorner);
    } else {
      const palisade = this.scene.add.image(0, -10, 'woodPalisade');
      palisade.setDisplaySize(128, 128);
      container.add(palisade);
    }
  }

  private addHorizontalPalisadeWing(
    container: Phaser.GameObjects.Container,
    startX: number,
    endX: number
  ): void {
    const totalW = Math.max(64, endX - startX);
    const segments = Math.max(1, Math.round(totalW / 192));
    const segW = totalW / segments;
    for (let i = 0; i < segments; i++) {
      const cx = startX + (i + 0.5) * segW;
      const wing = this.scene.add.image(cx, 0, 'woodPalisadeH');
      wing.setDisplaySize(segW + 2, 64);
      wing.setDepth(1);
      container.add(wing);
    }
  }

  private addVerticalPalisadeWing(
    container: Phaser.GameObjects.Container,
    startY: number,
    endY: number
  ): void {
    const totalH = Math.max(64, endY - startY);
    const segments = Math.max(1, Math.round(totalH / 192));
    const segH = totalH / segments;
    for (let i = 0; i < segments; i++) {
      const cy = startY + (i + 0.5) * segH;
      const wing = this.scene.add.image(0, cy, 'woodPalisadeV');
      wing.setDisplaySize(64, segH + 2);
      wing.setDepth(1);
      container.add(wing);
    }
  }

  private renderStoneWall(
    container: Phaser.GameObjects.Container,
    slotIndex: number,
    isHorizontal: boolean
  ): void {
    const wallGraphics = this.scene.add.graphics();
    const mainColor = 0x64748b;
    const borderColor = 0xe2e8f0;
    const span = getPerimeterWallSpan(slotIndex);
    const gate = WALL_GATE_HALF_OPENING;

    if (!span) {
      wallGraphics.fillStyle(mainColor, 0.94);
      wallGraphics.lineStyle(2.5, borderColor, 0.95);
      wallGraphics.fillRoundedRect(-44, -12, 88, 40, 6);
      wallGraphics.strokeRoundedRect(-44, -12, 88, 40, 6);
      container.add(wallGraphics);
      return;
    }

    if (isHorizontal) {
      const leftW = -gate - span.minEdge;
      const rightW = span.maxEdge - gate;
      wallGraphics.fillStyle(mainColor, 0.94);
      wallGraphics.lineStyle(2.5, borderColor, 0.95);
      wallGraphics.fillRoundedRect(span.minEdge, -15, leftW, 30, 6);
      wallGraphics.strokeRoundedRect(span.minEdge, -15, leftW, 30, 6);
      wallGraphics.fillRoundedRect(gate, -15, rightW, 30, 6);
      wallGraphics.strokeRoundedRect(gate, -15, rightW, 30, 6);

      wallGraphics.fillStyle(0x334155, 0.55);
      wallGraphics.fillRoundedRect(-gate, -8, gate * 2, 16, 3);
      wallGraphics.fillStyle(0x94a3b8, 1);
      wallGraphics.fillRoundedRect(-54, -18, 14, 36, 4);
      wallGraphics.strokeRoundedRect(-54, -18, 14, 36, 4);
      wallGraphics.fillRoundedRect(40, -18, 14, 36, 4);
      wallGraphics.strokeRoundedRect(40, -18, 14, 36, 4);

      for (const cx of [span.negCorner, span.posCorner]) {
        wallGraphics.fillStyle(mainColor, 1);
        wallGraphics.fillRoundedRect(cx - 18, -18, 36, 36, 6);
        wallGraphics.strokeRoundedRect(cx - 18, -18, 36, 36, 6);
      }

      for (let px = span.negCorner + 24; px <= span.posCorner - 24; px += 28) {
        if (Math.abs(px) < 56) continue;
        wallGraphics.fillStyle(0x94a3b8, 1);
        wallGraphics.fillCircle(px, 0, 5);
      }
    } else {
      const topH = -gate - span.minEdge;
      const bottomH = span.maxEdge - gate;
      wallGraphics.fillStyle(mainColor, 0.94);
      wallGraphics.lineStyle(2.5, borderColor, 0.95);
      wallGraphics.fillRoundedRect(-15, span.minEdge, 30, topH, 6);
      wallGraphics.strokeRoundedRect(-15, span.minEdge, 30, topH, 6);
      wallGraphics.fillRoundedRect(-15, gate, 30, bottomH, 6);
      wallGraphics.strokeRoundedRect(-15, gate, 30, bottomH, 6);

      wallGraphics.fillStyle(0x334155, 0.55);
      wallGraphics.fillRoundedRect(-8, -gate, 16, gate * 2, 3);
      wallGraphics.fillStyle(0x94a3b8, 1);
      wallGraphics.fillRoundedRect(-18, -54, 36, 14, 4);
      wallGraphics.strokeRoundedRect(-18, -54, 36, 14, 4);
      wallGraphics.fillRoundedRect(-18, 40, 36, 14, 4);
      wallGraphics.strokeRoundedRect(-18, 40, 36, 14, 4);

      for (let py = span.negCorner + 24; py <= span.posCorner - 24; py += 28) {
        if (Math.abs(py) < 56) continue;
        wallGraphics.fillStyle(0x94a3b8, 1);
        wallGraphics.fillCircle(0, py, 5);
      }
    }
    container.add(wallGraphics);
  }
}
