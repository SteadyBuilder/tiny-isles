import {
  CosmeticTitleDefinition,
  MetaBonusSummary,
  MetaProgressionState,
  TraitDefinition,
  TraitId,
} from '../types/room';

export const DEFAULT_META_PROGRESSION: MetaProgressionState = {
  points: 0,
  totalClears: 0,
  traitLevels: {
    starter_supplies: 0,
    gatherer_blessing: 0,
    guardian_might: 0,
    citadel_fortification: 0,
  },
  unlockedTitleIds: ['title_recruit'],
  equippedTitleId: 'title_recruit',
  clearedMissionIds: [],
};

export const TRAIT_DEFINITIONS: TraitDefinition[] = [
  {
    id: 'starter_supplies',
    name: '원정대 초기 보급',
    description: '인스턴스 룸 시작 시 보유하는 목재·석재·금화가 증가합니다.',
    maxLevel: 5,
    baseCost: 50,
    costStep: 35,
    effectPerLevelLabel: '목재 +12, 석재 +8, 금화 +4 / Lv',
  },
  {
    id: 'gatherer_blessing',
    name: '개척자의 곡괭이',
    description: '나무·바위·금광 채집 시 가하는 피해량이 증가합니다.',
    maxLevel: 5,
    baseCost: 60,
    costStep: 40,
    effectPerLevelLabel: '채집 피해 +4 / Lv',
  },
  {
    id: 'guardian_might',
    name: '수호자의 투지',
    description: '플레이어 근접 공격력이 증가하여 마물을 빠르게 처치합니다.',
    maxLevel: 5,
    baseCost: 70,
    costStep: 45,
    effectPerLevelLabel: '근접 공격력 +6 / Lv',
  },
  {
    id: 'citadel_fortification',
    name: '성채 보강술',
    description: '모든 해금 영지 본진의 최대 체력이 증가합니다.',
    maxLevel: 5,
    baseCost: 65,
    costStep: 40,
    effectPerLevelLabel: '본진 최대 HP +10% / Lv',
  },
];

export const COSMETIC_TITLES: CosmeticTitleDefinition[] = [
  {
    id: 'title_recruit',
    label: '초보 수호자',
    description: 'Tiny Isles에 첫 발을 디딘 모험가',
    costPoints: 0,
  },
  {
    id: 'title_boss_slayer',
    label: '대군주 토벌자',
    description: '대군주 토벌전 미션 클리어 또는 포인트 해금',
    costPoints: 100,
  },
  {
    id: 'title_pioneer',
    label: '황무지 개척왕',
    description: '섬 개척 원정 미션 클리어 또는 포인트 해금',
    costPoints: 100,
  },
  {
    id: 'title_guardian',
    label: '불굴의 성소지기',
    description: '성소 수호전 미션 클리어 또는 포인트 해금',
    costPoints: 120,
  },
  {
    id: 'title_legend',
    label: '전설의 섬 군주',
    description: '수많은 원정을 이끈 백전노장',
    costPoints: 300,
  },
];

export function getTraitUpgradeCost(trait: TraitDefinition, currentLevel: number): number {
  return trait.baseCost + currentLevel * trait.costStep;
}

export function computeMetaBonuses(state: MetaProgressionState): MetaBonusSummary {
  const lv = (id: TraitId) => state.traitLevels[id] ?? 0;
  return {
    bonusWood: lv('starter_supplies') * 12,
    bonusStone: lv('starter_supplies') * 8,
    bonusGold: lv('starter_supplies') * 4,
    gatherDamageBonus: lv('gatherer_blessing') * 4,
    combatDamageBonus: lv('guardian_might') * 6,
    coreHpBonusRatio: lv('citadel_fortification') * 0.1,
  };
}
