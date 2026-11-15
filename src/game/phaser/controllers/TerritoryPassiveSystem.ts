import { WORLD_CLOCK_CONFIG } from '../../../data/worldRules';
import { ConstructedBuilding, Island } from '../../../types/game';

export interface ITerritoryPassiveContext {
  getIslands: () => Island[];
  getConstructedBuildings: () => ConstructedBuilding[];
  addResources: (wood: number, stone: number, gold: number) => void;
  updateCoreGemVisual: (territoryId: number) => void;
  updateConstructedBuildingHpBar: (buildingId: string) => void;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
  saveWorldState: (immediate?: boolean) => void;
  emitWorldStateToReact: (immediate?: boolean) => void;
}

/**
 * 특수 경제 건물(벌목 작업장/석공 작업장/황금 연금술 공방) 자동 채집 및 회복 건물(주민 가옥/성소) 주기 효과 처리기 (30초 주기)
 */
export class TerritoryPassiveSystem {
  private ctx: ITerritoryPassiveContext;
  private passiveTickAccum = 0;

  constructor(ctx: ITerritoryPassiveContext) {
    this.ctx = ctx;
  }

  public update(delta: number): void {
    this.passiveTickAccum += delta;
    if (this.passiveTickAccum < WORLD_CLOCK_CONFIG.passiveTickIntervalMs) return;
    this.passiveTickAccum = 0;

    const islands = this.ctx.getIslands();
    const constructedBuildings = this.ctx.getConstructedBuildings();

    let totalWoodGain = 0;
    let totalStoneGain = 0;
    let totalGoldGain = 0;

    // 특수 경제 건물 자동 채집 & 회복 건물 효과
    let healStateDirty = false;
    for (const cb of constructedBuildings) {
      const isl = islands.find((i) => i.id === cb.territoryId && i.unlocked);
      if (!isl) continue;

      if (cb.type === 'lumber_camp') {
        totalWoodGain += 2;
        this.ctx.showFloatingText(cb.x, cb.y - 35, '🪵 +2', '#86efac');
      } else if (cb.type === 'stone_works') {
        totalStoneGain += 2;
        this.ctx.showFloatingText(cb.x, cb.y - 35, '🪨 +2', '#cbd5e1');
      } else if (cb.type === 'special_goldmine') {
        totalGoldGain += 2;
        this.ctx.showFloatingText(cb.x, cb.y - 35, '🪙 +2', '#fde047');
      } else if (cb.type === 'basic_house') {
        if (isl.coreHp < isl.coreMaxHp) {
          isl.coreHp = Math.min(isl.coreMaxHp, isl.coreHp + 6);
          this.ctx.updateCoreGemVisual(isl.id);
          healStateDirty = true;
        }
      } else if (cb.type === 'special_sanctuary') {
        // 성소: 코어 보석 및 성벽 회복
        if (isl.coreHp < isl.coreMaxHp) {
          isl.coreHp = Math.min(isl.coreMaxHp, isl.coreHp + 20);
          this.ctx.updateCoreGemVisual(isl.id);
          healStateDirty = true;
        }
        for (const other of constructedBuildings) {
          if (other.territoryId === isl.id && other.hp < other.maxHp) {
            other.hp = Math.min(other.maxHp, other.hp + 35);
            this.ctx.updateConstructedBuildingHpBar(other.id);
            healStateDirty = true;
          }
        }
        this.ctx.showFloatingText(cb.x, cb.y - 35, '✨ 성소 치유 오라', '#38bdf8');
      }
    }

    if (healStateDirty) {
      this.ctx.saveWorldState(false);
      this.ctx.emitWorldStateToReact(false);
    }

    if (totalWoodGain > 0 || totalStoneGain > 0 || totalGoldGain > 0) {
      this.ctx.addResources(totalWoodGain, totalStoneGain, totalGoldGain);
    }
  }
}
