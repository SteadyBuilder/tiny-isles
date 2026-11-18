import type Phaser from 'phaser';
import { MONSTER_HIT_FEEDBACK_CONFIG } from '../../data/combatFeedbackConfig';
import { ELITE_AFFIXES } from '../../data/elites';
import { DEDICATED_MONSTER_SPRITES } from '../../data/monsterSprites';
import { Monster } from '../../types/game';
import { ySortDepth } from '../depthLayers';
import { resolveMonsterAnimKeys } from '../utils/monsterAnimationUtils';

export interface MonsterVisual {
  monster: Monster;
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  hpBar: Phaser.GameObjects.Graphics | null;
  baseTint: number | null;
  hpTrailRatio: number;
  hpFlashUntil: number;
  lastAttackTime: number;
  firstAttackReadyAt?: number;
  lastHealTime?: number;
  lastShieldTime?: number;
}

/**
 * 마물(좀비, 스켈레톤, 고블린, 창병, 흑마법사, 보스) 스프라이트 비주얼 생성 및 경량 HP 바 매니저
 */
export class MonsterVisualManager {
  private static activeTrailVisuals = new Set<MonsterVisual>();

  public static clearTrackedVisuals(): void {
    this.activeTrailVisuals.clear();
  }

  public static getTrackedTrailCount(): number {
    return this.activeTrailVisuals.size;
  }

  public static disposeVisual(mv: MonsterVisual): void {
    this.activeTrailVisuals.delete(mv);
    const containerObj = mv.container as {
      scene?: unknown;
      destroyed?: boolean;
      destroy: () => void;
    };
    if (!containerObj || containerObj.destroyed) return;
    if (!('scene' in containerObj) || containerObj.scene) {
      containerObj.destroy();
    }
  }

  private static ensureEliteBadgeTexture(
    scene: Phaser.Scene,
    affixId: string,
    badgeLabel: string
  ): string | null {
    const texKey = `elite_badge_${affixId}`;
    if (scene.textures.exists(texKey)) return texKey;
    if (typeof scene.textures.createCanvas !== 'function') return null;

    const canvasTex = scene.textures.createCanvas(texKey, 240, 48);
    if (!canvasTex) return null;
    const ctx = canvasTex.getContext();
    ctx.clearRect(0, 0, 240, 48);
    ctx.font = 'bold 22px Pretendard, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#fde047';
    const text = `★ ${badgeLabel}`;
    ctx.strokeText(text, 120, 24);
    ctx.fillText(text, 120, 24);
    canvasTex.refresh();
    return texKey;
  }

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
    const dedicatedSpec =
      !monster.isBoss && monster.type in DEDICATED_MONSTER_SPRITES
        ? DEDICATED_MONSTER_SPRITES[monster.type as keyof typeof DEDICATED_MONSTER_SPRITES]
        : null;

    if (monster.isBoss) {
      const candidateKey = monster.bossSpriteKey || 'enemyPurpleWarriorRun';
      texKey = scene.textures.exists(candidateKey) ? candidateKey : 'enemyPurpleWarriorRun';
      if (texKey === 'enemyLancerRun' && scene.anims.exists('monster_lancer_run')) {
        animKey = 'monster_lancer_run';
      } else if (texKey === 'enemyArchmageRun' && scene.anims.exists('monster_archmage_run')) {
        animKey = 'monster_archmage_run';
      } else if (texKey === 'enemyArcherRun' && scene.anims.exists('monster_skeleton_run')) {
        animKey = 'monster_skeleton_run';
      } else if (texKey === 'enemyBlackWarriorRun' && scene.anims.exists('monster_zombie_run')) {
        animKey = 'monster_zombie_run';
      } else {
        animKey = 'monster_boss_run';
      }
      displaySize = Math.round(190 * (monster.bossScale ?? 1));
    } else if (dedicatedSpec) {
      texKey = scene.textures.exists(dedicatedSpec.runTexKey)
        ? dedicatedSpec.runTexKey
        : monster.type === 'skeleton'
        ? 'enemyArcherRun'
        : 'enemyBlackWarriorRun';
      animKey = scene.anims.exists(dedicatedSpec.runAnimKey)
        ? dedicatedSpec.runAnimKey
        : 'monster_zombie_run';
      displaySize = dedicatedSpec.displaySize;
    } else if (monster.type === 'lancer' || monster.role === 'lancer') {
      texKey = scene.textures.exists('enemyLancerRun')
        ? 'enemyLancerRun'
        : 'enemyBlackWarriorRun';
      animKey = scene.anims.exists('monster_lancer_run')
        ? 'monster_lancer_run'
        : 'monster_zombie_run';
      displaySize = 165;
    } else if (monster.type === 'archmage' || monster.role === 'mage') {
      texKey = scene.textures.exists('enemyArchmageRun')
        ? 'enemyArchmageRun'
        : 'enemyPurpleWarriorRun';
      animKey = scene.anims.exists('monster_archmage_run')
        ? 'monster_archmage_run'
        : 'monster_boss_run';
      displaySize = 128;
    } else if (monster.role === 'ranged') {
      texKey = 'enemyArcherRun';
      animKey = 'monster_skeleton_run';
    }

    if (monster.isElite && !monster.isBoss) {
      displaySize = Math.round(displaySize * 1.22);
    }

    const sprite = scene.add.sprite(0, 0, texKey);
    sprite.setDisplaySize(displaySize, displaySize);

    let baseTint: number | null = null;
    if (monster.isBoss) {
      baseTint = monster.bossTintHex ?? 0xfca5a5;
    } else if (monster.isElite && eliteDef) {
      baseTint = eliteDef.auraColorHex;
    } else if (dedicatedSpec) {
      baseTint = dedicatedSpec.defaultTintHex;
    } else if (monster.type === 'lancer' || monster.role === 'lancer') {
      baseTint = 0xfbbf24;
    } else if (monster.type === 'archmage' || monster.role === 'mage') {
      baseTint = 0xd8b4fe;
    } else if (monster.role === 'ranged') {
      baseTint = 0xe2e8f0;
    }
    if (baseTint !== null) {
      sprite.setTint(baseTint);
    }

    if (scene.anims.exists(animKey)) {
      sprite.play(animKey);
    }
    container.add(sprite);

    if (monster.isElite && eliteDef) {
      const badgeTexKey = this.ensureEliteBadgeTexture(scene, eliteDef.id, eliteDef.badge);
      if (badgeTexKey) {
        const badgeImg = scene.add.image(0, -48, badgeTexKey);
        badgeImg.setScale(0.5);
        container.add(badgeImg);
      } else {
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
    }

    const initialRatio = Math.max(0, Math.min(1, monster.hp / Math.max(1, monster.maxHp)));
    const visual: MonsterVisual = {
      monster,
      container,
      sprite,
      hpBar: null,
      baseTint,
      hpTrailRatio: initialRatio,
      hpFlashUntil: 0,
      lastAttackTime: 0,
      lastHealTime: 0,
    };

    this.updateHpBar(visual, false);
    return visual;
  }

  /**
   * 몬스터가 공격/스킬 시전 시 목표 방향을 바라보며 무기 휘두르기/공격 애니메이션을 1회 재생한 뒤 이동 모션으로 복귀합니다.
   */
  public static playAttackAnimation(mv: MonsterVisual, targetX?: number): void {
    const sprite = mv.sprite;
    const anims = sprite?.scene?.anims;
    if (!sprite || !sprite.active || !anims) return;

    if (typeof targetX === 'number' && Number.isFinite(targetX) && targetX !== mv.monster.x) {
      const nextDir = targetX < mv.monster.x ? 'left' : 'right';
      mv.monster.direction = nextDir;
      sprite.setFlipX(nextDir === 'left');
    }

    const { runAnimKey, attackAnimKey } = resolveMonsterAnimKeys(mv.monster);
    const resolvedAttackKey = anims.exists(attackAnimKey)
      ? attackAnimKey
      : anims.exists('monster_zombie_attack')
      ? 'monster_zombie_attack'
      : null;
    if (!resolvedAttackKey) return;

    const spriteEvents = sprite as unknown as {
      off?: (event: string) => void;
      once?: (event: string, fn: () => void) => void;
    };
    spriteEvents.off?.('animationcomplete');
    sprite.play(resolvedAttackKey, false);
    spriteEvents.once?.('animationcomplete', () => {
      const currentAnims = sprite.scene?.anims;
      if (sprite.active && currentAnims?.exists(runAnimKey)) {
        sprite.play(runAnimKey, true);
      }
    });
  }

  public static updateHpBar(mv: MonsterVisual, isDamageEvent = true): void {
    const m = mv.monster;
    const ratio = Math.max(0, Math.min(1, m.hp / Math.max(1, m.maxHp)));

    if (ratio > mv.hpTrailRatio) {
      mv.hpTrailRatio = ratio;
    } else if (isDamageEvent && ratio < mv.hpTrailRatio) {
      mv.hpFlashUntil = performance.now() + MONSTER_HIT_FEEDBACK_CONFIG.hpBarFlashDurationMs;
    }

    const now = performance.now();
    const isFlashing = now < mv.hpFlashUntil;
    const hasTrail = mv.hpTrailRatio > ratio + 0.002;
    const hasActiveShield = Boolean(
      m.isElite && (m.shieldUntil ?? 0) > now && (m.shieldHp ?? 0) > 0
    );

    if (isFlashing || hasTrail || hasActiveShield) {
      this.activeTrailVisuals.add(mv);
    }

    // 100마리 대군/부락 환경에서 아직 피격되지 않은 일반 몬스터는 HP바 Graphics 생성·드로우콜 생략 (보스/엘리트는 항상 표시)
    if (!m.isBoss && !m.isElite && !hasActiveShield && ratio >= 0.999 && !hasTrail && !isFlashing) {
      if (mv.hpBar) {
        mv.hpBar.clear();
        mv.hpBar.setVisible(false);
      }
      return;
    }

    if (!mv.hpBar) {
      const containerScene = (mv.container as { scene?: Phaser.Scene }).scene;
      if (!containerScene?.add) return;
      mv.hpBar = containerScene.add.graphics();
      mv.container.add(mv.hpBar);
    }

    mv.hpBar.setVisible(true);
    const barW = m.isBoss ? 110 : 52;
    const barH = m.isBoss ? 8 : 5;
    const barX = -barW / 2;

    let popOffset = 0;
    if (isFlashing) {
      const flashRatio =
        (mv.hpFlashUntil - now) / MONSTER_HIT_FEEDBACK_CONFIG.hpBarFlashDurationMs;
      popOffset = Math.sin(flashRatio * Math.PI) * MONSTER_HIT_FEEDBACK_CONFIG.hpBarPopOffsetY;
    }
    const barY = (m.isBoss ? -54 : -32) - popOffset;

    mv.hpBar.clear();
    mv.hpBar.fillStyle(0x0f172a, 0.92);
    mv.hpBar.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

    if (hasActiveShield) {
      mv.hpBar.lineStyle(1.5, 0xe0f2fe, 0.98);
      mv.hpBar.strokeRect(barX - 1.5, barY - 1.5, barW + 3, barH + 3);
    } else if (isFlashing) {
      mv.hpBar.lineStyle(1.5, 0xfef08a, 0.95);
      mv.hpBar.strokeRect(barX - 1.5, barY - 1.5, barW + 3, barH + 3);
    }

    // 지연 감소 트레일 바 (황금빛 잔상)
    if (hasTrail) {
      mv.hpBar.fillStyle(0xfef08a, 0.95);
      mv.hpBar.fillRect(barX, barY, Math.max(2, barW * mv.hpTrailRatio), barH);
    }

    const barColor = hasActiveShield
      ? 0xffffff
      : m.isBoss
      ? 0xdc2626
      : m.role === 'mage'
      ? 0xa855f7
      : m.role === 'ranged'
      ? 0x38bdf8
      : 0xef4444;
    mv.hpBar.fillStyle(barColor, 1);
    if (ratio > 0) {
      mv.hpBar.fillRect(barX, barY, Math.max(2, barW * ratio), barH);
    }
  }

  public static updateHpTrails(_monsters: Map<string, MonsterVisual>, deltaMs: number): void {
    if (this.activeTrailVisuals.size === 0) return;
    const now = performance.now();
    const drainStep = (MONSTER_HIT_FEEDBACK_CONFIG.hpTrailDrainPerSec * deltaMs) / 1000;

    for (const mv of Array.from(this.activeTrailVisuals)) {
      const m = mv.monster;
      const containerObj = mv.container as { scene?: unknown; destroyed?: boolean };
      if (
        m.hp <= 0 ||
        !containerObj ||
        containerObj.destroyed ||
        ('scene' in containerObj && !containerObj.scene)
      ) {
        this.activeTrailVisuals.delete(mv);
        continue;
      }

      const ratio = Math.max(0, Math.min(1, m.hp / Math.max(1, m.maxHp)));
      const wasFlashing = mv.hpFlashUntil > 0 && now >= mv.hpFlashUntil;
      const shieldExpired = Boolean(m.shieldUntil && m.shieldUntil > 0 && now >= m.shieldUntil);
      const needsTrailUpdate = mv.hpTrailRatio > ratio + 0.002;
      const isFlashing = now < mv.hpFlashUntil;
      const hasActiveShield = Boolean(
        m.isElite && (m.shieldUntil ?? 0) > now && (m.shieldHp ?? 0) > 0
      );

      if (needsTrailUpdate) {
        mv.hpTrailRatio = Math.max(ratio, mv.hpTrailRatio - drainStep);
      }
      if (wasFlashing) {
        mv.hpFlashUntil = 0;
      }
      if (shieldExpired) {
        m.shieldUntil = 0;
        m.shieldHp = 0;
        m.shieldMaxHp = 0;
      }
      if (needsTrailUpdate || wasFlashing || shieldExpired) {
        this.updateHpBar(mv, false);
      }

      const stillNeedsTrail = mv.hpTrailRatio > ratio + 0.002;
      if (!stillNeedsTrail && !isFlashing && !hasActiveShield) {
        this.activeTrailVisuals.delete(mv);
      }
    }
  }
}
