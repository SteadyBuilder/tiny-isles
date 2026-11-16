import { DEFAULT_META_PROGRESSION } from '../../data/metaProgression';
import { MetaProgressionState } from '../../types/room';
import { ISaveRepository } from '../contracts/ISaveRepository';
import { SavedProfile, storage } from '../storage';

const META_PROGRESSION_KEY = 'tiny_isles_meta_progression_v1';

/**
 * 브라우저 localStorage 기반 저장소 구현체 (오프라인 솔플 및 웹 테스트용)
 */
export class LocalStorageSaveRepository implements ISaveRepository {
  public getPlayerId(): string {
    return storage.getPlayerId();
  }

  public loadProfile(): SavedProfile {
    return storage.loadProfile();
  }

  public saveProfile(profile: SavedProfile): void {
    storage.saveProfile(profile);
  }

  public loadZoom(): number {
    return storage.loadZoom();
  }

  public saveZoom(zoom: number): void {
    storage.saveZoom(zoom);
  }

  public loadMetaProgression(): MetaProgressionState {
    try {
      const raw = localStorage.getItem(META_PROGRESSION_KEY);
      if (!raw) return { ...DEFAULT_META_PROGRESSION, traitLevels: { ...DEFAULT_META_PROGRESSION.traitLevels } };
      const parsed = JSON.parse(raw) as Partial<MetaProgressionState>;
      return {
        points: typeof parsed.points === 'number' ? parsed.points : 0,
        totalClears: typeof parsed.totalClears === 'number' ? parsed.totalClears : 0,
        traitLevels: {
          ...DEFAULT_META_PROGRESSION.traitLevels,
          ...(parsed.traitLevels ?? {}),
        },
        unlockedTitleIds: Array.isArray(parsed.unlockedTitleIds)
          ? parsed.unlockedTitleIds
          : [...DEFAULT_META_PROGRESSION.unlockedTitleIds],
        equippedTitleId:
          typeof parsed.equippedTitleId === 'string'
            ? parsed.equippedTitleId
            : DEFAULT_META_PROGRESSION.equippedTitleId,
        clearedMissionIds: Array.isArray(parsed.clearedMissionIds)
          ? parsed.clearedMissionIds
          : [],
      };
    } catch {
      return { ...DEFAULT_META_PROGRESSION, traitLevels: { ...DEFAULT_META_PROGRESSION.traitLevels } };
    }
  }

  public saveMetaProgression(state: MetaProgressionState): void {
    try {
      localStorage.setItem(META_PROGRESSION_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save meta progression:', e);
    }
  }
}

export const saveRepository: ISaveRepository = new LocalStorageSaveRepository();
