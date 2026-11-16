import Phaser from 'phaser';
import { Building, Island } from '../../../types/game';
import {
  generateTerritoryBuildings,
  getBuildingCollisionBox,
  getTerritoryMainBuilding,
} from '../../constants';
import { ySortDepth } from '../../depthLayers';
import { CoreGemSystem, CoreGemVisualRef } from '../../systems/CoreGemSystem';

/**
 * 영지 기본 건물(성, 집, 수도원 등) 및 본진 건물 상태 배지 비주얼 전담 렌더러
 */
export class TerritoryStructureRenderer {
  private scene: Phaser.Scene;
  private buildings: Building[] = [];
  private buildingVisuals: Phaser.GameObjects.Container[] = [];
  private mainBuildingContainers = new Map<number, Phaser.GameObjects.Container>();
  private buildingColliders: Phaser.Physics.Arcade.StaticGroup;

  constructor(scene: Phaser.Scene, buildingColliders: Phaser.Physics.Arcade.StaticGroup) {
    this.scene = scene;
    this.buildingColliders = buildingColliders;
  }

  public getBuildingColliders(): Phaser.Physics.Arcade.StaticGroup {
    return this.buildingColliders;
  }

  public getBuildingVisuals(): ReadonlyArray<Phaser.GameObjects.Container> {
    return this.buildingVisuals;
  }

  public getMainBuildingContainer(islandId: number): Phaser.GameObjects.Container | undefined {
    return this.mainBuildingContainers.get(islandId);
  }

  public spawnAllBuildings(islands: Island[], coreGemSystem?: CoreGemSystem): void {
    this.buildings = [];
    this.buildingVisuals.forEach((c) => c.destroy());
    this.buildingVisuals = [];
    this.mainBuildingContainers.clear();
    this.buildingColliders.clear(true, true);

    const mainBuildingIds = new Map<string, number>();

    for (const isl of islands) {
      if (isl.unlocked) {
        const blds = generateTerritoryBuildings(isl.id, isl.gridX, isl.gridY, isl.villageTier);
        if (blds.length > 0) {
          mainBuildingIds.set(blds[0].id, isl.id);
        }
        this.buildings.push(...blds);
      }
    }

    for (const b of this.buildings) {
      const container = this.scene.add.container(b.x, b.y);

      let bDepthBias = b.height - 20;
      if (b.type === 'castle' || b.type === 'tower') bDepthBias = 240;
      else if (b.type === 'monastery') bDepthBias = 290;
      else if (b.type === 'barracks' || b.type === 'archery') bDepthBias = 230;
      container.setDepth(ySortDepth(b.y, bDepthBias));

      const img = this.scene.add.image(0, 0, b.type).setOrigin(0, 0);
      img.setDisplaySize(b.width, b.height);
      container.add(img);

      this.buildingVisuals.push(container);

      const mainIslandId = mainBuildingIds.get(b.id);
      if (mainIslandId !== undefined) {
        this.mainBuildingContainers.set(mainIslandId, container);
        coreGemSystem?.setBuildingVisual(
          mainIslandId,
          container,
          b.x + b.width / 2,
          b.y + 42
        );
      }

      const box = getBuildingCollisionBox(b);
      const colliderSprite = this.scene.physics.add.staticSprite(
        box.x + box.w / 2,
        box.y + box.h / 2,
        ''
      );
      colliderSprite.setVisible(false);
      colliderSprite.setDisplaySize(box.w, box.h);
      colliderSprite.refreshBody();
      this.buildingColliders.add(colliderSprite);
    }
    this.buildingColliders.refresh();
  }

  /**
   * 모든 점령한 땅의 본진 건물 상태 배지 생성
   */
  public spawnAllTerritoryCores(islands: Island[], coreGemSystem: CoreGemSystem): void {
    coreGemSystem.clearAllVisuals();

    for (const isl of islands) {
      if (isl.unlocked) {
        this.createTerritoryCoreForIsland(isl, coreGemSystem);
      }
    }
  }

  public createTerritoryCoreForIsland(isl: Island, coreGemSystem: CoreGemSystem): void {
    const mainBld = getTerritoryMainBuilding(isl.id, isl.gridX, isl.gridY, isl.villageTier);
    const badgeX = mainBld.x + mainBld.width / 2;
    const badgeY = mainBld.y + 42;

    const container = this.scene.add.container(badgeX, badgeY);
    container.setDepth(ySortDepth(mainBld.y + mainBld.height, 300));

    const isCentral = isl.id === 0;
    const gemColor = isCentral ? 0x38bdf8 : 0x34d399;

    // Compact Main Building Badge (Icon + Lv + HP Gauge)
    const badge = this.scene.add.graphics();
    badge.fillStyle(0x0f172a, 0.88);
    badge.fillRoundedRect(-44, -76, 88, 36, 8);
    badge.lineStyle(1.5, gemColor, 0.95);
    badge.strokeRoundedRect(-44, -76, 88, 36, 8);
    container.add(badge);

    const tierText = this.scene.add
      .text(0, -63, `${isCentral ? '🏰' : '🏠'} Lv.${isl.villageTier}`, {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    container.add(tierText);

    const hpBar = this.scene.add.graphics();
    container.add(hpBar);

    const coreRef: CoreGemVisualRef = {
      territoryId: isl.id,
      container,
      buildingContainer: this.mainBuildingContainers.get(isl.id),
      hpBar,
      tierText,
    };
    coreGemSystem.registerVisual(isl.id, coreRef);
    coreGemSystem.updateCoreGemVisual(isl.id);
  }

  public destroy(): void {
    this.buildings = [];
    this.buildingVisuals.forEach((c) => {
      if (c.scene) c.destroy();
    });
    this.buildingVisuals = [];
    this.mainBuildingContainers.clear();
    this.buildingColliders.clear(true, true);
  }
}
