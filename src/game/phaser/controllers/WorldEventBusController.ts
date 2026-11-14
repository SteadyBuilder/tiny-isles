import { ConstructableType, Inventory, PlayerColor } from '../../../types/game';
import { GameEventPayloads, GameEvents } from '../../events/gameEvents';

export interface IWorldEventBusContext {
  isSceneAlive: () => boolean;
  setPlayerProfile: (name: string, color: PlayerColor) => void;
  setTargetZoom: (zoom: number) => void;
  setInventory: (inv: Inventory) => void;
  addTestResources: () => void;
  setJoystickVector: (vector: { x: number; y: number }) => void;
  tryInteract: () => void;
  upgradeVillage: (territoryId: number) => void;
  constructBuilding: (territoryId: number, type: ConstructableType, slotIndex?: number) => void;
  repairTerritoryCore: (territoryId: number) => void;
  triggerRegularWave: () => void;
  triggerBossWave: () => void;
  summonEarlyWave: (isBossWave: boolean) => void;
  reduceWaveCooldown: (seconds: number) => void;
  setWaveTimeScale: (scale: number) => void;
  damageTerritoryCore: (territoryId: number, damage: number) => void;
  onWindowUnload: () => void;
}

/**
 * React UI <-> WorldScene 간 GameEvents 브릿지 및 브라우저 언로드 리스너 수명 관리 컨트롤러
 */
export class WorldEventBusController {
  private ctx: IWorldEventBusContext;
  private unbindFns: Array<() => void> = [];

  constructor(ctx: IWorldEventBusContext) {
    this.ctx = ctx;
  }

  public setup(): void {
    this.register('set-player-profile', (data) => {
      this.ctx.setPlayerProfile(data.name, data.color);
    });

    this.register('set-zoom', (newZoom) => {
      this.ctx.setTargetZoom(newZoom);
    });

    this.register('set-inventory', (newInv) => {
      this.ctx.setInventory(newInv);
    });

    this.register('joystick-move', (vector) => {
      this.ctx.setJoystickVector(vector);
    });

    this.register('trigger-interact', () => {
      this.ctx.tryInteract();
    });

    this.register('upgrade-village', (territoryId) => {
      this.ctx.upgradeVillage(territoryId);
    });

    this.register('construct-building', (data) => {
      this.ctx.constructBuilding(data.territoryId, data.type, data.slotIndex);
    });

    this.register('repair-territory-core', (territoryId) => {
      this.ctx.repairTerritoryCore(territoryId);
    });

    this.register('trigger-regular-wave', () => {
      this.ctx.triggerRegularWave();
    });

    this.register('trigger-boss-wave', () => {
      this.ctx.triggerBossWave();
    });

    this.register('summon-early-wave', (data) => {
      this.ctx.summonEarlyWave(Boolean(data?.isBossWave));
    });

    this.register('reduce-wave-cooldown', (seconds) => {
      this.ctx.reduceWaveCooldown(seconds);
    });

    this.register('set-wave-timescale', (scale) => {
      this.ctx.setWaveTimeScale(scale);
    });

    this.register('damage-territory-core', (data) => {
      this.ctx.damageTerritoryCore(data.territoryId, data.damage);
    });

    this.register('add-test-resources', () => {
      this.ctx.addTestResources();
    });

    if (typeof window !== 'undefined') {
      const handleUnload = () => this.ctx.onWindowUnload();
      window.addEventListener('pagehide', handleUnload);
      window.addEventListener('beforeunload', handleUnload);
      this.unbindFns.push(() => {
        window.removeEventListener('pagehide', handleUnload);
        window.removeEventListener('beforeunload', handleUnload);
      });
    }
  }

  public destroy(): void {
    for (const unbind of this.unbindFns) {
      unbind();
    }
    this.unbindFns = [];
  }

  private register<K extends keyof GameEventPayloads>(
    event: K,
    fn: (payload: GameEventPayloads[K]) => void
  ): void {
    const wrapped = (payload: GameEventPayloads[K]) => {
      if (!this.ctx.isSceneAlive()) return;
      fn(payload);
    };
    GameEvents.on(event, wrapped);
    this.unbindFns.push(() => GameEvents.off(event, wrapped));
  }
}
