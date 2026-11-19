import Phaser from 'phaser';
import { ConstructableType, ConstructedBuilding, Inventory, Island } from '../../../types/game';
import { BuildingSystem } from '../../BuildingSystem';
import {
  TERRITORY_BUILD_SLOTS,
  TERRITORY_PX,
  getBlueprint,
  getIslandOrigin,
} from '../../constants';
import { DEPTH } from '../../depthLayers';
import { GameEvents } from '../../events/gameEvents';
import { canBuildInTerritory } from '../../territoryAccessRules';
import {
  getOuterPerimeterBandRects,
  validateInnerBuildingPosition,
  validateOuterTowerPosition,
  validateWallSlotPosition,
} from '../../towerPlacementRules';

export interface ITowerPlacementContext {
  scene: Phaser.Scene;
  getPlayerId: () => string;
  getPlayerStandingTerritoryId: () => number | null;
  getIslands: () => Island[];
  getConstructedBuildings: () => ConstructedBuilding[];
  getInventory: () => Inventory;
  onConstructAt: (
    territoryId: number,
    type: ConstructableType,
    pos: { x: number; y: number },
    slotIndex?: number
  ) => boolean;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
}

interface ActivePlacement {
  territoryId: number;
  type: ConstructableType;
  selectedPos: { x: number; y: number } | null;
  selectedSlotIndex?: number;
  isValid: boolean;
  reason?: string;
}

/**
 * 건물 위치 지정 배치(방어 타워 외곽, 성벽 4방향 방어선, 기본/특수 건물 내부 자유 배치) 컨트롤러
 */
export class TowerPlacementController {
  private ctx: ITowerPlacementContext;
  private active: ActivePlacement | null = null;
  private zoneGraphics: Phaser.GameObjects.Graphics | null = null;
  private previewContainer: Phaser.GameObjects.Container | null = null;
  private previewSprite: Phaser.GameObjects.Image | null = null;
  private previewRing: Phaser.GameObjects.Graphics | null = null;
  private previewRange: Phaser.GameObjects.Graphics | null = null;
  private unbindFns: Array<() => void> = [];

  constructor(ctx: ITowerPlacementContext) {
    this.ctx = ctx;
    this.bindInputListeners();
  }

  public isActive(): boolean {
    return this.active !== null;
  }

  public enter(territoryId: number, type: ConstructableType): void {
    const isl = this.ctx.getIslands().find((i) => i.id === territoryId);
    if (!isl || !isl.unlocked) return;

    const access = canBuildInTerritory(
      isl,
      this.ctx.getPlayerId(),
      this.ctx.getPlayerStandingTerritoryId()
    );
    if (!access.allowed) {
      const reason = access.reason || '이 마을에서는 건설할 수 없습니다.';
      GameEvents.emit('game-alert', reason);
      return;
    }

    if (
      BuildingSystem.hasReachedTerritoryBuildingLimit(
        territoryId,
        type,
        this.ctx.getConstructedBuildings()
      )
    ) {
      const bp = getBlueprint(type);
      GameEvents.emit('game-alert', `[건설됨] ${bp.name}은(는) 이미 이 영지에 건설되어 있습니다.`);
      return;
    }

    this.clearVisuals();
    this.active = {
      territoryId,
      type,
      selectedPos: null,
      isValid: false,
    };

    this.createOverlayAndPreview(isl, type);
    this.emitState();
  }

  public cancel(): void {
    if (!this.active) return;
    this.active = null;
    this.clearVisuals();
    this.emitState();
  }

  public confirm(): boolean {
    if (!this.active || !this.active.selectedPos || !this.active.isValid) {
      return false;
    }

    const { territoryId, type, selectedPos, selectedSlotIndex } = this.active;
    const isl = this.ctx.getIslands().find((i) => i.id === territoryId);
    const access = canBuildInTerritory(
      isl,
      this.ctx.getPlayerId(),
      this.ctx.getPlayerStandingTerritoryId()
    );
    if (!access.allowed) {
      const reason = access.reason || '현재 위치한 마을 영역에서만 건설할 수 있습니다.';
      this.ctx.showFloatingText(selectedPos.x, selectedPos.y - 30, reason, '#f87171');
      GameEvents.emit('game-alert', reason);
      this.cancel();
      return false;
    }

    if (
      BuildingSystem.hasReachedTerritoryBuildingLimit(
        territoryId,
        type,
        this.ctx.getConstructedBuildings()
      )
    ) {
      const bp = getBlueprint(type);
      const reason = `[건설됨] ${bp.name}은(는) 이미 이 영지에 건설되어 있습니다.`;
      this.ctx.showFloatingText(selectedPos.x, selectedPos.y - 30, reason, '#fbbf24');
      GameEvents.emit('game-alert', reason);
      this.cancel();
      return false;
    }

    const built = this.ctx.onConstructAt(territoryId, type, selectedPos, selectedSlotIndex);
    if (built) {
      this.active = null;
      this.clearVisuals();
      this.emitState();
    }
    return built;
  }

  public destroy(): void {
    this.clearVisuals();
    for (const unbind of this.unbindFns) {
      unbind();
    }
    this.unbindFns = [];
  }

  private bindInputListeners(): void {
    const { scene } = this.ctx;

    const onPointerMove = (pointer: Phaser.Input.Pointer) => {
      if (!this.active || pointer.wasTouch) return;
      const worldPoint = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.updateSelectionPoint(worldPoint.x, worldPoint.y);
    };

    const onPointerDown = (pointer: Phaser.Input.Pointer) => {
      if (!this.active) return;

      if (pointer.rightButtonDown()) {
        this.cancel();
        return;
      }

      if (scene.input.pointer1?.isDown && scene.input.pointer2?.isDown) {
        return;
      }

      const worldPoint = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);

      if (pointer.wasTouch) {
        // 모바일 터치: 같은 유효 포인트를 한 번 더 탭하면 즉시 건설, 아니면 선택 포인트 이동
        const prev = this.active.selectedPos;
        if (
          prev &&
          this.active.isValid &&
          Math.hypot(worldPoint.x - prev.x, worldPoint.y - prev.y) < 38
        ) {
          this.confirm();
          return;
        }
        this.updateSelectionPoint(worldPoint.x, worldPoint.y);
        return;
      }

      // 데스크톱 마우스: 클릭 시 유효 위치면 즉시 건설
      this.updateSelectionPoint(worldPoint.x, worldPoint.y);
      if (this.active.isValid) {
        this.confirm();
      } else if (this.active.reason) {
        this.ctx.showFloatingText(worldPoint.x, worldPoint.y - 30, this.active.reason, '#f87171');
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (this.active && e.key === 'Escape') {
        this.cancel();
      }
    };

    scene.input.on('pointermove', onPointerMove);
    scene.input.on('pointerdown', onPointerDown);
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', onKeyDown);
    }

    this.unbindFns.push(() => {
      scene.input.off('pointermove', onPointerMove);
      scene.input.off('pointerdown', onPointerDown);
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', onKeyDown);
      }
    });
  }

  private createOverlayAndPreview(isl: Island, type: ConstructableType): void {
    const { scene } = this.ctx;
    const origin = getIslandOrigin(isl.gridX, isl.gridY);
    const bp = getBlueprint(type);

    // 1. 카테고리별 배치 가능 영역 오버레이
    const zone = scene.add.graphics();
    zone.setDepth(DEPTH.TERRAIN + 2);
    if (bp.category === 'tower') {
      const rects = getOuterPerimeterBandRects(origin.x, origin.y);
      zone.fillStyle(0x22c55e, 0.16);
      zone.lineStyle(2, 0x4ade80, 0.65);
      for (const r of rects) {
        zone.fillRect(r.x, r.y, r.w, r.h);
        zone.strokeRect(r.x, r.y, r.w, r.h);
      }
    } else if (bp.category === 'wall') {
      const existing = this.ctx.getConstructedBuildings();
      for (let i = 0; i < TERRITORY_BUILD_SLOTS.length; i++) {
        const slot = TERRITORY_BUILD_SLOTS[i];
        if (slot.role !== 'wall') continue;
        const occupied = existing.some((b) => b.territoryId === isl.id && b.slotIndex === i);
        const sx = origin.x + slot.relX;
        const sy = origin.y + slot.relY;
        const w = i === 0 || i === 1 ? 260 : 64;
        const h = i === 0 || i === 1 ? 64 : 260;
        zone.fillStyle(occupied ? 0x64748b : 0x22c55e, occupied ? 0.18 : 0.24);
        zone.lineStyle(2, occupied ? 0x94a3b8 : 0x4ade80, 0.8);
        zone.fillRoundedRect(sx - w / 2, sy - h / 2, w, h, 10);
        zone.strokeRoundedRect(sx - w / 2, sy - h / 2, w, h, 10);
      }
    } else {
      const innerPad = 110;
      const span = TERRITORY_PX - innerPad * 2;
      zone.fillStyle(0x22c55e, 0.12);
      zone.lineStyle(2, 0x4ade80, 0.6);
      zone.fillRect(origin.x + innerPad, origin.y + innerPad, span, span);
      zone.strokeRect(origin.x + innerPad, origin.y + innerPad, span, span);
    }
    this.zoneGraphics = zone;

    // 2. 선택 포인트 프리뷰 컨테이너
    const container = scene.add.container(0, 0);
    container.setDepth(DEPTH.TOUCH_INDICATOR + 5);
    container.setVisible(false);

    const rangeGfx = scene.add.graphics();
    if (bp.range) {
      rangeGfx.lineStyle(2, type === 'magic_tower' ? 0xc084fc : 0x38bdf8, 0.55);
      rangeGfx.fillStyle(type === 'magic_tower' ? 0xc084fc : 0x38bdf8, 0.08);
      rangeGfx.fillCircle(0, 0, bp.range);
      rangeGfx.strokeCircle(0, 0, bp.range);
    }
    container.add(rangeGfx);

    const ringGfx = scene.add.graphics();
    container.add(ringGfx);

    const sprite = scene.add.image(0, -20, bp.spriteKey);
    const previewW = bp.category === 'tower' ? 110 : bp.category === 'wall' ? 110 : 120;
    const previewH = bp.category === 'tower' ? 170 : bp.category === 'wall' ? 90 : 150;
    sprite.setDisplaySize(previewW, previewH);
    sprite.setAlpha(0.78);
    if (type === 'magic_tower') {
      sprite.setTint(0xc084fc);
    } else if (type === 'special_goldmine') {
      sprite.setTint(0xfde047);
    }
    container.add(sprite);

    this.previewRange = rangeGfx;
    this.previewRing = ringGfx;
    this.previewSprite = sprite;
    this.previewContainer = container;
  }

  private updateSelectionPoint(worldX: number, worldY: number): void {
    if (!this.active || !this.previewContainer || !this.previewRing || !this.previewSprite) {
      return;
    }

    const isl = this.ctx.getIslands().find((i) => i.id === this.active!.territoryId);
    if (!isl) return;

    const bp = getBlueprint(this.active.type);
    const constructed = this.ctx.getConstructedBuildings();
    let worldPosX = worldX;
    let worldPosY = worldY;
    let valid = false;
    let reason: string | undefined;

    if (bp.category === 'tower') {
      const v = validateOuterTowerPosition(worldX, worldY, isl, constructed);
      worldPosX = v.worldX;
      worldPosY = v.worldY;
      valid = v.valid;
      reason = v.reason;
      this.active.selectedSlotIndex = undefined;
    } else if (bp.category === 'wall') {
      const v = validateWallSlotPosition(worldX, worldY, isl, constructed, TERRITORY_BUILD_SLOTS);
      worldPosX = v.worldX;
      worldPosY = v.worldY;
      valid = v.valid;
      reason = v.reason;
      this.active.selectedSlotIndex = v.slotIndex;
    } else {
      const v = validateInnerBuildingPosition(worldX, worldY, isl, constructed);
      worldPosX = v.worldX;
      worldPosY = v.worldY;
      valid = v.valid;
      reason = v.reason;
      this.active.selectedSlotIndex = undefined;
    }

    this.active.selectedPos = { x: worldPosX, y: worldPosY };
    this.active.isValid = valid;
    this.active.reason = reason;

    this.previewContainer.setPosition(worldPosX, worldPosY);
    this.previewContainer.setVisible(true);

    const color = valid ? 0x4ade80 : 0xef4444;
    const baseTint =
      this.active.type === 'magic_tower'
        ? 0xc084fc
        : this.active.type === 'special_goldmine'
          ? 0xfde047
          : 0xffffff;
    this.previewSprite.setTint(valid ? baseTint : 0xf87171);

    this.previewRing.clear();
    this.previewRing.lineStyle(3, color, 0.95);
    this.previewRing.fillStyle(color, 0.22);
    this.previewRing.fillCircle(0, 0, 32);
    this.previewRing.strokeCircle(0, 0, 32);
    this.previewRing.lineBetween(-16, 0, 16, 0);
    this.previewRing.lineBetween(0, -16, 0, 16);

    if (this.previewRange) {
      this.previewRange.setVisible(valid);
    }

    this.emitState();
  }

  private emitState(): void {
    if (!this.active) {
      GameEvents.emit('placement-state-changed', { active: false });
      return;
    }
    GameEvents.emit('placement-state-changed', {
      active: true,
      territoryId: this.active.territoryId,
      type: this.active.type,
      hasSelection: this.active.selectedPos !== null,
      isValid: this.active.isValid,
      reason: this.active.reason,
    });
  }

  private clearVisuals(): void {
    this.zoneGraphics?.destroy();
    this.zoneGraphics = null;
    this.previewContainer?.destroy();
    this.previewContainer = null;
    this.previewSprite = null;
    this.previewRing = null;
    this.previewRange = null;
  }
}
