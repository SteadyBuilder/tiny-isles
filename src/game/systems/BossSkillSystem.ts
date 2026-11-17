import Phaser from 'phaser';
import { BossSkillId, Monster } from '../../types/game';
import { sound } from '../../lib/sound';
import { DEPTH } from '../depthLayers';
import { MonsterVisual, MonsterVisualManager } from './MonsterVisualManager';
import { ProjectileSystem } from './ProjectileSystem';

export interface IBossSkillContext {
  scene: Phaser.Scene;
  getMonsters: () => Map<string, MonsterVisual>;
  getLocalPlayerPosition: () => { x: number; y: number };
  isLocalPlayerFainted: () => boolean;
  damageLocalPlayer: (damage: number, attackerName: string) => void;
  projectileSystem?: ProjectileSystem;
  playExplosionAt: (x: number, y: number) => void;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
}

const BOSS_SKILL_COOLDOWN_MS = 6200;
const BOSS_SKILL_TRIGGER_RANGE_PX = 500;

/**
 * 대군주 토벌전 보스 몬스터 전용 다중 스킬 시스템
 * (충격파, 서리 폭발, 공허 탄막, 하수인 소환, 메테오 낙하, 번개 심판)
 */
export class BossSkillSystem {
  private ctx: IBossSkillContext;
  private lastSkillTimeMap = new Map<string, number>();

  constructor(ctx: IBossSkillContext) {
    this.ctx = ctx;
  }

  public tryCastSkill(mv: MonsterVisual, time: number): void {
    const m = mv.monster;
    if (!m.isBoss || m.hp <= 0 || this.ctx.isLocalPlayerFainted()) return;

    const lastCast = this.lastSkillTimeMap.get(m.id) ?? 0;
    if (time - lastCast < BOSS_SKILL_COOLDOWN_MS) return;

    const { x: px, y: py } = this.ctx.getLocalPlayerPosition();
    const dist = Math.hypot(px - m.x, py - m.y);
    if (dist > BOSS_SKILL_TRIGGER_RANGE_PX) return;

    this.lastSkillTimeMap.set(m.id, time);
    const skillId: BossSkillId = m.bossSkillId ?? 'shockwave';
    this.executeSkill(mv, skillId, px, py);
  }

  private executeSkill(
    mv: MonsterVisual,
    skillId: BossSkillId,
    targetX: number,
    targetY: number
  ): void {
    const m = mv.monster;
    const ps = this.ctx.projectileSystem;

    switch (skillId) {
      case 'shockwave': {
        this.ctx.showFloatingText(m.x, m.y - 70, '💥 암흑 충격파!', '#f87171');
        if (ps) {
          ps.spawnTelegraphZone({
            x: m.x,
            y: m.y,
            radius: 175,
            durationMs: 750,
            color: 0xef4444,
            onDetonate: () => {
              this.spawnFxBurst(m.x, m.y, 'shockwaveRingFx', 280, 0xf87171);
              this.damagePlayerInRadius(m.x, m.y, 175, Math.round(m.attack * 1.45), m.name);
            },
          });
        }
        break;
      }
      case 'frost_nova': {
        this.ctx.showFloatingText(m.x, m.y - 70, '❄️ 혹한의 서리 폭발!', '#38bdf8');
        if (ps) {
          ps.spawnTelegraphZone({
            x: targetX,
            y: targetY,
            radius: 135,
            durationMs: 800,
            color: 0x38bdf8,
            onDetonate: () => {
              this.spawnFxBurst(targetX, targetY, 'frostNovaFx', 230, 0x38bdf8);
              this.damagePlayerInRadius(targetX, targetY, 135, Math.round(m.attack * 1.4), m.name);
            },
          });
        }
        break;
      }
      case 'void_barrage': {
        this.ctx.showFloatingText(m.x, m.y - 70, '🔱 공허 창기 탄막!', '#fbbf24');
        if (ps) {
          const baseAngle = Math.atan2(targetY - m.y, targetX - m.x);
          for (let i = -2; i <= 2; i++) {
            const angle = baseAngle + i * 0.22;
            const destX = m.x + Math.cos(angle) * 440;
            const destY = m.y + Math.sin(angle) * 440;
            ps.fireProjectile({
              startX: m.x,
              startY: m.y - 16,
              targetX: destX,
              targetY: destY,
              durationMs: 520,
              tint: 0xfbbf24,
              size: 40,
              isMagic: true,
              onArrive: () => {
                this.damagePlayerInRadius(destX, destY, 64, Math.round(m.attack * 0.9), m.name);
              },
            });
          }
          sound.playMagicCast();
        }
        break;
      }
      case 'summon_minions': {
        this.ctx.showFloatingText(m.x, m.y - 70, '📯 정예 호위병 소환!', '#f87171');
        this.spawnBossMinions(m);
        break;
      }
      case 'meteor_rain': {
        this.ctx.showFloatingText(m.x, m.y - 70, '☄️ 공허 운석 낙하!', '#c084fc');
        if (ps) {
          for (let i = 0; i < 3; i++) {
            const ox = targetX + (Math.random() - 0.5) * 180;
            const oy = targetY + (Math.random() - 0.5) * 180;
            ps.spawnTelegraphZone({
              x: ox,
              y: oy,
              radius: 105,
              durationMs: 850 + i * 220,
              color: 0xa855f7,
              onDetonate: () => {
                this.spawnFxBurst(ox, oy, 'meteorRockFx', 190, 0xc084fc);
                this.damagePlayerInRadius(ox, oy, 105, Math.round(m.attack * 1.35), m.name);
              },
            });
          }
        }
        break;
      }
      case 'lightning_judgment': {
        this.ctx.showFloatingText(m.x, m.y - 70, '⚡ 종말의 번개 심판!', '#fde047');
        if (ps) {
          const offsets = [
            { x: targetX, y: targetY },
            { x: targetX + 115, y: targetY - 60 },
            { x: targetX - 115, y: targetY + 60 },
          ];
          offsets.forEach((pt, idx) => {
            ps.spawnTelegraphZone({
              x: pt.x,
              y: pt.y,
              radius: 95,
              durationMs: 700 + idx * 180,
              color: 0xfde047,
              onDetonate: () => {
                this.spawnFxBurst(pt.x, pt.y, 'lightningStrikeFx', 180, 0xfde047);
                this.damagePlayerInRadius(pt.x, pt.y, 95, Math.round(m.attack * 1.45), m.name);
              },
            });
          });
        }
        break;
      }
    }
  }

  private damagePlayerInRadius(
    cx: number,
    cy: number,
    radius: number,
    damage: number,
    attackerName: string
  ): void {
    if (this.ctx.isLocalPlayerFainted()) return;
    const { x: px, y: py } = this.ctx.getLocalPlayerPosition();
    if (Math.hypot(px - cx, py - cy) <= radius) {
      this.ctx.damageLocalPlayer(damage, attackerName);
    }
  }

  private spawnFxBurst(
    x: number,
    y: number,
    texKey: string,
    size: number,
    tint: number
  ): void {
    const { scene } = this.ctx;
    if (!scene.textures.exists(texKey)) {
      this.ctx.playExplosionAt(x, y);
      return;
    }
    const img = scene.add.image(x, y, texKey, 0);
    img.setDepth(DEPTH.PROJECTILE + 2);
    img.setDisplaySize(size * 0.6, size * 0.6);
    img.setTint(tint);
    scene.tweens.add({
      targets: img,
      displayWidth: size,
      displayHeight: size,
      alpha: 0,
      duration: 380,
      ease: 'Cubic.easeOut',
      onComplete: () => img.destroy(),
    });
  }

  private spawnBossMinions(boss: Monster): void {
    const monsters = this.ctx.getMonsters();
    if (monsters.size > 160) return;

    for (let i = 0; i < 2; i++) {
      const angle = Math.random() * Math.PI * 2;
      const sx = boss.x + Math.cos(angle) * 75;
      const sy = boss.y + Math.sin(angle) * 75;
      const minion: Monster = {
        id: `bmin_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 5)}`,
        type: i === 0 ? 'goblin' : 'skeleton',
        name: '보스 호위 마물',
        isBoss: false,
        x: sx,
        y: sy,
        hp: Math.round(boss.maxHp * 0.12),
        maxHp: Math.round(boss.maxHp * 0.12),
        attack: Math.round(boss.attack * 0.45),
        speed: 68,
        targetTerritoryId: boss.targetTerritoryId,
        spawnTerritoryId: boss.spawnTerritoryId,
        direction: boss.direction,
      };
      monsters.set(minion.id, MonsterVisualManager.create(this.ctx.scene, minion));
    }
  }
}
