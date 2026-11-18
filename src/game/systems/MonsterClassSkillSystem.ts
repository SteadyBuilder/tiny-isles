import {
  MONSTER_CLASS_COMBAT_PROFILES,
  MonsterClassCombatProfile,
  resolveMonsterCombatRole,
} from '../../data/monsterClassSkills';
import { sound } from '../../lib/sound';
import { ActivePlayerTarget, MonsterPlayerAttackPayload } from '../../types/monsterSync';
import { MonsterAttackFxRenderer } from '../phaser/renderers/MonsterAttackFxRenderer';
import { findTargetPlayerForMonster } from '../utils/monsterSyncUtils';
import { MonsterVisual, MonsterVisualManager } from './MonsterVisualManager';
import { ProjectileSystem } from './ProjectileSystem';

export interface IMonsterClassSkillContext {
  getLocalPlayerId?: () => string;
  getLocalPlayerPosition: () => { x: number; y: number };
  isLocalPlayerFainted: () => boolean;
  getActivePlayers?: () => ActivePlayerTarget[];
  damageLocalPlayer: (damage: number, attackerName: string) => void;
  broadcastMonsterPlayerAttack?: (payload: MonsterPlayerAttackPayload) => void;
  projectileSystem?: ProjectileSystem;
  fxRenderer?: MonsterAttackFxRenderer;
  playExplosionAt: (x: number, y: number) => void;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
}

/**
 * 일반/정예 몬스터(흑기사, 창기병, 암흑궁수, 흑마법병) 직업별 고유 액티브 스킬 시스템
 * - dark_cleave (흑기사: 암흑 회전참)
 * - piercing_thrust (창기병: 심연 관통창)
 * - volley_shot (암흑궁수: 저주의 3연발 일제사격)
 * - abyss_orb (흑마법병: 심연 마력진 폭발)
 */
export class MonsterClassSkillSystem {
  private ctx: IMonsterClassSkillContext;
  private lastSkillTimeMap = new Map<string, number>();

  constructor(ctx: IMonsterClassSkillContext) {
    this.ctx = ctx;
  }

  public pruneStaleState(validIds: Set<string>): void {
    for (const id of this.lastSkillTimeMap.keys()) {
      if (!validIds.has(id)) {
        this.lastSkillTimeMap.delete(id);
      }
    }
  }

  public deleteState(monsterId: string): void {
    this.lastSkillTimeMap.delete(monsterId);
  }

  public destroy(): void {
    this.lastSkillTimeMap.clear();
  }

  /**
   * 몬스터가 교전 사거리 내에서 스킬 쿨다운이 돌아왔다면 직업 고유 스킬을 발동하고 true를 반환합니다.
   */
  public tryCastClassSkill(
    mv: MonsterVisual,
    time: number,
    activePlayers: ReadonlyArray<ActivePlayerTarget>
  ): boolean {
    const m = mv.monster;
    if (m.isBoss || m.hp <= 0) return false;

    const role = resolveMonsterCombatRole(m);
    const profile = MONSTER_CLASS_COMBAT_PROFILES[role];
    const baseCooldown = m.isElite ? profile.eliteSkillCooldownMs : profile.skillCooldownMs;
    const cooldownMs = m.eliteAffix === 'berserker' ? Math.round(baseCooldown * 0.8) : baseCooldown;

    const lastCast = this.lastSkillTimeMap.get(m.id);
    if (lastCast === undefined) {
      // 스폰 직후 모든 몬스터가 동시에 스킬을 쓰지 않도록 개체별 초기 지터 부여
      const jitter = (m.id.charCodeAt(m.id.length - 1) % 7) * 450;
      this.lastSkillTimeMap.set(m.id, time - cooldownMs * 0.55 + jitter);
      return false;
    }

    if (time - lastCast < cooldownMs) return false;

    const targetMatch = findTargetPlayerForMonster(
      m.x,
      m.y,
      activePlayers,
      profile.skillTriggerRangePx
    );
    if (!targetMatch) return false;

    this.lastSkillTimeMap.set(m.id, time);
    mv.lastAttackTime = time;
    this.executeClassSkill(
      mv,
      profile,
      targetMatch.player.x,
      targetMatch.player.y,
      activePlayers.length > 1
    );
    return true;
  }

  private emitRemoteSkill(payload: MonsterPlayerAttackPayload, isCoop: boolean): void {
    if (!isCoop) return;
    this.ctx.broadcastMonsterPlayerAttack?.(payload);
  }

  private executeClassSkill(
    mv: MonsterVisual,
    profile: MonsterClassCombatProfile,
    targetX: number,
    targetY: number,
    isCoop: boolean
  ): void {
    const m = mv.monster;
    const dmg = Math.max(1, Math.round(m.attack * profile.skillDamageMultiplier));
    const ps = this.ctx.projectileSystem;

    MonsterVisualManager.playAttackAnimation(mv, targetX);
    this.ctx.showFloatingText(m.x, m.y - 52, profile.skillCallout, profile.skillCalloutColor);
    this.ctx.fxRenderer?.playSkillCastFx({
      skillId: profile.skillId,
      startX: m.x,
      startY: m.y,
      targetX,
      targetY,
      isBoss: m.isElite,
    });

    switch (profile.skillId) {
      case 'dark_cleave': {
        sound.playSwordSlash();
        const radius = m.isElite ? Math.round(profile.telegraphRadiusPx * 1.18) : profile.telegraphRadiusPx;
        const strikeX = m.x + Math.cos(Math.atan2(targetY - m.y, targetX - m.x)) * 22;
        const strikeY = m.y + Math.sin(Math.atan2(targetY - m.y, targetX - m.x)) * 22;

        this.emitRemoteSkill(
          {
            targetPlayerId: '*',
            monsterId: m.id,
            monsterName: `${m.name} (${profile.skillName})`,
            role: 'melee',
            damage: dmg,
            startX: m.x,
            startY: m.y,
            targetX: strikeX,
            targetY: strikeY,
            skillId: 'dark_cleave',
            telegraphRadius: radius,
            telegraphDurationMs: profile.telegraphDurationMs,
            telegraphColor: profile.primaryHex,
          },
          isCoop
        );

        if (ps) {
          ps.spawnTelegraphZone({
            x: strikeX,
            y: strikeY,
            radius,
            durationMs: profile.telegraphDurationMs,
            color: profile.primaryHex,
            onDetonate: () => {
              this.ctx.fxRenderer?.playSkillDetonateFx({
                skillId: 'dark_cleave',
                x: strikeX,
                y: strikeY,
                radius,
              });
              this.damageLocalPlayerInRadius(strikeX, strikeY, radius, dmg, `${m.name} (${profile.skillName})`);
            },
          });
        } else {
          this.damageLocalPlayerInRadius(strikeX, strikeY, radius, dmg, `${m.name} (${profile.skillName})`);
        }
        break;
      }

      case 'piercing_thrust': {
        sound.playLanceThrust();
        const angle = Math.atan2(targetY - m.y, targetX - m.x);
        const dist = Math.min(profile.skillTriggerRangePx, Math.max(70, Math.hypot(targetX - m.x, targetY - m.y)));
        const strikeX = m.x + Math.cos(angle) * dist;
        const strikeY = m.y + Math.sin(angle) * dist;
        const radius = m.isElite ? Math.round(profile.telegraphRadiusPx * 1.15) : profile.telegraphRadiusPx;

        this.emitRemoteSkill(
          {
            targetPlayerId: '*',
            monsterId: m.id,
            monsterName: `${m.name} (${profile.skillName})`,
            role: 'lancer',
            damage: dmg,
            startX: m.x,
            startY: m.y,
            targetX: strikeX,
            targetY: strikeY,
            skillId: 'piercing_thrust',
            telegraphRadius: radius,
            telegraphDurationMs: profile.telegraphDurationMs,
            telegraphColor: profile.primaryHex,
          },
          isCoop
        );

        if (ps) {
          ps.fireProjectile({
            startX: m.x,
            startY: m.y - 14,
            targetX: strikeX,
            targetY: strikeY,
            durationMs: 210,
            tint: profile.secondaryHex,
            size: 42,
            isMagic: true,
            trailColor: profile.primaryHex,
            impactColor: profile.accentHex,
            impactRadius: 52,
            onArrive: () => {},
          });
          ps.spawnTelegraphZone({
            x: strikeX,
            y: strikeY,
            radius,
            durationMs: profile.telegraphDurationMs,
            color: profile.primaryHex,
            onDetonate: () => {
              this.ctx.fxRenderer?.playSkillDetonateFx({
                skillId: 'piercing_thrust',
                x: strikeX,
                y: strikeY,
                radius,
              });
              this.damageLocalPlayerInRadius(strikeX, strikeY, radius, dmg, `${m.name} (${profile.skillName})`);
            },
          });
        } else {
          this.damageLocalPlayerInRadius(strikeX, strikeY, radius, dmg, `${m.name} (${profile.skillName})`);
        }
        break;
      }

      case 'volley_shot': {
        sound.playBowRelease();
        const baseAngle = Math.atan2(targetY - m.y, targetX - m.x);
        const dist = Math.max(130, Math.hypot(targetX - m.x, targetY - m.y));
        const spreadOffsets = [-0.22, 0, 0.22];

        for (const offset of spreadOffsets) {
          const shotAngle = baseAngle + offset;
          const destX = m.x + Math.cos(shotAngle) * dist;
          const destY = m.y + Math.sin(shotAngle) * dist;

          this.emitRemoteSkill(
            {
              targetPlayerId: '*',
              monsterId: m.id,
              monsterName: `${m.name} (${profile.skillName})`,
              role: 'ranged',
              damage: dmg,
              startX: m.x,
              startY: m.y - 16,
              targetX: destX,
              targetY: destY,
              skillId: 'volley_shot',
              projectileTint: offset === 0 ? profile.accentHex : profile.primaryHex,
              projectileSize: 36,
              trailColor: profile.secondaryHex,
              impactColor: profile.primaryHex,
              impactRadius: 42,
            },
            isCoop
          );

          if (ps) {
            ps.fireProjectile({
              startX: m.x,
              startY: m.y - 16,
              targetX: destX,
              targetY: destY,
              durationMs: 280,
              tint: offset === 0 ? profile.accentHex : profile.primaryHex,
              size: 36,
              isMagic: false,
              trailColor: profile.secondaryHex,
              impactColor: profile.primaryHex,
              impactRadius: 42,
              onArrive: () => {
                this.damageLocalPlayerInRadius(
                  destX,
                  destY,
                  profile.telegraphRadiusPx,
                  dmg,
                  `${m.name} (${profile.skillName})`
                );
              },
            });
          }
        }
        break;
      }

      case 'abyss_orb': {
        sound.playMagicCast();
        const radius = m.isElite ? Math.round(profile.telegraphRadiusPx * 1.18) : profile.telegraphRadiusPx;

        this.emitRemoteSkill(
          {
            targetPlayerId: '*',
            monsterId: m.id,
            monsterName: `${m.name} (${profile.skillName})`,
            role: 'mage',
            damage: dmg,
            startX: m.x,
            startY: m.y - 18,
            targetX,
            targetY,
            skillId: 'abyss_orb',
            telegraphRadius: radius,
            telegraphDurationMs: profile.telegraphDurationMs,
            telegraphColor: profile.secondaryHex,
            projectileTint: profile.primaryHex,
            projectileSize: 48,
            trailColor: profile.accentHex,
            impactColor: profile.secondaryHex,
            impactRadius: 68,
          },
          isCoop
        );

        if (ps) {
          ps.fireProjectile({
            startX: m.x,
            startY: m.y - 18,
            targetX,
            targetY,
            durationMs: 340,
            tint: profile.primaryHex,
            size: 48,
            isMagic: true,
            trailColor: profile.accentHex,
            impactColor: profile.secondaryHex,
            impactRadius: 68,
            onArrive: () => {},
          });
          ps.spawnTelegraphZone({
            x: targetX,
            y: targetY,
            radius,
            durationMs: profile.telegraphDurationMs,
            color: profile.secondaryHex,
            onDetonate: () => {
              this.ctx.playExplosionAt(targetX, targetY);
              this.ctx.fxRenderer?.playSkillDetonateFx({
                skillId: 'abyss_orb',
                x: targetX,
                y: targetY,
                radius,
              });
              this.damageLocalPlayerInRadius(targetX, targetY, radius, dmg, `${m.name} (${profile.skillName})`);
            },
          });
        }
        break;
      }
    }
  }

  private damageLocalPlayerInRadius(
    cx: number,
    cy: number,
    radius: number,
    damage: number,
    attackerName: string
  ): void {
    if (this.ctx.isLocalPlayerFainted()) return;
    const cur = this.ctx.getLocalPlayerPosition();
    if (Math.hypot(cur.x - cx, cur.y - cy) <= radius + 4) {
      this.ctx.damageLocalPlayer(damage, attackerName);
    }
  }
}
