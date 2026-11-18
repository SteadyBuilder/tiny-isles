import Phaser from 'phaser';
import { AURA_DEFINITIONS } from '../../../data/metaProgression';
import { PLAYER_COMBAT_CONFIG } from '../../../data/worldRules';
import {
  ConstructedBuilding,
  Island,
  PlayerAction,
  PlayerClassId,
  PlayerColor,
  PlayerHpState,
} from '../../../types/game';
import { AuraEffectId, CostumeColorKey } from '../../../types/metaProgression';
import {
  TERRITORY_CENTER_X,
  TERRITORY_CENTER_Y,
  TERRITORY_STEP,
  getIslandOrigin,
  getTerritoryCorePos,
} from '../../constants';
import { setDepthIfChanged, ySortDepth } from '../../depthLayers';
import { GameEvents } from '../../events/gameEvents';
import { MonsterVisual } from '../../systems/WaveSystem';
import { findTerritoryInsideWalls } from '../../territoryAccessRules';
import { checkJobHallProximity } from '../../utils/jobHallUtils';
import { checkMercenaryGuildProximity } from '../../utils/mercenaryGuildUtils';
import { checkToolShopProximity } from '../../utils/toolShopUtils';
import {
  canPlayHitAnimation,
  computeOneShotAnimTimeScale,
  isOneShotPlayerAction,
  resolvePostOneShotAction,
} from '../../utils/playerAnimationUtils';
import { resolveSafeSpawnPosition } from '../../utils/playerSpawnUtils';
import { WaterRect } from '../../world/MapTerrainGenerator';
import { EntityVisual } from '../renderers/ResourceEntityRenderer';
import { ensureClassSpritesLoaded } from '../utils/classAssetLoader';
import { KeyboardInputController } from './KeyboardInputController';
import { PlayerDashController } from './PlayerDashController';
import { PlayerPointerController } from './PlayerPointerController';

export interface IPlayerMovementContext {
  scene: Phaser.Scene;
  isSceneAlive: () => boolean;
  getPlayerName: () => string;
  getPlayerColor: () => PlayerColor;
  getCostumeColor?: () => CostumeColorKey;
  getAuraId?: () => AuraEffectId;
  getInitialZoom: () => number;
  getBuildingColliders: () => Phaser.Physics.Arcade.StaticGroup;
  getWallColliders: () => Phaser.Physics.Arcade.StaticGroup | null;
  getWaterColliders: () => Phaser.Physics.Arcade.StaticGroup;
  getWaterBodies: () => ReadonlyArray<WaterRect>;
  getIslands: () => Island[];
  getMonsterVisuals: () => Map<string, MonsterVisual>;
  findNearestMonster?: (x: number, y: number, radiusPx: number) => MonsterVisual | null;
  findTappedEntityVisual: (wx: number, wy: number) => EntityVisual | null;
  isWithinEntityGatherRange: (px: number, py: number, visual: EntityVisual) => boolean;
  getEntityInteractionPoint: (visual: EntityVisual) => { x: number; y: number };
  onInteract: () => void;
  onAutoInteract?: () => void;
  isPlacementActive?: () => boolean;
  getMoveSpeed?: () => number;
  getAttackRange?: (isBoss: boolean) => number;
  getConstructedBuildings?: () => ConstructedBuilding[];
  grantDashInvincibility?: (durationMs: number) => void;
  findNearestDamagedWall?: (
    wx: number,
    wy: number,
    maxDist?: number
  ) => { hitX: number; hitY: number } | null;
}

/**
 * 로컬 플레이어 생성, 키보드·조이스틱 입력 처리, 애니메이션 및 영지 위치 추적 컨트롤러
 */
export class PlayerMovementController {
  private ctx: IPlayerMovementContext;
  private pointerController: PlayerPointerController;
  private dashController: PlayerDashController;
  private playerSprite!: Phaser.Physics.Arcade.Sprite;
  private playerAuraRing?: Phaser.GameObjects.Ellipse;
  private playerNameTag!: Phaser.GameObjects.Text;
  private playerIndicator!: Phaser.GameObjects.Text;
  private playerHpBar!: Phaser.GameObjects.Graphics;
  private playerCastBar!: Phaser.GameObjects.Graphics;
  private castBarDurationMs = 0;
  private castBarElapsedMs = 0;
  private currentAction: PlayerAction = 'idle';
  private currentDirection: 'left' | 'right' = 'right';
  private currentClassId: PlayerClassId = 'pawn';
  private isFainted = false;
  private lastMoveInputActive = false;
  private oneShotFallbackTimer?: Phaser.Time.TimerEvent;
  private currentHp: number = PLAYER_COMBAT_CONFIG.maxHp;
  private currentMaxHp: number = PLAYER_COMBAT_CONFIG.maxHp;

  private keyboardController: KeyboardInputController;
  private joystickVector = { x: 0, y: 0 };
  private isActionHolding = false;
  private isAutoInteractEnabled = false;

  private lastGridPos = { gridX: 0, gridY: 0 };
  private lastStandingTerritoryId: number | null = 0;
  private lastNearIsland: Island | null = null;
  private lastNearJobHall = false;
  private lastNearToolShop = false;
  private lastNearMercGuild = false;
  private lastInteractTime = 0;
  private lastAutoInteractTime = 0;
  private unbindInputs: Array<() => void> = [];

  constructor(ctx: IPlayerMovementContext) {
    this.ctx = ctx;
    this.keyboardController = new KeyboardInputController({
      onInteract: () => this.ctx.onInteract(),
      onToggleAutoInteract: () => this.toggleAutoInteract(),
      onCastSkill: () => GameEvents.emit('cast-active-skill'),
      onOpenInventory: () => GameEvents.emit('open-inventory-modal'),
      onDash: () => this.triggerDash(),
    });
    this.pointerController = new PlayerPointerController({
      scene: ctx.scene,
      getInitialZoom: ctx.getInitialZoom,
      getPlayerPosition: () => this.getPosition(),
      getIslands: ctx.getIslands,
      getMonsterVisuals: ctx.getMonsterVisuals,
      findNearestMonster: ctx.findNearestMonster,
      findTappedEntityVisual: ctx.findTappedEntityVisual,
      isWithinEntityGatherRange: ctx.isWithinEntityGatherRange,
      getEntityInteractionPoint: ctx.getEntityInteractionPoint,
      onInteract: ctx.onInteract,
      isPlacementActive: ctx.isPlacementActive,
      getAttackRange: ctx.getAttackRange,
      findNearestDamagedWall: ctx.findNearestDamagedWall,
    });
    this.dashController = new PlayerDashController({
      scene: ctx.scene,
      isSceneAlive: ctx.isSceneAlive,
      isPlayerFainted: () => this.isFainted,
      grantDashInvincibility: (durationMs) => ctx.grantDashInvincibility?.(durationMs),
    });
  }

  public getDirection(): 'left' | 'right' {
    return this.currentDirection;
  }

  public triggerDash(): void {
    if (!this.playerSprite || this.isFainted) return;
    const { vx, vy } = this.readDirectionalInput();
    this.pointerController.clearTarget();
    this.dashController.tryStartDash({
      inputDirX: vx,
      inputDirY: vy,
      facing: this.currentDirection,
      moveSpeed: this.ctx.getMoveSpeed?.() ?? 250,
      playerSprite: this.playerSprite,
    });
  }

  public triggerSkillSurge(dirX: number, dirY: number, speedPx: number, durationMs: number): void {
    if (!this.playerSprite || this.isFainted) return;
    this.pointerController.clearTarget();
    this.dashController.startForcedSurge({
      dirX,
      dirY,
      speedPx,
      durationMs,
      playerSprite: this.playerSprite,
    });
  }

  private readDirectionalInput(): { vx: number; vy: number; usingJoystick: boolean } {
    let { vx, vy } = this.keyboardController.getDirectionalVector();
    const joyMag = Math.hypot(this.joystickVector.x, this.joystickVector.y);
    const usingJoystick = joyMag > 0.12;
    if (usingJoystick) {
      vx += this.joystickVector.x;
      vy += this.joystickVector.y;
    }
    return { vx, vy, usingJoystick };
  }

  public getPosition(): { x: number; y: number } {
    const core0 = getTerritoryCorePos(0, 0);
    return {
      x: this.playerSprite?.x ?? core0.x,
      y: this.playerSprite?.y ?? core0.y,
    };
  }

  public getState(): {
    x: number;
    y: number;
    direction: 'left' | 'right';
    action: PlayerAction;
  } {
    return {
      x: this.playerSprite.x,
      y: this.playerSprite.y,
      direction: this.currentDirection,
      action: this.currentAction,
    };
  }

  public getCurrentAction(): PlayerAction {
    return this.currentAction;
  }

  public setTargetZoom(zoom: number): void {
    this.pointerController.setTargetZoom(zoom);
  }

  public setJoystickVector(vector: { x: number; y: number }): void {
    this.joystickVector = vector;
  }

  public markInteractTime(now: number): void {
    this.lastInteractTime = now;
  }

  private getEffectiveCostumeColor(): CostumeColorKey {
    return this.ctx.getCostumeColor?.() ?? this.ctx.getPlayerColor();
  }

  public refreshProfileVisuals(): void {
    this.playerNameTag.setText(this.ctx.getPlayerName());
    if (this.currentClassId !== 'pawn') {
      const targetClassId = this.currentClassId;
      ensureClassSpritesLoaded(
        this.ctx.scene,
        this.getEffectiveCostumeColor(),
        targetClassId,
        () => {
          if (this.ctx.isSceneAlive() && this.currentClassId === targetClassId) {
            this.playAnimation(this.currentAction);
          }
        }
      );
      return;
    }
    this.playAnimation(this.currentAction);
  }

  public setPlayerClassVisual(classId: PlayerClassId): void {
    this.currentClassId = classId;
    if (!this.playerSprite) return;
    if (classId === 'lancer') {
      this.playerSprite.setDisplaySize(172, 172);
    } else {
      this.playerSprite.setDisplaySize(128, 128);
    }
    ensureClassSpritesLoaded(
      this.ctx.scene,
      this.getEffectiveCostumeColor(),
      classId,
      () => {
        if (this.ctx.isSceneAlive() && this.currentClassId === classId) {
          this.playAnimation(this.currentAction);
        }
      }
    );
  }

  private clearOneShotFallbackTimer(): void {
    this.oneShotFallbackTimer?.remove(false);
    this.oneShotFallbackTimer = undefined;
  }

  private resolveAnimationKeys(action: PlayerAction): {
    targetKey: string;
    classIdleKey: string;
    hasDedicatedAnim: boolean;
  } {
    const color = this.getEffectiveCostumeColor();
    const classAnimKey =
      this.currentClassId !== 'pawn'
        ? `${color}_${this.currentClassId}_${action}`
        : `${color}_${action}`;
    const classIdleKey =
      this.currentClassId !== 'pawn'
        ? `${color}_${this.currentClassId}_idle`
        : `${color}_idle`;
    const baseFallbackKey = `${color}_${action}`;

    const hasClassAnim = this.ctx.scene.anims.exists(classAnimKey);
    const hasBaseFallback = this.ctx.scene.anims.exists(baseFallbackKey);
    const targetKey = hasClassAnim
      ? classAnimKey
      : hasBaseFallback
      ? baseFallbackKey
      : classIdleKey;

    return {
      targetKey,
      classIdleKey,
      hasDedicatedAnim: hasClassAnim || hasBaseFallback,
    };
  }

  private handleOneShotAnimationComplete(completedAnimKey: string): void {
    if (!isOneShotPlayerAction(this.currentAction)) return;
    const activeKey = this.playerSprite?.anims?.currentAnim?.key;
    if (activeKey && activeKey !== completedAnimKey) return;

    this.clearOneShotFallbackTimer();
    if (this.playerSprite?.anims) {
      this.playerSprite.anims.timeScale = 1;
    }
    this.playAnimation(resolvePostOneShotAction(this.isFainted, this.lastMoveInputActive));
  }

  public playAnimation(action: PlayerAction, targetDurationMs?: number): void {
    this.currentAction = action;
    this.clearOneShotFallbackTimer();

    if (!this.playerSprite?.active) return;

    const { targetKey, classIdleKey, hasDedicatedAnim } = this.resolveAnimationKeys(action);
    const isOneShot = isOneShotPlayerAction(action);

    if (!this.ctx.scene.anims.exists(targetKey)) {
      return;
    }

    if (isOneShot && hasDedicatedAnim && targetKey !== classIdleKey) {
      const animObj = this.ctx.scene.anims.get(targetKey);
      const naturalDurationMs = animObj?.duration ?? 0;
      const timeScale = computeOneShotAnimTimeScale(naturalDurationMs, targetDurationMs);
      this.playerSprite.anims.timeScale = timeScale;
      this.playerSprite.play(targetKey, false);

      const expectedDurationMs =
        naturalDurationMs > 0 ? Math.ceil(naturalDurationMs / timeScale) : targetDurationMs ?? 300;
      this.oneShotFallbackTimer = this.ctx.scene.time.delayedCall(expectedDurationMs + 80, () => {
        if (!this.ctx.isSceneAlive() || !this.playerSprite?.active) return;
        if (this.currentAction === action) {
          this.playerSprite.anims.timeScale = 1;
          this.playAnimation(resolvePostOneShotAction(this.isFainted, this.lastMoveInputActive));
        }
      });
      return;
    }

    this.playerSprite.anims.timeScale = 1;
    this.playerSprite.play(targetKey, true);

    if (isOneShot) {
      const fallbackMs = targetDurationMs && targetDurationMs > 0 ? targetDurationMs : 240;
      this.oneShotFallbackTimer = this.ctx.scene.time.delayedCall(fallbackMs, () => {
        if (!this.ctx.isSceneAlive() || !this.playerSprite?.active) return;
        if (this.currentAction === action) {
          this.playAnimation(resolvePostOneShotAction(this.isFainted, this.lastMoveInputActive));
        }
      });
    }
  }

  public getCurrentStandingTerritoryId(): number | null {
    const islands = this.ctx.getIslands();
    const { x, y } = this.getPosition();
    return findTerritoryInsideWalls(x, y, islands)?.id ?? null;
  }

  public getCurrentTerritory(): Island {
    const islands = this.ctx.getIslands();
    const { x, y } = this.getPosition();
    const gx = Math.round((x - 320) / TERRITORY_STEP);
    const gy = Math.round((y - 320) / TERRITORY_STEP);
    return (
      islands.find((i) => i.gridX === gx && i.gridY === gy && i.unlocked) ||
      islands.find((i) => i.unlocked) ||
      islands[0]
    );
  }

  public createPlayer(): void {
    const { scene } = this.ctx;
    const resolved = resolveSafeSpawnPosition(null, this.ctx.getWaterBodies());
    const startX = resolved.x;
    const startY = resolved.y;
    this.currentDirection = resolved.direction;

    const auraId = this.ctx.getAuraId?.() ?? 'aura_none';
    const auraDef = AURA_DEFINITIONS.find((a) => a.id === auraId);
    if (auraDef && auraDef.id !== 'aura_none') {
      this.playerAuraRing = scene.add.ellipse(startX, startY + 20, 48, 22, auraDef.ringColorHex, 0.22);
      this.playerAuraRing.setStrokeStyle(2, auraDef.ringColorHex, 0.78);
      scene.tweens.add({
        targets: this.playerAuraRing,
        scaleX: 1.16,
        scaleY: 1.16,
        alpha: 0.75,
        duration: 950,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    this.playerSprite = scene.physics.add.sprite(
      startX,
      startY,
      `${this.getEffectiveCostumeColor()}PawnIdle`
    );
    this.playerSprite.setDisplaySize(128, 128);
    this.playerSprite.setCollideWorldBounds(true);
    this.playerSprite.setSize(36, 24);
    this.playerSprite.setOffset(78, 96);
    this.playerSprite.setFlipX(this.currentDirection === 'left');

    scene.physics.add.collider(this.playerSprite, this.ctx.getBuildingColliders());
    const wallColliders = this.ctx.getWallColliders();
    if (wallColliders) {
      scene.physics.add.collider(this.playerSprite, wallColliders);
    }
    scene.physics.add.collider(this.playerSprite, this.ctx.getWaterColliders());

    this.playerNameTag = scene.add
      .text(startX, startY - 42, this.ctx.getPlayerName(), {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#38bdf8',
        stroke: '#000000',
        strokeThickness: 2.5,
      })
      .setOrigin(0.5);

    this.playerIndicator = scene.add
      .text(startX, startY - 54, '▼', {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#fde047',
        stroke: '#000000',
        strokeThickness: 1.5,
      })
      .setOrigin(0.5);

    this.playerHpBar = scene.add.graphics();
    this.playerCastBar = scene.add.graphics();
    this.updateHpBar(this.currentHp, this.currentMaxHp);

    this.playerSprite.on(
      Phaser.Animations.Events.ANIMATION_COMPLETE,
      (anim: Phaser.Animations.Animation) => {
        this.handleOneShotAnimationComplete(anim.key);
      }
    );

    this.playAnimation('idle');
    this.checkTerritoryAndGridUpdates();
  }

  private clearCastBar(): void {
    this.castBarDurationMs = 0;
    this.castBarElapsedMs = 0;
    this.playerCastBar?.clear();
  }

  private updateCastBar(px: number, py: number): void {
    if (!this.playerCastBar || this.castBarDurationMs <= 0) return;

    const barW = 42;
    const barH = 4;
    const ratio = Math.max(0, Math.min(1, this.castBarElapsedMs / this.castBarDurationMs));

    this.playerCastBar.clear();
    this.playerCastBar.setPosition(px, py - 64);
    setDepthIfChanged(this.playerCastBar, ySortDepth(py, 31));

    this.playerCastBar.fillStyle(0x0f172a, 0.85);
    this.playerCastBar.fillRect(-barW / 2 - 1, -1, barW + 2, barH + 2);
    if (ratio > 0) {
      this.playerCastBar.fillStyle(0xffffff, 1);
      this.playerCastBar.fillRect(-barW / 2, 0, Math.max(2, barW * ratio), barH);
    }
  }

  public updateHpBar(hp: number, maxHp: number): void {
    this.currentHp = hp;
    this.currentMaxHp = Math.max(1, maxHp);
    if (!this.playerHpBar || !this.playerSprite) return;

    const px = this.playerSprite.x;
    const py = this.playerSprite.y;
    const barW = 48;
    const barH = 5;
    const ratio = Math.max(0, Math.min(1, this.currentHp / this.currentMaxHp));

    this.playerHpBar.clear();
    this.playerHpBar.setPosition(px, py - 31);
    setDepthIfChanged(this.playerHpBar, ySortDepth(py, 30));

    this.playerHpBar.fillStyle(0x0f172a, 0.85);
    this.playerHpBar.fillRect(-barW / 2 - 1, -1, barW + 2, barH + 2);
    const fillColor = ratio > 0.5 ? 0x22c55e : ratio > 0.25 ? 0xf59e0b : 0xef4444;
    this.playerHpBar.fillStyle(fillColor, 1);
    if (ratio > 0) {
      this.playerHpBar.fillRect(-barW / 2, 0, Math.max(2, barW * ratio), barH);
    }
  }

  public setFaintedVisual(fainted: boolean): void {
    this.isFainted = fainted;
    if (!this.playerSprite) return;
    if (fainted) {
      this.clearCastBar();
      this.dashController.cancelDash(this.playerSprite);
      this.pointerController.clearTarget();
      this.playerSprite.setVelocity(0, 0);
      this.playerSprite.setAlpha(0.65);
      this.playerSprite.setTint(0x94a3b8);
      this.playAnimation('stun');
    } else {
      this.playerSprite.setAlpha(1);
      this.playerSprite.clearTint();
      this.playAnimation('idle');
    }
  }

  public playHitVisual(): void {
    if (!this.playerSprite || this.isFainted) return;
    this.playerSprite.setTint(0xf87171);
    if (canPlayHitAnimation(this.currentAction) && this.resolveAnimationKeys('hit').hasDedicatedAnim) {
      this.playAnimation('hit', 220);
    }
    this.ctx.scene.time.delayedCall(220, () => {
      if (!this.isFainted && this.playerSprite?.active && !this.dashController.getIsDashing()) {
        this.playerSprite.clearTint();
      }
    });
  }

  public playCastVisual(durationMs = 520): void {
    if (!this.playerSprite || this.isFainted) return;
    if (durationMs > 0) {
      this.castBarDurationMs = durationMs;
      this.castBarElapsedMs = 0;
      this.updateCastBar(this.playerSprite.x, this.playerSprite.y);
    }

    if (this.resolveAnimationKeys('cast').hasDedicatedAnim) {
      this.playAnimation('cast', durationMs);
    }
  }

  public respawnAt(x: number, y: number): void {
    if (!this.playerSprite) return;
    this.clearCastBar();
    this.dashController.cancelDash(this.playerSprite);
    this.pointerController.clearTarget();
    this.playerSprite.setPosition(x, y);
    this.playerSprite.setVelocity(0, 0);
    this.playerNameTag.setPosition(x, y - 42);
    this.playerIndicator.setPosition(x, y - 54);
    this.updateHpBar(PLAYER_COMBAT_CONFIG.maxHp, PLAYER_COMBAT_CONFIG.maxHp);
    this.checkTerritoryAndGridUpdates();

    this.ctx.scene.tweens.add({
      targets: this.playerSprite,
      alpha: 0.45,
      duration: 140,
      yoyo: true,
      repeat: 5,
      onComplete: () => {
        if (this.playerSprite?.active && !this.isFainted) {
          this.playerSprite.setAlpha(1);
        }
      },
    });
  }

  public setupCamera(): void {
    this.pointerController.setupCamera(this.playerSprite);
  }

  public toggleAutoInteract(): void {
    this.isAutoInteractEnabled = !this.isAutoInteractEnabled;
    GameEvents.emit('auto-interact-changed', this.isAutoInteractEnabled);
  }

  public setupInputs(): void {
    this.keyboardController.attach();

    const handleActionStart = () => {
      this.isActionHolding = true;
    };
    const handleActionStop = () => {
      this.isActionHolding = false;
    };
    const handleHpUpdated = (hpState: PlayerHpState) => {
      this.updateHpBar(hpState.hp, hpState.maxHp);
    };
    const handleTriggerDash = () => {
      this.triggerDash();
    };
    const handleToggleAutoInteract = () => {
      this.toggleAutoInteract();
    };
    const handlePauseToggled = (paused: boolean) => {
      this.keyboardController.setPaused(paused);
    };
    const handleModalKeyboardLock = (locked: boolean) => {
      this.keyboardController.setModalLocked(locked);
    };

    GameEvents.on('player-action-start', handleActionStart);
    GameEvents.on('player-action-stop', handleActionStop);
    GameEvents.on('player-hp-updated', handleHpUpdated);
    GameEvents.on('trigger-dash', handleTriggerDash);
    GameEvents.on('toggle-auto-interact', handleToggleAutoInteract);
    GameEvents.on('game-pause-toggled', handlePauseToggled);
    GameEvents.on('ui-modal-keyboard-lock', handleModalKeyboardLock);

    this.unbindInputs.push(() => {
      GameEvents.off('player-action-start', handleActionStart);
      GameEvents.off('player-action-stop', handleActionStop);
      GameEvents.off('player-hp-updated', handleHpUpdated);
      GameEvents.off('trigger-dash', handleTriggerDash);
      GameEvents.off('toggle-auto-interact', handleToggleAutoInteract);
      GameEvents.off('game-pause-toggled', handlePauseToggled);
      GameEvents.off('ui-modal-keyboard-lock', handleModalKeyboardLock);
    });

    GameEvents.emit('auto-interact-changed', this.isAutoInteractEnabled);
    this.dashController.emitState();
  }

  public update(time: number, delta: number = 16.6667): void {
    if (this.isFainted) {
      this.playerSprite.setVelocity(0, 0);
      this.pointerController.updateZoom(delta);
      return;
    }

    const isDashing = this.dashController.update(delta, this.playerSprite);

    if (!isDashing) {
      const speed = this.ctx.getMoveSpeed?.() ?? 250;
      const dirInput = this.readDirectionalInput();
      let vx = dirInput.vx;
      let vy = dirInput.vy;

      if (dirInput.usingJoystick) {
        this.pointerController.clearTarget();
      }

      if (vx !== 0 || vy !== 0) {
        this.pointerController.clearTarget();
      } else {
        const pointerDir = this.pointerController.resolvePointerMovement(
          this.playerSprite.x,
          this.playerSprite.y
        );
        if (pointerDir) {
          vx = pointerDir.vx;
          vy = pointerDir.vy;
        }
      }

      const isMoving = vx !== 0 || vy !== 0;
      this.lastMoveInputActive = isMoving;

      if (isMoving) {
        const len = Math.hypot(vx, vy);
        const factor = dirInput.usingJoystick
          ? len >= 0.45
            ? 1
            : len / 0.45
          : Math.min(1, len);
        this.playerSprite.setVelocity((vx / len) * speed * factor, (vy / len) * speed * factor);

        if (vx < 0) this.currentDirection = 'left';
        else if (vx > 0) this.currentDirection = 'right';
        this.playerSprite.setFlipX(this.currentDirection === 'left');

        if (
          this.currentAction !== 'axe' &&
          this.currentAction !== 'pickaxe' &&
          this.currentAction !== 'cast' &&
          this.currentAction !== 'hit' &&
          this.currentAction !== 'stun'
        ) {
          this.playAnimation('run');
        }
      } else {
        this.playerSprite.setVelocity(0, 0);
        if (this.currentAction === 'run') {
          this.playAnimation('idle');
        }
      }
    } else {
      this.lastMoveInputActive = false;
    }

    const px = this.playerSprite.x;
    const py = this.playerSprite.y;
    if (this.playerAuraRing) {
      this.playerAuraRing.setPosition(px, py + 20);
      setDepthIfChanged(this.playerAuraRing, ySortDepth(py, 10));
    }
    setDepthIfChanged(this.playerSprite, ySortDepth(py, 24));
    this.playerNameTag.setPosition(px, py - 42);
    setDepthIfChanged(this.playerNameTag, ySortDepth(py, 30));
    this.playerIndicator.setPosition(px, py - 54);
    setDepthIfChanged(this.playerIndicator, ySortDepth(py, 30));
    this.playerHpBar.setPosition(px, py - 31);
    setDepthIfChanged(this.playerHpBar, ySortDepth(py, 30));

    if (this.castBarDurationMs > 0) {
      this.castBarElapsedMs += delta;
      if (this.castBarElapsedMs >= this.castBarDurationMs) {
        this.clearCastBar();
      } else {
        this.updateCastBar(px, py);
      }
    }

    const isHoldInput = this.keyboardController.isInteractHeld() || this.isActionHolding;
    if (isHoldInput && time - this.lastInteractTime >= 240) {
      this.ctx.onInteract();
    } else if (
      !isHoldInput &&
      this.isAutoInteractEnabled &&
      time - this.lastAutoInteractTime >= 240
    ) {
      this.lastAutoInteractTime = time;
      this.ctx.onAutoInteract?.();
    }

    this.pointerController.updateZoom(delta);
    this.checkTerritoryAndGridUpdates();
  }

  private checkTerritoryAndGridUpdates(): void {
    const px = this.playerSprite.x;
    const py = this.playerSprite.y;

    let nearLocked: Island | null = null;
    for (const isl of this.ctx.getIslands()) {
      if (!isl.unlocked && !isl.isMonsterCamp) {
        const origin = getIslandOrigin(isl.gridX, isl.gridY);
        const signX = origin.x + TERRITORY_CENTER_X;
        const signY = origin.y + TERRITORY_CENTER_Y;
        if (Math.hypot(px - signX, py - signY) < 260) {
          nearLocked = isl;
          break;
        }
      }
    }

    if (nearLocked?.id !== this.lastNearIsland?.id) {
      this.lastNearIsland = nearLocked;
      GameEvents.emit('near-island-changed', nearLocked);
    }

    const gridX = Math.round((px - TERRITORY_CENTER_X) / TERRITORY_STEP);
    const gridY = Math.round((py - TERRITORY_CENTER_Y) / TERRITORY_STEP);
    if (gridX !== this.lastGridPos.gridX || gridY !== this.lastGridPos.gridY) {
      this.lastGridPos = { gridX, gridY };
      GameEvents.emit('player-grid-pos-changed', { gridX, gridY });
    }

    const standingTerritoryId =
      findTerritoryInsideWalls(px, py, this.ctx.getIslands())?.id ?? null;
    if (standingTerritoryId !== this.lastStandingTerritoryId) {
      this.lastStandingTerritoryId = standingTerritoryId;
      GameEvents.emit('player-standing-territory-changed', standingTerritoryId);
    }

    const buildings = this.ctx.getConstructedBuildings?.() ?? [];
    const jobHallStatus = checkJobHallProximity(px, py, buildings);
    if (jobHallStatus.isNear !== this.lastNearJobHall) {
      this.lastNearJobHall = jobHallStatus.isNear;
      GameEvents.emit('job-hall-proximity-changed', jobHallStatus.isNear);
    }

    const toolShopStatus = checkToolShopProximity(px, py, buildings);
    if (toolShopStatus.isNear !== this.lastNearToolShop) {
      this.lastNearToolShop = toolShopStatus.isNear;
      GameEvents.emit('tool-shop-proximity-changed', toolShopStatus.isNear);
    }

    const mercGuildStatus = checkMercenaryGuildProximity(px, py, buildings);
    if (mercGuildStatus.isNear !== this.lastNearMercGuild) {
      this.lastNearMercGuild = mercGuildStatus.isNear;
      GameEvents.emit('mercenary-guild-proximity-changed', mercGuildStatus.isNear);
    }
  }

  public destroy(): void {
    this.clearOneShotFallbackTimer();
    this.keyboardController.detach();
    for (const unbind of this.unbindInputs) {
      unbind();
    }
    this.unbindInputs = [];
    this.dashController.destroy();
  }
}
