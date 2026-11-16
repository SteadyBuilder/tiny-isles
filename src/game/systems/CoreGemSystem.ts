import { ConstructedBuilding, Island } from '../../types/game';
import {
  getTerritoryMainBuilding,
  VILLAGE_TIER_CONFIGS,
} from '../constants';
import { GameEvents } from '../events/gameEvents';
import { sound } from '../../lib/sound';

export interface CoreGemVisualRef {
  territoryId: number;
  container: Phaser.GameObjects.Container;
  buildingContainer?: Phaser.GameObjects.Container;
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
  saveWorldState: (immediate?: boolean) => void;
  emitWorldState: (immediate?: boolean) => void;
  refreshTerritoryDecorations: () => void;
  broadcastTerritoryLost?: (territoryId: number) => void;
  broadcastCoreHpSync?: (
    territoryId: number,
    coreHp: number,
    coreMaxHp: number,
    damageDelta?: number
  ) => void;
  broadcastWorldDefenseFailed?: (resetAt: string, attackerName: string) => void;
  onDefenseFailedReset?: (resetAt: string, attackerName: string) => void;
}

/**
 * 점령지 본진 건물 체력 관리, 피격 연산, 수리, 영지 상실(Territory Lost) 및 본진 파괴 시 세계 초기화 전담 시스템
 */
export class CoreGemSystem {
  private ctx: ICoreGemSystemContext;
  private coreVisuals = new Map<number, CoreGemVisualRef>();
  private defenseResetTriggered = false;

  constructor(ctx: ICoreGemSystemContext) {
    this.ctx = ctx;
  }

  public registerVisual(territoryId: number, visual: CoreGemVisualRef) {
    this.coreVisuals.set(territoryId, visual);
  }

  public setBuildingVisual(
    territoryId: number,
    buildingContainer: Phaser.GameObjects.Container | undefined,
    badgeX: number,
    badgeY: number
  ): void {
    const cv = this.coreVisuals.get(territoryId);
    if (!cv) return;
    cv.buildingContainer = buildingContainer;
    cv.container.setPosition(badgeX, badgeY);
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

  private getMainBuildingCenter(isl: Island): { x: number; y: number } {
    const bld = getTerritoryMainBuilding(isl.id, isl.gridX, isl.gridY, isl.villageTier);
    return {
      x: bld.x + bld.width / 2,
      y: bld.y + bld.height * 0.45,
    };
  }

  /**
   * 점령지 본진 건물 피격 처리
   * 체력이 0이 되면 영지 상실(loseTerritory) 또는 본진(#0) 파괴 시 세계 초기화 발생!
   */
  public damageTerritoryCore(
    territoryId: number,
    damage: number,
    attackerName = '마물',
    isLocalTrigger = false
  ): boolean {
    if (this.defenseResetTriggered) return false;
    const islands = this.ctx.getIslands();
    const isl = islands.find((i) => i.id === territoryId);
    if (!isl || !isl.unlocked) return false;

    isl.coreHp = Math.max(0, isl.coreHp - damage);
    this.updateCoreGemVisual(territoryId);

    const cv = this.coreVisuals.get(territoryId);
    if (cv) {
      this.ctx.shakeObject(cv.buildingContainer ?? cv.container);
    }

    const hitPos = this.getMainBuildingCenter(isl);
    this.ctx.showFloatingText(hitPos.x, hitPos.y - 30, `💥 본진 피격 -${damage}`, '#ef4444');

    if (isl.coreHp <= 0) {
      this.loseTerritory(territoryId, attackerName, isLocalTrigger);
      return true;
    } else {
      if (isLocalTrigger) {
        this.ctx.broadcastCoreHpSync?.(territoryId, isl.coreHp, isl.coreMaxHp, damage);
      }
      this.ctx.saveWorldState(false);
      this.ctx.emitWorldState(false);
      return false;
    }
  }

  public applyRemoteCoreHpSync(
    territoryId: number,
    coreHp: number,
    coreMaxHp: number,
    damageDelta?: number
  ): void {
    const isl = this.ctx.getIslands().find((i) => i.id === territoryId);
    if (!isl || !isl.unlocked) return;

    isl.coreMaxHp = Math.max(1, coreMaxHp);
    isl.coreHp = Math.max(0, Math.min(isl.coreMaxHp, coreHp));
    this.updateCoreGemVisual(territoryId);

    if (damageDelta && damageDelta > 0) {
      const cv = this.coreVisuals.get(territoryId);
      if (cv) {
        this.ctx.shakeObject(cv.buildingContainer ?? cv.container);
      }
      const hitPos = this.getMainBuildingCenter(isl);
      this.ctx.showFloatingText(hitPos.x, hitPos.y - 30, `💥 본진 피격 -${damageDelta}`, '#ef4444');
    }

    this.ctx.saveWorldState(false);
    this.ctx.emitWorldState(false);
  }

  /**
   * 본진 건물 파괴에 따른 영지 상실(Territory Lost) 및 #0 본진 파괴 시 세계 초기화 처리
   */
  public loseTerritory(territoryId: number, attackerName: string, isLocalTrigger: boolean) {
    const islands = this.ctx.getIslands();
    const isl = islands.find((i) => i.id === territoryId);
    if (!isl || !isl.unlocked) return;

    const hitPos = this.getMainBuildingCenter(isl);
    this.ctx.playExplosionAt(hitPos.x, hitPos.y);
    sound.playBreak();

    if (territoryId !== 0) {
      // 외곽/확장 점령지의 본진 건물이 파괴된 경우: 해당 땅 상실
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

      this.ctx.saveWorldState(true);
      this.ctx.refreshTerritoryDecorations();
      this.ctx.emitWorldState(true);

      const lostMsg = `💔 [땅 상실!] ${attackerName}의 공격으로 '${isl.name}'의 본진 건물이 파괴되어 땅을 잃었습니다! 마물들이 중심부를 향해 진격합니다!`;
      this.ctx.showFloatingText(hitPos.x, hitPos.y - 50, `💔 본진 파괴! [${isl.name} 상실]`, '#ef4444');
      GameEvents.emit('game-alert', lostMsg);
      GameEvents.emit('territory-lost', { territoryId, name: isl.name });

      if (isLocalTrigger && this.ctx.broadcastTerritoryLost) {
        this.ctx.broadcastTerritoryLost(territoryId);
      }
    } else {
      // #0 중심 마을 본진이 파괴된 경우: 방어 실패 -> 전 플레이어 공지 및 세계/데이터 초기화
      if (this.defenseResetTriggered) return;
      this.defenseResetTriggered = true;

      const resetAt = new Date().toISOString();
      const failMsg = '방어에 실패하였습니다. 세계가 초기화 됩니다.';
      this.ctx.showFloatingText(hitPos.x, hitPos.y - 50, `💥 ${failMsg}`, '#ef4444');
      GameEvents.emit('game-alert', failMsg);

      if (isLocalTrigger) {
        this.ctx.broadcastWorldDefenseFailed?.(resetAt, attackerName);
        this.ctx.onDefenseFailedReset?.(resetAt, attackerName);
      }
      GameEvents.emit('world-defense-failed', { resetAt, attackerName });
    }
  }

  /**
   * 본진 건물 수리 (수리 자재 소모 후 HP 회복)
   */
  public repairCore(territoryId: number, healAmount = 100): boolean {
    const islands = this.ctx.getIslands();
    const isl = islands.find((i) => i.id === territoryId);
    if (!isl || !isl.unlocked) return false;
    if (isl.coreHp >= isl.coreMaxHp) return false;

    isl.coreHp = Math.min(isl.coreMaxHp, isl.coreHp + healAmount);
    this.updateCoreGemVisual(territoryId);
    this.ctx.saveWorldState(true);
    this.ctx.emitWorldState(true);

    sound.playUnlock();
    const hitPos = this.getMainBuildingCenter(isl);
    this.ctx.showFloatingText(hitPos.x, hitPos.y - 45, `✨ 본진 수리 완료! (+${healAmount} HP)`, '#4ade80');
    return true;
  }

  /**
   * 본진 건물 HP 바 및 텍스트 갱신
   */
  public updateCoreGemVisual(territoryId: number) {
    const cv = this.coreVisuals.get(territoryId);
    if (!cv) return;

    const isl = this.ctx.getIslands().find((i) => i.id === territoryId);
    if (!isl) return;

    const ratio = Math.max(0, Math.min(1, isl.coreHp / Math.max(1, isl.coreMaxHp)));
    const isCentral = isl.id === 0;

    cv.tierText.setText(`${isCentral ? '🏰' : '🏠'} Lv.${isl.villageTier}`);

    cv.hpBar.clear();
    cv.hpBar.fillStyle(0x0f172a, 0.9);
    cv.hpBar.fillRect(-36, -50, 72, 6);

    const barColor = ratio > 0.5 ? 0x22c55e : ratio > 0.25 ? 0xf59e0b : 0xef4444;
    cv.hpBar.fillStyle(barColor, 1);
    cv.hpBar.fillRect(-36, -50, Math.max(2, 72 * ratio), 6);
  }
}
