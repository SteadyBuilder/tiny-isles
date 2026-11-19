import { ConstructedBuilding, Island } from '../../types/game';
import { WorldStateSyncPayload } from '../../types/monsterSync';

/**
 * 호스트가 게스트 복귀·합류·방장 이양 시 영지(해금/티어/코어 HP)와 건설 건물 목록을 동기화하기 위한 스냅샷 생성
 */
export function buildWorldStateSyncPayload(
  hostEpoch: number,
  islands: ReadonlyArray<Island>,
  constructedBuildings: ReadonlyArray<ConstructedBuilding>
): WorldStateSyncPayload {
  return {
    hostEpoch,
    islands: islands.map((isl) => ({
      id: isl.id,
      unlocked: isl.unlocked,
      ownerId: isl.ownerId,
      ownerName: isl.ownerName,
      villageTier: isl.villageTier,
      coreHp: isl.coreHp,
      coreMaxHp: isl.coreMaxHp,
    })),
    constructedBuildings: constructedBuildings.map((b) => ({ ...b })),
  };
}

/**
 * 로컬 월드 상태와 원격 호스트 월드 스냅샷의 차이를 계산합니다.
 * 차이가 없으면 불필요한 Phaser 건물/코어 재렌더링을 건너뜁니다.
 */
export function reconcileWorldStateSnapshot(
  localIslands: ReadonlyArray<Island>,
  localBuildings: ReadonlyArray<ConstructedBuilding>,
  payload: WorldStateSyncPayload
): { changed: boolean; islands: Island[]; constructedBuildings: ConstructedBuilding[] } {
  const remoteIslandById = new Map(payload.islands.map((entry) => [entry.id, entry]));
  let changed = false;

  const mergedIslands = localIslands.map((isl) => {
    const remote = remoteIslandById.get(isl.id);
    if (!remote) return isl;

    // 마물 주둔지(미점령 상태)의 코어 HP/MaxHP는 CampCoreSystem(camp_core_sync / camp_full_sync)이 권위를 가짐
    const isActiveMonsterCamp = Boolean(isl.isMonsterCamp && !remote.unlocked);
    const nextCoreHp = isActiveMonsterCamp ? isl.coreHp : remote.coreHp;
    const nextCoreMaxHp = isActiveMonsterCamp ? isl.coreMaxHp : remote.coreMaxHp;

    const islandDiff =
      isl.unlocked !== remote.unlocked ||
      isl.ownerId !== remote.ownerId ||
      isl.ownerName !== remote.ownerName ||
      isl.villageTier !== remote.villageTier ||
      isl.coreHp !== nextCoreHp ||
      isl.coreMaxHp !== nextCoreMaxHp;

    if (!islandDiff) return isl;
    changed = true;
    return {
      ...isl,
      unlocked: remote.unlocked,
      ownerId: remote.ownerId,
      ownerName: remote.ownerName,
      villageTier: remote.villageTier,
      coreHp: nextCoreHp,
      coreMaxHp: nextCoreMaxHp,
    };
  });

  if (!changed) {
    if (localBuildings.length !== payload.constructedBuildings.length) {
      changed = true;
    } else {
      const localById = new Map(localBuildings.map((b) => [b.id, b]));
      for (const remoteB of payload.constructedBuildings) {
        const localB = localById.get(remoteB.id);
        if (
          !localB ||
          localB.hp !== remoteB.hp ||
          localB.maxHp !== remoteB.maxHp ||
          localB.territoryId !== remoteB.territoryId ||
          localB.slotIndex !== remoteB.slotIndex ||
          localB.type !== remoteB.type
        ) {
          changed = true;
          break;
        }
      }
    }
  }

  return {
    changed,
    islands: mergedIslands,
    constructedBuildings: payload.constructedBuildings.map((b) => ({ ...b })),
  };
}
