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
  SyncTrackedMonsterState,
  chunkArray,
  createSyncTrackedState,
  hasMonsterSyncChanged,
  roundMonsterSnapshotCoords,
  toCompactMonsterTuple,
} from '../utils/monsterSyncUtils';
import { MonsterVisual, MonsterVisualManager } from './MonsterVisualManager';

interface PendingFullSyncBatch {
  totalChunks: number;
  chunks: Map<number, Monster[]>;
  createdAt: number;
}

export interface RemoteDeltaApplyCallbacks {
  onExplosion: (x: number, y: number) => void;
  onShake: (target: Phaser.GameObjects.Container) => void;
  onRemoteKill: (kill: MonsterKillSyncPayload, visual?: MonsterVisual) => void;
}

/**
 * 호스트-게스트 간 몬스터 전체 청크 동기화, 초경량 델타 동기화 및 게스트 측 부드러운 위치 보간 전담 모듈
 */
export class MonsterSyncCoordinator {
  private lastSyncedSnapshots = new Map<string, SyncTrackedMonsterState>();
  private pendingKills: MonsterKillSyncPayload[] = [];
  private incomingFullSyncBatches = new Map<string, PendingFullSyncBatch>();
  private remoteTargets = new Map<string, { x: number; y: number }>();
  private localHitGraceUntil = new Map<string, number>();
  private syncSeq = 0;
  private countMismatchStreak = 0;

  public resetAll(): void {
    this.lastSyncedSnapshots.clear();
    this.pendingKills = [];
    this.incomingFullSyncBatches.clear();
    this.remoteTargets.clear();
    this.localHitGraceUntil.clear();
    this.countMismatchStreak = 0;
  }

  public markLocalHit(monsterId: string): void {
    this.localHitGraceUntil.set(
      monsterId,
      performance.now() + MONSTER_SYNC_CONFIG.localHitHpGraceMs
    );
  }

  public recordKill(kill: MonsterKillSyncPayload): void {
    this.pendingKills.push(kill);
    this.lastSyncedSnapshots.delete(kill.id);
  }

  public buildFullSyncChunks(
    monsters: Map<string, MonsterVisual>,
    waveCount: number,
    bossWaveCount: number
  ): MonstersFullSyncPayload[] {
    this.lastSyncedSnapshots.clear();
    this.pendingKills = [];

    const snapshots: Monster[] = [];
    for (const mv of monsters.values()) {
      if (mv.monster.hp <= 0) continue;
      this.lastSyncedSnapshots.set(mv.monster.id, createSyncTrackedState(mv.monster));
      snapshots.push(roundMonsterSnapshotCoords(mv.monster));
    }

    const syncId = `fs_${Date.now()}_${++this.syncSeq}`;
    if (snapshots.length === 0) {
      return [
        {
          monsters: [],
          waveCount,
          bossWaveCount,
          syncId,
          chunkIndex: 0,
          totalChunks: 1,
        },
      ];
    }

    const chunks = chunkArray(snapshots, MONSTER_SYNC_CONFIG.fullSyncChunkSize);
    return chunks.map((chunk, chunkIndex) => ({
      monsters: chunk,
      waveCount,
      bossWaveCount,
      syncId,
      chunkIndex,
      totalChunks: chunks.length,
    }));
  }

  public buildDeltaBatches(
    monsters: Map<string, MonsterVisual>,
    waveCount: number,
    bossWaveCount: number
  ): MonstersDeltaSyncPayload[] {
    const spawns: Monster[] = [];
    const updates = [];
    const removedIds: string[] = [];

    for (const [id, mv] of monsters.entries()) {
      const m = mv.monster;
      if (m.hp <= 0) continue;
      const prev = this.lastSyncedSnapshots.get(id);
      if (!prev) {
        spawns.push(roundMonsterSnapshotCoords(m));
        this.lastSyncedSnapshots.set(id, createSyncTrackedState(m));
      } else if (hasMonsterSyncChanged(prev, m)) {
        updates.push(toCompactMonsterTuple(m));
        this.lastSyncedSnapshots.set(id, createSyncTrackedState(m));
      }
    }

    for (const prevId of Array.from(this.lastSyncedSnapshots.keys())) {
      if (!monsters.has(prevId)) {
        removedIds.push(prevId);
        this.lastSyncedSnapshots.delete(prevId);
      }
    }

    const kills = this.pendingKills.splice(0, this.pendingKills.length);
    if (
      spawns.length === 0 &&
      updates.length === 0 &&
      kills.length === 0 &&
      removedIds.length === 0
    ) {
      return [];
    }

    const spawnChunks = chunkArray(spawns, MONSTER_SYNC_CONFIG.deltaSpawnChunkSize);
    const updateChunks = chunkArray(updates, MONSTER_SYNC_CONFIG.deltaUpdateChunkSize);
    const totalBatches = Math.max(1, spawnChunks.length, updateChunks.length);
    const totalMonsterCount = monsters.size;

    const batches: MonstersDeltaSyncPayload[] = [];
    for (let i = 0; i < totalBatches; i++) {
      batches.push({
        spawns: spawnChunks[i] ?? [],
        updates: updateChunks[i] ?? [],
        kills: i === 0 ? kills : [],
        removedIds: i === 0 ? removedIds : [],
        totalMonsterCount,
        waveCount,
        bossWaveCount,
        batchIndex: i,
        totalBatches,
      });
    }
    return batches;
  }

  private pruneExpiredFullSyncBatches(now: number): void {
    for (const [id, entry] of this.incomingFullSyncBatches.entries()) {
      if (now - entry.createdAt > MONSTER_SYNC_CONFIG.fullSyncBatchTtlMs) {
        this.incomingFullSyncBatches.delete(id);
      }
    }
  }

  public receiveFullSyncChunk(
    payload: MonstersFullSyncPayload
  ): { ready: boolean; monsters: Monster[] } {
    const now = performance.now();
    this.pruneExpiredFullSyncBatches(now);

    const total = payload.totalChunks ?? 1;
    if (total <= 1 || !payload.syncId) {
      this.countMismatchStreak = 0;
      this.remoteTargets.clear();
      return { ready: true, monsters: payload.monsters || [] };
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
      batch = { totalChunks: total, chunks: new Map(), createdAt: now };
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
      if (part) merged.push(...part);
    }
    this.countMismatchStreak = 0;
    this.remoteTargets.clear();
    return { ready: true, monsters: merged };
  }

  public applyDeltaSync(
    scene: Phaser.Scene,
    monsters: Map<string, MonsterVisual>,
    payload: MonstersDeltaSyncPayload,
    callbacks: RemoteDeltaApplyCallbacks
  ): { needsFullSync: boolean; killedCount: number; spawnedCount: number } {
    const now = performance.now();
    let killedCount = 0;
    let spawnedCount = 0;

    for (const kill of payload.kills || []) {
      const mv = monsters.get(kill.id);
      if (mv) {
        callbacks.onExplosion(mv.container.x, mv.container.y);
        MonsterVisualManager.disposeVisual(mv);
        monsters.delete(kill.id);
      } else {
        callbacks.onExplosion(kill.x, kill.y);
      }
      this.remoteTargets.delete(kill.id);
      this.localHitGraceUntil.delete(kill.id);
      callbacks.onRemoteKill(kill, mv);
      killedCount++;
    }

    for (const removedId of payload.removedIds || []) {
      const mv = monsters.get(removedId);
      if (mv) {
        callbacks.onExplosion(mv.container.x, mv.container.y);
        MonsterVisualManager.disposeVisual(mv);
        monsters.delete(removedId);
      }
      this.remoteTargets.delete(removedId);
      this.localHitGraceUntil.delete(removedId);
      killedCount++;
    }

    for (const sp of payload.spawns || []) {
      if (sp.hp <= 0) continue;
      const existing = monsters.get(sp.id);
      if (existing) {
        existing.monster.x = sp.x;
        existing.monster.y = sp.y;
        existing.monster.hp = sp.hp;
        existing.monster.maxHp = sp.maxHp;
        existing.container.setPosition(sp.x, sp.y);
        MonsterVisualManager.updateHpBar(existing, false);
      } else {
        monsters.set(sp.id, MonsterVisualManager.create(scene, { ...sp }));
        spawnedCount++;
      }
      this.remoteTargets.delete(sp.id);
    }

    let missingUpdateTarget = false;
    for (const tuple of payload.updates || []) {
      const [id, x, y, hp, maxHp, dirCode, targetTerritoryId, shieldHp] = tuple;
      const mv = monsters.get(id);
      if (!mv) {
        missingUpdateTarget = true;
        continue;
      }

      const m = mv.monster;
      this.remoteTargets.set(id, { x, y });
      m.direction = dirCode === 0 ? 'left' : 'right';
      m.targetTerritoryId = targetTerritoryId;
      mv.sprite.setFlipX(m.direction === 'left');

      const prevShieldHp = m.shieldHp ?? 0;
      if (shieldHp > 0) {
        m.shieldHp = shieldHp;
        m.shieldMaxHp = Math.max(m.shieldMaxHp ?? 0, shieldHp);
        m.shieldUntil = now + 5000;
      } else if (prevShieldHp > 0) {
        m.shieldHp = 0;
        m.shieldUntil = 0;
      }

      const graceUntil = this.localHitGraceUntil.get(id) ?? 0;
      if (hp <= 0 || hp <= m.hp || now >= graceUntil) {
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
    }

    const totalBatches = payload.totalBatches ?? 1;
    const batchIndex = payload.batchIndex ?? 0;
    const isFinalBatch = totalBatches <= 1 || batchIndex >= totalBatches - 1;

    if (isFinalBatch && typeof payload.totalMonsterCount === 'number') {
      if (monsters.size !== payload.totalMonsterCount) {
        this.countMismatchStreak++;
      } else {
        this.countMismatchStreak = 0;
      }
    }

    return {
      needsFullSync: missingUpdateTarget || this.countMismatchStreak >= 2,
      killedCount,
      spawnedCount,
    };
  }

  public interpolateRemoteMonsters(
    monsters: Map<string, MonsterVisual>,
    deltaMs: number
  ): void {
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
