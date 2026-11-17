import { CombatHitFeedbackOptions } from '../../types/combat';
import {
  ConstructedBuilding,
  DungeonPortalState,
  Island,
  Monster,
  WaveState,
} from '../../types/game';
import { MissionDifficultyConfig } from '../../types/room';
import { THREAT_WAVE_CONFIG, WORLD_CLOCK_CONFIG } from '../../data/worldRules';
import { GameEvents } from '../events/gameEvents';
import { sound } from '../../lib/sound';
import { getDynamicScalingProfile } from '../utils/worldClockUtils';
import { CoreGemSystem } from './CoreGemSystem';
import { DungeonInvasionSpawner } from './DungeonInvasionSpawner';
import { MonsterCombatAI } from './MonsterCombatAI';
import { MonsterVisual, MonsterVisualManager } from './MonsterVisualManager';
import { ProjectileSystem } from './ProjectileSystem';
import { WaveSpawner } from './WaveSpawner';

export type { MonsterVisual };

export interface IWaveSystemContext {
  scene: Phaser.Scene;
  isHuntingMode?: () => boolean;
  getDifficultyConfig?: () => MissionDifficultyConfig;
  projectileSystem?: ProjectileSystem;
  healCampCore?: (territoryId: number, amount: number) => void;
  onMonsterHitImpact?: (opts: CombatHitFeedbackOptions, restoreTint?: number | null) => void;
  onMonsterKilledReward?: (
    x: number,
    y: number,
    isBoss: boolean,
    expReward: number,
    isCampMonster: boolean,
    meta?: { isElite: boolean; isFieldMonster?: boolean; campRing?: 1 | 2 | 3 | 4 }
  ) => void;
  getIslands: () => Island[];
  getConstructedBuildings: () => ConstructedBuilding[];
  destroyConstructedBuilding: (buildingId: string) => void;
  updateConstructedBuildingHpBar: (buildingId: string) => void;
  onBuildingDamaged?: (buildingId: string, hp: number, maxHp: number, damageDelta: number) => void;
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
  broadcastWaveSummonRequest?: (isBossWave: boolean, isEarlySummon: boolean) => void;
  broadcastMonstersSync?: (monsters: Monster[], waveCount: number, bossWaveCount: number) => void;
  broadcastMonsterHit?: (monsterId: string, damage: number, attackerName: string) => void;
  broadcastThreatAdded?: (amount: number) => void;
  broadcastThreatSync?: (threatPercent: number, waveCount: number, bossWaveCount: number) => void;
  emitThreatOrb?: (worldX: number, worldY: number, amount: number) => void;
  onMonstersChanged?: () => void;
}

function computeWavesUntilBoss(waveCount: number): number {
  const mod = waveCount % THREAT_WAVE_CONFIG.bossEveryNWaves;
  return THREAT_WAVE_CONFIG.bossEveryNWaves - mod;
}

/**
 * 활동 기반 마물 위협도(Threat %) + 난입형(Drop-in/Out) 오픈월드 웨이브 오케스트레이션 시스템
 * - 사냥 특화 모드에서는 위협도 100% 도달 시 '심연의 던전 게이트'가 열리며 100마리의 마물 대군이 진격합니다.
 */
export class WaveSystem {
  private ctx: IWaveSystemContext;
  private coreGemSystem: CoreGemSystem;
  private combatAI: MonsterCombatAI;
  private spawner: WaveSpawner;
  private dungeonSpawner: DungeonInvasionSpawner;
  private monsters = new Map<string, MonsterVisual>();
  private isHost = true;
  private onlineCount = 1;
  private activeBonusMultiplier = 1.0;
  private warningIssuedForCurrentCycle = false;
  private countdownRemainingMs: number | null = null;
  private monsterSyncAccumMs = 0;
  private hadMonstersLastTick = false;

  private waveState: WaveState = {
    threatPercent: 0,
    warningThreshold: THREAT_WAVE_CONFIG.warningThreshold,
    wavesUntilBoss: THREAT_WAVE_CONFIG.bossEveryNWaves,
    waveCount: 0,
    bossWaveCount: 0,
    activeMonstersCount: 0,
    countdownSecondsRemaining: null,
    nextWaveIsBoss: false,
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
      scene: this.ctx.scene,
      getMonsters: () => this.monsters,
      getIslands: () => this.ctx.getIslands(),
      getConstructedBuildings: () => this.ctx.getConstructedBuildings(),
      updateConstructedBuildingHpBar: (id) => this.ctx.updateConstructedBuildingHpBar(id),
      getConstructedVisualContainer: (id) => this.ctx.getConstructedVisualContainer(id),
      destroyConstructedBuilding: (id) => this.ctx.destroyConstructedBuilding(id),
      onBuildingDamaged: (id, hp, maxHp, damageDelta) =>
        this.ctx.onBuildingDamaged?.(id, hp, maxHp, damageDelta),
      isHost: () => this.isHost,
      damageTerritoryCore: (territoryId, dmg, attacker) =>
        this.coreGemSystem.damageTerritoryCore(territoryId, dmg, attacker, this.isHost),
      getLocalPlayerId: () => this.ctx.getLocalPlayerId(),
      getLocalPlayerPosition: () => this.ctx.getLocalPlayerPosition(),
      isLocalPlayerFainted: () => this.ctx.isLocalPlayerFainted(),
      damageLocalPlayer: (dmg, attacker) => this.ctx.damageLocalPlayer(dmg, attacker),
      healCampCore: (territoryId, amount) => this.ctx.healCampCore?.(territoryId, amount),
      projectileSystem: this.ctx.projectileSystem,
      onMonsterDamaged: () => {
        if (this.isHost) {
          this.ctx.broadcastMonstersSync?.(
            this.getMonsters(),
            this.waveState.waveCount,
            this.waveState.bossWaveCount
          );
        }
      },
      onMonsterHitImpact: (opts, restoreTint) => this.ctx.onMonsterHitImpact?.(opts, restoreTint),
      onMonsterKilled: (x, y, isBoss, expReward, isCampMonster, meta) => {
        this.ctx.onMonsterKilledReward?.(x, y, isBoss, expReward, isCampMonster, meta);
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

    this.dungeonSpawner = new DungeonInvasionSpawner({
      scene: ctx.scene,
      getMonsters: () => this.monsters,
      getIslands: () => this.ctx.getIslands(),
      playExplosionAt: (x, y) => this.ctx.playExplosionAt(x, y),
      onPulseSpawned: () => {
        this.emitWaveState();
        if (this.isHost) {
          this.ctx.broadcastMonstersSync?.(
            this.getMonsters(),
            this.waveState.waveCount,
            this.waveState.bossWaveCount
          );
        }
      },
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
    const becameHost = !this.isHost && isHost;
    this.isHost = isHost;
    if (becameHost && this.monsters.size > 0) {
      this.ctx.broadcastMonstersSync?.(
        this.getMonsters(),
        this.waveState.waveCount,
        this.waveState.bossWaveCount
      );
    }
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

  public aggroCampMonsters(campTerritoryId: number, playerId: string): void {
    this.combatAI.aggroCampMonsters(campTerritoryId, playerId);
  }

  public getDungeonPortalState(): DungeonPortalState | null {
    return this.dungeonSpawner.getPortalState();
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

    if (this.countdownRemainingMs !== null) {
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
      sound.playWaveHorn();
      GameEvents.emit('game-alert', warnMsg);
    }

    if (nextThreat >= THREAT_WAVE_CONFIG.maxThreat) {
      const isBossWave =
        (this.waveState.waveCount + 1) % THREAT_WAVE_CONFIG.bossEveryNWaves === 0;
      const countdownSec = THREAT_WAVE_CONFIG.imminentCountdownSec;
      this.countdownRemainingMs = countdownSec * 1000;
      this.waveState.countdownSecondsRemaining = countdownSec;
      this.waveState.nextWaveIsBoss = isBossWave;
      const warnMsg = `⏳ 마물 위협도 100%! ${countdownSec}초 후 ${
        isBossWave ? '보스 군단' : '마물 웨이브'
      }이 침공합니다!`;
      this.waveState.lastWaveMessage = warnMsg;
      sound.playWaveHorn();
      GameEvents.emit('game-alert', warnMsg);
      this.emitWaveState();
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
    this.waveState.nextWaveIsBoss =
      (this.waveState.waveCount + 1) % THREAT_WAVE_CONFIG.bossEveryNWaves === 0;

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
    if (!this.isHost) {
      this.ctx.broadcastWaveSummonRequest?.(isBossWave, true);
      return;
    }

    this.countdownRemainingMs = null;
    this.waveState.countdownSecondsRemaining = null;
    this.waveState.threatPercent = 0;
    this.warningIssuedForCurrentCycle = false;
    this.activeBonusMultiplier = THREAT_WAVE_CONFIG.earlySummonRewardMultiplier;
    this.spawnMonsterWave(isBossWave, true, true);
    this.ctx.broadcastThreatSync?.(
      this.waveState.threatPercent,
      this.waveState.waveCount,
      this.waveState.bossWaveCount
    );
  }

  public triggerRegularWave(): void {
    if (!this.isHost) {
      this.ctx.broadcastWaveSummonRequest?.(false, false);
      return;
    }
    this.activeBonusMultiplier = 1.0;
    this.spawnMonsterWave(false, true, false);
  }

  public triggerBossWave(): void {
    if (!this.isHost) {
      this.ctx.broadcastWaveSummonRequest?.(true, false);
      return;
    }
    this.activeBonusMultiplier = 1.0;
    this.spawnMonsterWave(true, true, false);
  }

  public handleRemoteWaveSummonRequest(isBossWave: boolean, isEarlySummon: boolean): void {
    if (!this.isHost) return;
    if (isEarlySummon) {
      this.summonEarlyWave(isBossWave);
      return;
    }
    this.activeBonusMultiplier = 1.0;
    this.spawnMonsterWave(isBossWave, true, false);
  }

  public emitWaveState(): void {
    let activeInvaders = 0;
    for (const mv of this.monsters.values()) {
      if (!mv.monster.isCampMonster && !mv.monster.isFieldMonster) activeInvaders++;
    }
    this.waveState.activeMonstersCount = activeInvaders;
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

    if (!this.isHost) {
      this.monsterSyncAccumMs = 0;
      this.hadMonstersLastTick = this.monsters.size > 0;
      return;
    }

    if (this.countdownRemainingMs !== null) {
      this.countdownRemainingMs -= delta;
      if (this.countdownRemainingMs <= 0) {
        const spawnBoss = this.waveState.nextWaveIsBoss;
        this.countdownRemainingMs = null;
        this.waveState.countdownSecondsRemaining = null;
        this.waveState.threatPercent = 0;
        this.warningIssuedForCurrentCycle = false;
        this.activeBonusMultiplier = 1.0;
        this.spawnMonsterWave(spawnBoss, true, false);
        this.ctx.broadcastThreatSync?.(
          this.waveState.threatPercent,
          this.waveState.waveCount,
          this.waveState.bossWaveCount
        );
      } else {
        const nextSec = Math.max(1, Math.ceil(this.countdownRemainingMs / 1000));
        if (nextSec !== this.waveState.countdownSecondsRemaining) {
          this.waveState.countdownSecondsRemaining = nextSec;
          this.emitWaveState();
        }
      }
    }

    const hasInvaders = this.waveState.activeMonstersCount > 0;
    const hasCoOpMonsters = this.onlineCount > 1 && this.monsters.size > 0;
    const shouldSync = hasInvaders || hasCoOpMonsters;
    const syncInterval = hasInvaders
      ? WORLD_CLOCK_CONFIG.monsterSyncIntervalMs
      : WORLD_CLOCK_CONFIG.monsterSyncIntervalMs * 2;

    if (shouldSync) {
      this.monsterSyncAccumMs += delta;
      if (this.monsterSyncAccumMs >= syncInterval) {
        this.monsterSyncAccumMs = 0;
        this.ctx.broadcastMonstersSync?.(
          this.getMonsters(),
          this.waveState.waveCount,
          this.waveState.bossWaveCount
        );
      }
    } else if (this.hadMonstersLastTick) {
      this.monsterSyncAccumMs = 0;
      this.ctx.broadcastMonstersSync?.(
        [],
        this.waveState.waveCount,
        this.waveState.bossWaveCount
      );
    } else {
      this.monsterSyncAccumMs = 0;
    }
    this.hadMonstersLastTick = shouldSync;
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

    const bonusSuffix = isEarlySummon ? ' (조기 소환 보상 +35%)' : '';

    const diff = this.ctx.getDifficultyConfig?.();
    const diffHpMult = diff?.monsterHpMultiplier ?? 1;
    const diffAtkMult = diff?.monsterAttackMultiplier ?? 1;

    // 사냥 특화 모드: 위협도 100% 도달 시 심연의 던전 게이트 출현 -> 마물 대군 중앙 마을 진격!
    if (this.ctx.isHuntingMode?.()) {
      const dng = this.dungeonSpawner.startDungeonInvasion({
        onlineCount: this.onlineCount,
        waveCount: this.waveState.waveCount,
        bossWaveCount: this.waveState.bossWaveCount,
        difficultyId: diff?.id,
        difficultyHpMultiplier: diffHpMult,
        difficultyAttackMultiplier: diffAtkMult,
      });
      if (!dng) return;

      const dngMsg = `🌀 [${dng.scalingLabel}] ${dng.directionLabel}에 심연의 던전 게이트가 열렸습니다! 마물 ${dng.totalSpawns}마리와 수문장이 중앙 마을로 총진격합니다!${bonusSuffix}`;
      this.waveState.lastWaveMessage = dngMsg;
      sound.playBossRoar();
      GameEvents.emit('game-alert', dngMsg);
      this.emitWaveState();
      if (isLocalTrigger && this.ctx.broadcastWaveSpawn) {
        this.ctx.broadcastWaveSpawn(true);
      }
      this.ctx.onMonstersChanged?.();
      return;
    }

    const result = this.spawner.spawnWave({
      isBossWave,
      onlineCount: this.onlineCount,
      waveCount: this.waveState.waveCount,
      bossWaveCount: this.waveState.bossWaveCount,
      difficultyHpMultiplier: diffHpMult,
      difficultyAttackMultiplier: diffAtkMult,
    });
    if (!result) return;

    const bossOrigin = result.bossDirectionLabel || '지도 외곽';
    const alertMsg = isBossWave
      ? `👹 [${result.scalingLabel}] ${bossOrigin}에서 보스 '${result.spawnedBossName}' 군단이 동·서·남·북으로 침공합니다!${bonusSuffix}`
      : `🧟 [${result.scalingLabel}] 지도 외곽(동·서·남·북)에서 마물 웨이브가 진격을 시작했습니다!${bonusSuffix}`;

    this.waveState.lastWaveMessage = alertMsg;
    if (isBossWave) {
      sound.playBossRoar();
    } else {
      sound.playWaveHorn();
    }
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
    this.combatAI.pruneStaleMonsterState(new Set(this.monsters.keys()));
    this.emitWaveState();
  }

  public damageMonster(
    monsterId: string,
    damage: number,
    sourceName = '타워',
    fromRemote = false,
    attackerId?: string,
    hitMeta?: { isSkill?: boolean; isCrit?: boolean }
  ): void {
    const killed = this.combatAI.damageMonster({
      monsterId,
      damage,
      sourceName,
      attackerId,
      fromRemote,
      isHost: this.isHost,
      bonusMultiplier: this.activeBonusMultiplier,
      hitMeta,
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
