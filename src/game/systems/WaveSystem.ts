import {
  ConstructedBuilding,
  Island,
  Monster,
  WaveState,
} from '../../types/game';
import {
  BOSS_WAVE_INTERVAL_SEC,
  REGULAR_WAVE_INTERVAL_SEC,
} from '../constants';
import { ACTIVE_WAVE_ACCELERATION_CONFIG } from '../../data/worldRules';
import { GameEvents } from '../events/gameEvents';
import { sound } from '../../lib/sound';
import {
  getDynamicScalingProfile,
  getGlobalClockRemainingSec,
} from '../utils/worldClockUtils';
import { CoreGemSystem } from './CoreGemSystem';
import { MonsterCombatAI } from './MonsterCombatAI';
import { MonsterVisual } from './MonsterVisualManager';
import { WaveSpawner } from './WaveSpawner';

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
  broadcastMonstersSync?: (monsters: Monster[], waveCount: number, bossWaveCount: number) => void;
  broadcastMonsterHit?: (monsterId: string, damage: number, attackerName: string) => void;
  onMonstersChanged?: () => void;
}

/**
 * 글로벌 시계 기반 30분/60분 침공 타이머, 접속자 수 동적 스케일링, 조기 소환 및 전투 오케스트레이션 시스템
 */
export class WaveSystem {
  private ctx: IWaveSystemContext;
  private coreGemSystem: CoreGemSystem;
  private combatAI: MonsterCombatAI;
  private spawner: WaveSpawner;
  private monsters = new Map<string, MonsterVisual>();
  private waveTimerAccum = 0;
  private isHost = true;
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

    this.combatAI = new MonsterCombatAI({
      getMonsters: () => this.monsters,
      getIslands: () => this.ctx.getIslands(),
      getConstructedBuildings: () => this.ctx.getConstructedBuildings(),
      updateConstructedBuildingHpBar: (id) => this.ctx.updateConstructedBuildingHpBar(id),
      getConstructedVisualContainer: (id) => this.ctx.getConstructedVisualContainer(id),
      destroyConstructedBuilding: (id) => this.ctx.destroyConstructedBuilding(id),
      onBuildingDamaged: () => this.ctx.onBuildingDamaged?.(),
      damageTerritoryCore: (territoryId, dmg, attacker) =>
        this.coreGemSystem.damageTerritoryCore(territoryId, dmg, attacker, false),
      showFloatingText: (x, y, text, color) => this.ctx.showFloatingText(x, y, text, color),
      shakeObject: (target) => this.ctx.shakeObject(target),
      playExplosionAt: (x, y) => this.ctx.playExplosionAt(x, y),
      addRewardResources: (w, s, g) => this.ctx.addRewardResources(w, s, g),
      broadcastMonsterHit: (id, dmg, atk) => this.ctx.broadcastMonsterHit?.(id, dmg, atk),
    });

    this.spawner = new WaveSpawner({
      scene: ctx.scene,
      getMonsters: () => this.monsters,
      getIslands: () => this.ctx.getIslands(),
      playExplosionAt: (x, y) => this.ctx.playExplosionAt(x, y),
      shakeObject: (target) => this.ctx.shakeObject(target),
    });

    GameEvents.on('territory-lost', this.onTerritoryLost);
  }

  public destroy(): void {
    GameEvents.off('territory-lost', this.onTerritoryLost);
    for (const mv of this.monsters.values()) {
      mv.container.destroy();
    }
    this.monsters.clear();
  }

  public setHostMode(isHost: boolean): void {
    this.isHost = isHost;
  }

  public getIsHost(): boolean {
    return this.isHost;
  }

  public getWaveState(): WaveState {
    return { ...this.waveState };
  }

  public getMonsters(): Monster[] {
    return Array.from(this.monsters.values()).map((m) => ({ ...m.monster }));
  }

  public getMonsterVisuals(): Map<string, MonsterVisual> {
    return this.monsters;
  }

  public setTimeScale(scale: number): void {
    this.waveState.timeScale = scale;
    this.emitWaveState();
  }

  public setOnlineCount(count: number): void {
    this.onlineCount = Math.max(1, count);
    this.waveState.onlineScaleLabel = getDynamicScalingProfile(this.onlineCount).label;
    this.emitWaveState();
  }

  public setActiveGarrisonCount(count: number): void {
    this.waveState.activeGarrisonCount = Math.max(0, count);
    this.emitWaveState();
  }

  public syncCountsFromWorldState(waveCount: number, bossWaveCount: number): void {
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
  public reduceCooldown(seconds: number): void {
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
  public summonEarlyWave(isBossWave: boolean): void {
    this.activeBonusMultiplier = ACTIVE_WAVE_ACCELERATION_CONFIG.earlySummonRewardMultiplier;
    this.spawnMonsterWave(isBossWave, true, true);
  }

  public triggerRegularWave(): void {
    this.activeBonusMultiplier = 1.0;
    this.spawnMonsterWave(false, true, false);
  }

  public triggerBossWave(): void {
    this.activeBonusMultiplier = 1.0;
    this.spawnMonsterWave(true, true, false);
  }

  public emitWaveState(): void {
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
    GameEvents.emit('wave-state-updated', { ...this.waveState });
  }

  public update(time: number, delta: number): void {
    this.updateWaveTimers(delta);
    this.combatAI.updateMonsters(time, delta);
  }

  private updateWaveTimers(delta: number): void {
    this.waveTimerAccum += delta * this.waveState.timeScale;
    if (this.waveTimerAccum < 1000) return;

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

  public spawnMonsterWave(
    isBossWave: boolean,
    isLocalTrigger = true,
    isEarlySummon = false
  ): void {
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

    const result = this.spawner.spawnWave({
      isBossWave,
      onlineCount: this.onlineCount,
      waveCount: this.waveState.waveCount,
      bossWaveCount: this.waveState.bossWaveCount,
    });
    if (!result) return;

    const bonusSuffix = isEarlySummon ? ' (조기 소환 보상 +35%)' : '';
    const alertMsg = isBossWave
      ? `👹 [${result.scalingLabel}] 외곽 영지(${result.firstTerritoryName})에서 보스 '${result.spawnedBossName}' 군단이 침공합니다!${bonusSuffix}`
      : `🧟 [${result.scalingLabel}] 외곽 영지(${result.firstTerritoryName}) 경계에서 마물 웨이브가 진입했습니다!${bonusSuffix}`;

    this.waveState.lastWaveMessage = alertMsg;
    sound.playBreak();
    GameEvents.emit('game-alert', alertMsg);
    this.emitWaveState();

    if (isLocalTrigger && this.ctx.broadcastWaveSpawn) {
      this.ctx.broadcastWaveSpawn(isBossWave);
    }
    if (this.isHost) {
      this.ctx.broadcastMonstersSync?.(
        this.getMonsters(),
        this.waveState.waveCount,
        this.waveState.bossWaveCount
      );
      this.ctx.onMonstersChanged?.();
    }
  }

  public restoreMonsters(monsters: Monster[]): void {
    this.spawner.restoreMonsters(monsters);
    this.emitWaveState();
  }

  public applyRemoteMonstersSync(
    monsters: Monster[],
    waveCount: number,
    bossWaveCount: number
  ): void {
    if (this.isHost) return;
    this.waveState.waveCount = Math.max(this.waveState.waveCount, waveCount);
    this.waveState.bossWaveCount = Math.max(this.waveState.bossWaveCount, bossWaveCount);
    this.spawner.applyRemoteSync(monsters);
    this.emitWaveState();
  }

  public damageMonster(
    monsterId: string,
    damage: number,
    sourceName = '타워',
    fromRemote = false
  ): void {
    const killed = this.combatAI.damageMonster({
      monsterId,
      damage,
      sourceName,
      fromRemote,
      isHost: this.isHost,
      bonusMultiplier: this.activeBonusMultiplier,
    });
    if (killed) {
      this.emitWaveState();
      if (this.isHost) {
        this.ctx.onMonstersChanged?.();
      }
    }
  }

  public handleTerritoryLost(territoryId: number): void {
    this.combatAI.retargetFromLostTerritory(territoryId);
    this.emitWaveState();
  }
}
