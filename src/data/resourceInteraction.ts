import { Entity } from '../types/game';

export interface GatherRectRatio {
  /** 스프라이트 표시 너비 대비 채집 판정 영역 너비 비율 (0~1) */
  widthRatio: number;
  /** 스프라이트 표시 높이 대비 채집 판정 영역 높이 비율 (0~1) */
  heightRatio: number;
  /** 영역 기준점: 'bottom'은 밑동/바닥 기준, 'center'는 스프라이트 정중앙 기준 */
  anchorY: 'center' | 'bottom';
}

export interface ResourceInteractionRule {
  /** 스프라이트 내 실제 채집 가능 본체 영역 비율 */
  gatherRectRatio: GatherRectRatio;
  /** 본체 영역 경계로부터 플레이어 중심까지 허용되는 최대 채집 거리 (px) */
  gatherReachPx: number;
  /** 마우스/터치 클릭 시 전체 스프라이트 영역 바깥에 허용되는 여유 픽셀 (px) */
  tapPaddingPx: number;
}

/**
 * 자원 타입별 스프라이트 기준 채집·클릭 판정 규칙
 * [AI Guideline]: 채집 거리/히트박스 밸런스 조정은 로직이 아닌 이 데이터 파일에서 수행하세요.
 */
export const RESOURCE_INTERACTION_RULES: Record<Entity['type'], ResourceInteractionRule> = {
  tree: {
    // 나무는 수관(나뭇잎)을 제외한 하단 밑동 영역을 기준으로 채집 판정
    gatherRectRatio: {
      widthRatio: 0.44,
      heightRatio: 0.34,
      anchorY: 'bottom',
    },
    gatherReachPx: 22,
    tapPaddingPx: 6,
  },
  rock: {
    gatherRectRatio: {
      widthRatio: 0.78,
      heightRatio: 0.75,
      anchorY: 'center',
    },
    gatherReachPx: 20,
    tapPaddingPx: 6,
  },
  gold_rock: {
    gatherRectRatio: {
      widthRatio: 0.72,
      heightRatio: 0.68,
      anchorY: 'center',
    },
    gatherReachPx: 20,
    tapPaddingPx: 6,
  },
  sheep: {
    gatherRectRatio: {
      widthRatio: 0.56,
      heightRatio: 0.52,
      anchorY: 'center',
    },
    gatherReachPx: 20,
    tapPaddingPx: 8,
  },
};
