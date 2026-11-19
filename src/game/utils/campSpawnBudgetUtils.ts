export interface CampSpawnBudgetInput {
  desiredTotalCount: number;
  activeCampMonsterCount: number;
  maxActiveCampMonsters: number;
  maxMonstersPerCamp: number;
}

export interface CampSpawnBudgetResult {
  allowedTotalCount: number;
  countScaleRatio: number;
  /** 마릿수 상한으로 줄어든 만큼 체력·경험치에 환산 적용하는 보정 배율 */
  hpAndExpCompensationMult: number;
}

/**
 * 모바일 4인 환경에서 사냥 모드 동시 몬스터가 폭증하지 않도록
 * 부락별/전역 상한 내에서 스폰 마릿수를 제어하고, 줄어든 비율을 체력·경험치로 보정하는 순수 함수
 */
export function computeCappedCampSpawnBudget(
  input: CampSpawnBudgetInput
): CampSpawnBudgetResult {
  const desired = Math.max(1, Math.round(input.desiredTotalCount));
  const perCampCap = Math.max(4, Math.round(input.maxMonstersPerCamp));
  const globalRemaining = Math.max(
    4,
    Math.round(input.maxActiveCampMonsters - Math.max(0, input.activeCampMonsterCount))
  );

  const allowedTotalCount = Math.max(1, Math.min(desired, perCampCap, globalRemaining));
  const countScaleRatio = allowedTotalCount / desired;
  const hpAndExpCompensationMult = Number((desired / allowedTotalCount).toFixed(2));

  return {
    allowedTotalCount,
    countScaleRatio,
    hpAndExpCompensationMult,
  };
}
