import React, { useState, useEffect } from 'react';
import { CenterVillageHp, Inventory, PlayerColor, PlayerHpState, WaveState } from '../types/game';
import { MissionProgressState, RoomMode } from '../types/room';
import { sound, SoundSettings } from '../lib/sound';
import { SoundModal } from './SoundModal';
import { HudSettingsModal } from './HudSettingsModal';
import { HudHelpModal } from './HudHelpModal';
import { HudDesktopBar } from './hud/HudDesktopBar';
import { HudWaveSection } from './hud/HudWaveSection';
import { HudMobileBar } from './hud/HudMobileBar';
import { ThreatOrbOverlay } from './hud/ThreatOrbOverlay';

interface HUDProps {
  inventory: Inventory;
  onlineCount: number;
  playerName: string;
  setPlayerName: (name: string) => void;
  playerColor: PlayerColor;
  setPlayerColor: (color: PlayerColor) => void;
  playerHp?: PlayerHpState;
  unlockedCount?: number;
  totalIslands?: number;
  waveState?: WaveState;
  centerVillageHp?: CenterVillageHp;
  alertMessage?: string | null;
  missionProgress?: MissionProgressState | null;
  roomMode?: RoomMode;
  onTogglePause?: () => void;
  onOpenMinimap?: () => void;
  onTriggerRegularWave?: () => void;
  onTriggerBossWave?: () => void;
  onSummonEarlyWave?: () => void;
  onAddTestThreat?: () => void;
  onAddTestResources?: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  inventory,
  onlineCount,
  playerName,
  setPlayerName,
  playerColor,
  setPlayerColor,
  playerHp,
  unlockedCount = 1,
  totalIslands = 21,
  waveState,
  centerVillageHp,
  alertMessage,
  missionProgress,
  roomMode,
  onTogglePause,
  onOpenMinimap,
  onTriggerRegularWave,
  onTriggerBossWave,
  onSummonEarlyWave,
  onAddTestThreat,
  onAddTestResources,
}) => {
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(() => sound.getSettings());
  const [isMuted, setIsMuted] = useState(sound.isMuted());
  const [showSoundModal, setShowSoundModal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showTestMenu, setShowTestMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsub = sound.subscribe((updated) => {
      setSoundSettings(updated);
      setIsMuted(updated.muted);
    });
    return () => unsub();
  }, []);

  const toggleSound = () => {
    sound.toggleMute();
    sound.playClick();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openSettings = () => {
    sound.playClick();
    setShowSettingsModal(true);
  };

  return (
    <>
      <ThreatOrbOverlay />
      {/* 1. DESKTOP HUD (sm: and above) */}
      <div className="hidden sm:flex absolute top-2.5 left-3 right-3 z-30 flex-col gap-1.5 pointer-events-none">
        <HudDesktopBar
          inventory={inventory}
          onlineCount={onlineCount}
          playerHp={playerHp}
          unlockedCount={unlockedCount}
          totalIslands={totalIslands}
          isMuted={isMuted}
          copied={copied}
          onCopyLink={handleCopyLink}
          onToggleSound={toggleSound}
          onOpenMinimap={onOpenMinimap}
          onOpenSettings={openSettings}
        />

        <HudWaveSection
          waveState={waveState}
          centerVillageHp={centerVillageHp}
          onlineCount={onlineCount}
          alertMessage={alertMessage}
          onTriggerRegularWave={onTriggerRegularWave}
          onTriggerBossWave={onTriggerBossWave}
          onSummonEarlyWave={onSummonEarlyWave}
          onAddTestThreat={onAddTestThreat}
          onAddTestResources={onAddTestResources}
          showTestMenu={showTestMenu}
        />
      </div>

      {/* 2. MOBILE HUD (sm:hidden) */}
      <HudMobileBar
        inventory={inventory}
        playerHp={playerHp}
        unlockedCount={unlockedCount}
        totalIslands={totalIslands}
        waveState={waveState}
        centerVillageHp={centerVillageHp}
        alertMessage={alertMessage}
        missionProgress={missionProgress}
        roomMode={roomMode}
        onTogglePause={onTogglePause}
        onOpenMinimap={onOpenMinimap}
        onOpenSettings={openSettings}
        onTriggerRegularWave={onTriggerRegularWave}
        onTriggerBossWave={onTriggerBossWave}
        showTestMenu={showTestMenu}
      />

      <HudSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        playerName={playerName}
        setPlayerName={setPlayerName}
        playerColor={playerColor}
        setPlayerColor={setPlayerColor}
        soundSettings={soundSettings}
        isMuted={isMuted}
        onToggleSound={toggleSound}
        onOpenSoundModal={() => setShowSoundModal(true)}
        onOpenHelp={() => setShowHelp(true)}
        isTestMenuVisible={showTestMenu}
        onToggleTestMenu={() => setShowTestMenu((prev) => !prev)}
        hasSubModalOpen={showSoundModal || showHelp}
      />

      <HudHelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />

      <SoundModal isOpen={showSoundModal} onClose={() => setShowSoundModal(false)} />
    </>
  );
};
