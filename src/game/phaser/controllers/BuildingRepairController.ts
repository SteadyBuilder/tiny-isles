import { ConstructedBuilding, Inventory } from '../../../types/game';
import { GameEvents } from '../../events/gameEvents';
import { sound } from '../../../lib/sound';
import {
  checkWallRepair,
  findNearestDamagedWall,
  isWallBuilding,
} from '../../systems/WallRepairRules';

export interface IBuildingRepairContext {
  getConstructedBuildings: () => ConstructedBuilding[];
  getInventory: () => Inventory;
  spendInventory: (wood: number, stone: number, gold: number) => void;
  updateConstructedBuildingHpBar: (buildingId: string) => void;
  showFloatingText: (x: number, y: number, text: string, color?: string) => void;
  saveWorldState: (immediate?: boolean) => void;
  emitWorldStateToReact: (immediate?: boolean) => void;
  broadcastBuildingHpSync?: (buildingId: string, hp: number, maxHp: number) => void;
  shakeObject?: (obj: Phaser.GameObjects.Container) => void;
  getConstructedVisualContainer?: (buildingId: string) => Phaser.GameObjects.Container | undefined;
}

/**
 * 목책 및 석조 성벽 수리(필드 상호작용 및 모달 슬롯 수리) 전담 컨트롤러
 */
export class BuildingRepairController {
  private ctx: IBuildingRepairContext;

  constructor(ctx: IBuildingRepairContext) {
    this.ctx = ctx;
  }

  /**
   * 지정된 ID의 건물(목책/성벽) 수리 수행
   */
  public repairBuildingById(buildingId: string, isLocalTrigger = true): boolean {
    const buildings = this.ctx.getConstructedBuildings();
    const building = buildings.find((b) => b.id === buildingId);

    if (!building) {
      return false;
    }

    if (!isWallBuilding(building)) {
      this.ctx.showFloatingText(
        building.x,
        building.y - 45,
        '목책 또는 성벽만 수리할 수 있습니다.',
        '#f87171'
      );
      return false;
    }

    const check = checkWallRepair(building, this.ctx.getInventory());
    if (!check.canRepair || !check.cost || check.nextHp === undefined) {
      const reason = check.reason || '수리할 수 없습니다.';
      this.ctx.showFloatingText(building.x, building.y - 45, reason, '#f87171');
      if (isLocalTrigger) {
        GameEvents.emit('game-alert', reason);
      }
      return false;
    }

    const cost = check.cost;
    if (isLocalTrigger) {
      this.ctx.spendInventory(cost.wood, cost.stone, cost.gold);
    }

    building.hp = check.nextHp;
    this.ctx.updateConstructedBuildingHpBar(building.id);

    const bCont = this.ctx.getConstructedVisualContainer?.(building.id);
    if (bCont && this.ctx.shakeObject) {
      this.ctx.shakeObject(bCont);
    }

    sound.playUnlock();
    const hpMsg = `🔨 [${building.name}] 수리 완료! (+${cost.healAmount} HP, ${building.hp}/${building.maxHp})`;
    this.ctx.showFloatingText(building.x, building.y - 45, hpMsg, '#4ade80');
    if (isLocalTrigger) {
      GameEvents.emit('game-alert', hpMsg);
    }

    this.ctx.saveWorldState(false);
    this.ctx.emitWorldStateToReact(false);

    if (isLocalTrigger) {
      this.ctx.broadcastBuildingHpSync?.(building.id, building.hp, building.maxHp);
    }

    return true;
  }

  /**
   * 플레이어 위치 기준 가장 가까운 손상된 방벽 즉시 수리
   */
  public repairNearestDamagedWall(
    px: number,
    py: number,
    maxDistance = 90
  ): boolean {
    const buildings = this.ctx.getConstructedBuildings();
    const nearest = findNearestDamagedWall(px, py, buildings, maxDistance);

    if (!nearest) {
      return false;
    }

    return this.repairBuildingById(nearest.building.id, true);
  }

  /**
   * 플레이어 주변에 손상된 방벽이 있는지 조회 (상호작용 힌트용)
   */
  public getNearbyDamagedWall(
    px: number,
    py: number,
    maxDistance = 90
  ): { building: ConstructedBuilding; dist: number; hitX: number; hitY: number } | null {
    const buildings = this.ctx.getConstructedBuildings();
    return findNearestDamagedWall(px, py, buildings, maxDistance);
  }
}
