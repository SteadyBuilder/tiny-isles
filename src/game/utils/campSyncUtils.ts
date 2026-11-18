import type { CampStateSnapshot, CampStructureSnapshot } from '../../types/campSync';
import type { Island } from '../../types/game';
import type { MonsterCampState } from '../../types/hunting';

export interface CampStateApplyResult {
  becameDestroyed: boolean;
  respawned: boolean;
  clearCountChanged: boolean;
}

export type CampFortificationSyncAction = 'clear' | 'respawn_then_reconcile' | 'reconcile_only';

export interface CampFortificationSyncPlan {
  action: CampFortificationSyncAction;
  removeIds: string[];
  updates: CampStructureSnapshot[];
}

export function toCampStateSnapshot(camp: MonsterCampState): CampStateSnapshot {
  return {
    territoryId: camp.territoryId,
    level: camp.level,
    coreHp: camp.coreHp,
    coreMaxHp: camp.coreMaxHp,
    destroyed: camp.destroyed,
    respawnRemainingSec: camp.respawnRemainingSec,
    firstCleared: camp.firstCleared,
    clearCount: camp.clearCount,
  };
}

export function applyCampSnapshotToState(
  camp: MonsterCampState,
  snapshot: CampStateSnapshot,
  island?: Island
): CampStateApplyResult {
  const wasDestroyed = camp.destroyed;
  const prevClearCount = camp.clearCount;

  camp.level = snapshot.level;
  camp.coreMaxHp = Math.max(1, snapshot.coreMaxHp);
  camp.coreHp = Math.max(0, Math.min(camp.coreMaxHp, snapshot.coreHp));
  camp.destroyed = snapshot.destroyed;
  camp.respawnRemainingSec = snapshot.destroyed ? snapshot.respawnRemainingSec : null;
  camp.firstCleared = snapshot.firstCleared;
  camp.clearCount = Math.max(0, snapshot.clearCount);

  if (island) {
    island.campLevel = camp.level;
    island.campDestroyed = camp.destroyed;
    island.campRespawnSec = camp.respawnRemainingSec;
    island.coreHp = camp.coreHp;
    island.coreMaxHp = camp.coreMaxHp;
  }

  return {
    becameDestroyed: !wasDestroyed && camp.destroyed,
    respawned: wasDestroyed && !camp.destroyed,
    clearCountChanged: prevClearCount !== camp.clearCount,
  };
}

export function groupStructureSnapshotsByTerritory(
  structures: ReadonlyArray<CampStructureSnapshot>
): Map<number, CampStructureSnapshot[]> {
  const grouped = new Map<number, CampStructureSnapshot[]>();
  for (const structure of structures) {
    const bucket = grouped.get(structure.territoryId);
    if (bucket) {
      bucket.push(structure);
    } else {
      grouped.set(structure.territoryId, [structure]);
    }
  }
  return grouped;
}

export function planCampFortificationSync(
  currentCampStructures: ReadonlyArray<{ id: string }>,
  incomingStructures: ReadonlyArray<CampStructureSnapshot>,
  campDestroyed: boolean,
  respawned: boolean,
  clearCountChanged: boolean
): CampFortificationSyncPlan {
  if (campDestroyed) {
    return { action: 'clear', removeIds: [], updates: [] };
  }

  const incomingIds = new Set(incomingStructures.map((s) => s.id));
  const currentIds = new Set(currentCampStructures.map((s) => s.id));
  const hasMissingLocalStructure = incomingStructures.some((s) => !currentIds.has(s.id));

  if (respawned || clearCountChanged || hasMissingLocalStructure) {
    return {
      action: 'respawn_then_reconcile',
      removeIds: [],
      updates: [...incomingStructures],
    };
  }

  const removeIds = currentCampStructures.filter((s) => !incomingIds.has(s.id)).map((s) => s.id);
  return {
    action: 'reconcile_only',
    removeIds,
    updates: [...incomingStructures],
  };
}
