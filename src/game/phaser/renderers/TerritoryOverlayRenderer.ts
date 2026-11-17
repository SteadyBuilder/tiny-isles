import Phaser from 'phaser';
import { Inventory, Island } from '../../../types/game';
import {
  TERRITORY_PX,
  getIslandOrigin,
  getTerritoryCorePos,
} from '../../constants';
import { DEPTH } from '../../depthLayers';
import { WorldTerrainMap } from '../../world/MapTerrainGenerator';

/**
 * 영지 점령 경계·마을 광장·건설 슬롯 마커 및 황금광산 봉인 오버레이 전담 렌더러
 */
export class TerritoryOverlayRenderer {
  private scene: Phaser.Scene;
  private overlayGraphics: Phaser.GameObjects.Graphics;
  private goldMineSealText: Phaser.GameObjects.Text | null = null;
  private lastOverlaySignature = '';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.overlayGraphics = scene.add.graphics();
    this.overlayGraphics.setDepth(DEPTH.TERRAIN);
  }

  public render(
    islands: ReadonlyArray<Island>,
    inventory: Inventory,
    gmZone: WorldTerrainMap['goldMineZone'],
    force = false
  ): void {
    const signature = islands
      .map((isl) => {
        const canAfford =
          !isl.unlocked &&
          inventory.wood >= isl.costWood &&
          inventory.stone >= isl.costStone &&
          inventory.gold >= isl.costGold;
        return `${isl.id}:${isl.unlocked ? `1:${isl.villageTier}` : `0:${canAfford ? 1 : 0}`}`;
      })
      .join('|');

    if (!force && signature === this.lastOverlaySignature) {
      return;
    }
    this.lastOverlaySignature = signature;

    const g = this.overlayGraphics;
    g.clear();

    for (const isl of islands) {
      const origin = getIslandOrigin(isl.gridX, isl.gridY);
      const corePos = getTerritoryCorePos(isl.gridX, isl.gridY);
      if (isl.unlocked) {
        g.lineStyle(2, 0x93c5fd, 0.28);
        g.strokeRect(origin.x, origin.y, TERRITORY_PX, TERRITORY_PX);
      } else if (isl.isMonsterCamp) {
        // 사냥 특화 모드: 몬스터 부락 영역 표시
        g.fillStyle(isl.campDestroyed ? 0x0f172a : 0x450a0a, isl.campDestroyed ? 0.2 : 0.28);
        g.fillCircle(corePos.x, corePos.y, 145);
        g.lineStyle(
          2,
          isl.campDestroyed ? 0x64748b : (isl.campRing ?? 1) >= 3 ? 0xc084fc : 0xf87171,
          0.55
        );
        g.strokeRect(origin.x + 8, origin.y + 8, TERRITORY_PX - 16, TERRITORY_PX - 16);
      } else {
        // Unoccupied build plot marker (reserved for constructing new villages)
        g.fillStyle(0x0f172a, 0.44);
        g.fillRect(origin.x, origin.y, TERRITORY_PX, TERRITORY_PX);

        const canAfford =
          inventory.wood >= isl.costWood &&
          inventory.stone >= isl.costStone &&
          inventory.gold >= isl.costGold;

        g.lineStyle(canAfford ? 3 : 2, canAfford ? 0x4ade80 : 0xfbbf24, canAfford ? 0.85 : 0.6);
        g.strokeRect(origin.x + 4, origin.y + 4, TERRITORY_PX - 8, TERRITORY_PX - 8);
      }
    }

    // Gold Mine biome seal/unlocked perimeter overlay
    const gmUnlocked = islands.some(
      (i) => i.id === gmZone.unlockTerritoryId && i.unlocked
    );
    const radius = gmZone.radiusPx - 18;
    if (gmUnlocked) {
      g.lineStyle(2.5, 0xfde047, 0.45);
      g.strokeCircle(gmZone.centerX, gmZone.centerY, radius);
      if (this.goldMineSealText) {
        this.goldMineSealText.destroy();
        this.goldMineSealText = null;
      }
    } else {
      g.fillStyle(0x1c1917, 0.56);
      g.fillCircle(gmZone.centerX, gmZone.centerY, radius);
      g.lineStyle(3, 0xfbbf24, 0.8);
      g.strokeCircle(gmZone.centerX, gmZone.centerY, radius);

      if (!this.goldMineSealText) {
        this.goldMineSealText = this.scene.add
          .text(
            gmZone.centerX,
            gmZone.centerY,
            '🔒 봉인된 황금광산\n(#11 극서 태양금광 변경 마을터 점령 시 해금)',
            {
              fontFamily: 'Pretendard, sans-serif',
              fontSize: '13px',
              fontStyle: 'bold',
              color: '#fde047',
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              padding: { x: 12, y: 8 },
              align: 'center',
            }
          )
          .setOrigin(0.5)
          .setDepth(DEPTH.ALTAR_CARDS);
      }
    }
  }

  public destroy(): void {
    this.overlayGraphics?.destroy();
    if (this.goldMineSealText) {
      this.goldMineSealText.destroy();
      this.goldMineSealText = null;
    }
    this.lastOverlaySignature = '';
  }
}
