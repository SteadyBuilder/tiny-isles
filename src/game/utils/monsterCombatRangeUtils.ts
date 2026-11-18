import { DUNGEON_INVASION_CONFIG } from '../../data/monsterCamps';
import { PLAYER_COMBAT_CONFIG } from '../../data/worldRules';
import { MonsterCombatRole } from '../../types/game';

export interface MonsterAttackTimingState {
  lastAttackTime: number;
  firstAttackReadyAt?: number;
}

/**
 * 몬스터 병과 및 보스 여부에 따른 플레이어 대상 공격 사거리(px)를 데이터 설정에서 반환합니다.
 * - 보스 역시 자신의 직업(mage/ranged/lancer/melee)에 따라 근·중·원거리 사거리를 가집니다.
 */
export function resolveMonsterPlayerAttackRange(
  role: MonsterCombatRole | undefined,
  isBoss?: boolean
): number {
  if (role === 'mage') return isBoss ? DUNGEON_INVASION_CONFIG.mageAttackRangePx + 35 : DUNGEON_INVASION_CONFIG.mageAttackRangePx;
  if (role === 'ranged') return isBoss ? DUNGEON_INVASION_CONFIG.rangedAttackRangePx + 30 : DUNGEON_INVASION_CONFIG.rangedAttackRangePx;
  if (role === 'lancer') {
    return isBoss
      ? Math.max(PLAYER_COMBAT_CONFIG.monsterBossPlayerAttackRange + 14, PLAYER_COMBAT_CONFIG.monsterLancerPlayerAttackRange + 22)
      : PLAYER_COMBAT_CONFIG.monsterLancerPlayerAttackRange;
  }
  if (isBoss) return PLAYER_COMBAT_CONFIG.monsterBossPlayerAttackRange;
  return PLAYER_COMBAT_CONFIG.monsterPlayerAttackRange;
}

/**
 * 웨이브/던전 진격 몬스터의 성벽·건물·본진 공격 사거리(px)를 직업 및 보스 여부에 따라 반환합니다.
 */
export function resolveMonsterWaveAttackRange(
  role: MonsterCombatRole | undefined,
  defaultRange: number,
  isBoss?: boolean
): number {
  if (role === 'mage') return isBoss ? DUNGEON_INVASION_CONFIG.waveMageAttackRangePx + 30 : DUNGEON_INVASION_CONFIG.waveMageAttackRangePx;
  if (role === 'ranged') return isBoss ? DUNGEON_INVASION_CONFIG.waveRangedAttackRangePx + 25 : DUNGEON_INVASION_CONFIG.waveRangedAttackRangePx;
  if (role === 'lancer') {
    return isBoss
      ? Math.max(defaultRange + 24, PLAYER_COMBAT_CONFIG.monsterLancerPlayerAttackRange + 18)
      : Math.max(defaultRange, PLAYER_COMBAT_CONFIG.monsterLancerPlayerAttackRange);
  }
  if (isBoss) return Math.max(defaultRange, PLAYER_COMBAT_CONFIG.monsterBossPlayerAttackRange);
  return defaultRange;
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
