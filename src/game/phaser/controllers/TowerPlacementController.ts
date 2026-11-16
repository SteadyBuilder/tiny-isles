import Phaser from 'phaser';
import { ConstructableType, ConstructedBuilding, Inventory, Island } from '../../../types/game';
import { getBlueprint, getIslandOrigin } from '../../constants';
import { DEPTH } from '../../depthLayers';
import { GameEvents } from '../../events/gameEvents';
import { canBuildInTerritory } from '../../territoryAccessRules';
import {
  getOuterPerimeterBandRects,
  validateOuterTowerPosition,
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
    pos: { x: number; y: number }
  ) => boolean;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
}

interface ActivePlacement {
  territoryId: number;
  type: ConstructableType;
  selectedPos: { x: number; y: number } | null;
  isValid: boolean;
  reason?: string;
}

/**
 * 방어 타워 외곽 자유 배치 전용 선택 포인트 및 프리뷰/오버레이 컨트롤러
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
      const reason = access.reason || '이 마을에서는 방어 타워를 배치할 수 없습니다.';
      GameEvents.emit('game-alert', reason);
      return;
    }

    const bp = getBlueprint(type);
    if (bp.category !== 'tower') return;

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

    const { territoryId, type, selectedPos } = this.active;
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

    const built = this.ctx.onConstructAt(territoryId, type, selectedPos);
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

    // 1. 외곽 배치 가능 영역(초록 밴드) 오버레이
    const zone = scene.add.graphics();
    zone.setDepth(DEPTH.TERRAIN + 2);
    const rects = getOuterPerimeterBandRects(origin.x, origin.y);
    zone.fillStyle(0x22c55e, 0.16);
    zone.lineStyle(2, 0x4ade80, 0.65);
    for (const r of rects) {
      zone.fillRect(r.x, r.y, r.w, r.h);
      zone.strokeRect(r.x, r.y, r.w, r.h);
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
    sprite.setDisplaySize(110, 170);
    sprite.setAlpha(0.78);
    if (type === 'magic_tower') {
      sprite.setTint(0xc084fc);
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

    const validation = validateOuterTowerPosition(
      worldX,
      worldY,
      isl,
      this.ctx.getConstructedBuildings()
    );

    this.active.selectedPos = { x: validation.worldX, y: validation.worldY };
    this.active.isValid = validation.valid;
    this.active.reason = validation.reason;

    this.previewContainer.setPosition(validation.worldX, validation.worldY);
    this.previewContainer.setVisible(true);

    const color = validation.valid ? 0x4ade80 : 0xef4444;
    this.previewSprite.setTint(
      validation.valid ? (this.active.type === 'magic_tower' ? 0xc084fc : 0xffffff) : 0xf87171
    );

    this.previewRing.clear();
    this.previewRing.lineStyle(3, color, 0.95);
    this.previewRing.fillStyle(color, 0.22);
    this.previewRing.fillCircle(0, 0, 32);
    this.previewRing.strokeCircle(0, 0, 32);
    // 선택 포인트 조준 십자선
    this.previewRing.lineBetween(-16, 0, 16, 0);
    this.previewRing.lineBetween(0, -16, 0, 16);

    if (this.previewRange) {
      this.previewRange.setVisible(validation.valid);
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
