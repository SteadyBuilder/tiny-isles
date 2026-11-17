import Phaser from 'phaser';
import { pickRandomEliteAffix } from '../../data/elites';
import { FIELD_MONSTER_CONFIG } from '../../data/fieldMonsters';
import { Island, Monster } from '../../types/game';
import { MissionDifficultyConfig } from '../../types/room';
import {
  pickFieldPackTemplate,
  pickWildernessFieldSpawnSpots,
} from '../utils/fieldSpawnUtils';
import { computeHuntingScaling } from '../utils/huntingScalingUtils';
import { WorldTerrainMap } from '../world/MapTerrainGenerator';
import { WORLD_BOUNDS } from '../worldBounds';
import { MonsterVisual, MonsterVisualManager } from './MonsterVisualManager';

export interface IFieldMonsterContext {
  scene: Phaser.Scene;
  isHuntingMode: () => boolean;
  isHost: () => boolean;
  getDifficultyConfig?: () => MissionDifficultyConfig;
  getIslands: () => Island[];
  getTerrainMap: () => WorldTerrainMap;
  getMonsters: () => Map<string, MonsterVisual>;
}

interface ActiveFieldPack {
  packId: string;
  x: number;
  y: number;
  ring: 1 | 2 | 3 | 4;
  memberIds: string[];
  respawnTimerMs: number | null;
}

/**
 * 사냥 특화 모드 야생 필드 몬스터 & 필드 엘리트 무리 스폰/리스폰/인원 스케일링 전담 시스템
 */
export class FieldMonsterSystem {
  private ctx: IFieldMonsterContext;
  private packs: ActiveFieldPack[] = [];
  private onlineCount = 1;
  private appliedHpMult = 1;
  private appliedAtkMult = 1;
  private checkAccumMs = 0;
  private packSeq = 0;

  constructor(ctx: IFieldMonsterContext) {
    this.ctx = ctx;
  }

  private getTargetPackCount(): number {
    const coOpPackBonus = 1 + Math.min(0.6, Math.max(0, this.onlineCount - 1) * 0.2);
    return Math.round(FIELD_MONSTER_CONFIG.baseActivePackCount * coOpPackBonus);
  }

  public initializeFieldMonsters(): void {
    if (!this.ctx.isHuntingMode() || !this.ctx.isHost()) return;

    const scaling = computeHuntingScaling(this.ctx.getDifficultyConfig?.(), this.onlineCount);
    this.appliedHpMult = scaling.hpMult;
    this.appliedAtkMult = scaling.atkMult;

    const spots = pickWildernessFieldSpawnSpots({
      desiredCount: this.getTargetPackCount(),
      existingSpots: [],
      terrain: this.ctx.getTerrainMap(),
      islands: this.ctx.getIslands(),
      bounds: WORLD_BOUNDS,
    });

    for (const spot of spots) {
      this.spawnPackAt(spot.x, spot.y, spot.ring);
    }
  }

  public setOnlineCount(count: number): void {
    const nextCount = Math.max(1, count);
    if (nextCount === this.onlineCount) return;

    const prevHpMult = this.appliedHpMult;
    const prevAtkMult = this.appliedAtkMult;
    this.onlineCount = nextCount;

    if (!this.ctx.isHuntingMode() || !this.ctx.isHost()) return;

    const scaling = computeHuntingScaling(this.ctx.getDifficultyConfig?.(), this.onlineCount);
    const hpRatio = prevHpMult > 0 ? scaling.hpMult / prevHpMult : 1;
    const atkRatio = prevAtkMult > 0 ? scaling.atkMult / prevAtkMult : 1;
    this.appliedHpMult = scaling.hpMult;
    this.appliedAtkMult = scaling.atkMult;

    if (Math.abs(hpRatio - 1) > 0.01 || Math.abs(atkRatio - 1) > 0.01) {
      for (const mv of this.ctx.getMonsters().values()) {
        const m = mv.monster;
        if (!m.isFieldMonster || m.hp <= 0) continue;
        const hpPct = m.hp / Math.max(1, m.maxHp);
        m.maxHp = Math.max(1, Math.round(m.maxHp * hpRatio));
        m.hp = Math.max(1, Math.round(m.maxHp * hpPct));
        m.attack = Math.max(1, Math.round(m.attack * atkRatio));
        MonsterVisualManager.updateHpBar(mv, false);
      }
    }

    const deficit = this.getTargetPackCount() - this.packs.length;
    if (deficit > 0) {
      const extraSpots = pickWildernessFieldSpawnSpots({
        desiredCount: deficit,
        existingSpots: this.packs.map((p) => ({ x: p.x, y: p.y })),
        terrain: this.ctx.getTerrainMap(),
        islands: this.ctx.getIslands(),
        bounds: WORLD_BOUNDS,
      });
      for (const spot of extraSpots) {
        this.spawnPackAt(spot.x, spot.y, spot.ring);
      }
    }
  }

  public update(deltaMs: number): void {
    if (!this.ctx.isHuntingMode() || !this.ctx.isHost() || this.packs.length === 0) return;

    this.checkAccumMs += deltaMs;
    if (this.checkAccumMs < 1000) return;
    const elapsedMs = this.checkAccumMs;
    this.checkAccumMs = 0;

    const monsters = this.ctx.getMonsters();
    for (const pack of this.packs) {
      if (pack.respawnTimerMs === null) {
        pack.memberIds = pack.memberIds.filter((id) => monsters.has(id));
        if (pack.memberIds.length === 0) {
          pack.respawnTimerMs = FIELD_MONSTER_CONFIG.packRespawnDelayMs;
        }
        continue;
      }

      pack.respawnTimerMs = Math.max(0, pack.respawnTimerMs - elapsedMs);
      if (pack.respawnTimerMs <= 0) {
        this.respawnPack(pack);
      }
    }
  }

  private respawnPack(pack: ActiveFieldPack): void {
    const otherSpots = this.packs
      .filter((p) => p.packId !== pack.packId)
      .map((p) => ({ x: p.x, y: p.y }));
    const [newSpot] = pickWildernessFieldSpawnSpots({
      desiredCount: 1,
      existingSpots: otherSpots,
      terrain: this.ctx.getTerrainMap(),
      islands: this.ctx.getIslands(),
      bounds: WORLD_BOUNDS,
    });

    const sx = newSpot?.x ?? pack.x;
    const sy = newSpot?.y ?? pack.y;
    const ring = newSpot?.ring ?? pack.ring;

    pack.x = sx;
    pack.y = sy;
    pack.ring = ring;
    pack.respawnTimerMs = null;
    pack.memberIds = this.createPackMonsters(pack.packId, sx, sy, ring);
  }

  private spawnPackAt(x: number, y: number, ring: 1 | 2 | 3 | 4): void {
    const packId = `fpack_${++this.packSeq}`;
    const memberIds = this.createPackMonsters(packId, x, y, ring);
    this.packs.push({
      packId,
      x,
      y,
      ring,
      memberIds,
      respawnTimerMs: null,
    });
  }

  private createPackMonsters(
    packId: string,
    centerX: number,
    centerY: number,
    ring: 1 | 2 | 3 | 4
  ): string[] {
    const tpl = pickFieldPackTemplate(ring);
    const scaling = computeHuntingScaling(this.ctx.getDifficultyConfig?.(), this.onlineCount);
    const monsters = this.ctx.getMonsters();
    const spawnedIds: string[] = [];

    const totalUnits = tpl.units.reduce((sum, u) => sum + u.count, 0);
    let eliteSpawned = false;
    let idx = 0;

    for (const unit of tpl.units) {
      for (let i = 0; i < unit.count; i++) {
        const angle = (Math.PI * 2 * idx) / Math.max(1, totalUnits) + (Math.random() - 0.5) * 0.4;
        const dist = 36 + (idx % 2) * 32;
        const mx = centerX + Math.cos(angle) * dist;
        const my = centerY + Math.sin(angle) * dist;

        const forceElite = tpl.guaranteedElite && !eliteSpawned && idx === 0;
        const chance = unit.eliteChance ?? scaling.eliteChance;
        const isElite = forceElite || Math.random() < chance;
        const affix = isElite ? pickRandomEliteAffix() : null;
        if (isElite) eliteSpawned = true;

        const hp = Math.round(unit.hp * scaling.hpMult * (affix?.hpMultiplier ?? 1));
        const attack = Math.round(unit.attack * scaling.atkMult * (affix?.attackMultiplier ?? 1));
        const speed = Math.round(unit.speed * (affix?.speedMultiplier ?? 1));
        const id = `fld_${packId}_${Date.now()}_${idx}`;

        const monster: Monster = {
          id,
          type: unit.type,
          name: affix ? `★ 야생 정예 ${affix.label} ${unit.name}` : unit.name,
          isBoss: false,
          isElite,
          eliteAffix: affix?.id,
          x: mx,
          y: my,
          hp,
          maxHp: hp,
          attack,
          speed,
          targetTerritoryId: 0,
          spawnTerritoryId: 0,
          direction: idx % 2 === 0 ? 'left' : 'right',
          role: unit.role,
          isCampMonster: false,
          isFieldMonster: true,
          campRing: ring,
          homeX: centerX,
          homeY: centerY,
          patrolRadiusPx: FIELD_MONSTER_CONFIG.patrolRadiusPx,
          expReward: Math.round(unit.expReward * (affix?.expMultiplier ?? 1)),
        };

        monsters.set(id, MonsterVisualManager.create(this.ctx.scene, monster));
        spawnedIds.push(id);
        idx++;
      }
    }

    return spawnedIds;
  }

  public destroy(): void {
    this.packs = [];
  }
}
