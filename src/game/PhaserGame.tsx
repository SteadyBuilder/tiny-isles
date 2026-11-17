import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { createPhaserConfig } from './phaser/config';
import { GameEvents } from './events/gameEvents';
import {
  ConstructedBuilding,
  Inventory,
  Island,
  PlayerColor,
  WaveState,
} from '../types/game';
import { MetaBonusSummary, RoomConfig } from '../types/room';

interface PhaserGameProps {
  playerName: string;
  playerColor: PlayerColor;
  roomConfig: RoomConfig;
  metaBonuses: MetaBonusSummary;
  inventory: Inventory;
  onUpdateInventory: (updater: (prev: Inventory) => Inventory) => void;
  onlineCount: number;
  setOnlineCount: (count: number) => void;
  onUnlockedCountChange?: (count: number, total: number) => void;
  onUnlockedIslandIdsChange?: (ids: number[]) => void;
  onTerritoriesChange?: (territories: Island[]) => void;
  onConstructedBuildingsChange?: (buildings: ConstructedBuilding[]) => void;
  onWaveStateChange?: (waveState: WaveState) => void;
  onOpenVillageModal?: (territoryId: number) => void;
  onGameAlert?: (msg: string) => void;
  joystickRef?: React.MutableRefObject<{ x: number; y: number }>;
  onNearIslandChange?: (island: Island | null) => void;
  onPlayerPositionChange?: (pos: { gridX: number; gridY: number }) => void;
  onOpenMinimap?: () => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
}

export const PhaserGame: React.FC<PhaserGameProps> = ({
  playerName,
  playerColor,
  roomConfig,
  metaBonuses,
  inventory,
  onUpdateInventory,
  setOnlineCount,
  onUnlockedCountChange,
  onUnlockedIslandIdsChange,
  onTerritoriesChange,
  onConstructedBuildingsChange,
  onWaveStateChange,
  onOpenVillageModal,
  onGameAlert,
  joystickRef,
  onNearIslandChange,
  onPlayerPositionChange,
  zoom = 1.0,
  onZoomChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadRatio, setLoadRatio] = useState(0);

  const onUpdateInventoryRef = useRef(onUpdateInventory);
  onUpdateInventoryRef.current = onUpdateInventory;

  const onUnlockedCountChangeRef = useRef(onUnlockedCountChange);
  onUnlockedCountChangeRef.current = onUnlockedCountChange;

  const onUnlockedIslandIdsChangeRef = useRef(onUnlockedIslandIdsChange);
  onUnlockedIslandIdsChangeRef.current = onUnlockedIslandIdsChange;

  const onTerritoriesChangeRef = useRef(onTerritoriesChange);
  onTerritoriesChangeRef.current = onTerritoriesChange;

  const onConstructedBuildingsChangeRef = useRef(onConstructedBuildingsChange);
  onConstructedBuildingsChangeRef.current = onConstructedBuildingsChange;

  const onWaveStateChangeRef = useRef(onWaveStateChange);
  onWaveStateChangeRef.current = onWaveStateChange;

  const onOpenVillageModalRef = useRef(onOpenVillageModal);
  onOpenVillageModalRef.current = onOpenVillageModal;

  const onGameAlertRef = useRef(onGameAlert);
  onGameAlertRef.current = onGameAlert;

  const onNearIslandChangeRef = useRef(onNearIslandChange);
  onNearIslandChangeRef.current = onNearIslandChange;

  const onPlayerPositionChangeRef = useRef(onPlayerPositionChange);
  onPlayerPositionChangeRef.current = onPlayerPositionChange;

  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;

  const setOnlineCountRef = useRef(setOnlineCount);
  setOnlineCountRef.current = setOnlineCount;

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;

    let cancelled = false;
    let game: Phaser.Game | null = null;

    const handleProgress = (val: number) => setLoadRatio(val);
    const handleComplete = () => setLoading(false);

    const handleInventoryUpdated = (newInv: Inventory) => {
      onUpdateInventoryRef.current(() => newInv);
    };

    const handleUnlockedIslands = ({ ids, total }: { ids: number[]; total: number }) => {
      onUnlockedIslandIdsChangeRef.current?.(ids);
      onUnlockedCountChangeRef.current?.(ids.length, total);
    };

    const handleTerritoriesUpdated = (territories: Island[]) => {
      onTerritoriesChangeRef.current?.(territories);
    };

    const handleConstructedBuildingsUpdated = (buildings: ConstructedBuilding[]) => {
      onConstructedBuildingsChangeRef.current?.(buildings);
    };

    const handleWaveStateUpdated = (waveState: WaveState) => {
      onWaveStateChangeRef.current?.(waveState);
    };

    const handleOpenVillageModal = (territoryId: number) => {
      onOpenVillageModalRef.current?.(territoryId);
    };

    const handleGameAlert = (msg: string) => {
      onGameAlertRef.current?.(msg);
    };

    const handleNearIsland = (island: Island | null) => {
      onNearIslandChangeRef.current?.(island);
    };

    const handleGridPos = (pos: { gridX: number; gridY: number }) => {
      onPlayerPositionChangeRef.current?.(pos);
    };

    const handleZoomChanged = (newZoom: number) => {
      onZoomChangeRef.current?.(newZoom);
    };

    const handleOnlineCount = (count: number) => {
      setOnlineCountRef.current(count);
    };

    GameEvents.on('load-progress', handleProgress);
    GameEvents.on('load-complete', handleComplete);
    GameEvents.on('inventory-updated', handleInventoryUpdated);
    GameEvents.on('unlocked-islands', handleUnlockedIslands);
    GameEvents.on('territories-updated', handleTerritoriesUpdated);
    GameEvents.on('constructed-buildings-updated', handleConstructedBuildingsUpdated);
    GameEvents.on('wave-state-updated', handleWaveStateUpdated);
    GameEvents.on('open-village-modal', handleOpenVillageModal);
    GameEvents.on('game-alert', handleGameAlert);
    GameEvents.on('near-island-changed', handleNearIsland);
    GameEvents.on('player-grid-pos-changed', handleGridPos);
    GameEvents.on('zoom-changed', handleZoomChanged);
    GameEvents.on('online-count-changed', handleOnlineCount);

    // Yield 1 animation frame so unmounting LobbyDioramaCanvas releases its WebGL context cleanly
    const rafId = requestAnimationFrame(() => {
      if (cancelled || !containerRef.current) return;
      const config = createPhaserConfig(containerRef.current, {
        playerName,
        playerColor,
        zoom,
      });
      game = new Phaser.Game(config);
      game.registry.set('roomConfig', roomConfig);
      game.registry.set('metaBonuses', metaBonuses);
      gameRef.current = game;
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);

      GameEvents.off('load-progress', handleProgress);
      GameEvents.off('load-complete', handleComplete);
      GameEvents.off('inventory-updated', handleInventoryUpdated);
      GameEvents.off('unlocked-islands', handleUnlockedIslands);
      GameEvents.off('territories-updated', handleTerritoriesUpdated);
      GameEvents.off('constructed-buildings-updated', handleConstructedBuildingsUpdated);
      GameEvents.off('wave-state-updated', handleWaveStateUpdated);
      GameEvents.off('open-village-modal', handleOpenVillageModal);
      GameEvents.off('game-alert', handleGameAlert);
      GameEvents.off('near-island-changed', handleNearIsland);
      GameEvents.off('player-grid-pos-changed', handleGridPos);
      GameEvents.off('zoom-changed', handleZoomChanged);
      GameEvents.off('online-count-changed', handleOnlineCount);

      if (game) {
        game.destroy(true);
        game = null;
      }
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    GameEvents.emit('set-player-profile', { name: playerName, color: playerColor });
  }, [playerName, playerColor]);

  useEffect(() => {
    GameEvents.emit('set-zoom', zoom);
  }, [zoom]);

  useEffect(() => {
    GameEvents.emit('set-inventory', inventory);
  }, [inventory]);

  useEffect(() => {
    let animId: number;
    let lastX = 0;
    let lastY = 0;
    const pollJoystick = () => {
      if (joystickRef?.current) {
        const { x, y } = joystickRef.current;
        if (x !== lastX || y !== lastY) {
          lastX = x;
          lastY = y;
          GameEvents.emit('joystick-move', joystickRef.current);
        }
      }
      animId = requestAnimationFrame(pollJoystick);
    };
    animId = requestAnimationFrame(pollJoystick);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [joystickRef]);

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white">
          <div className="text-xl font-bold mb-3 flex items-center gap-2">
            <span className="animate-spin text-emerald-400">⚡</span>
            <span>실시간 마을 타워디펜스 월드 로딩 중...</span>
          </div>
          <div className="w-64 h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div
              className="h-full bg-emerald-500 transition-all duration-150"
              style={{ width: `${Math.round(loadRatio * 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-2">{Math.round(loadRatio * 100)}%</p>
        </div>
      )}

      <div
        ref={containerRef}
        id="phaser-game-container"
        className="w-full h-full overflow-hidden select-none touch-none"
      />
    </div>
  );
};
