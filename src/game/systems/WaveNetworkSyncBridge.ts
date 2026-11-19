import type Phaser from 'phaser';
import { MONSTER_SYNC_CONFIG, WORLD_CLOCK_CONFIG } from '../../data/worldRules';
import type { Monster } from '../../types/game';
import type {
  MonsterKillSyncPayload,
  MonstersDeltaSyncPayload,
  MonstersFullSyncPayload,
  MonstersRepairRequestPayload,
} from '../../types/monsterSync';
import type { RemoteDeltaApplyCallbacks } from './MonsterRemoteDeltaApplier';
import { MonsterSyncCoordinator } from './MonsterSyncCoordinator';
import type { MonsterVisual } from './MonsterVisualManager';

export interface WaveNetworkSyncBridgeDeps {
  isHost: () => boolean;
  hasActiveInvaders: () => boolean;
  getWaveCounts: () => { waveCount: number; bossWaveCount: number };
  onSyncWaveCounts: (waveCount: number, bossWaveCount: number) => void;
  broadcastFullSync?: (payload: MonstersFullSyncPayload) => void;
  broadcastDeltaSync?: (payload: MonstersDeltaSyncPayload) => void;
  requestMonstersSync?: () => void;
  requestMonstersRepair?: (payload: MonstersRepairRequestPayload) => void;
  getNow?: () => number;
}

/**
 * 웨이브/월드 몬스터 네트워크 동기화 상태·주기·호스트/게스트 전환 조율 브리지
 */
export class WaveNetworkSyncBridge {
  private syncCoordinator = new MonsterSyncCoordinator();
  private monsterSyncAccumMs = 0;
  private lastFullSyncSentAt = 0;
  private lastDeltaFlushAt = 0;
  private lastGuestSyncRequestAt = 0;
  private lastRepairRequestAt = 0;
  private hasCompletedInitialSync = false;
  private remoteSyncPeerSeen = false;
  private deltaFlushQueued = false;
  private deltaDeferredDuringFullSync = false;
  private pendingFollowUpFullSync = false;
  private deltaFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private fullSyncFollowUpTimer: ReturnType<typeof setTimeout> | null = null;
  private repairDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingFullSyncTimers: Array<ReturnType<typeof setTimeout>> = [];
  private fullSyncStreamMonstersRef: Map<string, MonsterVisual> | null = null;
  private pendingRepairIds = new Set<string>();
  private destroyed = false;
  private onlineCount = 1;

  constructor(private readonly deps: WaveNetworkSyncBridgeDeps) {}

  private now(): number {
    return this.deps.getNow ? this.deps.getNow() : performance.now();
  }

  private clearRepairQueue(): void {
    if (this.repairDebounceTimer) {
      clearTimeout(this.repairDebounceTimer);
      this.repairDebounceTimer = null;
    }
    this.pendingRepairIds.clear();
  }

  private clearPendingTimers(): void {
    if (this.deltaFlushTimer) {
      clearTimeout(this.deltaFlushTimer);
      this.deltaFlushTimer = null;
    }
    if (this.fullSyncFollowUpTimer) {
      clearTimeout(this.fullSyncFollowUpTimer);
      this.fullSyncFollowUpTimer = null;
    }
    this.deltaFlushQueued = false;
    this.deltaDeferredDuringFullSync = false;
    this.pendingFollowUpFullSync = false;
    this.fullSyncStreamMonstersRef = null;
    this.clearRepairQueue();
    this.clearPendingFullSyncChunks();
  }

  private clearPendingFullSyncChunks(): void {
    if (this.pendingFullSyncTimers.length === 0) return;
    for (const timer of this.pendingFullSyncTimers) {
      clearTimeout(timer);
    }
    this.pendingFullSyncTimers = [];
  }

  public isStreamingFullSync(): boolean {
    return this.pendingFullSyncTimers.length > 0;
  }

  public destroy(): void {
    this.destroyed = true;
    this.clearPendingTimers();
    this.syncCoordinator.resetAll();
  }

  public resetAll(): void {
    this.clearPendingTimers();
    this.syncCoordinator.resetAll();
  }

  public setHostEpoch(epoch: number): void {
    this.syncCoordinator.setHostEpoch(epoch);
  }

  public getLiveMonsterDigest(monsters: ReadonlyMap<string, MonsterVisual>): {
    count: number;
    digest: number;
  } {
    return this.syncCoordinator.getLiveMonsterDigest(monsters);
  }

  public markLocalHit(monsterId: string): void {
    this.syncCoordinator.markLocalHit(monsterId);
  }

  public recordKill(kill: MonsterKillSyncPayload): void {
    if (this.deps.isHost() && this.shouldBroadcastCoopMonsters()) {
      this.syncCoordinator.recordKill(kill);
    }
  }

  public recordGhostRemoval(
    monsterId: string,
    getMonsters: () => Map<string, MonsterVisual>
  ): void {
    if (!this.deps.isHost() || !this.shouldBroadcastCoopMonsters()) return;
    this.syncCoordinator.recordGhostRemoval(monsterId);
    this.scheduleDeltaSyncFlush(getMonsters);
  }

  public setOnlineCount(count: number): void {
    const next = Math.max(1, count);
    if (next === this.onlineCount) return;
    if (next > 1) {
      this.remoteSyncPeerSeen = true;
    } else if (this.onlineCount > 1 && next === 1) {
      this.remoteSyncPeerSeen = false;
    }
    this.onlineCount = next;
  }

  public shouldBroadcastCoopMonsters(): boolean {
    return this.onlineCount > 1 || this.remoteSyncPeerSeen;
  }

  public onEnterHostMode(switchedFromGuest: boolean): void {
    if (!switchedFromGuest) return;
    this.clearPendingTimers();
    this.monsterSyncAccumMs = 0;
    this.lastFullSyncSentAt = 0;
    this.lastDeltaFlushAt = 0;
    this.syncCoordinator.resetAll();
  }

  public onEnterGuestMode(): void {
    this.clearPendingTimers();
    this.monsterSyncAccumMs = 0;
    this.hasCompletedInitialSync = false;
    this.syncCoordinator.resetAll();
    this.requestMonstersSyncThrottled(true);
  }

  /**
   * 게스트 유지 상태에서 방장(hostId)이 교체되었거나 재연결 복귀 시
   * 기존 시퀀스/에폭 가드를 초기화해 새 호스트 패킷 거부를 방지합니다.
   */
  public onHostIdentityChanged(isHost: boolean, hostEpoch: number): void {
    this.syncCoordinator.setHostEpoch(hostEpoch);
    if (isHost) return;
    this.clearRepairQueue();
    this.syncCoordinator.resetSequenceGuard();
    this.requestMonstersSyncThrottled(true);
  }

  public onConnectionResumed(): void {
    if (this.deps.isHost()) return;
    this.clearRepairQueue();
    this.syncCoordinator.resetSequenceGuard();
    this.requestMonstersSyncThrottled(true);
  }

  public handleRemoteSyncRequest(monsters: Map<string, MonsterVisual>): void {
    if (!this.deps.isHost()) return;
    this.remoteSyncPeerSeen = true;
    this.broadcastFullMonstersSync(monsters, false, true);
  }

  public handleRemoteRepairRequest(
    monsters: Map<string, MonsterVisual>,
    ids: ReadonlyArray<string>
  ): void {
    if (!this.deps.isHost() || !Array.isArray(ids) || ids.length === 0) return;
    this.remoteSyncPeerSeen = true;
    const { waveCount, bossWaveCount } = this.deps.getWaveCounts();
    const payload = this.syncCoordinator.buildRepairDeltaPayload(
      monsters,
      ids,
      waveCount,
      bossWaveCount
    );
    if (payload) {
      this.deps.broadcastDeltaSync?.(payload);
    }
  }

  public broadcastFullMonstersSync(
    monsters: Map<string, MonsterVisual>,
    force = false,
    fromGuestRequest = false
  ): void {
    if (!this.deps.isHost()) return;
    if (!fromGuestRequest && !this.shouldBroadcastCoopMonsters()) {
      return;
    }

    const now = this.now();
    // 진행 중인 다중 청크 전체 동기화를 중단하지 않고 보호 (후속 요청만 1회 예약)
    if (this.isStreamingFullSync()) {
      if (force || (fromGuestRequest && now - this.lastFullSyncSentAt >= 250)) {
        this.pendingFollowUpFullSync = true;
        this.fullSyncStreamMonstersRef = monsters;
      }
      return;
    }

    if (!force && now - this.lastFullSyncSentAt < MONSTER_SYNC_CONFIG.hostFullSyncCooldownMs) {
      return;
    }

    if (this.fullSyncFollowUpTimer) {
      clearTimeout(this.fullSyncFollowUpTimer);
      this.fullSyncFollowUpTimer = null;
    }
    this.pendingFollowUpFullSync = false;

    const { waveCount, bossWaveCount } = this.deps.getWaveCounts();
    const chunks = this.syncCoordinator.buildFullSyncChunks(monsters, waveCount, bossWaveCount);
    this.lastFullSyncSentAt = now;
    this.clearPendingFullSyncChunks();

    if (chunks.length === 0) return;
    this.deps.broadcastFullSync?.(chunks[0]);

    if (chunks.length <= 1) {
      this.fullSyncStreamMonstersRef = null;
      return;
    }

    this.fullSyncStreamMonstersRef = monsters;
    for (let i = 1; i < chunks.length; i++) {
      const chunk = chunks[i];
      const timer = setTimeout(() => {
        const idx = this.pendingFullSyncTimers.indexOf(timer);
        if (idx >= 0) this.pendingFullSyncTimers.splice(idx, 1);
        if (this.destroyed || !this.deps.isHost()) return;
        this.deps.broadcastFullSync?.(chunk);

        if (this.pendingFullSyncTimers.length === 0) {
          const liveMonsters = this.fullSyncStreamMonstersRef ?? monsters;
          this.fullSyncStreamMonstersRef = null;
          if (this.deltaDeferredDuringFullSync) {
            this.deltaDeferredDuringFullSync = false;
            this.flushDeltaSyncNow(liveMonsters);
          }
          if (this.pendingFollowUpFullSync && !this.fullSyncFollowUpTimer) {
            this.pendingFollowUpFullSync = false;
            this.fullSyncFollowUpTimer = setTimeout(() => {
              this.fullSyncFollowUpTimer = null;
              if (this.destroyed || !this.deps.isHost()) return;
              this.broadcastFullMonstersSync(liveMonsters, true, false);
            }, MONSTER_SYNC_CONFIG.fullSyncFollowUpDelayMs);
          }
        }
      }, i * MONSTER_SYNC_CONFIG.fullSyncChunkPaceMs);
      this.pendingFullSyncTimers.push(timer);
    }
  }

  public scheduleDeltaSyncFlush(getMonsters: () => Map<string, MonsterVisual>): void {
    if (this.deltaFlushQueued || !this.deps.isHost() || !this.shouldBroadcastCoopMonsters()) return;
    this.deltaFlushQueued = true;

    const elapsedSinceFlush = this.now() - this.lastDeltaFlushAt;
    const remainingMs = MONSTER_SYNC_CONFIG.deltaFlushMinIntervalMs - elapsedSinceFlush;

    const execute = () => {
      this.deltaFlushQueued = false;
      this.deltaFlushTimer = null;
      if (this.destroyed || !this.deps.isHost() || !this.shouldBroadcastCoopMonsters()) return;
      this.flushDeltaSyncNow(getMonsters());
    };

    if (remainingMs <= 0) {
      queueMicrotask(execute);
    } else {
      this.deltaFlushTimer = setTimeout(execute, remainingMs);
    }
  }

  public flushDeltaSyncNow(monsters: Map<string, MonsterVisual>): void {
    if (!this.deps.isHost() || !this.shouldBroadcastCoopMonsters()) return;
    // 다중 청크 전체 동기화 송출 중에는 일반 델타를 대기시켜 채널 폭주 및 청크 유실을 차단
    if (this.isStreamingFullSync()) {
      this.deltaDeferredDuringFullSync = true;
      this.fullSyncStreamMonstersRef = monsters;
      return;
    }
    const { waveCount, bossWaveCount } = this.deps.getWaveCounts();
    const batches = this.syncCoordinator.buildDeltaBatches(monsters, waveCount, bossWaveCount);
    if (batches.length === 0) return;
    this.monsterSyncAccumMs = 0;
    this.lastDeltaFlushAt = this.now();
    for (const batch of batches) {
      this.deps.broadcastDeltaSync?.(batch);
    }
  }

  public queueMissingMonsterRepair(ids: ReadonlyArray<string>): void {
    if (this.destroyed || this.deps.isHost() || ids.length === 0) return;
    if (!this.deps.requestMonstersRepair) {
      this.requestMonstersSyncThrottled(false);
      return;
    }

    for (const id of ids) {
      if (id) this.pendingRepairIds.add(id);
    }
    if (this.pendingRepairIds.size === 0) return;

    if (this.pendingRepairIds.size > MONSTER_SYNC_CONFIG.repairFallbackFullSyncThreshold) {
      this.clearRepairQueue();
      this.requestMonstersSyncThrottled(false);
      return;
    }

    this.scheduleRepairFlush();
  }

  private scheduleRepairFlush(): void {
    if (this.repairDebounceTimer || this.pendingRepairIds.size === 0) return;
    const elapsed = this.now() - this.lastRepairRequestAt;
    const delayMs = Math.max(
      MONSTER_SYNC_CONFIG.repairRequestDebounceMs,
      MONSTER_SYNC_CONFIG.repairRequestThrottleMs - elapsed
    );

    this.repairDebounceTimer = setTimeout(() => {
      this.repairDebounceTimer = null;
      if (this.destroyed || this.deps.isHost() || this.pendingRepairIds.size === 0) return;
      const batch = Array.from(this.pendingRepairIds).slice(0, MONSTER_SYNC_CONFIG.repairMaxBatchIds);
      for (const id of batch) this.pendingRepairIds.delete(id);
      this.lastRepairRequestAt = this.now();
      this.deps.requestMonstersRepair?.({ ids: batch });
      if (this.pendingRepairIds.size > 0) {
        this.scheduleRepairFlush();
      }
    }, delayMs);
  }

  public requestMonstersSyncThrottled(force = false): void {
    if (this.deps.isHost()) return;
    const now = this.now();
    if (!force && now - this.lastGuestSyncRequestAt < MONSTER_SYNC_CONFIG.guestSyncRequestThrottleMs) {
      return;
    }
    this.lastGuestSyncRequestAt = now;
    this.deps.requestMonstersSync?.();
  }

  public tickGuestSync(monsters: Map<string, MonsterVisual>, deltaMs: number): void {
    this.monsterSyncAccumMs = 0;
    this.syncCoordinator.interpolateRemoteMonsters(monsters, deltaMs);
    if (!this.hasCompletedInitialSync) {
      this.requestMonstersSyncThrottled(false);
    }
  }

  public tickHostDeltaSync(monsters: Map<string, MonsterVisual>, deltaMs: number): void {
    if (!this.shouldBroadcastCoopMonsters()) {
      this.monsterSyncAccumMs = 0;
      return;
    }
    const syncInterval = this.deps.hasActiveInvaders()
      ? WORLD_CLOCK_CONFIG.monsterSyncIntervalMs
      : Math.round(WORLD_CLOCK_CONFIG.monsterSyncIntervalMs * 1.4);

    this.monsterSyncAccumMs += deltaMs;
    if (this.monsterSyncAccumMs >= syncInterval) {
      this.monsterSyncAccumMs = 0;
      this.flushDeltaSyncNow(monsters);
    }
  }

  public applyRemoteFullSync(
    payload: MonstersFullSyncPayload,
    onReady: (monsters: Monster[]) => void
  ): void {
    if (this.deps.isHost()) return;
    const chunkResult = this.syncCoordinator.receiveFullSyncChunk(payload);
    if (!chunkResult.ready) return;

    this.hasCompletedInitialSync = true;
    this.clearRepairQueue();
    this.deps.onSyncWaveCounts(payload.waveCount, payload.bossWaveCount);
    onReady(chunkResult.monsters);
  }

  public applyRemoteDeltaSync(
    scene: Phaser.Scene,
    monsters: Map<string, MonsterVisual>,
    payload: MonstersDeltaSyncPayload,
    callbacks: RemoteDeltaApplyCallbacks
  ): { killedCount: number; spawnedCount: number } {
    if (this.deps.isHost()) return { killedCount: 0, spawnedCount: 0 };
    this.deps.onSyncWaveCounts(payload.waveCount, payload.bossWaveCount);
    const { needsFullSync, digestMismatch, missingIds, killedCount, spawnedCount } =
      this.syncCoordinator.applyDeltaSync(scene, monsters, payload, callbacks);

    if (this.pendingRepairIds.size > 0) {
      for (const sp of payload.spawns || []) this.pendingRepairIds.delete(sp.id);
      for (const kill of payload.kills || []) this.pendingRepairIds.delete(kill.id);
      for (const removedId of payload.removedIds || []) this.pendingRepairIds.delete(removedId);
    }

    if (missingIds.length > 0) {
      this.queueMissingMonsterRepair(missingIds);
    }
    if (!this.hasCompletedInitialSync || digestMismatch || (needsFullSync && missingIds.length === 0)) {
      this.requestMonstersSyncThrottled(false);
    }
    return { killedCount, spawnedCount };
  }
}
