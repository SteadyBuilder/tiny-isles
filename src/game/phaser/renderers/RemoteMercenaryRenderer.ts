import Phaser from 'phaser';
import { getMercenaryConfig } from '../../../data/mercenaries';
import { MercenaryUnit } from '../../../types/game';
import { setDepthIfChanged, ySortDepth } from '../../depthLayers';

interface RemoteMercVisual {
  ownerId: string;
  unit: MercenaryUnit;
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  hpBar: Phaser.GameObjects.Graphics;
  targetX: number;
  targetY: number;
}

/**
 * 팀원이 고용한 원격 용병을 화면에 동기화 렌더링하는 전담 렌더러
 * - 전투 판정(데미지 계산)은 소유자 클라이언트에서만 실행하고, 타 클라이언트에서는 시각화만 담당
 */
export class RemoteMercenaryRenderer {
  private scene: Phaser.Scene;
  private visuals = new Map<string, RemoteMercVisual>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public applyOwnerSync(ownerId: string, ownerName: string, units: MercenaryUnit[]): void {
    if (!this.scene.sys || !this.scene.scene?.isActive()) return;

    const incomingIds = new Set<string>();
    for (const unit of units) {
      if (unit.hp <= 0) continue;
      const key = `${ownerId}:${unit.id}`;
      incomingIds.add(key);

      const existing = this.visuals.get(key);
      if (existing) {
        existing.unit = { ...unit };
        existing.targetX = unit.x;
        existing.targetY = unit.y;
        existing.sprite.setFlipX(unit.direction === 'left');
        this.drawHpBar(existing);
        continue;
      }

      const cfg = getMercenaryConfig(unit.mercenaryId);
      const sprite = this.scene.add.sprite(unit.x, unit.y, `${cfg.spritePrefix}Idle`);
      sprite.setDisplaySize(cfg.displaySize, cfg.displaySize);
      sprite.setFlipX(unit.direction === 'left');
      sprite.setTint(0xe0f2fe);
      setDepthIfChanged(sprite, ySortDepth(unit.y, 22));
      if (this.scene.anims.exists(`${cfg.spritePrefix}_idle`)) {
        sprite.play(`${cfg.spritePrefix}_idle`);
      }

      const label = this.scene.add
        .text(unit.x, unit.y - 34, `${ownerName}의 ${unit.name}`, {
          fontFamily: 'Pretendard, sans-serif',
          fontSize: '10px',
          fontStyle: 'bold',
          color: '#7dd3fc',
          stroke: '#0f172a',
          strokeThickness: 2.5,
        })
        .setOrigin(0.5);
      setDepthIfChanged(label, ySortDepth(unit.y, 26));

      const hpBar = this.scene.add.graphics();
      setDepthIfChanged(hpBar, ySortDepth(unit.y, 25));

      const visual: RemoteMercVisual = {
        ownerId,
        unit: { ...unit },
        sprite,
        label,
        hpBar,
        targetX: unit.x,
        targetY: unit.y,
      };
      this.drawHpBar(visual);
      this.visuals.set(key, visual);
    }

    // 사라지거나 전사한 해당 소유자의 용병 정리
    for (const [key, visual] of Array.from(this.visuals.entries())) {
      if (visual.ownerId === ownerId && !incomingIds.has(key)) {
        this.destroyVisual(key, visual);
      }
    }
  }

  public removeOwner(ownerId: string): void {
    for (const [key, visual] of Array.from(this.visuals.entries())) {
      if (visual.ownerId === ownerId) {
        this.destroyVisual(key, visual);
      }
    }
  }

  public update(deltaMs: number): void {
    if (this.visuals.size === 0) return;
    const dtSec = Math.min(0.1, Math.max(0.001, deltaMs / 1000));
    const lerp = 1 - Math.exp(-10 * dtSec);

    for (const visual of this.visuals.values()) {
      const dx = visual.targetX - visual.sprite.x;
      const dy = visual.targetY - visual.sprite.y;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;

      const nx = visual.sprite.x + dx * lerp;
      const ny = visual.sprite.y + dy * lerp;
      visual.sprite.setPosition(nx, ny);
      visual.label.setPosition(nx, ny - 34);
      setDepthIfChanged(visual.sprite, ySortDepth(ny, 22));
      setDepthIfChanged(visual.label, ySortDepth(ny, 26));
      setDepthIfChanged(visual.hpBar, ySortDepth(ny, 25));
      this.drawHpBar(visual);
    }
  }

  public getRemoteOwnersSnapshot(): Array<{ ownerId: string; ownerName: string; units: MercenaryUnit[] }> {
    const byOwner = new Map<string, { ownerId: string; ownerName: string; units: MercenaryUnit[] }>();
    for (const visual of this.visuals.values()) {
      let group = byOwner.get(visual.ownerId);
      if (!group) {
        group = {
          ownerId: visual.ownerId,
          ownerName: visual.label.text.split('의 ')[0] || '팀원',
          units: [],
        };
        byOwner.set(visual.ownerId, group);
      }
      group.units.push({ ...visual.unit });
    }
    return Array.from(byOwner.values());
  }

  public clear(): void {
    for (const [key, visual] of Array.from(this.visuals.entries())) {
      this.destroyVisual(key, visual);
    }
  }

  private drawHpBar(visual: RemoteMercVisual): void {
    const { hpBar, sprite, unit } = visual;
    const w = 34;
    const h = 4;
    const x = sprite.x - w / 2;
    const y = sprite.y - 25;
    const ratio = Math.max(0, Math.min(1, unit.hp / Math.max(1, unit.maxHp)));

    hpBar.clear();
    hpBar.fillStyle(0x0f172a, 0.85);
    hpBar.fillRect(x - 1, y - 1, w + 2, h + 2);
    hpBar.fillStyle(ratio > 0.4 ? 0x38bdf8 : 0xf59e0b, 1);
    if (ratio > 0) {
      hpBar.fillRect(x, y, Math.max(2, w * ratio), h);
    }
  }

  private destroyVisual(key: string, visual: RemoteMercVisual): void {
    if (visual.sprite.scene) visual.sprite.destroy();
    if (visual.label.scene) visual.label.destroy();
    if (visual.hpBar.scene) visual.hpBar.destroy();
    this.visuals.delete(key);
  }
}
