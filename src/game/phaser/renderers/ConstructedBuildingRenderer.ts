import Phaser from 'phaser';
import { ConstructedBuilding, Island } from '../../../types/game';
import { getBlueprint } from '../../constants';
import { ySortDepth } from '../../depthLayers';
import {
  getConstructedBuildingFootprintBox,
  getWallCollisionBoxes,
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
        this.renderStoneWall(container, isHorizontal);
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
    if (isHorizontal) {
      const gate = this.scene.add.image(0, 0, 'woodPalisadeGate');
      gate.setDisplaySize(128, 64);
      gate.setDepth(2);
      container.add(gate);

      const leftWing = this.scene.add.image(-164, 0, 'woodPalisadeH');
      leftWing.setDisplaySize(208, 64);
      leftWing.setDepth(1);
      container.add(leftWing);

      const rightWing = this.scene.add.image(164, 0, 'woodPalisadeH');
      rightWing.setDisplaySize(208, 64);
      rightWing.setDepth(1);
      container.add(rightWing);

      const leftCorner = this.scene.add.image(-268, 0, 'woodPalisadeCorner');
      leftCorner.setDisplaySize(64, 64);
      leftCorner.setDepth(3);
      container.add(leftCorner);

      const rightCorner = this.scene.add.image(268, 0, 'woodPalisadeCorner');
      rightCorner.setDisplaySize(64, 64);
      rightCorner.setDepth(3);
      container.add(rightCorner);
    } else if (slotIndex === 2 || slotIndex === 3) {
      const gate = this.scene.add.image(0, 0, 'woodPalisadeGateV');
      gate.setDisplaySize(64, 128);
      gate.setDepth(2);
      container.add(gate);

      const topWing = this.scene.add.image(0, -178, 'woodPalisadeV');
      topWing.setDisplaySize(64, 242);
      topWing.setDepth(1);
      container.add(topWing);

      const bottomWing = this.scene.add.image(0, 148, 'woodPalisadeV');
      bottomWing.setDisplaySize(64, 182);
      bottomWing.setDepth(1);
      container.add(bottomWing);
    } else {
      const palisade = this.scene.add.image(0, -10, 'woodPalisade');
      palisade.setDisplaySize(128, 128);
      container.add(palisade);
    }
  }

  private renderStoneWall(
    container: Phaser.GameObjects.Container,
    isHorizontal: boolean
  ): void {
    const wallGraphics = this.scene.add.graphics();
    const mainColor = 0x64748b;
    const borderColor = 0xe2e8f0;

    if (isHorizontal) {
      wallGraphics.fillStyle(mainColor, 0.94);
      wallGraphics.lineStyle(2.5, borderColor, 0.95);
      wallGraphics.fillRoundedRect(-300, -15, 256, 30, 6);
      wallGraphics.strokeRoundedRect(-300, -15, 256, 30, 6);
      wallGraphics.fillRoundedRect(44, -15, 256, 30, 6);
      wallGraphics.strokeRoundedRect(44, -15, 256, 30, 6);

      wallGraphics.fillStyle(0x334155, 0.55);
      wallGraphics.fillRoundedRect(-44, -8, 88, 16, 3);
      wallGraphics.fillStyle(0x94a3b8, 1);
      wallGraphics.fillRoundedRect(-54, -18, 14, 36, 4);
      wallGraphics.strokeRoundedRect(-54, -18, 14, 36, 4);
      wallGraphics.fillRoundedRect(40, -18, 14, 36, 4);
      wallGraphics.strokeRoundedRect(40, -18, 14, 36, 4);

      for (let px = -280; px <= 280; px += 28) {
        if (Math.abs(px) < 56) continue;
        wallGraphics.fillStyle(0x94a3b8, 1);
        wallGraphics.fillCircle(px, 0, 5);
      }
    } else {
      wallGraphics.fillStyle(mainColor, 0.94);
      wallGraphics.lineStyle(2.5, borderColor, 0.95);
      wallGraphics.fillRoundedRect(-15, -298, 30, 254, 6);
      wallGraphics.strokeRoundedRect(-15, -298, 30, 254, 6);
      wallGraphics.fillRoundedRect(-15, 44, 30, 194, 6);
      wallGraphics.strokeRoundedRect(-15, 44, 30, 194, 6);

      wallGraphics.fillStyle(0x334155, 0.55);
      wallGraphics.fillRoundedRect(-8, -44, 16, 88, 3);
      wallGraphics.fillStyle(0x94a3b8, 1);
      wallGraphics.fillRoundedRect(-18, -54, 36, 14, 4);
      wallGraphics.strokeRoundedRect(-18, -54, 36, 14, 4);
      wallGraphics.fillRoundedRect(-18, 40, 36, 14, 4);
      wallGraphics.strokeRoundedRect(-18, 40, 36, 14, 4);

      for (let py = -280; py <= 220; py += 28) {
        if (Math.abs(py) < 56) continue;
        wallGraphics.fillStyle(0x94a3b8, 1);
        wallGraphics.fillCircle(0, py, 5);
      }
    }
    container.add(wallGraphics);
  }
}
