import {
  ConstructedBuilding,
  Inventory,
  PlayerColor,
  VillageTier,
} from '../types/game';
import { getInitialConstructedBuildings, VILLAGE_TIER_CONFIGS } from '../game/constants';

const STORAGE_KEYS = {
  PROFILE: 'tiny_isles_profile',
  PLAYER_ID: 'tiny_isles_player_id',
  INVENTORY: 'tiny_isles_inventory',
  UNLOCKED_ISLANDS: 'tiny_isles_unlocked_islands',
  VILLAGE_TIERS: 'tiny_isles_village_tiers',
  CONSTRUCTED_BUILDINGS: 'tiny_isles_constructed_buildings',
  CORE_HPS: 'tiny_isles_core_hps',
  ZOOM: 'tiny_isles_zoom',
} as const;

export interface SavedProfile {
  id?: string;
  name: string;
  color: PlayerColor;
}

const DEFAULT_INVENTORY: Inventory = {
  wood: 30,
  stone: 20,
  gold: 10,
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
    const defaultProfile: SavedProfile = {
      name: '수호자_' + Math.floor(100 + Math.random() * 900),
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
          return parsed.includes(0) ? parsed : [0, ...parsed];
        }
      }
    } catch (e) {
      console.warn('Failed to load unlocked islands from localStorage:', e);
    }
    return [0]; // 중심 마을(0번)은 기본 점령 상태
  },

  saveUnlockedIslands: (islandIds: number[]): void => {
    try {
      const normalized = islandIds.includes(0) ? islandIds : [0, ...islandIds];
      localStorage.setItem(STORAGE_KEYS.UNLOCKED_ISLANDS, JSON.stringify(normalized));
    } catch (e) {
      console.warn('Failed to save unlocked islands to localStorage:', e);
    }
  },

  loadVillageTiers: (): Record<number, VillageTier> => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.VILLAGE_TIERS);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object') {
          // 중심 마을(0번)은 처음부터 중소마을(Lv.2) 이상 보장
          if (!parsed[0] || parsed[0] < 2) {
            parsed[0] = 2;
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load village tiers:', e);
    }
    return { 0: 2 };
  },

  saveVillageTiers: (tiers: Record<number, VillageTier>): void => {
    try {
      localStorage.setItem(STORAGE_KEYS.VILLAGE_TIERS, JSON.stringify(tiers));
    } catch (e) {
      console.warn('Failed to save village tiers:', e);
    }
  },

  loadConstructedBuildings: (): ConstructedBuilding[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CONSTRUCTED_BUILDINGS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load constructed buildings:', e);
    }
    const initial = getInitialConstructedBuildings();
    storage.saveConstructedBuildings(initial);
    return initial;
  },

  saveConstructedBuildings: (buildings: ConstructedBuilding[]): void => {
    try {
      localStorage.setItem(STORAGE_KEYS.CONSTRUCTED_BUILDINGS, JSON.stringify(buildings));
    } catch (e) {
      console.warn('Failed to save constructed buildings:', e);
    }
  },

  loadCoreHps: (): Record<number, number> => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CORE_HPS);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load core HPs:', e);
    }
    return { 0: VILLAGE_TIER_CONFIGS[2].coreMaxHp };
  },

  saveCoreHps: (coreHps: Record<number, number>): void => {
    try {
      localStorage.setItem(STORAGE_KEYS.CORE_HPS, JSON.stringify(coreHps));
    } catch (e) {
      console.warn('Failed to save core HPs:', e);
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

  getPlayerId: (): string => {
    try {
      let id = localStorage.getItem(STORAGE_KEYS.PLAYER_ID);
      if (!id) {
        id = 'p_' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem(STORAGE_KEYS.PLAYER_ID, id);
      }
      return id;
    } catch {
      return 'p_' + Math.random().toString(36).substring(2, 9);
    }
  },

  resetAll: (): void => {
    try {
      localStorage.removeItem(STORAGE_KEYS.PROFILE);
      localStorage.removeItem(STORAGE_KEYS.PLAYER_ID);
      localStorage.removeItem(STORAGE_KEYS.INVENTORY);
      localStorage.removeItem(STORAGE_KEYS.UNLOCKED_ISLANDS);
      localStorage.removeItem(STORAGE_KEYS.VILLAGE_TIERS);
      localStorage.removeItem(STORAGE_KEYS.CONSTRUCTED_BUILDINGS);
      localStorage.removeItem(STORAGE_KEYS.CORE_HPS);
      localStorage.removeItem(STORAGE_KEYS.ZOOM);
    } catch (e) {
      console.warn('Failed to reset storage:', e);
    }
  },
};
