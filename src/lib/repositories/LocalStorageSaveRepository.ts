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
      if (!raw) {
        return {
          ...DEFAULT_META_PROGRESSION,
          traitLevels: { ...DEFAULT_META_PROGRESSION.traitLevels },
          unlockedCostumeIds: [...DEFAULT_META_PROGRESSION.unlockedCostumeIds],
          unlockedAuraIds: [...DEFAULT_META_PROGRESSION.unlockedAuraIds],
        };
      }
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
        unlockedCostumeIds:
          Array.isArray(parsed.unlockedCostumeIds) && parsed.unlockedCostumeIds.length > 0
            ? parsed.unlockedCostumeIds
            : [...DEFAULT_META_PROGRESSION.unlockedCostumeIds],
        equippedCostumeId:
          typeof parsed.equippedCostumeId === 'string'
            ? parsed.equippedCostumeId
            : DEFAULT_META_PROGRESSION.equippedCostumeId,
        unlockedAuraIds:
          Array.isArray(parsed.unlockedAuraIds) && parsed.unlockedAuraIds.length > 0
            ? parsed.unlockedAuraIds
            : [...DEFAULT_META_PROGRESSION.unlockedAuraIds],
        equippedAuraId:
          typeof parsed.equippedAuraId === 'string'
            ? parsed.equippedAuraId
            : DEFAULT_META_PROGRESSION.equippedAuraId,
        clearedMissionIds: Array.isArray(parsed.clearedMissionIds)
          ? parsed.clearedMissionIds
          : [],
      };
    } catch {
      return {
        ...DEFAULT_META_PROGRESSION,
        traitLevels: { ...DEFAULT_META_PROGRESSION.traitLevels },
        unlockedCostumeIds: [...DEFAULT_META_PROGRESSION.unlockedCostumeIds],
        unlockedAuraIds: [...DEFAULT_META_PROGRESSION.unlockedAuraIds],
      };
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
