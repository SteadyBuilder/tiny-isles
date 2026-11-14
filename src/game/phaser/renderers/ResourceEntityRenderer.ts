import Phaser from 'phaser';
import confetti from 'canvas-confetti';
import { ConstructedBuilding, Entity, Island } from '../../../types/game';
import { GOLD_MINE_BIOME_CONFIG, RESOURCE_DISTRIBUTION_CONFIG } from '../../../data/biomes';
import { sound } from '../../../lib/sound';
import { ySortDepth } from '../../depthLayers';
import { GameEvents } from '../../events/gameEvents';
import { WORLD_BOUNDS } from '../../worldBounds';
import { WorldTerrainMap } from '../../world/MapTerrainGenerator';
import {
  generateGoldMineClusterEntities,
  generateWorldResourceEntities,
  pickRespawnSpot,
} from '../../world/ResourceDistributionSystem';

export interface EntityVisual {
  entity: Entity;
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  hpBar?: Phaser.GameObjects.Graphics;
}

export interface IResourceEntityContext {
  scene: Phaser.Scene;
  terrainMap: WorldTerrainMap;
  isSceneAlive: () => boolean;
  getIslands: () => Island[];
  getConstructedBuildings: () => ConstructedBuilding[];
  shakeObject: (target: Phaser.GameObjects.Container) => void;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
}

/**
 * 나무, 돌, 황금광맥, 양 등 월드 자원 엔티티 스폰·HP바·리스폰·원격 타격 전담 렌더러
 */
export class ResourceEntityRenderer {
  private ctx: IResourceEntityContext;
  private entityVisuals = new Map<string, EntityVisual>();

  constructor(ctx: IResourceEntityContext) {
    this.ctx = ctx;
  }

  public isGoldMineUnlocked(): boolean {
    return this.ctx
      .getIslands()
      .some((i) => i.id === GOLD_MINE_BIOME_CONFIG.unlockTerritoryId && i.unlocked);
  }

  public getEntities(): Entity[] {
    return Array.from(this.entityVisuals.values()).map((ev) => ev.entity);
  }

  public findNearestVisual(x: number, y: number, maxDist: number): EntityVisual | null {
    let nearest: EntityVisual | null = null;
    let minDist = maxDist;
    this.entityVisuals.forEach((ev) => {
      const dist = Math.hypot(x - (ev.entity.x + 16), y - (ev.entity.y + 16));
      if (dist < minDist) {
        minDist = dist;
        nearest = ev;
      }
    });
    return nearest;
  }

  public removeForIsland(islandId: number): void {
    for (const [entId, ev] of this.entityVisuals.entries()) {
      if (ev.entity.islandId === islandId) {
        ev.container.destroy();
        this.entityVisuals.delete(entId);
      }
    }
  }

  public spawnAll(): void {
    this.entityVisuals.forEach((ev) => ev.container.destroy());
    this.entityVisuals.clear();

    const allEntities = generateWorldResourceEntities(
      this.ctx.terrainMap,
      this.ctx.getIslands(),
      WORLD_BOUNDS,
      this.ctx.getConstructedBuildings(),
      this.isGoldMineUnlocked()
    );

    for (const ent of allEntities) {
      this.spawnEntity(ent);
    }
  }

  public spawnEntity(ent: Entity): void {
    const { scene } = this.ctx;
    const container = scene.add.container(ent.x, ent.y);
    let entDepthBias = 16;
    if (ent.type === 'rock' || ent.type === 'gold_rock') entDepthBias = 20;
    container.setDepth(ySortDepth(ent.y, entDepthBias));

    let sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;

    if (ent.type === 'tree') {
      const isTree3 = ent.id.includes('2') || ent.id.includes('4');
      const key = isTree3 ? 'tree3' : 'tree';
      const animKey = isTree3 ? 'tree3_anim' : 'tree_anim';
      const drawH = isTree3 ? 150 : 185;

      const treeSprite = scene.add.sprite(16, 40 - drawH / 2, key);
      treeSprite.setDisplaySize(145, drawH);
      if (scene.anims.exists(animKey)) {
        treeSprite.play(animKey);
      }
      sprite = treeSprite;
    } else if (ent.type === 'rock') {
      const isRock2 = ent.id.includes('2') || ent.id.includes('5');
      const rockKey = isRock2 ? 'rock2' : 'rock1';

      const rockImg = scene.add.image(32, 16, rockKey);
      rockImg.setDisplaySize(64, 64);
      sprite = rockImg;
    } else if (ent.type === 'gold_rock') {
      const useVariant2 = ent.id.includes('2') || ent.id.includes('4') || ent.id.includes('6');
      const goldKey =
        useVariant2 && scene.textures.exists('goldResource2')
          ? 'goldResource2'
          : 'goldResource';
      if (scene.textures.exists(goldKey)) {
        const goldImg = scene.add.image(32, 14, goldKey);
        goldImg.setDisplaySize(96, 96);
        sprite = goldImg;
      } else {
        const rockImg = scene.add.image(32, 16, 'rock2');
        rockImg.setDisplaySize(64, 64);
        rockImg.setTint(0xffd700);
        sprite = rockImg;
      }
    } else {
      const sheepSprite = scene.add.sprite(32, 24, 'sheep');
      sheepSprite.setDisplaySize(96, 96);
      if (scene.anims.exists('sheep_anim')) {
        sheepSprite.play('sheep_anim');
      }
      sprite = sheepSprite;
    }

    container.add(sprite);

    const hpBar = scene.add.graphics();
    container.add(hpBar);

    this.entityVisuals.set(ent.id, {
      entity: ent,
      container,
      sprite,
      hpBar,
    });

    this.updateHpBar(ent.id);
  }

  public updateHpBar(entityId: string): void {
    const visual = this.entityVisuals.get(entityId);
    if (!visual || !visual.hpBar) return;

    visual.hpBar.clear();
    const ent = visual.entity;
    if (ent.hp < ent.maxHp && ent.type !== 'sheep') {
      const barW = 40;
      const barH = 5;
      const barX = 16 - barW / 2;
      const barY = -12;

      visual.hpBar.fillStyle(0x000000, 0.6);
      visual.hpBar.fillRect(barX, barY, barW, barH);
      visual.hpBar.fillStyle(0x4caf50, 1);
      visual.hpBar.fillRect(barX, barY, (ent.hp / ent.maxHp) * barW, barH);
    }
  }

  public removeAndRespawn(ent: Entity): void {
    const visual = this.entityVisuals.get(ent.id);
    if (visual) {
      visual.container.destroy();
      this.entityVisuals.delete(ent.id);
    }

    this.ctx.scene.time.delayedCall(RESOURCE_DISTRIBUTION_CONFIG.respawnDelayMs, () => {
      if (!this.ctx.isSceneAlive()) return;
      const activeEntities = this.getEntities();
      const nextSpot = pickRespawnSpot(
        ent.type,
        activeEntities,
        this.ctx.terrainMap,
        this.ctx.getIslands(),
        WORLD_BOUNDS,
        this.ctx.getConstructedBuildings(),
        {
          goldMineUnlocked: this.isGoldMineUnlocked(),
          zoneTag: ent.zoneTag,
        }
      );
      if (nextSpot) {
        ent.x = nextSpot.x;
        ent.y = nextSpot.y;
        ent.type = nextSpot.type;
        ent.hp = nextSpot.maxHp;
        ent.maxHp = nextSpot.maxHp;
        ent.zoneTag = nextSpot.zoneTag;
        this.spawnEntity(ent);
      }
    });
  }

  public spawnGoldMineClusterAndAnnounce(): void {
    const activeEntities = this.getEntities();
    const hasCluster = activeEntities.some((e) => e.zoneTag === 'gold_mine');
    if (!hasCluster) {
      const mineNodes = generateGoldMineClusterEntities(
        this.ctx.terrainMap,
        this.ctx.getIslands(),
        WORLD_BOUNDS,
        activeEntities,
        this.ctx.getConstructedBuildings()
      );
      for (const node of mineNodes) {
        this.spawnEntity(node);
      }
    }

    const gm = GOLD_MINE_BIOME_CONFIG;
    confetti({ particleCount: 130, spread: 95, origin: { y: 0.55 } });
    this.ctx.showFloatingText(gm.centerX, gm.centerY - 40, `⛏️ ${gm.announcementText}`, '#fde047');
    GameEvents.emit('game-alert', gm.announcementText);
  }

  public handleRemoteHit(entityId: string, damage: number): void {
    const visual = this.entityVisuals.get(entityId);
    if (!visual) return;

    visual.entity.hp -= damage;
    this.ctx.shakeObject(visual.container);
    this.updateHpBar(entityId);

    if (visual.entity.type === 'tree') sound.playChop();
    else sound.playMine();

    if (visual.entity.hp <= 0) {
      sound.playBreak();
      this.removeAndRespawn(visual.entity);
    }
  }

  public destroy(): void {
    this.entityVisuals.forEach((ev) => {
      if (ev.container.scene) {
        ev.container.destroy();
      }
    });
    this.entityVisuals.clear();
  }
}
