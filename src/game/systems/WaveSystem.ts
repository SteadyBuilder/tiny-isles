import { THREAT_WAVE_CONFIG } from '../../data/worldRules';
import { sound } from '../../lib/sound';
import { DungeonPortalState, Monster, WaveState } from '../../types/game';
import {
  MonsterPlayerAttackPayload,
  MonstersDeltaSyncPayload,
  MonstersFullSyncPayload,
  ThreatSyncPayload,
} from '../../types/monsterSync';
import { IWaveSystemContext } from '../../types/waveSystem';
import { GameEvents } from '../events/gameEvents';
import { MonsterSpatialGrid } from '../utils/spatialGrid';
import { getDynamicScalingProfile } from '../utils/worldClockUtils';
import { CoreGemSystem } from './CoreGemSystem';
import { DungeonInvasionSpawner } from './DungeonInvasionSpawner';
import { MonsterCombatAI } from './MonsterCombatAI';
import { MonsterVisual, MonsterVisualManager } from './MonsterVisualManager';
import { executeRemoteMonsterPlayerAttack } from './RemoteMonsterAttackHandler';
import { createWaveCombatAI } from './WaveCombatFactory';
import { WaveNetworkSyncBridge } from './WaveNetworkSyncBridge';
import { WaveSpawner } from './WaveSpawner';
import { WaveThreatTracker } from './WaveThreatTracker';

export type { IWaveSystemContext, MonsterVisual };

/**
 * 활동 기반 마물 위협도(Threat %) + 난입형(Drop-in/Out) 오픈월드 웨이브 오케스트레이션 시스템
 * - 위협도/카운트다운(WaveThreatTracker), 네트워크 동기화(WaveNetworkSyncBridge),
 *   원격 공격 연출(RemoteMonsterAttackHandler)을 조합하는 코디네이터
 */
export class WaveSystem {
  private ctx: IWaveSystemContext;
  private combatAI: MonsterCombatAI;
  private spawner: WaveSpawner;
  private dungeonSpawner: DungeonInvasionSpawner;
  private threatTracker: WaveThreatTracker;
  private syncBridge: WaveNetworkSyncBridge;
  private monsters = new Map<string, MonsterVisual>();
  private isHost: boolean;
  private onlineCount = 1;

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
    this.isHost = ctx.initialIsHost ?? true;

    this.threatTracker = new WaveThreatTracker({
      isHost: () => this.isHost,
      onWarningReached: (message, fromRemoteSync) => {
        if (!fromRemoteSync) {
          this.waveState.lastWaveMessage = message;
          sound.playWaveHorn();
        }
        GameEvents.emit('game-alert', message);
      },
      onCountdownStarted: (message) => {
        this.waveState.lastWaveMessage = message;
        sound.playWaveHorn();
        GameEvents.emit('game-alert', message);
      },
      onWaveTriggered: (isBossWave, isEarlySummon) => {
        this.spawnMonsterWave(isBossWave, true, isEarlySummon);
      },
      onBroadcastThreatAdded: (amount) => this.ctx.broadcastThreatAdded?.(amount),
      onBroadcastThreatSync: (payload) => this.ctx.broadcastThreatSync?.(payload),
      onBroadcastSummonRequest: (isBossWave, isEarlySummon) =>
        this.ctx.broadcastWaveSummonRequest?.(isBossWave, isEarlySummon),
      onStateChanged: () => this.emitWaveState(),
    });

    this.syncBridge = new WaveNetworkSyncBridge({
      isHost: () => this.isHost,
      hasActiveInvaders: () => this.waveState.activeMonstersCount > 0,
      getWaveCounts: () => ({
        waveCount: this.threatTracker.getWaveCount(),
        bossWaveCount: this.threatTracker.getBossWaveCount(),
      }),
      onSyncWaveCounts: (waveCount, bossWaveCount) =>
        this.threatTracker.applyWaveCountsFromSync(waveCount, bossWaveCount),
      broadcastFullSync: (payload) => this.ctx.broadcastMonstersSync?.(payload),
      broadcastDeltaSync: (payload) => this.ctx.broadcastMonstersDeltaSync?.(payload),
      requestMonstersSync: () => this.ctx.requestMonstersSync?.(),
    });

    this.combatAI = createWaveCombatAI({
      ctx: this.ctx,
      coreGemSystem,
      monsters: this.monsters,
      isHost: () => this.isHost,
      syncBridge: this.syncBridge,
      threatTracker: this.threatTracker,
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
        if (this.isHost && this.syncBridge.shouldBroadcastCoopMonsters()) this.flushDeltaSyncNow();
      },
      onPortalStateChanged: (portal) => {
        if (this.isHost && this.syncBridge.shouldBroadcastCoopMonsters()) {
          this.ctx.broadcastDungeonPortalSync?.(portal);
        }
      },
    });
    GameEvents.on('territory-lost', this.onTerritoryLost);
  }

  public destroy(): void {
    GameEvents.off('territory-lost', this.onTerritoryLost);
    this.combatAI.destroy();
    this.dungeonSpawner.clearTimersAndPortal(false);
    for (const mv of this.monsters.values()) MonsterVisualManager.disposeVisual(mv);
    this.monsters.clear();
    MonsterVisualManager.clearTrackedVisuals();
    this.syncBridge.destroy();
  }

  public setHostMode(isHost: boolean): void {
    const prev = this.isHost;
    this.isHost = isHost;
    if (isHost) {
      this.syncBridge.onEnterHostMode(!prev);
      return;
    }
    if (prev || this.monsters.size > 0) {
      for (const mv of this.monsters.values()) MonsterVisualManager.disposeVisual(mv);
      this.monsters.clear();
      MonsterVisualManager.clearTrackedVisuals();
      this.combatAI.pruneStaleMonsterState(new Set());
    }
    this.dungeonSpawner.clearTimersAndPortal(false);
    this.threatTracker.resetGuestTransientState();
    this.syncBridge.onEnterGuestMode();
  }

  public getIsHost(): boolean { return this.isHost; }
  public getWaveState(): WaveState {
    this.threatTracker.applyFieldsTo(this.waveState);
    return { ...this.waveState };
  }
  public getMonsters(): Monster[] { return Array.from(this.monsters.values()).map((m) => ({ ...m.monster })); }
  public getMonsterVisuals(): Map<string, MonsterVisual> { return this.monsters; }
  public getSpatialGrid(frameStamp?: number): MonsterSpatialGrid {
    const grid = this.combatAI.getSpatialGrid();
    grid.ensureFresh(this.monsters, frameStamp ?? this.ctx.scene?.time?.now ?? -1);
    return grid;
  }
  public aggroCampMonsters(campTerritoryId: number, playerId: string): void { this.combatAI.aggroCampMonsters(campTerritoryId, playerId); }
  public getDungeonPortalState(): DungeonPortalState | null { return this.dungeonSpawner.getPortalState(); }

  public setOnlineCount(count: number): void {
    const next = Math.max(1, count);
    if (next === this.onlineCount) return;
    this.onlineCount = next;
    this.syncBridge.setOnlineCount(next);
    this.waveState.onlineScaleLabel = getDynamicScalingProfile(next).label;
    this.emitWaveState();
  }

  public setActiveGarrisonCount(count: number): void {
    const next = Math.max(0, count);
    if (next === this.waveState.activeGarrisonCount) return;
    this.waveState.activeGarrisonCount = next;
    this.emitWaveState();
  }

  public syncCountsFromWorldState(waveCount: number, bossWaveCount: number): void {
    this.threatTracker.syncCountsFromWorldState(waveCount, bossWaveCount);
  }
  public addThreat(amount: number, isLocalTrigger = true): void {
    this.threatTracker.addThreat(amount, isLocalTrigger);
  }
  public applyRemoteThreatSync(payload: ThreatSyncPayload): void {
    this.threatTracker.applyRemoteThreatSync(payload);
  }
  public applyRemoteDungeonPortalSync(portal: DungeonPortalState | null): void {
    if (!this.isHost) this.dungeonSpawner.setRemotePortalState(portal);
  }
  public summonEarlyWave(isBossWave: boolean): void { this.threatTracker.summonEarlyWave(isBossWave); }
  public triggerRegularWave(): void { this.threatTracker.triggerManualWave(false); }
  public triggerBossWave(): void { this.threatTracker.triggerManualWave(true); }
  public handleRemoteWaveSummonRequest(isBossWave: boolean, isEarlySummon: boolean): void {
    this.threatTracker.handleRemoteWaveSummonRequest(isBossWave, isEarlySummon);
  }

  public emitWaveState(): void {
    let activeInvaders = 0;
    let bossInfo = null;
    const islands = this.ctx.getIslands();
    for (const mv of this.monsters.values()) {
      if (!mv.monster.isCampMonster && !mv.monster.isFieldMonster) activeInvaders++;
      if (!bossInfo && mv.monster.isBoss && mv.monster.hp > 0) {
        const targetIsl = islands.find((i) => i.id === mv.monster.targetTerritoryId);
        bossInfo = {
          id: mv.monster.id,
          name: mv.monster.name,
          hp: mv.monster.hp,
          maxHp: mv.monster.maxHp,
          targetTerritoryName: targetIsl ? targetIsl.name : '중심 마을',
        };
      }
    }
    this.waveState.activeMonstersCount = activeInvaders;
    this.waveState.activeBoss = bossInfo;
    this.threatTracker.applyFieldsTo(this.waveState);
    GameEvents.emit('wave-state-updated', { ...this.waveState });
  }

  public handleRemoteMonstersSyncRequest(): void { this.syncBridge.handleRemoteSyncRequest(this.monsters); }
  public broadcastFullMonstersSync(force = false, fromGuestRequest = false): void {
    this.syncBridge.broadcastFullMonstersSync(this.monsters, force, fromGuestRequest);
  }
  public flushDeltaSyncNow(): void { this.syncBridge.flushDeltaSyncNow(this.monsters); }

  public update(time: number, delta: number): void {
    if (!this.isHost) {
      this.syncBridge.tickGuestSync(this.monsters, delta);
      MonsterVisualManager.updateHpTrails(this.monsters, delta);
      this.threatTracker.tickCountdown(delta);
      return;
    }
    this.combatAI.updateMonsters(time, delta);
    MonsterVisualManager.updateHpTrails(this.monsters, delta);
    this.threatTracker.tickCountdown(delta);
    this.syncBridge.tickHostDeltaSync(this.monsters, delta);
  }

  public spawnMonsterWave(isBossWave: boolean, isLocalTrigger = true, isEarlySummon = false): void {
    if (!this.isHost) return;
    this.threatTracker.recordWaveSpawn(isBossWave);
    const waveCount = this.threatTracker.getWaveCount();
    const bossWaveCount = this.threatTracker.getBossWaveCount();
    const bonusSuffix = isEarlySummon ? ' (조기 소환 보상 +35%)' : '';
    const diff = this.ctx.getDifficultyConfig?.();
    const diffHpMult = diff?.monsterHpMultiplier ?? 1;
    const diffAtkMult = diff?.monsterAttackMultiplier ?? 1;

    if (this.ctx.isHuntingMode?.()) {
      const dng = this.dungeonSpawner.startDungeonInvasion({
        onlineCount: this.onlineCount, waveCount, bossWaveCount, difficultyId: diff?.id,
        difficultyHpMultiplier: diffHpMult, difficultyAttackMultiplier: diffAtkMult,
      });
      if (!dng) return;
      const dngMsg = `🌀 [${dng.scalingLabel}] ${dng.directionLabel}에 심연의 던전 게이트가 열렸습니다! 마물 ${dng.totalSpawns}마리와 수문장이 중앙 마을로 총진격합니다!${bonusSuffix}`;
      this.announceWaveSpawn(dngMsg, true, isLocalTrigger, false);
      return;
    }

    const result = this.spawner.spawnWave({
      isBossWave, onlineCount: this.onlineCount, waveCount, bossWaveCount,
      difficultyHpMultiplier: diffHpMult, difficultyAttackMultiplier: diffAtkMult,
    });
    if (!result) return;
    const bossOrigin = result.bossDirectionLabel || '지도 외곽';
    const alertMsg = isBossWave
      ? `👹 [${result.scalingLabel}] ${bossOrigin}에서 보스 '${result.spawnedBossName}' 군단이 동·서·남·북으로 침공합니다!${bonusSuffix}`
      : `🧟 [${result.scalingLabel}] 지도 외곽(동·서·남·북)에서 마물 웨이브가 진격을 시작했습니다!${bonusSuffix}`;
    this.announceWaveSpawn(alertMsg, isBossWave, isLocalTrigger, true);
  }

  private announceWaveSpawn(msg: string, isBossSound: boolean, isLocalTrigger: boolean, flushDelta: boolean): void {
    this.waveState.lastWaveMessage = msg;
    if (isBossSound) sound.playBossRoar();
    else sound.playWaveHorn();
    GameEvents.emit('game-alert', msg);
    GameEvents.emit('wave-spawned', {
      isBossWave: isBossSound,
      waveNumber: this.threatTracker.getWaveCount(),
    });
    this.emitWaveState();
    if (isLocalTrigger) this.ctx.broadcastWaveSpawn?.(isBossSound);
    if (flushDelta && this.isHost) this.flushDeltaSyncNow();
    this.ctx.onMonstersChanged?.();
  }

  public applyRemoteMonstersSync(payload: MonstersFullSyncPayload): void {
    this.syncBridge.applyRemoteFullSync(payload, (monsters) => {
      this.spawner.applyRemoteSync(monsters);
      this.combatAI.pruneStaleMonsterState(new Set(this.monsters.keys()));
      this.ctx.onMonstersChanged?.();
      this.emitWaveState();
    });
  }

  public applyRemoteMonstersDeltaSync(payload: MonstersDeltaSyncPayload): void {
    const { killedCount, spawnedCount } = this.syncBridge.applyRemoteDeltaSync(this.ctx.scene, this.monsters, payload, {
      onExplosion: (x, y) => this.ctx.playExplosionAt(x, y),
      onShake: (target) => this.ctx.shakeObject(target),
      onRemoteKill: (kill) => this.ctx.onRemoteMonsterKilledReward?.(kill),
    });
    if (spawnedCount > 0) this.ctx.onMonstersChanged?.();
    if (killedCount > 0 || spawnedCount > 0) {
      this.combatAI.pruneStaleMonsterState(new Set(this.monsters.keys()));
      this.emitWaveState();
    }
  }

  public handleRemoteMonsterPlayerAttack(payload: MonsterPlayerAttackPayload): void {
    if (this.isHost) return;
    executeRemoteMonsterPlayerAttack(payload, {
      getLocalPlayerId: () => this.ctx.getLocalPlayerId(),
      getLocalPlayerPosition: () => this.ctx.getLocalPlayerPosition(),
      isLocalPlayerFainted: () => this.ctx.isLocalPlayerFainted(),
      damageLocalPlayer: (dmg, attacker) => this.ctx.damageLocalPlayer(dmg, attacker),
      playExplosionAt: (x, y) => this.ctx.playExplosionAt(x, y),
      projectileSystem: this.ctx.projectileSystem,
      onMonsterAttackVisual: (monsterId, targetX) => {
        const mv = this.monsters.get(monsterId);
        if (mv) {
          MonsterVisualManager.playAttackAnimation(mv, targetX);
        }
      },
    });
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
      monsterId, damage, sourceName, attackerId, fromRemote, isHost: this.isHost,
      bonusMultiplier: this.threatTracker.getActiveBonusMultiplier(), hitMeta,
    });
    if (killed) {
      this.emitWaveState();
      if (this.isHost) {
        this.syncBridge.scheduleDeltaSyncFlush(() => this.monsters);
        this.ctx.onMonstersChanged?.();
      }
    }
  }

  public handleTerritoryLost(territoryId: number): void {
    this.combatAI.retargetFromLostTerritory(territoryId);
    this.emitWaveState();
  }
}
