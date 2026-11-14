import Phaser from 'phaser';
import { Island, Monster } from '../../types/game';
import {
  getBossMonsterTemplate,
  getOuterPerimeterSpawns,
  getRegularMonsterTemplates,
} from '../utils/waveUtils';
import { getDynamicScalingProfile } from '../utils/worldClockUtils';
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
}

export interface SpawnWaveResult {
  firstTerritoryName: string;
  spawnedBossName: string;
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
    const outerSpawns = getOuterPerimeterSpawns(islands);
    if (outerSpawns.length === 0) return null;

    const monsters = this.ctx.getMonsters();
    const scaling = getDynamicScalingProfile(params.onlineCount);
    const waveNum = params.waveCount + params.bossWaveCount;
    const regularTemplates = getRegularMonsterTemplates(waveNum);
    const baseCount = params.isBossWave ? 6 : 5;
    const countToSpawn = Math.max(3, Math.round(baseCount * scaling.countMultiplier));

    for (let i = 0; i < countToSpawn; i++) {
      const sp = outerSpawns[i % outerSpawns.length];
      const template = regularTemplates[i % regularTemplates.length];
      const jitterX = (Math.random() - 0.5) * 70;
      const jitterY = (Math.random() - 0.5) * 70;
      const scaledHp = Math.round(template.hp * scaling.hpMultiplier);
      const scaledAttack = Math.round(template.attack * scaling.attackMultiplier);

      const monster: Monster = {
        id: `m_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        type: template.type,
        name: template.name,
        isBoss: false,
        x: sp.spawnX + jitterX,
        y: sp.spawnY + jitterY,
        hp: scaledHp,
        maxHp: scaledHp,
        attack: scaledAttack,
        speed: template.speed,
        targetTerritoryId: sp.territory.id,
        spawnTerritoryId: sp.territory.id,
        direction: sp.spawnX > 320 ? 'left' : 'right',
      };
      monsters.set(monster.id, MonsterVisualManager.create(this.ctx.scene, monster));
    }

    // 60분 주기 보스몬스터 출현 (src/data/waves.ts BOSS_MONSTER_TEMPLATES 기반 + 접속자 수 스케일링)
    let spawnedBossName = '';
    if (params.isBossWave) {
      const bossSpawn = outerSpawns[0];
      const bossTemplate = getBossMonsterTemplate(params.bossWaveCount);
      const bossHp = Math.round(bossTemplate.hp * scaling.hpMultiplier);
      const bossAttack = Math.round(bossTemplate.attack * scaling.attackMultiplier);
      spawnedBossName = bossTemplate.name;

      const bossMonster: Monster = {
        id: `boss_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: bossTemplate.type,
        name: bossTemplate.name,
        isBoss: true,
        x: bossSpawn.spawnX,
        y: bossSpawn.spawnY,
        hp: bossHp,
        maxHp: bossHp,
        attack: bossAttack,
        speed: bossTemplate.speed,
        targetTerritoryId: bossSpawn.territory.id,
        spawnTerritoryId: bossSpawn.territory.id,
        direction: bossSpawn.spawnX > 320 ? 'left' : 'right',
      };
      monsters.set(bossMonster.id, MonsterVisualManager.create(this.ctx.scene, bossMonster));
    }

    return {
      firstTerritoryName: outerSpawns[0].territory.name,
      spawnedBossName,
      scalingLabel: scaling.label,
    };
  }

  public restoreMonsters(incoming: Monster[]): void {
    const monsters = this.ctx.getMonsters();
    for (const mv of monsters.values()) {
      mv.container.destroy();
    }
    monsters.clear();

    for (const m of incoming) {
      if (m.hp <= 0) continue;
      const cloned: Monster = { ...m };
      monsters.set(cloned.id, MonsterVisualManager.create(this.ctx.scene, cloned));
    }
  }

  public applyRemoteSync(incomingList: Monster[]): void {
    const monsters = this.ctx.getMonsters();
    const incomingIds = new Set(incomingList.map((m) => m.id));

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
        const prevHp = existing.monster.hp;
        existing.monster.x = incoming.x;
        existing.monster.y = incoming.y;
        existing.monster.hp = incoming.hp;
        existing.monster.maxHp = incoming.maxHp;
        existing.monster.direction = incoming.direction;
        existing.monster.targetTerritoryId = incoming.targetTerritoryId;
        if (incoming.hp < prevHp) {
          this.ctx.shakeObject(existing.container);
          MonsterVisualManager.updateHpBar(existing);
        }
      } else {
        const cloned: Monster = { ...incoming };
        monsters.set(cloned.id, MonsterVisualManager.create(this.ctx.scene, cloned));
      }
    }
  }
}
