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
