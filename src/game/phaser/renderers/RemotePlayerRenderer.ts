import Phaser from 'phaser';
import { Player } from '../../../types/game';
import { serverSync } from '../../../lib/serverSync';
import { ySortDepth } from '../../depthLayers';

interface RemotePlayerVisual {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  nameTag: Phaser.GameObjects.Text;
  data: Player;
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

      visual = { container, sprite, nameTag, data };
      this.remotePlayers.set(data.id, visual);
    }

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

    visual.container.setDepth(ySortDepth(data.y, 24));
    visual.sprite.setFlipX(data.direction === 'left');
    visual.nameTag.setText(data.name);

    const animKey = `${data.color}_${data.action}`;
    if (scene.anims.exists(animKey)) {
      visual.sprite.play(animKey, true);
    }
  }

  public removePlayer(id: string): void {
    serverSync.removePlayerCache(id);
    const visual = this.remotePlayers.get(id);
    if (visual) {
      visual.container.destroy();
      this.remotePlayers.delete(id);
    }
  }

  public clear(): void {
    this.remotePlayers.forEach((visual) => visual.container.destroy());
    this.remotePlayers.clear();
  }
}
