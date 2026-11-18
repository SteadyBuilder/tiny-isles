import {
  AuraDefinition,
  CosmeticTitleDefinition,
  CostumeDefinition,
  MetaBonusSummary,
  MetaProgressionState,
  ModeAdvantageTag,
  TraitDefinition,
  TraitId,
} from '../types/metaProgression';

export const DEFAULT_META_PROGRESSION: MetaProgressionState = {
  points: 0,
  totalClears: 0,
  traitLevels: {
    // 기본 스탯
    vitality_training: 0,
    guardian_might: 0,
    swift_footwork: 0,
    lethal_precision: 0,
    gatherer_blessing: 0,
    // 기본 스킬 & 전투 테크닉
    skill_power_mastery: 0,
    skill_haste_mastery: 0,
    skill_reach_mastery: 0,
    battle_vampirism: 0,
    // 모드별 전략 어드밴티지
    hunting_exp_boost: 0,
    hunting_loot_fortune: 0,
    boss_slayer_instinct: 0,
    starter_supplies: 0,
    pioneer_efficiency: 0,
    citadel_fortification: 0,
    tower_overclock: 0,
  },
  unlockedTitleIds: ['title_recruit'],
  equippedTitleId: 'title_recruit',
  unlockedCostumeIds: ['costume_blue'],
  equippedCostumeId: 'costume_blue',
  unlockedAuraIds: ['aura_none'],
  equippedAuraId: 'aura_none',
  clearedMissionIds: [],
};

export const MODE_ADVANTAGE_META: Record<
  ModeAdvantageTag,
  { label: string; badgeClass: string; summary: string }
> = {
  hunting_conquest: {
    label: '🏹 사냥 & 던전 디펜스',
    badgeClass: 'bg-[#7c2d12] text-[#ffedd5]',
    summary: '빠른 레벨업·전직과 장비 파밍 극대화',
  },
  boss_slayer: {
    label: '👑 대군주 토벌전',
    badgeClass: 'bg-[#7f1d1d] text-[#fee2e2]',
    summary: '보스 및 엘리트 마물 대상 폭딜 특화',
  },
  territory_expansion: {
    label: '🏝️ 섬 개척 원정',
    badgeClass: 'bg-[#14532d] text-[#dcfce7]',
    summary: '초기 보급 및 영지 해금·건설 비용 절감',
  },
  sanctuary_defense: {
    label: '🛡️ 성소 수호전',
    badgeClass: 'bg-[#1e3a8a] text-[#dbeafe]',
    summary: '본진 내구도 및 방어 타워 화력 극대화',
  },
};

export const TRAIT_DEFINITIONS: TraitDefinition[] = [
  // ── 1. 기본 스탯 ──
  {
    id: 'vitality_training',
    category: 'base_stats',
    name: '강인한 체력',
    description: '캐릭터의 기본 최대 체력이 영구적으로 증가합니다.',
    maxLevel: 5,
    baseCost: 45,
    costStep: 30,
    effectPerLevelLabel: '최대 HP +18 / Lv',
    iconPath: '/assets/ui/Icons/Icon_03.png',
  },
  {
    id: 'guardian_might',
    category: 'base_stats',
    name: '수호자의 투지',
    description: '기본 공격력이 상승하여 모든 마물과 부락을 빠르게 처치합니다.',
    maxLevel: 5,
    baseCost: 55,
    costStep: 35,
    effectPerLevelLabel: '기본 공격력 +6 / Lv',
    iconPath: '/assets/ui/Icons/Icon_05.png',
  },
  {
    id: 'swift_footwork',
    category: 'base_stats',
    name: '질풍의 발걸음',
    description: '이동 속도가 빨라져 카이팅, 채집, 영지 순찰이 쾌적해집니다.',
    maxLevel: 5,
    baseCost: 50,
    costStep: 30,
    effectPerLevelLabel: '이동 속도 +10 / Lv',
    iconPath: '/assets/ui/Icons/Icon_08.png',
  },
  {
    id: 'lethal_precision',
    category: 'base_stats',
    name: '치명타 수련',
    description: '일반 공격과 스킬의 치명타 발동 확률이 영구 상승합니다.',
    maxLevel: 5,
    baseCost: 65,
    costStep: 40,
    effectPerLevelLabel: '치명타 확률 +3% / Lv',
    iconPath: '/assets/ui/Icons/Icon_04.png',
  },
  {
    id: 'gatherer_blessing',
    category: 'base_stats',
    name: '개척자의 곡괭이',
    description: '나무·바위·금광 채집 시 가하는 피해량이 증가합니다.',
    maxLevel: 5,
    baseCost: 45,
    costStep: 30,
    effectPerLevelLabel: '채집 피해 +4 / Lv',
    iconPath: '/assets/ui/Icons/Icon_07.png',
  },

  // ── 2. 기본 스킬 & 전투 테크닉 ──
  {
    id: 'skill_power_mastery',
    category: 'skills',
    name: '스킬 위력 증폭',
    description: '액티브 스킬(Q)로 입히는 피해량이 크게 증가합니다.',
    maxLevel: 5,
    baseCost: 60,
    costStep: 40,
    effectPerLevelLabel: '스킬 피해량 +12% / Lv',
    iconPath: '/assets/ui/Icons/Icon_05.png',
  },
  {
    id: 'skill_haste_mastery',
    category: 'skills',
    name: '재사용 대기시간 단축',
    description: '액티브 스킬(Q)의 재사용 대기시간이 줄어들어 더 자주 사용합니다.',
    maxLevel: 5,
    baseCost: 65,
    costStep: 40,
    effectPerLevelLabel: '스킬 쿨타임 감소 +5% / Lv',
    iconPath: '/assets/ui/Icons/Icon_09.png',
  },
  {
    id: 'skill_reach_mastery',
    category: 'skills',
    name: '스킬 범위 확장',
    description: '액티브 스킬(Q)의 타격 반경이 넓어져 다수의 적을 동시에 타격합니다.',
    maxLevel: 4,
    baseCost: 70,
    costStep: 45,
    effectPerLevelLabel: '스킬 타격 반경 +15px / Lv',
    iconPath: '/assets/ui/Icons/Icon_06.png',
  },
  {
    id: 'battle_vampirism',
    category: 'skills',
    name: '전투 흡혈 본능',
    description: '적에게 입힌 피해의 일부만큼 체력을 즉시 회복합니다.',
    maxLevel: 4,
    baseCost: 75,
    costStep: 50,
    effectPerLevelLabel: '생명력 흡수 +2% / Lv',
    iconPath: '/assets/ui/Icons/Icon_03.png',
  },

  // ── 3. 모드별 전략 어드밴티지 ──
  {
    id: 'hunting_exp_boost',
    category: 'mode_advantage',
    modeTag: 'hunting_conquest',
    name: '모험가의 지혜',
    description: '사냥 시 획득하는 경험치가 증가하여 Lv.10 전직에 빠르게 도달합니다.',
    maxLevel: 4,
    baseCost: 60,
    costStep: 40,
    effectPerLevelLabel: '처치 경험치 +15% / Lv',
    iconPath: '/assets/ui/Icons/Icon_07.png',
  },
  {
    id: 'hunting_loot_fortune',
    category: 'mode_advantage',
    modeTag: 'hunting_conquest',
    name: '보물 사냥꾼',
    description: '마물 처치 시 장비 드롭 확률과 골드 획득량이 크게 상승합니다.',
    maxLevel: 4,
    baseCost: 65,
    costStep: 45,
    effectPerLevelLabel: '드롭률 +8%, 골드 +15% / Lv',
    iconPath: '/assets/ui/Icons/Icon_01.png',
  },
  {
    id: 'boss_slayer_instinct',
    category: 'mode_advantage',
    modeTag: 'boss_slayer',
    name: '거인 학살자',
    description: '보스 및 엘리트 몬스터에게 가하는 모든 피해가 대폭 증가합니다.',
    maxLevel: 5,
    baseCost: 70,
    costStep: 45,
    effectPerLevelLabel: '보스·엘리트 피해 +12% / Lv',
    iconPath: '/assets/ui/Icons/Icon_05.png',
  },
  {
    id: 'starter_supplies',
    category: 'mode_advantage',
    modeTag: 'territory_expansion',
    name: '원정대 초기 보급',
    description: '인스턴스 룸 시작 시 보유하는 목재·석재·금화가 증가합니다.',
    maxLevel: 5,
    baseCost: 50,
    costStep: 35,
    effectPerLevelLabel: '목재 +12, 석재 +8, 금화 +4 / Lv',
    iconPath: '/assets/ui/Icons/Icon_01.png',
  },
  {
    id: 'pioneer_efficiency',
    category: 'mode_advantage',
    modeTag: 'territory_expansion',
    name: '영지 개척 할인',
    description: '영지 해금, 건물 건설 및 마을 업그레이드 자원 소모량이 감소합니다.',
    maxLevel: 5,
    baseCost: 60,
    costStep: 40,
    effectPerLevelLabel: '해금·건설 비용 -6% / Lv',
    iconPath: '/assets/ui/Icons/Icon_02.png',
  },
  {
    id: 'citadel_fortification',
    category: 'mode_advantage',
    modeTag: 'sanctuary_defense',
    name: '성채 보강술',
    description: '모든 해금 영지 본진의 최대 체력이 증가하여 웨이브를 안정적으로 버팁니다.',
    maxLevel: 5,
    baseCost: 60,
    costStep: 35,
    effectPerLevelLabel: '본진 최대 HP +10% / Lv',
    iconPath: '/assets/ui/Icons/Icon_06.png',
  },
  {
    id: 'tower_overclock',
    category: 'mode_advantage',
    modeTag: 'sanctuary_defense',
    name: '방어 타워 증폭',
    description: '영지에 배치한 감시탑·방어 타워의 공격력이 강화됩니다.',
    maxLevel: 5,
    baseCost: 65,
    costStep: 40,
    effectPerLevelLabel: '타워 공격력 +12% / Lv',
    iconPath: '/assets/ui/Icons/Icon_04.png',
  },
];

export const COSTUME_DEFINITIONS: CostumeDefinition[] = [
  {
    id: 'costume_blue',
    colorKey: 'blue',
    name: '왕국 수호대 블루',
    description: '왕국 정규 수호대의 기본 푸른 제복입니다.',
    costPoints: 0,
    previewColorHex: '#2563eb',
    avatarPath: '/assets/ui/Human Avatars/Avatars_01.png',
  },
  {
    id: 'costume_red',
    colorKey: 'red',
    name: '핏빛 용병단 레드',
    description: '붉은 망토를 두른 최전선 돌격대의 복장입니다.',
    costPoints: 100,
    previewColorHex: '#dc2626',
    avatarPath: '/assets/ui/Human Avatars/Avatars_06.png',
  },
  {
    id: 'costume_yellow',
    colorKey: 'yellow',
    name: '황금 여명단 골드',
    description: '찬란한 황금빛 갑주로 빛나는 여명 기사단 코스튬입니다.',
    costPoints: 180,
    previewColorHex: '#eab308',
    avatarPath: '/assets/ui/Human Avatars/Avatars_02.png',
  },
  {
    id: 'costume_purple',
    colorKey: 'purple',
    name: '별빛 마도단 퍼플',
    description: '신비로운 보랏빛 기운이 깃든 별의 수호자 코스튬입니다.',
    costPoints: 220,
    previewColorHex: '#9333ea',
    avatarPath: '/assets/ui/Human Avatars/Avatars_03.png',
  },
  {
    id: 'costume_black',
    colorKey: 'black',
    name: '칠흑 그림자 블랙',
    description: '어둠 속에서 적을 베는 정예 암흑 기사 코스튬입니다.',
    costPoints: 300,
    previewColorHex: '#1f2937',
    avatarPath: '/assets/ui/Human Avatars/Avatars_04.png',
  },
];

export const AURA_DEFINITIONS: AuraDefinition[] = [
  {
    id: 'aura_none',
    name: '오라 없음',
    description: '기본 발밑 그림자만 표시합니다.',
    costPoints: 0,
    ringColorHex: 0x000000,
    badgeColorClass: 'bg-[#785c3a] text-[#fef3c7]',
  },
  {
    id: 'aura_starlight',
    name: '별빛 파편 오라',
    description: '은은한 푸른 별빛 고리가 캐릭터 발밑에서 회전합니다.',
    costPoints: 140,
    ringColorHex: 0x38bdf8,
    badgeColorClass: 'bg-[#0284c7] text-white',
  },
  {
    id: 'aura_ember',
    name: '불꽃 투지 오라',
    description: '타오르는 붉은 불꽃 기운이 발밑에 감돕니다.',
    costPoints: 180,
    ringColorHex: 0xf97316,
    badgeColorClass: 'bg-[#ea580c] text-white',
  },
  {
    id: 'aura_sanctuary',
    name: '황금 성소 오라',
    description: '고귀한 황금빛 수호 결계가 캐릭터 주변을 비춥니다.',
    costPoints: 240,
    ringColorHex: 0xfacc15,
    badgeColorClass: 'bg-[#ca8a04] text-[#1c1917]',
  },
];

export const COSMETIC_TITLES: CosmeticTitleDefinition[] = [
  { id: 'title_recruit', label: '초보 수호자', description: 'Tiny Isles에 첫 발을 디딘 모험가', costPoints: 0 },
  { id: 'title_boss_slayer', label: '대군주 토벌자', description: '대군주 토벌전 미션 클리어 또는 포인트 해금', costPoints: 100 },
  { id: 'title_pioneer', label: '황무지 개척왕', description: '섬 개척 원정 미션 클리어 또는 포인트 해금', costPoints: 100 },
  { id: 'title_guardian', label: '불굴의 성소지기', description: '성소 수호전 미션 클리어 또는 포인트 해금', costPoints: 120 },
  { id: 'title_legend', label: '전설의 섬 군주', description: '수많은 원정을 이끈 백전노장', costPoints: 300 },
];

export function getTraitUpgradeCost(trait: TraitDefinition, currentLevel: number): number {
  return trait.baseCost + currentLevel * trait.costStep;
}

export function calculateRefundableTraitPoints(state: MetaProgressionState): number {
  let total = 0;
  for (const trait of TRAIT_DEFINITIONS) {
    const lv = state.traitLevels[trait.id] ?? 0;
    for (let i = 0; i < lv; i++) {
      total += getTraitUpgradeCost(trait, i);
    }
  }
  return total;
}

export function computeMetaBonuses(state: MetaProgressionState): MetaBonusSummary {
  const lv = (id: TraitId) => state.traitLevels[id] ?? 0;
  const costume =
    COSTUME_DEFINITIONS.find((c) => c.id === state.equippedCostumeId) ?? COSTUME_DEFINITIONS[0];

  return {
    bonusMaxHp: lv('vitality_training') * 18,
    combatDamageBonus: lv('guardian_might') * 6,
    bonusSpeed: lv('swift_footwork') * 10,
    bonusCritChance: lv('lethal_precision') * 3,
    gatherDamageBonus: lv('gatherer_blessing') * 4,
    bonusSkillDamagePercent: lv('skill_power_mastery') * 12,
    bonusCooldownReductionPercent: lv('skill_haste_mastery') * 5,
    bonusSkillRadiusPx: lv('skill_reach_mastery') * 15,
    bonusLifestealPercent: lv('battle_vampirism') * 2,
    expGainBonusRatio: lv('hunting_exp_boost') * 0.15,
    lootDropBonusChance: lv('hunting_loot_fortune') * 0.08,
    goldGainBonusRatio: lv('hunting_loot_fortune') * 0.15,
    bossDamageBonusRatio: lv('boss_slayer_instinct') * 0.12,
    bonusWood: lv('starter_supplies') * 12,
    bonusStone: lv('starter_supplies') * 8,
    bonusGold: lv('starter_supplies') * 4,
    costDiscountRatio: lv('pioneer_efficiency') * 0.06,
    coreHpBonusRatio: lv('citadel_fortification') * 0.1,
    towerDamageBonusRatio: lv('tower_overclock') * 0.12,
    equippedCostumeColor: costume.colorKey,
    equippedAuraId: state.equippedAuraId ?? 'aura_none',
  };
}
