import Phaser from 'phaser';
import {
  ConstructedBuilding,
  Monster,
  Player,
  PlayerAction,
  PlayerColor,
  VillageTier,
} from '../../../types/game';
import { supabase } from '../../../lib/supabase';
import { serverSync } from '../../../lib/serverSync';
import { ySortDepth } from '../../depthLayers';
import { EventBus } from '../EventBus';
import { electHostFromPresence, PresenceEntryMeta } from './HostAuthorityHelper';

interface RemotePlayerVisual {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  nameTag: Phaser.GameObjects.Text;
  data: Player;
}

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

interface BroadcastMeta {
  eventId?: string;
  senderId?: string;
}

/**
 * 실시간 멀티플레이(BroadcastChannel + Supabase Presence/Broadcast) 및 원격 플레이어 렌더링 전담 컨트롤러
 */
export class MultiplayerSyncController {
  private ctx: IMultiplayerSyncContext;
  private localBus: BroadcastChannel | null = null;
  private supabaseChannel: ReturnType<typeof supabase.channel> | null = null;
  private isSubscribed = false;
  private isHost = true;
  private lastBroadcastTime = 0;
  private remotePlayers = new Map<string, RemotePlayerVisual>();

  constructor(ctx: IMultiplayerSyncContext) {
    this.ctx = ctx;
  }

  public getIsHost(): boolean {
    return this.isHost;
  }

  public setup(): void {
    const playerId = this.ctx.getPlayerId();

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.localBus = new BroadcastChannel('tiny_isles_multiplayer');
      this.localBus.onmessage = (event: MessageEvent) => {
        const { data } = event;
        if (!data || data.senderId === playerId) return;

        if (data.type === 'player_move') {
          this.handleRemotePlayerMove(data.payload as Player);
        } else if (data.type === 'hit') {
          const { entityId, damage, hitBy } = data.payload as {
            entityId: string;
            damage: number;
            hitBy: string;
          };
          this.ctx.onRemoteEntityHit(entityId, damage, hitBy);
        } else if (data.type === 'island_unlocked') {
          const { islandId, unlockedBy } = data.payload as {
            islandId: number;
            unlockedBy: string;
          };
          this.ctx.onRemoteIslandUnlocked(islandId, unlockedBy);
        } else if (data.type === 'village_upgraded') {
          const { territoryId } = data.payload as { territoryId: number };
          this.ctx.onRemoteVillageUpgraded(territoryId);
        } else if (data.type === 'building_constructed') {
          this.ctx.onRemoteBuildingConstructed(data.payload as ConstructedBuilding);
        } else if (data.type === 'wave_spawned') {
          const { isBossWave } = data.payload as { isBossWave: boolean };
          this.ctx.onRemoteWaveSpawned(isBossWave);
        } else if (data.type === 'monsters_sync') {
          const { monsters, waveCount, bossWaveCount } = data.payload as {
            monsters: Monster[];
            waveCount: number;
            bossWaveCount: number;
          };
          this.ctx.onRemoteMonstersSync(monsters || [], waveCount ?? 0, bossWaveCount ?? 0);
        } else if (data.type === 'monster_hit') {
          const { monsterId, damage, attackerName } = data.payload as {
            monsterId: string;
            damage: number;
            attackerName: string;
          };
          this.ctx.onRemoteMonsterHit(monsterId, damage, attackerName);
        } else if (data.type === 'territory_lost') {
          const { territoryId, reason } = data.payload as {
            territoryId: number;
            reason?: string;
          };
          this.ctx.onRemoteTerritoryLost(territoryId, reason || '마물 군단');
        }
      };
    }

    const roomId = 'tiny_isles_global_hub';
    const channel = supabase.channel(roomId, {
      config: {
        broadcast: { self: false },
        presence: { key: playerId },
      },
    });
    this.supabaseChannel = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState() as Record<string, PresenceEntryMeta[]>;
        const { isHost, onlineCount } = electHostFromPresence(presenceState, playerId);
        if (this.isHost !== isHost) {
          this.isHost = isHost;
          this.ctx.onHostStatusChanged?.(isHost);
        }
        this.ctx.onOnlineCountChanged(onlineCount);
        EventBus.emit('online-count-changed', onlineCount);
      })
      .on('presence', { event: 'leave' }, ({ key }: { key: string }) => {
        this.removeRemotePlayer(key);
      })
      .on('broadcast', { event: 'player_move' }, ({ payload }: { payload: Player & BroadcastMeta }) => {
        if (!serverSync.isValidIncomingEvent(payload.eventId, payload.senderId, playerId)) return;
        this.handleRemotePlayerMove(payload);
      })
      .on(
        'broadcast',
        { event: 'entity_hit' },
        ({ payload }: { payload: { entityId: string; damage: number; hitBy: string } & BroadcastMeta }) => {
          if (!serverSync.isValidIncomingEvent(payload.eventId, payload.senderId, playerId)) return;
          this.ctx.onRemoteEntityHit(payload.entityId, payload.damage, payload.hitBy);
        }
      )
      .on(
        'broadcast',
        { event: 'island_unlocked' },
        ({ payload }: { payload: { islandId: number; unlockedBy: string } & BroadcastMeta }) => {
          if (!serverSync.isValidIncomingEvent(payload.eventId, payload.senderId, playerId)) return;
          this.ctx.onRemoteIslandUnlocked(payload.islandId, payload.unlockedBy);
        }
      )
      .on(
        'broadcast',
        { event: 'village_upgraded' },
        ({ payload }: { payload: { territoryId: number; tier: VillageTier } & BroadcastMeta }) => {
          if (!serverSync.isValidIncomingEvent(payload.eventId, payload.senderId, playerId)) return;
          this.ctx.onRemoteVillageUpgraded(payload.territoryId);
        }
      )
      .on(
        'broadcast',
        { event: 'building_constructed' },
        ({ payload }: { payload: { building: ConstructedBuilding } & BroadcastMeta }) => {
          if (!serverSync.isValidIncomingEvent(payload.eventId, payload.senderId, playerId)) return;
          if (payload.building) {
            this.ctx.onRemoteBuildingConstructed(payload.building);
          }
        }
      )
      .on(
        'broadcast',
        { event: 'wave_spawned' },
        ({ payload }: { payload: { isBossWave: boolean } & BroadcastMeta }) => {
          if (!serverSync.isValidIncomingEvent(payload.eventId, payload.senderId, playerId)) return;
          this.ctx.onRemoteWaveSpawned(payload.isBossWave);
        }
      )
      .on(
        'broadcast',
        { event: 'monsters_sync' },
        ({
          payload,
        }: {
          payload: { monsters: Monster[]; waveCount: number; bossWaveCount: number } & BroadcastMeta;
        }) => {
          if (!serverSync.isValidIncomingEvent(payload.eventId, payload.senderId, playerId)) return;
          this.ctx.onRemoteMonstersSync(
            payload.monsters || [],
            payload.waveCount ?? 0,
            payload.bossWaveCount ?? 0
          );
        }
      )
      .on(
        'broadcast',
        { event: 'monster_hit' },
        ({
          payload,
        }: {
          payload: { monsterId: string; damage: number; attackerName: string } & BroadcastMeta;
        }) => {
          if (!serverSync.isValidIncomingEvent(payload.eventId, payload.senderId, playerId)) return;
          this.ctx.onRemoteMonsterHit(payload.monsterId, payload.damage, payload.attackerName);
        }
      )
      .on(
        'broadcast',
        { event: 'territory_lost' },
        ({ payload }: { payload: { territoryId: number; reason?: string } & BroadcastMeta }) => {
          if (!serverSync.isValidIncomingEvent(payload.eventId, payload.senderId, playerId)) return;
          this.ctx.onRemoteTerritoryLost(payload.territoryId, payload.reason || '마물 군단');
        }
      )
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          this.isSubscribed = true;
          await channel.track({
            name: this.ctx.getPlayerName(),
            color: this.ctx.getPlayerColor(),
            joinedAt: Date.now(),
          });
        }
      });
  }

  public destroy(): void {
    this.remotePlayers.forEach((visual) => visual.container.destroy());
    this.remotePlayers.clear();

    if (this.localBus) {
      this.localBus.close();
      this.localBus = null;
    }

    if (this.supabaseChannel) {
      void this.supabaseChannel.unsubscribe();
      this.supabaseChannel = null;
      this.isSubscribed = false;
    }
  }

  public maybeBroadcastPlayerMove(time: number): void {
    if (time - this.lastBroadcastTime <= 60) return;
    this.lastBroadcastTime = time;

    const state = this.ctx.getLocalPlayerState();
    const playerId = this.ctx.getPlayerId();
    const payload: Player = {
      id: playerId,
      name: this.ctx.getPlayerName(),
      x: Math.round(state.x),
      y: Math.round(state.y),
      direction: state.direction,
      action: state.action,
      color: this.ctx.getPlayerColor(),
      lastUpdated: Date.now(),
    };

    this.localBus?.postMessage({ type: 'player_move', senderId: playerId, payload });
    if (this.supabaseChannel && this.isSubscribed) {
      serverSync.broadcast(this.supabaseChannel, 'player_move', payload, playerId);
    }
  }

  public broadcastHit(entityId: string, damage: number): void {
    const playerId = this.ctx.getPlayerId();
    const payload = { entityId, damage, hitBy: this.ctx.getPlayerName() };
    this.localBus?.postMessage({ type: 'hit', senderId: playerId, payload });
    if (this.supabaseChannel && this.isSubscribed) {
      serverSync.broadcast(this.supabaseChannel, 'entity_hit', payload, playerId);
    }
  }

  public broadcastUnlock(islandId: number, unlockedBy: string): void {
    const playerId = this.ctx.getPlayerId();
    const payload = { islandId, unlockedBy };
    this.localBus?.postMessage({ type: 'island_unlocked', senderId: playerId, payload });
    if (this.supabaseChannel && this.isSubscribed) {
      serverSync.broadcast(this.supabaseChannel, 'island_unlocked', payload, playerId);
    }
  }

  public broadcastVillageUpgrade(territoryId: number, tier: VillageTier): void {
    const playerId = this.ctx.getPlayerId();
    const payload = { territoryId, tier };
    this.localBus?.postMessage({ type: 'village_upgraded', senderId: playerId, payload });
    if (this.supabaseChannel && this.isSubscribed) {
      serverSync.broadcast(this.supabaseChannel, 'village_upgraded', payload, playerId);
    }
  }

  public broadcastBuildingConstructed(building: ConstructedBuilding): void {
    const playerId = this.ctx.getPlayerId();
    this.localBus?.postMessage({
      type: 'building_constructed',
      senderId: playerId,
      payload: building,
    });
    if (this.supabaseChannel && this.isSubscribed) {
      serverSync.broadcast(
        this.supabaseChannel,
        'building_constructed',
        { building },
        playerId
      );
    }
  }

  public broadcastWaveSpawn(isBossWave: boolean): void {
    const playerId = this.ctx.getPlayerId();
    const payload = { isBossWave };
    this.localBus?.postMessage({ type: 'wave_spawned', senderId: playerId, payload });
    if (this.supabaseChannel && this.isSubscribed) {
      serverSync.broadcast(this.supabaseChannel, 'wave_spawned', payload, playerId);
    }
  }

  public broadcastMonstersSync(
    monsters: Monster[],
    waveCount: number,
    bossWaveCount: number
  ): void {
    const playerId = this.ctx.getPlayerId();
    const payload = { monsters, waveCount, bossWaveCount };
    this.localBus?.postMessage({ type: 'monsters_sync', senderId: playerId, payload });
    if (this.supabaseChannel && this.isSubscribed) {
      serverSync.broadcast(this.supabaseChannel, 'monsters_sync', payload, playerId);
    }
  }

  public broadcastMonsterHit(monsterId: string, damage: number, attackerName: string): void {
    const playerId = this.ctx.getPlayerId();
    const payload = { monsterId, damage, attackerName };
    this.localBus?.postMessage({ type: 'monster_hit', senderId: playerId, payload });
    if (this.supabaseChannel && this.isSubscribed) {
      serverSync.broadcast(this.supabaseChannel, 'monster_hit', payload, playerId);
    }
  }

  public broadcastTerritoryLost(territoryId: number): void {
    const playerId = this.ctx.getPlayerId();
    const payload = { territoryId, reason: '마물 군단' };
    this.localBus?.postMessage({ type: 'territory_lost', senderId: playerId, payload });
    if (this.supabaseChannel && this.isSubscribed) {
      serverSync.broadcast(this.supabaseChannel, 'territory_lost', payload, playerId);
    }
  }

  private handleRemotePlayerMove(data: Player): void {
    if (data.id === this.ctx.getPlayerId()) return;
    if (!serverSync.isLatestMove(data.id, data.lastUpdated || Date.now())) return;

    const scene = this.ctx.scene;
    let visual = this.remotePlayers.get(data.id);
    if (!visual) {
      const container = scene.add.container(data.x, data.y);

      const sprite = scene.add.sprite(0, 0, `${data.color}PawnIdle`);
      sprite.setDisplaySize(128, 128);
      container.add(sprite);

      const nameTag = scene.add
        .text(0, -42, data.name, {
          fontFamily: 'Pretendard, sans-serif',
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#f87171',
          stroke: '#000000',
          strokeThickness: 2.5,
        })
        .setOrigin(0.5);
      container.add(nameTag);

      visual = { container, sprite, nameTag, data };
      this.remotePlayers.set(data.id, visual);
    }

    if (serverSync.shouldSnapTeleport(visual.container.x, visual.container.y, data.x, data.y, 280)) {
      visual.container.setPosition(data.x, data.y);
    } else {
      scene.tweens.add({
        targets: visual.container,
        x: data.x,
        y: data.y,
        duration: 120,
        ease: 'Linear',
      });
    }

    visual.container.setDepth(ySortDepth(data.y, 24));
    visual.sprite.setFlipX(data.direction === 'left');
    visual.nameTag.setText(data.name);

    const animKey = `${data.color}_${data.action}`;
    if (scene.anims.exists(animKey)) {
      visual.sprite.play(animKey, true);
    }
  }

  private removeRemotePlayer(id: string): void {
    serverSync.removePlayerCache(id);
    const visual = this.remotePlayers.get(id);
    if (visual) {
      visual.container.destroy();
      this.remotePlayers.delete(id);
    }
  }
}
