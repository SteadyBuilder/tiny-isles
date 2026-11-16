import { ADMIN_RESET_CONFIG } from '../data/adminReset';
import { getInitialConstructedBuildings, VILLAGE_TIER_CONFIGS } from '../game/constants';
import { serverSync } from './serverSync';
import { storage } from './storage';
import { supabase } from './supabase';

export interface AdminResetResult {
  ok: boolean;
  errors: string[];
}

let playDataResetting = false;

export function isPlayDataResetting(): boolean {
  return playDataResetting;
}

export function markPlayDataResetting(flag: boolean): void {
  playDataResetting = flag;
}

async function sha256Hex(value: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(value);
    const buffer = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }
  return '';
}

export async function verifyAdminResetCode(inputCode: string): Promise<boolean> {
  const trimmed = inputCode.trim();
  if (!trimmed) return false;

  const envCode = import.meta.env.VITE_ADMIN_RESET_CODE as string | undefined;
  if (envCode && envCode.trim().length > 0) {
    return trimmed === envCode.trim();
  }

  const hash = await sha256Hex(trimmed);
  if (hash) {
    return hash === ADMIN_RESET_CONFIG.defaultPasscodeHash;
  }
  return false;
}

function isTableMissingError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    Boolean(error.message?.includes('Could not find the table'))
  );
}

export async function resetAllPlayData(): Promise<AdminResetResult> {
  const errors: string[] = [];
  markPlayDataResetting(true);
  serverSync.cancelPendingSync();

  const nowIso = new Date().toISOString();
  const initialCoreHp = VILLAGE_TIER_CONFIGS[2].coreMaxHp;
  const initialBuildings = getInitialConstructedBuildings();

  try {
    const { error: worldError } = await supabase.from('world_state').upsert(
      {
        world_id: ADMIN_RESET_CONFIG.worldId,
        last_active_at: nowIso,
        wave_count: 0,
        boss_wave_count: 0,
        unlocked_island_ids: [0],
        island_owners: {},
        village_tiers: { 0: 2 },
        core_hps: { 0: initialCoreHp },
        constructed_buildings: initialBuildings,
        active_monsters: [],
        updated_at: nowIso,
      },
      { onConflict: 'world_id' }
    );
    if (worldError && !isTableMissingError(worldError)) {
      errors.push(`world_state: ${worldError.message}`);
    }
  } catch (err) {
    errors.push(`world_state: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const { error: islandsDeleteError } = await supabase
      .from('unlocked_islands')
      .delete()
      .neq('island_id', 0);
    if (islandsDeleteError && !isTableMissingError(islandsDeleteError)) {
      errors.push(`unlocked_islands(delete): ${islandsDeleteError.message}`);
    }

    const { error: homeIslandError } = await supabase.from('unlocked_islands').upsert(
      {
        island_id: 0,
        island_name: '시작의 섬 (Home Isle)',
        unlocked_by: '시스템',
        unlocked_at: nowIso,
      },
      { onConflict: 'island_id' }
    );
    if (homeIslandError && !isTableMissingError(homeIslandError)) {
      errors.push(`unlocked_islands(home): ${homeIslandError.message}`);
    }
  } catch (err) {
    errors.push(`unlocked_islands: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const { error: playersError } = await supabase.from('players').delete().neq('id', '');
    if (playersError && !isTableMissingError(playersError)) {
      errors.push(`players: ${playersError.message}`);
    }
  } catch (err) {
    errors.push(`players: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const { error: garrisonsError } = await supabase
      .from('player_garrisons')
      .delete()
      .neq('player_id', '');
    if (garrisonsError && !isTableMissingError(garrisonsError)) {
      errors.push(`player_garrisons: ${garrisonsError.message}`);
    }
  } catch (err) {
    errors.push(`player_garrisons: ${err instanceof Error ? err.message : String(err)}`);
  }

  storage.resetAll();

  return {
    ok: errors.length === 0,
    errors,
  };
}
