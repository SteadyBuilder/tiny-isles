import { Monster } from '../../types/game';

export interface MonsterVisual {
  monster: Monster;
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  hpBar: Phaser.GameObjects.Graphics;
  nameTag: Phaser.GameObjects.Text;
  lastAttackTime: number;
}

/**
 * 마물(좀비, 스켈레톤, 보스) 스프라이트 비주얼 생성, HP 게이지 바 렌더링 전담 매니저
 */
export class MonsterVisualManager {
  public static create(scene: Phaser.Scene, monster: Monster): MonsterVisual {
    const container = scene.add.container(monster.x, monster.y);
    container.setDepth(monster.y + 28);

    const aura = scene.add.graphics();
    if (monster.isBoss) {
      aura.fillStyle(0xdc2626, 0.3);
      aura.fillCircle(0, 10, 56);
      aura.lineStyle(3, 0xf87171, 0.8);
      aura.strokeCircle(0, 10, 56);
    } else {
      aura.fillStyle(0x000000, 0.28);
      aura.fillEllipse(0, 22, 46, 20);
    }
    container.add(aura);

    let texKey = 'enemyBlackWarriorRun';
    let animKey = 'monster_zombie_run';
    if (monster.isBoss) {
      texKey = 'enemyPurpleWarriorRun';
      animKey = 'monster_boss_run';
    } else if (monster.type === 'skeleton') {
      texKey = 'enemyArcherRun';
      animKey = 'monster_skeleton_run';
    }

    const sprite = scene.add.sprite(0, 0, texKey);
    const displaySize = monster.isBoss ? 190 : 120;
    sprite.setDisplaySize(displaySize, displaySize);

    if (monster.type === 'zombie') {
      sprite.setTint(0x86efac);
    } else if (monster.type === 'skeleton') {
      sprite.setTint(0xe2e8f0);
    } else if (monster.isBoss) {
      sprite.setTint(0xfca5a5);
    }

    if (scene.anims.exists(animKey)) {
      sprite.play(animKey);
    }
    container.add(sprite);

    const hpBar = scene.add.graphics();
    container.add(hpBar);

    const nameTag = scene.add.text(
      0,
      monster.isBoss ? -68 : -44,
      monster.name,
      {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: monster.isBoss ? '13px' : '11px',
        fontStyle: 'bold',
        color: monster.isBoss ? '#fca5a5' : '#fde047',
        stroke: '#000000',
        strokeThickness: 3,
      }
    ).setOrigin(0.5);
    container.add(nameTag);

    const visual: MonsterVisual = {
      monster,
      container,
      sprite,
      hpBar,
      nameTag,
      lastAttackTime: 0,
    };

    this.updateHpBar(visual);
    return visual;
  }

  public static updateHpBar(mv: MonsterVisual) {
    const m = mv.monster;
    const ratio = Math.max(0, Math.min(1, m.hp / Math.max(1, m.maxHp)));
    const barW = m.isBoss ? 110 : 56;
    const barH = m.isBoss ? 8 : 6;
    const barX = -barW / 2;
    const barY = m.isBoss ? -54 : -32;

    mv.hpBar.clear();
    mv.hpBar.fillStyle(0x0f172a, 0.9);
    mv.hpBar.fillRect(barX, barY, barW, barH);
    mv.hpBar.fillStyle(m.isBoss ? 0xdc2626 : 0xef4444, 1);
    mv.hpBar.fillRect(barX, barY, Math.max(2, barW * ratio), barH);
  }
}
