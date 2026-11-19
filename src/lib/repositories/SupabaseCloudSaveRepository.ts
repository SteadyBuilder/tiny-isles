import { AccountSaveSnapshot } from '../../types/auth';
import { MetaProgressionState } from '../../types/metaProgression';
import { normalizeMetaProgression } from '../accountMergeUtils';
import { ICloudSaveRepository } from '../contracts/ICloudSaveRepository';
import { SavedProfile } from '../storage';
import { supabase } from '../supabase';

interface UserAccountRow {
  user_id: string;
  profile: Partial<SavedProfile> | null;
  meta_progression: Partial<MetaProgressionState> | null;
  legacy_guest_id: string | null;
  updated_at: string;
}

function normalizeProfile(raw: Partial<SavedProfile> | null | undefined): SavedProfile {
  const name =
    typeof raw?.name === 'string' && raw.name.trim().length > 0 ? raw.name.trim() : '수호자';
  const color = raw?.color === 'red' ? 'red' : 'blue';
  return {
    id: typeof raw?.id === 'string' ? raw.id : undefined,
    name,
    color,
  };
}

/**
 * Supabase `public.user_accounts` 테이블 기반 클라우드 세이브 저장소
 */
export class SupabaseCloudSaveRepository implements ICloudSaveRepository {
  public async loadAccountSave(userId: string): Promise<AccountSaveSnapshot | null> {
    const { data, error } = await supabase
      .from('user_accounts')
      .select('user_id, profile, meta_progression, legacy_guest_id, updated_at')
      .eq('user_id', userId)
      .maybeSingle<UserAccountRow>();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) return null;

    return {
      profile: normalizeProfile(data.profile),
      meta: normalizeMetaProgression(data.meta_progression),
      updatedAt: data.updated_at || new Date().toISOString(),
      legacyGuestId: data.legacy_guest_id ?? undefined,
    };
  }

  public async saveAccountSave(userId: string, snapshot: AccountSaveSnapshot): Promise<void> {
    const payload = {
      user_id: userId,
      profile: normalizeProfile(snapshot.profile),
      meta_progression: normalizeMetaProgression(snapshot.meta),
      legacy_guest_id: snapshot.legacyGuestId ?? null,
      updated_at: snapshot.updatedAt || new Date().toISOString(),
    };

    const { error } = await supabase
      .from('user_accounts')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) {
      throw new Error(error.message);
    }
  }
}

export const cloudSaveRepository: ICloudSaveRepository = new SupabaseCloudSaveRepository();
