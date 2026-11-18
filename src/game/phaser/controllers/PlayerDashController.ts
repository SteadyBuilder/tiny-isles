import Phaser from 'phaser';
import { PLAYER_DASH_CONFIG } from '../../../data/combatFeedbackConfig';
import { PERFORMANCE_CONFIG } from '../../../data/performanceConfig';
import { sound } from '../../../lib/sound';
import { DashCooldownState } from '../../../types/combat';
import { DEPTH, ySortDepth } from '../../depthLayers';
import { GameEvents } from '../../events/gameEvents';
import { PhaserFxPool } from '../utils/fxObjectPool';

export interface IPlayerDashContext {
  scene: Phaser.Scene;
  isSceneAlive: () => boolean;
  isPlayerFainted: () => boolean;
  grantDashInvincibility: (durationMs: number) => void;
}

/**
 * 플레이어 순간 대시(회피기) 돌진 이동, 무적(i-frame), 쿨타임, 잔상·먼지 연출 전담 컨트롤러
 */
export class PlayerDashController {
  private ctx: IPlayerDashContext;
  private fxPool: PhaserFxPool;
  private isDashing = false;
  private dashRemainingMs = 0;
  private dashSpeedPx: number = PLAYER_DASH_CONFIG.minDashSpeedPx;
  private dashDirX = 1;
  private dashDirY = 0;
  private cooldownRemainingMs = 0;
  private afterimageAccumMs = 0;
  private lastUiEmitBucket = -1;

  constructor(ctx: IPlayerDashContext) {
    this.ctx = ctx;
    this.fxPool = new PhaserFxPool(ctx.scene, ctx.isSceneAlive);
  }

  public getIsDashing(): boolean {
    return this.isDashing;
  }

  public getState(): DashCooldownState {
    return {
      cooldownRemainingMs: Math.max(0, Math.ceil(this.cooldownRemainingMs)),
      cooldownMaxMs: PLAYER_DASH_CONFIG.cooldownMs,
      isDashing: this.isDashing,
    };
  }

  public emitState(): void {
    GameEvents.emit('dash-state-updated', this.getState());
  }

  public tryStartDash(params: {
    inputDirX: number;
    inputDirY: number;
    facing: 'left' | 'right';
    moveSpeed: number;
    playerSprite: Phaser.Physics.Arcade.Sprite;
  }): boolean {
    if (
      this.isDashing ||
      this.cooldownRemainingMs > 0 ||
      this.ctx.isPlayerFainted() ||
      !this.ctx.isSceneAlive()
    ) {
      return false;
    }

    const { inputDirX, inputDirY, facing, moveSpeed, playerSprite } = params;
    const mag = Math.hypot(inputDirX, inputDirY);
    if (mag > 0.05) {
      this.dashDirX = inputDirX / mag;
      this.dashDirY = inputDirY / mag;
    } else {
      this.dashDirX = facing === 'left' ? -1 : 1;
      this.dashDirY = 0;
    }

    this.dashSpeedPx = Math.max(
      PLAYER_DASH_CONFIG.minDashSpeedPx,
      moveSpeed * PLAYER_DASH_CONFIG.speedMultiplier
    );
    this.dashRemainingMs = PLAYER_DASH_CONFIG.durationMs;
    this.cooldownRemainingMs = PLAYER_DASH_CONFIG.cooldownMs;
    this.isDashing = true;
    this.afterimageAccumMs = PLAYER_DASH_CONFIG.afterimageIntervalMs;

    this.ctx.grantDashInvincibility(PLAYER_DASH_CONFIG.invincibleMs);
    sound.playDash();

    if (this.dashDirX < -0.05) playerSprite.setFlipX(true);
    else if (this.dashDirX > 0.05) playerSprite.setFlipX(false);

    playerSprite.setAlpha(0.8);
    playerSprite.setTint(0xbae6fd);
    this.spawnDustPuff(playerSprite.x, playerSprite.y + 18);
    this.spawnAfterimage(playerSprite, 0x38bdf8);

    this.emitState();
    return true;
  }

  /**
   * 드래곤 랜서 스킬 등 강제 고속 돌진 연출 공용 임펄스 (대시 쿨타임과 독립)
   */
  public startForcedSurge(params: {
    dirX: number;
    dirY: number;
    speedPx: number;
    durationMs: number;
    playerSprite: Phaser.Physics.Arcade.Sprite;
    tint?: number;
  }): void {
    if (this.ctx.isPlayerFainted() || !this.ctx.isSceneAlive()) return;
    const mag = Math.max(0.001, Math.hypot(params.dirX, params.dirY));
    this.dashDirX = params.dirX / mag;
    this.dashDirY = params.dirY / mag;
    this.dashSpeedPx = params.speedPx;
    this.dashRemainingMs = params.durationMs;
    this.isDashing = true;
    this.afterimageAccumMs = 28;
    this.ctx.grantDashInvincibility(params.durationMs + 80);

    params.playerSprite.setTint(params.tint ?? 0x22d3ee);
    this.spawnDustPuff(params.playerSprite.x, params.playerSprite.y + 16);
    this.spawnAfterimage(params.playerSprite, params.tint ?? 0x22d3ee);
  }

  public update(deltaMs: number, playerSprite: Phaser.Physics.Arcade.Sprite): boolean {
    if (this.cooldownRemainingMs > 0) {
      this.cooldownRemainingMs = Math.max(0, this.cooldownRemainingMs - deltaMs);
      const bucket = Math.ceil(this.cooldownRemainingMs / PERFORMANCE_CONFIG.cooldownUiBucketMs);
      if (bucket !== this.lastUiEmitBucket || this.cooldownRemainingMs === 0) {
        this.lastUiEmitBucket = bucket;
        this.emitState();
      }
    }

    if (!this.isDashing) return false;

    this.dashRemainingMs -= deltaMs;
    this.afterimageAccumMs += deltaMs;

    playerSprite.setVelocity(
      this.dashDirX * this.dashSpeedPx,
      this.dashDirY * this.dashSpeedPx
    );

    if (this.afterimageAccumMs >= PLAYER_DASH_CONFIG.afterimageIntervalMs) {
      this.afterimageAccumMs = 0;
      this.spawnAfterimage(playerSprite, 0x7dd3fc);
    }

    if (this.dashRemainingMs <= 0) {
      this.finishDash(playerSprite);
      return false;
    }
    return true;
  }

  public cancelDash(playerSprite?: Phaser.Physics.Arcade.Sprite): void {
    if (!this.isDashing) return;
    this.isDashing = false;
    this.dashRemainingMs = 0;
    if (playerSprite?.active) {
      playerSprite.setAlpha(1);
      playerSprite.clearTint();
    }
    this.emitState();
  }

  private finishDash(playerSprite: Phaser.Physics.Arcade.Sprite): void {
    this.isDashing = false;
    this.dashRemainingMs = 0;
    if (playerSprite.active && !this.ctx.isPlayerFainted()) {
      playerSprite.setAlpha(1);
      playerSprite.clearTint();
      this.spawnDustPuff(playerSprite.x, playerSprite.y + 18);
    }
    this.emitState();
  }

  private spawnAfterimage(playerSprite: Phaser.Physics.Arcade.Sprite, tint: number): void {
    const { scene } = this.ctx;
    if (!this.ctx.isSceneAlive() || !playerSprite.active) return;

    const frameName = playerSprite.frame?.name;
    const ghost = this.fxPool.acquireImage(
      playerSprite.texture.key,
      playerSprite.x,
      playerSprite.y,
      ySortDepth(playerSprite.y, 20),
      frameName
    );
    if (!ghost) return;
    ghost.setDisplaySize(playerSprite.displayWidth, playerSprite.displayHeight);
    ghost.setFlipX(playerSprite.flipX);
    ghost.setTint(tint);
    ghost.setAlpha(0.58);

    scene.tweens.add({
      targets: ghost,
      alpha: 0,
      scaleX: ghost.scaleX * 0.92,
      scaleY: ghost.scaleY * 0.92,
      duration: 185,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.fxPool.releaseImage(ghost);
      },
    });
  }

  private spawnDustPuff(x: number, y: number): void {
    this.fxPool.playSpriteAnim({
      texKey: 'dustFx2',
      animKey: 'dust2_anim',
      x,
      y,
      width: 76,
      depth: DEPTH.SLASH,
      alpha: 0.85,
      skipIfOffscreen: false,
    });
  }

  public destroy(): void {
    this.fxPool.destroy();
  }
}
