import type Phaser from 'phaser';
import type { CombatHitFeedbackOptions } from './combat';
import type { ConstructedBuilding, DungeonPortalState, Island } from './game';
import type {
  ActivePlayerTarget,
  MonsterHitPayload,
  MonsterKillSyncPayload,
  MonsterPlayerAttackPayload,
  MonstersDeltaSyncPayload,
  MonstersFullSyncPayload,
  MonstersRepairRequestPayload,
  ThreatSyncPayload,
} from './monsterSync';
import type { MissionDifficultyConfig } from './room';
import type { MonsterKilledMeta } from '../game/systems/MonsterCombatAI';
import type { ProjectileSystem } from '../game/systems/ProjectileSystem';

export interface IWaveSystemContext {
  scene: Phaser.Scene;
  initialIsHost?: boolean;
  isHuntingMode?: () => boolean;
  getDifficultyConfig?: () => MissionDifficultyConfig;
  projectileSystem?: ProjectileSystem;
  healCampCore?: (territoryId: number, amount: number) => void;
  onMonsterHitImpact?: (opts: CombatHitFeedbackOptions, restoreTint?: number | null) => void;
  onMonsterKilledReward?: (
    x: number,
    y: number,
    isBoss: boolean,
    expReward: number,
    isCampMonster: boolean,
    meta?: MonsterKilledMeta
  ) => void;
  onRemoteMonsterKilledReward?: (kill: MonsterKillSyncPayload) => void;
  getIslands: () => Island[];
  getConstructedBuildings: () => ConstructedBuilding[];
  destroyConstructedBuilding: (buildingId: string) => void;
  updateConstructedBuildingHpBar: (buildingId: string) => void;
  onBuildingDamaged?: (buildingId: string, hp: number, maxHp: number, damageDelta: number) => void;
  getConstructedVisualContainer: (buildingId: string) => Phaser.GameObjects.Container | undefined;
  getLocalPlayerId: () => string;
  getLocalPlayerPosition: () => { x: number; y: number };
  isLocalPlayerFainted: () => boolean;
  getActivePlayers?: () => ActivePlayerTarget[];
  damageLocalPlayer: (damage: number, attackerName: string) => void;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
  shakeObject: (target: Phaser.GameObjects.Container) => void;
  playExplosionAt: (x: number, y: number) => void;
  addRewardResources: (wood: number, stone: number, gold: number) => void;
  broadcastWaveSpawn?: (isBossWave: boolean) => void;
  broadcastWaveSummonRequest?: (isBossWave: boolean, isEarlySummon: boolean) => void;
  broadcastMonstersSync?: (payload: MonstersFullSyncPayload) => void;
  broadcastMonstersDeltaSync?: (payload: MonstersDeltaSyncPayload) => void;
  requestMonstersSync?: () => void;
  requestMonstersRepair?: (payload: MonstersRepairRequestPayload) => void;
  broadcastMonsterHit?: (payload: MonsterHitPayload) => void;
  broadcastMonsterPlayerAttack?: (payload: MonsterPlayerAttackPayload) => void;
  broadcastThreatAdded?: (amount: number) => void;
  broadcastThreatSync?: (payload: ThreatSyncPayload) => void;
  broadcastDungeonPortalSync?: (portal: DungeonPortalState | null) => void;
  emitThreatOrb?: (worldX: number, worldY: number, amount: number) => void;
  onMonstersChanged?: () => void;
}
