import {
  ProtocolDropInLockReason,
  ProtocolPlayerColor,
  ProtocolPublicRoomListing,
  ProtocolRoomMember,
  ProtocolRoomMeta,
  RoomRejectReason,
  RoomStatePayload,
  ServerRoomStatus,
  getRoomRejectReasonLabel,
  isDevProtocolVersion,
} from '../../../src/shared/multiplayerProtocol';

const LATE_GAME_PROGRESS_RATIO = 0.65;
const LATE_GAME_REMAINING_SEC = 8 * 60;
const DEFAULT_MAX_PLAYERS = 4;

export interface JoinRoomInput {
  playerId: string;
  name: string;
  color: ProtocolPlayerColor;
  appVersion?: string;
  initialMeta?: Partial<ProtocolRoomMeta>;
  requireExisting?: boolean;
  nowMs?: number;
}

export type JoinRoomResult =
  | {
      ok: true;
      state: RoomStatePayload;
      hostChanged: boolean;
      isDropIn: boolean;
    }
  | {
      ok: false;
      reason: RoomRejectReason;
      message: string;
      hostAppVersion?: string;
    };

/**
 * 프레임워크 비종속 순수 룸 상태 머신
 * - 정원 4명 서버 강제, 버전 일치 검증, 종반부 난입 잠금, 결정적 방장 선출/즉시 이양을 단일 진실 원천으로 관리
 */
export class RoomStateMachine {
  private roomId: string;
  private inviteCode: string;
  private status: ServerRoomStatus = 'waiting';
  private hostId = '';
  private hostEpoch = 0;
  private members = new Map<string, ProtocolRoomMember>();
  private meta: ProtocolRoomMeta;
  private cachedSnapshot: Record<string, unknown> | null = null;

  constructor(roomId: string, inviteCode?: string) {
    this.roomId = roomId;
    this.inviteCode = (inviteCode || roomId).toUpperCase();
    this.meta = {
      roomId: this.roomId,
      inviteCode: this.inviteCode,
      missionId: 'expedition_hunting',
      missionTitle: '협동 원정',
      difficulty: 'normal',
      maxPlayers: DEFAULT_MAX_PLAYERS,
      allowDropIn: true,
      currentCount: 0,
      targetCount: 20,
      elapsedSec: 0,
      timeLimitSec: null,
    };
  }

  public getStatus(): ServerRoomStatus {
    return this.status;
  }

  public getHostId(): string {
    return this.hostId;
  }

  public getHostEpoch(): number {
    return this.hostEpoch;
  }

  public getMemberCount(): number {
    return this.members.size;
  }

  public hasMember(playerId: string): boolean {
    return this.members.has(playerId);
  }

  public getCachedSnapshot(): Record<string, unknown> | null {
    return this.cachedSnapshot;
  }

  public join(input: JoinRoomInput): JoinRoomResult {
    const now = input.nowMs ?? Date.now();
    const playerId = input.playerId.trim();
    if (!playerId) {
      return {
        ok: false,
        reason: 'INVALID_JOIN',
        message: getRoomRejectReasonLabel('INVALID_JOIN'),
      };
    }

    const isExistingMember = this.members.has(playerId);
    const isRoomEmpty = this.members.size === 0;

    if (isRoomEmpty && input.requireExisting) {
      return {
        ok: false,
        reason: 'ROOM_NOT_FOUND',
        message: getRoomRejectReasonLabel('ROOM_NOT_FOUND'),
      };
    }

    // 1. 정원 초과 서버 강제 차단
    if (!isExistingMember && this.members.size >= this.meta.maxPlayers) {
      return {
        ok: false,
        reason: 'ROOM_FULL',
        message: getRoomRejectReasonLabel('ROOM_FULL'),
      };
    }

    // 2. 방장 버전과 불일치 시 서버 강제 차단 (개발 모드 제외)
    if (!isRoomEmpty && !isExistingMember) {
      const hostMember = this.members.get(this.hostId);
      const hostVer = hostMember?.appVersion?.trim() || '';
      const joinVer = input.appVersion?.trim() || '';
      if (hostVer && !isDevProtocolVersion(hostVer) && !isDevProtocolVersion(joinVer)) {
        if (!joinVer || joinVer !== hostVer) {
          return {
            ok: false,
            reason: 'VERSION_MISMATCH',
            message: getRoomRejectReasonLabel('VERSION_MISMATCH'),
            hostAppVersion: hostVer,
          };
        }
      }
    }

    // 3. 진행 중인 방 중도 난입 정책 검증
    if (this.status === 'playing' && !isExistingMember) {
      const lockReason = this.evaluateLockReason();
      if (lockReason !== 'open') {
        return {
          ok: false,
          reason: lockReason === 'room_full' ? 'ROOM_FULL' : 'GAME_LOCKED',
          message: getRoomRejectReasonLabel(
            lockReason === 'room_full' ? 'ROOM_FULL' : 'GAME_LOCKED'
          ),
        };
      }
    }

    if (isRoomEmpty) {
      this.status = 'waiting';
      this.cachedSnapshot = null;
      if (input.initialMeta) {
        this.applyMetaPatch(input.initialMeta);
      }
    }

    const prev = this.members.get(playerId);
    this.members.set(playerId, {
      playerId,
      name: input.name.trim() || '모험가',
      color: input.color === 'red' ? 'red' : 'blue',
      isHost: false,
      joinedAt: prev?.joinedAt ?? now,
      isBackground: false,
      appVersion: input.appVersion?.trim() || prev?.appVersion,
    });

    const hostChanged = this.reconcileHost();
    return {
      ok: true,
      state: this.getStatePayload(),
      hostChanged,
      isDropIn: this.status === 'playing' && !isExistingMember,
    };
  }

  public leave(playerId: string): { removed: boolean; hostChanged: boolean; isEmpty: boolean } {
    const removed = this.members.delete(playerId);
    if (!removed) {
      return { removed: false, hostChanged: false, isEmpty: this.members.size === 0 };
    }

    if (this.members.size === 0) {
      this.status = 'waiting';
      this.hostId = '';
      this.hostEpoch = 0;
      this.cachedSnapshot = null;
      return { removed: true, hostChanged: true, isEmpty: true };
    }

    const hostChanged = this.reconcileHost();
    return { removed: true, hostChanged, isEmpty: false };
  }

  public setBackground(playerId: string, isBackground: boolean): { changed: boolean; hostChanged: boolean } {
    const member = this.members.get(playerId);
    if (!member) return { changed: false, hostChanged: false };
    if (Boolean(member.isBackground) === isBackground) {
      return { changed: false, hostChanged: false };
    }
    member.isBackground = isBackground;
    const hostChanged = this.reconcileHost();
    return { changed: true, hostChanged };
  }

  public startGame(
    requesterId: string,
    metaPatch?: Partial<ProtocolRoomMeta>
  ): { ok: true; state: RoomStatePayload } | { ok: false } {
    if (requesterId !== this.hostId) return { ok: false };
    if (metaPatch) {
      this.applyMetaPatch(metaPatch);
    }
    this.status = 'playing';
    return { ok: true, state: this.getStatePayload() };
  }

  public updateMeta(
    requesterId: string,
    metaPatch: Partial<ProtocolRoomMeta>,
    ended?: boolean
  ): boolean {
    if (requesterId !== this.hostId) return false;
    this.applyMetaPatch(metaPatch);
    if (ended) {
      this.status = 'ended';
    }
    return true;
  }

  public updateSnapshot(requesterId: string, snapshot: Record<string, unknown>): boolean {
    if (requesterId !== this.hostId) return false;
    this.cachedSnapshot = snapshot;
    return true;
  }

  public evaluateLockReason(): ProtocolDropInLockReason {
    if (this.status === 'ended') return 'ended';
    if (this.members.size >= this.meta.maxPlayers) return 'room_full';
    if (!this.meta.allowDropIn) return 'host_locked';

    if (this.status === 'playing') {
      const safeTarget = Math.max(1, this.meta.targetCount);
      if (Math.max(0, this.meta.currentCount) / safeTarget >= LATE_GAME_PROGRESS_RATIO) {
        return 'late_game_progress';
      }
      if (this.meta.timeLimitSec !== null && this.meta.timeLimitSec > 0) {
        const remainingSec = Math.max(0, this.meta.timeLimitSec - Math.max(0, this.meta.elapsedSec));
        if (remainingSec < LATE_GAME_REMAINING_SEC) {
          return 'late_game_time';
        }
      }
    }

    return 'open';
  }

  public getStatePayload(): RoomStatePayload {
    const members = Array.from(this.members.values())
      .sort((a, b) => a.joinedAt - b.joinedAt || a.playerId.localeCompare(b.playerId))
      .map((m) => ({ ...m, isHost: m.playerId === this.hostId }));

    return {
      roomId: this.roomId,
      inviteCode: this.inviteCode,
      status: this.status,
      hostId: this.hostId,
      hostEpoch: this.hostEpoch,
      maxPlayers: this.meta.maxPlayers,
      members,
      meta: { ...this.meta },
      hasCachedSnapshot: this.cachedSnapshot !== null,
    };
  }

  public toPublicListing(nowMs = Date.now()): ProtocolPublicRoomListing | null {
    if (this.members.size === 0 || this.status === 'ended') return null;
    const host = this.members.get(this.hostId);
    if (!host) return null;

    return {
      roomId: this.roomId,
      inviteCode: this.inviteCode,
      hostPlayerId: host.playerId,
      hostName: host.name,
      missionId: this.meta.missionId,
      missionTitle: this.meta.missionTitle,
      difficulty: this.meta.difficulty,
      status: this.status,
      currentPlayers: this.members.size,
      maxPlayers: this.meta.maxPlayers,
      currentCount: this.meta.currentCount,
      targetCount: this.meta.targetCount,
      elapsedSec: this.meta.elapsedSec,
      timeLimitSec: this.meta.timeLimitSec,
      allowDropIn: this.meta.allowDropIn,
      lockReason: this.evaluateLockReason(),
      hostAppVersion: host.appVersion,
      updatedAt: nowMs,
    };
  }

  private applyMetaPatch(patch: Partial<ProtocolRoomMeta>): void {
    const nextMax =
      typeof patch.maxPlayers === 'number' && patch.maxPlayers >= 1
        ? Math.min(DEFAULT_MAX_PLAYERS, Math.floor(patch.maxPlayers))
        : this.meta.maxPlayers;

    this.meta = {
      ...this.meta,
      ...patch,
      roomId: this.roomId,
      inviteCode: (patch.inviteCode || this.inviteCode).toUpperCase(),
      maxPlayers: nextMax,
    };
    this.inviteCode = this.meta.inviteCode;
  }

  private reconcileHost(): boolean {
    const allMembers = Array.from(this.members.values()).sort(
      (a, b) => a.joinedAt - b.joinedAt || a.playerId.localeCompare(b.playerId)
    );
    if (allMembers.length === 0) {
      this.hostId = '';
      return true;
    }

    const currentHost = this.members.get(this.hostId);
    const foregroundMembers = allMembers.filter((m) => !m.isBackground);

    let nextHostId = this.hostId;
    if (currentHost && !currentHost.isBackground) {
      nextHostId = currentHost.playerId;
    } else if (foregroundMembers.length > 0) {
      nextHostId = foregroundMembers[0].playerId;
    } else {
      nextHostId = allMembers[0].playerId;
    }

    const changed = nextHostId !== this.hostId;
    if (changed) {
      this.hostId = nextHostId;
      this.hostEpoch += 1;
    }

    for (const member of this.members.values()) {
      member.isHost = member.playerId === this.hostId;
    }
    return changed;
  }
}
