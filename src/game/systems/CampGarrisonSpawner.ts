import type Phaser from 'phaser';
import { pickRandomEliteAffix } from '../../data/elites';
import { CAMP_PROXIMITY_SPAWN_CONFIG, CAMP_RING_TEMPLATES } from '../../data/monsterCamps';
import { Monster, MonsterCampState } from '../../types/game';
import { HuntingScalingFactors } from '../../types/hunting';
import { TERRITORY_CENTER_X, TERRITORY_CENTER_Y, getIslandOrigin } from '../constants';
import { computeCappedCampSpawnBudget } from '../utils/campSpawnBudgetUtils';
import { MonsterVisual, MonsterVisualManager } from './MonsterVisualManager';

/**
 * 호스트 전용 몬스터 부락 주둔병 및 외곽 순찰병 스폰 전담 헬퍼
 */
export function spawnCampGarrisonMonsters(params: {
  scene: Phaser.Scene;
  camp: MonsterCampState;
  monsters: Map<string, MonsterVisual>;
  scaling: HuntingScalingFactors;
}): void {
  const { scene, camp, monsters, scaling } = params;
  const tpl = CAMP_RING_TEMPLATES[camp.ring];
  const origin = getIslandOrigin(camp.gridX, camp.gridY);
  const cx = origin.x + TERRITORY_CENTER_X;
  const cy = origin.y + TERRITORY_CENTER_Y;
  const { hpMult, atkMult, countMult, eliteChance } = scaling;
  const clearScale = 1 + camp.clearCount * 0.25;

  let activeCampMonsters = 0;
  for (const mv of monsters.values()) {
    if (mv.monster.isCampMonster && mv.monster.hp > 0) activeCampMonsters += 1;
  }

  const rawGarrisonTotal = tpl.garrisonSpecs.reduce(
    (sum, s) => sum + Math.max(1, Math.round(s.count * countMult)),
    0
  );
  const rawPatrolCount = Math.max(2, Math.round(tpl.fortification.outerPatrolCount * countMult));
  const budget = computeCappedCampSpawnBudget({
    desiredTotalCount: rawGarrisonTotal + rawPatrolCount,
    activeCampMonsterCount: activeCampMonsters,
    maxActiveCampMonsters: CAMP_PROXIMITY_SPAWN_CONFIG.maxActiveCampMonsters,
    maxMonstersPerCamp: CAMP_PROXIMITY_SPAWN_CONFIG.maxMonstersPerCamp,
  });

  const effectiveCountMult = countMult * budget.countScaleRatio;
  const effectiveHpMult = hpMult * budget.hpAndExpCompensationMult;
  const expCompMult = budget.hpAndExpCompensationMult;

  const totalSpecsCount = tpl.garrisonSpecs.reduce(
    (sum, s) => sum + Math.max(1, Math.round(s.count * effectiveCountMult)),
    0
  );

  const minGuaranteedElites = camp.ring >= 3 ? 2 : 1;
  let elitesSpawnedInCamp = 0;
  let idx = 0;

  for (const spec of tpl.garrisonSpecs) {
    const spawnCount = Math.max(1, Math.round(spec.count * effectiveCountMult));
    for (let i = 0; i < spawnCount; i++) {
      const angle = (Math.PI * 2 * idx) / Math.max(1, totalSpecsCount) + (Math.random() - 0.5) * 0.3;
      const dist = 125 + (idx % 3) * 42;
      const mx = cx + Math.cos(angle) * dist;
      const my = cy + Math.sin(angle) * dist;

      const remainingSlots = totalSpecsCount - idx;
      const neededElites = minGuaranteedElites - elitesSpawnedInCamp;
      const forceElite = neededElites > 0 && remainingSlots <= neededElites;
      const isElite = forceElite || Math.random() < eliteChance;
      const affix = isElite ? pickRandomEliteAffix() : null;
      if (isElite) elitesSpawnedInCamp++;

      const hp = Math.round(spec.hp * clearScale * effectiveHpMult * (affix?.hpMultiplier ?? 1));
      const attack = Math.round(spec.attack * clearScale * atkMult * (affix?.attackMultiplier ?? 1));
      const speed = Math.round(spec.speed * (affix?.speedMultiplier ?? 1));

      const monster: Monster = {
        id: `camp_${camp.territoryId}_${Date.now()}_${idx}`,
        type: spec.type,
        name: affix
          ? `★ Lv.${camp.level} ${affix.label} ${spec.name}`
          : `Lv.${camp.level} ${spec.name}`,
        isBoss: false,
        isElite,
        eliteAffix: affix?.id,
        x: mx,
        y: my,
        hp,
        maxHp: hp,
        attack,
        speed,
        targetTerritoryId: 0,
        spawnTerritoryId: camp.territoryId,
        direction: idx % 2 === 0 ? 'left' : 'right',
        role: spec.role,
        isCampMonster: true,
        campTerritoryId: camp.territoryId,
        campRing: camp.ring,
        homeX: mx,
        homeY: my,
        expReward: Math.round(spec.expReward * clearScale * expCompMult * (affix?.expMultiplier ?? 1)),
      };
      monsters.set(monster.id, MonsterVisualManager.create(scene, monster));
      idx++;
    }
  }

  // 방어벽 외곽 순찰 몬스터 배치
  const patrolCount = Math.max(2, Math.round(tpl.fortification.outerPatrolCount * effectiveCountMult));
  const patrolSpec = tpl.garrisonSpecs[0];
  for (let p = 0; p < patrolCount; p++) {
    const angle = (Math.PI * 2 * p) / patrolCount;
    const dist = 285 + (p % 2) * 55;
    const mx = cx + Math.cos(angle) * dist;
    const my = cy + Math.sin(angle) * dist;
    const isElite = Math.random() < eliteChance;
    const affix = isElite ? pickRandomEliteAffix() : null;

    const hp = Math.round(patrolSpec.hp * clearScale * effectiveHpMult * (affix?.hpMultiplier ?? 1));
    const attack = Math.round(patrolSpec.attack * clearScale * atkMult * (affix?.attackMultiplier ?? 1));
    const speed = Math.round(patrolSpec.speed * (affix?.speedMultiplier ?? 1));

    const patrolMonster: Monster = {
      id: `camppatrol_${camp.territoryId}_${Date.now()}_${p}`,
      type: patrolSpec.type,
      name: affix
        ? `★ Lv.${camp.level} ${affix.label} 외곽 순찰병`
        : `Lv.${camp.level} 부락 외곽 순찰병`,
      isBoss: false,
      isElite,
      eliteAffix: affix?.id,
      x: mx,
      y: my,
      hp,
      maxHp: hp,
      attack,
      speed,
      targetTerritoryId: 0,
      spawnTerritoryId: camp.territoryId,
      direction: p % 2 === 0 ? 'left' : 'right',
      role: patrolSpec.role,
      isCampMonster: true,
      campTerritoryId: camp.territoryId,
      campRing: camp.ring,
      homeX: mx,
      homeY: my,
      patrolRadiusPx: 115,
      expReward: Math.round(patrolSpec.expReward * clearScale * (affix?.expMultiplier ?? 1)),
    };
    monsters.set(patrolMonster.id, MonsterVisualManager.create(scene, patrolMonster));
  }
}
