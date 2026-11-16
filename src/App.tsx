import { PhaserGame } from './game/PhaserGame';
import { HUD } from './components/HUD';
import { MobileControls } from './components/MobileControls';
import { MinimapModal } from './components/MinimapModal';
import { VillageBuildModal } from './components/VillageBuildModal';
import { TowerPlacementBanner } from './components/TowerPlacementBanner';
import { MissionHudBanner } from './components/MissionHudBanner';
import { MissionResultModal } from './components/MissionResultModal';
import { LobbyScreen } from './components/lobby/LobbyScreen';
import { RoomWaitingModal } from './components/lobby/RoomWaitingModal';
import { MetaProgressionModal } from './components/lobby/MetaProgressionModal';
import { ConstructableType } from './types/game';
import { GameEvents } from './game/events/gameEvents';
import { useGameShellState } from './hooks/useGameShellState';
import { useRoomLobbyState } from './hooks/useRoomLobbyState';

export function App() {
  const {
    playerId,
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
    showVillageModal,
    setShowVillageModal,
    alertMessage,
    zoom,
    nearIsland,
    setNearIsland,
    showMinimapModal,
    setShowMinimapModal,
    playerGridPos,
    setPlayerGridPos,
    playerStandingTerritoryId,
    playerHp,
    joystickRef,
    canBuildInCurrentTerritory,
    handleShowAlert,
    handleUpdateName,
    handleUpdateColor,
    handleUpdateInventory,
    handleUnlockedCountChange,
    handleMobileAction,
    handleZoomChange,
    handleOpenVillageModalForCurrent,
    handleOpenVillageModalById,
  } = useGameShellState();

  const {
    sessionStatus,
    roomConfig,
    waitingMembers,
    isLobbyHost,
    showMetaModal,
    setShowMetaModal,
    meta,
    metaBonuses,
    missionProgress,
    missionResult,
    toggleSoloPause,
    handleStartSolo,
    handleCreateCoopRoom,
    handleJoinCoopRoom,
    handleStartCoopMatch,
    handleLeaveToLobby,
    handleUpgradeTrait,
    handleSelectOrUnlockTitle,
  } = useRoomLobbyState(playerId, profile.name, profile.color);

  if (sessionStatus === 'lobby' || sessionStatus === 'waiting') {
    return (
      <>
        <LobbyScreen
          playerName={profile.name}
          playerColor={profile.color}
          meta={meta}
          onStartSolo={handleStartSolo}
          onCreateCoopRoom={handleCreateCoopRoom}
          onJoinCoopRoom={handleJoinCoopRoom}
          onOpenMetaModal={() => setShowMetaModal(true)}
        />

        {sessionStatus === 'waiting' && (
          <RoomWaitingModal
            roomConfig={roomConfig}
            members={waitingMembers}
            isHost={isLobbyHost}
            onStartMatch={handleStartCoopMatch}
            onLeaveRoom={handleLeaveToLobby}
          />
        )}

        <MetaProgressionModal
          isOpen={showMetaModal}
          meta={meta}
          onClose={() => setShowMetaModal(false)}
          onUpgradeTrait={handleUpgradeTrait}
          onSelectOrUnlockTitle={handleSelectOrUnlockTitle}
        />
      </>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1a331a]">
      <HUD
        inventory={inventory}
        onlineCount={onlineCount}
        playerName={profile.name}
        setPlayerName={handleUpdateName}
        playerColor={profile.color}
        setPlayerColor={handleUpdateColor}
        playerHp={playerHp}
        unlockedCount={islandStats.unlocked}
        totalIslands={islandStats.total}
        waveState={waveState}
        alertMessage={alertMessage}
        onOpenMinimap={() => setShowMinimapModal(true)}
        onTriggerRegularWave={() => GameEvents.emit('trigger-regular-wave')}
        onTriggerBossWave={() => GameEvents.emit('trigger-boss-wave')}
        onSummonEarlyWave={() => GameEvents.emit('summon-early-wave', { isBossWave: false })}
        onAddTestThreat={() => GameEvents.emit('add-threat', 25)}
        onAddTestResources={() => GameEvents.emit('add-test-resources')}
      />

      <MissionHudBanner
        progress={missionProgress}
        roomMode={roomConfig.mode}
        onTogglePause={toggleSoloPause}
      />

      <PhaserGame
        key={roomConfig.roomId}
        playerName={profile.name}
        playerColor={profile.color}
        roomConfig={roomConfig}
        metaBonuses={metaBonuses}
        inventory={inventory}
        onUpdateInventory={handleUpdateInventory}
        onlineCount={onlineCount}
        setOnlineCount={setOnlineCount}
        onUnlockedCountChange={handleUnlockedCountChange}
        onUnlockedIslandIdsChange={setUnlockedIslandIds}
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

      <MobileControls
        onAction={handleMobileAction}
        onOpenVillageModal={handleOpenVillageModalForCurrent}
        canBuild={canBuildInCurrentTerritory}
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
        playerId={playerId}
        playerStandingTerritoryId={playerStandingTerritoryId}
        playerColor={profile.color}
        playerName={profile.name}
        onManageTerritory={handleOpenVillageModalById}
      />

      <VillageBuildModal
        isOpen={showVillageModal}
        onClose={() => setShowVillageModal(false)}
        territories={territories}
        playerId={playerId}
        playerStandingTerritoryId={playerStandingTerritoryId}
        constructedBuildings={constructedBuildings}
        inventory={inventory}
        onUpgradeVillage={(territoryId) => GameEvents.emit('upgrade-village', territoryId)}
        onConstructBuilding={(territoryId, type: ConstructableType, slotIndex?: number) =>
          GameEvents.emit('construct-building', { territoryId, type, slotIndex })
        }
        onSelectTowerPlacement={(territoryId, type: ConstructableType) =>
          GameEvents.emit('enter-tower-placement', { territoryId, type })
        }
        onRepairCore={(territoryId) => GameEvents.emit('repair-territory-core', territoryId)}
      />

      <TowerPlacementBanner />

      {sessionStatus === 'paused' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-xs rounded-3xl border border-amber-400/50 bg-slate-900 p-6 text-center text-white space-y-4 shadow-2xl">
            <h2 className="text-xl font-black text-amber-300">일시정지</h2>
            <p className="text-xs text-slate-300">솔로 원정 진행이 일시정지되었습니다.</p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={toggleSoloPause}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-bold transition"
              >
                계속하기 (ESC)
              </button>
              <button
                type="button"
                onClick={handleLeaveToLobby}
                className="w-full py-2.5 rounded-xl bg-red-600/80 hover:bg-red-500 text-sm font-bold transition"
              >
                원정 포기 및 로비로
              </button>
            </div>
          </div>
        </div>
      )}

      <MissionResultModal result={missionResult} onReturnToLobby={handleLeaveToLobby} />
    </div>
  );
}

export default App;
