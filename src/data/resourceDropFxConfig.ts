import { EntityType } from '../types/game';

export type GatherableResourceType = EntityType;

export interface ResourceDropVisualSpec {
  /** 드랍 파티클로 사용할 텍스처 키 후보 (존재하는 첫 번째 키 사용) */
  textureKeys: readonly string[];
  /** 파티클 표시 크기 (px) */
  displaySizePx: number;
  /** 바닥 글로우 및 흡수 스파크 색상 */
  glowColor: number;
  /** 일반 타격 시 드랍 파티클 수 */
  hitDropCount: number;
  /** 자원 완전 파괴(hp <= 0) 시 추가 드랍 파티클 수 */
  breakBonusCount: number;
}

export interface ResourceDropPhysicsConfig {
  /** 동시 활성 파티클 상한 (프레임 드랍 방지) */
  maxActiveParticles: number;
  /** 자원 중심으로부터 수평 분산 반경 범위 (px) */
  scatterMinPx: number;
  /** 자원 중심으로부터 최대 수평 분산 반경 (px) */
  scatterMaxPx: number;
  /** 포물선 드랍 점프 높이 (px) */
  jumpArcHeightPx: number;
  /** 드랍 후 착지까지 걸리는 시간 (ms) */
  dropDurationMs: number;
  /** 착지 후 자석 호밍 시작 전 대기 시간 (ms) */
  idleHoldMinMs: number;
  /** 착지 후 자석 호밍 시작 전 최대 대기 시간 (ms) */
  idleHoldMaxMs: number;
  /** 자석 호밍 초기 속도 (px/s) */
  magnetInitialSpeedPx: number;
  /** 자석 호밍 가속도 (px/s^2) */
  magnetAccelPx: number;
  /** 자석 호밍 최대 속도 (px/s) */
  magnetMaxSpeedPx: number;
  /** 플레이어 중심 기준 흡수 완료 판정 반경 (px) */
  pickupRadiusPx: number;
  /** 플레이어 몸통 Y 오프셋 (발 기준이 아닌 가슴/중심으로 흡수) */
  playerTargetOffsetY: number;
  /** 자석 호밍 최대 지속 시간 안전장치 (ms) */
  maxMagnetDurationMs: number;
}

/**
 * 자원 채집 시 드랍 파티클(잘려진 통나무, 작은 광석, 고기) 및 자석 습득 이펙트 설정
 * [AI Guideline]: 파티클 수량, 속도, 텍스처, 색상은 로직이 아닌 이 데이터 파일에서 조정하세요.
 */
export const RESOURCE_DROP_VISUALS: Record<GatherableResourceType, ResourceDropVisualSpec> = {
  tree: {
    textureKeys: ['woodResource', 'item_bundle_wood'],
    displaySizePx: 26,
    glowColor: 0x8bc34a,
    hitDropCount: 2,
    breakBonusCount: 2,
  },
  rock: {
    textureKeys: ['rock2', 'rock1', 'item_bundle_stone'],
    displaySizePx: 22,
    glowColor: 0xcfd8dc,
    hitDropCount: 2,
    breakBonusCount: 2,
  },
  gold_rock: {
    textureKeys: ['goldResource2', 'goldResource', 'item_bundle_gold'],
    displaySizePx: 24,
    glowColor: 0xfbbf24,
    hitDropCount: 2,
    breakBonusCount: 3,
  },
  sheep: {
    textureKeys: ['meatResource', 'woodResource'],
    displaySizePx: 24,
    glowColor: 0xf43f5e,
    hitDropCount: 1,
    breakBonusCount: 2,
  },
};

export const RESOURCE_DROP_PHYSICS: ResourceDropPhysicsConfig = {
  maxActiveParticles: 48,
  scatterMinPx: 26,
  scatterMaxPx: 54,
  jumpArcHeightPx: 30,
  dropDurationMs: 280,
  idleHoldMinMs: 200,
  idleHoldMaxMs: 320,
  magnetInitialSpeedPx: 140,
  magnetAccelPx: 1550,
  magnetMaxSpeedPx: 860,
  pickupRadiusPx: 22,
  playerTargetOffsetY: -18,
  maxMagnetDurationMs: 1400,
};
