import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAYER_CLASS_DEFINITIONS } from '../classes';
import {
  DEFAULT_META_PROGRESSION,
  TRAIT_DEFINITIONS,
  calculateRefundableTraitPoints,
  computeMetaBonuses,
  getTraitUpgradeCost,
} from '../metaProgression';
import { computeProgressionStats } from '../../game/utils/progressionStatsUtils';
import { MetaProgressionState } from '../../types/metaProgression';

test('computeMetaBonuses computes base stats, skills, mode advantages, and costume', () => {
  const state: MetaProgressionState = {
    ...DEFAULT_META_PROGRESSION,
    traitLevels: {
      ...DEFAULT_META_PROGRESSION.traitLevels,
      vitality_training: 3,
      guardian_might: 2,
      skill_power_mastery: 2,
      skill_haste_mastery: 2,
      skill_reach_mastery: 1,
      hunting_exp_boost: 2,
      boss_slayer_instinct: 3,
      pioneer_efficiency: 2,
      tower_overclock: 2,
    },
    equippedCostumeId: 'costume_yellow',
    equippedAuraId: 'aura_starlight',
  };

  const bonuses = computeMetaBonuses(state);
  assert.equal(bonuses.bonusMaxHp, 54);
  assert.equal(bonuses.combatDamageBonus, 12);
  assert.equal(bonuses.bonusSkillDamagePercent, 24);
  assert.equal(bonuses.bonusCooldownReductionPercent, 10);
  assert.equal(bonuses.bonusSkillRadiusPx, 15);
  assert.equal(bonuses.expGainBonusRatio, 0.3);
  assert.equal(Math.round(bonuses.bossDamageBonusRatio * 100), 36);
  assert.equal(bonuses.costDiscountRatio, 0.12);
  assert.equal(bonuses.towerDamageBonusRatio, 0.24);
  assert.equal(bonuses.equippedCostumeColor, 'yellow');
  assert.equal(bonuses.equippedAuraId, 'aura_starlight');
});

test('calculateRefundableTraitPoints sums exact spent star fragments for free reset', () => {
  const vitality = TRAIT_DEFINITIONS.find((t) => t.id === 'vitality_training')!;
  const expectedCost = getTraitUpgradeCost(vitality, 0) + getTraitUpgradeCost(vitality, 1);

  const state: MetaProgressionState = {
    ...DEFAULT_META_PROGRESSION,
    traitLevels: {
      ...DEFAULT_META_PROGRESSION.traitLevels,
      vitality_training: 2,
    },
  };

  assert.equal(calculateRefundableTraitPoints(state), expectedCost);
});

test('computeProgressionStats merges meta bonuses into player combat stats', () => {
  const bonuses = computeMetaBonuses({
    ...DEFAULT_META_PROGRESSION,
    traitLevels: {
      ...DEFAULT_META_PROGRESSION.traitLevels,
      vitality_training: 2,
      guardian_might: 2,
      swift_footwork: 2,
      lethal_precision: 2,
    },
  });

  const base = computeProgressionStats(1, PLAYER_CLASS_DEFINITIONS.pawn, {
    weapon: null,
    armor: null,
    relic: null,
  });
  const boosted = computeProgressionStats(
    1,
    PLAYER_CLASS_DEFINITIONS.pawn,
    { weapon: null, armor: null, relic: null },
    bonuses
  );

  assert.equal(boosted.totalMaxHp - base.totalMaxHp, 36);
  assert.equal(boosted.totalAttack - base.totalAttack, 12);
  assert.equal(boosted.totalSpeed - base.totalSpeed, 20);
  assert.equal(boosted.totalCritChance - base.totalCritChance, 6);
});
