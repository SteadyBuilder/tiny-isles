import Phaser from 'phaser';
import { PLAYER_COMBAT_CONFIG } from '../../../data/worldRules';
import { Island } from '../../../types/game';
import {
  TERRITORY_CENTER_X,
  TERRITORY_CENTER_Y,
  getIslandOrigin,
  getTerritoryCorePos,
  getTerritoryMainBuilding,
  isPointInCollisionBox,
} from '../../constants';
import { DEPTH } from '../../depthLayers';
import { GameEvents } from '../../events/gameEvents';
import { MonsterVisual } from '../../systems/WaveSystem';
import { WORLD_BOUNDS } from '../../worldBounds';
import { EntityVisual } from '../renderers/ResourceEntityRenderer';

export interface IPlayerPointerContext {
  scene: Phaser.Scene;
  getInitialZoom: () => number;
  getPlayerPosition: () => { x: number; y: number };
  getIslands: () => Island[];
  getMonsterVisuals: () => Map<string, MonsterVisual>;
  findTappedEntityVisual: (wx: number, wy: number) => EntityVisual | null;
  isWithinEntityGatherRange: (px: number, py: number, visual: EntityVisual) => boolean;
  getEntityInteractionPoint: (visual: EntityVisual) => { x: number; y: number };
  onInteract: () => void;
  isPlacementActive?: () => boolean;
  getAttackRange?: (isBoss: boolean) => number;
}

/**
 * 카메라 팔로우/줌 제어 및 마우스/터치 포인터 타겟 이동을 담당하는 컨트롤러
 */
export class PlayerPointerController {
  private ctx: IPlayerPointerContext;
  private mouseTarget: { x: number; y: number; active: boolean } = { x: 0, y: 0, active: false };
  private touchIndicator!: Phaser.GameObjects.Image;
  private touchTargetObj: {
    x: number;
    y: number;
    entityVisual?: EntityVisual;
    stopDistance?: number;
  } | null = null;
  private targetZoom: number;

  constructor(ctx: IPlayerPointerContext) {
    this.ctx = ctx;
    this.targetZoom = ctx.getInitialZoom();
  }

  public setTargetZoom(zoom: number): void {
    this.targetZoom = zoom;
  }

  public clearTarget(): void {
    this.mouseTarget.active = false;
  }

  public setupCamera(followTarget: Phaser.GameObjects.GameObject): void {
    const { scene } = this.ctx;
    scene.cameras.main.startFollow(followTarget, true, 0.1, 0.1);
    scene.cameras.main.setZoom(this.targetZoom);
    scene.cameras.main.setBounds(
      WORLD_BOUNDS.min,
      WORLD_BOUNDS.min,
      WORLD_BOUNDS.width,
      WORLD_BOUNDS.width
    );

    scene.input.on(
      'wheel',
      (_pointer: Phaser.Input.Pointer, _gameObjects: unknown, _deltaX: number, deltaY: number) => {
        const step = 0.12;
        const next = deltaY < 0 ? this.targetZoom + step : this.targetZoom - step;
        this.targetZoom = Math.min(2.0, Math.max(0.5, Number(next.toFixed(2))));
        GameEvents.emit('zoom-changed', this.targetZoom);
      }
    );

    this.touchIndicator = scene.add
      .image(0, 0, 'cursorTarget')
      .setVisible(false)
      .setDepth(DEPTH.TOUCH_INDICATOR)
      .setScale(0.35)
      .setAlpha(0.85);

    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handlePointerAction(pointer);
    });

    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.ctx.isPlacementActive?.()) return;
      if (this.isPinchZooming()) {
        this.cancelPointerTarget();
        return;
      }

      if (pointer.isDown && !this.touchTargetObj) {
        const worldPoint = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.mouseTarget = { x: worldPoint.x, y: worldPoint.y, active: true };
        this.touchIndicator.setPosition(worldPoint.x, worldPoint.y).setVisible(true);
      }
    });
  }

  public resolvePointerMovement(px: number, py: number): { vx: number; vy: number } | null {
    if (!this.mouseTarget.active) return null;

    const dist = Phaser.Math.Distance.Between(px, py, this.mouseTarget.x, this.mouseTarget.y);

    if (this.touchTargetObj) {
      const stopDistance = this.touchTargetObj.stopDistance ?? 90;
      const reachedTarget = this.touchTargetObj.entityVisual
        ? this.ctx.isWithinEntityGatherRange(px, py, this.touchTargetObj.entityVisual)
        : dist <= stopDistance;

      if (reachedTarget) {
        this.mouseTarget.active = false;
        this.touchTargetObj = null;
        this.touchIndicator.setVisible(false);
        this.ctx.onInteract();
        return null;
      }
    }

    if (dist <= 14) {
      this.mouseTarget.active = false;
      this.touchIndicator.setVisible(false);
      return null;
    }

    return {
      vx: (this.mouseTarget.x - px) / dist,
      vy: (this.mouseTarget.y - py) / dist,
    };
  }

  public updateZoom(delta: number = 16.6667): void {
    const cam = this.ctx.scene.cameras.main;
    const dt = Math.min(0.1, Math.max(0.001, delta / 1000));
    const lerp = 1 - Math.exp(-8 * dt);
    cam.setLerp(lerp, lerp);

    if (Math.abs(cam.zoom - this.targetZoom) > 0.005) {
      cam.setZoom(Phaser.Math.Linear(cam.zoom, this.targetZoom, lerp));
    }
  }

  private isPinchZooming(): boolean {
    const { scene } = this.ctx;
    return Boolean(scene.input.pointer1?.isDown && scene.input.pointer2?.isDown);
  }

  private cancelPointerTarget(): void {
    this.mouseTarget.active = false;
    this.touchIndicator.setVisible(false);
  }

  private handlePointerAction(pointer: Phaser.Input.Pointer): void {
    if (this.ctx.isPlacementActive?.()) return;
    if (pointer.rightButtonDown()) return;
    if (this.isPinchZooming()) {
      this.cancelPointerTarget();
      return;
    }

    const { scene } = this.ctx;
    const worldPoint = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const { x: px, y: py } = this.ctx.getPlayerPosition();

    // 1. Check if user touched an active Monster
    const touchedMonster = this.findNearestMonster(worldPoint.x, worldPoint.y, 80);
    if (touchedMonster) {
      const distFromPlayer = Math.hypot(
        px - touchedMonster.monster.x,
        py - touchedMonster.monster.y
      );
      const attackRange =
        this.ctx.getAttackRange?.(touchedMonster.monster.isBoss) ??
        (touchedMonster.monster.isBoss
          ? PLAYER_COMBAT_CONFIG.meleeRangeBoss
          : PLAYER_COMBAT_CONFIG.meleeRangeRegular);
      this.touchTargetObj = {
        x: touchedMonster.monster.x,
        y: touchedMonster.monster.y,
        stopDistance: Math.max(36, attackRange - 4),
      };
      if (distFromPlayer <= attackRange) {
        this.mouseTarget.active = false;
        this.touchTargetObj = null;
        this.ctx.onInteract();
      } else {
        this.mouseTarget = { x: touchedMonster.monster.x, y: touchedMonster.monster.y, active: true };
      }
      return;
    }

    // 2. Check if user touched an Entity, Core Gem, or Territory Altar
    const interactTarget = this.findInteractableTarget(worldPoint.x, worldPoint.y);
    if (interactTarget) {
      const distFromPlayer = Math.hypot(px - interactTarget.x, py - interactTarget.y);
      const inRange = interactTarget.entityVisual
        ? this.ctx.isWithinEntityGatherRange(px, py, interactTarget.entityVisual)
        : distFromPlayer < 100;

      this.touchTargetObj = interactTarget;
      this.touchIndicator
        .setPosition(interactTarget.x, interactTarget.y)
        .setVisible(true)
        .setAlpha(1)
        .setScale(0.45);

      if (inRange) {
        this.mouseTarget.active = false;
        this.touchTargetObj = null;
        this.ctx.onInteract();
      } else {
        this.mouseTarget = { x: interactTarget.x, y: interactTarget.y, active: true };
      }
      return;
    }

    this.touchTargetObj = null;
    this.mouseTarget = { x: worldPoint.x, y: worldPoint.y, active: true };
    this.touchIndicator
      .setPosition(worldPoint.x, worldPoint.y)
      .setVisible(true)
      .setAlpha(0.9)
      .setScale(0.42);
  }

  private findNearestMonster(wx: number, wy: number, maxDist: number): MonsterVisual | null {
    let nearest: MonsterVisual | null = null;
    let minDist = maxDist;
    this.ctx.getMonsterVisuals().forEach((mv) => {
      const d = Math.hypot(wx - mv.monster.x, wy - mv.monster.y);
      if (d < minDist) {
        minDist = d;
        nearest = mv;
      }
    });
    return nearest;
  }

  private findInteractableTarget(
    wx: number,
    wy: number
  ): { x: number; y: number; entityVisual?: EntityVisual } | null {
    const touchedEntity = this.ctx.findTappedEntityVisual(wx, wy);
    if (touchedEntity) {
      const point = this.ctx.getEntityInteractionPoint(touchedEntity);
      return { x: point.x, y: point.y, entityVisual: touchedEntity };
    }

    for (const isl of this.ctx.getIslands()) {
      if (!isl.unlocked) {
        const origin = getIslandOrigin(isl.gridX, isl.gridY);
        const signX = origin.x + TERRITORY_CENTER_X;
        const signY = origin.y + TERRITORY_CENTER_Y;
        if (Math.hypot(wx - signX, wy - signY) < 75) {
          return { x: signX, y: signY };
        }
      }
    }

    return null;
  }
}
