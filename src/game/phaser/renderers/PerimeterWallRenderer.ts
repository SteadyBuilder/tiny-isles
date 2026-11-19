import Phaser from 'phaser';
import { CONSTRUCTED_DEPTH_BIAS, ySortDepth } from '../../depthLayers';
import { getPerimeterWallSpan } from '../../wallCollisionGeometry';

export interface PerimeterWallTextureKeys {
  gateH: string;
  gateV: string;
  wingH: string;
  wingV: string;
  corner: string;
  standalone: string;
}

export type PerimeterWallStyle = 'woodPalisade' | 'stoneWall';

const PERIMETER_WALL_TEXTURE_MAP: Record<PerimeterWallStyle, PerimeterWallTextureKeys> = {
  woodPalisade: {
    gateH: 'woodPalisadeGate',
    gateV: 'woodPalisadeGateV',
    wingH: 'woodPalisadeH',
    wingV: 'woodPalisadeV',
    corner: 'woodPalisadeCorner',
    standalone: 'woodPalisade',
  },
  stoneWall: {
    gateH: 'stoneWallGate',
    gateV: 'stoneWallGateV',
    wingH: 'stoneWallH',
    wingV: 'stoneWallV',
    corner: 'stoneWallCorner',
    standalone: 'stoneWall',
  },
};

export function getPerimeterWallTextureKeys(style: PerimeterWallStyle): PerimeterWallTextureKeys {
  return PERIMETER_WALL_TEXTURE_MAP[style];
}

export interface RenderPerimeterWallParams {
  scene: Phaser.Scene;
  container: Phaser.GameObjects.Container;
  slotIndex: number;
  style: PerimeterWallStyle;
  extraVisuals: Phaser.GameObjects.Image[];
  tint?: number;
}

/**
 * 플레이어 영지 및 몬스터 부락 공용 외곽 목책/성벽 렌더러.
 * `TERRITORY_BUILD_SLOTS[0..3]` 기반 `getPerimeterWallSpan`을 단일 진실 공급원으로 사용하여
 * 영지 전체 외곽을 빈틈없이 둘러칩니다.
 */
export function renderPerimeterWallSprites(params: RenderPerimeterWallParams): void {
  const { scene, container, slotIndex, style, extraVisuals, tint } = params;
  const keys = getPerimeterWallTextureKeys(style);
  const span = getPerimeterWallSpan(slotIndex);
  const isHorizontal = slotIndex === 0 || slotIndex === 1;

  const applyTint = (img: Phaser.GameObjects.Image): void => {
    if (tint !== undefined) {
      img.setTint(tint);
    }
  };

  if (isHorizontal && span) {
    const gate = scene.add.image(0, 0, keys.gateH);
    gate.setDisplaySize(128, 64);
    gate.setDepth(2);
    applyTint(gate);
    container.add(gate);

    addHorizontalWallWing(scene, container, span.negCorner + 32, -60, keys.wingH, tint);
    addHorizontalWallWing(scene, container, 60, span.posCorner - 32, keys.wingH, tint);

    const leftCorner = scene.add.image(span.negCorner, 0, keys.corner);
    leftCorner.setDisplaySize(64, 64);
    leftCorner.setDepth(3);
    applyTint(leftCorner);
    container.add(leftCorner);

    const rightCorner = scene.add.image(span.posCorner, 0, keys.corner);
    rightCorner.setDisplaySize(64, 64);
    rightCorner.setDepth(3);
    applyTint(rightCorner);
    container.add(rightCorner);
    return;
  }

  if ((slotIndex === 2 || slotIndex === 3) && span) {
    const gate = scene.add.image(0, 0, keys.gateV);
    gate.setDisplaySize(64, 128);
    gate.setDepth(2);
    applyTint(gate);
    container.add(gate);

    addVerticalWallWing(scene, container, span.negCorner, -60, keys.wingV, extraVisuals, tint);
    addVerticalWallWing(scene, container, 60, span.posCorner, keys.wingV, extraVisuals, tint);
    return;
  }

  const standalone = scene.add.image(0, -10, keys.standalone);
  standalone.setDisplaySize(128, 128);
  applyTint(standalone);
  container.add(standalone);
}

function addHorizontalWallWing(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  startX: number,
  endX: number,
  textureKey: string,
  tint?: number
): void {
  const totalW = Math.max(64, endX - startX);
  const segments = Math.max(1, Math.round(totalW / 192));
  const segW = totalW / segments;
  for (let i = 0; i < segments; i++) {
    const cx = startX + (i + 0.5) * segW;
    const wing = scene.add.image(cx, 0, textureKey);
    wing.setDisplaySize(segW + 2, 64);
    wing.setDepth(1);
    if (tint !== undefined) {
      wing.setTint(tint);
    }
    container.add(wing);
  }
}

function addVerticalWallWing(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  startY: number,
  endY: number,
  textureKey: string,
  extraVisuals: Phaser.GameObjects.Image[],
  tint?: number
): void {
  const totalH = Math.max(64, endY - startY);
  const segments = Math.max(1, Math.round(totalH / 192));
  const segH = totalH / segments;
  for (let i = 0; i < segments; i++) {
    const cy = startY + (i + 0.5) * segH;
    const worldY = container.y + cy;
    const wing = scene.add.image(container.x, worldY, textureKey);
    wing.setDisplaySize(64, segH + 2);
    wing.setDepth(ySortDepth(worldY, CONSTRUCTED_DEPTH_BIAS.WALL));
    if (tint !== undefined) {
      wing.setTint(tint);
    }
    extraVisuals.push(wing);
  }
}
