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
  private syncSeq = 0;
  private remoteApplier = new MonsterRemoteDeltaApplier();

  public resetAll(): void {
    this.lastSyncedSnapshots.clear();
    this.pendingKills = [];
    this.remoteApplier.resetAll();
  }

  public markLocalHit(monsterId: string): void {
    this.remoteApplier.markLocalHit(monsterId);
  }

  public recordKill(kill: MonsterKillSyncPayload): void {
    if (this.pendingKills.length >= 256) {
      this.pendingKills.shift();
    }
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
