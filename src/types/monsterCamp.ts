import type Phaser from 'phaser';
import type { CampFortificationSystem } from '../game/systems/CampFortificationSystem';
import type {
  CampCoreHitPayload,
  CampCoreSyncPayload,
  CampFullSyncPayload,
} from './campSync';
import type { EquipmentItem, Island } from './game';
import type { MissionDifficultyConfig } from './room';

export interface IMonsterCampContext {
  scene: Phaser.Scene;
  isHuntingMode: () => boolean;
  isHost?: () => boolean;
  getLocalPlayerId?: () => string;
  getDifficultyConfig?: () => MissionDifficultyConfig;
  getIslands: () => Island[];
  getMonsters: () => Map<string, import('../game/systems/MonsterVisualManager').MonsterVisual>;
  getActivePlayerPositions?: () => Array<{ x: number; y: number }>;
  fortification?: CampFortificationSystem;
  addResources: (wood: number, stone: number, gold: number) => void;
  addThreat: (amount: number) => void;
  gainExp: (amount: number) => void;
  grantRewardItem: (item: EquipmentItem) => void;
  playChestDropAt?: (
    x: number,
    y: number,
    item: EquipmentItem,
    onOpened: (item: EquipmentItem) => void
  ) => void;
  onCampCoreDamaged?: (territoryId: number, attackerId?: string) => void;
  onCampCoreHitFeedback?: (x: number, y: number, isSkill: boolean, isLocalAttack?: boolean) => void;
  broadcastCampCoreHit?: (payload: CampCoreHitPayload) => void;
  broadcastCampCoreSync?: (payload: CampCoreSyncPayload) => void;
  broadcastCampFullSync?: (payload: CampFullSyncPayload) => void;
  playExplosionAt: (x: number, y: number) => void;
  shakeObject: (target: Phaser.GameObjects.Container) => void;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
  emitTerritoriesUpdated: () => void;
}
