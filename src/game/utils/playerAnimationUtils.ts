import { PlayerAction } from '../../types/game';

const ONE_SHOT_ACTIONS = new Set<PlayerAction>(['axe', 'pickaxe', 'cast', 'hit']);

/**
 * 단발성(1회 재생 후 idle/run으로 복귀해야 하는) 플레이어 액션인지 판별합니다.
 */
export function isOneShotPlayerAction(action: PlayerAction): boolean {
  return ONE_SHOT_ACTIONS.has(action);
}

/**
 * 현재 액션 상태에서 피격(hit) 모션으로 전환해도 되는지 판별합니다.
 * 공격·채집·스킬 시전·기절 중에는 모션이 끊기지 않도록 hit 모션 전환을 생략합니다.
 */
export function canPlayHitAnimation(currentAction: PlayerAction): boolean {
  return (
    currentAction !== 'axe' &&
    currentAction !== 'pickaxe' &&
    currentAction !== 'cast' &&
    currentAction !== 'stun'
  );
}

/**
 * 단발성 애니메이션의 기본 길이(naturalDurationMs)가 목표 액션 주기(targetDurationMs)보다 길 때
 * 다음 액션 시작 전 모션이 깔끔히 완주되도록 재생 배속(timeScale)을 계산합니다.
 */
export function computeOneShotAnimTimeScale(
  naturalDurationMs: number,
  targetDurationMs?: number
): number {
  if (
    !targetDurationMs ||
    targetDurationMs <= 0 ||
    !Number.isFinite(naturalDurationMs) ||
    naturalDurationMs <= 0
  ) {
    return 1;
  }

  // 다음 쿨타임 직전 약 8% 여유를 두고 완료되도록 보정
  const completionBudgetMs = targetDurationMs * 0.92;
  if (naturalDurationMs <= completionBudgetMs) {
    return 1;
  }

  return Math.min(3, Math.max(1, naturalDurationMs / completionBudgetMs));
}

/**
 * 단발성 애니메이션 완료 후 플레이어 상태에 맞는 복귀 액션을 결정합니다.
 */
export function resolvePostOneShotAction(isFainted: boolean, isMoving: boolean): PlayerAction {
  if (isFainted) return 'stun';
  return isMoving ? 'run' : 'idle';
}

export interface PlayerSpriteMetrics {
  displayWidth: number;
  displayHeight: number;
  bodyWidth: number;
  bodyHeight: number;
  offsetX: number;
  offsetY: number;
}

const STANDARD_FRAME_THRESHOLD_PX = 256;
const STANDARD_DISPLAY_SIZE_PX = 128;
const LANCER_DISPLAY_SIZE_PX = 164;
const PLAYER_WORLD_BODY_WIDTH_PX = 24;
const PLAYER_WORLD_BODY_HEIGHT_PX = 16;
const PLAYER_FOOT_ANCHOR_Y_RATIO = 108 / 192; // 0.5625 (192px 프레임 기준 발 중앙 y=108)

/**
 * 현재 바인딩된 스프라이트 프레임 크기(192x192 또는 창병 320x320)를 기준으로
 * 일관된 화면 표시 크기와 성벽 문(88px) 통과가 원활한 24x16 월드 물리 콜라이더를 계산합니다.
 */
export function computePlayerSpriteMetrics(
  frameWidth: number,
  frameHeight: number
): PlayerSpriteMetrics {
  const safeW = Number.isFinite(frameWidth) && frameWidth > 0 ? frameWidth : 192;
  const safeH = Number.isFinite(frameHeight) && frameHeight > 0 ? frameHeight : 192;
  const isLargeSheet = Math.max(safeW, safeH) >= STANDARD_FRAME_THRESHOLD_PX;
  const targetDisplaySize = isLargeSheet ? LANCER_DISPLAY_SIZE_PX : STANDARD_DISPLAY_SIZE_PX;

  const scaleX = targetDisplaySize / safeW;
  const scaleY = targetDisplaySize / safeH;

  const bodyWidth = PLAYER_WORLD_BODY_WIDTH_PX / scaleX;
  const bodyHeight = PLAYER_WORLD_BODY_HEIGHT_PX / scaleY;
  const offsetX = safeW / 2 - bodyWidth / 2;
  const offsetY = safeH * PLAYER_FOOT_ANCHOR_Y_RATIO - bodyHeight / 2;

  return {
    displayWidth: targetDisplaySize,
    displayHeight: targetDisplaySize,
    bodyWidth,
    bodyHeight,
    offsetX,
    offsetY,
  };
}

