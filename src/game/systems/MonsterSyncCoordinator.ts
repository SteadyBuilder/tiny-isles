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
  private fullSyncSeq = 0;
  private deltaSyncSeq = 0;
  private hostEpoch = 0;
  private remoteApplier = new MonsterRemoteDeltaApplier();

  public resetAll(): void {
    this.lastSyncedSnapshots.clear();
    this.pendingKills = [];
    this.pendingRemovedIds.clear();
    this.remoteApplier.resetAll();
  }

  public resetSequenceGuard(): void {
    this.remoteApplier.resetSequenceGuard();
  }

  public setHostEpoch(epoch: number): void {
    const normalized = Math.max(0, Math.floor(epoch));
    if (normalized !== this.hostEpoch) {
      this.hostEpoch = normalized;
      this.fullSyncSeq = 0;
      this.deltaSyncSeq = 0;
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

  public setRemoteTarget(monsterId: string, x: number, y: number): void {
    this.remoteApplier.setRemoteTarget(monsterId, x, y);
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

    const seq = ++this.fullSyncSeq;
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

  /**
   * 게스트가 누락한 특정 몬스터 ID 목록만 단건 스폰/제거 델타로 즉시 회신합니다.
   * 전체 동기화 폭주 없이 보이지 않는 공격 몬스터나 누락 몹을 ~150ms 내 복구합니다.
   */
  public buildRepairDeltaPayload(
    monsters: Map<string, MonsterVisual>,
    requestedIds: ReadonlyArray<string>,
    waveCount: number,
    bossWaveCount: number
  ): MonstersDeltaSyncPayload | null {
    if (!Array.isArray(requestedIds) || requestedIds.length === 0) return null;

    const uniqueIds = Array.from(new Set(requestedIds.filter((id) => typeof id === 'string' && id.length > 0))).slice(
      0,
      MONSTER_SYNC_CONFIG.repairMaxBatchIds
    );
    if (uniqueIds.length === 0) return null;

    const spawns: Monster[] = [];
    const removedIds: string[] = [];

    for (const id of uniqueIds) {
      const mv = monsters.get(id);
      if (mv && mv.monster.hp > 0) {
        spawns.push(roundMonsterSnapshotCoords(mv.monster));
        this.lastSyncedSnapshots.set(id, createSyncTrackedState(mv.monster));
      } else {
        removedIds.push(id);
      }
    }

    if (spawns.length === 0 && removedIds.length === 0) return null;

    const { count: totalMonsterCount, digest: liveMonsterDigest } = computeMonsterIdDigest(monsters);
    const seq = ++this.deltaSyncSeq;
    return {
      spawns,
      updates: [],
      kills: [],
      removedIds,
      totalMonsterCount,
      liveMonsterDigest,
      waveCount,
      bossWaveCount,
      batchIndex: 0,
      totalBatches: 1,
      hostEpoch: this.hostEpoch,
      syncSeq: seq,
    };
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
    const seq = ++this.deltaSyncSeq;

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
  ): {
    needsFullSync: boolean;
    digestMismatch: boolean;
    missingIds: string[];
    killedCount: number;
    spawnedCount: number;
  } {
    return this.remoteApplier.applyDeltaSync(scene, monsters, payload, callbacks);
  }

  public interpolateRemoteMonsters(
    monsters: Map<string, MonsterVisual>,
    deltaMs: number
  ): void {
    this.remoteApplier.interpolateRemoteMonsters(monsters, deltaMs);
  }
}
