import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { createPhaserConfig } from './phaser/config';
import { EventBus } from './phaser/EventBus';
import {
  ConstructedBuilding,
  Inventory,
  Island,
  PlayerColor,
  WaveState,
} from '../types/game';

interface PhaserGameProps {
  playerName: string;
  playerColor: PlayerColor;
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
    if (!containerRef.current) return;

    const config = createPhaserConfig(containerRef.current, {
      playerName,
      playerColor,
      zoom,
    });

    const game = new Phaser.Game(config);
    gameRef.current = game;

    const handleProgress = (val: number) => setLoadRatio(val);
    const handleComplete = () => setLoading(false);

    const handleInventoryUpdated = (newInv: Inventory) => {
      onUpdateInventoryRef.current(() => newInv);
    };

    const handleUnlockedIslands = (ids: number[], total: number) => {
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

    EventBus.on('load-progress', handleProgress);
    EventBus.on('load-complete', handleComplete);
    EventBus.on('inventory-updated', handleInventoryUpdated);
    EventBus.on('unlocked-islands', handleUnlockedIslands);
    EventBus.on('territories-updated', handleTerritoriesUpdated);
    EventBus.on('constructed-buildings-updated', handleConstructedBuildingsUpdated);
    EventBus.on('wave-state-updated', handleWaveStateUpdated);
    EventBus.on('open-village-modal', handleOpenVillageModal);
    EventBus.on('game-alert', handleGameAlert);
    EventBus.on('near-island-changed', handleNearIsland);
    EventBus.on('player-grid-pos-changed', handleGridPos);
    EventBus.on('zoom-changed', handleZoomChanged);
    EventBus.on('online-count-changed', handleOnlineCount);

    return () => {
      EventBus.off('load-progress', handleProgress);
      EventBus.off('load-complete', handleComplete);
      EventBus.off('inventory-updated', handleInventoryUpdated);
      EventBus.off('unlocked-islands', handleUnlockedIslands);
      EventBus.off('territories-updated', handleTerritoriesUpdated);
      EventBus.off('constructed-buildings-updated', handleConstructedBuildingsUpdated);
      EventBus.off('wave-state-updated', handleWaveStateUpdated);
      EventBus.off('open-village-modal', handleOpenVillageModal);
      EventBus.off('game-alert', handleGameAlert);
      EventBus.off('near-island-changed', handleNearIsland);
      EventBus.off('player-grid-pos-changed', handleGridPos);
      EventBus.off('zoom-changed', handleZoomChanged);
      EventBus.off('online-count-changed', handleOnlineCount);

      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    EventBus.emit('set-player-profile', { name: playerName, color: playerColor });
  }, [playerName, playerColor]);

  useEffect(() => {
    EventBus.emit('set-zoom', zoom);
  }, [zoom]);

  useEffect(() => {
    EventBus.emit('set-inventory', inventory);
  }, [inventory]);

  useEffect(() => {
    let animId: number;
    const pollJoystick = () => {
      if (joystickRef?.current) {
        EventBus.emit('joystick-move', joystickRef.current);
      }
      animId = requestAnimationFrame(pollJoystick);
    };
    animId = requestAnimationFrame(pollJoystick);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [joystickRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let touchStartDist: number | null = null;
    let touchStartZoom = zoom;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        touchStartZoom = zoom;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const curDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (touchStartDist && touchStartDist > 0) {
          const factor = curDist / touchStartDist;
          const next = Math.min(2.0, Math.max(0.5, Number((touchStartZoom * factor).toFixed(2))));
          EventBus.emit('set-zoom', next);
          onZoomChangeRef.current?.(next);
        }
      }
    };

    const handleTouchEnd = () => {
      touchStartDist = null;
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [zoom]);

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
