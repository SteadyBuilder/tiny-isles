import type Phaser from 'phaser';
import { MONSTER_SYNC_CONFIG, WORLD_CLOCK_CONFIG } from '../../data/worldRules';
import type { Monster } from '../../types/game';
import type {
  MonsterKillSyncPayload,
  MonstersDeltaSyncPayload,
  MonstersFullSyncPayload,
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
  getNow?: () => number;
}

/**
 * 웨이브/월드 몬스터 네트워크 동기화 상태·주기·호스트/게스트 전환 조율 브리지
 */
export class WaveNetworkSyncBridge {
  private syncCoordinator = new MonsterSyncCoordinator();
  private monsterSyncAccumMs = 0;
  private lastFullSyncSentAt = 0;
  private lastGuestSyncRequestAt = 0;
  private hasCompletedInitialSync = false;
  private remoteSyncPeerSeen = false;
  private deltaFlushQueued = false;
  private destroyed = false;
  private onlineCount = 1;

  constructor(private readonly deps: WaveNetworkSyncBridgeDeps) {}

  private now(): number {
    return this.deps.getNow ? this.deps.getNow() : performance.now();
  }

  public destroy(): void {
    this.destroyed = true;
    this.deltaFlushQueued = false;
    this.syncCoordinator.resetAll();
  }

  public resetAll(): void {
    this.syncCoordinator.resetAll();
  }

  public markLocalHit(monsterId: string): void {
    this.syncCoordinator.markLocalHit(monsterId);
  }

  public recordKill(kill: MonsterKillSyncPayload): void {
    if (this.deps.isHost() && this.shouldBroadcastCoopMonsters()) {
      this.syncCoordinator.recordKill(kill);
    }
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
    this.monsterSyncAccumMs = 0;
    this.lastFullSyncSentAt = 0;
    this.syncCoordinator.resetAll();
  }

  public onEnterGuestMode(): void {
    this.monsterSyncAccumMs = 0;
    this.hasCompletedInitialSync = false;
    this.syncCoordinator.resetAll();
    this.requestMonstersSyncThrottled(true);
  }

  public handleRemoteSyncRequest(monsters: Map<string, MonsterVisual>): void {
    if (!this.deps.isHost()) return;
    this.remoteSyncPeerSeen = true;
    this.broadcastFullMonstersSync(monsters, false, true);
  }

  public broadcastFullMonstersSync(
    monsters: Map<string, MonsterVisual>,
    force = false,
    fromGuestRequest = false
  ): void {
    if (!this.deps.isHost()) return;
    const now = this.now();
    if (!force && now - this.lastFullSyncSentAt < MONSTER_SYNC_CONFIG.hostFullSyncCooldownMs) {
      return;
    }
    const { waveCount, bossWaveCount } = this.deps.getWaveCounts();
    const chunks = this.syncCoordinator.buildFullSyncChunks(monsters, waveCount, bossWaveCount);
    if (!fromGuestRequest && !this.shouldBroadcastCoopMonsters()) {
      return;
    }
    this.lastFullSyncSentAt = now;
    for (const chunk of chunks) {
      this.deps.broadcastFullSync?.(chunk);
    }
  }

  public scheduleDeltaSyncFlush(getMonsters: () => Map<string, MonsterVisual>): void {
    if (this.deltaFlushQueued || !this.deps.isHost() || !this.shouldBroadcastCoopMonsters()) return;
    this.deltaFlushQueued = true;
    queueMicrotask(() => {
      this.deltaFlushQueued = false;
      if (this.destroyed || !this.deps.isHost() || !this.shouldBroadcastCoopMonsters()) return;
      this.flushDeltaSyncNow(getMonsters());
    });
  }

  public flushDeltaSyncNow(monsters: Map<string, MonsterVisual>): void {
    if (!this.deps.isHost() || !this.shouldBroadcastCoopMonsters()) return;
    const { waveCount, bossWaveCount } = this.deps.getWaveCounts();
    const batches = this.syncCoordinator.buildDeltaBatches(monsters, waveCount, bossWaveCount);
    if (batches.length === 0) return;
    this.monsterSyncAccumMs = 0;
    for (const batch of batches) {
      this.deps.broadcastDeltaSync?.(batch);
    }
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
    const { needsFullSync, killedCount, spawnedCount } = this.syncCoordinator.applyDeltaSync(
      scene,
      monsters,
      payload,
      callbacks
    );
    if (!this.hasCompletedInitialSync || needsFullSync) {
      this.requestMonstersSyncThrottled(false);
    }
    return { killedCount, spawnedCount };
  }
}
