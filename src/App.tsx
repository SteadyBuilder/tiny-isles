import { useEffect, useState } from 'react';
import { PhaserGame } from './game/PhaserGame';
import { HUD } from './components/HUD';
import { MobileControls } from './components/MobileControls';
import { MinimapModal } from './components/MinimapModal';
import { VillageBuildModal } from './components/VillageBuildModal';
import { SkillTargetingBanner } from './components/SkillTargetingBanner';
import { TowerPlacementBanner } from './components/TowerPlacementBanner';
import { MissionHudBanner } from './components/MissionHudBanner';
import { MissionResultModal } from './components/MissionResultModal';
import { PlayerProgressionHud } from './components/PlayerProgressionHud';
import { InventoryModal } from './components/InventoryModal';
import { JobAdvancementModal } from './components/JobAdvancementModal';
import { ToolShopModal } from './components/ToolShopModal';
import { MercenaryGuildModal } from './components/MercenaryGuildModal';
import { HudSettingsModal } from './components/HudSettingsModal';
import { HudHelpModal } from './components/HudHelpModal';
import { SoundModal } from './components/SoundModal';
import { CombatDamageOverlay } from './components/CombatDamageOverlay';
import { WaveInvasionOverlay } from './components/WaveInvasionOverlay';
import { WaveAnnouncementBanner } from './components/WaveAnnouncementBanner';
import { LobbyScreen } from './components/lobby/LobbyScreen';
import { RoomWaitingModal } from './components/lobby/RoomWaitingModal';
import { MetaProgressionModal } from './components/lobby/MetaProgressionModal';
import { PixelGameButton } from './components/ui/PixelGameButton';
import { WoodModalFrame } from './components/ui/WoodModalFrame';
import { ConstructableType } from './types/game';
import { GameEvents } from './game/events/gameEvents';
import { sound, SoundSettings } from './lib/sound';
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
    showInventoryModal,
    setShowInventoryModal,
    showJobHallModal,
    setShowJobHallModal,
    isNearJobHall,
    showToolShopModal,
    setShowToolShopModal,
    isNearToolShop,
    showMercenaryGuildModal,
    setShowMercenaryGuildModal,
    isNearMercenaryGuild,
    mercenaries,
    playerProgression,
    dashState,
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
    resetSessionShellState,
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
    handleLeaveToLobby: leaveRoomToLobby,
    handleUpgradeTrait,
    handleSelectOrUnlockTitle,
    handleSelectOrUnlockCostume,
    handleSelectOrUnlockAura,
    handleResetTraits,
  } = useRoomLobbyState(playerId, profile.name, profile.color);

  const handleLeaveToLobby = () => {
    leaveRoomToLobby();
    resetSessionShellState();
  };

  const [showLobbySettings, setShowLobbySettings] = useState(false);
  const [showLobbySound, setShowLobbySound] = useState(false);
  const [showLobbyHelp, setShowLobbyHelp] = useState(false);
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(() => sound.getSettings());

  useEffect(() => {
    const unsub = sound.subscribe((updated) => setSoundSettings(updated));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (sessionStatus !== 'playing' && showInventoryModal) {
      setShowInventoryModal(false);
    }
  }, [sessionStatus, showInventoryModal, setShowInventoryModal]);

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
          onOpenSettingsModal={() => setShowLobbySettings(true)}
          onOpenHelpModal={() => setShowLobbyHelp(true)}
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
          onSelectOrUnlockCostume={handleSelectOrUnlockCostume}
          onSelectOrUnlockAura={handleSelectOrUnlockAura}
          onResetTraits={handleResetTraits}
        />

        <HudSettingsModal
          isOpen={showLobbySettings}
          onClose={() => setShowLobbySettings(false)}
          playerName={profile.name}
          setPlayerName={handleUpdateName}
          playerColor={profile.color}
          setPlayerColor={handleUpdateColor}
          soundSettings={soundSettings}
          isMuted={soundSettings.muted}
          onToggleSound={() => sound.toggleMute()}
          onOpenSoundModal={() => setShowLobbySound(true)}
          onOpenHelp={() => setShowLobbyHelp(true)}
        />

        <SoundModal isOpen={showLobbySound} onClose={() => setShowLobbySound(false)} />
        <HudHelpModal isOpen={showLobbyHelp} onClose={() => setShowLobbyHelp(false)} />
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
        missionProgress={missionProgress}
        roomMode={roomConfig.mode}
        onTogglePause={toggleSoloPause}
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
        progression={playerProgression}
        dashState={dashState}
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
        onRepairBuilding={(buildingId) => GameEvents.emit('repair-building', buildingId)}
      />

      <TowerPlacementBanner />
      <SkillTargetingBanner />

      <PlayerProgressionHud
        progression={playerProgression}
        dashState={dashState}
        hasJobHallBuilt={constructedBuildings.some((b) => b.type === 'job_hall' && b.hp > 0)}
        isNearJobHall={isNearJobHall}
        hasToolShopBuilt={constructedBuildings.some((b) => b.type === 'tool_shop' && b.hp > 0)}
        isNearToolShop={isNearToolShop}
        onOpenInventory={() => setShowInventoryModal(true)}
        onOpenJobHall={() => setShowJobHallModal(true)}
        onOpenToolShop={() => setShowToolShopModal(true)}
      />

      <InventoryModal
        isOpen={showInventoryModal && sessionStatus === 'playing'}
        onClose={() => setShowInventoryModal(false)}
        progression={playerProgression}
      />

      <JobAdvancementModal
        isOpen={showJobHallModal}
        onClose={() => setShowJobHallModal(false)}
        progression={playerProgression}
        hasJobHallBuilt={constructedBuildings.some((b) => b.type === 'job_hall' && b.hp > 0)}
        isNearJobHall={isNearJobHall}
      />

      <ToolShopModal
        isOpen={showToolShopModal}
        onClose={() => setShowToolShopModal(false)}
        progression={playerProgression}
        playerHp={playerHp}
        gold={inventory.gold}
        hasToolShopBuilt={constructedBuildings.some((b) => b.type === 'tool_shop' && b.hp > 0)}
        isNearToolShop={isNearToolShop}
      />

      <MercenaryGuildModal
        isOpen={showMercenaryGuildModal}
        onClose={() => setShowMercenaryGuildModal(false)}
        meat={inventory.meat}
        gold={inventory.gold}
        hasGuildBuilt={constructedBuildings.some((b) => b.type === 'mercenary_guild' && b.hp > 0)}
        isNearGuild={isNearMercenaryGuild}
        mercenaries={mercenaries}
      />

      {sessionStatus === 'paused' && (
        <WoodModalFrame
          title="일시정지"
          ribbonVariant="blue"
          maxWidthClass="max-w-xs"
          onClose={toggleSoloPause}
        >
          <div className="ts-paper-sheet p-3 text-center">
            <p className="text-xs font-bold text-[#4a301e]">
              솔로 원정 진행이 일시정지되었습니다.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <PixelGameButton
              label="계속하기 (ESC)"
              iconSrc="/assets/ui/Icons/Icon_05.png"
              variant="blue"
              size="md"
              fullWidth
              onClick={toggleSoloPause}
            />
            <PixelGameButton
              label="원정 포기 및 로비로"
              variant="red"
              size="sm"
              fullWidth
              onClick={handleLeaveToLobby}
            />
          </div>
        </WoodModalFrame>
      )}

      <MissionResultModal result={missionResult} onReturnToLobby={handleLeaveToLobby} />
      <WaveInvasionOverlay />
      <WaveAnnouncementBanner />
      <CombatDamageOverlay />
    </div>
  );
}

export default App;
