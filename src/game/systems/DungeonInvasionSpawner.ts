import Phaser from 'phaser';
import {
  ELITE_SPAWN_CHANCE_BY_DIFFICULTY,
  pickRandomEliteAffix,
} from '../../data/elites';
import { DUNGEON_INVASION_CONFIG } from '../../data/monsterCamps';
import { DungeonPortalState, Island, Monster, MonsterCombatRole, MonsterType } from '../../types/game';
import { RoomDifficultyId } from '../../types/room';
import { getTerritoryCorePos } from '../constants';
import { DEPTH } from '../depthLayers';
import { GameEvents } from '../events/gameEvents';
import { pickRandomMapEdgeSpawn } from '../utils/waveUtils';
import { getDynamicScalingProfile } from '../utils/worldClockUtils';
import { MonsterVisual, MonsterVisualManager } from './MonsterVisualManager';

export interface IDungeonInvasionContext {
  scene: Phaser.Scene;
  getMonsters: () => Map<string, MonsterVisual>;
  getIslands: () => Island[];
  playExplosionAt: (x: number, y: number) => void;
  onPulseSpawned: () => void;
}

const DUNGEON_ARMY_ROSTER: Array<{
  type: MonsterType;
  role: MonsterCombatRole;
  name: string;
  hp: number;
  attack: number;
  speed: number;
  exp: number;
}> = [
  { type: 'zombie', role: 'melee', name: '🧟 심연 좀비병', hp: 85, attack: 14, speed: 54, exp: 10 },
  { type: 'goblin', role: 'melee', name: '👺 던전 강습병', hp: 95, attack: 16, speed: 64, exp: 12 },
  { type: 'lancer', role: 'lancer', name: '🔱 심연 창기병', hp: 120, attack: 20, speed: 74, exp: 15 },
  { type: 'skeleton', role: 'ranged', name: '🏹 던전 해골궁수', hp: 75, attack: 16, speed: 58, exp: 12 },
  { type: 'archmage', role: 'mage', name: '🔮 던전 흑마법사', hp: 90, attack: 22, speed: 50, exp: 18 },
];

/**
 * 사냥 특화 모드에서 위협도 100% 도달 시 '심연의 던전 게이트'를 출현시키고
 * 몬스터 100마리를 5회 분할 펄스(회당 20마리)로 스폰하여 중앙 마을로 진격시키는 모듈
 */
export class DungeonInvasionSpawner {
  private ctx: IDungeonInvasionContext;
  private portalContainer: Phaser.GameObjects.Container | null = null;
  private pulseTimers: Phaser.Time.TimerEvent[] = [];
  private portalState: DungeonPortalState | null = null;

  constructor(ctx: IDungeonInvasionContext) {
    this.ctx = ctx;
  }

  public getPortalState(): DungeonPortalState | null {
    return this.portalState ? { ...this.portalState } : null;
  }

  public startDungeonInvasion(params: {
    onlineCount: number;
    waveCount: number;
    bossWaveCount: number;
    difficultyId?: RoomDifficultyId;
    difficultyHpMultiplier?: number;
    difficultyAttackMultiplier?: number;
  }): { directionLabel: string; scalingLabel: string; totalSpawns: number } | null {
    const islands = this.ctx.getIslands();
    const edgeSpawn = pickRandomMapEdgeSpawn(islands);
    if (!edgeSpawn) return null;

    this.clearTimersAndPortal();

    const scaling = getDynamicScalingProfile(params.onlineCount);
    const totalToSpawn = Math.round(
      DUNGEON_INVASION_CONFIG.totalMonsterCount * scaling.countMultiplier
    );
    const pulses = DUNGEON_INVASION_CONFIG.pulseCount;
    const perPulse = Math.max(1, Math.floor(totalToSpawn / pulses));
    const waveScale = 1 + Math.max(0, params.waveCount - 1) * 0.15;
    const diffHpMult = params.difficultyHpMultiplier ?? 1;
    const diffAtkMult = params.difficultyAttackMultiplier ?? 1;
    const finalHpMult = scaling.hpMultiplier * waveScale * diffHpMult;
    const finalAtkMult = scaling.attackMultiplier * waveScale * diffAtkMult;
    const baseEliteChance = ELITE_SPAWN_CHANCE_BY_DIFFICULTY[params.difficultyId ?? 'normal'] ?? 0.2;
    const coOpEliteBonus = Math.min(0.18, Math.max(0, params.onlineCount - 1) * 0.05);
    const eliteChance = Math.min(0.65, baseEliteChance + coOpEliteBonus);

    this.portalState = {
      active: true,
      x: edgeSpawn.spawnX,
      y: edgeSpawn.spawnY,
      directionLabel: edgeSpawn.directionLabel,
      remainingSpawns: totalToSpawn,
      totalSpawns: totalToSpawn,
    };
    this.createPortalVisual(
      edgeSpawn.spawnX,
      edgeSpawn.spawnY,
      edgeSpawn.directionLabel,
      totalToSpawn
    );
    GameEvents.emit('dungeon-portal-updated', { ...this.portalState });

    // 즉시 1차 펄스 스폰 후 일정 간격으로 나머지 4차례 펄스 스폰 (총 totalToSpawn마리)
    this.spawnPulseBatch(edgeSpawn.spawnX, edgeSpawn.spawnY, perPulse, 0, finalHpMult, finalAtkMult, eliteChance, false);

    for (let p = 1; p < pulses; p++) {
      const isFinalPulse = p === pulses - 1;
      const batchCount = isFinalPulse ? totalToSpawn - perPulse * (pulses - 1) : perPulse;
      const timer = this.ctx.scene.time.delayedCall(
        p * DUNGEON_INVASION_CONFIG.pulseIntervalMs,
        () => {
          this.spawnPulseBatch(
            edgeSpawn.spawnX,
            edgeSpawn.spawnY,
            batchCount,
            p,
            finalHpMult,
            finalAtkMult,
            eliteChance,
            isFinalPulse
          );
          if (isFinalPulse) {
            this.ctx.scene.time.delayedCall(4000, () => {
              this.clearTimersAndPortal();
            });
          }
        }
      );
      this.pulseTimers.push(timer);
    }

    return {
      directionLabel: edgeSpawn.directionLabel,
      scalingLabel: scaling.label,
      totalSpawns: totalToSpawn,
    };
  }

  private spawnPulseBatch(
    portalX: number,
    portalY: number,
    count: number,
    pulseIdx: number,
    hpMult: number,
    atkMult: number,
    eliteChance: number,
    spawnGatekeeperBoss: boolean
  ): void {
    const monsters = this.ctx.getMonsters();
    const centralCore = getTerritoryCorePos(0, 0);
    const radius = DUNGEON_INVASION_CONFIG.portalSpreadRadiusPx;

    this.ctx.playExplosionAt(portalX, portalY);

    for (let i = 0; i < count; i++) {
      const rosterIdx = (pulseIdx * count + i) % DUNGEON_ARMY_ROSTER.length;
      const spec = DUNGEON_ARMY_ROSTER[rosterIdx];
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.25;
      const r = 35 + Math.random() * radius;
      const sx = portalX + Math.cos(angle) * r;
      const sy = portalY + Math.sin(angle) * r;
      const isElite = i === 0 || Math.random() < eliteChance * 0.45;
      const affix = isElite ? pickRandomEliteAffix() : null;
      const hp = Math.round(spec.hp * hpMult * (affix?.hpMultiplier ?? 1));
      const attack = Math.round(spec.attack * atkMult * (affix?.attackMultiplier ?? 1));
      const speed = Math.round(spec.speed * (affix?.speedMultiplier ?? 1));

      const m: Monster = {
        id: `dng_${Date.now()}_${pulseIdx}_${i}_${Math.random().toString(36).slice(2, 5)}`,
        type: spec.type,
        name: affix ? `★ ${affix.label} ${spec.name}` : spec.name,
        isBoss: false,
        isElite,
        eliteAffix: affix?.id,
        x: sx,
        y: sy,
        hp,
        maxHp: hp,
        attack,
        speed,
        targetTerritoryId: 0,
        spawnTerritoryId: 0,
        direction: sx > centralCore.x ? 'left' : 'right',
        role: spec.role,
        isCampMonster: false,
        campRing: 3,
        expReward: Math.round(spec.exp * (affix?.expMultiplier ?? 1)),
      };
      monsters.set(m.id, MonsterVisualManager.create(this.ctx.scene, m));
    }

    if (spawnGatekeeperBoss) {
      const bossHp = Math.round(950 * hpMult);
      const bossAtk = Math.round(48 * atkMult);
      const boss: Monster = {
        id: `dng_boss_${Date.now()}`,
        type: 'boss_deathlord',
        name: '👹 던전 수문장 데스로드',
        isBoss: true,
        x: portalX,
        y: portalY,
        hp: bossHp,
        maxHp: bossHp,
        attack: bossAtk,
        speed: 44,
        targetTerritoryId: 0,
        spawnTerritoryId: 0,
        direction: portalX > centralCore.x ? 'left' : 'right',
        role: 'melee',
        isCampMonster: false,
        expReward: 160,
      };
      monsters.set(boss.id, MonsterVisualManager.create(this.ctx.scene, boss));
    }

    if (this.portalState) {
      this.portalState.remainingSpawns = Math.max(0, this.portalState.remainingSpawns - count);
      GameEvents.emit('dungeon-portal-updated', { ...this.portalState });
    }
    this.ctx.onPulseSpawned();
  }

  private createPortalVisual(
    x: number,
    y: number,
    directionLabel: string,
    totalSpawns: number
  ): void {
    const { scene } = this.ctx;
    const container = scene.add.container(x, y);
    container.setDepth(DEPTH.INVASION_OVERLAY + 5);

    const g = scene.add.graphics();
    g.fillStyle(0x7e22ce, 0.38);
    g.fillCircle(0, 0, 115);
    g.lineStyle(5, 0xc084fc, 0.95);
    g.strokeCircle(0, 0, 115);
    g.lineStyle(3, 0xf43f5e, 0.85);
    g.strokeCircle(0, 0, 75);
    container.add(g);

    const label = scene.add
      .text(0, -135, `🌀 심연의 던전 게이트 (${directionLabel} ${totalSpawns}마리 진격!)`, {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#e879f9',
        stroke: '#000000',
        strokeThickness: 3.5,
      })
      .setOrigin(0.5);
    container.add(label);

    scene.tweens.add({
      targets: g,
      scaleX: 1.12,
      scaleY: 1.12,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    this.portalContainer = container;
  }

  public clearTimersAndPortal(): void {
    for (const t of this.pulseTimers) {
      t.remove(false);
    }
    this.pulseTimers = [];
    if (this.portalContainer?.scene) {
      this.portalContainer.destroy();
    }
    this.portalContainer = null;
    if (this.portalState) {
      this.portalState = null;
      GameEvents.emit('dungeon-portal-updated', null);
    }
  }
}
