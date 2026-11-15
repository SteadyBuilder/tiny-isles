import { MonsterIndicatorConfig, MonsterIndicatorStyle } from '../../data/monsterIndicator';

export type MonsterIndicatorMode = 'overhead' | 'edge';

export interface MonsterIndicatorTarget {
  id: string;
  x: number;
  y: number;
  isBoss: boolean;
}

export interface CameraWorldBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

export interface MonsterIndicatorPlacement {
  mode: MonsterIndicatorMode;
  x: number;
  y: number;
  /** 화살표가 가리키는 라디안 각도 (0 = 오른쪽, Math.PI/2 = 아래쪽) */
  angle: number;
  /** 줌 보정이 적용된 화살표 크기 (월드 좌표 기준) */
  worldSize: number;
  /** 줌 보정이 적용된 테두리 두께 (월드 좌표 기준) */
  worldStrokeWidth: number;
  style: MonsterIndicatorStyle;
}

/**
 * 몬스터 위치와 카메라 뷰포트를 기반으로 타게팅 화살표 배치 정보를 계산합니다. (순수 함수)
 */
export function computeMonsterIndicatorPlacement(
  target: MonsterIndicatorTarget,
  view: CameraWorldBounds,
  zoom: number,
  timeMs: number,
  config: MonsterIndicatorConfig
): MonsterIndicatorPlacement {
  const safeZoom = Math.max(0.1, zoom);
  const style =
    config.differentiateBossColor && target.isBoss ? config.bossStyle : config.normalStyle;

  const worldSize = style.size / safeZoom;
  const worldStrokeWidth = style.strokeWidth / safeZoom;
  const inViewPad = config.inViewPaddingPx / safeZoom;

  const isInsideView =
    target.x >= view.x + inViewPad &&
    target.x <= view.right - inViewPad &&
    target.y >= view.y + inViewPad &&
    target.y <= view.bottom - inViewPad;

  if (isInsideView) {
    const baseOffsetY = target.isBoss ? config.bossOverheadOffsetY : config.normalOverheadOffsetY;
    const bobWorld =
      (Math.sin(timeMs * config.bobSpeedRadPerMs) * config.bobAmplitudePx) / safeZoom;

    return {
      mode: 'overhead',
      x: target.x,
      y: target.y - baseOffsetY + bobWorld,
      angle: Math.PI / 2,
      worldSize,
      worldStrokeWidth,
      style,
    };
  }

  const edgePad = config.edgeMarginPx / safeZoom;
  const halfW = Math.max(1, view.width * 0.5 - edgePad);
  const halfH = Math.max(1, view.height * 0.5 - edgePad);

  const dx = target.x - view.centerX;
  const dy = target.y - view.centerY;

  const scaleX = Math.abs(dx) > 1e-4 ? halfW / Math.abs(dx) : Number.POSITIVE_INFINITY;
  const scaleY = Math.abs(dy) > 1e-4 ? halfH / Math.abs(dy) : Number.POSITIVE_INFINITY;
  const t = Math.min(scaleX, scaleY);

  const edgeX = Number.isFinite(t) ? view.centerX + dx * t : view.centerX;
  const edgeY = Number.isFinite(t) ? view.centerY + dy * t : view.y + edgePad;
  const angle = Math.atan2(dy, dx);

  return {
    mode: 'edge',
    x: edgeX,
    y: edgeY,
    angle,
    worldSize,
    worldStrokeWidth,
    style,
  };
}
