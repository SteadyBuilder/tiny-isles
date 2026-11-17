import Phaser from 'phaser';
import {
  ELITE_SPAWN_CHANCE_BY_DIFFICULTY,
  pickRandomEliteAffix,
} from '../../data/elites';
import { rollCampRewardItem } from '../../data/items';
import {
  CAMP_RING_TEMPLATES,
  HUNTING_AI_CONFIG,
  computeCampRing,
} from '../../data/monsterCamps';
import { sound } from '../../lib/sound';
import {
  EquipmentItem,
  Island,
  Monster,
  MonsterCampState,
} from '../../types/game';
import { MissionDifficultyConfig } from '../../types/room';
import {
  TERRITORY_CENTER_X,
  TERRITORY_CENTER_Y,
  getIslandOrigin,
} from '../constants';
import { ySortDepth } from '../depthLayers';
import { GameEvents } from '../events/gameEvents';
import { MonsterVisual, MonsterVisualManager } from './MonsterVisualManager';

interface CampVisualNode {
  camp: MonsterCampState;
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  hpBar: Phaser.GameObjects.Graphics;
  titleText: Phaser.GameObjects.Text;
  statusText: Phaser.GameObjects.Text;
}

export interface IMonsterCampContext {
  scene: Phaser.Scene;
  isHuntingMode: () => boolean;
  getDifficultyConfig?: () => MissionDifficultyConfig;
  getIslands: () => Island[];
  getMonsters: () => Map<string, MonsterVisual>;
  addResources: (wood: number, stone: number, gold: number) => void;
  addThreat: (amount: number) => void;
  gainExp: (amount: number) => void;
  grantRewardItem: (item: EquipmentItem) => void;
  playChestDropAt?: (
    x: number,
    y: number,
    item: EquipmentItem,
    onOpened: (item: EquipmentItem) => void
  ) => void;
  onCampCoreDamaged?: (territoryId: number) => void;
  playExplosionAt: (x: number, y: number) => void;
  shakeObject: (target: Phaser.GameObjects.Container) => void;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
  emitTerritoriesUpdated: () => void;
}

/**
 * 사냥 특화 모드 전용: 주변 20개 영지를 병과별(근거리/창병/원거리/마법사) 몬스터 부락으로 전환하고
 * 부락 본진 파괴 시 개인별 장비 보상 지급 및 3분 후 강화 리스폰을 담당하는 시스템
 */
export class MonsterCampSystem {
  private ctx: IMonsterCampContext;
  private campNodes = new Map<number, CampVisualNode>();
  private respawnAccumMs = 0;

  constructor(ctx: IMonsterCampContext) {
    this.ctx = ctx;
  }

  private getDifficultyMultipliers(): { hpMult: number; atkMult: number; countMult: number } {
    const diff = this.ctx.getDifficultyConfig?.();
    if (!diff) {
      return { hpMult: 1, atkMult: 1, countMult: 1 };
    }
    return {
      hpMult: diff.monsterHpMultiplier,
      atkMult: diff.monsterAttackMultiplier,
      countMult: HUNTING_AI_CONFIG.campCountMultiplierByDifficulty[diff.id] ?? 1,
    };
  }

  public initializeCamps(): void {
    if (!this.ctx.isHuntingMode()) return;

    const { hpMult } = this.getDifficultyMultipliers();
    const islands = this.ctx.getIslands();
    for (const isl of islands) {
      if (isl.id === 0) continue; // 중앙 본거지(id: 0)만 유일한 수호 마을로 유지
      const ring = computeCampRing(isl.gridX, isl.gridY);
      const tpl = CAMP_RING_TEMPLATES[ring];
      const scaledCoreHp = Math.round(tpl.coreMaxHp * hpMult);

      isl.unlocked = false;
      isl.isMonsterCamp = true;
      isl.campRing = ring;
      isl.campLevel = tpl.baseLevel;
      isl.campDestroyed = false;
      isl.campRespawnSec = null;
      isl.coreHp = scaledCoreHp;
      isl.coreMaxHp = scaledCoreHp;

      const campState: MonsterCampState = {
        territoryId: isl.id,
        gridX: isl.gridX,
        gridY: isl.gridY,
        name: isl.name.replace('마을터', '마물 부락'),
        ring,
        level: tpl.baseLevel,
        coreHp: scaledCoreHp,
        coreMaxHp: scaledCoreHp,
        destroyed: false,
        respawnRemainingSec: null,
        firstCleared: false,
        clearCount: 0,
      };

      const node = this.createCampVisual(campState, tpl.buildingSprite);
      this.campNodes.set(isl.id, node);
      this.spawnCampGarrison(campState);
    }

    this.ctx.emitTerritoriesUpdated();
  }

  private createCampVisual(
    camp: MonsterCampState,
    spriteKey: 'blackTower' | 'blackCastle' | 'purpleCastle'
  ): CampVisualNode {
    const { scene } = this.ctx;
    const origin = getIslandOrigin(camp.gridX, camp.gridY);
    const cx = origin.x + TERRITORY_CENTER_X;
    const cy = origin.y + TERRITORY_CENTER_Y;

    const container = scene.add.container(cx, cy);
    container.setDepth(ySortDepth(cy, 26));

    const tex = scene.textures.exists(spriteKey) ? spriteKey : 'tower';
    const sprite = scene.add.image(0, -20, tex);
    const size = camp.ring >= 3 ? 210 : 165;
    sprite.setDisplaySize(size, size);
    container.add(sprite);

    const titleText = scene.add
      .text(0, -118, `💀 Lv.${camp.level} ${camp.name}`, {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: camp.ring >= 3 ? '#f43f5e' : '#fb923c',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    container.add(titleText);

    const statusText = scene.add
      .text(0, -98, `부락 본진 (${camp.coreHp}/${camp.coreMaxHp})`, {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#fde047',
        stroke: '#000000',
        strokeThickness: 2.5,
      })
      .setOrigin(0.5);
    container.add(statusText);

    const hpBar = scene.add.graphics();
    container.add(hpBar);

    const node: CampVisualNode = {
      camp,
      container,
      sprite,
      hpBar,
      titleText,
      statusText,
    };
    this.updateCampHpVisual(node);
    return node;
  }

  private updateCampHpVisual(node: CampVisualNode): void {
    const { camp, hpBar, titleText, statusText, sprite } = node;
    titleText.setText(
      camp.destroyed
        ? `🏳️ [토벌됨] ${camp.name}`
        : `💀 Lv.${camp.level} ${camp.name}`
    );

    if (camp.destroyed) {
      sprite.setAlpha(0.35);
      sprite.setTint(0x64748b);
      statusText.setText(`⏳ 재건까지 ${camp.respawnRemainingSec ?? 0}초`);
      statusText.setColor('#94a3b8');
      hpBar.clear();
      return;
    }

    sprite.setAlpha(1);
    sprite.clearTint();
    statusText.setText(`부락 본진 (${camp.coreHp}/${camp.coreMaxHp})`);
    statusText.setColor('#fde047');

    const ratio = Math.max(0, Math.min(1, camp.coreHp / Math.max(1, camp.coreMaxHp)));
    const barW = 104;
    const barH = 8;
    hpBar.clear();
    hpBar.fillStyle(0x0f172a, 0.92);
    hpBar.fillRect(-barW / 2 - 1, -84, barW + 2, barH + 2);
    hpBar.fillStyle(0xe11d48, 1);
    hpBar.fillRect(-barW / 2, -83, Math.max(2, barW * ratio), barH);
  }

  private spawnCampGarrison(camp: MonsterCampState): void {
    const tpl = CAMP_RING_TEMPLATES[camp.ring];
    const origin = getIslandOrigin(camp.gridX, camp.gridY);
    const cx = origin.x + TERRITORY_CENTER_X;
    const cy = origin.y + TERRITORY_CENTER_Y;
    const monsters = this.ctx.getMonsters();
    const { hpMult, atkMult, countMult } = this.getDifficultyMultipliers();
    const clearScale = 1 + camp.clearCount * 0.25;
    const totalSpecsCount = tpl.garrisonSpecs.reduce(
      (sum, s) => sum + Math.max(1, Math.round(s.count * countMult)),
      0
    );

    const diffId = this.ctx.getDifficultyConfig?.()?.id ?? 'normal';
    const eliteChance = ELITE_SPAWN_CHANCE_BY_DIFFICULTY[diffId] ?? 0.14;
    let eliteSpawnedInCamp = false;

    let idx = 0;
    for (const spec of tpl.garrisonSpecs) {
      const spawnCount = Math.max(1, Math.round(spec.count * countMult));
      for (let i = 0; i < spawnCount; i++) {
        const angle = (Math.PI * 2 * idx) / Math.max(1, totalSpecsCount) + (Math.random() - 0.5) * 0.3;
        const dist = 125 + (idx % 3) * 42;
        const mx = cx + Math.cos(angle) * dist;
        const my = cy + Math.sin(angle) * dist;

        const forceElite = camp.ring >= 2 && !eliteSpawnedInCamp && idx === totalSpecsCount - 1;
        const isElite = forceElite || Math.random() < eliteChance;
        const affix = isElite ? pickRandomEliteAffix() : null;
        if (isElite) eliteSpawnedInCamp = true;

        const hp = Math.round(spec.hp * clearScale * hpMult * (affix?.hpMultiplier ?? 1));
        const attack = Math.round(spec.attack * clearScale * atkMult * (affix?.attackMultiplier ?? 1));
        const speed = Math.round(spec.speed * (affix?.speedMultiplier ?? 1));

        const monster: Monster = {
          id: `camp_${camp.territoryId}_${Date.now()}_${idx}`,
          type: spec.type,
          name: affix
            ? `★ Lv.${camp.level} ${affix.label} ${spec.name}`
            : `Lv.${camp.level} ${spec.name}`,
          isBoss: false,
          isElite,
          eliteAffix: affix?.id,
          x: mx,
          y: my,
          hp,
          maxHp: hp,
          attack,
          speed,
          targetTerritoryId: 0,
          spawnTerritoryId: camp.territoryId,
          direction: idx % 2 === 0 ? 'left' : 'right',
          role: spec.role,
          isCampMonster: true,
          campTerritoryId: camp.territoryId,
          campRing: camp.ring,
          homeX: mx,
          homeY: my,
          expReward: Math.round(spec.expReward * clearScale * (affix?.expMultiplier ?? 1)),
        };
        monsters.set(monster.id, MonsterVisualManager.create(this.ctx.scene, monster));
        idx++;
      }
    }
  }

  public tryAttackNearestCampCore(px: number, py: number, rangePx: number, damage: number): boolean {
    if (!this.ctx.isHuntingMode()) return false;

    for (const node of this.campNodes.values()) {
      if (node.camp.destroyed) continue;
      const d = Math.hypot(px - node.container.x, py - node.container.y);
      if (d <= rangePx + 55) {
        this.damageCampCore(node, damage);
        return true;
      }
    }
    return false;
  }

  public damageCampCoresInRadius(x: number, y: number, radiusPx: number, damage: number): void {
    if (!this.ctx.isHuntingMode()) return;
    for (const node of this.campNodes.values()) {
      if (node.camp.destroyed) continue;
      const d = Math.hypot(x - node.container.x, y - node.container.y);
      if (d <= radiusPx + 45) {
        this.damageCampCore(node, damage);
      }
    }
  }

  private damageCampCore(node: CampVisualNode, damage: number): void {
    const { camp, container } = node;
    camp.coreHp = Math.max(0, camp.coreHp - damage);
    this.ctx.shakeObject(container);
    this.ctx.showFloatingText(container.x, container.y - 60, `💥 -${damage}`, '#fbbf24');
    this.updateCampHpVisual(node);
    this.ctx.onCampCoreDamaged?.(camp.territoryId);

    if (camp.coreHp <= 0) {
      this.handleCampDestroyed(node);
    }
  }

  private handleCampDestroyed(node: CampVisualNode): void {
    const { camp, container } = node;
    const tpl = CAMP_RING_TEMPLATES[camp.ring];

    camp.destroyed = true;
    camp.clearCount += 1;
    camp.firstCleared = true;
    camp.respawnRemainingSec = tpl.respawnSec;

    const isl = this.ctx.getIslands().find((i) => i.id === camp.territoryId);
    if (isl) {
      isl.campDestroyed = true;
      isl.campRespawnSec = tpl.respawnSec;
    }

    this.ctx.playExplosionAt(container.x, container.y);
    sound.playBreak();
    this.updateCampHpVisual(node);

    // 1. 자원 + 개인 경험치 + 위협도 상승
    const { wood, stone, gold } = tpl.clearResourceReward;
    this.ctx.addResources(wood, stone, gold);
    this.ctx.gainExp(tpl.clearBonusExp);
    this.ctx.addThreat(tpl.threatGainOnClear);

    // 2. 개인별 특별 장비 보상 상자 드랍 연출 (~1초 후 자동 개봉 및 지급)
    const rewardItem = rollCampRewardItem(camp.ring, camp.clearCount);
    if (this.ctx.playChestDropAt) {
      this.ctx.playChestDropAt(container.x, container.y, rewardItem, (openedItem) => {
        this.ctx.grantRewardItem(openedItem);
        GameEvents.emit(
          'game-alert',
          `🎁 [${camp.name}] 보물 상자 오픈! [${openedItem.icon}${openedItem.name}] 획득!`
        );
      });
    } else {
      this.ctx.grantRewardItem(rewardItem);
    }

    const firstClearedTotal = Array.from(this.campNodes.values()).filter(
      (n) => n.camp.firstCleared
    ).length;

    GameEvents.emit('camp-conquered', {
      territoryId: camp.territoryId,
      campName: camp.name,
      firstClearedCount: firstClearedTotal,
    });
    GameEvents.emit(
      'game-alert',
      `🏆 [${camp.name}] 본진 파괴! +${tpl.clearBonusExp} EXP! 보물 상자가 드랍되었습니다!`
    );
    this.ctx.emitTerritoriesUpdated();
  }

  public getFirstClearedCampCount(): number {
    let count = 0;
    for (const node of this.campNodes.values()) {
      if (node.camp.firstCleared) count++;
    }
    return count;
  }

  public getActiveCampTargets(): Array<{ id: number; x: number; y: number; ring: 1 | 2 | 3 | 4 }> {
    const targets: Array<{ id: number; x: number; y: number; ring: 1 | 2 | 3 | 4 }> = [];
    for (const node of this.campNodes.values()) {
      if (node.camp.destroyed) continue;
      targets.push({
        id: node.camp.territoryId,
        x: node.container.x,
        y: node.container.y,
        ring: node.camp.ring,
      });
    }
    return targets;
  }

  public healCampCore(territoryId: number, amount: number): void {
    const node = this.campNodes.get(territoryId);
    if (!node || node.camp.destroyed) return;
    if (node.camp.coreHp < node.camp.coreMaxHp) {
      node.camp.coreHp = Math.min(node.camp.coreMaxHp, node.camp.coreHp + amount);
      this.updateCampHpVisual(node);
    }
  }

  public update(deltaMs: number): void {
    if (!this.ctx.isHuntingMode() || this.campNodes.size === 0) return;

    this.respawnAccumMs += deltaMs;
    if (this.respawnAccumMs < 1000) return;
    this.respawnAccumMs -= 1000;

    let anyChanged = false;
    for (const node of this.campNodes.values()) {
      const { camp } = node;
      if (!camp.destroyed || camp.respawnRemainingSec === null) continue;

      camp.respawnRemainingSec = Math.max(0, camp.respawnRemainingSec - 1);
      if (camp.respawnRemainingSec <= 0) {
        const tpl = CAMP_RING_TEMPLATES[camp.ring];
        const { hpMult } = this.getDifficultyMultipliers();
        camp.destroyed = false;
        camp.respawnRemainingSec = null;
        camp.level += 2;
        camp.coreMaxHp = Math.round(tpl.coreMaxHp * (1 + camp.clearCount * 0.25) * hpMult);
        camp.coreHp = camp.coreMaxHp;

        const isl = this.ctx.getIslands().find((i) => i.id === camp.territoryId);
        if (isl) {
          isl.campDestroyed = false;
          isl.campRespawnSec = null;
          isl.campLevel = camp.level;
          isl.coreHp = camp.coreHp;
          isl.coreMaxHp = camp.coreMaxHp;
        }

        this.spawnCampGarrison(camp);
        anyChanged = true;
        GameEvents.emit(
          'game-alert',
          `🔥 [${camp.name}] 부락이 Lv.${camp.level}로 재건되어 더욱 강력한 보상을 품고 부활했습니다!`
        );
      }
      this.updateCampHpVisual(node);
    }

    if (anyChanged) {
      this.ctx.emitTerritoriesUpdated();
    }
  }

  public destroy(): void {
    for (const node of this.campNodes.values()) {
      if (node.container.scene) node.container.destroy();
    }
    this.campNodes.clear();
  }
}
