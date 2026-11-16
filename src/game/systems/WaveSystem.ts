import {
  ConstructedBuilding,
  Island,
  Monster,
  WaveState,
} from '../../types/game';
import { THREAT_WAVE_CONFIG, WORLD_CLOCK_CONFIG } from '../../data/worldRules';
import { GameEvents } from '../events/gameEvents';
import { sound } from '../../lib/sound';
import { getDynamicScalingProfile } from '../utils/worldClockUtils';
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
  getLocalPlayerId: () => string;
  getLocalPlayerPosition: () => { x: number; y: number };
  isLocalPlayerFainted: () => boolean;
  damageLocalPlayer: (damage: number, attackerName: string) => void;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
  shakeObject: (target: Phaser.GameObjects.Container) => void;
  playExplosionAt: (x: number, y: number) => void;
  addRewardResources: (wood: number, stone: number, gold: number) => void;
  broadcastWaveSpawn?: (isBossWave: boolean) => void;
  broadcastMonstersSync?: (monsters: Monster[], waveCount: number, bossWaveCount: number) => void;
  broadcastMonsterHit?: (monsterId: string, damage: number, attackerName: string) => void;
  broadcastThreatAdded?: (amount: number) => void;
  broadcastThreatSync?: (threatPercent: number, waveCount: number, bossWaveCount: number) => void;
  onMonstersChanged?: () => void;
}

function computeWavesUntilBoss(waveCount: number): number {
  const mod = waveCount % THREAT_WAVE_CONFIG.bossEveryNWaves;
  return THREAT_WAVE_CONFIG.bossEveryNWaves - mod;
}

/**
 * 활동 기반 마물 위협도(Threat %) + 난입형(Drop-in/Out) 오픈월드 웨이브 오케스트레이션 시스템
 * - 시간 경과/오프라인 상태에서는 절대 웨이브가 발생하지 않습니다.
 */
export class WaveSystem {
  private ctx: IWaveSystemContext;
  private coreGemSystem: CoreGemSystem;
  private combatAI: MonsterCombatAI;
  private spawner: WaveSpawner;
  private monsters = new Map<string, MonsterVisual>();
  private isHost = true;
  private onlineCount = 1;
  private activeBonusMultiplier = 1.0;
  private warningIssuedForCurrentCycle = false;
  private monsterSyncAccumMs = 0;
  private hadMonstersLastTick = false;

  private waveState: WaveState = {
    threatPercent: 0,
    warningThreshold: THREAT_WAVE_CONFIG.warningThreshold,
    wavesUntilBoss: THREAT_WAVE_CONFIG.bossEveryNWaves,
    waveCount: 0,
    bossWaveCount: 0,
    activeMonstersCount: 0,
    activeBoss: null,
    lastWaveMessage: null,
    onlineScaleLabel: getDynamicScalingProfile(1).label,
    activeGarrisonCount: 0,
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
      getLocalPlayerId: () => this.ctx.getLocalPlayerId(),
      getLocalPlayerPosition: () => this.ctx.getLocalPlayerPosition(),
      isLocalPlayerFainted: () => this.ctx.isLocalPlayerFainted(),
      damageLocalPlayer: (dmg, attacker) => this.ctx.damageLocalPlayer(dmg, attacker),
      onMonsterDamaged: () => {
        if (this.isHost) {
          this.ctx.broadcastMonstersSync?.(
            this.getMonsters(),
            this.waveState.waveCount,
            this.waveState.bossWaveCount
          );
        }
      },
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
    this.waveState.wavesUntilBoss = computeWavesUntilBoss(this.waveState.waveCount);
    this.emitWaveState();
  }

  /**
   * 플레이어 활동(자원 채집, 건물 건설, 새 마을 해금) 시 월드 공용 마물 위협도를 증가시킵니다.
   * - 80% 도달 시 경고 알림
   * - 100% 도달 시 웨이브 즉시 소환 (정규 N회마다 보스 웨이브)
   */
  public addThreat(amount: number, isLocalTrigger = true): void {
    if (amount <= 0) return;

    if (!this.isHost && isLocalTrigger) {
      this.ctx.broadcastThreatAdded?.(amount);
      return;
    }

    const prevThreat = this.waveState.threatPercent;
    const nextThreat = Math.min(THREAT_WAVE_CONFIG.maxThreat, prevThreat + amount);
    this.waveState.threatPercent = nextThreat;

    if (
      !this.warningIssuedForCurrentCycle &&
      prevThreat < THREAT_WAVE_CONFIG.warningThreshold &&
      nextThreat >= THREAT_WAVE_CONFIG.warningThreshold &&
      nextThreat < THREAT_WAVE_CONFIG.maxThreat
    ) {
      this.warningIssuedForCurrentCycle = true;
      const warnMsg = '⚠️ 마물 위협도가 80%에 도달했습니다! 곧 마물 대군이 몰려옵니다!';
      this.waveState.lastWaveMessage = warnMsg;
      sound.playBreak();
      GameEvents.emit('game-alert', warnMsg);
    }

    if (nextThreat >= THREAT_WAVE_CONFIG.maxThreat) {
      this.waveState.threatPercent = 0;
      this.warningIssuedForCurrentCycle = false;
      const isBossWave =
        (this.waveState.waveCount + 1) % THREAT_WAVE_CONFIG.bossEveryNWaves === 0;
      this.activeBonusMultiplier = 1.0;
      this.spawnMonsterWave(isBossWave, true, false);
      this.ctx.broadcastThreatSync?.(
        this.waveState.threatPercent,
        this.waveState.waveCount,
        this.waveState.bossWaveCount
      );
      return;
    }

    this.emitWaveState();
    if (this.isHost) {
      this.ctx.broadcastThreatSync?.(
        this.waveState.threatPercent,
        this.waveState.waveCount,
        this.waveState.bossWaveCount
      );
    }
  }

  public applyRemoteThreatSync(
    threatPercent: number,
    waveCount: number,
    bossWaveCount: number
  ): void {
    if (this.isHost) return;
    const prevThreat = this.waveState.threatPercent;
    this.waveState.threatPercent = Math.max(0, Math.min(THREAT_WAVE_CONFIG.maxThreat, threatPercent));
    this.waveState.waveCount = Math.max(this.waveState.waveCount, waveCount);
    this.waveState.bossWaveCount = Math.max(this.waveState.bossWaveCount, bossWaveCount);
    this.waveState.wavesUntilBoss = computeWavesUntilBoss(this.waveState.waveCount);

    if (
      prevThreat < THREAT_WAVE_CONFIG.warningThreshold &&
      this.waveState.threatPercent >= THREAT_WAVE_CONFIG.warningThreshold
    ) {
      GameEvents.emit('game-alert', '⚠️ 마물 위협도가 80%에 도달했습니다! 곧 마물 대군이 몰려옵니다!');
    }
    this.emitWaveState();
  }

  /**
   * 준비된 플레이어가 웨이브를 즉시 소환 (처치 보상 보너스 적용)
   */
  public summonEarlyWave(isBossWave: boolean): void {
    this.waveState.threatPercent = 0;
    this.warningIssuedForCurrentCycle = false;
    this.activeBonusMultiplier = THREAT_WAVE_CONFIG.earlySummonRewardMultiplier;
    this.spawnMonsterWave(isBossWave, true, true);
    if (this.isHost) {
      this.ctx.broadcastThreatSync?.(
        this.waveState.threatPercent,
        this.waveState.waveCount,
        this.waveState.bossWaveCount
      );
    }
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
    this.combatAI.updateMonsters(time, delta);
  }

  public spawnMonsterWave(
    isBossWave: boolean,
    isLocalTrigger = true,
    isEarlySummon = false
  ): void {
    if (isBossWave) {
      this.waveState.bossWaveCount += 1;
      this.waveState.waveCount += 1;
    } else {
      this.waveState.waveCount += 1;
    }
    this.waveState.wavesUntilBoss = computeWavesUntilBoss(this.waveState.waveCount);

    const result = this.spawner.spawnWave({
      isBossWave,
      onlineCount: this.onlineCount,
      waveCount: this.waveState.waveCount,
      bossWaveCount: this.waveState.bossWaveCount,
    });
    if (!result) return;

    const bonusSuffix = isEarlySummon ? ' (조기 소환 보상 +35%)' : '';
    const bossOrigin = result.bossDirectionLabel || '지도 외곽';
    const alertMsg = isBossWave
      ? `👹 [${result.scalingLabel}] ${bossOrigin}에서 보스 '${result.spawnedBossName}' 군단이 동·서·남·북으로 침공합니다!${bonusSuffix}`
      : `🧟 [${result.scalingLabel}] 지도 외곽(동·서·남·북)에서 마물 웨이브가 진격을 시작했습니다!${bonusSuffix}`;

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

  public applyRemoteMonstersSync(
    monsters: Monster[],
    waveCount: number,
    bossWaveCount: number
  ): void {
    if (this.isHost) return;
    this.waveState.waveCount = Math.max(this.waveState.waveCount, waveCount);
    this.waveState.bossWaveCount = Math.max(this.waveState.bossWaveCount, bossWaveCount);
    this.waveState.wavesUntilBoss = computeWavesUntilBoss(this.waveState.waveCount);
    this.spawner.applyRemoteSync(monsters);
    this.emitWaveState();
  }

  public damageMonster(
    monsterId: string,
    damage: number,
    sourceName = '타워',
    fromRemote = false,
    attackerId?: string
  ): void {
    const killed = this.combatAI.damageMonster({
      monsterId,
      damage,
      sourceName,
      attackerId,
      fromRemote,
      isHost: this.isHost,
      bonusMultiplier: this.activeBonusMultiplier,
    });
    if (killed) {
      this.emitWaveState();
      if (this.isHost) {
        this.ctx.broadcastMonstersSync?.(
          this.getMonsters(),
          this.waveState.waveCount,
          this.waveState.bossWaveCount
        );
        this.ctx.onMonstersChanged?.();
      }
    }
  }

  public handleTerritoryLost(territoryId: number): void {
    this.combatAI.retargetFromLostTerritory(territoryId);
    this.emitWaveState();
  }
}
