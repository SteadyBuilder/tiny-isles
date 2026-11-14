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
import { ACTIVE_WAVE_ACCELERATION_CONFIG } from '../../data/worldRules';
import { EventBus } from '../phaser/EventBus';
import { ySortDepth } from '../depthLayers';
import { sound } from '../../lib/sound';
import {
  findNextInwardTargetTerritory,
  getBossMonsterTemplate,
  getOuterPerimeterSpawns,
  getRegularMonsterTemplates,
} from '../utils/waveUtils';
import {
  getDynamicScalingProfile,
  getGlobalClockRemainingSec,
} from '../utils/worldClockUtils';
import { CoreGemSystem } from './CoreGemSystem';
import { MonsterVisual, MonsterVisualManager } from './MonsterVisualManager';
import {
  getWallCollisionBoxes,
  nearestPointOnCollisionBox,
} from '../wallCollisionGeometry';

export type { MonsterVisual };

export interface IWaveSystemContext {
  scene: Phaser.Scene;
  getIslands: () => Island[];
  getConstructedBuildings: () => ConstructedBuilding[];
  destroyConstructedBuilding: (buildingId: string) => void;
  updateConstructedBuildingHpBar: (buildingId: string) => void;
  onBuildingDamaged?: () => void;
  getConstructedVisualContainer: (buildingId: string) => Phaser.GameObjects.Container | undefined;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
  shakeObject: (target: Phaser.GameObjects.Container) => void;
  playExplosionAt: (x: number, y: number) => void;
  addRewardResources: (wood: number, stone: number, gold: number) => void;
  broadcastWaveSpawn?: (isBossWave: boolean) => void;
}

/**
 * 글로벌 시계 기반 30분/60분 침공 타이머, 접속자 수 동적 스케일링, 조기 소환 및 몬스터 AI 시스템
 */
export class WaveSystem {
  private ctx: IWaveSystemContext;
  private coreGemSystem: CoreGemSystem;
  private monsters = new Map<string, MonsterVisual>();
  private waveTimerAccum = 0;
  private onlineCount = 1;
  private activeBonusMultiplier = 1.0;

  private waveState: WaveState = {
    regularWaveIntervalSec: REGULAR_WAVE_INTERVAL_SEC,
    bossWaveIntervalSec: BOSS_WAVE_INTERVAL_SEC,
    regularWaveRemainingSec: getGlobalClockRemainingSec(Date.now(), REGULAR_WAVE_INTERVAL_SEC),
    bossWaveRemainingSec: getGlobalClockRemainingSec(Date.now(), BOSS_WAVE_INTERVAL_SEC),
    waveCount: 0,
    bossWaveCount: 0,
    activeMonstersCount: 0,
    activeBoss: null,
    lastWaveMessage: null,
    timeScale: 1.0,
    onlineScaleLabel: getDynamicScalingProfile(1).label,
    activeGarrisonCount: 0,
    isGlobalClockSynced: true,
  };

  private onTerritoryLost = (data: { territoryId: number }) => {
    this.handleTerritoryLost(data.territoryId);
  };

  constructor(ctx: IWaveSystemContext, coreGemSystem: CoreGemSystem) {
    this.ctx = ctx;
    this.coreGemSystem = coreGemSystem;
    this.setupListeners();
  }

  private setupListeners() {
    EventBus.on('territory-lost', this.onTerritoryLost);
  }

  public destroy(): void {
    EventBus.off('territory-lost', this.onTerritoryLost);
    for (const mv of this.monsters.values()) {
      mv.container.destroy();
    }
    this.monsters.clear();
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

  public setOnlineCount(count: number) {
    this.onlineCount = Math.max(1, count);
    this.waveState.onlineScaleLabel = getDynamicScalingProfile(this.onlineCount).label;
    this.emitWaveState();
  }

  public setActiveGarrisonCount(count: number) {
    this.waveState.activeGarrisonCount = Math.max(0, count);
    this.emitWaveState();
  }

  public syncCountsFromWorldState(waveCount: number, bossWaveCount: number) {
    this.waveState.waveCount = Math.max(this.waveState.waveCount, waveCount);
    this.waveState.bossWaveCount = Math.max(this.waveState.bossWaveCount, bossWaveCount);
    this.waveState.regularWaveRemainingSec = getGlobalClockRemainingSec(
      Date.now(),
      REGULAR_WAVE_INTERVAL_SEC
    );
    this.waveState.bossWaveRemainingSec = getGlobalClockRemainingSec(
      Date.now(),
      BOSS_WAVE_INTERVAL_SEC
    );
    this.emitWaveState();
  }

  /**
   * 자원 채집 또는 건설 시 다음 웨이브 대기 시간을 단축 (능동적 가속)
   */
  public reduceCooldown(seconds: number) {
    if (seconds <= 0) return;
    this.waveState.regularWaveRemainingSec = Math.max(
      1,
      this.waveState.regularWaveRemainingSec - seconds
    );
    this.waveState.bossWaveRemainingSec = Math.max(
      1,
      this.waveState.bossWaveRemainingSec - seconds
    );
    this.emitWaveState();
  }

  /**
   * 준비된 플레이어가 웨이브를 즉시 소환 (처치 보상 보너스 적용)
   */
  public summonEarlyWave(isBossWave: boolean) {
    this.activeBonusMultiplier = ACTIVE_WAVE_ACCELERATION_CONFIG.earlySummonRewardMultiplier;
    this.spawnMonsterWave(isBossWave, true, true);
  }

  public triggerRegularWave() {
    this.activeBonusMultiplier = 1.0;
    this.spawnMonsterWave(false, true, false);
  }

  public triggerBossWave() {
    this.activeBonusMultiplier = 1.0;
    this.spawnMonsterWave(true, true, false);
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
        this.activeBonusMultiplier = 1.0;
        this.spawnMonsterWave(false, true, false);
      }
      if (this.waveState.bossWaveRemainingSec <= 0) {
        this.activeBonusMultiplier = 1.0;
        this.spawnMonsterWave(true, true, false);
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

      // 1순위: 진입 경로 상의 성벽/나무 방책 장애물 탐색 (날개 벽체 및 성문 전체 구간 판정)
      let blockingBuilding: ConstructedBuilding | null = null;
      let blockingTargetX = corePos.x;
      let blockingTargetY = corePos.y;
      let minBldDist = 96;
      for (const cb of constructedBuildings) {
        if (cb.territoryId === targetIsl.id && cb.hp > 0) {
          const wallBoxes = cb.category === 'wall' ? getWallCollisionBoxes(cb) : [];
          let nearestX = cb.x;
          let nearestY = cb.y;
          let d = Math.hypot(m.x - cb.x, m.y - cb.y);

          if (wallBoxes.length > 0) {
            for (const box of wallBoxes) {
              const hit = nearestPointOnCollisionBox(m.x, m.y, box);
              if (hit.dist < d) {
                d = hit.dist;
                nearestX = hit.x;
                nearestY = hit.y;
              }
            }
          }

          const threshold = cb.category === 'wall' ? 96 : 85;
          if (d < threshold && d < minBldDist) {
            minBldDist = d;
            blockingBuilding = cb;
            blockingTargetX = nearestX;
            blockingTargetY = nearestY;
          }
        }
      }

      const targetX = blockingBuilding ? blockingTargetX : corePos.x;
      const targetY = blockingBuilding ? blockingTargetY : corePos.y;
      const distToTarget = Math.hypot(targetX - m.x, targetY - m.y);
      const attackRange = blockingBuilding
        ? blockingBuilding.category === 'wall'
          ? 36
          : 52
        : 56;

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
              targetX,
              targetY - 30,
              `🛡️ -${m.attack}`,
              '#fb923c'
            );

            if (blockingBuilding.hp <= 0) {
              this.ctx.destroyConstructedBuilding(blockingBuilding.id);
            } else {
              this.ctx.onBuildingDamaged?.();
            }
          } else {
            // 2순위: 점령 영지의 코어 보석 직접 공격
            this.coreGemSystem.damageTerritoryCore(targetIsl.id, m.attack, m.name, false);
          }
        }
      }
    }
  }

  public spawnMonsterWave(isBossWave: boolean, isLocalTrigger = true, isEarlySummon = false) {
    const islands = this.ctx.getIslands();
    const outerSpawns = getOuterPerimeterSpawns(islands);
    if (outerSpawns.length === 0) return;

    if (isBossWave) {
      this.waveState.bossWaveCount += 1;
      this.waveState.bossWaveRemainingSec = getGlobalClockRemainingSec(
        Date.now(),
        BOSS_WAVE_INTERVAL_SEC
      );
    } else {
      this.waveState.waveCount += 1;
      this.waveState.regularWaveRemainingSec = getGlobalClockRemainingSec(
        Date.now(),
        REGULAR_WAVE_INTERVAL_SEC
      );
    }

    const scaling = getDynamicScalingProfile(this.onlineCount);
    const waveNum = this.waveState.waveCount + this.waveState.bossWaveCount;
    const regularTemplates = getRegularMonsterTemplates(waveNum);
    const baseCount = isBossWave ? 6 : 5;
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
      const mv = MonsterVisualManager.create(this.ctx.scene, monster);
      this.monsters.set(monster.id, mv);
    }

    // 60분 주기 보스몬스터 출현 (src/data/waves.ts BOSS_MONSTER_TEMPLATES 기반 + 접속자 수 스케일링)
    let spawnedBossName = '';
    if (isBossWave) {
      const bossSpawn = outerSpawns[0];
      const bossTemplate = getBossMonsterTemplate(this.waveState.bossWaveCount);
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
      const bossMv = MonsterVisualManager.create(this.ctx.scene, bossMonster);
      this.monsters.set(bossMonster.id, bossMv);
    }

    const firstTerritoryName = outerSpawns[0].territory.name;
    const bonusSuffix = isEarlySummon ? ' (조기 소환 보상 +35%)' : '';
    const alertMsg = isBossWave
      ? `👹 [${scaling.label}] 외곽 영지(${firstTerritoryName})에서 보스 '${spawnedBossName}' 군단이 침공합니다!${bonusSuffix}`
      : `🧟 [${scaling.label}] 외곽 영지(${firstTerritoryName}) 경계에서 마물 웨이브가 진입했습니다!${bonusSuffix}`;

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

    this.ctx.showFloatingText(
      mv.monster.x,
      mv.monster.y - 25,
      `-${damage}`,
      mv.monster.isBoss ? '#f43f5e' : '#fbbf24'
    );

    if (mv.monster.hp > 0) {
      this.ctx.shakeObject(mv.container);
      MonsterVisualManager.updateHpBar(mv);
      return;
    }

    if (mv.monster.hp <= 0) {
      const deadM = mv.monster;
      this.ctx.playExplosionAt(deadM.x, deadM.y);
      mv.container.destroy();
      this.monsters.delete(monsterId);

      const bonus = this.activeBonusMultiplier;
      const rewardWood = Math.round((deadM.isBoss ? 25 : 3) * bonus);
      const rewardStone = Math.round((deadM.isBoss ? 25 : 3) * bonus);
      const rewardGold = Math.round((deadM.isBoss ? 35 : 4) * bonus);

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
