import Phaser from 'phaser';
import { BossSkillId, MonsterCombatRole, MonsterSkillId } from '../../../types/game';
import { DEPTH } from '../../depthLayers';
import { PhaserFxPool, isPointInSceneViewport } from '../utils/fxObjectPool';

/**
 * 몬스터 직업별(흑기사 근거리, 창기병 중거리, 암흑궁수 원거리, 흑마법병 마법, 보스)
 * 기본 공격 및 액티브 스킬 전용 화려한 다층 픽셀아트 이펙트 렌더러 (오브젝트 풀 기반)
 */
export class MonsterAttackFxRenderer {
  private scene: Phaser.Scene;
  private fxPool: PhaserFxPool;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.fxPool = new PhaserFxPool(
      scene,
      () => Boolean(scene.sys && scene.scene?.isActive())
    );
  }

  public destroy(): void {
    this.fxPool.destroy();
  }

  /**
   * 몬스터 직업별 기본 공격(근거리 참격, 중거리 창격, 원거리 화살/마법 발사) 시각 이펙트
   */
  public playBasicAttackFx(params: {
    role: MonsterCombatRole;
    isBoss?: boolean;
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
  }): void {
    const { role, isBoss, startX, startY, targetX, targetY } = params;
    const angle = Math.atan2(targetY - startY, targetX - startX);
    const scaleMult = isBoss ? 1.38 : 1.0;

    if (role === 'melee') {
      const midX = startX + Math.cos(angle) * (isBoss ? 40 : 26);
      const midY = startY + Math.sin(angle) * (isBoss ? 40 : 26);
      this.playAnim('slashArcFx', 'slash_arc_anim', midX, midY - 10, 145 * scaleMult, 0xef4444, angle);
      this.playAnim('voidSlashFx', 'void_slash_anim', targetX, targetY - 12, 118 * scaleMult, 0xa855f7, angle + 0.35);
      this.playAnim('hitSparkFx', 'hit_spark_anim', targetX, targetY - 10, 88 * scaleMult, 0xfca5a5);
      if (isBoss) {
        this.playAnim('shockwaveRingFx', 'shockwave_ring_anim', targetX, targetY, 130, 0xef4444);
      }
      return;
    }

    if (role === 'lancer') {
      const midX = (startX + targetX) * 0.5;
      const midY = (startY + targetY) * 0.5;
      this.playAnim(
        'lanceBeamFx',
        'lance_beam_anim',
        midX,
        midY - 12,
        210 * scaleMult,
        0xf59e0b,
        angle,
        104 * scaleMult
      );
      this.playAnim('critStarBurstFx', 'crit_star_burst_anim', targetX, targetY - 10, 108 * scaleMult, 0xfde047);
      this.playAnim('hitSparkFx', 'hit_spark_anim', targetX, targetY - 10, 92 * scaleMult, 0x38bdf8);
      return;
    }

    if (role === 'ranged') {
      this.playAnim('dustFx2', 'dust2_anim', startX, startY + 10, 74 * scaleMult, 0xf87171);
      if (isBoss) {
        this.playAnim('shockwaveRingFx', 'shockwave_ring_anim', startX, startY - 10, 115, 0xf87171);
      }
      return;
    }

    if (role === 'mage') {
      this.spawnRotatingMagicCircle(startX, startY + 6, 105 * scaleMult, 0xc084fc, 380);
    }
  }

  /**
   * 몬스터 직업별 고유 액티브 스킬 및 보스 스킬 시전·착탄 다층 이펙트
   */
  public playSkillCastFx(params: {
    skillId: MonsterSkillId | BossSkillId;
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    isBoss?: boolean;
  }): void {
    const { skillId, startX, startY, targetX, targetY, isBoss } = params;
    const angle = Math.atan2(targetY - startY, targetX - startX);
    const scaleMult = isBoss ? 1.35 : 1.0;

    switch (skillId) {
      case 'dark_cleave': {
        this.spawnRotatingMagicCircle(startX, startY, 155 * scaleMult, 0xef4444, 520);
        this.playAnim(
          'whirlwindSlashFx',
          'whirlwind_slash_anim',
          startX,
          startY - 10,
          195 * scaleMult,
          0xef4444
        );
        this.playAnim(
          'voidSlashFx',
          'void_slash_anim',
          startX,
          startY - 10,
          175 * scaleMult,
          0xa855f7,
          angle
        );
        break;
      }
      case 'piercing_thrust': {
        const beamX = startX + Math.cos(angle) * 78;
        const beamY = startY + Math.sin(angle) * 78;
        this.playAnim('dustFx2', 'dust2_anim', startX, startY + 12, 92 * scaleMult, 0xfbbf24);
        this.playAnim(
          'lanceBeamFx',
          'lance_beam_anim',
          beamX,
          beamY - 12,
          285 * scaleMult,
          0xf59e0b,
          angle,
          132 * scaleMult
        );
        this.playAnim('shockwaveRingFx', 'shockwave_ring_anim', startX, startY, 130 * scaleMult, 0xfde047);
        break;
      }
      case 'volley_shot': {
        this.spawnRotatingMagicCircle(startX, startY, 130 * scaleMult, 0xfb923c, 420);
        this.playAnim('critStarBurstFx', 'crit_star_burst_anim', startX, startY - 14, 130 * scaleMult, 0xfef08a);
        this.dropSkyArrow(targetX, targetY, 0xf87171, 0xfb923c);
        break;
      }
      case 'abyss_orb': {
        this.spawnRotatingMagicCircle(startX, startY, 150 * scaleMult, 0xd946ef, 580);
        this.spawnRotatingMagicCircle(targetX, targetY, 185 * scaleMult, 0xa855f7, 780);
        break;
      }
      default:
        break;
    }
  }

  /**
   * 스킬 장판 폭발(Detonation) 순간의 다층 시각 이펙트
   */
  public playSkillDetonateFx(params: {
    skillId?: MonsterSkillId | BossSkillId;
    x: number;
    y: number;
    radius: number;
  }): void {
    const { skillId, x, y, radius } = params;

    if (skillId === 'dark_cleave') {
      this.playAnim('whirlwindSlashFx', 'whirlwind_slash_anim', x, y - 10, radius * 2.2, 0xa855f7, 0.8);
      this.playAnim('voidSlashFx', 'void_slash_anim', x, y - 10, radius * 1.9, 0xef4444);
      this.playAnim('shockwaveRingFx', 'shockwave_ring_anim', x, y, radius * 2.1, 0xf87171);
      this.playAnim('explosionFx2', 'explosion2_anim', x, y - 10, radius * 1.65, 0xef4444);
      return;
    }

    if (skillId === 'piercing_thrust') {
      this.playAnim('lightningStrikeFx', 'lightning_strike_anim', x, y - 78, 128, 0xfde047, 0, 230);
      this.playAnim('shockwaveRingFx', 'shockwave_ring_anim', x, y, radius * 2.1, 0xf59e0b);
      this.playAnim('critStarBurstFx', 'crit_star_burst_anim', x, y - 10, radius * 1.85, 0xfef08a);
      this.playAnim('explosionFx2', 'explosion2_anim', x, y - 8, radius * 1.6, 0xfbbf24);
      return;
    }

    if (skillId === 'abyss_orb') {
      this.playAnim('lightningStrikeFx', 'lightning_strike_anim', x, y - 84, 140, 0xd946ef, 0, 250);
      this.playAnim('frostNovaFx', 'frost_nova_anim', x, y, radius * 2.0, 0xc084fc);
      this.playAnim('voidSlashFx', 'void_slash_anim', x, y - 10, radius * 1.75, 0x38bdf8);
      this.playAnim('shockwaveRingFx', 'shockwave_ring_anim', x, y, radius * 2.15, 0xe879f9);
      this.playAnim('explosionFx2', 'explosion2_anim', x, y - 12, radius * 1.75, 0xd946ef);
      return;
    }

    // 기본 마법/보스 장판 폭발
    this.playAnim('shockwaveRingFx', 'shockwave_ring_anim', x, y, radius * 2.0, 0xc084fc);
    this.playAnim('explosionFx2', 'explosion2_anim', x, y - 10, radius * 1.6, 0xa855f7);
  }

  public spawnRotatingMagicCircle(
    x: number,
    y: number,
    sizePx: number,
    tint: number,
    lifeMs: number
  ): void {
    if (!isPointInSceneViewport(this.scene, x, y)) return;
    const circle = this.fxPool.acquireSprite('magicCircleFx', x, y, DEPTH.SLASH - 4);
    if (!circle) return;
    circle.setDisplaySize(sizePx * 0.45, sizePx * 0.45);
    circle.setTint(tint);
    circle.setAlpha(0.88);
    if (this.scene.anims.exists('magic_circle_anim')) {
      circle.play('magic_circle_anim');
    }
    this.scene.tweens.add({
      targets: circle,
      displayWidth: sizePx,
      displayHeight: sizePx,
      angle: 135,
      alpha: 0,
      duration: lifeMs,
      ease: 'Cubic.easeOut',
      onComplete: () => this.fxPool.releaseSprite(circle),
    });
  }

  private dropSkyArrow(tx: number, ty: number, colorA: number, colorB: number): void {
    if (!isPointInSceneViewport(this.scene, tx, ty)) return;
    const arrow = this.fxPool.acquireSprite('arrowStormFx', tx - 70, ty - 190, DEPTH.EXPLOSION + 2);
    if (!arrow) return;
    arrow.setDisplaySize(84, 84);
    arrow.setTint(colorA);
    if (this.scene.anims.exists('arrow_storm_anim')) {
      arrow.play('arrow_storm_anim');
    }
    this.scene.tweens.add({
      targets: arrow,
      x: tx,
      y: ty - 8,
      duration: 165,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.fxPool.releaseSprite(arrow);
        this.playAnim('hitSparkFx', 'hit_spark_anim', tx, ty - 6, 86, colorA);
        this.playAnim('shockwaveRingFx', 'shockwave_ring_anim', tx, ty, 96, colorB);
      },
    });
  }

  public playAnim(
    texKey: string,
    animKey: string,
    x: number,
    y: number,
    width: number,
    tint = 0xffffff,
    rotationRad = 0,
    height = width
  ): void {
    this.fxPool.playSpriteAnim({
      texKey,
      animKey,
      x,
      y,
      width,
      height,
      depth: DEPTH.EXPLOSION + 2,
      tint,
      rotationRad,
    });
  }
}
