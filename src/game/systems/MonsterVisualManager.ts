import { ELITE_AFFIXES } from '../../data/elites';
import { Monster } from '../../types/game';
import { ySortDepth } from '../depthLayers';

export interface MonsterVisual {
  monster: Monster;
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  hpBar: Phaser.GameObjects.Graphics;
  lastAttackTime: number;
  lastHealTime?: number;
}

/**
 * 마물(좀비, 스켈레톤, 고블린, 창병, 흑마법사, 보스) 스프라이트 비주얼 생성 및 경량 HP 바 매니저
 */
export class MonsterVisualManager {
  public static create(scene: Phaser.Scene, monster: Monster): MonsterVisual {
    const container = scene.add.container(monster.x, monster.y);
    container.setDepth(ySortDepth(monster.y, 28));

    const eliteDef = monster.isElite && monster.eliteAffix ? ELITE_AFFIXES[monster.eliteAffix] : null;

    // Graphics 드로우콜 폭증 방지를 위해 프리베이킹된 그림자/오라 텍스처(Image) 우선 사용
    if (monster.isBoss && scene.textures.exists('boss_aura_tex')) {
      const auraImg = scene.add.image(0, 10, 'boss_aura_tex');
      container.add(auraImg);
    } else if (monster.isElite && scene.textures.exists('boss_aura_tex')) {
      const eliteAura = scene.add.image(0, 14, 'boss_aura_tex');
      eliteAura.setScale(0.68);
      eliteAura.setAlpha(0.75);
      if (eliteDef) eliteAura.setTint(eliteDef.auraColorHex);
      container.add(eliteAura);
    } else if (!monster.isBoss && scene.textures.exists('unit_shadow_tex')) {
      const shadowImg = scene.add.image(0, 22, 'unit_shadow_tex');
      container.add(shadowImg);
    }

    let texKey = 'enemyBlackWarriorRun';
    let animKey = 'monster_zombie_run';
    let displaySize = monster.isBoss ? 190 : 120;

    if (monster.isBoss) {
      texKey = 'enemyPurpleWarriorRun';
      animKey = 'monster_boss_run';
    } else if (monster.type === 'skeleton' || monster.role === 'ranged') {
      texKey = 'enemyArcherRun';
      animKey = 'monster_skeleton_run';
    } else if (monster.type === 'lancer' || monster.role === 'lancer') {
      texKey = scene.textures.exists('enemyLancerRun')
        ? 'enemyLancerRun'
        : 'enemyBlackWarriorRun';
      animKey = scene.anims.exists('monster_lancer_run')
        ? 'monster_lancer_run'
        : 'monster_zombie_run';
      displaySize = 165;
    } else if (monster.type === 'archmage' || monster.role === 'mage') {
      texKey = scene.textures.exists('enemyMonkRun')
        ? 'enemyMonkRun'
        : 'enemyPurpleWarriorRun';
      animKey = scene.anims.exists('monster_archmage_run')
        ? 'monster_archmage_run'
        : 'monster_boss_run';
      displaySize = 126;
    }

    if (monster.isElite && !monster.isBoss) {
      displaySize = Math.round(displaySize * 1.22);
    }

    const sprite = scene.add.sprite(0, 0, texKey);
    sprite.setDisplaySize(displaySize, displaySize);

    if (monster.isElite && eliteDef) {
      sprite.setTint(eliteDef.auraColorHex);
    } else if (monster.type === 'zombie') {
      sprite.setTint(0x86efac);
    } else if (monster.type === 'skeleton' || monster.role === 'ranged') {
      sprite.setTint(0xe2e8f0);
    } else if (monster.type === 'lancer' || monster.role === 'lancer') {
      sprite.setTint(0xfbbf24);
    } else if (monster.type === 'archmage' || monster.role === 'mage') {
      sprite.setTint(0xd8b4fe);
    } else if (monster.isBoss) {
      sprite.setTint(0xfca5a5);
    }

    if (scene.anims.exists(animKey)) {
      sprite.play(animKey);
    }
    container.add(sprite);

    const hpBar = scene.add.graphics();
    container.add(hpBar);

    if (monster.isElite && eliteDef) {
      const badgeText = scene.add
        .text(0, -48, `★ ${eliteDef.badge}`, {
          fontFamily: 'Pretendard, sans-serif',
          fontSize: '11px',
          fontStyle: 'bold',
          color: '#fde047',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5);
      container.add(badgeText);
    }

    const visual: MonsterVisual = {
      monster,
      container,
      sprite,
      hpBar,
      lastAttackTime: 0,
      lastHealTime: 0,
    };

    this.updateHpBar(visual);
    return visual;
  }

  public static updateHpBar(mv: MonsterVisual) {
    const m = mv.monster;
    const ratio = Math.max(0, Math.min(1, m.hp / Math.max(1, m.maxHp)));

    // 100마리 대군/부락 환경에서 아직 피격되지 않은 일반 몬스터는 HP바 드로우콜 생략
    if (!m.isBoss && ratio >= 0.999) {
      mv.hpBar.clear();
      mv.hpBar.setVisible(false);
      return;
    }

    mv.hpBar.setVisible(true);
    const barW = m.isBoss ? 110 : 52;
    const barH = m.isBoss ? 8 : 5;
    const barX = -barW / 2;
    const barY = m.isBoss ? -54 : -32;

    mv.hpBar.clear();
    mv.hpBar.fillStyle(0x0f172a, 0.9);
    mv.hpBar.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    const barColor = m.isBoss
      ? 0xdc2626
      : m.role === 'mage'
      ? 0xa855f7
      : m.role === 'ranged'
      ? 0x38bdf8
      : 0xef4444;
    mv.hpBar.fillStyle(barColor, 1);
    mv.hpBar.fillRect(barX, barY, Math.max(2, barW * ratio), barH);
  }
}
