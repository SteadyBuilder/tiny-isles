import Phaser from 'phaser';
import { Island, PlayerAction, PlayerColor } from '../../../types/game';
import { getIslandOrigin, TERRITORY_STEP } from '../../constants';
import { ySortDepth } from '../../depthLayers';
import { GameEvents } from '../../events/gameEvents';
import { MonsterVisual } from '../../systems/WaveSystem';
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
  getIslands: () => Island[];
  getMonsterVisuals: () => Map<string, MonsterVisual>;
  findNearestEntityVisual: (x: number, y: number, maxDist: number) => EntityVisual | null;
  onInteract: () => void;
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
  private currentAction: PlayerAction = 'idle';
  private currentDirection: 'left' | 'right' = 'right';

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: { [key: string]: Phaser.Input.Keyboard.Key };
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private eKey!: Phaser.Input.Keyboard.Key;
  private joystickVector = { x: 0, y: 0 };
  private isActionHolding = false;

  private lastGridPos = { gridX: 0, gridY: 0 };
  private lastNearIsland: Island | null = null;
  private lastInteractTime = 0;
  private unbindInputs: Array<() => void> = [];

  constructor(ctx: IPlayerMovementContext) {
    this.ctx = ctx;
    this.pointerController = new PlayerPointerController({
      scene: ctx.scene,
      getInitialZoom: ctx.getInitialZoom,
      getPlayerPosition: () => this.getPosition(),
      getIslands: ctx.getIslands,
      getMonsterVisuals: ctx.getMonsterVisuals,
      findNearestEntityVisual: ctx.findNearestEntityVisual,
      onInteract: ctx.onInteract,
    });
  }

  public getPosition(): { x: number; y: number } {
    return {
      x: this.playerSprite?.x ?? 320,
      y: this.playerSprite?.y ?? 350,
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
    const startX = 320;
    const startY = 430;

    this.playerSprite = scene.physics.add.sprite(
      startX,
      startY,
      `${this.ctx.getPlayerColor()}PawnIdle`
    );
    this.playerSprite.setDisplaySize(128, 128);
    this.playerSprite.setCollideWorldBounds(true);
    this.playerSprite.setSize(36, 24);
    this.playerSprite.setOffset(78, 96);

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

    this.playAnimation('idle');
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

  public update(time: number): void {
    const speed = 250;
    let vx = 0;
    let vy = 0;

    if (this.cursors.left.isDown || this.wasdKeys.A?.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.wasdKeys.D?.isDown) vx += 1;
    if (this.cursors.up.isDown || this.wasdKeys.W?.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.wasdKeys.S?.isDown) vy += 1;

    if (Math.abs(this.joystickVector.x) > 0.05 || Math.abs(this.joystickVector.y) > 0.05) {
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
      const len = Math.hypot(vx, vy);
      const factor = Math.min(1, len);
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
    this.playerSprite.setDepth(ySortDepth(py, 24));
    this.playerNameTag.setPosition(px, py - 42).setDepth(ySortDepth(py, 30));
    this.playerIndicator.setPosition(px, py - 54).setDepth(ySortDepth(py, 30));

    const isHoldInput = this.spaceKey?.isDown || this.eKey?.isDown || this.isActionHolding;
    if (isHoldInput && time - this.lastInteractTime >= 240) {
      this.ctx.onInteract();
    }

    this.pointerController.updateZoom();
    this.checkTerritoryAndGridUpdates();
  }

  private checkTerritoryAndGridUpdates(): void {
    const px = this.playerSprite.x;
    const py = this.playerSprite.y;

    let nearLocked: Island | null = null;
    for (const isl of this.ctx.getIslands()) {
      if (!isl.unlocked) {
        const origin = getIslandOrigin(isl.gridX, isl.gridY);
        const signX = origin.x + 320;
        const signY = origin.y + 320;
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

    const gridX = Math.round((px - 320) / TERRITORY_STEP);
    const gridY = Math.round((py - 320) / TERRITORY_STEP);
    if (gridX !== this.lastGridPos.gridX || gridY !== this.lastGridPos.gridY) {
      this.lastGridPos = { gridX, gridY };
      GameEvents.emit('player-grid-pos-changed', { gridX, gridY });
    }
  }

  public destroy(): void {
    for (const unbind of this.unbindInputs) {
      unbind();
    }
    this.unbindInputs = [];
  }
}
