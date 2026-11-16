export interface PresenceEntryMeta {
  joinedAt?: number;
}

/**
 * Supabase Presence 상태에서 가장 먼저 접속한 플레이어를 결정론적으로 호스트(방장)로 선출합니다.
 * 동일 시각 접속 시 playerId 사전순으로 타이브레이크합니다.
 */
export function electHostFromPresence(
  presenceState: Record<string, PresenceEntryMeta[]>,
  localPlayerId: string
): { isHost: boolean; hostId: string; onlineCount: number } {
  const keys = Object.keys(presenceState);
  if (keys.length === 0) {
    return { isHost: true, hostId: localPlayerId, onlineCount: 1 };
  }

  const candidates = keys.map((id) => {
    const entries = presenceState[id];
    const joinedAt =
      Array.isArray(entries) && entries.length > 0 && typeof entries[0]?.joinedAt === 'number'
        ? entries[0].joinedAt
        : Number.MAX_SAFE_INTEGER;
    return { id, joinedAt };
  });

  candidates.sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
  const hostId = candidates[0]?.id ?? localPlayerId;

  return {
    isHost: hostId === localPlayerId,
    hostId,
    onlineCount: Math.max(1, keys.length),
  };
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
