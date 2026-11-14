import React, { useState, useRef, useCallback, useEffect } from 'react';
import { PhaserGame } from './game/PhaserGame';
import { HUD } from './components/HUD';
import { MobileControls } from './components/MobileControls';
import { MinimapModal } from './components/MinimapModal';
import { VillageBuildModal } from './components/VillageBuildModal';
import { OfflineReportModal } from './components/OfflineReportModal';
import {
  ConstructableType,
  ConstructedBuilding,
  Inventory,
  Island,
  OfflineResolutionReport,
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
import { GameEvents } from './game/events/gameEvents';

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
  const [offlineReport, setOfflineReport] = useState<OfflineResolutionReport | null>(null);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'b' || e.key === 'B' || e.code === 'KeyB') {
        e.preventDefault();
        handleOpenVillageModalForCurrent();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleOpenVillageModalForCurrent]);

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

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1a331a]">
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
        onTriggerRegularWave={() => GameEvents.emit('trigger-regular-wave')}
        onTriggerBossWave={() => GameEvents.emit('trigger-boss-wave')}
        onSummonEarlyWave={() => GameEvents.emit('summon-early-wave', { isBossWave: false })}
        onChangeTimeScale={(scale) => GameEvents.emit('set-wave-timescale', scale)}
        onAddTestResources={() => GameEvents.emit('add-test-resources')}
      />

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
        onOfflineReport={setOfflineReport}
        onOpenVillageModal={handleOpenVillageModalById}
        onGameAlert={handleShowAlert}
        joystickRef={joystickRef}
        onNearIslandChange={setNearIsland}
        onPlayerPositionChange={setPlayerGridPos}
        onOpenMinimap={() => setShowMinimapModal(true)}
        zoom={zoom}
        onZoomChange={handleZoomChange}
      />

      <MobileControls
        onAction={handleMobileAction}
        joystickRef={joystickRef}
        nearIsland={nearIsland}
        onZoomChange={handleZoomChange}
        currentZoom={zoom}
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
        onUpgradeVillage={(territoryId) => GameEvents.emit('upgrade-village', territoryId)}
        onConstructBuilding={(territoryId, type: ConstructableType, slotIndex?: number) =>
          GameEvents.emit('construct-building', { territoryId, type, slotIndex })
        }
        onRepairCore={(territoryId) => GameEvents.emit('repair-territory-core', territoryId)}
      />

      <OfflineReportModal
        report={offlineReport}
        onClose={() => setOfflineReport(null)}
      />
    </div>
  );
}

export default App;
