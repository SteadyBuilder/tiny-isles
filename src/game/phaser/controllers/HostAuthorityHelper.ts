import { RoomMember } from '../../../types/room';

export interface PresenceEntryMeta {
  joinedAt?: number;
  isBackground?: boolean;
  claimedEpoch?: number;
}

export function extractLatestPresenceMeta(
  entries: PresenceEntryMeta[] | undefined
): PresenceEntryMeta | undefined {
  if (!Array.isArray(entries) || entries.length === 0) return undefined;
  return entries[entries.length - 1];
}

function normalizeJoinedAt(meta: PresenceEntryMeta | undefined): number {
  return typeof meta?.joinedAt === 'number' && Number.isFinite(meta.joinedAt)
    ? meta.joinedAt
    : Number.MAX_SAFE_INTEGER;
}

function normalizeClaimedEpoch(meta: PresenceEntryMeta | undefined): number {
  return typeof meta?.claimedEpoch === 'number' &&
    Number.isFinite(meta.claimedEpoch) &&
    meta.claimedEpoch > 0
    ? Math.floor(meta.claimedEpoch)
    : 0;
}

/**
 * Supabase Presence 상태에서 결정론적으로 호스트(방장)를 선출합니다.
 * 우선순위:
 * 1) 포그라운드 활성 유저(isBackground !== true) 최우선
 * 2) 더 높은 장애복구 승계 에폭(claimedEpoch) 우선
 * 3) 로비에서 확정된 방장(preferredHostId) 우선 (동일 에폭일 때 시계 오차/입장 순서 무관)
 * 4) 먼저 접속한 유저(joinedAt 오름차순)
 * 5) playerId 사전순 타이브레이크
 */
export function electHostFromPresence(
  presenceState: Record<string, PresenceEntryMeta[]>,
  localPlayerId: string,
  preferredHostId?: string
): { isHost: boolean; hostId: string; onlineCount: number } {
  const keys = Object.keys(presenceState);
  if (keys.length === 0) {
    return { isHost: true, hostId: localPlayerId, onlineCount: 1 };
  }

  const candidates = keys.map((id) => {
    const latest = extractLatestPresenceMeta(presenceState[id]);
    const rawEpoch = normalizeClaimedEpoch(latest);
    const isPreferredLobbyHost = Boolean(preferredHostId) && id === preferredHostId;
    return {
      id,
      isBackground: latest?.isBackground === true ? 1 : 0,
      // 로비 지정 방장이 포그라운드에 존재할 때는 최소 에폭 1을 보장해 게스트 시계 오차나 초기 지연에도 권한을 유지
      claimedEpoch: isPreferredLobbyHost && latest?.isBackground !== true ? Math.max(1, rawEpoch) : rawEpoch,
      isPreferred: isPreferredLobbyHost ? 1 : 0,
      joinedAt: normalizeJoinedAt(latest),
    };
  });

  candidates.sort(
    (a, b) =>
      a.isBackground - b.isBackground ||
      b.claimedEpoch - a.claimedEpoch ||
      b.isPreferred - a.isPreferred ||
      a.joinedAt - b.joinedAt ||
      a.id.localeCompare(b.id)
  );
  const hostId = candidates[0]?.id ?? localPlayerId;

  return {
    isHost: hostId === localPlayerId,
    hostId,
    onlineCount: Math.max(1, keys.length),
  };
}

/**
 * 현재 Presence 상태에 등록된 가장 높은 호스트 승계 에폭(claimedEpoch)을 반환합니다.
 */
export function computeMaxClaimedEpoch(
  presenceState: Record<string, PresenceEntryMeta[]>
): number {
  let maxEpoch = 0;
  for (const entries of Object.values(presenceState)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const epoch = normalizeClaimedEpoch(entry);
      if (epoch > maxEpoch) {
        maxEpoch = epoch;
      }
    }
  }
  return maxEpoch;
}

/**
 * 무응답 호스트(stalledHostId)를 제외하고 포그라운드 활성 후보 중
 * localPlayerId의 0-based 승계 우선순위(rank)를 계산합니다. 후보 자격이 없으면 -1을 반환합니다.
 */
export function computeNextFailoverRank(
  members: ReadonlyArray<RoomMember>,
  localPlayerId: string,
  stalledHostId: string
): number {
  const eligible = members
    .filter((m) => m.playerId !== stalledHostId && m.isBackground !== true)
    .sort((a, b) => {
      const epochA = a.claimedEpoch ?? 0;
      const epochB = b.claimedEpoch ?? 0;
      return epochB - epochA || a.joinedAt - b.joinedAt || a.playerId.localeCompare(b.playerId);
    });
  return eligible.findIndex((m) => m.playerId === localPlayerId);
}

/**
 * 후발 접속자의 PC 시스템 시계가 과거로 설정되어 있어도
 * 기존 접속자보다 앞선 joinedAt으로 호스트를 탈취하지 않도록 단조 증가 값을 계산합니다.
 */
export function computeMonotonicJoinedAt(
  presenceState: Record<string, PresenceEntryMeta[]>,
  now: number = Date.now()
): number {
  let maxExistingJoinedAt = 0;
  for (const entries of Object.values(presenceState)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (typeof entry?.joinedAt === 'number' && Number.isFinite(entry.joinedAt)) {
        if (entry.joinedAt > maxExistingJoinedAt) {
          maxExistingJoinedAt = entry.joinedAt;
        }
      }
    }
  }
  return maxExistingJoinedAt > 0 ? Math.max(now, maxExistingJoinedAt + 1) : now;
}
