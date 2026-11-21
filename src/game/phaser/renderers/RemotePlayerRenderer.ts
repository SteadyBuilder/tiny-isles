import Phaser from 'phaser';
import { PLAYER_COMBAT_CONFIG } from '../../../data/worldRules';
import { Player, PlayerClassId, PlayerColor } from '../../../types/game';
import { serverSync } from '../../../lib/serverSync';
import { setDepthIfChanged, ySortDepth } from '../../depthLayers';
import {
  computePlayerSpriteMetrics,
  normalizePlayerClassId,
  resolveRemotePlayerAnimKey,
} from '../../utils/playerAnimationUtils';
import { ensureClassSpritesLoaded } from '../utils/classAssetLoader';

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
  lastClassId: PlayerClassId;
  lastColor: PlayerColor;
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

  private syncSpriteDisplaySize(sprite: Phaser.GameObjects.Sprite): void {
    const frameW = sprite.frame?.realWidth || sprite.width || 192;
    const frameH = sprite.frame?.realHeight || sprite.height || 192;
    const metrics = computePlayerSpriteMetrics(frameW, frameH);
    sprite.setDisplaySize(metrics.displayWidth, metrics.displayHeight);
  }

  private applyRemoteAnimation(visual: RemotePlayerVisual, forcePlay = false): void {
    const animKey = resolveRemotePlayerAnimKey(
      visual.lastColor,
      visual.lastClassId,
      visual.data.action,
      (key) => this.scene.anims.exists(key)
    );
    if (!forcePlay && visual.lastAnimKey === animKey) return;
    visual.lastAnimKey = animKey;
    if (this.scene.anims.exists(animKey)) {
      visual.sprite.play(animKey, true);
      this.syncSpriteDisplaySize(visual.sprite);
    }
  }

  private loadRemoteClassVisual(playerId: string, color: PlayerColor, classId: PlayerClassId): void {
    ensureClassSpritesLoaded(this.scene, color, classId, () => {
      if (!this.scene.sys || !this.scene.scene?.isActive()) return;
      const latest = this.remotePlayers.get(playerId);
      if (!latest || !latest.sprite?.active) return;
      if (latest.lastColor !== color || latest.lastClassId !== classId) return;
      this.applyRemoteAnimation(latest, true);
    });
  }

  public updatePlayer(data: Player, localPlayerId: string): void {
    if (data.id === localPlayerId) return;
    if (!serverSync.isLatestMove(data.id, data.lastUpdated || Date.now())) return;

    const scene = this.scene;
    const classId = normalizePlayerClassId(data.classId);
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

      sprite.setFlipX(data.direction === 'left');

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
        lastClassId: classId,
        lastColor: data.color,
        lastAnimKey: '',
        lastHp: hp,
        lastMaxHp: maxHp,
        lastFainted: isFainted,
      };
      setDepthIfChanged(container, ySortDepth(data.y, 24));
      this.remotePlayers.set(data.id, visual);

      this.applyRemoteAnimation(visual, true);
      if (classId !== 'pawn') {
        this.loadRemoteClassVisual(data.id, data.color, classId);
      }
      return;
    }

    visual.data = data;

    const posChanged =
      Math.abs(visual.lastTargetX - data.x) >= 0.5 ||
      Math.abs(visual.lastTargetY - data.y) >= 0.5;
    if (posChanged) {
      visual.lastTargetX = data.x;
      visual.lastTargetY = data.y;
      if (serverSync.shouldSnapTeleport(visual.container.x, visual.container.y, data.x, data.y, 280)) {
        visual.container.setPosition(data.x, data.y);
        setDepthIfChanged(visual.container, ySortDepth(data.y, 24));
      }
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

    const classOrColorChanged = visual.lastClassId !== classId || visual.lastColor !== data.color;
    if (classOrColorChanged) {
      visual.lastClassId = classId;
      visual.lastColor = data.color;
      this.applyRemoteAnimation(visual, true);
      if (classId !== 'pawn') {
        this.loadRemoteClassVisual(data.id, data.color, classId);
      }
      return;
    }

    this.applyRemoteAnimation(visual);
  }

  /**
   * 프레임 기반 지수 감쇠 선형 보간(Lerp) - 매 패킷 Tween 객체 할당/파괴로 인한 모바일 GC 잔끊김 제거
   */
  public update(deltaMs: number): void {
    if (this.remotePlayers.size === 0) return;
    const dtSec = Math.min(0.1, Math.max(0.001, deltaMs / 1000));
    const lerpFactor = 1 - Math.exp(-12 * dtSec);

    for (const visual of this.remotePlayers.values()) {
      const dx = visual.lastTargetX - visual.container.x;
      const dy = visual.lastTargetY - visual.container.y;
      if (Math.abs(dx) < 0.35 && Math.abs(dy) < 0.35) {
        if (dx !== 0 || dy !== 0) {
          visual.container.setPosition(visual.lastTargetX, visual.lastTargetY);
          setDepthIfChanged(visual.container, ySortDepth(visual.lastTargetY, 24));
        }
        continue;
      }
      const nextX = visual.container.x + dx * lerpFactor;
      const nextY = visual.container.y + dy * lerpFactor;
      visual.container.setPosition(nextX, nextY);
      setDepthIfChanged(visual.container, ySortDepth(nextY, 24));
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
