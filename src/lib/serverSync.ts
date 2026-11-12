import { supabase } from './supabase';
import { Inventory, ServerIslandRecord, ServerPlayerRecord } from '../types/game';
import { SavedProfile } from './storage';

let tablesMissingNotified = false;

function warnTableMissing(tableName: string, details?: string) {
  if (!tablesMissingNotified) {
    console.info(
      `ℹ️ [Tiny Isles] Supabase DB 테이블(${tableName})을 찾을 수 없습니다. ` +
      `supabase/schema.sql을 실행하면 서버 기반 전체 공유가 활성화됩니다. 현재는 로컬 저장 및 실시간 브로드캐스트로 동작합니다.`,
      details
    );
    tablesMissingNotified = true;
  }
}

export const serverSync = {
  /**
   * 서버에서 해금된 섬 목록을 조회합니다.
   */
  fetchUnlockedIslands: async (): Promise<ServerIslandRecord[] | null> => {
    try {
      const { data, error } = await supabase
        .from('unlocked_islands')
        .select('island_id, island_name, unlocked_by, unlocked_at')
        .order('island_id', { ascending: true });

      if (error) {
        if (error.code === '42P01' || error.message?.includes('Could not find the table')) {
          warnTableMissing('unlocked_islands', error.message);
        } else {
          console.warn('[serverSync] fetchUnlockedIslands error:', error.message);
        }
        return null;
      }

      return data as ServerIslandRecord[];
    } catch (e) {
      console.warn('[serverSync] fetchUnlockedIslands exception:', e);
      return null;
    }
  },

  /**
   * 섬 해금 상태를 서버 DB에 영구 저장합니다.
   */
  saveUnlockedIsland: async (
    islandId: number,
    islandName: string,
    unlockedBy: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase.from('unlocked_islands').upsert(
        {
          island_id: islandId,
          island_name: islandName,
          unlocked_by: unlockedBy || '익명의 모험가',
          unlocked_at: new Date().toISOString(),
        },
        { onConflict: 'island_id', ignoreDuplicates: true }
      );

      if (error) {
        if (error.code === '42P01' || error.message?.includes('Could not find the table')) {
          warnTableMissing('unlocked_islands', error.message);
        } else {
          console.warn('[serverSync] saveUnlockedIsland error:', error.message);
        }
        return false;
      }

      return true;
    } catch (e) {
      console.warn('[serverSync] saveUnlockedIsland exception:', e);
      return false;
    }
  },

  /**
   * 플레이어 정보를 서버에서 조회합니다.
   */
  fetchPlayer: async (playerId: string): Promise<ServerPlayerRecord | null> => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .maybeSingle();

      if (error) {
        if (error.code === '42P01' || error.message?.includes('Could not find the table')) {
          warnTableMissing('players', error.message);
        }
        return null;
      }

      return data as ServerPlayerRecord | null;
    } catch (e) {
      console.warn('[serverSync] fetchPlayer exception:', e);
      return null;
    }
  },

  /**
   * 플레이어 정보 및 자원을 서버 DB에 동기화합니다 (디바운스 지원).
   */
  savePlayer: (playerId: string, profile: SavedProfile, inventory: Inventory, immediate = false) => {
    playerSyncManager.schedule(playerId, profile, inventory, immediate);
  },

  /**
   * 탭 종료 또는 즉각 저장이 필요할 때 대기 중인 동기화 데이터를 즉시 전송합니다.
   */
  flushPlayerSync: () => {
    playerSyncManager.flush();
  },
};

const playerSyncManager = (() => {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingData: {
    playerId: string;
    profile: SavedProfile;
    inventory: Inventory;
  } | null = null;

  const doSync = async () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (!pendingData) return;
    const { playerId, profile, inventory } = pendingData;
    pendingData = null;

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
      console.warn('[serverSync] savePlayer exception:', e);
    }
  };

  return {
    schedule: (playerId: string, profile: SavedProfile, inventory: Inventory, immediate = false) => {
      pendingData = { playerId, profile, inventory };
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }

      if (immediate) {
        doSync();
      } else {
        debounceTimer = setTimeout(doSync, 1500);
      }
    },
    flush: () => {
      if (pendingData) {
        doSync();
      }
    },
  };
})();
