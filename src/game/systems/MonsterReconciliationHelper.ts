import { MONSTER_SYNC_CONFIG } from '../../data/worldRules';

export interface MonsterDigestResult {
  count: number;
  digest: number;
}

interface LiveHpContainer {
  monster: { id: string; hp: number };
}

function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash === 0 ? 1 : hash;
}

/**
 * 살아있는(hp > 0) 몬스터 ID 집합의 순서 무관 32비트 다이제스트와 개수를 계산합니다.
 * 호스트·게스트 간 Map 삽입 순서가 달라도 동일 집합이면 항상 동일한 해시를 생성합니다.
 */
export function computeMonsterIdDigest(
  monsters: ReadonlyMap<string, LiveHpContainer>
): MonsterDigestResult {
  let count = 0;
  let xorAcc = 0;
  let sumAcc = 0;

  for (const [id, entry] of monsters.entries()) {
    if (entry.monster.hp <= 0) continue;
    count++;
    const h = fnv1a32(id);
    xorAcc = (xorAcc ^ h) >>> 0;
    sumAcc = (sumAcc + Math.imul(h, 0x9e3779b1)) >>> 0;
  }

  return {
    count,
    digest: count === 0 ? 0 : (xorAcc ^ sumAcc) >>> 0,
  };
}

/**
 * 최근 처치·제거된 몬스터 ID의 툼스톤을 TTL 동안 추적해
 * 모바일 지연/역순 패킷이 이미 죽은 몹을 고스트로 부활시키는 현상을 차단합니다.
 */
export class MonsterTombstoneTracker {
  private deadUntil = new Map<string, number>();

  public markDead(monsterId: string, now: number): void {
    this.deadUntil.set(monsterId, now + MONSTER_SYNC_CONFIG.killTombstoneTtlMs);
    if (this.deadUntil.size > 512) {
      this.prune(now);
    }
  }

  public revive(monsterId: string): void {
    this.deadUntil.delete(monsterId);
  }

  public isTombstoned(monsterId: string, now: number): boolean {
    const expiresAt = this.deadUntil.get(monsterId);
    if (expiresAt === undefined) return false;
    if (now >= expiresAt) {
      this.deadUntil.delete(monsterId);
      return false;
    }
    return true;
  }

  public prune(now: number): void {
    for (const [id, expiresAt] of this.deadUntil.entries()) {
      if (now >= expiresAt) {
        this.deadUntil.delete(id);
      }
    }
  }

  public clear(): void {
    this.deadUntil.clear();
  }
}

/**
 * hostEpoch 및 단조 증가 syncSeq 기반으로 구 호스트·역순 도착 패킷을 필터링합니다.
 * 동일 syncSeq를 공유하는 멀티 배치 델타(batchIndex 0..N-1)는 모두 통과시킵니다.
 */
export class SyncSequenceGuard {
  private lastHostEpoch = -1;
  private lastSyncSeq = -1;

  public reset(): void {
    this.lastHostEpoch = -1;
    this.lastSyncSeq = -1;
  }

  public canAccept(hostEpoch?: number, syncSeq?: number): boolean {
    const hasEpoch = typeof hostEpoch === 'number' && Number.isFinite(hostEpoch);
    const hasSeq = typeof syncSeq === 'number' && Number.isFinite(syncSeq);

    if (hasEpoch && this.lastHostEpoch >= 0) {
      if (hostEpoch < this.lastHostEpoch) {
        return false;
      }
      if (hostEpoch > this.lastHostEpoch) {
        return true;
      }
    }

    if (hasSeq && this.lastSyncSeq >= 0 && syncSeq < this.lastSyncSeq) {
      return false;
    }
    return true;
  }

  public commit(hostEpoch?: number, syncSeq?: number): void {
    const hasEpoch = typeof hostEpoch === 'number' && Number.isFinite(hostEpoch);
    const hasSeq = typeof syncSeq === 'number' && Number.isFinite(syncSeq);

    if (hasEpoch && hostEpoch > this.lastHostEpoch) {
      this.lastHostEpoch = hostEpoch;
      this.lastSyncSeq = hasSeq ? syncSeq : -1;
      return;
    }

    if (hasSeq && syncSeq > this.lastSyncSeq) {
      this.lastSyncSeq = syncSeq;
    }
  }

  public accept(hostEpoch?: number, syncSeq?: number): boolean {
    if (!this.canAccept(hostEpoch, syncSeq)) {
      return false;
    }
    this.commit(hostEpoch, syncSeq);
    return true;
  }
}
