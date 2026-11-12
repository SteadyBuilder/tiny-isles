import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GameCanvas } from './game/GameCanvas';
import { PhaserGame } from './game/PhaserGame';
import { HUD } from './components/HUD';
import { MobileControls } from './components/MobileControls';
import { MinimapModal } from './components/MinimapModal';
import { VillageBuildModal } from './components/VillageBuildModal';
import {
  ConstructableType,
  ConstructedBuilding,
  Inventory,
  Island,
  PlayerColor,
  WaveState,
} from './types/game';
import { storage } from './lib/storage';
import { serverSync } from './lib/serverSync';
import {
  BOSS_WAVE_INTERVAL_SEC,
  INITIAL_ISLANDS,
  REGULAR_WAVE_INTERVAL_SEC,
} from './game/constants';
import { EventBus } from './game/phaser/EventBus';

export function App() {
  const playerIdRef = useRef<string>(storage.getPlayerId());
  const [profile, setProfile] = useState(() => storage.loadProfile());
  const [inventory, setInventory] = useState<Inventory>(() => storage.loadInventory());
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [unlockedIslandIds, setUnlockedIslandIds] = useState<number[]>(() => {
    const saved = storage.loadUnlockedIslands();
    return saved.length > 0 ? saved : [0];
  });
  const [islandStats, setIslandStats] = useState({
    unlocked: unlockedIslandIds.length,
    total: INITIAL_ISLANDS.length,
  });

  // Territories, Constructed Buildings & Wave State
  const [territories, setTerritories] = useState<Island[]>(() => INITIAL_ISLANDS);
  const [constructedBuildings, setConstructedBuildings] = useState<ConstructedBuilding[]>(() =>
    storage.loadConstructedBuildings()
  );
  const [waveState, setWaveState] = useState<WaveState>({
    regularWaveIntervalSec: REGULAR_WAVE_INTERVAL_SEC,
    bossWaveIntervalSec: BOSS_WAVE_INTERVAL_SEC,
    regularWaveRemainingSec: REGULAR_WAVE_INTERVAL_SEC,
    bossWaveRemainingSec: BOSS_WAVE_INTERVAL_SEC,
    waveCount: 0,
    bossWaveCount: 0,
    activeMonstersCount: 0,
    activeBoss: null,
    lastWaveMessage: null,
    timeScale: 1,
  });

  const [showVillageModal, setShowVillageModal] = useState<boolean>(false);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<number>(0);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleShowAlert = useCallback((msg: string) => {
    setAlertMessage(msg);
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    alertTimerRef.current = setTimeout(() => {
      setAlertMessage(null);
    }, 6500);
  }, []);

  // 서버에서 기존 플레이어 정보 복원
  useEffect(() => {
    let isMounted = true;
    serverSync.fetchPlayer(playerIdRef.current).then((saved) => {
      if (!isMounted || !saved) return;
      if (saved.name) {
        setProfile((prev) => {
          const next = {
            ...prev,
            name: saved.name,
            color: (saved.color as PlayerColor) || prev.color,
          };
          storage.saveProfile(next);
          return next;
        });
      }
      if (
        typeof saved.wood === 'number' &&
        typeof saved.stone === 'number' &&
        typeof saved.gold === 'number'
      ) {
        setInventory({
          wood: saved.wood,
          stone: saved.stone,
          gold: saved.gold,
        });
        storage.saveInventory({
          wood: saved.wood,
          stone: saved.stone,
          gold: saved.gold,
        });
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      serverSync.flushPlayerSync();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, []);

  const [zoom, setZoom] = useState<number>(() => storage.loadZoom());
  const [nearIsland, setNearIsland] = useState<Island | null>(null);
  const [showMinimapModal, setShowMinimapModal] = useState<boolean>(false);
  const [playerGridPos, setPlayerGridPos] = useState<{ gridX: number; gridY: number }>({
    gridX: 0,
    gridY: 0,
  });

  const joystickRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleUpdateName = (name: string) => {
    setProfile((prev) => {
      const next = { ...prev, name };
      storage.saveProfile(next);
      serverSync.savePlayer(playerIdRef.current, next, inventory);
      return next;
    });
  };

  const handleUpdateColor = (color: PlayerColor) => {
    setProfile((prev) => {
      const next = { ...prev, color };
      storage.saveProfile(next);
      serverSync.savePlayer(playerIdRef.current, next, inventory);
      return next;
    });
  };

  const handleUpdateInventory = (updater: (prev: Inventory) => Inventory) => {
    setInventory((prev) => {
      const next = updater(prev);
      storage.saveInventory(next);
      serverSync.savePlayer(playerIdRef.current, profile, next);
      return next;
    });
  };

  const handleUnlockedCountChange = (unlocked: number, total: number) => {
    setIslandStats({ unlocked, total });
  };

  const handleUnlockedIslandIdsChange = (ids: number[]) => {
    setUnlockedIslandIds(ids);
  };

  const handleResetGame = () => {
    if (window.confirm('정말 게임 진행상황(자원, 점령한 땅, 건설된 마을 및 타워)을 초기화하시겠습니까?')) {
      storage.resetAll();
      window.location.reload();
    }
  };

  const handleMobileAction = useCallback(() => {
    window.dispatchEvent(new CustomEvent('player-action'));
  }, []);

  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
    storage.saveZoom(newZoom);
  }, []);

  const handleOpenVillageModalForCurrent = useCallback(() => {
    const cur =
      territories.find(
        (t) =>
          t.gridX === playerGridPos.gridX &&
          t.gridY === playerGridPos.gridY &&
          t.unlocked
      ) || territories[0];
    setSelectedTerritoryId(cur.id);
    setShowVillageModal(true);
  }, [territories, playerGridPos]);

  const handleOpenVillageModalById = useCallback((territoryId: number) => {
    setSelectedTerritoryId(territoryId);
    setShowVillageModal(true);
  }, []);

  const currentTerritory =
    territories.find(
      (t) =>
        t.gridX === playerGridPos.gridX &&
        t.gridY === playerGridPos.gridY &&
        t.unlocked
    ) || territories[0];

  const [engineMode, setEngineMode] = useState<'phaser' | 'canvas'>('phaser');

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1a331a]">
      {/* Engine Switcher Floating Badge */}
      <div className="absolute bottom-4 left-4 z-40 flex items-center gap-2">
        <button
          onClick={() => setEngineMode((prev) => (prev === 'phaser' ? 'canvas' : 'phaser'))}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/85 hover:bg-slate-800 text-xs font-semibold text-slate-200 border border-slate-700/60 shadow-lg backdrop-blur transition-all active:scale-95"
          title="엔진 전환 (Phaser 3 / Canvas 2D)"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>엔진: {engineMode === 'phaser' ? 'Phaser 3 (WebGL)' : 'Canvas 2D'}</span>
          <span className="text-[10px] text-slate-400 border border-slate-600 rounded px-1">전환</span>
        </button>
      </div>

      <HUD
        inventory={inventory}
        onlineCount={onlineCount}
        playerName={profile.name}
        setPlayerName={handleUpdateName}
        playerColor={profile.color}
        setPlayerColor={handleUpdateColor}
        unlockedCount={islandStats.unlocked}
        totalIslands={islandStats.total}
        currentTerritory={currentTerritory}
        waveState={waveState}
        alertMessage={alertMessage}
        onResetGame={handleResetGame}
        onOpenMinimap={() => setShowMinimapModal(true)}
        onOpenVillageModal={handleOpenVillageModalForCurrent}
        onTriggerRegularWave={() => EventBus.emit('trigger-regular-wave')}
        onTriggerBossWave={() => EventBus.emit('trigger-boss-wave')}
        onChangeTimeScale={(scale) => EventBus.emit('set-wave-timescale', scale)}
        onAddTestResources={() => EventBus.emit('add-test-resources')}
      />

      {engineMode === 'phaser' ? (
        <PhaserGame
          key="phaser-engine"
          playerName={profile.name}
          playerColor={profile.color}
          inventory={inventory}
          onUpdateInventory={handleUpdateInventory}
          onlineCount={onlineCount}
          setOnlineCount={setOnlineCount}
          onUnlockedCountChange={handleUnlockedCountChange}
          onUnlockedIslandIdsChange={handleUnlockedIslandIdsChange}
          onTerritoriesChange={setTerritories}
          onConstructedBuildingsChange={setConstructedBuildings}
          onWaveStateChange={setWaveState}
          onOpenVillageModal={handleOpenVillageModalById}
          onGameAlert={handleShowAlert}
          joystickRef={joystickRef}
          onNearIslandChange={setNearIsland}
          onPlayerPositionChange={setPlayerGridPos}
          onOpenMinimap={() => setShowMinimapModal(true)}
          zoom={zoom}
          onZoomChange={handleZoomChange}
        />
      ) : (
        <GameCanvas
          key="canvas-engine"
          playerName={profile.name}
          playerColor={profile.color}
          inventory={inventory}
          onUpdateInventory={handleUpdateInventory}
          onlineCount={onlineCount}
          setOnlineCount={setOnlineCount}
          onUnlockedCountChange={handleUnlockedCountChange}
          onUnlockedIslandIdsChange={handleUnlockedIslandIdsChange}
          joystickRef={joystickRef}
          onNearIslandChange={setNearIsland}
          onPlayerPositionChange={setPlayerGridPos}
          onOpenMinimap={() => setShowMinimapModal(true)}
          zoom={zoom}
          onZoomChange={handleZoomChange}
        />
      )}

      <MobileControls
        onAction={handleMobileAction}
        joystickRef={joystickRef}
        nearIsland={nearIsland}
      />

      <MinimapModal
        isOpen={showMinimapModal}
        onClose={() => setShowMinimapModal(false)}
        territories={territories}
        unlockedIslandIds={unlockedIslandIds}
        inventory={inventory}
        playerGridPos={playerGridPos}
        playerColor={profile.color}
        playerName={profile.name}
        onManageTerritory={handleOpenVillageModalById}
      />

      <VillageBuildModal
        isOpen={showVillageModal}
        onClose={() => setShowVillageModal(false)}
        territories={territories}
        selectedTerritoryId={selectedTerritoryId}
        onSelectTerritory={setSelectedTerritoryId}
        constructedBuildings={constructedBuildings}
        inventory={inventory}
        onUpgradeVillage={(territoryId) => EventBus.emit('upgrade-village', territoryId)}
        onConstructBuilding={(territoryId, type: ConstructableType) =>
          EventBus.emit('construct-building', { territoryId, type })
        }
        onRepairCore={(territoryId) => EventBus.emit('repair-territory-core', territoryId)}
        onTestDestroyCore={(territoryId) =>
          EventBus.emit('damage-territory-core', { territoryId, damage: 9999 })
        }
      />
    </div>
  );
}

export default App;
