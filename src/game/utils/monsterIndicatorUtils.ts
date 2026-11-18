import { MonsterIndicatorConfig, MonsterIndicatorStyle } from '../../data/monsterIndicator';

export type MonsterIndicatorMode = 'overhead' | 'edge';

export type MonsterIndicatorTargetKind = 'normal' | 'boss' | 'camp' | 'dungeon';

export interface MonsterIndicatorTarget {
  id: string;
  x: number;
  y: number;
  isBoss: boolean;
  kind?: MonsterIndicatorTargetKind;
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

function resolveTargetStyleAndOffset(
  target: MonsterIndicatorTarget,
  config: MonsterIndicatorConfig
): { style: MonsterIndicatorStyle; overheadOffsetY: number } {
  const kind = target.kind ?? (target.isBoss ? 'boss' : 'normal');
  if (kind === 'camp') {
    return { style: config.campStyle, overheadOffsetY: config.campOverheadOffsetY };
  }
  if (kind === 'dungeon') {
    return {
      style: config.dungeonStyle,
      overheadOffsetY: target.isBoss ? config.bossOverheadOffsetY : config.campOverheadOffsetY,
    };
  }
  if (kind === 'boss' || (config.differentiateBossColor && target.isBoss)) {
    return { style: config.bossStyle, overheadOffsetY: config.bossOverheadOffsetY };
  }
  return { style: config.normalStyle, overheadOffsetY: config.normalOverheadOffsetY };
}

/**
 * 타겟 위치와 카메라 뷰포트를 기반으로 타게팅 화살표 배치 정보를 기존 객체에 기록합니다. (프레임 할당 제로)
 */
export function computeMonsterIndicatorPlacementInto(
  target: MonsterIndicatorTarget,
  view: CameraWorldBounds,
  zoom: number,
  timeMs: number,
  config: MonsterIndicatorConfig,
  out: MonsterIndicatorPlacement
): MonsterIndicatorPlacement {
  const safeZoom = Math.max(0.1, zoom);
  const { style, overheadOffsetY } = resolveTargetStyleAndOffset(target, config);

  const worldSize = style.size / safeZoom;
  const worldStrokeWidth = style.strokeWidth / safeZoom;
  const inViewPad = config.inViewPaddingPx / safeZoom;

  out.worldSize = worldSize;
  out.worldStrokeWidth = worldStrokeWidth;
  out.style = style;

  const isInsideView =
    target.x >= view.x + inViewPad &&
    target.x <= view.right - inViewPad &&
    target.y >= view.y + inViewPad &&
    target.y <= view.bottom - inViewPad;

  if (isInsideView) {
    const bobWorld =
      (Math.sin(timeMs * config.bobSpeedRadPerMs) * config.bobAmplitudePx) / safeZoom;

    out.mode = 'overhead';
    out.x = target.x;
    out.y = target.y - overheadOffsetY + bobWorld;
    out.angle = Math.PI / 2;
    return out;
  }

  const edgePad = config.edgeMarginPx / safeZoom;
  const halfW = Math.max(1, view.width * 0.5 - edgePad);
  const halfH = Math.max(1, view.height * 0.5 - edgePad);

  const dx = target.x - view.centerX;
  const dy = target.y - view.centerY;

  const scaleX = Math.abs(dx) > 1e-4 ? halfW / Math.abs(dx) : Number.POSITIVE_INFINITY;
  const scaleY = Math.abs(dy) > 1e-4 ? halfH / Math.abs(dy) : Number.POSITIVE_INFINITY;
  const t = Math.min(scaleX, scaleY);

  out.mode = 'edge';
  out.x = Number.isFinite(t) ? view.centerX + dx * t : view.centerX;
  out.y = Number.isFinite(t) ? view.centerY + dy * t : view.y + edgePad;
  out.angle = Math.atan2(dy, dx);
  return out;
}

/**
 * 타겟 위치와 카메라 뷰포트를 기반으로 타게팅 화살표 배치 정보를 계산합니다. (순수 함수)
 */
export function computeMonsterIndicatorPlacement(
  target: MonsterIndicatorTarget,
  view: CameraWorldBounds,
  zoom: number,
  timeMs: number,
  config: MonsterIndicatorConfig
): MonsterIndicatorPlacement {
  const out: MonsterIndicatorPlacement = {
    mode: 'overhead',
    x: 0,
    y: 0,
    angle: 0,
    worldSize: 0,
    worldStrokeWidth: 0,
    style: config.normalStyle,
  };
  return computeMonsterIndicatorPlacementInto(target, view, zoom, timeMs, config, out);
}
