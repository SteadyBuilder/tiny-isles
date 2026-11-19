/**
 * Tiny Isles 클라이언트 <-> Cloudflare Durable Objects 공유 멀티플레이 프로토콜 계약
 * - 외부 라이브러리 의존성 없음 (프론트엔드 Vite & Cloudflare Worker 공용)
 */

export type ProtocolPlayerColor = 'blue' | 'red';
export type ProtocolDifficultyId = 'normal' | 'hard' | 'nightmare';
export type ServerRoomStatus = 'waiting' | 'playing' | 'ended';

export type RoomRejectReason =
  | 'ROOM_FULL'
  | 'VERSION_MISMATCH'
  | 'GAME_LOCKED'
  | 'ROOM_NOT_FOUND'
  | 'INVALID_JOIN';

export type ProtocolDropInLockReason =
  | 'open'
  | 'room_full'
  | 'late_game_progress'
  | 'late_game_time'
  | 'host_locked'
  | 'ended';

export interface ProtocolRoomMember {
  playerId: string;
  name: string;
  color: ProtocolPlayerColor;
  isHost: boolean;
  joinedAt: number;
  isBackground?: boolean;
  appVersion?: string;
}

export interface ProtocolRoomMeta {
  roomId: string;
  inviteCode: string;
  missionId: string;
  missionTitle: string;
  difficulty: ProtocolDifficultyId;
  maxPlayers: number;
  allowDropIn: boolean;
  currentCount: number;
  targetCount: number;
  elapsedSec: number;
  timeLimitSec: number | null;
}

export interface ProtocolPublicRoomListing {
  roomId: string;
  inviteCode: string;
  hostPlayerId: string;
  hostName: string;
  missionId: string;
  missionTitle: string;
  difficulty: ProtocolDifficultyId;
  status: 'waiting' | 'playing';
  currentPlayers: number;
  maxPlayers: number;
  currentCount: number;
  targetCount: number;
  elapsedSec: number;
  timeLimitSec: number | null;
  allowDropIn: boolean;
  lockReason: ProtocolDropInLockReason;
  hostAppVersion?: string;
  updatedAt: number;
}

export interface BatchedGameEvent {
  event: string;
  payload: Record<string, unknown>;
}

export interface RoomStatePayload {
  roomId: string;
  inviteCode: string;
  status: ServerRoomStatus;
  hostId: string;
  hostEpoch: number;
  maxPlayers: number;
  members: ProtocolRoomMember[];
  meta: ProtocolRoomMeta;
  hasCachedSnapshot: boolean;
}

export type ClientToServerMessage =
  | {
      type: 'join';
      playerId: string;
      name: string;
      color: ProtocolPlayerColor;
      appVersion?: string;
      /** 방 최초 생성자일 경우 초기 방 메타데이터 전달 */
      initialMeta?: Partial<ProtocolRoomMeta>;
      /** 초대 코드로 기존 방만 입장하려 할 때(방이 없으면 거절) */
      requireExisting?: boolean;
    }
  | {
      type: 'start_game';
      roomConfig: Record<string, unknown>;
      meta?: Partial<ProtocolRoomMeta>;
    }
  | {
      type: 'room_meta_update';
      meta: Partial<ProtocolRoomMeta>;
      ended?: boolean;
    }
  | {
      type: 'background_state';
      isBackground: boolean;
    }
  | {
      type: 'game_event';
      event: string;
      payload: Record<string, unknown>;
      /** 특정 대상 플레이어에게만 전송할 때 지정 (생략 시 본인 제외 전원 브로드캐스트) */
      targetPlayerId?: string;
    }
  | {
      type: 'game_batch';
      events: BatchedGameEvent[];
    }
  | {
      type: 'snapshot_upload';
      snapshot: Record<string, unknown>;
    }
  | {
      type: 'request_snapshot';
    }
  | {
      type: 'ping';
    };

export type ServerToClientMessage =
  | {
      type: 'room_state';
      state: RoomStatePayload;
    }
  | {
      type: 'join_rejected';
      reason: RoomRejectReason;
      message: string;
      hostAppVersion?: string;
    }
  | {
      type: 'game_started';
      roomConfig: Record<string, unknown>;
      state: RoomStatePayload;
    }
  | {
      type: 'game_event';
      senderId: string;
      event: string;
      payload: Record<string, unknown>;
    }
  | {
      type: 'game_batch';
      senderId: string;
      events: BatchedGameEvent[];
    }
  | {
      type: 'snapshot_sync';
      snapshot: Record<string, unknown>;
      hostId: string;
      hostEpoch: number;
    }
  | {
      type: 'player_left';
      playerId: string;
    }
  | {
      type: 'pong';
    };

export type DirectoryServerMessage =
  | {
      type: 'directory_sync';
      rooms: ProtocolPublicRoomListing[];
    };

export function getRoomRejectReasonLabel(reason: RoomRejectReason): string {
  switch (reason) {
    case 'ROOM_FULL':
      return '방 정원이 가득 찼습니다 (4/4).';
    case 'VERSION_MISMATCH':
      return '방장과 게임 버전이 다릅니다. 새로고침 후 다시 입장해 주세요.';
    case 'GAME_LOCKED':
      return '이미 종반부에 진입했거나 난입이 잠긴 방입니다.';
    case 'ROOM_NOT_FOUND':
      return '해당 초대 코드의 활성 방을 찾을 수 없습니다.';
    case 'INVALID_JOIN':
      return '유효하지 않은 방 입장 요청입니다.';
  }
}

export function isDevProtocolVersion(version?: string): boolean {
  if (!version) return false;
  const normalized = version.trim().toLowerCase();
  return normalized === 'dev' || normalized.startsWith('dev-') || normalized === 'local';
}
