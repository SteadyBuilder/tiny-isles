import Phaser from 'phaser';
import { PLAYER_DAMAGED_OVERLAY_CONFIG } from '../../data/combatFeedbackConfig';
import { PLAYER_COMBAT_CONFIG } from '../../data/worldRules';
import { sound } from '../../lib/sound';
import { PlayerHpState } from '../../types/game';
import { GameEvents } from '../events/gameEvents';

export interface IPlayerHealthContext {
  scene: Phaser.Scene;
  isSceneAlive: () => boolean;
  getPlayerPosition: () => { x: number; y: number };
  respawnPlayerAt: (x: number, y: number) => void;
  onPlayerFaintedVisual: (fainted: boolean) => void;
  onPlayerHitVisual: () => void;
  onPlayerDamagedShake?: () => void;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
}

/**
 * 플레이어 체력(HP), 피격, 기절 및 메인 마을 리스폰 전담 시스템
 */
export class PlayerHealthSystem {
  private ctx: IPlayerHealthContext;
  private hp: number = PLAYER_COMBAT_CONFIG.maxHp;
  private maxHp: number = PLAYER_COMBAT_CONFIG.maxHp;
  private fainted = false;
  private invincibleUntil = 0;
  private respawnTimer: Phaser.Time.TimerEvent | null = null;

  constructor(ctx: IPlayerHealthContext) {
    this.ctx = ctx;
  }

  public getState(): PlayerHpState {
    return {
      hp: this.hp,
      maxHp: this.maxHp,
      isFainted: this.fainted,
    };
  }

  public setMaxHp(newMaxHp: number, healDelta = 0): void {
    this.maxHp = Math.max(50, newMaxHp);
    this.hp = Math.min(this.maxHp, Math.max(1, this.hp + healDelta));
    this.emitState();
  }

  public healPlayer(amount: number): void {
    if (amount <= 0 || this.fainted) return;
    const prev = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const gained = this.hp - prev;
    if (gained > 0) {
      const { x, y } = this.ctx.getPlayerPosition();
      this.ctx.showFloatingText(x, y - 40, `💚 +${gained} HP`, '#4ade80');
      this.emitState();
    }
  }

  public isFainted(): boolean {
    return this.fainted;
  }

  public isInvincible(now: number): boolean {
    return now < this.invincibleUntil;
  }

  public grantTemporaryInvincibility(durationMs: number): void {
    if (!this.ctx.isSceneAlive() || durationMs <= 0) return;
    const targetUntil = this.ctx.scene.time.now + durationMs;
    if (targetUntil > this.invincibleUntil) {
      this.invincibleUntil = targetUntil;
    }
  }

  public emitState(): void {
    GameEvents.emit('player-hp-updated', this.getState());
  }

  public damagePlayer(damage: number, attackerName: string): void {
    if (damage <= 0 || this.fainted || !this.ctx.isSceneAlive()) return;
    const now = this.ctx.scene.time.now;
    if (now < this.invincibleUntil) return;

    this.hp = Math.max(0, this.hp - damage);
    const { x, y } = this.ctx.getPlayerPosition();

    this.ctx.onPlayerHitVisual();
    this.ctx.onPlayerDamagedShake?.();
    this.ctx.showFloatingText(x, y - 35, `💔 -${damage}`, '#f87171');
    sound.playBreak();

    const dmgRatio = damage / Math.max(1, this.maxHp);
    const intensity = Math.max(
      0.45,
      Math.min(1, dmgRatio / PLAYER_DAMAGED_OVERLAY_CONFIG.heavyDamageRatioThreshold)
    );
    GameEvents.emit('player-damaged-fx', {
      damage,
      intensity,
      timestamp: now,
    });
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(35);
    }

    this.emitState();

    if (this.hp <= 0) {
      this.handleFaint(attackerName);
    }
  }

  private handleFaint(attackerName: string): void {
    this.fainted = true;
    const { x, y } = this.ctx.getPlayerPosition();
    this.ctx.onPlayerFaintedVisual(true);
    this.ctx.showFloatingText(x, y - 55, '💫 기절!', '#fca5a5');
    GameEvents.emit('player-fainted');
    GameEvents.emit(
      'game-alert',
      `💫 ${attackerName}의 공격으로 기절했습니다! 중심 마을에서 리스폰됩니다.`
    );
    this.emitState();

    if (this.respawnTimer) {
      this.respawnTimer.remove(false);
    }
    this.respawnTimer = this.ctx.scene.time.delayedCall(
      PLAYER_COMBAT_CONFIG.faintRespawnDelayMs,
      () => {
        this.respawnTimer = null;
        this.respawnInMainVillage();
      }
    );
  }

  private respawnInMainVillage(): void {
    if (!this.ctx.isSceneAlive()) return;

    const { x, y } = PLAYER_COMBAT_CONFIG.mainVillageSpawn;
    this.fainted = false;
    this.hp = this.maxHp;
    this.invincibleUntil =
      this.ctx.scene.time.now + PLAYER_COMBAT_CONFIG.respawnInvincibleMs;

    this.ctx.onPlayerFaintedVisual(false);
    this.ctx.respawnPlayerAt(x, y);
    this.ctx.showFloatingText(x, y - 50, '✨ 중심 마을에서 부활!', '#4ade80');
    sound.playUnlock();

    this.emitState();
    GameEvents.emit('player-respawned');
  }

  public destroy(): void {
    if (this.respawnTimer) {
      this.respawnTimer.remove(false);
      this.respawnTimer = null;
    }
  }
}
