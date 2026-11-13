import { ConstructedBuilding, Island } from '../../types/game';
import { getTerritoryCorePos, VILLAGE_TIER_CONFIGS } from '../constants';
import { EventBus } from '../phaser/EventBus';
import { sound } from '../../lib/sound';

export interface CoreGemVisualRef {
  territoryId: number;
  container: Phaser.GameObjects.Container;
  crystal: Phaser.GameObjects.Polygon;
  aura: Phaser.GameObjects.Graphics;
  hpBar: Phaser.GameObjects.Graphics;
  tierText: Phaser.GameObjects.Text;
}

export interface ICoreGemSystemContext {
  getIslands: () => Island[];
  getConstructedBuildings: () => ConstructedBuilding[];
  removeConstructedBuilding: (buildingId: string) => void;
  removeEntityVisualsForIsland: (islandId: number) => void;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
  shakeObject: (target: Phaser.GameObjects.Container) => void;
  playExplosionAt: (x: number, y: number) => void;
  saveWorldState: () => void;
  emitWorldState: () => void;
  refreshTerritoryDecorations: () => void;
  broadcastTerritoryLost?: (territoryId: number) => void;
}

/**
 * 점령지 코어 보석(Core Gem) 체력 관리, 피격 연산, 수리 및 영지 상실(Territory Lost) 전담 시스템
 */
export class CoreGemSystem {
  private ctx: ICoreGemSystemContext;
  private coreVisuals = new Map<number, CoreGemVisualRef>();

  constructor(ctx: ICoreGemSystemContext) {
    this.ctx = ctx;
  }

  public registerVisual(territoryId: number, visual: CoreGemVisualRef) {
    this.coreVisuals.set(territoryId, visual);
  }

  public unregisterVisual(territoryId: number) {
    const cv = this.coreVisuals.get(territoryId);
    if (cv) {
      cv.container.destroy();
      this.coreVisuals.delete(territoryId);
    }
  }

  public getVisual(territoryId: number): CoreGemVisualRef | undefined {
    return this.coreVisuals.get(territoryId);
  }

  public clearAllVisuals() {
    for (const cv of this.coreVisuals.values()) {
      cv.container.destroy();
    }
    this.coreVisuals.clear();
  }

  /**
   * 점령지 코어 보석 피격 처리
   * 체력이 0이 되면 영지 상실(loseTerritory) 발생!
   */
  public damageTerritoryCore(
    territoryId: number,
    damage: number,
    attackerName = '마물',
    isLocalTrigger = false
  ): boolean {
    const islands = this.ctx.getIslands();
    const isl = islands.find((i) => i.id === territoryId);
    if (!isl || !isl.unlocked) return false;

    isl.coreHp = Math.max(0, isl.coreHp - damage);
    this.updateCoreGemVisual(territoryId);

    const cv = this.coreVisuals.get(territoryId);
    if (cv) {
      this.ctx.shakeObject(cv.container);
    }

    const cPos = getTerritoryCorePos(isl.gridX, isl.gridY);
    this.ctx.showFloatingText(cPos.x, cPos.y - 40, `💥 코어 피격 -${damage}`, '#ef4444');

    if (isl.coreHp <= 0) {
      this.loseTerritory(territoryId, attackerName, isLocalTrigger);
      return true;
    } else {
      this.ctx.saveWorldState();
      this.ctx.emitWorldState();
      return false;
    }
  }

  /**
   * 코어 보석 파괴에 따른 영지 상실(Territory Lost) 처리
   */
  public loseTerritory(territoryId: number, attackerName: string, isLocalTrigger: boolean) {
    const islands = this.ctx.getIslands();
    const isl = islands.find((i) => i.id === territoryId);
    if (!isl) return;

    const cPos = getTerritoryCorePos(isl.gridX, isl.gridY);
    this.ctx.playExplosionAt(cPos.x, cPos.y);
    sound.playBreak();

    if (territoryId !== 0) {
      // 외곽/확장 점령지의 코어 보석이 부숴진 경우: 해당 땅 상실
      isl.unlocked = false;
      isl.villageTier = 0;
      isl.coreMaxHp = VILLAGE_TIER_CONFIGS[0].coreMaxHp;
      isl.coreHp = isl.coreMaxHp;

      // 비주얼 제거
      this.unregisterVisual(territoryId);

      // 해당 영지에 지어진 모든 건물 철거
      const constructedBuildings = this.ctx.getConstructedBuildings();
      const toRemove = constructedBuildings.filter((b) => b.territoryId === territoryId);
      for (const b of toRemove) {
        this.ctx.removeConstructedBuilding(b.id);
      }

      // 해당 영지의 자원 엔티티 비활성화
      this.ctx.removeEntityVisualsForIsland(territoryId);

      this.ctx.saveWorldState();
      this.ctx.refreshTerritoryDecorations();
      this.ctx.emitWorldState();

      const lostMsg = `💔 [땅 상실!] ${attackerName}의 공격으로 '${isl.name}'의 코어 보석이 부숴져 땅을 잃었습니다! 마물들이 중심부를 향해 진격합니다!`;
      this.ctx.showFloatingText(cPos.x, cPos.y - 70, `💔 코어 보석 파괴! [${isl.name} 상실]`, '#ef4444');
      EventBus.emit('game-alert', lostMsg);
      EventBus.emit('territory-lost', { territoryId, name: isl.name });

      if (isLocalTrigger && this.ctx.broadcastTerritoryLost) {
        this.ctx.broadcastTerritoryLost(territoryId);
      }
    } else {
      // #0 중심 마을 코어 보석이 파괴된 경우:
      // 다른 확장 영지가 남아있다면 최외곽 영지를 대신 잃고, 중심 마을은 수호 결계로 50% 복구
      const otherUnlocked = islands.filter((i) => i.unlocked && i.id !== 0);
      if (otherUnlocked.length > 0) {
        const outermost = otherUnlocked[otherUnlocked.length - 1];
        this.loseTerritory(outermost.id, attackerName, isLocalTrigger);
      }
      isl.coreHp = Math.round(isl.coreMaxHp * 0.5);
      this.updateCoreGemVisual(0);
      this.ctx.saveWorldState();
      this.ctx.emitWorldState();

      const msg = `⚠️ 중심 마을 코어 보석이 파괴 위기에 처해 긴급 결계가 발동했습니다! (코어 체력 50% 복구)`;
      this.ctx.showFloatingText(cPos.x, cPos.y - 70, msg, '#f59e0b');
      EventBus.emit('game-alert', msg);
    }
  }

  /**
   * 코어 보석 수리 (수리 자재 소모 후 HP 회복)
   */
  public repairCore(territoryId: number, healAmount = 100): boolean {
    const islands = this.ctx.getIslands();
    const isl = islands.find((i) => i.id === territoryId);
    if (!isl || !isl.unlocked) return false;
    if (isl.coreHp >= isl.coreMaxHp) return false;

    isl.coreHp = Math.min(isl.coreMaxHp, isl.coreHp + healAmount);
    this.updateCoreGemVisual(territoryId);
    this.ctx.saveWorldState();
    this.ctx.emitWorldState();

    sound.playUnlock();
    const cPos = getTerritoryCorePos(isl.gridX, isl.gridY);
    this.ctx.showFloatingText(cPos.x, cPos.y - 60, `✨ 코어 보석 수리 완료! (+${healAmount} HP)`, '#4ade80');
    return true;
  }

  /**
   * 코어 보석 HP 바 및 텍스트 갱신
   */
  public updateCoreGemVisual(territoryId: number) {
    const cv = this.coreVisuals.get(territoryId);
    if (!cv) return;

    const isl = this.ctx.getIslands().find((i) => i.id === territoryId);
    if (!isl) return;

    const ratio = Math.max(0, Math.min(1, isl.coreHp / Math.max(1, isl.coreMaxHp)));
    const isCentral = isl.id === 0;

    cv.tierText.setText(`${isCentral ? '🏰' : '💎'} Lv.${isl.villageTier}`);

    cv.hpBar.clear();
    cv.hpBar.fillStyle(0x0f172a, 0.9);
    cv.hpBar.fillRect(-36, -50, 72, 6);

    const barColor = ratio > 0.5 ? 0x22c55e : ratio > 0.25 ? 0xf59e0b : 0xef4444;
    cv.hpBar.fillStyle(barColor, 1);
    cv.hpBar.fillRect(-36, -50, Math.max(2, 72 * ratio), 6);
  }
}
