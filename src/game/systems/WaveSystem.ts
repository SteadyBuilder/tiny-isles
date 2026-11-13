import {
  ConstructedBuilding,
  Island,
  Monster,
  WaveState,
} from '../../types/game';
import {
  BOSS_WAVE_INTERVAL_SEC,
  getTerritoryCorePos,
  REGULAR_WAVE_INTERVAL_SEC,
} from '../constants';
import { EventBus } from '../phaser/EventBus';
import { ySortDepth } from '../depthLayers';
import { sound } from '../../lib/sound';
import {
  findNextInwardTargetTerritory,
  getOuterPerimeterSpawns,
  getRegularMonsterTemplates,
} from '../utils/waveUtils';
import { CoreGemSystem } from './CoreGemSystem';
import { MonsterVisual, MonsterVisualManager } from './MonsterVisualManager';

export type { MonsterVisual };

export interface IWaveSystemContext {
  scene: Phaser.Scene;
  getIslands: () => Island[];
  getConstructedBuildings: () => ConstructedBuilding[];
  destroyConstructedBuilding: (buildingId: string) => void;
  updateConstructedBuildingHpBar: (buildingId: string) => void;
  getConstructedVisualContainer: (buildingId: string) => Phaser.GameObjects.Container | undefined;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
  shakeObject: (target: Phaser.GameObjects.Container) => void;
  playExplosionAt: (x: number, y: number) => void;
  addRewardResources: (wood: number, stone: number, gold: number) => void;
  broadcastWaveSpawn?: (isBossWave: boolean) => void;
}

/**
 * 현실 시간 30분 마물 침공 및 60분 보스 타이머, 최외곽 둘레 스폰, 몬스터 3단계 AI 전담 시스템
 */
export class WaveSystem {
  private ctx: IWaveSystemContext;
  private coreGemSystem: CoreGemSystem;
  private monsters = new Map<string, MonsterVisual>();
  private waveTimerAccum = 0;

  private waveState: WaveState = {
    regularWaveIntervalSec: REGULAR_WAVE_INTERVAL_SEC,
    bossWaveIntervalSec: BOSS_WAVE_INTERVAL_SEC,
    regularWaveRemainingSec: REGULAR_WAVE_INTERVAL_SEC,
    bossWaveRemainingSec: BOSS_WAVE_INTERVAL_SEC,
    waveCount: 0,
    bossWaveCount: 0,
    activeMonstersCount: 0,
    activeBoss: null,
    lastWaveMessage: null,
    timeScale: 1.0,
  };

  constructor(ctx: IWaveSystemContext, coreGemSystem: CoreGemSystem) {
    this.ctx = ctx;
    this.coreGemSystem = coreGemSystem;
    this.setupListeners();
  }

  private setupListeners() {
    EventBus.on('territory-lost', (data: { territoryId: number }) => {
      this.handleTerritoryLost(data.territoryId);
    });
  }

  public getWaveState(): WaveState {
    return { ...this.waveState };
  }

  public getMonsters(): Monster[] {
    return Array.from(this.monsters.values()).map((m) => m.monster);
  }

  public getMonsterVisuals(): Map<string, MonsterVisual> {
    return this.monsters;
  }

  public setTimeScale(scale: number) {
    this.waveState.timeScale = scale;
    this.emitWaveState();
  }

  public triggerRegularWave() {
    this.spawnMonsterWave(false, true);
  }

  public triggerBossWave() {
    this.spawnMonsterWave(true, true);
  }

  public emitWaveState() {
    this.waveState.activeMonstersCount = this.monsters.size;
    let bossInfo = null;
    const islands = this.ctx.getIslands();

    for (const mv of this.monsters.values()) {
      if (mv.monster.isBoss && mv.monster.hp > 0) {
        const targetIsl = islands.find((i) => i.id === mv.monster.targetTerritoryId);
        bossInfo = {
          id: mv.monster.id,
          name: mv.monster.name,
          hp: mv.monster.hp,
          maxHp: mv.monster.maxHp,
          targetTerritoryName: targetIsl ? targetIsl.name : '중심 마을',
        };
        break;
      }
    }
    this.waveState.activeBoss = bossInfo;
    EventBus.emit('wave-state-updated', { ...this.waveState });
  }

  public update(time: number, delta: number) {
    this.updateWaveTimers(delta);
    this.updateMonsters(time, delta);
  }

  private updateWaveTimers(delta: number) {
    this.waveTimerAccum += delta * this.waveState.timeScale;
    if (this.waveTimerAccum >= 1000) {
      const elapsedSec = Math.floor(this.waveTimerAccum / 1000);
      this.waveTimerAccum -= elapsedSec * 1000;

      this.waveState.regularWaveRemainingSec = Math.max(
        0,
        this.waveState.regularWaveRemainingSec - elapsedSec
      );
      this.waveState.bossWaveRemainingSec = Math.max(
        0,
        this.waveState.bossWaveRemainingSec - elapsedSec
      );

      if (this.waveState.regularWaveRemainingSec <= 0) {
        this.spawnMonsterWave(false, true);
      }
      if (this.waveState.bossWaveRemainingSec <= 0) {
        this.spawnMonsterWave(true, true);
      }
      this.emitWaveState();
    }
  }

  private updateMonsters(time: number, delta: number) {
    const dt = delta / 1000;
    const islands = this.ctx.getIslands();
    const constructedBuildings = this.ctx.getConstructedBuildings();

    for (const mv of this.monsters.values()) {
      const m = mv.monster;

      // 타겟 영지가 이미 상실된 경우 다음 안쪽 영지(중심 마을 방향)로 재설정
      let targetIsl = islands.find((i) => i.id === m.targetTerritoryId && i.unlocked);
      if (!targetIsl) {
        m.targetTerritoryId = findNextInwardTargetTerritory(m.x, m.y, islands);
        targetIsl = islands.find((i) => i.id === m.targetTerritoryId) || islands[0];
      }

      const corePos = getTerritoryCorePos(targetIsl.gridX, targetIsl.gridY);

      // 1순위: 진입 경로 상의 성벽/나무 방책 장애물 탐색
      let blockingBuilding: ConstructedBuilding | null = null;
      let minBldDist = 90;
      for (const cb of constructedBuildings) {
        if (cb.territoryId === targetIsl.id && cb.hp > 0) {
          const d = Math.hypot(m.x - cb.x, m.y - cb.y);
          const threshold = cb.category === 'wall' ? 135 : 85;
          if (d < threshold && d < minBldDist) {
            minBldDist = d;
            blockingBuilding = cb;
          }
        }
      }

      const targetX = blockingBuilding ? blockingBuilding.x : corePos.x;
      const targetY = blockingBuilding ? blockingBuilding.y : corePos.y;
      const distToTarget = Math.hypot(targetX - m.x, targetY - m.y);
      const attackRange = blockingBuilding ? 52 : 56;

      if (distToTarget > attackRange) {
        const vx = ((targetX - m.x) / distToTarget) * m.speed;
        const vy = ((targetY - m.y) / distToTarget) * m.speed;
        m.x += vx * dt;
        m.y += vy * dt;
        m.direction = vx < 0 ? 'left' : 'right';

        mv.container.setPosition(m.x, m.y);
        mv.container.setDepth(ySortDepth(m.y, 28));
        mv.sprite.setFlipX(m.direction === 'left');
      } else {
        // 공격 범위 진입: 방책 타격 or 코어 보석 타격!
        if (time - mv.lastAttackTime >= 1100) {
          mv.lastAttackTime = time;
          this.ctx.shakeObject(mv.container);

          if (blockingBuilding) {
            blockingBuilding.hp = Math.max(0, blockingBuilding.hp - m.attack);
            this.ctx.updateConstructedBuildingHpBar(blockingBuilding.id);
            const bCont = this.ctx.getConstructedVisualContainer(blockingBuilding.id);
            if (bCont) this.ctx.shakeObject(bCont);

            this.ctx.showFloatingText(
              blockingBuilding.x,
              blockingBuilding.y - 30,
              `🛡️ -${m.attack}`,
              '#fb923c'
            );

            if (blockingBuilding.hp <= 0) {
              this.ctx.destroyConstructedBuilding(blockingBuilding.id);
            }
          } else {
            // 2순위: 점령 영지의 코어 보석 직접 공격
            this.coreGemSystem.damageTerritoryCore(targetIsl.id, m.attack, m.name, false);
          }
        }
      }
    }
  }

  public spawnMonsterWave(isBossWave: boolean, isLocalTrigger = true) {
    const islands = this.ctx.getIslands();
    const outerSpawns = getOuterPerimeterSpawns(islands);
    if (outerSpawns.length === 0) return;

    if (isBossWave) {
      this.waveState.bossWaveCount += 1;
      this.waveState.bossWaveRemainingSec = BOSS_WAVE_INTERVAL_SEC;
    } else {
      this.waveState.waveCount += 1;
      this.waveState.regularWaveRemainingSec = REGULAR_WAVE_INTERVAL_SEC;
    }

    const waveNum = this.waveState.waveCount + this.waveState.bossWaveCount;
    const regularTemplates = getRegularMonsterTemplates(waveNum);
    const countToSpawn = isBossWave ? 6 : 5;

    for (let i = 0; i < countToSpawn; i++) {
      const sp = outerSpawns[i % outerSpawns.length];
      const template = regularTemplates[i % regularTemplates.length];
      const jitterX = (Math.random() - 0.5) * 70;
      const jitterY = (Math.random() - 0.5) * 70;

      const monster: Monster = {
        id: `m_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        type: template.type,
        name: template.name,
        isBoss: false,
        x: sp.spawnX + jitterX,
        y: sp.spawnY + jitterY,
        hp: template.hp,
        maxHp: template.hp,
        attack: template.attack,
        speed: template.speed,
        targetTerritoryId: sp.territory.id,
        spawnTerritoryId: sp.territory.id,
        direction: sp.spawnX > 320 ? 'left' : 'right',
      };
      const mv = MonsterVisualManager.create(this.ctx.scene, monster);
      this.monsters.set(monster.id, mv);
    }

    // 60분 주기 보스몬스터 출현
    if (isBossWave) {
      const bossSpawn = outerSpawns[0];
      const bossHp = 550 + this.waveState.bossWaveCount * 150;
      const bossMonster: Monster = {
        id: `boss_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'boss_deathlord',
        name: `👹 심연의 데스로드 (60분 보스 Lv.${this.waveState.bossWaveCount})`,
        isBoss: true,
        x: bossSpawn.spawnX,
        y: bossSpawn.spawnY,
        hp: bossHp,
        maxHp: bossHp,
        attack: 42 + this.waveState.bossWaveCount * 8,
        speed: 42,
        targetTerritoryId: bossSpawn.territory.id,
        spawnTerritoryId: bossSpawn.territory.id,
        direction: bossSpawn.spawnX > 320 ? 'left' : 'right',
      };
      const bossMv = MonsterVisualManager.create(this.ctx.scene, bossMonster);
      this.monsters.set(bossMonster.id, bossMv);
    }

    const firstTerritoryName = outerSpawns[0].territory.name;
    const alertMsg = isBossWave
      ? `👹 [60분 보스 출현!] 외곽 영지(${firstTerritoryName})에서 '심연의 데스로드'와 언데드 군단이 중심부를 노리고 침공합니다!`
      : `🧟 [30분 마물 침공!] 외곽 영지(${firstTerritoryName}) 경계에서 좀비와 스켈레톤 웨이브가 진입했습니다!`;

    this.waveState.lastWaveMessage = alertMsg;
    sound.playBreak();
    EventBus.emit('game-alert', alertMsg);
    this.emitWaveState();

    if (isLocalTrigger && this.ctx.broadcastWaveSpawn) {
      this.ctx.broadcastWaveSpawn(isBossWave);
    }
  }

  public damageMonster(monsterId: string, damage: number, _sourceName = '타워') {
    const mv = this.monsters.get(monsterId);
    if (!mv) return;

    mv.monster.hp = Math.max(0, mv.monster.hp - damage);
    this.ctx.shakeObject(mv.container);
    MonsterVisualManager.updateHpBar(mv);

    this.ctx.showFloatingText(
      mv.monster.x,
      mv.monster.y - 25,
      `-${damage}`,
      mv.monster.isBoss ? '#f43f5e' : '#fbbf24'
    );

    if (mv.monster.hp <= 0) {
      const deadM = mv.monster;
      this.ctx.playExplosionAt(deadM.x, deadM.y);
      mv.container.destroy();
      this.monsters.delete(monsterId);

      const rewardWood = deadM.isBoss ? 25 : 3;
      const rewardStone = deadM.isBoss ? 25 : 3;
      const rewardGold = deadM.isBoss ? 35 : 4;

      this.ctx.addRewardResources(rewardWood, rewardStone, rewardGold);

      sound.playUnlock();
      const rewardText = deadM.isBoss
        ? `🏆 보스 처치! (+🪵${rewardWood} +🪨${rewardStone} +🪙${rewardGold})`
        : `⚔️ 마물 처치! (+🪵${rewardWood} +🪨${rewardStone} +🪙${rewardGold})`;
      this.ctx.showFloatingText(deadM.x, deadM.y - 45, rewardText, '#4ade80');
      this.emitWaveState();
    }
  }

  public handleTerritoryLost(territoryId: number) {
    const islands = this.ctx.getIslands();
    for (const mv of this.monsters.values()) {
      if (mv.monster.targetTerritoryId === territoryId) {
        mv.monster.targetTerritoryId = findNextInwardTargetTerritory(
          mv.monster.x,
          mv.monster.y,
          islands
        );
      }
    }
    this.emitWaveState();
  }
}
