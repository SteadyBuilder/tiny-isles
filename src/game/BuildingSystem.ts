import {
  ConstructableBlueprint,
  ConstructableType,
  ConstructedBuilding,
  Inventory,
  Island,
  VillageTier,
} from '../types/game';
import {
  CONSTRUCTABLE_BLUEPRINTS,
  getBlueprint,
  getIslandOrigin,
  TERRITORY_BUILD_SLOTS,
  VILLAGE_TIER_CONFIGS,
} from './constants';

export interface SlotState {
  slotIndex: number;
  role: 'wall' | 'inner';
  building?: ConstructedBuilding;
  isUnlocked: boolean;
  relX: number;
  relY: number;
}

export interface UpgradeCheckResult {
  canUpgrade: boolean;
  reason?: string;
  nextTier?: VillageTier;
  costWood: number;
  costStone: number;
  costGold: number;
}

export interface BuildCheckResult {
  canBuild: boolean;
  reason?: string;
  slotIndex?: number;
  blueprint: ConstructableBlueprint;
}

/**
 * 마을 티어 발전 및 건물 배치/슬롯 관리를 전담하는 핵심 시스템
 */
export class BuildingSystem {
  /**
   * 해당 마을 티어에서 최대로 제공되는 건물 슬롯 수 (3 ~ 16개)
   */
  public static getMaxSlots(tier: VillageTier): number {
    return VILLAGE_TIER_CONFIGS[tier]?.maxBuildings ?? 3;
  }

  /**
   * #0 중심 마을 초기 상태(Lv.2 중소마을, HP 350) 보장
   */
  public static ensureCentralVillageState(territory: Island): Island {
    if (territory.id === 0 && territory.villageTier < 2) {
      const tier2Cfg = VILLAGE_TIER_CONFIGS[2];
      return {
        ...territory,
        villageTier: 2,
        coreMaxHp: tier2Cfg.coreMaxHp,
        coreHp: Math.max(territory.coreHp, tier2Cfg.coreMaxHp),
      };
    }
    return territory;
  }

  /**
   * 현재 영지의 슬롯 목록 및 건물 점유 상태 계산
   */
  public static getSlotStates(
    territoryId: number,
    tier: VillageTier,
    constructedBuildings: ConstructedBuilding[]
  ): SlotState[] {
    const maxSlots = this.getMaxSlots(tier);
    const existing = constructedBuildings.filter((b) => b.territoryId === territoryId);
    const buildingMap = new Map<number, ConstructedBuilding>();
    existing.forEach((b) => buildingMap.set(b.slotIndex, b));

    return TERRITORY_BUILD_SLOTS.map((slot, index) => ({
      slotIndex: index,
      role: slot.role,
      relX: slot.relX,
      relY: slot.relY,
      isUnlocked: index < maxSlots,
      building: buildingMap.get(index),
    }));
  }

  /**
   * 마을 발전(티어 승급) 가능 여부 체크
   */
  public static checkUpgrade(territory: Island, inventory: Inventory): UpgradeCheckResult {
    if (territory.villageTier >= 6) {
      return {
        canUpgrade: false,
        reason: '이미 최고 단계(대도시)에 도달했습니다.',
        costWood: 0,
        costStone: 0,
        costGold: 0,
      };
    }

    const nextTier = (territory.villageTier + 1) as VillageTier;
    const nextCfg = VILLAGE_TIER_CONFIGS[nextTier];
    const canAfford =
      inventory.wood >= nextCfg.costWood &&
      inventory.stone >= nextCfg.costStone &&
      inventory.gold >= nextCfg.costGold;

    return {
      canUpgrade: canAfford,
      nextTier,
      costWood: nextCfg.costWood,
      costStone: nextCfg.costStone,
      costGold: nextCfg.costGold,
      reason: canAfford
        ? undefined
        : `자원 부족 (필요: 🪵${nextCfg.costWood} 🪨${nextCfg.costStone} 🪙${nextCfg.costGold})`,
    };
  }

  /**
   * 건물 건설을 위한 최적의 빈 슬롯 찾기
   */
  public static findBestSlot(
    type: ConstructableType,
    territoryId: number,
    tier: VillageTier,
    constructedBuildings: ConstructedBuilding[],
    preferredSlotIndex?: number
  ): number {
    const slots = this.getSlotStates(territoryId, tier, constructedBuildings);
    const bp = getBlueprint(type);

    // 지정 슬롯이 유효하고 비어있으며 해금된 경우 우선 선택
    if (
      preferredSlotIndex !== undefined &&
      preferredSlotIndex >= 0 &&
      preferredSlotIndex < slots.length
    ) {
      const target = slots[preferredSlotIndex];
      if (target.isUnlocked && !target.building) {
        return preferredSlotIndex;
      }
    }

    const emptySlots = slots.filter((s) => s.isUnlocked && !s.building);
    if (emptySlots.length === 0) return -1;

    // 성벽 계열은 0~3(외곽 wall 슬롯) 우선
    if (bp.category === 'wall') {
      const wallSlot = emptySlots.find((s) => s.role === 'wall');
      if (wallSlot) return wallSlot.slotIndex;
    } else {
      // 일반/타워/특수 건물은 inner 슬롯 우선
      const innerSlot = emptySlots.find((s) => s.role === 'inner');
      if (innerSlot) return innerSlot.slotIndex;
    }

    return emptySlots[0].slotIndex;
  }

  /**
   * 건물 건설 가능 여부 및 슬롯 할당 검사
   */
  public static checkBuild(
    territory: Island,
    type: ConstructableType,
    inventory: Inventory,
    constructedBuildings: ConstructedBuilding[],
    preferredSlotIndex?: number
  ): BuildCheckResult {
    const bp = getBlueprint(type);
    const existing = constructedBuildings.filter((b) => b.territoryId === territory.id);
    const maxSlots = this.getMaxSlots(territory.villageTier);

    if (existing.length >= maxSlots) {
      return {
        canBuild: false,
        reason: `건물 슬롯이 꽉 찼습니다 (${existing.length}/${maxSlots}). 마을을 승급하세요.`,
        blueprint: bp,
      };
    }

    const canAfford =
      inventory.wood >= bp.costWood &&
      inventory.stone >= bp.costStone &&
      inventory.gold >= bp.costGold;

    if (!canAfford) {
      return {
        canBuild: false,
        reason: `자원 부족 (필요: 🪵${bp.costWood} 🪨${bp.costStone} 🪙${bp.costGold})`,
        blueprint: bp,
      };
    }

    const slotIndex = this.findBestSlot(
      type,
      territory.id,
      territory.villageTier,
      constructedBuildings,
      preferredSlotIndex
    );

    if (slotIndex === -1) {
      return {
        canBuild: false,
        reason: '사용 가능한 건설 슬롯이 없습니다.',
        blueprint: bp,
      };
    }

    return {
      canBuild: true,
      slotIndex,
      blueprint: bp,
    };
  }

  /**
   * 신규 건설 건물 엔티티 생성
   */
  public static createConstructedBuilding(
    territory: Island,
    type: ConstructableType,
    slotIndex: number
  ): ConstructedBuilding {
    const bp = getBlueprint(type);
    const origin = getIslandOrigin(territory.gridX, territory.gridY);
    const slot = TERRITORY_BUILD_SLOTS[slotIndex] || TERRITORY_BUILD_SLOTS[0];

    return {
      id: `cb_${territory.id}_${slotIndex}_${Date.now().toString(36)}`,
      territoryId: territory.id,
      type,
      category: bp.category,
      name: bp.name,
      x: origin.x + slot.relX,
      y: origin.y + slot.relY,
      hp: bp.maxHp,
      maxHp: bp.maxHp,
      slotIndex,
    };
  }
}
