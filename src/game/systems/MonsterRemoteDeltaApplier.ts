import type Phaser from 'phaser';
import { MONSTER_SYNC_CONFIG } from '../../data/worldRules';
import { Monster } from '../../types/game';
import {
  MonsterKillSyncPayload,
  MonstersDeltaSyncPayload,
  MonstersFullSyncPayload,
} from '../../types/monsterSync';
import { setDepthIfChanged, ySortDepth } from '../depthLayers';
import {
  MonsterTombstoneTracker,
  SyncSequenceGuard,
  computeMonsterIdDigest,
} from './MonsterReconciliationHelper';
import { MonsterVisual, MonsterVisualManager } from './MonsterVisualManager';

interface PendingFullSyncBatch {
  totalChunks: number;
  chunks: Map<number, Monster[]>;
  createdAt: number;
  hostEpoch?: number;
  syncSeq?: number;
}

interface DeferredAuthoritativeHp {
  hp: number;
  maxHp: number;
  applyAfter: number;
}

export interface RemoteDeltaApplyCallbacks {
  onExplosion: (x: number, y: number) => void;
  onShake: (target: Phaser.GameObjects.Container) => void;
  onRemoteKill: (kill: MonsterKillSyncPayload, visual?: MonsterVisual) => void;
}

/**
 * 게스트 측 멀티플레이 몬스터 수신 전담 모듈
 * - 전체 청크 재조립(TTL 만료 정리 및 epoch/seq 필터링)
 * - 델타 패킷 적용, 툼스톤 부활 차단, hp<=0 즉시 소거, 피격 유예 보호 및 ID 다이제스트 정합
 * - 원격 좌표 스냅/선형 보간
 */
export class MonsterRemoteDeltaApplier {
  private incomingFullSyncBatches = new Map<string, PendingFullSyncBatch>();
  private remoteTargets = new Map<string, { x: number; y: number }>();
  private localHitGraceUntil = new Map<string, number>();
  private deferredAuthoritativeHps = new Map<string, DeferredAuthoritativeHp>();
  private tombstones = new MonsterTombstoneTracker();
  private seqGuard = new SyncSequenceGuard();
  private countMismatchStreak = 0;

  public resetAll(): void {
    this.incomingFullSyncBatches.clear();
    this.tombstones.clear();
    this.seqGuard.reset();
    this.clearTransientSyncState();
  }

  public resetSequenceGuard(): void {
    this.incomingFullSyncBatches.clear();
    this.seqGuard.reset();
    this.countMismatchStreak = 0;
  }

  private clearTransientSyncState(): void {
    this.remoteTargets.clear();
    this.localHitGraceUntil.clear();
    this.deferredAuthoritativeHps.clear();
    this.countMismatchStreak = 0;
  }

  public markLocalHit(monsterId: string): void {
    this.localHitGraceUntil.set(
      monsterId,
      performance.now() + MONSTER_SYNC_CONFIG.localHitHpGraceMs
    );
  }

  public setRemoteTarget(monsterId: string, x: number, y: number): void {
    if (!monsterId) return;
    this.remoteTargets.set(monsterId, { x, y });
  }

  private applyShieldState(
    m: Monster,
    shieldHp: number,
    maxHpHint: number | undefined,
    now: number
  ): number {
    const prevShieldHp = m.shieldHp ?? 0;
    if (shieldHp > 0) {
      m.shieldHp = shieldHp;
      m.shieldMaxHp = Math.max(m.shieldMaxHp ?? 0, maxHpHint ?? 0, shieldHp);
      m.shieldUntil = now + 5000;
    } else if (prevShieldHp > 0) {
      m.shieldHp = 0;
      m.shieldUntil = 0;
    }
    return prevShieldHp;
  }

  private applyAuthoritativeHp(
    mv: MonsterVisual,
    hp: number,
    maxHp: number,
    prevShieldHp: number,
    shieldHp: number,
    callbacks: RemoteDeltaApplyCallbacks
  ): void {
    const m = mv.monster;
    const prevHp = m.hp;
    m.maxHp = maxHp;
    m.hp = hp;
    if (hp < prevHp) {
      callbacks.onShake(mv.container);
      MonsterVisualManager.updateHpBar(mv, true);
    } else if (hp !== prevHp || shieldHp !== prevShieldHp) {
      MonsterVisualManager.updateHpBar(mv, false);
    }
  }

  private disposeMonsterEntry(
    id: string,
    monsters: Map<string, MonsterVisual>,
    now: number,
    onExplosion?: (x: number, y: number) => void
  ): MonsterVisual | undefined {
    const mv = monsters.get(id);
    if (mv) {
      onExplosion?.(mv.container.x, mv.container.y);
      MonsterVisualManager.disposeVisual(mv);
      monsters.delete(id);
    }
    this.tombstones.markDead(id, now);
    this.remoteTargets.delete(id);
    this.localHitGraceUntil.delete(id);
    this.deferredAuthoritativeHps.delete(id);
    return mv;
  }

  private flushDeferredAuthoritativeHps(monsters: Map<string, MonsterVisual>): void {
    if (this.deferredAuthoritativeHps.size === 0) return;
    const now = performance.now();
    for (const [id, deferred] of this.deferredAuthoritativeHps.entries()) {
      const effectiveUntil = Math.max(deferred.applyAfter, this.localHitGraceUntil.get(id) ?? 0);
      if (now < effectiveUntil) continue;
      this.deferredAuthoritativeHps.delete(id);
      this.localHitGraceUntil.delete(id);
      const mv = monsters.get(id);
      if (!mv || mv.monster.hp <= 0) continue;
      const prevHp = mv.monster.hp;
      mv.monster.maxHp = deferred.maxHp;
      mv.monster.hp = deferred.hp;
      if (deferred.hp !== prevHp) {
        MonsterVisualManager.updateHpBar(mv, deferred.hp < prevHp);
      }
    }
  }

  private pruneExpiredFullSyncBatches(now: number): void {
    for (const [id, entry] of this.incomingFullSyncBatches.entries()) {
      if (now - entry.createdAt > MONSTER_SYNC_CONFIG.fullSyncBatchTtlMs) {
        this.incomingFullSyncBatches.delete(id);
      }
    }
  }

  private pruneOlderFullSyncBatches(hostEpoch?: number, syncSeq?: number): void {
    for (const [id, entry] of this.incomingFullSyncBatches.entries()) {
      const olderEpoch =
        typeof hostEpoch === 'number' &&
        typeof entry.hostEpoch === 'number' &&
        entry.hostEpoch < hostEpoch;
      const sameOrUnknownEpoch =
        hostEpoch === undefined ||
        entry.hostEpoch === undefined ||
        entry.hostEpoch === hostEpoch;
      const olderSeq =
        sameOrUnknownEpoch &&
        typeof syncSeq === 'number' &&
        typeof entry.syncSeq === 'number' &&
        entry.syncSeq <= syncSeq;
      if (olderEpoch || olderSeq) {
        this.incomingFullSyncBatches.delete(id);
      }
    }
  }

  public receiveFullSyncChunk(
    payload: MonstersFullSyncPayload
  ): { ready: boolean; monsters: Monster[] } {
    const now = performance.now();
    this.pruneExpiredFullSyncBatches(now);

    if (!this.seqGuard.canAcceptFullSync(payload.hostEpoch, payload.syncSeq)) {
      return { ready: false, monsters: [] };
    }

    const total = payload.totalChunks ?? 1;
    if (total <= 1 || !payload.syncId) {
      const liveMonsters = (payload.monsters || []).filter((m) => m.hp > 0);
      this.seqGuard.commitFullSync(payload.hostEpoch, payload.syncSeq);
      this.pruneOlderFullSyncBatches(payload.hostEpoch, payload.syncSeq);
      this.clearTransientSyncState();
      this.tombstones.prune(now);
      for (const m of liveMonsters) this.tombstones.revive(m.id);
      return { ready: true, monsters: liveMonsters };
    }

    const syncId = payload.syncId;
    const chunkIdx = payload.chunkIndex ?? 0;

    if (this.incomingFullSyncBatches.size > 3) {
      const oldestKey = this.incomingFullSyncBatches.keys().next().value;
      if (oldestKey && oldestKey !== syncId) {
        this.incomingFullSyncBatches.delete(oldestKey);
      }
    }

    let batch = this.incomingFullSyncBatches.get(syncId);
    if (!batch) {
      batch = {
        totalChunks: total,
        chunks: new Map(),
        createdAt: now,
        hostEpoch: payload.hostEpoch,
        syncSeq: payload.syncSeq,
      };
      this.incomingFullSyncBatches.set(syncId, batch);
    }
    batch.chunks.set(chunkIdx, payload.monsters || []);

    if (batch.chunks.size < batch.totalChunks) {
      return { ready: false, monsters: [] };
    }

    this.incomingFullSyncBatches.delete(syncId);
    const merged: Monster[] = [];
    for (let i = 0; i < batch.totalChunks; i++) {
      const part = batch.chunks.get(i);
      if (!part) continue;
      for (const m of part) {
        if (m.hp > 0) merged.push(m);
      }
    }
    this.seqGuard.commitFullSync(batch.hostEpoch, batch.syncSeq);
    this.pruneOlderFullSyncBatches(batch.hostEpoch, batch.syncSeq);
    this.clearTransientSyncState();
    this.tombstones.prune(now);
    for (const m of merged) this.tombstones.revive(m.id);
    return { ready: true, monsters: merged };
  }

  public applyDeltaSync(
    scene: Phaser.Scene,
    monsters: Map<string, MonsterVisual>,
    payload: MonstersDeltaSyncPayload,
    callbacks: RemoteDeltaApplyCallbacks
  ): {
    needsFullSync: boolean;
    digestMismatch: boolean;
    missingIds: string[];
    killedCount: number;
    spawnedCount: number;
  } {
    if (!this.seqGuard.acceptDelta(payload.hostEpoch, payload.syncSeq)) {
      return {
        needsFullSync: false,
        digestMismatch: false,
        missingIds: [],
        killedCount: 0,
        spawnedCount: 0,
      };
    }

    const now = performance.now();
    let killedCount = 0;
    let spawnedCount = 0;

    for (const kill of payload.kills || []) {
      const alreadyDeadAndMissing =
        !monsters.has(kill.id) && this.tombstones.isTombstoned(kill.id, now);
      if (alreadyDeadAndMissing) continue;

      const mv = this.disposeMonsterEntry(kill.id, monsters, now, callbacks.onExplosion);
      if (!mv) {
        callbacks.onExplosion(kill.x, kill.y);
      }
      callbacks.onRemoteKill(kill, mv);
      killedCount++;
    }

    for (const removedId of payload.removedIds || []) {
      const mv = this.disposeMonsterEntry(removedId, monsters, now, callbacks.onExplosion);
      if (mv) {
        killedCount++;
      }
    }

    const snapDistSq =
      MONSTER_SYNC_CONFIG.remoteSnapThresholdPx * MONSTER_SYNC_CONFIG.remoteSnapThresholdPx;

    for (const sp of payload.spawns || []) {
      if (sp.hp <= 0 || this.tombstones.isTombstoned(sp.id, now)) continue;
      const existing = monsters.get(sp.id);
      if (existing) {
        const m = existing.monster;
        const nextShield = sp.shieldHp ?? 0;
        const prevShieldHp = this.applyShieldState(m, nextShield, sp.shieldMaxHp, now);
        const dx = sp.x - m.x;
        const dy = sp.y - m.y;
        const distSq = dx * dx + dy * dy;
        m.direction = sp.direction;
        m.targetTerritoryId = sp.targetTerritoryId;
        if (distSq > 0.25 && distSq <= snapDistSq) {
          this.remoteTargets.set(sp.id, { x: sp.x, y: sp.y });
        } else {
          m.x = sp.x;
          m.y = sp.y;
          existing.container.setPosition(sp.x, sp.y);
          setDepthIfChanged(existing.container, ySortDepth(sp.y, 28));
          this.remoteTargets.delete(sp.id);
        }
        existing.sprite.setFlipX(sp.direction === 'left');
        this.localHitGraceUntil.delete(sp.id);
        this.deferredAuthoritativeHps.delete(sp.id);
        this.applyAuthoritativeHp(existing, sp.hp, sp.maxHp, prevShieldHp, nextShield, callbacks);
      } else {
        monsters.set(sp.id, MonsterVisualManager.create(scene, { ...sp }));
        this.remoteTargets.delete(sp.id);
        spawnedCount++;
      }
    }

    const missingIdSet = new Set<string>();
    for (const tuple of payload.updates || []) {
      const [id, x, y, hp, maxHp, dirCode, targetTerritoryId, shieldHp] = tuple;
      if (hp <= 0) {
        const disposed = this.disposeMonsterEntry(id, monsters, now, callbacks.onExplosion);
        if (disposed) killedCount++;
        continue;
      }

      const mv = monsters.get(id);
      if (!mv) {
        if (!this.tombstones.isTombstoned(id, now)) {
          missingIdSet.add(id);
        }
        continue;
      }

      const m = mv.monster;
      this.remoteTargets.set(id, { x, y });
      m.direction = dirCode === 0 ? 'left' : 'right';
      m.targetTerritoryId = targetTerritoryId;
      mv.sprite.setFlipX(m.direction === 'left');

      const prevShieldHp = this.applyShieldState(m, shieldHp, undefined, now);
      const graceUntil = this.localHitGraceUntil.get(id) ?? 0;
      if (hp <= m.hp || now >= graceUntil) {
        this.deferredAuthoritativeHps.delete(id);
        if (now >= graceUntil) this.localHitGraceUntil.delete(id);
        this.applyAuthoritativeHp(mv, hp, maxHp, prevShieldHp, shieldHp, callbacks);
      } else {
        this.deferredAuthoritativeHps.set(id, { hp, maxHp, applyAfter: graceUntil });
        if (shieldHp !== prevShieldHp) {
          MonsterVisualManager.updateHpBar(mv, false);
        }
      }
    }

    const totalBatches = payload.totalBatches ?? 1;
    const batchIndex = payload.batchIndex ?? 0;
    const isFinalBatch = totalBatches <= 1 || batchIndex >= totalBatches - 1;

    if (isFinalBatch && typeof payload.totalMonsterCount === 'number') {
      const localDigest = computeMonsterIdDigest(monsters);
      const countMatches = localDigest.count === payload.totalMonsterCount;
      const digestMatches =
        payload.liveMonsterDigest === undefined || localDigest.digest === payload.liveMonsterDigest;
      if (!countMatches || !digestMatches) {
        this.countMismatchStreak++;
      } else {
        this.countMismatchStreak = 0;
      }
    }

    const missingIds = Array.from(missingIdSet);
    const digestMismatch =
      this.countMismatchStreak >= MONSTER_SYNC_CONFIG.digestMismatchTriggerCount;
    return {
      needsFullSync: missingIds.length > 0 || digestMismatch,
      digestMismatch,
      missingIds,
      killedCount,
      spawnedCount,
    };
  }

  public interpolateRemoteMonsters(
    monsters: Map<string, MonsterVisual>,
    deltaMs: number
  ): void {
    this.flushDeferredAuthoritativeHps(monsters);
    if (this.remoteTargets.size === 0) return;

    const alpha = Math.min(1, (MONSTER_SYNC_CONFIG.remoteLerpSpeedPerSec * deltaMs) / 1000);
    const snapDistSq =
      MONSTER_SYNC_CONFIG.remoteSnapThresholdPx * MONSTER_SYNC_CONFIG.remoteSnapThresholdPx;

    for (const [id, target] of this.remoteTargets.entries()) {
      const mv = monsters.get(id);
      if (!mv) {
        this.remoteTargets.delete(id);
        continue;
      }

      const m = mv.monster;
      const dx = target.x - m.x;
      const dy = target.y - m.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= 0.25 || distSq > snapDistSq) {
        m.x = target.x;
        m.y = target.y;
        if (distSq <= 0.25) {
          this.remoteTargets.delete(id);
        }
      } else {
        m.x += dx * alpha;
        m.y += dy * alpha;
      }

      mv.container.setPosition(m.x, m.y);
      setDepthIfChanged(mv.container, ySortDepth(m.y, 28));
    }
  }
}
