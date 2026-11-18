import { Monster, MonsterCombatRole } from './game';
import { FieldEliteTier } from './hunting';

/**
 * 호스트 AI가 추격/공격 대상으로 삼을 수 있는 활성 플레이어 위치 정보
 */
export interface ActivePlayerTarget {
  id: string;
  x: number;
  y: number;
  isFainted: boolean;
}

/**
 * 실시간 델타 동기화용 초경량 몬스터 상태 튜플
 * [id, x, y, hp, maxHp, dir(0=left,1=right), targetTerritoryId, shieldHp]
 */
export type CompactMonsterTuple = [
  id: string,
  x: number,
  y: number,
  hp: number,
  maxHp: number,
  dir: 0 | 1,
  targetTerritoryId: number,
  shieldHp: number
];

export interface MonsterKillSyncPayload {
  id: string;
  x: number;
  y: number;
  killerId?: string;
  isBoss: boolean;
  isElite: boolean;
  isCampMonster: boolean;
  isFieldMonster: boolean;
  campRing?: 1 | 2 | 3 | 4;
  eliteTier?: FieldEliteTier;
  expReward: number;
  bonusMultiplier: number;
}

export interface MonstersFullSyncPayload {
  monsters: Monster[];
  waveCount: number;
  bossWaveCount: number;
  syncId?: string;
  chunkIndex?: number;
  totalChunks?: number;
}

export interface MonstersDeltaSyncPayload {
  updates: CompactMonsterTuple[];
  spawns: Monster[];
  kills: MonsterKillSyncPayload[];
  removedIds: string[];
  totalMonsterCount: number;
  waveCount: number;
  bossWaveCount: number;
}

export interface MonsterHitPayload {
  monsterId: string;
  damage: number;
  attackerName: string;
  attackerId?: string;
  isCrit?: boolean;
  isSkill?: boolean;
}

export interface MonsterPlayerAttackPayload {
  targetPlayerId: string;
  monsterId: string;
  monsterName: string;
  role: MonsterCombatRole;
  damage: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  isBossSkill?: boolean;
  telegraphRadius?: number;
  telegraphDurationMs?: number;
  telegraphColor?: number;
}
