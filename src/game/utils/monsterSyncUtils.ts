import { Monster } from '../../types/game';
import { ActivePlayerTarget, CompactMonsterTuple } from '../../types/monsterSync';

export interface SyncTrackedMonsterState {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  dir: 0 | 1;
  targetTerritoryId: number;
  shieldHp: number;
}

export function createSyncTrackedState(m: Monster): SyncTrackedMonsterState {
  return {
    x: Math.round(m.x),
    y: Math.round(m.y),
    hp: Math.round(m.hp),
    maxHp: Math.round(m.maxHp),
    dir: m.direction === 'left' ? 0 : 1,
    targetTerritoryId: m.targetTerritoryId,
    shieldHp: Math.round(m.shieldHp ?? 0),
  };
}

export function hasMonsterSyncChanged(
  prev: SyncTrackedMonsterState | undefined,
  cur: Monster
): boolean {
  if (!prev) return true;
  const rx = Math.round(cur.x);
  const ry = Math.round(cur.y);
  const rhp = Math.round(cur.hp);
  const rmaxHp = Math.round(cur.maxHp);
  const dir: 0 | 1 = cur.direction === 'left' ? 0 : 1;
  const rShield = Math.round(cur.shieldHp ?? 0);

  if (
    prev.hp !== rhp ||
    prev.maxHp !== rmaxHp ||
    prev.dir !== dir ||
    prev.targetTerritoryId !== cur.targetTerritoryId ||
    prev.shieldHp !== rShield
  ) {
    return true;
  }

  return Math.abs(prev.x - rx) >= 2 || Math.abs(prev.y - ry) >= 2;
}

export function toCompactMonsterTuple(m: Monster): CompactMonsterTuple {
  return [
    m.id,
    Math.round(m.x),
    Math.round(m.y),
    Math.round(m.hp),
    Math.round(m.maxHp),
    m.direction === 'left' ? 0 : 1,
    m.targetTerritoryId,
    Math.round(m.shieldHp ?? 0),
  ];
}

export function roundMonsterSnapshotCoords(m: Monster): Monster {
  const rounded: Monster = {
    id: m.id,
    type: m.type,
    name: m.name,
    isBoss: m.isBoss,
    x: Math.round(m.x),
    y: Math.round(m.y),
    hp: Math.round(m.hp),
    maxHp: Math.round(m.maxHp),
    attack: m.attack,
    speed: m.speed,
    targetTerritoryId: m.targetTerritoryId,
    spawnTerritoryId: m.spawnTerritoryId,
    direction: m.direction,
  };
  if (m.role) rounded.role = m.role;
  if (m.isElite) rounded.isElite = true;
  if (m.eliteAffix) rounded.eliteAffix = m.eliteAffix;
  if (m.eliteTier) rounded.eliteTier = m.eliteTier;
  if (m.isCampMonster) rounded.isCampMonster = true;
  if (m.isFieldMonster) rounded.isFieldMonster = true;
  if (typeof m.campTerritoryId === 'number') rounded.campTerritoryId = m.campTerritoryId;
  if (m.campRing) rounded.campRing = m.campRing;
  if (m.fieldZone) rounded.fieldZone = m.fieldZone;
  if (typeof m.homeX === 'number' && Number.isFinite(m.homeX)) {
    rounded.homeX = Math.round(m.homeX);
  }
  if (typeof m.homeY === 'number' && Number.isFinite(m.homeY)) {
    rounded.homeY = Math.round(m.homeY);
  }
  if (typeof m.patrolRadiusPx === 'number') rounded.patrolRadiusPx = m.patrolRadiusPx;
  if (typeof m.expReward === 'number') rounded.expReward = m.expReward;
  if (m.bossTemplateId) rounded.bossTemplateId = m.bossTemplateId;
  if (m.bossSkillId) rounded.bossSkillId = m.bossSkillId;
  if (m.bossSpriteKey) rounded.bossSpriteKey = m.bossSpriteKey;
  if (typeof m.bossTintHex === 'number') rounded.bossTintHex = m.bossTintHex;
  if (typeof m.bossScale === 'number') rounded.bossScale = m.bossScale;
  if ((m.shieldHp ?? 0) > 0) {
    rounded.shieldHp = Math.round(m.shieldHp ?? 0);
    rounded.shieldMaxHp = Math.round(m.shieldMaxHp ?? m.shieldHp ?? 0);
  }
  return rounded;
}

export function chunkArray<T>(items: ReadonlyArray<T>, chunkSize: number): T[][] {
  if (items.length === 0) return [];
  const size = Math.max(1, chunkSize);
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

/**
 * 활성 플레이어 목록(로컬 + 원격 게스트) 중 몬스터가 추격/공격할 최적의 대상 선택 (순수 함수)
 * - 유효한 어그로 대상이 최대 반경 내에 살아있다면 우선 선택
 * - 그렇지 않으면 탐지 반경 내 가장 가까운 생존 플레이어 선택
 */
export function findTargetPlayerForMonster(
  mx: number,
  my: number,
  players: ReadonlyArray<ActivePlayerTarget>,
  maxRadius: number,
  preferredPlayerId?: string
): { player: ActivePlayerTarget; dist: number } | null {
  if (preferredPlayerId) {
    const preferred = players.find((p) => p.id === preferredPlayerId && !p.isFainted);
    if (preferred) {
      const dist = Math.hypot(preferred.x - mx, preferred.y - my);
      if (dist <= maxRadius) {
        return { player: preferred, dist };
      }
    }
  }

  let best: ActivePlayerTarget | null = null;
  let bestDist = maxRadius;

  for (const p of players) {
    if (p.isFainted) continue;
    const dist = Math.hypot(p.x - mx, p.y - my);
    if (dist <= bestDist) {
      bestDist = dist;
      best = p;
    }
  }

  return best ? { player: best, dist: bestDist } : null;
}
