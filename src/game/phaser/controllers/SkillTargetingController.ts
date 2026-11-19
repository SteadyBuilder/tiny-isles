import Phaser from 'phaser';
import { SKILL_FX_STYLE_CONFIG } from '../../../data/combatFeedbackConfig';
import { PlayerClassDefinition } from '../../../types/hunting';
import { DEPTH } from '../../depthLayers';
import { GameEvents } from '../../events/gameEvents';
import { clampTargetToCastRange, isGroundTargetedClass } from '../../utils/skillTargetingUtils';

export interface ISkillTargetingContext {
  scene: Phaser.Scene;
  getPlayerPosition: () => { x: number; y: number };
  getClassDef: () => PlayerClassDefinition;
  getEffectiveCastRange: () => number;
  getEffectiveImpactRadius: () => number;
  canCastSkill: () => boolean;
  onConfirmCast: (targetX: number, targetY: number) => void;
}

interface ActiveTargetingSession {
  classDef: PlayerClassDefinition;
  castRange: number;
  impactRadius: number;
  pointerWorldX: number;
  pointerWorldY: number;
  hasPointerPos: boolean;
}

/**
 * 지점 지정형 액티브 스킬(메테오 노바, 화살비 등)의 사거리·착탄 범위 프리뷰 및
 * PC(클릭 확정) / 모바일(1탭 즉시 시전) 입력을 전담하는 컨트롤러.
 */
export class SkillTargetingController {
  private ctx: ISkillTargetingContext;
  private active: ActiveTargetingSession | null = null;
  private rangeGraphics: Phaser.GameObjects.Graphics | null = null;
  private impactGraphics: Phaser.GameObjects.Graphics | null = null;
  private consumeGuardUntilMs = 0;
  private unbindFns: Array<() => void> = [];

  constructor(ctx: ISkillTargetingContext) {
    this.ctx = ctx;
    this.bindInputListeners();
  }

  public isActive(): boolean {
    return this.active !== null;
  }

  public isBlockingPointer(): boolean {
    return this.active !== null || Date.now() < this.consumeGuardUntilMs;
  }

  public toggle(): void {
    if (this.active) {
      this.cancel();
      return;
    }
    this.enter();
  }

  public enter(): boolean {
    const classDef = this.ctx.getClassDef();
    if (!isGroundTargetedClass(classDef)) return false;
    if (!this.ctx.canCastSkill()) return false;

    this.clearVisuals();

    const pos = this.ctx.getPlayerPosition();
    const castRange = this.ctx.getEffectiveCastRange();
    const impactRadius = this.ctx.getEffectiveImpactRadius();

    const pointer = this.ctx.scene.input.activePointer;
    let pointerWorldX = pos.x;
    let pointerWorldY = pos.y;
    let hasPointerPos = false;

    if (pointer && !pointer.wasTouch && (pointer.x !== 0 || pointer.y !== 0)) {
      const wp = this.ctx.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      pointerWorldX = wp.x;
      pointerWorldY = wp.y;
      hasPointerPos = true;
    }

    this.active = {
      classDef,
      castRange,
      impactRadius,
      pointerWorldX,
      pointerWorldY,
      hasPointerPos,
    };

    this.createVisuals();
    this.redrawVisuals();
    this.emitState();
    return true;
  }

  public cancel(): void {
    if (!this.active) return;
    this.active = null;
    this.clearVisuals();
    this.emitState();
  }

  public update(): void {
    if (!this.active) return;
    if (!this.ctx.canCastSkill() || !isGroundTargetedClass(this.ctx.getClassDef())) {
      this.cancel();
      return;
    }

    this.active.castRange = this.ctx.getEffectiveCastRange();
    this.active.impactRadius = this.ctx.getEffectiveImpactRadius();
    this.redrawVisuals();
  }

  public destroy(): void {
    this.clearVisuals();
    this.active = null;
    for (const unbind of this.unbindFns) {
      unbind();
    }
    this.unbindFns = [];
  }

  private bindInputListeners(): void {
    const { scene } = this.ctx;

    const onPointerMove = (pointer: Phaser.Input.Pointer) => {
      if (!this.active || pointer.wasTouch) return;
      const wp = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.active.pointerWorldX = wp.x;
      this.active.pointerWorldY = wp.y;
      this.active.hasPointerPos = true;
      this.redrawVisuals();
    };

    const onPointerDown = (pointer: Phaser.Input.Pointer) => {
      if (!this.active) return;

      if (pointer.rightButtonDown()) {
        this.consumeGuardUntilMs = Date.now() + 120;
        this.cancel();
        return;
      }

      if (scene.input.pointer1?.isDown && scene.input.pointer2?.isDown) {
        return;
      }

      const wp = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const pos = this.ctx.getPlayerPosition();
      const clamped = clampTargetToCastRange(pos.x, pos.y, wp.x, wp.y, this.active.castRange);

      this.consumeGuardUntilMs = Date.now() + 120;
      this.active = null;
      this.clearVisuals();
      this.emitState();
      this.ctx.onConfirmCast(clamped.x, clamped.y);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (this.active && e.key === 'Escape') {
        e.preventDefault();
        this.cancel();
      }
    };

    const onModalLock = (locked: boolean) => {
      if (locked && this.active) {
        this.cancel();
      }
    };

    scene.input.on('pointermove', onPointerMove);
    scene.input.on('pointerdown', onPointerDown);
    GameEvents.on('ui-modal-keyboard-lock', onModalLock);

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', onKeyDown);
    }

    this.unbindFns.push(() => {
      scene.input.off('pointermove', onPointerMove);
      scene.input.off('pointerdown', onPointerDown);
      GameEvents.off('ui-modal-keyboard-lock', onModalLock);
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', onKeyDown);
      }
    });
  }

  private createVisuals(): void {
    const { scene } = this.ctx;
    this.rangeGraphics = scene.add.graphics().setDepth(DEPTH.TERRAIN + 3);
    this.impactGraphics = scene.add.graphics().setDepth(DEPTH.TOUCH_INDICATOR + 4);
  }

  private redrawVisuals(): void {
    if (!this.active || !this.rangeGraphics || !this.impactGraphics) return;

    const pos = this.ctx.getPlayerPosition();
    const style = SKILL_FX_STYLE_CONFIG[this.active.classDef.id];
    const primaryColor = style.primaryHex;
    const secondaryColor = style.secondaryHex;

    // 1. 플레이어 중심 최대 시전 사거리 원
    this.rangeGraphics.clear();
    this.rangeGraphics.fillStyle(primaryColor, 0.06);
    this.rangeGraphics.lineStyle(2.5, primaryColor, 0.65);
    this.rangeGraphics.fillCircle(pos.x, pos.y, this.active.castRange);
    this.rangeGraphics.strokeCircle(pos.x, pos.y, this.active.castRange);

    // 2. 커서 착탄 반경 프리뷰 (PC 마우스 이동 시 표시)
    this.impactGraphics.clear();
    if (!this.active.hasPointerPos) return;

    const clamped = clampTargetToCastRange(
      pos.x,
      pos.y,
      this.active.pointerWorldX,
      this.active.pointerWorldY,
      this.active.castRange
    );

    // 사거리 보정 시 시전자 → 착탄 지점 가이드 라인 표시
    if (clamped.isClamped) {
      this.impactGraphics.lineStyle(1.5, secondaryColor, 0.45);
      this.impactGraphics.lineBetween(pos.x, pos.y, clamped.x, clamped.y);
    }

    this.impactGraphics.fillStyle(primaryColor, 0.16);
    this.impactGraphics.lineStyle(3, primaryColor, 0.92);
    this.impactGraphics.fillCircle(clamped.x, clamped.y, this.active.impactRadius);
    this.impactGraphics.strokeCircle(clamped.x, clamped.y, this.active.impactRadius);

    // 중심 십자 조준선
    const crossSize = 14;
    this.impactGraphics.lineStyle(2.5, secondaryColor, 0.95);
    this.impactGraphics.lineBetween(
      clamped.x - crossSize,
      clamped.y,
      clamped.x + crossSize,
      clamped.y
    );
    this.impactGraphics.lineBetween(
      clamped.x,
      clamped.y - crossSize,
      clamped.x,
      clamped.y + crossSize
    );
  }

  private emitState(): void {
    if (!this.active) {
      GameEvents.emit('skill-targeting-state-changed', { active: false });
      return;
    }

    GameEvents.emit('skill-targeting-state-changed', {
      active: true,
      classId: this.active.classDef.id,
      skillName: this.active.classDef.skillName,
      skillIcon: this.active.classDef.skillIcon,
      castRange: this.active.castRange,
      impactRadius: this.active.impactRadius,
    });
  }

  private clearVisuals(): void {
    this.rangeGraphics?.destroy();
    this.rangeGraphics = null;
    this.impactGraphics?.destroy();
    this.impactGraphics = null;
  }
}
