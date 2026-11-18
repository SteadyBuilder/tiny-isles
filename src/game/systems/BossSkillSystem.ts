import Phaser from 'phaser';
import { BossSkillId, Monster } from '../../types/game';
import { ActivePlayerTarget, MonsterPlayerAttackPayload } from '../../types/monsterSync';
import { sound } from '../../lib/sound';
import { DEPTH } from '../depthLayers';
import { findTargetPlayerForMonster } from '../utils/monsterSyncUtils';
import { MonsterVisual, MonsterVisualManager } from './MonsterVisualManager';
import { ProjectileSystem } from './ProjectileSystem';

export interface IBossSkillContext {
  scene: Phaser.Scene;
  getMonsters: () => Map<string, MonsterVisual>;
  getLocalPlayerId?: () => string;
  getLocalPlayerPosition: () => { x: number; y: number };
  isLocalPlayerFainted: () => boolean;
  getActivePlayers?: () => ActivePlayerTarget[];
  damageLocalPlayer: (damage: number, attackerName: string) => void;
  broadcastMonsterPlayerAttack?: (payload: MonsterPlayerAttackPayload) => void;
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

  private resolveActivePlayers(): ActivePlayerTarget[] {
    if (this.ctx.getActivePlayers) {
      return this.ctx.getActivePlayers();
    }
    const pos = this.ctx.getLocalPlayerPosition();
    return [
      {
        id: this.ctx.getLocalPlayerId?.() ?? 'local',
        x: pos.x,
        y: pos.y,
        isFainted: this.ctx.isLocalPlayerFainted(),
      },
    ];
  }

  public tryCastSkill(mv: MonsterVisual, time: number): void {
    const m = mv.monster;
    if (!m.isBoss || m.hp <= 0) return;

    const lastCast = this.lastSkillTimeMap.get(m.id) ?? 0;
    if (time - lastCast < BOSS_SKILL_COOLDOWN_MS) return;

    const players = this.resolveActivePlayers();
    const targetMatch = findTargetPlayerForMonster(m.x, m.y, players, BOSS_SKILL_TRIGGER_RANGE_PX);
    if (!targetMatch) return;

    this.lastSkillTimeMap.set(m.id, time);
    const skillId: BossSkillId = m.bossSkillId ?? 'shockwave';
    this.executeSkill(mv, skillId, targetMatch.player.x, targetMatch.player.y, players.length > 1);
  }

  private emitRemoteBossAttack(payload: MonsterPlayerAttackPayload, isCoop: boolean): void {
    if (!isCoop) return;
    this.ctx.broadcastMonsterPlayerAttack?.(payload);
  }

  private executeSkill(
    mv: MonsterVisual,
    skillId: BossSkillId,
    targetX: number,
    targetY: number,
    isCoop: boolean
  ): void {
    const m = mv.monster;
    const ps = this.ctx.projectileSystem;

    switch (skillId) {
      case 'shockwave': {
        this.ctx.showFloatingText(m.x, m.y - 70, '💥 암흑 충격파!', '#f87171');
        const dmg = Math.round(m.attack * 1.45);
        this.emitRemoteBossAttack(
          {
            targetPlayerId: '*',
            monsterId: m.id,
            monsterName: m.name,
            role: m.role ?? 'melee',
            damage: dmg,
            startX: m.x,
            startY: m.y,
            targetX: m.x,
            targetY: m.y,
            isBossSkill: true,
            telegraphRadius: 175,
            telegraphDurationMs: 750,
            telegraphColor: 0xef4444,
          },
          isCoop
        );
        if (ps) {
          ps.spawnTelegraphZone({
            x: m.x,
            y: m.y,
            radius: 175,
            durationMs: 750,
            color: 0xef4444,
            onDetonate: () => {
              this.spawnFxBurst(m.x, m.y, 'shockwaveRingFx', 280, 0xf87171);
              this.damagePlayerInRadius(m.x, m.y, 175, dmg, m.name);
            },
          });
        }
        break;
      }
      case 'frost_nova': {
        this.ctx.showFloatingText(m.x, m.y - 70, '❄️ 혹한의 서리 폭발!', '#38bdf8');
        const dmg = Math.round(m.attack * 1.4);
        this.emitRemoteBossAttack(
          {
            targetPlayerId: '*',
            monsterId: m.id,
            monsterName: m.name,
            role: m.role ?? 'mage',
            damage: dmg,
            startX: m.x,
            startY: m.y,
            targetX,
            targetY,
            isBossSkill: true,
            telegraphRadius: 135,
            telegraphDurationMs: 800,
            telegraphColor: 0x38bdf8,
          },
          isCoop
        );
        if (ps) {
          ps.spawnTelegraphZone({
            x: targetX,
            y: targetY,
            radius: 135,
            durationMs: 800,
            color: 0x38bdf8,
            onDetonate: () => {
              this.spawnFxBurst(targetX, targetY, 'frostNovaFx', 230, 0x38bdf8);
              this.damagePlayerInRadius(targetX, targetY, 135, dmg, m.name);
            },
          });
        }
        break;
      }
      case 'void_barrage': {
        this.ctx.showFloatingText(m.x, m.y - 70, '🔱 공허 창기 탄막!', '#fbbf24');
        const dmg = Math.round(m.attack * 0.9);
        if (ps) {
          const baseAngle = Math.atan2(targetY - m.y, targetX - m.x);
          for (let i = -2; i <= 2; i++) {
            const angle = baseAngle + i * 0.22;
            const destX = m.x + Math.cos(angle) * 440;
            const destY = m.y + Math.sin(angle) * 440;
            this.emitRemoteBossAttack(
              {
                targetPlayerId: '*',
                monsterId: m.id,
                monsterName: m.name,
                role: 'mage',
                damage: dmg,
                startX: m.x,
                startY: m.y - 16,
                targetX: destX,
                targetY: destY,
                isBossSkill: true,
              },
              isCoop
            );
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
                this.damagePlayerInRadius(destX, destY, 64, dmg, m.name);
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
        const dmg = Math.round(m.attack * 1.35);
        if (ps) {
          for (let i = 0; i < 3; i++) {
            const ox = targetX + (Math.random() - 0.5) * 180;
            const oy = targetY + (Math.random() - 0.5) * 180;
            const durationMs = 850 + i * 220;
            this.emitRemoteBossAttack(
              {
                targetPlayerId: '*',
                monsterId: m.id,
                monsterName: m.name,
                role: 'mage',
                damage: dmg,
                startX: m.x,
                startY: m.y,
                targetX: ox,
                targetY: oy,
                isBossSkill: true,
                telegraphRadius: 105,
                telegraphDurationMs: durationMs,
                telegraphColor: 0xa855f7,
              },
              isCoop
            );
            ps.spawnTelegraphZone({
              x: ox,
              y: oy,
              radius: 105,
              durationMs,
              color: 0xa855f7,
              onDetonate: () => {
                this.spawnFxBurst(ox, oy, 'meteorRockFx', 190, 0xc084fc);
                this.damagePlayerInRadius(ox, oy, 105, dmg, m.name);
              },
            });
          }
        }
        break;
      }
      case 'lightning_judgment': {
        this.ctx.showFloatingText(m.x, m.y - 70, '⚡ 종말의 번개 심판!', '#fde047');
        const dmg = Math.round(m.attack * 1.45);
        if (ps) {
          const offsets = [
            { x: targetX, y: targetY },
            { x: targetX + 115, y: targetY - 60 },
            { x: targetX - 115, y: targetY + 60 },
          ];
          offsets.forEach((pt, idx) => {
            const durationMs = 700 + idx * 180;
            this.emitRemoteBossAttack(
              {
                targetPlayerId: '*',
                monsterId: m.id,
                monsterName: m.name,
                role: 'mage',
                damage: dmg,
                startX: m.x,
                startY: m.y,
                targetX: pt.x,
                targetY: pt.y,
                isBossSkill: true,
                telegraphRadius: 95,
                telegraphDurationMs: durationMs,
                telegraphColor: 0xfde047,
              },
              isCoop
            );
            ps.spawnTelegraphZone({
              x: pt.x,
              y: pt.y,
              radius: 95,
              durationMs,
              color: 0xfde047,
              onDetonate: () => {
                this.spawnFxBurst(pt.x, pt.y, 'lightningStrikeFx', 180, 0xfde047);
                this.damagePlayerInRadius(pt.x, pt.y, 95, dmg, m.name);
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
