import Phaser from 'phaser';
import { PLAYER_COMBAT_CONFIG } from '../../../data/worldRules';
import { isPlayDataResetting } from '../../../lib/adminResetService';
import { storage } from '../../../lib/storage';
import { Island, PlayerAction, PlayerColor } from '../../../types/game';
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
import { resolveSafeSpawnPosition } from '../../utils/playerSpawnUtils';
import { WaterRect } from '../../world/MapTerrainGenerator';
import { EntityVisual } from '../renderers/ResourceEntityRenderer';
import { PlayerPointerController } from './PlayerPointerController';

export interface IPlayerMovementContext {
  scene: Phaser.Scene;
  getPlayerName: () => string;
  getPlayerColor: () => PlayerColor;
  getInitialZoom: () => number;
  getBuildingColliders: () => Phaser.Physics.Arcade.StaticGroup;
  getWallColliders: () => Phaser.Physics.Arcade.StaticGroup | null;
  getWaterColliders: () => Phaser.Physics.Arcade.StaticGroup;
  getWaterBodies: () => ReadonlyArray<WaterRect>;
  getIslands: () => Island[];
  getMonsterVisuals: () => Map<string, MonsterVisual>;
  findTappedEntityVisual: (wx: number, wy: number) => EntityVisual | null;
  isWithinEntityGatherRange: (px: number, py: number, visual: EntityVisual) => boolean;
  getEntityInteractionPoint: (visual: EntityVisual) => { x: number; y: number };
  onInteract: () => void;
  isPlacementActive?: () => boolean;
}

/**
 * 로컬 플레이어 생성, 키보드·조이스틱 입력 처리, 애니메이션 및 영지 위치 추적 컨트롤러
 */
export class PlayerMovementController {
  private ctx: IPlayerMovementContext;
  private pointerController: PlayerPointerController;
  private playerSprite!: Phaser.Physics.Arcade.Sprite;
  private playerNameTag!: Phaser.GameObjects.Text;
  private playerIndicator!: Phaser.GameObjects.Text;
  private playerHpBar!: Phaser.GameObjects.Graphics;
  private currentAction: PlayerAction = 'idle';
  private currentDirection: 'left' | 'right' = 'right';
  private isFainted = false;
  private currentHp: number = PLAYER_COMBAT_CONFIG.maxHp;
  private currentMaxHp: number = PLAYER_COMBAT_CONFIG.maxHp;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: { [key: string]: Phaser.Input.Keyboard.Key };
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private eKey!: Phaser.Input.Keyboard.Key;
  private joystickVector = { x: 0, y: 0 };
  private isActionHolding = false;

  private lastGridPos = { gridX: 0, gridY: 0 };
  private lastNearIsland: Island | null = null;
  private lastInteractTime = 0;
  private lastSavedPos: { x: number; y: number } = {
    x: PLAYER_COMBAT_CONFIG.mainVillageSpawn.x,
    y: PLAYER_COMBAT_CONFIG.mainVillageSpawn.y,
  };
  private lastSavePosTime = 0;
  private hasLocalSavedPosition = false;
  private hasMovedSinceSpawn = false;
  private unbindInputs: Array<() => void> = [];

  constructor(ctx: IPlayerMovementContext) {
    this.ctx = ctx;
    this.pointerController = new PlayerPointerController({
      scene: ctx.scene,
      getInitialZoom: ctx.getInitialZoom,
      getPlayerPosition: () => this.getPosition(),
      getIslands: ctx.getIslands,
      getMonsterVisuals: ctx.getMonsterVisuals,
      findTappedEntityVisual: ctx.findTappedEntityVisual,
      isWithinEntityGatherRange: ctx.isWithinEntityGatherRange,
      getEntityInteractionPoint: ctx.getEntityInteractionPoint,
      onInteract: ctx.onInteract,
      isPlacementActive: ctx.isPlacementActive,
    });
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

  public refreshProfileVisuals(): void {
    this.playerNameTag.setText(this.ctx.getPlayerName());
    this.playAnimation(this.currentAction);
  }

  public playAnimation(action: PlayerAction): void {
    this.currentAction = action;
    const animKey = `${this.ctx.getPlayerColor()}_${action}`;
    if (this.ctx.scene.anims.exists(animKey)) {
      this.playerSprite.play(animKey, true);
    }
  }

  public getCurrentStandingTerritoryId(): number | null {
    const islands = this.ctx.getIslands();
    const { x, y } = this.getPosition();
    const gx = Math.round((x - 320) / TERRITORY_STEP);
    const gy = Math.round((y - 320) / TERRITORY_STEP);
    return islands.find((i) => i.gridX === gx && i.gridY === gy)?.id ?? null;
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
    const savedPos = storage.loadPlayerPosition();
    this.hasLocalSavedPosition = savedPos !== null;
    this.hasMovedSinceSpawn = false;
    const resolved = resolveSafeSpawnPosition(savedPos, this.ctx.getWaterBodies());
    const startX = resolved.x;
    const startY = resolved.y;
    this.currentDirection = resolved.direction;
    this.lastSavedPos = { x: startX, y: startY };

    this.playerSprite = scene.physics.add.sprite(
      startX,
      startY,
      `${this.ctx.getPlayerColor()}PawnIdle`
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
    this.updateHpBar(this.currentHp, this.currentMaxHp);

    this.playAnimation('idle');
    this.checkTerritoryAndGridUpdates();
    if (resolved.usedFallback && savedPos) {
      this.persistPositionNow();
    }
  }

  public persistPositionNow(now: number = Date.now()): void {
    if (!this.playerSprite || isPlayDataResetting()) return;
    const x = Math.round(this.playerSprite.x);
    const y = Math.round(this.playerSprite.y);
    storage.savePlayerPosition({ x, y, direction: this.currentDirection });
    this.lastSavedPos = { x, y };
    this.lastSavePosTime = now;
  }

  public applyRemoteRestoredPosition(x: number, y: number): void {
    if (this.hasLocalSavedPosition || this.hasMovedSinceSpawn || !this.playerSprite) return;
    const resolved = resolveSafeSpawnPosition({ x, y }, this.ctx.getWaterBodies());
    if (resolved.usedFallback) return;

    this.pointerController.clearTarget();
    this.playerSprite.setPosition(resolved.x, resolved.y);
    this.playerSprite.setVelocity(0, 0);
    this.playerNameTag.setPosition(resolved.x, resolved.y - 42);
    this.playerIndicator.setPosition(resolved.x, resolved.y - 54);
    this.updateHpBar(this.currentHp, this.currentMaxHp);
    this.checkTerritoryAndGridUpdates();
    this.persistPositionNow();
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
      this.pointerController.clearTarget();
      this.playerSprite.setVelocity(0, 0);
      this.playerSprite.setAlpha(0.45);
      this.playerSprite.setTint(0x94a3b8);
      this.playAnimation('idle');
    } else {
      this.playerSprite.setAlpha(1);
      this.playerSprite.clearTint();
    }
  }

  public playHitVisual(): void {
    if (!this.playerSprite || this.isFainted) return;
    this.playerSprite.setTint(0xf87171);
    this.ctx.scene.time.delayedCall(140, () => {
      if (!this.isFainted && this.playerSprite?.active) {
        this.playerSprite.clearTint();
      }
    });
  }

  public respawnAt(x: number, y: number): void {
    if (!this.playerSprite) return;
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

  public setupInputs(): void {
    const { scene } = this.ctx;
    if (scene.input.keyboard) {
      this.cursors = scene.input.keyboard.createCursorKeys();
      this.wasdKeys = {
        W: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
      this.spaceKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.eKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

      this.spaceKey.on('down', () => this.ctx.onInteract());
      this.eKey.on('down', () => this.ctx.onInteract());
    }

    const handleActionStart = () => {
      this.isActionHolding = true;
    };
    const handleActionStop = () => {
      this.isActionHolding = false;
    };

    GameEvents.on('player-action-start', handleActionStart);
    GameEvents.on('player-action-stop', handleActionStop);

    this.unbindInputs.push(() => {
      GameEvents.off('player-action-start', handleActionStart);
      GameEvents.off('player-action-stop', handleActionStop);
    });
  }

  public update(time: number, delta: number = 16.6667): void {
    if (this.isFainted) {
      this.playerSprite.setVelocity(0, 0);
      this.pointerController.updateZoom(delta);
      return;
    }

    const speed = 250;
    let vx = 0;
    let vy = 0;

    if (this.cursors.left.isDown || this.wasdKeys.A?.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.wasdKeys.D?.isDown) vx += 1;
    if (this.cursors.up.isDown || this.wasdKeys.W?.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.wasdKeys.S?.isDown) vy += 1;

    const joyMag = Math.hypot(this.joystickVector.x, this.joystickVector.y);
    const usingJoystick = joyMag > 0.12;
    if (usingJoystick) {
      vx += this.joystickVector.x;
      vy += this.joystickVector.y;
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

    if (vx !== 0 || vy !== 0) {
      this.hasMovedSinceSpawn = true;
      const len = Math.hypot(vx, vy);
      const factor = usingJoystick ? (len >= 0.45 ? 1 : len / 0.45) : Math.min(1, len);
      this.playerSprite.setVelocity((vx / len) * speed * factor, (vy / len) * speed * factor);

      if (vx < 0) this.currentDirection = 'left';
      else if (vx > 0) this.currentDirection = 'right';
      this.playerSprite.setFlipX(this.currentDirection === 'left');

      if (this.currentAction !== 'axe' && this.currentAction !== 'pickaxe') {
        this.playAnimation('run');
      }
    } else {
      this.playerSprite.setVelocity(0, 0);
      if (this.currentAction === 'run') {
        this.playAnimation('idle');
      }
    }

    const px = this.playerSprite.x;
    const py = this.playerSprite.y;
    setDepthIfChanged(this.playerSprite, ySortDepth(py, 24));
    this.playerNameTag.setPosition(px, py - 42);
    setDepthIfChanged(this.playerNameTag, ySortDepth(py, 30));
    this.playerIndicator.setPosition(px, py - 54);
    setDepthIfChanged(this.playerIndicator, ySortDepth(py, 30));
    this.playerHpBar.setPosition(px, py - 31);
    setDepthIfChanged(this.playerHpBar, ySortDepth(py, 30));

    const isHoldInput = this.spaceKey?.isDown || this.eKey?.isDown || this.isActionHolding;
    if (isHoldInput && time - this.lastInteractTime >= 240) {
      this.ctx.onInteract();
    }

    if (
      Math.hypot(px - this.lastSavedPos.x, py - this.lastSavedPos.y) >= 16 &&
      time - this.lastSavePosTime >= 1000
    ) {
      this.persistPositionNow(time);
    }

    this.pointerController.updateZoom(delta);
    this.checkTerritoryAndGridUpdates();
  }

  private checkTerritoryAndGridUpdates(): void {
    const px = this.playerSprite.x;
    const py = this.playerSprite.y;

    let nearLocked: Island | null = null;
    for (const isl of this.ctx.getIslands()) {
      if (!isl.unlocked) {
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
  }

  public destroy(): void {
    this.persistPositionNow();
    for (const unbind of this.unbindInputs) {
      unbind();
    }
    this.unbindInputs = [];
  }
}
