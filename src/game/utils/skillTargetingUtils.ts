import { PlayerClassDefinition } from '../../types/hunting';

export interface ClampedSkillTarget {
  x: number;
  y: number;
  distance: number;
  isClamped: boolean;
}

/**
 * 해당 클래스의 액티브 스킬이 지점 지정(Ground-Targeted) 방식인지 판별합니다.
 */
export function isGroundTargetedClass(
  classDef: Pick<PlayerClassDefinition, 'skillTargetingMode'>
): boolean {
  return classDef.skillTargetingMode === 'ground';
}

/**
 * 메타 업그레이드 등의 보너스를 반영한 최종 스킬 최대 시전 사거리(px)를 계산합니다.
 */
export function computeEffectiveSkillCastRange(
  classDef: Pick<PlayerClassDefinition, 'skillCastRange' | 'skillRadius'>,
  bonusSkillRadiusPx = 0
): number {
  const baseRange = classDef.skillCastRange ?? classDef.skillRadius;
  return Math.max(0, baseRange + Math.max(0, bonusSkillRadiusPx));
}

/**
 * 지정 지점이 최대 시전 사거리를 초과할 경우 시전자→포인터 방향의 경계 좌표로 보정(Clamp)합니다.
 */
export function clampTargetToCastRange(
  casterX: number,
  casterY: number,
  pointerX: number,
  pointerY: number,
  maxCastRange: number
): ClampedSkillTarget {
  const safeMaxRange = Math.max(0, maxCastRange);
  const dx = pointerX - casterX;
  const dy = pointerY - casterY;
  const dist = Math.hypot(dx, dy);

  if (dist <= safeMaxRange || dist === 0) {
    return {
      x: pointerX,
      y: pointerY,
      distance: dist,
      isClamped: false,
    };
  }

  const ratio = safeMaxRange / dist;
  return {
    x: casterX + dx * ratio,
    y: casterY + dy * ratio,
    distance: safeMaxRange,
    isClamped: true,
  };
}
