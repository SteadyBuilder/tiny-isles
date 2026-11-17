import Phaser from 'phaser';
import { RARITY_META } from '../../../data/items';
import { sound } from '../../../lib/sound';
import { EquipmentItem } from '../../../types/game';
import { DEPTH, ySortDepth } from '../../depthLayers';

export interface ChestDropParams {
  x: number;
  y: number;
  item: EquipmentItem;
  onOpened: (item: EquipmentItem) => void;
}

function hexColorToNumber(hex: string): number {
  const clean = hex.replace('#', '');
  const parsed = Number.parseInt(clean, 16);
  return Number.isNaN(parsed) ? 0xfbbf24 : parsed;
}

/**
 * 몬스터 부락 파괴 시 보물 상자 드랍·등급별 빛나는 조명 이펙트·자동 개봉 연출 전담 렌더러
 */
export class LootChestDropRenderer {
  private scene: Phaser.Scene;
  private isSceneAlive: () => boolean;
  private activeContainers = new Set<Phaser.GameObjects.Container>();
  private activeTimers = new Set<Phaser.Time.TimerEvent>();

  constructor(scene: Phaser.Scene, isSceneAlive: () => boolean) {
    this.scene = scene;
    this.isSceneAlive = isSceneAlive;
  }

  public playDropAnimation(params: ChestDropParams): void {
    if (!this.isSceneAlive()) {
      params.onOpened(params.item);
      return;
    }

    const { scene } = this;
    const { x, y, item, onOpened } = params;
    const rarityMeta = RARITY_META[item.rarity];
    const rarityColor = hexColorToNumber(rarityMeta.colorHex);

    const landX = x + (Math.random() - 0.5) * 44;
    const landY = y + 36;

    const root = scene.add.container(x, y - 16);
    root.setDepth(ySortDepth(landY, 180));
    this.activeContainers.add(root);

    // 1. 등급별 빛나는 바닥 조명 오라
    const glowImage = scene.textures.exists('loot_glow_tex')
      ? scene.add.image(0, 6, 'loot_glow_tex')
      : null;
    if (glowImage) {
      glowImage.setTint(rarityColor);
      glowImage.setAlpha(0);
      glowImage.setScale(0.7);
      root.add(glowImage);
    } else {
      const fallbackGlow = scene.add.graphics();
      fallbackGlow.fillStyle(rarityColor, 0.35);
      fallbackGlow.fillCircle(0, 6, 36);
      root.add(fallbackGlow);
    }

    // 2. 등급별 수직 조명 기둥 (상자 착지 후 점등)
    const lightBeam = scene.add.graphics();
    lightBeam.fillStyle(rarityColor, 0.24);
    lightBeam.fillRect(-16, -120, 32, 124);
    lightBeam.fillStyle(0xffffff, 0.22);
    lightBeam.fillRect(-6, -110, 12, 114);
    lightBeam.setAlpha(0);
    root.add(lightBeam);

    // 3. 상자 스프라이트 (닫힌 상태로 시작)
    const chestKey = scene.textures.exists('loot_chest_closed')
      ? 'loot_chest_closed'
      : 'goldResource';
    const chestSprite = scene.add.image(0, 0, chestKey);
    chestSprite.setDisplaySize(54, 54);
    chestSprite.setScale(0.35);
    root.add(chestSprite);

    // 4. 등급 라벨 (상자 위)
    const labelText = scene.add
      .text(0, -38, `✨ ${rarityMeta.label} 상자`, {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: rarityMeta.colorHex,
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    labelText.setAlpha(0);
    root.add(labelText);

    // 5. 포물선 점프 + 착지 바운스 트윈
    scene.tweens.add({
      targets: root,
      x: landX,
      y: landY,
      duration: 300,
      ease: 'Quad.easeOut',
    });

    scene.tweens.add({
      targets: chestSprite,
      y: -36,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 150,
      yoyo: true,
      ease: 'Sine.easeOut',
      onComplete: () => {
        if (!this.isSceneAlive() || !root.scene) return;
        chestSprite.y = 0;
        chestSprite.setDisplaySize(54, 54);

        // 착지 순간 등급별 빛나는 링 & 조명 점등 + 보석/액세서리 드랍 음향
        sound.playGemDrop();
        this.spawnPulseRing(landX, landY + 4, rarityColor, 48);
        labelText.setAlpha(1);

        if (glowImage) {
          scene.tweens.add({
            targets: glowImage,
            alpha: 0.85,
            scale: 1.25,
            duration: 240,
            yoyo: true,
            repeat: 2,
          });
        }
        scene.tweens.add({
          targets: lightBeam,
          alpha: 0.9,
          duration: 220,
          yoyo: true,
          repeat: 1,
        });

        // 열리기 직전 미세 떨림
        scene.tweens.add({
          targets: chestSprite,
          angle: 6,
          duration: 60,
          yoyo: true,
          repeat: 5,
          delay: 260,
        });
      },
    });

    // 6. 약 1초 후 자동으로 열리며 등급별 빛 폭발 & 아이템 지급
    const openTimer = scene.time.delayedCall(1000, () => {
      this.activeTimers.delete(openTimer);
      if (!this.isSceneAlive() || !root.scene) {
        onOpened(item);
        return;
      }

      if (scene.textures.exists('loot_chest_open')) {
        chestSprite.setTexture('loot_chest_open');
      }
      chestSprite.angle = 0;
      chestSprite.setDisplaySize(56, 56);

      sound.playPop();
      this.spawnPulseRing(landX, landY, rarityColor, 78);
      this.spawnRaritySparks(landX, landY - 8, rarityColor);

      scene.tweens.add({
        targets: chestSprite,
        scaleX: chestSprite.scaleX * 1.24,
        scaleY: chestSprite.scaleY * 1.24,
        duration: 140,
        yoyo: true,
      });

      labelText.setText(`${item.icon} [${rarityMeta.label}] ${item.name}`);
      labelText.setFontSize('13px');
      scene.tweens.add({
        targets: labelText,
        y: -76,
        duration: 850,
        ease: 'Cubic.easeOut',
      });

      onOpened(item);

      const cleanupTimer = scene.time.delayedCall(900, () => {
        this.activeTimers.delete(cleanupTimer);
        if (!root.scene) return;
        scene.tweens.add({
          targets: root,
          alpha: 0,
          duration: 320,
          onComplete: () => {
            this.activeContainers.delete(root);
            if (root.scene) root.destroy();
          },
        });
      });
      this.activeTimers.add(cleanupTimer);
    });
    this.activeTimers.add(openTimer);
  }

  private spawnPulseRing(x: number, y: number, color: number, maxRadius: number): void {
    const ring = this.scene.add.graphics();
    ring.setPosition(x, y);
    ring.setDepth(DEPTH.EXPLOSION);
    ring.lineStyle(4, color, 0.95);
    ring.strokeCircle(0, 0, 14);
    ring.fillStyle(color, 0.25);
    ring.fillCircle(0, 0, 14);

    this.scene.tweens.add({
      targets: ring,
      scale: maxRadius / 14,
      alpha: 0,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (ring.scene) ring.destroy();
      },
    });
  }

  private spawnRaritySparks(x: number, y: number, color: number): void {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.25;
      const dist = 36 + Math.random() * 34;
      const spark = this.scene.add.graphics();
      spark.setPosition(x, y);
      spark.setDepth(DEPTH.SPARK);
      spark.fillStyle(i % 2 === 0 ? color : 0xffffff, 1);
      spark.fillCircle(0, 0, i % 2 === 0 ? 4.5 : 3);

      this.scene.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist - 18,
        alpha: 0,
        scale: 0.3,
        duration: 480,
        ease: 'Quad.easeOut',
        onComplete: () => {
          if (spark.scene) spark.destroy();
        },
      });
    }
  }

  public destroy(): void {
    for (const timer of this.activeTimers) {
      timer.remove(false);
    }
    this.activeTimers.clear();
    for (const container of this.activeContainers) {
      if (container.scene) container.destroy();
    }
    this.activeContainers.clear();
  }
}
