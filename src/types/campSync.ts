export interface CampStructureHitPayload {
  structureId: string;
  territoryId: number;
  damage: number;
  attackerId: string;
  isSkill?: boolean;
}

export interface CampCoreHitPayload {
  territoryId: number;
  damage: number;
  attackerId: string;
  isSkill?: boolean;
}

export interface CampStructureHpSyncPayload {
  structureId: string;
  territoryId: number;
  hp: number;
  maxHp: number;
  destroyed?: boolean;
  damageDelta?: number;
  attackerId?: string;
}

export interface CampCoreSyncPayload {
  territoryId: number;
  level: number;
  coreHp: number;
  coreMaxHp: number;
  destroyed: boolean;
  respawnRemainingSec: number | null;
  firstCleared: boolean;
  clearCount: number;
  damageDelta?: number;
  attackerId?: string;
  healed?: boolean;
  respawned?: boolean;
}

export interface CampStructureSnapshot {
  id: string;
  territoryId: number;
  hp: number;
  maxHp: number;
}

export interface CampStateSnapshot {
  territoryId: number;
  level: number;
  coreHp: number;
  coreMaxHp: number;
  destroyed: boolean;
  respawnRemainingSec: number | null;
  firstCleared: boolean;
  clearCount: number;
}

export interface CampFullSyncPayload {
  camps: CampStateSnapshot[];
  structures: CampStructureSnapshot[];
}
