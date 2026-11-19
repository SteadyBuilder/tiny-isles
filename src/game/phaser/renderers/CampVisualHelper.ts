import Phaser from 'phaser';
import { MonsterCampState } from '../../../types/game';
import { CollisionBox } from '../../constants';
import { CONSTRUCTED_DEPTH_BIAS, ySortDepth } from '../../depthLayers';
import { PerimeterWallStyle, renderPerimeterWallSprites } from './PerimeterWallRenderer';

export interface CampVisualNode {
  camp: MonsterCampState;
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  hpBar: Phaser.GameObjects.Graphics;
  titleText: Phaser.GameObjects.Text;
  statusText: Phaser.GameObjects.Text;
  hpTrailRatio: number;
  hpFlashUntil: number;
}

export interface CampStructureVisualResult {
  container: Phaser.GameObjects.Container;
  hpBar: Phaser.GameObjects.Graphics;
  collider?: Phaser.Physics.Arcade.Sprite;
  extraVisuals?: Phaser.GameObjects.Image[];
}

/**
 * 몬스터 부락 본진 및 요새 방어벽·타워의 Phaser 비주얼/HP 바 렌더링 유틸
 */
export function createCampVisualNode(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  camp: MonsterCampState,
  spriteKey: 'blackTower' | 'blackCastle' | 'purpleCastle'
): CampVisualNode {
  const container = scene.add.container(cx, cy);
  container.setDepth(ySortDepth(cy, 26));

  const tex = scene.textures.exists(spriteKey) ? spriteKey : 'tower';
  const sprite = scene.add.image(0, -20, tex);
  const size = camp.ring >= 3 ? 210 : 165;
  sprite.setDisplaySize(size, size);
  container.add(sprite);

  const titleText = scene.add
    .text(0, -118, `💀 Lv.${camp.level} ${camp.name}`, {
      fontFamily: 'Pretendard, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: camp.ring >= 3 ? '#f43f5e' : '#fb923c',
      stroke: '#000000',
      strokeThickness: 3,
    })
    .setOrigin(0.5);
  container.add(titleText);

  const statusText = scene.add
    .text(0, -98, `부락 본진 (${camp.coreHp}/${camp.coreMaxHp})`, {
      fontFamily: 'Pretendard, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#fde047',
      stroke: '#000000',
      strokeThickness: 2.5,
    })
    .setOrigin(0.5);
  container.add(statusText);

  const hpBar = scene.add.graphics();
  container.add(hpBar);

  const node: CampVisualNode = {
    camp,
    container,
    sprite,
    hpBar,
    titleText,
    statusText,
    hpTrailRatio: 1,
    hpFlashUntil: 0,
  };
  updateCampHpVisualNode(node, false);
  return node;
}

export function updateCampHpVisualNode(node: CampVisualNode, isDamageEvent = false): void {
  const { camp, hpBar, titleText, statusText, sprite } = node;
  titleText.setText(
    camp.destroyed ? `🏳️ [토벌됨] ${camp.name}` : `💀 Lv.${camp.level} ${camp.name}`
  );

  if (camp.destroyed) {
    sprite.setAlpha(0.35);
    sprite.setTint(0x64748b);
    statusText.setText(`⏳ 재건까지 ${camp.respawnRemainingSec ?? 0}초`);
    statusText.setColor('#94a3b8');
    hpBar.clear();
    return;
  }

  sprite.setAlpha(1);
  sprite.clearTint();
  statusText.setText(`부락 본진 (${camp.coreHp}/${camp.coreMaxHp})`);
  statusText.setColor('#fde047');

  const ratio = Math.max(0, Math.min(1, camp.coreHp / Math.max(1, camp.coreMaxHp)));
  if (ratio > node.hpTrailRatio) {
    node.hpTrailRatio = ratio;
  } else if (isDamageEvent && ratio < node.hpTrailRatio) {
    node.hpFlashUntil = performance.now() + 240;
  }

  const now = performance.now();
  const isFlashing = now < node.hpFlashUntil;
  const barW = 104;
  const barH = 8;
  const barY = -83 - (isFlashing ? 3 : 0);

  hpBar.clear();
  hpBar.fillStyle(0x0f172a, 0.92);
  hpBar.fillRect(-barW / 2 - 1, barY - 1, barW + 2, barH + 2);
  if (isFlashing) {
    hpBar.lineStyle(1.5, 0xfef08a, 0.95);
    hpBar.strokeRect(-barW / 2 - 1.5, barY - 1.5, barW + 3, barH + 3);
  }
  if (node.hpTrailRatio > ratio + 0.002) {
    hpBar.fillStyle(0xfef08a, 0.92);
    hpBar.fillRect(-barW / 2, barY, Math.max(2, barW * node.hpTrailRatio), barH);
  }
  hpBar.fillStyle(0xe11d48, 1);
  if (ratio > 0) {
    hpBar.fillRect(-barW / 2, barY, Math.max(2, barW * ratio), barH);
  }
}

export function createCampStructureVisual(params: {
  scene: Phaser.Scene;
  wallColliders?: Phaser.Physics.Arcade.StaticGroup;
  kind: 'wall' | 'tower';
  slotIndex?: number;
  x: number;
  y: number;
  spriteKey: string;
  isHoriz: boolean;
  ring: 1 | 2 | 3 | 4;
  collisionBox: CollisionBox;
  refreshCollider?: boolean;
}): CampStructureVisualResult {
  const { scene } = params;
  const container = scene.add.container(params.x, params.y);
  const depthBias = params.kind === 'tower' ? 140 : CONSTRUCTED_DEPTH_BIAS.WALL;
  container.setDepth(ySortDepth(params.y, depthBias));

  const tint = params.ring >= 3 ? 0xc084fc : 0xfca5a5;
  const extraVisuals: Phaser.GameObjects.Image[] = [];

  if (params.kind === 'tower') {
    const tex = scene.textures.exists(params.spriteKey) ? params.spriteKey : 'tower';
    const sprite = scene.add.image(0, -18, tex);
    sprite.setDisplaySize(96, 136);
    sprite.setTint(tint);
    container.add(sprite);
  } else if (params.slotIndex !== undefined) {
    const style: PerimeterWallStyle =
      params.spriteKey === 'woodPalisade' ? 'woodPalisade' : 'stoneWall';
    renderPerimeterWallSprites({
      scene,
      container,
      slotIndex: params.slotIndex,
      style,
      extraVisuals,
      tint,
    });
  } else {
    const directionalKey = `${params.spriteKey}${params.isHoriz ? 'H' : 'V'}`;
    const resolvedKey = scene.textures.exists(directionalKey) ? directionalKey : params.spriteKey;
    const tex = scene.textures.exists(resolvedKey) ? resolvedKey : 'tower';
    const sprite = scene.add.image(0, -8, tex);
    const w = params.isHoriz ? 165 : 52;
    const h = params.isHoriz ? 58 : 145;
    sprite.setDisplaySize(w, h);
    sprite.setTint(tint);
    container.add(sprite);
  }

  const hpBar = scene.add.graphics();
  container.add(hpBar);

  let collider: Phaser.Physics.Arcade.Sprite | undefined;
  if (params.wallColliders) {
    const box = params.collisionBox;
    collider = scene.physics.add.staticSprite(box.x + box.w / 2, box.y + box.h / 2, '');
    collider.setVisible(false);
    params.wallColliders.add(collider);
    collider.setDisplaySize(box.w, box.h);
    collider.refreshBody();
    const body = collider.body as Phaser.Physics.Arcade.StaticBody | null;
    if (body) {
      body.setSize(box.w, box.h, true);
    }
    if (params.refreshCollider) {
      params.wallColliders.refresh();
    }
  }

  return {
    container,
    hpBar,
    collider,
    extraVisuals: extraVisuals.length > 0 ? extraVisuals : undefined,
  };
}

export function updateCampStructureHpBar(
  hpBar: Phaser.GameObjects.Graphics,
  kind: 'wall' | 'tower',
  hp: number,
  maxHp: number
): void {
  const ratio = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
  const w = kind === 'tower' ? 64 : 84;
  const y = kind === 'tower' ? -72 : -44;
  hpBar.clear();
  hpBar.fillStyle(0x0f172a, 0.9);
  hpBar.fillRect(-w / 2 - 1, y - 1, w + 2, 7);
  hpBar.fillStyle(0xf43f5e, 1);
  if (ratio > 0) {
    hpBar.fillRect(-w / 2, y, Math.max(2, w * ratio), 5);
  }
}
