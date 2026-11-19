import Phaser from 'phaser';
import { PLAYER_COMBAT_CONFIG } from '../../../data/worldRules';
import { Player } from '../../../types/game';
import { serverSync } from '../../../lib/serverSync';
import { setDepthIfChanged, ySortDepth } from '../../depthLayers';

const HP_BAR_WIDTH = 48;
const HP_BAR_HEIGHT = 5;
const HP_BAR_OFFSET_Y = -31;

interface RemotePlayerVisual {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  nameTag: Phaser.GameObjects.Text;
  hpBar: Phaser.GameObjects.Graphics;
  data: Player;
  lastTargetX: number;
  lastTargetY: number;
  lastName: string;
  lastDirection: 'left' | 'right';
  lastAnimKey: string;
  lastHp: number;
  lastMaxHp: number;
  lastFainted: boolean;
}

/**
 * 원격 플레이어 스프라이트, 이름표, 체력바, 이동 보간 트윈 렌더링 전담 렌더러
 */
export class RemotePlayerRenderer {
  private scene: Phaser.Scene;
  private remotePlayers = new Map<string, RemotePlayerVisual>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  private resolveHpValues(data: Player): { hp: number; maxHp: number; isFainted: boolean } {
    const isFainted = Boolean(data.isFainted);
    const maxHp = Math.max(1, data.maxHp ?? PLAYER_COMBAT_CONFIG.maxHp);
    const fallbackHp = isFainted ? 0 : maxHp;
    const hp = Math.max(0, Math.min(maxHp, data.hp ?? fallbackHp));
    return { hp, maxHp, isFainted };
  }

  private drawHpBar(hpBar: Phaser.GameObjects.Graphics, hp: number, maxHp: number): void {
    const ratio = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
    hpBar.clear();
    hpBar.fillStyle(0x0f172a, 0.85);
    hpBar.fillRect(-HP_BAR_WIDTH / 2 - 1, -1, HP_BAR_WIDTH + 2, HP_BAR_HEIGHT + 2);
    const fillColor = ratio > 0.5 ? 0x22c55e : ratio > 0.25 ? 0xf59e0b : 0xef4444;
    hpBar.fillStyle(fillColor, 1);
    if (ratio > 0) {
      hpBar.fillRect(-HP_BAR_WIDTH / 2, 0, Math.max(2, HP_BAR_WIDTH * ratio), HP_BAR_HEIGHT);
    }
  }

  private applyFaintedVisual(sprite: Phaser.GameObjects.Sprite, isFainted: boolean): void {
    if (isFainted) {
      sprite.setAlpha(0.65);
      sprite.setTint(0x94a3b8);
    } else {
      sprite.setAlpha(1);
      sprite.clearTint();
    }
  }

  public updatePlayer(data: Player, localPlayerId: string): void {
    if (data.id === localPlayerId) return;
    if (!serverSync.isLatestMove(data.id, data.lastUpdated || Date.now())) return;

    const scene = this.scene;
    const { hp, maxHp, isFainted } = this.resolveHpValues(data);
    let visual = this.remotePlayers.get(data.id);
    if (!visual) {
      const container = scene.add.container(data.x, data.y);

      const sprite = scene.add.sprite(0, 0, `${data.color}PawnIdle`);
      sprite.setDisplaySize(128, 128);
      this.applyFaintedVisual(sprite, isFainted);
      container.add(sprite);

      const hpBar = scene.add.graphics();
      hpBar.setPosition(0, HP_BAR_OFFSET_Y);
      this.drawHpBar(hpBar, hp, maxHp);
      container.add(hpBar);

      const nameTag = scene.add
        .text(0, -42, data.name, {
          fontFamily: 'Pretendard, sans-serif',
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#f87171',
          stroke: '#000000',
          strokeThickness: 2.5,
        })
        .setOrigin(0.5);
      container.add(nameTag);

      const initialAnimKey = `${data.color}_${data.action}`;
      sprite.setFlipX(data.direction === 'left');
      if (scene.anims.exists(initialAnimKey)) {
        sprite.play(initialAnimKey);
      }

      visual = {
        container,
        sprite,
        nameTag,
        hpBar,
        data,
        lastTargetX: data.x,
        lastTargetY: data.y,
        lastName: data.name,
        lastDirection: data.direction,
        lastAnimKey: initialAnimKey,
        lastHp: hp,
        lastMaxHp: maxHp,
        lastFainted: isFainted,
      };
      setDepthIfChanged(container, ySortDepth(data.y, 24));
      this.remotePlayers.set(data.id, visual);
      return;
    }

    visual.data = data;

    const posChanged =
      Math.abs(visual.lastTargetX - data.x) >= 0.5 ||
      Math.abs(visual.lastTargetY - data.y) >= 0.5;
    if (posChanged) {
      visual.lastTargetX = data.x;
      visual.lastTargetY = data.y;
      scene.tweens.killTweensOf(visual.container);
      if (serverSync.shouldSnapTeleport(visual.container.x, visual.container.y, data.x, data.y, 280)) {
        visual.container.setPosition(data.x, data.y);
      } else {
        scene.tweens.add({
          targets: visual.container,
          x: data.x,
          y: data.y,
          duration: 120,
          ease: 'Linear',
        });
      }
      setDepthIfChanged(visual.container, ySortDepth(data.y, 24));
    }

    if (visual.lastDirection !== data.direction) {
      visual.lastDirection = data.direction;
      visual.sprite.setFlipX(data.direction === 'left');
    }

    if (visual.lastName !== data.name) {
      visual.lastName = data.name;
      visual.nameTag.setText(data.name);
    }

    if (visual.lastHp !== hp || visual.lastMaxHp !== maxHp) {
      visual.lastHp = hp;
      visual.lastMaxHp = maxHp;
      this.drawHpBar(visual.hpBar, hp, maxHp);
    }

    if (visual.lastFainted !== isFainted) {
      visual.lastFainted = isFainted;
      this.applyFaintedVisual(visual.sprite, isFainted);
    }

    const animKey = `${data.color}_${data.action}`;
    if (visual.lastAnimKey !== animKey) {
      visual.lastAnimKey = animKey;
      if (scene.anims.exists(animKey)) {
        visual.sprite.play(animKey, true);
      }
    }
  }

  public getActivePlayers(): Array<{ id: string; x: number; y: number; isFainted: boolean }> {
    const result: Array<{ id: string; x: number; y: number; isFainted: boolean }> = [];
    for (const visual of this.remotePlayers.values()) {
      result.push({
        id: visual.data.id,
        x: visual.container.x,
        y: visual.container.y,
        isFainted: Boolean(visual.data.isFainted),
      });
    }
    return result;
  }

  public getMinimapMarkers(): Array<{
    id: string;
    name: string;
    color: Player['color'];
    x: number;
    y: number;
    isFainted: boolean;
  }> {
    const result: Array<{
      id: string;
      name: string;
      color: Player['color'];
      x: number;
      y: number;
      isFainted: boolean;
    }> = [];
    for (const visual of this.remotePlayers.values()) {
      result.push({
        id: visual.data.id,
        name: visual.data.name,
        color: visual.data.color,
        x: visual.container.x,
        y: visual.container.y,
        isFainted: Boolean(visual.data.isFainted),
      });
    }
    return result;
  }

  public removePlayer(id: string): void {
    serverSync.removePlayerCache(id);
    const visual = this.remotePlayers.get(id);
    if (visual) {
      this.scene.tweens.killTweensOf(visual.container);
      visual.container.destroy();
      this.remotePlayers.delete(id);
    }
  }

  public clear(): void {
    this.remotePlayers.forEach((visual) => {
      this.scene.tweens.killTweensOf(visual.container);
      visual.container.destroy();
    });
    this.remotePlayers.clear();
  }
}
