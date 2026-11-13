import { GARRISON_CONFIG } from '../data/worldRules';
import {
  ConstructedBuilding,
  GarrisonUnit,
  VillageTier,
  WorldSyncState,
} from '../types/game';
import { supabase } from './supabase';

const LOCAL_WORLD_STATE_KEY = 'tiny_isles_world_sync_state';
const LOCAL_GARRISONS_KEY = 'tiny_isles_garrisons';
const DEFAULT_WORLD_ID = 'main_world';

function readLocalWorldState(): WorldSyncState | null {
  try {
    const raw = localStorage.getItem(LOCAL_WORLD_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorldSyncState;
    if (parsed && typeof parsed.lastActiveAt === 'string') {
      return parsed;
    }
  } catch {
    // ignore storage read error
  }
  return null;
}

function writeLocalWorldState(state: WorldSyncState): void {
  try {
    localStorage.setItem(LOCAL_WORLD_STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage write error
  }
}

function readLocalGarrisons(): GarrisonUnit[] {
  try {
    const raw = localStorage.getItem(LOCAL_GARRISONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GarrisonUnit[]) : [];
  } catch {
    return [];
  }
}

function writeLocalGarrisons(units: GarrisonUnit[]): void {
  try {
    localStorage.setItem(LOCAL_GARRISONS_KEY, JSON.stringify(units));
  } catch {
    // ignore storage write error
  }
}

/**
 * 리빙 아일즈 월드 스냅샷 및 비동기 수비대 DB/로컬 폴백 동기화 서비스
 */
export const worldStateSync = {
  fetchWorldState: async (worldId: string = DEFAULT_WORLD_ID): Promise<WorldSyncState | null> => {
    const localFallback = readLocalWorldState();
    try {
      const { data, error } = await supabase
        .from('world_state')
        .select('*')
        .eq('world_id', worldId)
        .maybeSingle();

      if (error || !data) {
        return localFallback;
      }

      const remote: WorldSyncState = {
        worldId: data.world_id ?? worldId,
        lastActiveAt: data.last_active_at ?? new Date().toISOString(),
        waveCount: Number(data.wave_count ?? 0),
        bossWaveCount: Number(data.boss_wave_count ?? 0),
        unlockedIslandIds: Array.isArray(data.unlocked_island_ids)
          ? (data.unlocked_island_ids as number[])
          : [0],
        villageTiers: (data.village_tiers as Record<number, VillageTier>) ?? { 0: 2 },
        coreHps: (data.core_hps as Record<number, number>) ?? { 0: 350 },
        constructedBuildings: Array.isArray(data.constructed_buildings)
          ? (data.constructed_buildings as ConstructedBuilding[])
          : [],
      };

      // 로컬 기록이 더 최신이면(DB 테이블 미생성 또는 오프라인 테스트 시) 더 최신 시점 채택
      if (
        localFallback &&
        Date.parse(localFallback.lastActiveAt) > Date.parse(remote.lastActiveAt)
      ) {
        return localFallback;
      }
      return remote;
    } catch {
      return localFallback;
    }
  },

  saveWorldState: async (state: WorldSyncState): Promise<boolean> => {
    writeLocalWorldState(state);
    try {
      const { error } = await supabase.from('world_state').upsert(
        {
          world_id: state.worldId,
          last_active_at: state.lastActiveAt,
          wave_count: state.waveCount,
          boss_wave_count: state.bossWaveCount,
          unlocked_island_ids: state.unlockedIslandIds,
          village_tiers: state.villageTiers,
          core_hps: state.coreHps,
          constructed_buildings: state.constructedBuildings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'world_id' }
      );
      return !error;
    } catch {
      return false;
    }
  },

  fetchGarrisons: async (excludePlayerId?: string): Promise<GarrisonUnit[]> => {
    const staleCutoffMs = Date.now() - GARRISON_CONFIG.staleDays * 24 * 60 * 60 * 1000;
    const filterGarrisons = (list: GarrisonUnit[]): GarrisonUnit[] =>
      list
        .filter((g) => {
          if (excludePlayerId && g.playerId === excludePlayerId) return false;
          const updated = Date.parse(g.updatedAt);
          return Number.isNaN(updated) || updated >= staleCutoffMs;
        })
        .slice(0, GARRISON_CONFIG.maxActiveGarrisons);

    const localList = readLocalGarrisons();
    try {
      const { data, error } = await supabase
        .from('player_garrisons')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(GARRISON_CONFIG.maxActiveGarrisons + 4);

      if (error || !data) {
        return filterGarrisons(localList);
      }

      const remoteList: GarrisonUnit[] = data.map((row: Record<string, unknown>) => ({
        playerId: String(row.player_id ?? ''),
        name: String(row.name ?? '수비대'),
        color: row.color === 'red' ? 'red' : 'blue',
        territoryId: Number(row.territory_id ?? 0),
        x: Number(row.x ?? 320),
        y: Number(row.y ?? 350),
        power: Number(row.power ?? GARRISON_CONFIG.offlineDefensePowerPerGarrison),
        updatedAt: String(row.updated_at ?? new Date().toISOString()),
      }));

      writeLocalGarrisons(remoteList);
      return filterGarrisons(remoteList);
    } catch {
      return filterGarrisons(localList);
    }
  },

  saveGarrison: async (unit: GarrisonUnit): Promise<boolean> => {
    const existing = readLocalGarrisons().filter((g) => g.playerId !== unit.playerId);
    writeLocalGarrisons([unit, ...existing].slice(0, 12));

    try {
      const { error } = await supabase.from('player_garrisons').upsert(
        {
          player_id: unit.playerId,
          name: unit.name,
          color: unit.color,
          territory_id: unit.territoryId,
          x: unit.x,
          y: unit.y,
          power: unit.power,
          updated_at: unit.updatedAt,
        },
        { onConflict: 'player_id' }
      );
      return !error;
    } catch {
      return false;
    }
  },
};
