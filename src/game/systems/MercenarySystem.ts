import Phaser from 'phaser';
import { getMercenaryConfig, MERCENARY_GUILD_CONFIG } from '../../data/mercenaries';
import { sound } from '../../lib/sound';
import { ConstructedBuilding, MercenaryId, MercenaryUnit } from '../../types/game';
import { ySortDepth } from '../depthLayers';
import { GameEvents } from '../events/gameEvents';
import { ProjectileSystem } from './ProjectileSystem';
import { MonsterVisual, WaveSystem } from './WaveSystem';

interface MercenaryVisualRef {
  unit: MercenaryUnit;
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  hpBar: Phaser.GameObjects.Graphics;
  lastAttackTime: number;
  lastRetaliateTime: number;
  currentAnim: 'idle' | 'run' | 'attack';
  patrolTargetX: number;
  patrolTargetY: number;
  nextPatrolAt: number;
}

export interface IMercenaryContext {
  scene: Phaser.Scene;
  projectileSystem?: ProjectileSystem;
  showFloatingText?: (x: number, y: number, text: string, color: string) => void;
  onLocalMercenariesChanged?: (units: MercenaryUnit[]) => void;
}

/**
 * 용병 길드에서 고용한 용병(전사·궁수·창병)의 영지 순찰, 마물 요격, 체력·사망 관리 시스템
 */
export class MercenarySystem {
  private ctx: IMercenaryContext;
  private waveSystem: WaveSystem;
  private visuals = new Map<string, MercenaryVisualRef>();
  private nextId = 1;
  private lastSyncBroadcastTime = 0;

  constructor(ctx: IMercenaryContext, waveSystem: WaveSystem) {
    this.ctx = ctx;
    this.waveSystem = waveSystem;
  }

  public getMercenaries(): MercenaryUnit[] {
    return Array.from(this.visuals.values()).map((v) => ({ ...v.unit }));
  }

  public getGuildMercenaryCount(guildId: string): number {
    let count = 0;
    for (const ref of this.visuals.values()) {
      if (ref.unit.guildId === guildId && ref.unit.hp > 0) count++;
    }
    return count;
  }

  public hireMercenary(guild: ConstructedBuilding, mercenaryId: MercenaryId): MercenaryUnit | null {
    if (!this.ctx.scene.sys || !this.ctx.scene.scene?.isActive()) return null;
    if (this.getGuildMercenaryCount(guild.id) >= MERCENARY_GUILD_CONFIG.maxMercenariesPerGuild) {
      return null;
    }

    const cfg = getMercenaryConfig(mercenaryId);
    const angle = Math.random() * Math.PI * 2;
    const spawnX = guild.x + Math.cos(angle) * 68;
    const spawnY = guild.y + 52 + Math.sin(angle) * 32;
    const id = `merc_${Date.now()}_${this.nextId++}`;

    const unit: MercenaryUnit = {
      id,
      guildId: guild.id,
      territoryId: guild.territoryId,
      mercenaryId,
      name: cfg.name,
      hp: cfg.maxHp,
      maxHp: cfg.maxHp,
      attack: cfg.attack,
      range: cfg.range,
      attackCooldownMs: cfg.attackCooldownMs,
      speed: cfg.speed,
      isRanged: cfg.isRanged,
      homeX: guild.x,
      homeY: guild.y + 56,
      x: spawnX,
      y: spawnY,
      direction: 'right',
    };

    const sprite = this.ctx.scene.add.sprite(spawnX, spawnY, `${cfg.spritePrefix}Idle`);
    sprite.setDisplaySize(cfg.displaySize, cfg.displaySize);
    sprite.setDepth(ySortDepth(spawnY, 22));
    if (this.ctx.scene.anims.exists(`${cfg.spritePrefix}_idle`)) {
      sprite.play(`${cfg.spritePrefix}_idle`);
    }

    const label = this.ctx.scene.add
      .text(spawnX, spawnY - 42, `${cfg.icon} ${cfg.name}`, {
        fontSize: '11px',
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        color: '#fde047',
        backgroundColor: 'rgba(15, 23, 42, 0.78)',
        padding: { x: 5, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(ySortDepth(spawnY, 29));

    const hpBar = this.ctx.scene.add.graphics();
    hpBar.setDepth(ySortDepth(spawnY, 29));

    const ref: MercenaryVisualRef = {
      unit,
      sprite,
      label,
      hpBar,
      lastAttackTime: 0,
      lastRetaliateTime: 0,
      currentAnim: 'idle',
      patrolTargetX: spawnX,
      patrolTargetY: spawnY,
      nextPatrolAt: this.ctx.scene.time.now + 1500,
    };

    this.drawHpBar(ref);
    this.visuals.set(id, ref);
    this.emitUpdate();
    this.ctx.onLocalMercenariesChanged?.(this.getMercenaries());
    return { ...unit };
  }

  public update(time: number, delta: number): void {
    if (this.visuals.size === 0) return;

    const dt = Math.min(0.1, delta / 1000);
    const monsters = this.waveSystem.getMonsterVisuals();
    let changed = false;

    for (const [id, ref] of Array.from(this.visuals.entries())) {
      const target = this.findNearestMonster(ref, Array.from(monsters.values()));

      if (target) {
        const dx = target.monster.x - ref.unit.x;
        const dy = target.monster.y - ref.unit.y;
        const dist = Math.hypot(dx, dy);
        ref.unit.direction = dx < 0 ? 'left' : 'right';
        ref.sprite.setFlipX(dx < 0);

        if (dist <= ref.unit.range) {
          if (time - ref.lastAttackTime >= ref.unit.attackCooldownMs) {
            ref.lastAttackTime = time;
            this.performAttack(ref, target);
          } else if (ref.currentAnim !== 'attack') {
            this.playAnim(ref, 'idle');
          }
        } else {
          this.moveToward(ref, target.monster.x, target.monster.y, dt);
        }

        // 근접한 마물이 용병에게 반격 피해를 입힘
        if (
          dist <= MERCENARY_GUILD_CONFIG.monsterRetaliateRadiusPx &&
          time - ref.lastRetaliateTime >= MERCENARY_GUILD_CONFIG.monsterRetaliateIntervalMs
        ) {
          ref.lastRetaliateTime = time;
          const incomingDmg = Math.max(4, Math.round(target.monster.attack * 0.65));
          ref.unit.hp = Math.max(0, ref.unit.hp - incomingDmg);
          this.drawHpBar(ref);
          this.ctx.showFloatingText?.(ref.unit.x, ref.unit.y - 24, `-${incomingDmg}`, '#fca5a5');
          changed = true;

          if (ref.unit.hp <= 0) {
            this.removeMercenary(id);
            this.ctx.showFloatingText?.(ref.unit.x, ref.unit.y - 36, '💀 용병 전사!', '#f87171');
            continue;
          }
        }
      } else {
        this.updatePatrol(ref, time, dt);
      }
    }

    if (changed) {
      this.emitUpdate();
      this.ctx.onLocalMercenariesChanged?.(this.getMercenaries());
      this.lastSyncBroadcastTime = time;
    } else if (time - this.lastSyncBroadcastTime >= 450) {
      this.lastSyncBroadcastTime = time;
      this.ctx.onLocalMercenariesChanged?.(this.getMercenaries());
    }
  }

  private findNearestMonster(
    ref: MercenaryVisualRef,
    monsters: ReadonlyArray<MonsterVisual>
  ): MonsterVisual | null {
    let best: MonsterVisual | null = null;
    let bestDist = MERCENARY_GUILD_CONFIG.aggroRadiusPx;

    for (const mv of monsters) {
      if (mv.monster.hp <= 0) continue;
      const distFromHome = Math.hypot(mv.monster.x - ref.unit.homeX, mv.monster.y - ref.unit.homeY);
      if (distFromHome > MERCENARY_GUILD_CONFIG.aggroRadiusPx + 120) continue;
      const dist = Math.hypot(mv.monster.x - ref.unit.x, mv.monster.y - ref.unit.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = mv;
      }
    }
    return best;
  }

  private performAttack(ref: MercenaryVisualRef, target: MonsterVisual): void {
    this.playAnim(ref, 'attack');
    sound.playChop();

    if (ref.unit.isRanged && this.ctx.projectileSystem) {
      this.ctx.projectileSystem.fireProjectile({
        startX: ref.unit.x,
        startY: ref.unit.y - 16,
        targetX: target.monster.x,
        targetY: target.monster.y,
        tint: 0xfde047,
        onArrive: () => {},
      });
    }

    this.waveSystem.damageMonster(
      target.monster.id,
      ref.unit.attack,
      '용병',
      false
    );
  }

  private updatePatrol(ref: MercenaryVisualRef, time: number, dt: number): void {
    if (time >= ref.nextPatrolAt) {
      const angle = Math.random() * Math.PI * 2;
      const r = 40 + Math.random() * (MERCENARY_GUILD_CONFIG.patrolRadiusPx - 40);
      ref.patrolTargetX = ref.unit.homeX + Math.cos(angle) * r;
      ref.patrolTargetY = ref.unit.homeY + Math.sin(angle) * r;
      ref.nextPatrolAt = time + 3200 + Math.random() * 2800;
    }

    const dist = Math.hypot(ref.patrolTargetX - ref.unit.x, ref.patrolTargetY - ref.unit.y);
    if (dist > 14) {
      this.moveToward(ref, ref.patrolTargetX, ref.patrolTargetY, dt * 0.7);
    } else {
      this.playAnim(ref, 'idle');
    }
  }

  private moveToward(ref: MercenaryVisualRef, tx: number, ty: number, dt: number): void {
    const dx = tx - ref.unit.x;
    const dy = ty - ref.unit.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;

    const step = Math.min(dist, ref.unit.speed * dt);
    ref.unit.x += (dx / dist) * step;
    ref.unit.y += (dy / dist) * step;
    ref.unit.direction = dx < 0 ? 'left' : 'right';

    ref.sprite.setPosition(ref.unit.x, ref.unit.y);
    ref.sprite.setFlipX(dx < 0);
    ref.sprite.setDepth(ySortDepth(ref.unit.y, 22));
    ref.label.setPosition(ref.unit.x, ref.unit.y - 42);
    ref.label.setDepth(ySortDepth(ref.unit.y, 29));
    this.drawHpBar(ref);
    this.playAnim(ref, 'run');
  }

  private playAnim(ref: MercenaryVisualRef, next: 'idle' | 'run' | 'attack'): void {
    if (ref.currentAnim === next && next !== 'attack') return;
    ref.currentAnim = next;
    const cfg = getMercenaryConfig(ref.unit.mercenaryId);
    const key = `${cfg.spritePrefix}_${next}`;
    if (this.ctx.scene.anims.exists(key)) {
      ref.sprite.play(key, next !== 'attack');
      if (next === 'attack') {
        ref.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          if (ref.currentAnim === 'attack') {
            ref.currentAnim = 'idle';
            const idleKey = `${cfg.spritePrefix}_idle`;
            if (this.ctx.scene.anims.exists(idleKey)) {
              ref.sprite.play(idleKey, true);
            }
          }
        });
      }
    }
  }

  private drawHpBar(ref: MercenaryVisualRef): void {
    ref.hpBar.clear();
    const w = 36;
    const h = 4;
    const x = ref.unit.x - w / 2;
    const y = ref.unit.y - 32;
    ref.hpBar.fillStyle(0x000000, 0.65);
    ref.hpBar.fillRect(x, y, w, h);
    const ratio = Math.max(0, Math.min(1, ref.unit.hp / ref.unit.maxHp));
    ref.hpBar.fillStyle(ratio > 0.4 ? 0x22c55e : 0xef4444, 1);
    ref.hpBar.fillRect(x, y, w * ratio, h);
    ref.hpBar.setDepth(ySortDepth(ref.unit.y, 29));
  }

  private removeMercenary(id: string): void {
    const ref = this.visuals.get(id);
    if (!ref) return;
    ref.sprite.destroy();
    ref.label.destroy();
    ref.hpBar.destroy();
    this.visuals.delete(id);
  }

  private emitUpdate(): void {
    GameEvents.emit('mercenaries-updated', this.getMercenaries());
  }

  public destroy(): void {
    for (const ref of this.visuals.values()) {
      ref.sprite.destroy();
      ref.label.destroy();
      ref.hpBar.destroy();
    }
    this.visuals.clear();
  }
}
