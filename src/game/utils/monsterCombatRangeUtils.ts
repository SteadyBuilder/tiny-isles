import { DUNGEON_INVASION_CONFIG } from '../../data/monsterCamps';
import { PLAYER_COMBAT_CONFIG } from '../../data/worldRules';
import { MonsterCombatRole } from '../../types/game';

export interface MonsterAttackTimingState {
  lastAttackTime: number;
  firstAttackReadyAt?: number;
}

/**
 * 몬스터 병과 및 보스 여부에 따른 플레이어 대상 공격 사거리(px)를 데이터 설정에서 반환합니다.
 */
export function resolveMonsterPlayerAttackRange(
  role: MonsterCombatRole | undefined,
  isBoss?: boolean
): number {
  if (role === 'mage') return DUNGEON_INVASION_CONFIG.mageAttackRangePx;
  if (role === 'ranged') return DUNGEON_INVASION_CONFIG.rangedAttackRangePx;
  if (role === 'lancer') return PLAYER_COMBAT_CONFIG.monsterLancerPlayerAttackRange;
  if (isBoss) return PLAYER_COMBAT_CONFIG.monsterBossPlayerAttackRange;
  return PLAYER_COMBAT_CONFIG.monsterPlayerAttackRange;
}

/**
 * 몬스터가 사거리 밖으로 이탈했을 때 첫 타격 반응 유예 상태를 초기화합니다.
 */
export function resetMonsterAttackEntry(state: MonsterAttackTimingState): void {
  state.firstAttackReadyAt = undefined;
}

/**
 * 몬스터가 사거리에 진입한 상태일 때 첫 공격 유예 시간과 쿨다운을 모두 충족했는지 판정합니다.
 */
export function canMonsterStrikeInRange(
  state: MonsterAttackTimingState,
  time: number,
  cooldownMs: number,
  firstStrikeDelayMs: number = PLAYER_COMBAT_CONFIG.monsterFirstStrikeDelayMs
): boolean {
  if (state.firstAttackReadyAt === undefined) {
    state.firstAttackReadyAt = time + firstStrikeDelayMs;
  }
  return time >= state.firstAttackReadyAt && time - state.lastAttackTime >= cooldownMs;
}
