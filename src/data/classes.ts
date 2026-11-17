import { PlayerClassDefinition, PlayerClassId } from '../types/hunting';

/**
 * 개인 경험치(EXP) 및 레벨업 밸런스 설정 데이터
 */
export const LEVEL_PROGRESSION_CONFIG = {
  maxLevel: 30,
  baseExpRequired: 60,
  expGrowthPerLevel: 35,
  hpGainPerLevel: 18,
  attackGainPerLevel: 5,
  firstJobAdvancementLevel: 3,
} as const;

export function getRequiredExpForLevel(level: number): number {
  return (
    LEVEL_PROGRESSION_CONFIG.baseExpRequired +
    Math.max(0, level - 1) * LEVEL_PROGRESSION_CONFIG.expGrowthPerLevel
  );
}

/**
 * 모험가 기본 클래스 및 전직소(job_hall) 4대 전직 클래스 데이터
 */
export const PLAYER_CLASS_DEFINITIONS: Record<PlayerClassId, PlayerClassDefinition> = {
  pawn: {
    id: 'pawn',
    name: '견습 모험가',
    title: '왕국의 초보 수호자',
    icon: '🪓',
    requiredLevel: 1,
    costGold: 0,
    baseHpBonus: 0,
    baseAttackBonus: 0,
    baseSpeedBonus: 0,
    attackRange: 135,
    attackCooldownMs: 320,
    isRanged: false,
    isSplash: false,
    isPiercing: false,
    skillName: '전력의 일격',
    skillIcon: '💥',
    skillDescription: '주변 마물에게 기본 공격력의 200% 물리 피해를 입힙니다.',
    skillCooldownMs: 7000,
    skillDamageMultiplier: 2.0,
    skillRadius: 150,
    passiveDescription: '레벨 3 달성 후 전직소에서 상위 클래스로 전직할 수 있습니다.',
  },
  guardian: {
    id: 'guardian',
    name: '가디언 (전사)',
    title: '불굴의 성벽 수호기사',
    icon: '🛡️',
    requiredLevel: 3,
    costGold: 15,
    baseHpBonus: 120,
    baseAttackBonus: 22,
    baseSpeedBonus: 10,
    attackRange: 155,
    attackCooldownMs: 340,
    isRanged: false,
    isSplash: true,
    isPiercing: false,
    skillName: '대지 분쇄 회전참',
    skillIcon: '🌪️',
    skillDescription:
      '반경 220px 내의 모든 마물을 동시에 베어 넘기고 내 체력을 25 회복합니다.',
    skillCooldownMs: 6500,
    skillDamageMultiplier: 2.8,
    skillRadius: 220,
    passiveDescription: '평타가 전방 다수의 적을 동시에 타격하며 최대 체력이 크게 증가합니다.',
  },
  lancer: {
    id: 'lancer',
    name: '드래곤 랜서 (창병)',
    title: '전장을 가르는 폭풍의 창',
    icon: '🔱',
    requiredLevel: 3,
    costGold: 15,
    baseHpBonus: 65,
    baseAttackBonus: 32,
    baseSpeedBonus: 45,
    attackRange: 210,
    attackCooldownMs: 300,
    isRanged: false,
    isSplash: false,
    isPiercing: true,
    skillName: '초음속 관통 돌격',
    skillIcon: '⚡',
    skillDescription:
      '전방으로 돌진하며 반경 240px 내 마물과 부락 본진에 320% 관통 피해를 입힙니다.',
    skillCooldownMs: 5500,
    skillDamageMultiplier: 3.2,
    skillRadius: 240,
    passiveDescription:
      '긴 사거리로 일직선상의 적을 관통 타격하며 이동속도와 본진 파괴력이 뛰어납니다.',
  },
  ranger: {
    id: 'ranger',
    name: '레인저 (궁수)',
    title: '백발백중의 바람 사수',
    icon: '🏹',
    requiredLevel: 3,
    costGold: 15,
    baseHpBonus: 35,
    baseAttackBonus: 26,
    baseSpeedBonus: 35,
    attackRange: 360,
    attackCooldownMs: 240,
    isRanged: true,
    isSplash: false,
    isPiercing: false,
    skillName: '천공의 멀티샷 (화살비)',
    skillIcon: '🌧️',
    skillDescription:
      '사거리 내 최대 10마리의 마물에게 동시에 강화 화살을 발사하여 260% 피해를 입힙니다.',
    skillCooldownMs: 6000,
    skillDamageMultiplier: 2.6,
    skillRadius: 380,
    passiveDescription:
      '원거리에서 안전하게 고속 연사로 마물과 원거리/마법사 부락을 제압합니다.',
  },
  archmage: {
    id: 'archmage',
    name: '아크메이지 (마법사)',
    title: '심연과 성광의 대현자',
    icon: '🔮',
    requiredLevel: 3,
    costGold: 15,
    baseHpBonus: 50,
    baseAttackBonus: 35,
    baseSpeedBonus: 20,
    attackRange: 330,
    attackCooldownMs: 380,
    isRanged: true,
    isSplash: true,
    isPiercing: false,
    skillName: '메테오 노바 & 성광 치유',
    skillIcon: '☄️',
    skillDescription:
      '반경 280px 내의 마물 대군에게 340% 화염 폭발 피해를 입히고 내 체력을 40 회복합니다.',
    skillCooldownMs: 7500,
    skillDamageMultiplier: 3.4,
    skillRadius: 280,
    passiveDescription:
      '마력탄이 적중 시 주변 마물에게 스플래시 폭발 피해를 입혀 100마리 대군 섬멸에 특화됩니다.',
  },
};

export const ADVANCEMENT_CLASS_LIST: PlayerClassDefinition[] = [
  PLAYER_CLASS_DEFINITIONS.guardian,
  PLAYER_CLASS_DEFINITIONS.lancer,
  PLAYER_CLASS_DEFINITIONS.ranger,
  PLAYER_CLASS_DEFINITIONS.archmage,
];
