import Phaser from 'phaser';
import { RARITY_META } from '../../../data/items';
import { sound } from '../../../lib/sound';
import { EquipmentItem } from '../../../types/game';
import { DEPTH, ySortDepth } from '../../depthLayers';
import { PhaserFxPool, isPointInSceneViewport } from '../utils/fxObjectPool';

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
  private fxPool: PhaserFxPool;

  constructor(scene: Phaser.Scene, isSceneAlive: () => boolean) {
    this.scene = scene;
    this.isSceneAlive = isSceneAlive;
    this.fxPool = new PhaserFxPool(scene, isSceneAlive);
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
    const isSetItem = item.rarity === 'set';

    const landX = x + (Math.random() - 0.5) * 44;
    const landY = y + 36;

    const root = scene.add.container(x, y - 16);
    root.setDepth(ySortDepth(landY, 180));
    this.activeContainers.add(root);

    // 1. 등급별 빛나는 바닥 조명 오라 (세트 아이템은 에메랄드 광채 강화)
    const glowImage = scene.textures.exists('loot_glow_tex')
      ? scene.add.image(0, 6, 'loot_glow_tex')
      : null;
    if (glowImage) {
      glowImage.setTint(rarityColor);
      glowImage.setAlpha(0);
      glowImage.setScale(isSetItem ? 0.95 : 0.7);
      root.add(glowImage);
    } else {
      const fallbackGlow = scene.add.graphics();
      fallbackGlow.fillStyle(rarityColor, isSetItem ? 0.45 : 0.35);
      fallbackGlow.fillCircle(0, 6, isSetItem ? 44 : 36);
      root.add(fallbackGlow);
    }

    // 2. 등급별 수직 조명 기둥 (세트/전설 아이템은 하늘로 치솟는 에메랄드/황금 기둥)
    const beamHeight = isSetItem ? 185 : item.rarity === 'legendary' ? 160 : 124;
    const lightBeam = scene.add.graphics();
    lightBeam.fillStyle(rarityColor, isSetItem ? 0.34 : 0.24);
    lightBeam.fillRect(isSetItem ? -20 : -16, -beamHeight, isSetItem ? 40 : 32, beamHeight + 4);
    lightBeam.fillStyle(isSetItem ? 0xa7f3d0 : 0xffffff, isSetItem ? 0.35 : 0.22);
    lightBeam.fillRect(-7, -beamHeight + 10, 14, beamHeight - 6);
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
    const boxTitle = isSetItem
      ? `💚✨ ${rarityMeta.label} 보물상자`
      : `✨ ${rarityMeta.label} 상자`;
    const labelText = scene.add
      .text(0, -38, boxTitle, {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: isSetItem ? '13px' : '12px',
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

        sound.playGemDrop();
        this.spawnPulseRing(landX, landY + 4, rarityColor, isSetItem ? 64 : 48);
        labelText.setAlpha(1);

        if (glowImage) {
          scene.tweens.add({
            targets: glowImage,
            alpha: isSetItem ? 0.95 : 0.85,
            scale: isSetItem ? 1.45 : 1.25,
            duration: 240,
            yoyo: true,
            repeat: isSetItem ? 3 : 2,
          });
        }
        scene.tweens.add({
          targets: lightBeam,
          alpha: isSetItem ? 1.0 : 0.9,
          duration: 240,
          yoyo: true,
          repeat: isSetItem ? 2 : 1,
        });

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

    // 6. 약 1초 후 자동으로 열리며 실제 장비 스프라이트 팝업 & 아이템 지급
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
      this.spawnPulseRing(landX, landY, rarityColor, isSetItem ? 96 : 78);
      this.spawnRaritySparks(landX, landY - 8, rarityColor);

      scene.tweens.add({
        targets: chestSprite,
        scaleX: chestSprite.scaleX * 1.24,
        scaleY: chestSprite.scaleY * 1.24,
        duration: 140,
        yoyo: true,
      });

      // 상자에서 실제 장비 스프라이트 튀어나오기
      if (item.textureKey && scene.textures.exists(item.textureKey)) {
        const itemIconSprite = scene.add.image(0, -10, item.textureKey);
        itemIconSprite.setDisplaySize(44, 44);
        root.add(itemIconSprite);
        scene.tweens.add({
          targets: itemIconSprite,
          y: -52,
          scaleX: itemIconSprite.scaleX * 1.15,
          scaleY: itemIconSprite.scaleY * 1.15,
          duration: 380,
          ease: 'Back.easeOut',
        });
      }

      labelText.setText(`[${rarityMeta.label}] ${item.name}`);
      labelText.setFontSize('13px');
      scene.tweens.add({
        targets: labelText,
        y: -90,
        duration: 850,
        ease: 'Cubic.easeOut',
      });

      onOpened(item);

      const cleanupTimer = scene.time.delayedCall(950, () => {
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

  /**
   * 물약 또는 자원 꾸러미 드랍 시 실제 스프라이트가 땅에 튀었다가 획득되는 연출
   */
  public playLootIconDrop(params: {
    x: number;
    y: number;
    textureKey: string;
    glowColorHex: string;
  }): void {
    if (!this.isSceneAlive()) return;
    const { scene } = this;
    const { x, y, textureKey, glowColorHex } = params;
    if (!scene.textures.exists(textureKey)) return;

    const glowColor = hexColorToNumber(glowColorHex);
    const landX = x + (Math.random() - 0.5) * 38;
    const landY = y + 18 + Math.random() * 14;

    const container = scene.add.container(x, y - 10);
    container.setDepth(ySortDepth(landY, 175));
    this.activeContainers.add(container);

    if (scene.textures.exists('loot_glow_tex')) {
      const glow = scene.add.image(0, 4, 'loot_glow_tex');
      glow.setTint(glowColor);
      glow.setScale(0.42);
      glow.setAlpha(0.7);
      container.add(glow);
    }

    const icon = scene.add.image(0, 0, textureKey);
    icon.setDisplaySize(36, 36);
    container.add(icon);

    scene.tweens.add({
      targets: container,
      x: landX,
      y: landY,
      duration: 240,
      ease: 'Quad.easeOut',
    });

    scene.tweens.add({
      targets: icon,
      y: -22,
      duration: 130,
      yoyo: true,
      ease: 'Sine.easeOut',
      onComplete: () => {
        if (!this.isSceneAlive() || !container.scene) return;
        this.spawnPulseRing(landX, landY, glowColor, 32);
      },
    });

    const fadeTimer = scene.time.delayedCall(750, () => {
      this.activeTimers.delete(fadeTimer);
      if (!container.scene) return;
      scene.tweens.add({
        targets: container,
        y: landY - 24,
        alpha: 0,
        duration: 260,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          this.activeContainers.delete(container);
          if (container.scene) container.destroy();
        },
      });
    });
    this.activeTimers.add(fadeTimer);
  }

  private spawnPulseRing(x: number, y: number, color: number, maxRadius: number): void {
    if (!this.isSceneAlive() || !isPointInSceneViewport(this.scene, x, y)) return;
    const ring = this.fxPool.acquireGraphics(x, y, DEPTH.EXPLOSION);
    if (!ring) return;
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
        this.fxPool.releaseGraphics(ring);
      },
    });
  }

  private spawnRaritySparks(x: number, y: number, color: number): void {
    if (!this.isSceneAlive() || !isPointInSceneViewport(this.scene, x, y)) return;
    const count = 12;
    for (let i = 0; i < count; i++) {
      const spark = this.fxPool.acquireGraphics(x, y, DEPTH.SPARK);
      if (!spark) break;
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.25;
      const dist = 36 + Math.random() * 34;
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
          this.fxPool.releaseGraphics(spark);
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
    this.fxPool.destroy();
  }
}
