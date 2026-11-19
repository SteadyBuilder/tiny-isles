import type Phaser from 'phaser';
import { MONSTER_SYNC_CONFIG } from '../../data/worldRules';
import { Monster } from '../../types/game';
import {
  MonsterKillSyncPayload,
  MonstersDeltaSyncPayload,
  MonstersFullSyncPayload,
} from '../../types/monsterSync';
import {
  SyncTrackedMonsterState,
  chunkArray,
  createSyncTrackedState,
  hasMonsterSyncChanged,
  roundMonsterSnapshotCoords,
  toCompactMonsterTuple,
} from '../utils/monsterSyncUtils';
import {
  MonsterDigestResult,
  computeMonsterIdDigest,
} from './MonsterReconciliationHelper';
import {
  MonsterRemoteDeltaApplier,
  RemoteDeltaApplyCallbacks,
} from './MonsterRemoteDeltaApplier';
import { MonsterVisual } from './MonsterVisualManager';

export type { RemoteDeltaApplyCallbacks };

/**
 * 호스트-게스트 간 몬스터 전체 청크 동기화·델타 스냅샷 인코더 및 게스트 수신 조율 모듈
 */
export class MonsterSyncCoordinator {
  private lastSyncedSnapshots = new Map<string, SyncTrackedMonsterState>();
  private pendingKills: MonsterKillSyncPayload[] = [];
  private pendingRemovedIds = new Set<string>();
  private syncSeq = 0;
  private hostEpoch = 0;
  private remoteApplier = new MonsterRemoteDeltaApplier();

  public resetAll(): void {
    this.lastSyncedSnapshots.clear();
    this.pendingKills = [];
    this.pendingRemovedIds.clear();
    this.remoteApplier.resetAll();
  }

  public setHostEpoch(epoch: number): void {
    const normalized = Math.max(0, Math.floor(epoch));
    if (normalized !== this.hostEpoch) {
      this.hostEpoch = normalized;
      this.syncSeq = 0;
    }
  }

  public getHostEpoch(): number {
    return this.hostEpoch;
  }

  public getLiveMonsterDigest(monsters: ReadonlyMap<string, MonsterVisual>): MonsterDigestResult {
    return computeMonsterIdDigest(monsters);
  }

  public markLocalHit(monsterId: string): void {
    this.remoteApplier.markLocalHit(monsterId);
  }

  public recordKill(kill: MonsterKillSyncPayload): void {
    if (this.pendingKills.length >= 256) {
      this.pendingKills.shift();
    }
    this.pendingKills.push(kill);
    this.pendingRemovedIds.delete(kill.id);
    this.lastSyncedSnapshots.delete(kill.id);
  }

  /**
   * 게스트가 이미 사망·소멸한 유령 몹을 타격했을 때 즉시 제거 신호를 큐에 적재합니다.
   */
  public recordGhostRemoval(monsterId: string): void {
    if (!monsterId) return;
    if (this.pendingRemovedIds.size < 256) {
      this.pendingRemovedIds.add(monsterId);
    }
    this.lastSyncedSnapshots.delete(monsterId);
  }

  public buildFullSyncChunks(
    monsters: Map<string, MonsterVisual>,
    waveCount: number,
    bossWaveCount: number
  ): MonstersFullSyncPayload[] {
    this.lastSyncedSnapshots.clear();

    const snapshots: Monster[] = [];
    for (const mv of monsters.values()) {
      if (mv.monster.hp <= 0) continue;
      this.lastSyncedSnapshots.set(mv.monster.id, createSyncTrackedState(mv.monster));
      snapshots.push(roundMonsterSnapshotCoords(mv.monster));
    }

    const seq = ++this.syncSeq;
    const syncId = `fs_${Date.now()}_${seq}`;
    if (snapshots.length === 0) {
      return [
        {
          monsters: [],
          waveCount,
          bossWaveCount,
          syncId,
          chunkIndex: 0,
          totalChunks: 1,
          hostEpoch: this.hostEpoch,
          syncSeq: seq,
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
      hostEpoch: this.hostEpoch,
      syncSeq: seq,
    }));
  }

  public buildDeltaBatches(
    monsters: Map<string, MonsterVisual>,
    waveCount: number,
    bossWaveCount: number
  ): MonstersDeltaSyncPayload[] {
    const spawns: Monster[] = [];
    const updates = [];
    const removedSet = new Set<string>();

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
      const live = monsters.get(prevId);
      if (!live || live.monster.hp <= 0) {
        removedSet.add(prevId);
        this.lastSyncedSnapshots.delete(prevId);
      }
    }

    for (const ghostId of this.pendingRemovedIds) {
      const live = monsters.get(ghostId);
      if (!live || live.monster.hp <= 0) {
        removedSet.add(ghostId);
      }
    }
    this.pendingRemovedIds.clear();

    const kills = this.pendingKills.splice(0, this.pendingKills.length);
    for (const kill of kills) {
      removedSet.delete(kill.id);
    }
    const removedIds = Array.from(removedSet);

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
    const { count: totalMonsterCount, digest: liveMonsterDigest } = computeMonsterIdDigest(monsters);
    const seq = ++this.syncSeq;

    const batches: MonstersDeltaSyncPayload[] = [];
    for (let i = 0; i < totalBatches; i++) {
      batches.push({
        spawns: spawnChunks[i] ?? [],
        updates: updateChunks[i] ?? [],
        kills: i === 0 ? kills : [],
        removedIds: i === 0 ? removedIds : [],
        totalMonsterCount,
        liveMonsterDigest,
        waveCount,
        bossWaveCount,
        batchIndex: i,
        totalBatches,
        hostEpoch: this.hostEpoch,
        syncSeq: seq,
      });
    }
    return batches;
  }

  public receiveFullSyncChunk(
    payload: MonstersFullSyncPayload
  ): { ready: boolean; monsters: Monster[] } {
    return this.remoteApplier.receiveFullSyncChunk(payload);
  }

  public applyDeltaSync(
    scene: Phaser.Scene,
    monsters: Map<string, MonsterVisual>,
    payload: MonstersDeltaSyncPayload,
    callbacks: RemoteDeltaApplyCallbacks
  ): { needsFullSync: boolean; killedCount: number; spawnedCount: number } {
    return this.remoteApplier.applyDeltaSync(scene, monsters, payload, callbacks);
  }

  public interpolateRemoteMonsters(
    monsters: Map<string, MonsterVisual>,
    deltaMs: number
  ): void {
    this.remoteApplier.interpolateRemoteMonsters(monsters, deltaMs);
  }
}
