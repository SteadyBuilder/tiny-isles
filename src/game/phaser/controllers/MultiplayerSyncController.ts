import Phaser from 'phaser';
import {
  ConstructedBuilding,
  Monster,
  Player,
  PlayerAction,
  PlayerColor,
  VillageTier,
} from '../../../types/game';
import { RemotePlayerRenderer } from '../renderers/RemotePlayerRenderer';
import { MultiplayerChannelRouter } from './MultiplayerChannelRouter';

export interface IMultiplayerSyncContext {
  scene: Phaser.Scene;
  getPlayerId: () => string;
  getPlayerName: () => string;
  getPlayerColor: () => PlayerColor;
  getLocalPlayerState: () => {
    x: number;
    y: number;
    direction: 'left' | 'right';
    action: PlayerAction;
  };
  onOnlineCountChanged: (count: number) => void;
  onHostStatusChanged?: (isHost: boolean) => void;
  onRemoteEntityHit: (entityId: string, damage: number, hitByName: string) => void;
  onRemoteIslandUnlocked: (islandId: number, unlockedBy: string) => void;
  onRemoteVillageUpgraded: (territoryId: number) => void;
  onRemoteBuildingConstructed: (building: ConstructedBuilding) => void;
  onRemoteWaveSpawned: (isBossWave: boolean) => void;
  onRemoteMonstersSync: (monsters: Monster[], waveCount: number, bossWaveCount: number) => void;
  onRemoteMonsterHit: (monsterId: string, damage: number, attackerName: string) => void;
  onRemoteTerritoryLost: (territoryId: number, reason: string) => void;
}

/**
 * 실시간 멀티플레이(채널 라우터 + 원격 플레이어 렌더러) 조율 컨트롤러
 */
export class MultiplayerSyncController {
  private ctx: IMultiplayerSyncContext;
  private remoteRenderer: RemotePlayerRenderer;
  private router: MultiplayerChannelRouter;
  private lastBroadcastTime = 0;

  constructor(ctx: IMultiplayerSyncContext) {
    this.ctx = ctx;
    this.remoteRenderer = new RemotePlayerRenderer(ctx.scene);
    this.router = new MultiplayerChannelRouter({
      getPlayerId: () => this.ctx.getPlayerId(),
      getPlayerName: () => this.ctx.getPlayerName(),
      getPlayerColor: () => this.ctx.getPlayerColor(),
      onOnlineCountChanged: (count) => this.ctx.onOnlineCountChanged(count),
      onHostStatusChanged: (isHost) => this.ctx.onHostStatusChanged?.(isHost),
      onRemotePlayerMove: (player) =>
        this.remoteRenderer.updatePlayer(player, this.ctx.getPlayerId()),
      onRemotePlayerLeave: (playerId) => this.remoteRenderer.removePlayer(playerId),
      onRemoteEntityHit: (entityId, damage, hitByName) =>
        this.ctx.onRemoteEntityHit(entityId, damage, hitByName),
      onRemoteIslandUnlocked: (islandId, unlockedBy) =>
        this.ctx.onRemoteIslandUnlocked(islandId, unlockedBy),
      onRemoteVillageUpgraded: (territoryId) =>
        this.ctx.onRemoteVillageUpgraded(territoryId),
      onRemoteBuildingConstructed: (building) =>
        this.ctx.onRemoteBuildingConstructed(building),
      onRemoteWaveSpawned: (isBossWave) => this.ctx.onRemoteWaveSpawned(isBossWave),
      onRemoteMonstersSync: (monsters, waveCount, bossWaveCount) =>
        this.ctx.onRemoteMonstersSync(monsters, waveCount, bossWaveCount),
      onRemoteMonsterHit: (monsterId, damage, attackerName) =>
        this.ctx.onRemoteMonsterHit(monsterId, damage, attackerName),
      onRemoteTerritoryLost: (territoryId, reason) =>
        this.ctx.onRemoteTerritoryLost(territoryId, reason),
    });
  }

  public getIsHost(): boolean {
    return this.router.getIsHost();
  }

  public setup(): void {
    this.router.connect();
  }

  public destroy(): void {
    this.remoteRenderer.clear();
    this.router.destroy();
  }

  public maybeBroadcastPlayerMove(time: number): void {
    if (time - this.lastBroadcastTime <= 60) return;
    this.lastBroadcastTime = time;

    const state = this.ctx.getLocalPlayerState();
    const payload: Player = {
      id: this.ctx.getPlayerId(),
      name: this.ctx.getPlayerName(),
      x: Math.round(state.x),
      y: Math.round(state.y),
      direction: state.direction,
      action: state.action,
      color: this.ctx.getPlayerColor(),
      lastUpdated: Date.now(),
    };
    this.router.emit('player_move', 'player_move', payload);
  }

  public broadcastHit(entityId: string, damage: number): void {
    const payload = { entityId, damage, hitBy: this.ctx.getPlayerName() };
    this.router.emit('hit', 'entity_hit', payload);
  }

  public broadcastUnlock(islandId: number, unlockedBy: string): void {
    this.router.emit('island_unlocked', 'island_unlocked', { islandId, unlockedBy });
  }

  public broadcastVillageUpgrade(territoryId: number, tier: VillageTier): void {
    this.router.emit('village_upgraded', 'village_upgraded', { territoryId, tier });
  }

  public broadcastBuildingConstructed(building: ConstructedBuilding): void {
    this.router.emit('building_constructed', 'building_constructed', building, { building });
  }

  public broadcastWaveSpawn(isBossWave: boolean): void {
    this.router.emit('wave_spawned', 'wave_spawned', { isBossWave });
  }

  public broadcastMonstersSync(
    monsters: Monster[],
    waveCount: number,
    bossWaveCount: number
  ): void {
    this.router.emit('monsters_sync', 'monsters_sync', { monsters, waveCount, bossWaveCount });
  }

  public broadcastMonsterHit(monsterId: string, damage: number, attackerName: string): void {
    this.router.emit('monster_hit', 'monster_hit', { monsterId, damage, attackerName });
  }

  public broadcastTerritoryLost(territoryId: number): void {
    this.router.emit('territory_lost', 'territory_lost', {
      territoryId,
      reason: '마물 군단',
    });
  }
}
