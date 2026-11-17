import { PlayerClassDefinition, PlayerClassId } from '../types/hunting';

/**
 * 개인 경험치(EXP) 및 레벨업 밸런스 설정 데이터
 */
export const LEVEL_EXP_TABLE: readonly number[] = [
  // Lv.1 → Lv.10 (누적 500 EXP: 초급 부락 4개 토벌 시 Lv.10 도달)
  20, 30, 40, 50, 55, 65, 75, 80, 85,
  // Lv.10 → Lv.15 (누적 +780 EXP: 중급 부락 공략 구간)
  110, 130, 155, 180, 205,
  // Lv.15 → Lv.20 (누적 +1,420 EXP: 상급 부락 공략 구간)
  230, 260, 290, 310, 330,
  // Lv.20 → Lv.25 (누적 +2,430 EXP: 최외곽 요새 전반 및 던전 방어)
  380, 430, 480, 540, 600,
  // Lv.25 → Lv.30 (누적 +3,970 EXP: 후반 최종 성장 구간)
  660, 720, 780, 850, 960,
] as const;

export const LEVEL_PROGRESSION_CONFIG = {
  maxLevel: 30,
  hpGainPerLevel: 18,
  attackGainPerLevel: 5,
  firstJobAdvancementLevel: 10,
} as const;

export function getRequiredExpForLevel(level: number): number {
  if (level >= LEVEL_PROGRESSION_CONFIG.maxLevel) {
    return LEVEL_EXP_TABLE[LEVEL_EXP_TABLE.length - 1];
  }
  const idx = Math.max(0, Math.min(LEVEL_EXP_TABLE.length - 1, level - 1));
  return LEVEL_EXP_TABLE[idx];
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
    attackRange: 60,
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
    passiveDescription: '레벨 10 달성 후 왕국 전직소를 건설하고 방문하여 상위 클래스로 전직할 수 있습니다.',
  },
  guardian: {
    id: 'guardian',
    name: '가디언 (전사)',
    title: '불굴의 성벽 수호기사',
    icon: '🛡️',
    requiredLevel: 10,
    costGold: 15,
    baseHpBonus: 120,
    baseAttackBonus: 22,
    baseSpeedBonus: 10,
    attackRange: 78,
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
    requiredLevel: 10,
    costGold: 15,
    baseHpBonus: 65,
    baseAttackBonus: 32,
    baseSpeedBonus: 45,
    attackRange: 105,
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
    requiredLevel: 10,
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
    requiredLevel: 10,
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
