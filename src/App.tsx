import { PhaserGame } from './game/PhaserGame';
import { HUD } from './components/HUD';
import { MobileControls } from './components/MobileControls';
import { MinimapModal } from './components/MinimapModal';
import { VillageBuildModal } from './components/VillageBuildModal';
import { OfflineReportModal } from './components/OfflineReportModal';
import { ConstructableType } from './types/game';
import { GameEvents } from './game/events/gameEvents';
import { useGameShellState } from './hooks/useGameShellState';

export function App() {
  const {
    profile,
    inventory,
    onlineCount,
    setOnlineCount,
    unlockedIslandIds,
    setUnlockedIslandIds,
    islandStats,
    territories,
    setTerritories,
    constructedBuildings,
    setConstructedBuildings,
    waveState,
    setWaveState,
    offlineReport,
    setOfflineReport,
    showVillageModal,
    setShowVillageModal,
    selectedTerritoryId,
    setSelectedTerritoryId,
    alertMessage,
    zoom,
    nearIsland,
    setNearIsland,
    showMinimapModal,
    setShowMinimapModal,
    playerGridPos,
    setPlayerGridPos,
    joystickRef,
    currentTerritory,
    handleShowAlert,
    handleUpdateName,
    handleUpdateColor,
    handleUpdateInventory,
    handleUnlockedCountChange,
    handleResetGame,
    handleMobileAction,
    handleZoomChange,
    handleOpenVillageModalForCurrent,
    handleOpenVillageModalById,
  } = useGameShellState();

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
        onUnlockedIslandIdsChange={setUnlockedIslandIds}
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
