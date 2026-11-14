import Phaser from 'phaser';
import { Inventory, Island } from '../../../types/game';
import { getIslandOrigin } from '../../constants';
import { DEPTH } from '../../depthLayers';

interface AltarCardRef {
  islandId: number;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  costText: Phaser.GameObjects.Text;
  canAfford: boolean;
  costSignature: string;
}

/**
 * 미점령 영지 개척 제단 카드(Altar Cards) 렌더링 및 부분 갱신 전담 렌더러.
 * 인벤토리 변경 시 전체 Text/Graphics를 파괴·재생성하지 않고,
 * 구매 가능 상태(canAfford)가 바뀐 카드의 테두리와 텍스트만 제자리(in-place) 갱신합니다.
 */
export class ExpansionAltarRenderer {
  private scene: Phaser.Scene;
  private rootContainer: Phaser.GameObjects.Container;
  private cards = new Map<number, AltarCardRef>();
  private lastStructureKey = '';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.rootContainer = scene.add.container(0, 0);
    this.rootContainer.setDepth(DEPTH.ALTAR_CARDS);
  }

  public render(islands: ReadonlyArray<Island>, inventory: Inventory): void {
    const locked = islands.filter((isl) => !isl.unlocked);
    const structureKey = locked.map((isl) => isl.id).join(',');

    if (structureKey !== this.lastStructureKey) {
      this.rebuildAll(locked, inventory);
      this.lastStructureKey = structureKey;
      return;
    }

    for (const isl of locked) {
      const card = this.cards.get(isl.id);
      if (!card) continue;

      const canAfford = this.checkAfford(isl, inventory);
      if (card.canAfford !== canAfford) {
        card.canAfford = canAfford;
        this.drawCardBackground(card.bg, canAfford);
        const nextText = this.formatCostText(isl, canAfford);
        card.costText.setText(nextText);
        card.costText.setColor(canAfford ? '#86efac' : '#fde047');
      }
    }
  }

  private rebuildAll(lockedIslands: ReadonlyArray<Island>, inventory: Inventory): void {
    this.rootContainer.removeAll(true);
    this.cards.clear();

    for (const isl of lockedIslands) {
      const origin = getIslandOrigin(isl.gridX, isl.gridY);
      const signX = origin.x + 320;
      const signY = origin.y + 320;
      const canAfford = this.checkAfford(isl, inventory);

      const cardContainer = this.scene.add.container(signX, signY);

      const shadow = this.scene.add.graphics();
      shadow.fillStyle(0x000000, 0.32);
      shadow.fillEllipse(0, 32, 130, 26);
      cardContainer.add(shadow);

      const bg = this.scene.add.graphics();
      this.drawCardBackground(bg, canAfford);
      cardContainer.add(bg);

      const nameText = this.scene.add
        .text(0, -16, `🚩 #${isl.id} 건설 부지`, {
          fontFamily: 'Pretendard, sans-serif',
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#ffffff',
        })
        .setOrigin(0.5);
      cardContainer.add(nameText);

      const costStr = this.formatCostText(isl, canAfford);
      const costText = this.scene.add
        .text(0, 9, costStr, {
          fontFamily: 'Pretendard, sans-serif',
          fontSize: '12px',
          fontStyle: 'bold',
          color: canAfford ? '#86efac' : '#fde047',
        })
        .setOrigin(0.5);
      cardContainer.add(costText);

      this.rootContainer.add(cardContainer);
      this.cards.set(isl.id, {
        islandId: isl.id,
        container: cardContainer,
        bg,
        costText,
        canAfford,
        costSignature: costStr,
      });
    }
  }

  private checkAfford(isl: Island, inventory: Inventory): boolean {
    return (
      inventory.wood >= isl.costWood &&
      inventory.stone >= isl.costStone &&
      inventory.gold >= isl.costGold
    );
  }

  private drawCardBackground(bg: Phaser.GameObjects.Graphics, canAfford: boolean): void {
    bg.clear();
    bg.fillStyle(0x0f172a, 0.9);
    bg.fillRoundedRect(-84, -34, 168, 62, 12);
    bg.lineStyle(canAfford ? 2.5 : 1.5, canAfford ? 0x4ade80 : 0xfbbf24, 1);
    bg.strokeRoundedRect(-84, -34, 168, 62, 12);
  }

  private formatCostText(isl: Island, canAfford: boolean): string {
    const goldPart = isl.costGold > 0 ? `  🪙${isl.costGold}` : '';
    const actionPart = canAfford ? '  [E]' : '';
    return `🪵${isl.costWood}  🪨${isl.costStone}${goldPart}${actionPart}`;
  }

  public destroy(): void {
    this.cards.clear();
    this.lastStructureKey = '';
    this.rootContainer.destroy(true);
  }
}
