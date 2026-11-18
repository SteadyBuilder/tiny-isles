import Phaser from 'phaser';
import { MAP_OUTER_SPAWN_CONFIG, WAVE_SPAWN_SCALING_CONFIG } from '../../data/waves';
import { Island, Monster } from '../../types/game';
import {
  getBossMonsterTemplate,
  getRegularMonsterTemplates,
  pickRandomMapEdgeSpawn,
} from '../utils/waveUtils';
import { getDynamicScalingProfile } from '../utils/worldClockUtils';
import { getTerritoryCorePos } from '../constants';
import { setDepthIfChanged, ySortDepth } from '../depthLayers';
import { MonsterVisual, MonsterVisualManager } from './MonsterVisualManager';

export interface IWaveSpawnerContext {
  scene: Phaser.Scene;
  getMonsters: () => Map<string, MonsterVisual>;
  getIslands: () => Island[];
  playExplosionAt: (x: number, y: number) => void;
  shakeObject: (target: Phaser.GameObjects.Container) => void;
}

export interface SpawnWaveParams {
  isBossWave: boolean;
  onlineCount: number;
  waveCount: number;
  bossWaveCount: number;
  difficultyHpMultiplier?: number;
  difficultyAttackMultiplier?: number;
}

export interface SpawnWaveResult {
  firstTerritoryName: string;
  spawnedBossName: string;
  bossDirectionLabel: string;
  scalingLabel: string;
}

/**
 * 웨이브 몬스터 스폰, 스냅샷 복원 및 원격 호스트 몬스터 동기화 비주얼 관리 모듈
 */
export class WaveSpawner {
  private ctx: IWaveSpawnerContext;

  constructor(ctx: IWaveSpawnerContext) {
    this.ctx = ctx;
  }

  public spawnWave(params: SpawnWaveParams): SpawnWaveResult | null {
    const islands = this.ctx.getIslands();
    if (islands.length === 0) return null;

    const monsters = this.ctx.getMonsters();
    const scaling = getDynamicScalingProfile(params.onlineCount);
    const waveNum = params.waveCount + params.bossWaveCount;
    const unlockedCount = islands.filter((i) => i.unlocked).length;
    const regularTemplates = getRegularMonsterTemplates(waveNum);

    const territoryBonus = Math.floor(
      Math.max(0, unlockedCount - 1) * WAVE_SPAWN_SCALING_CONFIG.extraCountPerUnlockedTerritory
    );
    const waveBonus = Math.floor(
      Math.max(0, waveNum - 1) * WAVE_SPAWN_SCALING_CONFIG.extraCountPerWave
    );
    const initialCount = params.isBossWave
      ? WAVE_SPAWN_SCALING_CONFIG.baseBossWaveMinionCount
      : WAVE_SPAWN_SCALING_CONFIG.baseRegularCount;
    const baseCount = Math.min(
      WAVE_SPAWN_SCALING_CONFIG.maxBaseCountBeforeOnlineScaling,
      initialCount + territoryBonus + waveBonus
    );
    const countToSpawn = Math.max(3, Math.round(baseCount * scaling.countMultiplier));
    const jitterRange = MAP_OUTER_SPAWN_CONFIG.jitterPx * 2;
    let firstTerritoryName = islands[0].name;

    for (let i = 0; i < countToSpawn; i++) {
      const sp = pickRandomMapEdgeSpawn(islands);
      if (!sp) continue;
      if (i === 0) {
        firstTerritoryName = sp.territory.name;
      }

      const template = regularTemplates[i % regularTemplates.length];
      const jitterX = (Math.random() - 0.5) * jitterRange;
      const jitterY = (Math.random() - 0.5) * jitterRange;
      const spawnX = sp.spawnX + jitterX;
      const spawnY = sp.spawnY + jitterY;
      const targetCore = getTerritoryCorePos(sp.territory.gridX, sp.territory.gridY);
      const diffHp = params.difficultyHpMultiplier ?? 1;
      const diffAtk = params.difficultyAttackMultiplier ?? 1;
      const scaledHp = Math.round(template.hp * scaling.hpMultiplier * diffHp);
      const scaledAttack = Math.round(template.attack * scaling.attackMultiplier * diffAtk);

      const monster: Monster = {
        id: `m_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        type: template.type,
        name: template.name,
        isBoss: false,
        x: spawnX,
        y: spawnY,
        hp: scaledHp,
        maxHp: scaledHp,
        attack: scaledAttack,
        speed: template.speed,
        targetTerritoryId: sp.territory.id,
        spawnTerritoryId: sp.territory.id,
        direction: spawnX > targetCore.x ? 'left' : 'right',
      };
      monsters.set(monster.id, MonsterVisualManager.create(this.ctx.scene, monster));
    }

    // 60분 주기 보스몬스터 출현 (src/data/waves.ts BOSS_MONSTER_TEMPLATES 기반 + 접속자 수 스케일링)
    let spawnedBossName = '';
    let bossDirectionLabel = '';
    if (params.isBossWave) {
      const bossSpawn = pickRandomMapEdgeSpawn(islands);
      if (bossSpawn) {
        const bossTemplate = getBossMonsterTemplate(params.bossWaveCount);
        const diffHp = params.difficultyHpMultiplier ?? 1;
        const diffAtk = params.difficultyAttackMultiplier ?? 1;
        const bossHp = Math.round(bossTemplate.hp * scaling.hpMultiplier * diffHp);
        const bossAttack = Math.round(bossTemplate.attack * scaling.attackMultiplier * diffAtk);
        const bossCore = getTerritoryCorePos(bossSpawn.territory.gridX, bossSpawn.territory.gridY);
        spawnedBossName = bossTemplate.name;
        bossDirectionLabel = bossSpawn.directionLabel;
        firstTerritoryName = bossSpawn.territory.name;

        const bossMonster: Monster = {
          id: `boss_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: bossTemplate.type,
          name: bossTemplate.name,
          isBoss: true,
          bossTemplateId: bossTemplate.templateId,
          bossSkillId: bossTemplate.skillId,
          bossSpriteKey: bossTemplate.spriteKey,
          bossTintHex: bossTemplate.tintHex,
          bossScale: bossTemplate.scale,
          x: bossSpawn.spawnX,
          y: bossSpawn.spawnY,
          hp: bossHp,
          maxHp: bossHp,
          attack: bossAttack,
          speed: bossTemplate.speed,
          targetTerritoryId: bossSpawn.territory.id,
          spawnTerritoryId: bossSpawn.territory.id,
          direction: bossSpawn.spawnX > bossCore.x ? 'left' : 'right',
        };
        monsters.set(bossMonster.id, MonsterVisualManager.create(this.ctx.scene, bossMonster));
      }
    }

    return {
      firstTerritoryName,
      spawnedBossName,
      bossDirectionLabel,
      scalingLabel: scaling.label,
    };
  }

  public applyRemoteSync(incomingList: Monster[]): void {
    const monsters = this.ctx.getMonsters();
    const incomingIds = new Set(incomingList.map((m) => m.id));
    const now = performance.now();

    for (const [id, mv] of monsters.entries()) {
      if (!incomingIds.has(id)) {
        this.ctx.playExplosionAt(mv.container.x, mv.container.y);
        mv.container.destroy();
        monsters.delete(id);
      }
    }

    for (const incoming of incomingList) {
      if (incoming.hp <= 0) continue;
      const existing = monsters.get(incoming.id);
      if (existing) {
        const m = existing.monster;
        const prevHp = m.hp;
        const prevShield = m.shieldHp ?? 0;
        m.x = incoming.x;
        m.y = incoming.y;
        m.hp = incoming.hp;
        m.maxHp = incoming.maxHp;
        m.direction = incoming.direction;
        m.targetTerritoryId = incoming.targetTerritoryId;

        if ((incoming.shieldHp ?? 0) > 0) {
          m.shieldHp = incoming.shieldHp;
          m.shieldMaxHp = incoming.shieldMaxHp ?? Math.max(m.shieldMaxHp ?? 0, incoming.shieldHp ?? 0);
          m.shieldUntil = now + 5000;
        } else if (prevShield > 0) {
          m.shieldHp = 0;
          m.shieldUntil = 0;
        }

        existing.container.setPosition(incoming.x, incoming.y);
        setDepthIfChanged(existing.container, ySortDepth(incoming.y, 28));
        existing.sprite.setFlipX(incoming.direction === 'left');

        if (incoming.hp < prevHp) {
          this.ctx.shakeObject(existing.container);
          MonsterVisualManager.updateHpBar(existing, true);
        } else if (incoming.hp !== prevHp || (incoming.shieldHp ?? 0) !== prevShield) {
          MonsterVisualManager.updateHpBar(existing, false);
        }
      } else {
        const cloned: Monster = { ...incoming };
        monsters.set(cloned.id, MonsterVisualManager.create(this.ctx.scene, cloned));
      }
    }
  }
}
