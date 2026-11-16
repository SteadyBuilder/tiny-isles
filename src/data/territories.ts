import { Island, VillageTier } from '../types/game';
import { VILLAGE_TIER_CONFIGS } from './buildings';

interface TerritorySeed {
  id: number;
  gridX: number;
  gridY: number;
  costWood: number;
  costStone: number;
  costGold: number;
  name: string;
  resourceRichLabel: string;
  unlocked?: boolean;
  villageTier?: VillageTier;
}

const createTerritory = (seed: TerritorySeed): Island => {
  const tier: VillageTier = seed.villageTier ?? 0;
  const maxHp = VILLAGE_TIER_CONFIGS[tier].coreMaxHp;
  return {
    id: seed.id,
    gridX: seed.gridX,
    gridY: seed.gridY,
    costWood: seed.costWood,
    costStone: seed.costStone,
    costGold: seed.costGold,
    unlocked: seed.unlocked ?? false,
    name: seed.name,
    isAdjacentRich: false,
    resourceRichLabel: seed.resourceRichLabel,
    villageTier: tier,
    coreHp: maxHp,
    coreMaxHp: maxHp,
  };
};

const ADJACENT_LABEL = '🏡 인접 개척 마을터 (타워·성벽·생산건물 건설 거점)';
const INNER_RING_LABEL = '🏘️ 3×3 내곽 마을터 (확장 건설 및 방어선 거점)';
const OUTER_LABEL = '🏰 외곽 확장 마을터 (전방 방어선 및 건물 건설 거점)';
const BORDER_LABEL = '🚩 최외곽 요충지 마을터 (국경 방어 거점)';

export const INITIAL_ISLANDS: Island[] = [
  // 1. 중심 마을 (처음부터 중소마을 Lv.2 이며 나무 방책이 있음)
  createTerritory({
    id: 0,
    gridX: 0,
    gridY: 0,
    costWood: 0,
    costStone: 0,
    costGold: 0,
    unlocked: true,
    villageTier: 2,
    name: '중심 마을 (중앙 본거지)',
    resourceRichLabel: '🏘️ 시작 중소마을 (나무 방책 보유)',
  }),

  // 2. 중심 마을 인접 땅 (십자 방향 - 주요 건설 및 방어 거점)
  createTerritory({ id: 1, gridX: 1, gridY: 0, costWood: 35, costStone: 25, costGold: 5, name: '동쪽 관문 마을터', resourceRichLabel: ADJACENT_LABEL }),
  createTerritory({ id: 2, gridX: 0, gridY: 1, costWood: 42, costStone: 30, costGold: 8, name: '남쪽 성채 마을터', resourceRichLabel: ADJACENT_LABEL }),
  createTerritory({ id: 3, gridX: -1, gridY: 0, costWood: 52, costStone: 38, costGold: 12, name: '서쪽 요새 마을터', resourceRichLabel: ADJACENT_LABEL }),
  createTerritory({ id: 4, gridX: 0, gridY: -1, costWood: 60, costStone: 45, costGold: 15, name: '북쪽 고원 마을터', resourceRichLabel: ADJACENT_LABEL }),

  // 3. 중심 마을 대각선 인접 땅 (3x3 중심권 방어 거점)
  createTerritory({ id: 5, gridX: 1, gridY: 1, costWood: 50, costStone: 35, costGold: 10, name: '남동쪽 초원 마을터', resourceRichLabel: INNER_RING_LABEL }),
  createTerritory({ id: 6, gridX: -1, gridY: 1, costWood: 65, costStone: 50, costGold: 14, name: '남서쪽 암벽 마을터', resourceRichLabel: INNER_RING_LABEL }),
  createTerritory({ id: 7, gridX: 1, gridY: -1, costWood: 72, costStone: 48, costGold: 16, name: '북동쪽 삼림 마을터', resourceRichLabel: INNER_RING_LABEL }),
  createTerritory({ id: 8, gridX: -1, gridY: -1, costWood: 90, costStone: 70, costGold: 24, name: '북서쪽 고대 유적 마을터', resourceRichLabel: INNER_RING_LABEL }),

  // 4. 외곽 확장 영지 (거리 2 십자 방향)
  createTerritory({ id: 9, gridX: 2, gridY: 0, costWood: 110, costStone: 80, costGold: 22, name: '극동 거목림 변경 마을터', resourceRichLabel: OUTER_LABEL }),
  createTerritory({ id: 10, gridX: 0, gridY: 2, costWood: 100, costStone: 115, costGold: 25, name: '남부 화강암 변경 마을터', resourceRichLabel: OUTER_LABEL }),
  createTerritory({
    id: 11,
    gridX: -2,
    gridY: 0,
    costWood: 120,
    costStone: 95,
    costGold: 36,
    name: '극서 태양금광 변경 마을터',
    resourceRichLabel: '⛏️ 황금광산 해금 거점 (점령 시 인접 황금광산 봉인 해제!)',
  }),
  createTerritory({ id: 12, gridX: 0, gridY: -2, costWood: 140, costStone: 110, costGold: 45, name: '북방 별빛성소 변경 마을터', resourceRichLabel: OUTER_LABEL }),

  // 5. 최외곽 국경 마을터 링
  createTerritory({ id: 13, gridX: 2, gridY: 1, costWood: 125, costStone: 100, costGold: 30, name: '동남 국경 초소 마을터', resourceRichLabel: BORDER_LABEL }),
  createTerritory({ id: 14, gridX: 1, gridY: 2, costWood: 120, costStone: 110, costGold: 30, name: '남동 평원 개척 마을터', resourceRichLabel: BORDER_LABEL }),
  createTerritory({ id: 15, gridX: -1, gridY: 2, costWood: 130, costStone: 115, costGold: 35, name: '남서 바위언덕 마을터', resourceRichLabel: BORDER_LABEL }),
  createTerritory({ id: 16, gridX: -2, gridY: 1, costWood: 150, costStone: 125, costGold: 48, name: '남서 국경 요새 마을터', resourceRichLabel: BORDER_LABEL }),
  createTerritory({ id: 17, gridX: 2, gridY: -1, costWood: 140, costStone: 105, costGold: 40, name: '북동 바람언덕 마을터', resourceRichLabel: BORDER_LABEL }),
  createTerritory({ id: 18, gridX: 1, gridY: -2, costWood: 155, costStone: 120, costGold: 50, name: '북동 오로라 관측 마을터', resourceRichLabel: BORDER_LABEL }),
  createTerritory({ id: 19, gridX: -1, gridY: -2, costWood: 165, costStone: 130, costGold: 58, name: '북서 달빛계곡 마을터', resourceRichLabel: BORDER_LABEL }),
  createTerritory({ id: 20, gridX: -2, gridY: -1, costWood: 180, costStone: 140, costGold: 70, name: '서북 그림자봉우리 마을터', resourceRichLabel: BORDER_LABEL }),
];
