import { Inventory, PlayerColor } from '../types/game';

const STORAGE_KEYS = {
  PROFILE: 'tiny_isles_profile',
  INVENTORY: 'tiny_isles_inventory',
  UNLOCKED_ISLANDS: 'tiny_isles_unlocked_islands',
  ZOOM: 'tiny_isles_zoom',
} as const;

export interface SavedProfile {
  name: string;
  color: PlayerColor;
}

const DEFAULT_INVENTORY: Inventory = {
  wood: 5,
  stone: 2,
  gold: 0,
};

export const storage = {
  loadProfile: (): SavedProfile => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROFILE);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.name && (parsed.color === 'blue' || parsed.color === 'red')) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load profile from localStorage:', e);
    }
    // 기본값 생성
    const defaultProfile: SavedProfile = {
      name: '모험가_' + Math.floor(100 + Math.random() * 900),
      color: Math.random() > 0.5 ? 'blue' : 'red',
    };
    storage.saveProfile(defaultProfile);
    return defaultProfile;
  },

  saveProfile: (profile: SavedProfile): void => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    } catch (e) {
      console.warn('Failed to save profile to localStorage:', e);
    }
  },

  loadInventory: (): Inventory => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.INVENTORY);
      if (data) {
        const parsed = JSON.parse(data);
        if (
          typeof parsed.wood === 'number' &&
          typeof parsed.stone === 'number' &&
          typeof parsed.gold === 'number'
        ) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load inventory from localStorage:', e);
    }
    return DEFAULT_INVENTORY;
  },

  saveInventory: (inventory: Inventory): void => {
    try {
      localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(inventory));
    } catch (e) {
      console.warn('Failed to save inventory to localStorage:', e);
    }
  },

  loadUnlockedIslands: (): number[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.UNLOCKED_ISLANDS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load unlocked islands from localStorage:', e);
    }
    return [0]; // 시작의 섬(0번)은 기본 해금
  },

  saveUnlockedIslands: (islandIds: number[]): void => {
    try {
      localStorage.setItem(STORAGE_KEYS.UNLOCKED_ISLANDS, JSON.stringify(islandIds));
    } catch (e) {
      console.warn('Failed to save unlocked islands to localStorage:', e);
    }
  },

  loadZoom: (): number => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ZOOM);
      if (data) {
        const parsed = parseFloat(data);
        if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 2.0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load zoom from localStorage:', e);
    }
    return 1.0;
  },

  saveZoom: (zoom: number): void => {
    try {
      localStorage.setItem(STORAGE_KEYS.ZOOM, zoom.toFixed(2));
    } catch (e) {
      console.warn('Failed to save zoom to localStorage:', e);
    }
  },

  resetAll: (): void => {
    try {
      localStorage.removeItem(STORAGE_KEYS.PROFILE);
      localStorage.removeItem(STORAGE_KEYS.INVENTORY);
      localStorage.removeItem(STORAGE_KEYS.UNLOCKED_ISLANDS);
      localStorage.removeItem(STORAGE_KEYS.ZOOM);
    } catch (e) {
      console.warn('Failed to reset storage:', e);
    }
  },
};
