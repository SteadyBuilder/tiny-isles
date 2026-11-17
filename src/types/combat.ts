import { PlayerClassId } from './hunting';

/**
 * 대시(회피기) 쿨타임 및 활성 상태 UI 동기화 계약
 */
export interface DashCooldownState {
  cooldownRemainingMs: number;
  cooldownMaxMs: number;
  isDashing: boolean;
}

/**
 * 플레이어 피격 화면 연출 페이로드
 */
export interface PlayerDamagedFxPayload {
  damage: number;
  intensity: number; // 0.35 ~ 1.0
  timestamp: number;
}

/**
 * 전투 타격 피드백 옵션
 */
export interface CombatHitFeedbackOptions {
  x: number;
  y: number;
  damage: number;
  isCrit?: boolean;
  isSkill?: boolean;
  isLocalPlayerAttack?: boolean;
  attackerX?: number;
  attackerY?: number;
  targetSprite?: Phaser.GameObjects.Sprite;
  targetContainer?: Phaser.GameObjects.Container;
}

/**
 * 클래스별 액티브 스킬 비주얼 연출 요청 계약
 */
export interface SkillEffectContext {
  classId: PlayerClassId;
  casterX: number;
  casterY: number;
  facingDir: 'left' | 'right';
  radius: number;
  targetPoints?: ReadonlyArray<{ x: number; y: number }>;
  onImpact?: () => void;
}
