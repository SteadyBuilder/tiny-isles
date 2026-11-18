import Phaser from 'phaser';
import { Player } from '../../../types/game';
import { serverSync } from '../../../lib/serverSync';
import { setDepthIfChanged, ySortDepth } from '../../depthLayers';

interface RemotePlayerVisual {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  nameTag: Phaser.GameObjects.Text;
  data: Player;
  lastTargetX: number;
  lastTargetY: number;
  lastName: string;
  lastDirection: 'left' | 'right';
  lastAnimKey: string;
}

/**
 * 원격 플레이어 스프라이트, 이름표, 이동 보간 트윈 렌더링 전담 렌더러
 */
export class RemotePlayerRenderer {
  private scene: Phaser.Scene;
  private remotePlayers = new Map<string, RemotePlayerVisual>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public updatePlayer(data: Player, localPlayerId: string): void {
    if (data.id === localPlayerId) return;
    if (!serverSync.isLatestMove(data.id, data.lastUpdated || Date.now())) return;

    const scene = this.scene;
    let visual = this.remotePlayers.get(data.id);
    if (!visual) {
      const container = scene.add.container(data.x, data.y);

      const sprite = scene.add.sprite(0, 0, `${data.color}PawnIdle`);
      sprite.setDisplaySize(128, 128);
      container.add(sprite);

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
        data,
        lastTargetX: data.x,
        lastTargetY: data.y,
        lastName: data.name,
        lastDirection: data.direction,
        lastAnimKey: initialAnimKey,
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
