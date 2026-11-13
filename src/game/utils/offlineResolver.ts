import {
  GARRISON_CONFIG,
  OFFLINE_RESOLUTION_CONFIG,
  WORLD_CLOCK_CONFIG,
} from '../../data/worldRules';
import {
  ConstructedBuilding,
  GarrisonUnit,
  Inventory,
  Island,
  OfflineResolutionReport,
} from '../../types/game';
import { getBlueprint, VILLAGE_TIER_CONFIGS } from '../constants';
import { countCrossedWaveBoundaries } from './worldClockUtils';

export interface OfflineResolveInput {
  lastActiveAtIso: string;
  nowMs: number;
  baseWaveCount: number;
  baseBossWaveCount: number;
  islands: Island[];
  constructedBuildings: ConstructedBuilding[];
  garrisons: GarrisonUnit[];
}

export interface OfflineResolveOutput {
  shouldReport: boolean;
  updatedIslands: Island[];
  updatedBuildings: ConstructedBuilding[];
  newWaveCount: number;
  newBossWaveCount: number;
  report: OfflineResolutionReport | null;
}

/**
 * 현재 영지의 타워, 성벽, 마을 티어 및 비동기 수비대를 합산한 방어 전력 계산 (순수 함수)
 */
export function computeVillageDefensePower(
  islands: Island[],
  constructedBuildings: ConstructedBuilding[],
  garrisons: GarrisonUnit[]
): number {
  let power = 0;

  // 1. 점령된 영지 및 마을 티어 기본 수비력
  for (const isl of islands) {
    if (!isl.unlocked) continue;
    power += 40 + isl.villageTier * 45;
  }

  // 2. 건설된 방어 타워/성벽/병영 전력
  const barracksTerritories = new Set(
    constructedBuildings
      .filter((b) => b.hp > 0 && b.type === 'special_barracks')
      .map((b) => b.territoryId)
  );

  for (const b of constructedBuildings) {
    if (b.hp <= 0) continue;
    const bp = getBlueprint(b.type);
    const buff = barracksTerritories.has(b.territoryId) ? 1.25 : 1.0;

    if (b.category === 'tower') {
      power += Math.round((bp.attack ?? 20) * 3.5 * buff);
    } else if (b.category === 'wall') {
      power += Math.round((b.hp / Math.max(1, b.maxHp)) * 55);
    } else if (b.type === 'special_barracks') {
      power += 95;
    } else {
      power += 15;
    }
  }

  // 3. 오프라인 유저 수비대(Garrison) 지원 전력
  const activeGarrisons = Math.min(garrisons.length, GARRISON_CONFIG.maxActiveGarrisons);
  power += activeGarrisons * GARRISON_CONFIG.offlineDefensePowerPerGarrison;

  return Math.max(50, Math.round(power));
}

/**
 * 오프라인(무인) 경과 시간 동안의 웨이브 공방, 패시브 자원, 건물/외곽 영지 피해를 정산합니다.
 * 중심 마을(#0) 코어는 절대 파괴되지 않고 최소 HP 하한선을 유지합니다.
 */
export function resolveOfflinePeriod(input: OfflineResolveInput): OfflineResolveOutput {
  const lastActiveMs = Date.parse(input.lastActiveAtIso);
  if (Number.isNaN(lastActiveMs) || input.nowMs <= lastActiveMs) {
    return {
      shouldReport: false,
      updatedIslands: input.islands,
      updatedBuildings: input.constructedBuildings,
      newWaveCount: input.baseWaveCount,
      newBossWaveCount: input.baseBossWaveCount,
      report: null,
    };
  }

  const elapsedSec = Math.floor((input.nowMs - lastActiveMs) / 1000);
  if (elapsedSec < OFFLINE_RESOLUTION_CONFIG.minOfflineSecondsForReport) {
    return {
      shouldReport: false,
      updatedIslands: input.islands,
      updatedBuildings: input.constructedBuildings,
      newWaveCount: input.baseWaveCount,
      newBossWaveCount: input.baseBossWaveCount,
      report: null,
    };
  }

  const simulatedRegularWaves = countCrossedWaveBoundaries(
    lastActiveMs,
    input.nowMs,
    WORLD_CLOCK_CONFIG.regularWaveIntervalSec,
    OFFLINE_RESOLUTION_CONFIG.maxSimulatedWaves
  );
  const simulatedBossWaves = countCrossedWaveBoundaries(
    lastActiveMs,
    input.nowMs,
    WORLD_CLOCK_CONFIG.bossWaveIntervalSec,
    Math.floor(OFFLINE_RESOLUTION_CONFIG.maxSimulatedWaves / 2)
  );

  // 지난 웨이브가 전혀 없고 시간만 흐른 경우 패시브 자원만 소폭 정산할지 여부
  const totalWaves = Math.max(1, simulatedRegularWaves);
  const defensePower = computeVillageDefensePower(
    input.islands,
    input.constructedBuildings,
    input.garrisons
  );

  const avgWaveIndex = input.baseWaveCount + simulatedRegularWaves * 0.5;
  const singleWaveThreat =
    OFFLINE_RESOLUTION_CONFIG.baseWaveThreatPower +
    avgWaveIndex * OFFLINE_RESOLUTION_CONFIG.threatPowerPerWave;
  const bossThreat =
    simulatedBossWaves > 0 ? OFFLINE_RESOLUTION_CONFIG.bossExtraThreatPower : 0;
  const threatPower = Math.round(singleWaveThreat + bossThreat);

  const victory = defensePower >= threatPower;
  const deficitRatio = victory ? 0 : Math.min(1, (threatPower - defensePower) / Math.max(1, threatPower));

  // 1. 패시브 자원 생산 정산
  const passiveGain: Inventory = { wood: 0, stone: 0, gold: 0 };
  const yieldScale = victory ? 1.0 : Math.max(0.35, 1.0 - deficitRatio * 0.6);
  for (const isl of input.islands) {
    if (!isl.unlocked) continue;
    const cfg = VILLAGE_TIER_CONFIGS[isl.villageTier];
    passiveGain.wood += Math.floor(
      cfg.passiveWood * totalWaves * OFFLINE_RESOLUTION_CONFIG.passiveYieldMultiplierPerWave * yieldScale
    );
    passiveGain.stone += Math.floor(
      cfg.passiveStone * totalWaves * OFFLINE_RESOLUTION_CONFIG.passiveYieldMultiplierPerWave * yieldScale
    );
    passiveGain.gold += Math.floor(
      cfg.passiveGold * totalWaves * OFFLINE_RESOLUTION_CONFIG.passiveYieldMultiplierPerWave * yieldScale
    );
  }

  // 2. 건물 손상 정산 (외곽 영지 우선)
  let damagedBuildingsCount = 0;
  const updatedBuildings: ConstructedBuilding[] = [];
  const damageRatio = victory
    ? Math.min(0.18, 0.04 * simulatedRegularWaves)
    : Math.min(0.75, 0.25 + deficitRatio * 0.5);

  for (const b of input.constructedBuildings) {
    const isOuter = b.territoryId !== 0;
    const appliedRatio = isOuter ? damageRatio : damageRatio * 0.55;
    const dmg = Math.round(b.maxHp * appliedRatio);
    const nextHp = Math.max(Math.ceil(b.maxHp * 0.15), b.hp - dmg);
    if (nextHp < b.hp) damagedBuildingsCount += 1;
    updatedBuildings.push({ ...b, hp: nextHp });
  }

  // 3. 영지 코어 피해 & 방어력 부족 시 외곽 섬 상실(최대 2개), #0 중심 마을 절대 보호
  const updatedIslands = input.islands.map((isl) => ({ ...isl }));
  const lostOuterIslandIds: number[] = [];
  const lostOuterIslandNames: string[] = [];

  if (!victory && simulatedRegularWaves > 0) {
    const outerCandidates = updatedIslands
      .filter((i) => i.unlocked && i.id !== 0)
      .sort(
        (a, b) =>
          Math.abs(b.gridX) + Math.abs(b.gridY) - (Math.abs(a.gridX) + Math.abs(a.gridY))
      );

    // 위협이 방어력보다 25% 이상 높고 웨이브를 2회 이상 맞았을 때 외곽 섬 상실 발생
    const shouldLoseOuter = deficitRatio >= 0.25 && simulatedRegularWaves >= 2;
    const loseTargetCount = shouldLoseOuter
      ? Math.min(
          OFFLINE_RESOLUTION_CONFIG.maxOuterIslandsLostPerSession,
          Math.max(1, Math.floor(deficitRatio * 2.5)),
          outerCandidates.length
        )
      : 0;

    for (let idx = 0; idx < outerCandidates.length; idx++) {
      const target = outerCandidates[idx];
      if (idx < loseTargetCount) {
        target.unlocked = false;
        target.villageTier = 0;
        target.coreHp = 0;
        lostOuterIslandIds.push(target.id);
        lostOuterIslandNames.push(target.name);
      } else {
        const coreDmg = Math.round(target.coreMaxHp * Math.min(0.5, deficitRatio * 0.6));
        target.coreHp = Math.max(Math.ceil(target.coreMaxHp * 0.2), target.coreHp - coreDmg);
      }
    }
  }

  // 상실된 외곽 섬의 건물은 정리
  const lostSet = new Set(lostOuterIslandIds);
  const survivingBuildings = updatedBuildings.filter((b) => !lostSet.has(b.territoryId));

  // #0 중심 마을 코어 보호 하한선 적용
  const homeIsle = updatedIslands.find((i) => i.id === 0) ?? updatedIslands[0];
  if (homeIsle) {
    const minHomeHp = Math.ceil(homeIsle.coreMaxHp * OFFLINE_RESOLUTION_CONFIG.homeCoreMinHpRatio);
    const homeDmg = victory
      ? Math.round(homeIsle.coreMaxHp * 0.05)
      : Math.round(homeIsle.coreMaxHp * Math.min(0.65, deficitRatio * 0.7));
    homeIsle.coreHp = Math.max(minHomeHp, homeIsle.coreHp - homeDmg);
  }

  const activeGarrisonsHelped = Math.min(
    input.garrisons.length,
    GARRISON_CONFIG.maxActiveGarrisons
  );

  const summaryMessage = victory
    ? `부재중 ${simulatedRegularWaves}회의 마물 침공을 타워와 수비대(${activeGarrisonsHelped}명)가 성공적으로 막아냈습니다!`
    : lostOuterIslandIds.length > 0
      ? `부재중 강력한 침공으로 외곽 영지 ${lostOuterIslandIds.length}곳을 내주었지만 중심 마을은 지켜냈습니다!`
      : `부재중 ${simulatedRegularWaves}회의 치열한 공방 끝에 중심 마을을 가까스로 방어했습니다. 성벽을 수리하세요!`;

  return {
    shouldReport: simulatedRegularWaves > 0 || elapsedSec >= 10 * 60,
    updatedIslands,
    updatedBuildings: survivingBuildings,
    newWaveCount: input.baseWaveCount + simulatedRegularWaves,
    newBossWaveCount: input.baseBossWaveCount + simulatedBossWaves,
    report: {
      elapsedSec,
      simulatedRegularWaves,
      simulatedBossWaves,
      defensePower,
      threatPower,
      victory,
      passiveGain,
      damagedBuildingsCount,
      lostOuterIslandIds,
      lostOuterIslandNames,
      homeCoreHpAfter: homeIsle ? homeIsle.coreHp : 0,
      homeCoreMaxHp: homeIsle ? homeIsle.coreMaxHp : 350,
      activeGarrisonsHelped,
      summaryMessage,
    },
  };
}
