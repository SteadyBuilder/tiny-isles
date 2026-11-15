/**
 * 몬스터 웨이브 타게팅 화살표(화면 내 머리 위 / 화면 밖 가장자리) 설정 데이터
 */
export interface MonsterIndicatorStyle {
  fillColor: number;
  strokeColor: number;
  strokeWidth: number;
  size: number;
}

export interface MonsterIndicatorConfig {
  /** 화면 가장자리로부터의 여백 (스크린 px) */
  edgeMarginPx: number;
  /** 화면 내 판정 여유 여백 (스크린 px) */
  inViewPaddingPx: number;
  /** 일반 몬스터 머리 위 오프셋 (월드 px) */
  normalOverheadOffsetY: number;
  /** 보스 몬스터 머리 위 오프셋 (월드 px) */
  bossOverheadOffsetY: number;
  /** 머리 위 화살표 상하 바운스 진폭 (스크린 px) */
  bobAmplitudePx: number;
  /** 머리 위 화살표 바운스 주기 속도 (rad/ms) */
  bobSpeedRadPerMs: number;
  /** 보스 몬스터 별도 색상/크기 구분 사용 여부 */
  differentiateBossColor: boolean;
  /** 일반 몬스터 화살표 스타일 (붉은색) */
  normalStyle: MonsterIndicatorStyle;
  /** 보스 몬스터 화살표 스타일 (차별화된 진홍색 + 골드 테두리) */
  bossStyle: MonsterIndicatorStyle;
}

export const MONSTER_INDICATOR_CONFIG: MonsterIndicatorConfig = {
  edgeMarginPx: 34,
  inViewPaddingPx: 20,
  normalOverheadOffsetY: 56,
  bossOverheadOffsetY: 92,
  bobAmplitudePx: 5,
  bobSpeedRadPerMs: 0.007,
  differentiateBossColor: true,
  normalStyle: {
    fillColor: 0xef4444,
    strokeColor: 0x7f1d1d,
    strokeWidth: 2,
    size: 14,
  },
  bossStyle: {
    fillColor: 0xdc2626,
    strokeColor: 0xfacc15,
    strokeWidth: 2.5,
    size: 18,
  },
};
