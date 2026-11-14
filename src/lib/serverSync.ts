import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import {
  ConstructedBuilding,
  Inventory,
  Player,
  ServerIslandRecord,
  ServerPlayerRecord,
  VillageTier,
} from '../types/game';
import { SavedProfile } from './storage';

let tablesMissingNotified = false;

function warnTableMissing(tableName: string, details?: string) {
  if (!tablesMissingNotified) {
    console.info(
      `ℹ️ [Tiny Isles] Supabase DB 테이블(${tableName}) 미존재. ` +
      `supabase/schema.sql 실행 전까지는 로컬 스토리지 및 Realtime Broadcast로 동작합니다.`,
      details
    );
    tablesMissingNotified = true;
  }
}

// 레이스 컨디션 및 중복 브로드캐스트 필터링용 캐시
const recentEvents = new Set<string>();
const lastMoveTimestamps = new Map<string, number>();

export const serverSync = {
  // --- 1. Supabase DB 영구 저장 동기화 ---
  fetchUnlockedIslands: async (): Promise<ServerIslandRecord[] | null> => {
    try {
      const { data, error } = await supabase
        .from('unlocked_islands')
        .select('island_id, island_name, unlocked_by, unlocked_at')
        .order('island_id', { ascending: true });
      if (error) {
        if (error.code === '42P01' || error.message?.includes('Could not find the table')) {
          warnTableMissing('unlocked_islands', error.message);
        }
        return null;
      }
      return data as ServerIslandRecord[];
    } catch {
      return null;
    }
  },

  saveUnlockedIsland: async (islandId: number, islandName: string, unlockedBy: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('unlocked_islands').upsert(
        { island_id: islandId, island_name: islandName, unlocked_by: unlockedBy || '탐험가', unlocked_at: new Date().toISOString() },
        { onConflict: 'island_id', ignoreDuplicates: true }
      );
      if (error && (error.code === '42P01' || error.message?.includes('Could not find the table'))) {
        warnTableMissing('unlocked_islands', error.message);
        return false;
      }
      return !error;
    } catch {
      return false;
    }
  },

  fetchPlayer: async (playerId: string): Promise<ServerPlayerRecord | null> => {
    try {
      const { data, error } = await supabase.from('players').select('*').eq('id', playerId).maybeSingle();
      if (error && (error.code === '42P01' || error.message?.includes('Could not find the table'))) {
        warnTableMissing('players', error.message);
      }
      return data as ServerPlayerRecord | null;
    } catch {
      return null;
    }
  },

  savePlayer: (playerId: string, profile: SavedProfile, inventory: Inventory, immediate = false) => {
    playerSyncManager.schedule(playerId, profile, inventory, immediate);
  },

  flushPlayerSync: () => {
    playerSyncManager.flush();
  },

  // --- 2. Realtime Broadcast 멀티플레이어 동기화 ---
  broadcast: <T extends object>(
    channel: RealtimeChannel | null,
    event: string,
    payload: T,
    senderId: string
  ) => {
    if (!channel) return;
    const eventId = `${event}_${senderId}_${Date.now()}`;
    channel.send({
      type: 'broadcast',
      event,
      payload: { ...payload, senderId, eventId, timestamp: Date.now() },
    });
  },

  // 중복 이벤트 및 레이스 컨디션 검증 필터 (수신 측)
  isValidIncomingEvent: (eventId?: string, senderId?: string, localPlayerId?: string): boolean => {
    if (senderId && localPlayerId && senderId === localPlayerId) return false;
    if (!eventId) return true;
    if (recentEvents.has(eventId)) return false;
    recentEvents.add(eventId);
    if (recentEvents.size > 80) {
      const oldest = recentEvents.values().next().value;
      if (oldest) recentEvents.delete(oldest);
    }
    return true;
  },

  // 고스트 텔레포트 방지: 이전 타임스탬프 이동 패킷 필터링
  isLatestMove: (playerId: string, timestamp: number): boolean => {
    const last = lastMoveTimestamps.get(playerId) || 0;
    if (timestamp < last) return false;
    lastMoveTimestamps.set(playerId, timestamp);
    return true;
  },

  // 고스트 급발진 방지: 보간(Lerp) vs 순간이동(Snap) 판정 (260px 이상 차이 시만 Snap)
  shouldSnapTeleport: (curX: number, curY: number, targetX: number, targetY: number, snapThreshold = 260): boolean => {
    const distSq = (curX - targetX) ** 2 + (curY - targetY) ** 2;
    return distSq > snapThreshold * snapThreshold;
  },

  removePlayerCache: (playerId: string) => {
    lastMoveTimestamps.delete(playerId);
  },
};

// 플레이어 DB 저장 디바운스 매니저
const playerSyncManager = (() => {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let pending: { playerId: string; profile: SavedProfile; inventory: Inventory } | null = null;

  const doSync = async () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (!pending) return;
    const { playerId, profile, inventory } = pending;
    pending = null;
    try {
      const { error } = await supabase.from('players').upsert(
        {
          id: playerId,
          name: profile.name,
          color: profile.color,
          wood: inventory.wood,
          stone: inventory.stone,
          gold: inventory.gold,
          last_active_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
      if (error && (error.code === '42P01' || error.message?.includes('Could not find the table'))) {
        warnTableMissing('players', error.message);
      }
    } catch (e) {
      console.warn('[serverSync] savePlayer error:', e);
    }
  };

  return {
    schedule: (playerId: string, profile: SavedProfile, inventory: Inventory, immediate = false) => {
      pending = { playerId, profile, inventory };
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (immediate) doSync();
      else debounceTimer = setTimeout(doSync, 1500);
    },
    flush: () => {
      if (pending) doSync();
    },
  };
})();
