import { HOST_SYNC_CONFIG, MONSTER_SYNC_CONFIG } from '../../../data/worldRules';
import { HostHandoverPayload, HostHeartbeatPayload } from '../../../types/monsterSync';
import { RoomMember } from '../../../types/room';
import { computeNextFailoverRank } from './HostAuthorityHelper';

export interface HostFailoverWatchdogDeps {
  getLocalPlayerId: () => string;
  isCoopMode: () => boolean;
  getLiveMonsterDigest: () => { count: number; digest: number };
  onSendHostHeartbeat: (payload: HostHeartbeatPayload) => void;
  onSendHostHandover: (payload: HostHandoverPayload) => void;
  onClaimHostAuthority: (nextEpoch: number) => void;
  onYieldHostAuthority: (isBackground: boolean) => void;
  onUpdatePresenceBackground: (isBackground: boolean) => void;
  onDigestMismatchDetected: () => void;
  onResumeResyncNeeded: () => void;
  getNow?: () => number;
}

/**
 * 멀티플레이 방장 생존 감시(Watchdog) · 모바일 백그라운드 자동 이양 · 게스트 다이제스트 무결성 감시 컨트롤러
 */
export class HostFailoverWatchdog {
  private isHost = true;
  private currentHostId = '';
  private currentHostEpoch = 0;
  private onlineCount = 1;
  private members: RoomMember[] = [];
  private isPageHidden = false;
  private lastHostActivityAt = 0;
  private lastHeartbeatSentAt = 0;
  private lastClaimAttemptAt = -HOST_SYNC_CONFIG.failoverClaimCooldownMs;
  private digestMismatchStreak = 0;
  private destroyed = false;

  private boundVisibilityHandler: (() => void) | null = null;
  private boundPageHideHandler: (() => void) | null = null;

  constructor(private readonly deps: HostFailoverWatchdogDeps) {
    this.lastHostActivityAt = this.now();
  }

  private now(): number {
    return this.deps.getNow ? this.deps.getNow() : Date.now();
  }

  public attachBrowserLifecycle(): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    if (this.boundVisibilityHandler) return;

    this.isPageHidden = document.visibilityState === 'hidden';

    this.boundVisibilityHandler = () => {
      if (this.destroyed) return;
      this.handleVisibilityChange(document.visibilityState === 'hidden');
    };
    this.boundPageHideHandler = () => {
      if (this.destroyed) return;
      this.handleVisibilityChange(true);
    };

    document.addEventListener('visibilitychange', this.boundVisibilityHandler);
    window.addEventListener('pagehide', this.boundPageHideHandler);
  }

  public destroy(): void {
    this.destroyed = true;
    if (this.boundVisibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
      this.boundVisibilityHandler = null;
    }
    if (this.boundPageHideHandler && typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.boundPageHideHandler);
      this.boundPageHideHandler = null;
    }
  }

  public updatePresenceSnapshot(params: {
    isHost: boolean;
    hostId: string;
    hostEpoch: number;
    onlineCount: number;
    members: RoomMember[];
  }): void {
    const prevHostId = this.currentHostId;
    const prevHostEpoch = this.currentHostEpoch;
    this.isHost = params.isHost;
    this.currentHostId = params.hostId;
    this.currentHostEpoch = params.hostEpoch;
    this.onlineCount = Math.max(1, params.onlineCount);
    this.members = params.members;

    if (params.isHost || params.hostId !== prevHostId || params.hostEpoch !== prevHostEpoch) {
      this.lastHostActivityAt = this.now();
      this.digestMismatchStreak = 0;
    }
  }

  public recordHostActivity(hostEpoch?: number, nowMs = this.now()): void {
    if (this.isHost) return;
    if (typeof hostEpoch === 'number' && hostEpoch < this.currentHostEpoch) {
      return;
    }
    this.lastHostActivityAt = nowMs;
  }

  public handleHostHeartbeat(payload: HostHeartbeatPayload, nowMs = this.now()): void {
    if (this.destroyed || this.isHost || !this.deps.isCoopMode()) return;
    if (payload.hostEpoch < this.currentHostEpoch) return;

    this.lastHostActivityAt = nowMs;
    if (payload.hostEpoch > this.currentHostEpoch) {
      this.currentHostEpoch = payload.hostEpoch;
    }

    const local = this.deps.getLiveMonsterDigest();
    const matches =
      local.count === payload.liveMonsterCount && local.digest === payload.liveMonsterDigest;

    if (matches) {
      this.digestMismatchStreak = 0;
      return;
    }

    this.digestMismatchStreak += 1;
    if (this.digestMismatchStreak >= MONSTER_SYNC_CONFIG.digestMismatchTriggerCount) {
      this.digestMismatchStreak = 0;
      this.deps.onDigestMismatchDetected();
    }
  }

  public handleHostHandover(payload: HostHandoverPayload, nowMs = this.now()): void {
    if (this.destroyed || this.isHost || this.isPageHidden || !this.deps.isCoopMode()) return;
    if (this.onlineCount <= 1) return;
    if (payload.fromHostId !== this.currentHostId && this.currentHostId !== '') return;

    const rank = computeNextFailoverRank(
      this.members,
      this.deps.getLocalPlayerId(),
      payload.fromHostId
    );
    if (rank === 0) {
      this.tryClaimHost(Math.max(this.currentHostEpoch, payload.hostEpoch), nowMs);
    } else if (rank > 0) {
      // 2순위 이하 후보는 즉시 감시 타이머를 앞당겨 1순위 후보 무응답 시 빠르게 이어받도록 준비
      this.lastHostActivityAt = Math.min(
        this.lastHostActivityAt,
        nowMs - HOST_SYNC_CONFIG.failoverTimeoutMs
      );
    }
  }

  public handleVisibilityChange(hidden: boolean, nowMs = this.now()): void {
    if (this.destroyed || !this.deps.isCoopMode()) {
      this.isPageHidden = hidden;
      return;
    }
    if (this.isPageHidden === hidden) return;
    this.isPageHidden = hidden;

    if (hidden) {
      if (this.isHost && this.onlineCount > 1) {
        this.deps.onSendHostHandover({
          fromHostId: this.deps.getLocalPlayerId(),
          hostEpoch: this.currentHostEpoch,
          reason: 'background',
        });
        this.deps.onYieldHostAuthority(true);
      } else {
        this.deps.onUpdatePresenceBackground(true);
      }
      return;
    }

    // 모바일 백그라운드에서 복귀: 방장 탈취를 막기 위해 게스트 우선순위로 복귀하고 즉시 전체 동기화 요청
    this.lastHostActivityAt = nowMs;
    this.digestMismatchStreak = 0;
    this.deps.onYieldHostAuthority(false);
    this.deps.onResumeResyncNeeded();
  }

  public tick(nowMs = this.now()): void {
    if (this.destroyed || !this.deps.isCoopMode() || this.onlineCount <= 1) return;
    if (this.isPageHidden) return;

    if (this.isHost) {
      if (nowMs - this.lastHeartbeatSentAt >= HOST_SYNC_CONFIG.heartbeatIntervalMs) {
        this.lastHeartbeatSentAt = nowMs;
        const { count, digest } = this.deps.getLiveMonsterDigest();
        this.deps.onSendHostHeartbeat({
          hostId: this.deps.getLocalPlayerId(),
          hostEpoch: this.currentHostEpoch,
          liveMonsterCount: count,
          liveMonsterDigest: digest,
          sentAt: nowMs,
        });
      }
      return;
    }

    const silenceMs = nowMs - this.lastHostActivityAt;
    if (silenceMs < HOST_SYNC_CONFIG.failoverTimeoutMs) return;

    const rank = computeNextFailoverRank(
      this.members,
      this.deps.getLocalPlayerId(),
      this.currentHostId
    );
    if (rank < 0) return;

    const requiredSilence =
      HOST_SYNC_CONFIG.failoverTimeoutMs + rank * HOST_SYNC_CONFIG.failoverCandidateStaggerMs;
    if (silenceMs < requiredSilence) return;

    this.tryClaimHost(this.getMaxMemberEpoch(), nowMs);
  }

  private getMaxMemberEpoch(): number {
    let maxEpoch = this.currentHostEpoch;
    for (const member of this.members) {
      if ((member.claimedEpoch ?? 0) > maxEpoch) {
        maxEpoch = member.claimedEpoch ?? 0;
      }
    }
    return maxEpoch;
  }

  private tryClaimHost(baseEpoch: number, nowMs: number): void {
    if (nowMs - this.lastClaimAttemptAt < HOST_SYNC_CONFIG.failoverClaimCooldownMs) {
      return;
    }
    this.lastClaimAttemptAt = nowMs;
    this.deps.onClaimHostAuthority(baseEpoch + 1);
  }
}
