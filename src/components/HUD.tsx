import React, { useState, useEffect } from 'react';
import { Inventory, Island, PlayerColor, WaveState } from '../types/game';
import { sound, SoundSettings } from '../lib/sound';
import { SoundModal } from './SoundModal';
import { HudSettingsModal } from './HudSettingsModal';
import { HudHelpModal } from './HudHelpModal';
import { HudDesktopBar } from './hud/HudDesktopBar';
import { HudWaveSection } from './hud/HudWaveSection';
import { HudMobileBar } from './hud/HudMobileBar';
import { VILLAGE_TIER_CONFIGS } from '../game/constants';

interface HUDProps {
  inventory: Inventory;
  onlineCount: number;
  playerName: string;
  setPlayerName: (name: string) => void;
  playerColor: PlayerColor;
  setPlayerColor: (color: PlayerColor) => void;
  unlockedCount?: number;
  totalIslands?: number;
  currentTerritory?: Island;
  waveState?: WaveState;
  alertMessage?: string | null;
  onResetGame?: () => void;
  onOpenMinimap?: () => void;
  onOpenVillageModal?: () => void;
  onTriggerRegularWave?: () => void;
  onTriggerBossWave?: () => void;
  onSummonEarlyWave?: () => void;
  onChangeTimeScale?: (scale: number) => void;
  onAddTestResources?: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  inventory,
  onlineCount,
  playerName,
  setPlayerName,
  playerColor,
  setPlayerColor,
  unlockedCount = 1,
  totalIslands = 21,
  currentTerritory,
  waveState,
  alertMessage,
  onResetGame,
  onOpenMinimap,
  onOpenVillageModal,
  onTriggerRegularWave,
  onTriggerBossWave,
  onSummonEarlyWave,
  onChangeTimeScale,
  onAddTestResources,
}) => {
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(() => sound.getSettings());
  const [isMuted, setIsMuted] = useState(sound.isMuted());
  const [showSoundModal, setShowSoundModal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
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

  const cycleTimeScale = () => {
    if (!waveState || !onChangeTimeScale) return;
    const next = waveState.timeScale === 1 ? 60 : waveState.timeScale === 60 ? 300 : 1;
    onChangeTimeScale(next);
  };

  const curTierCfg = currentTerritory
    ? VILLAGE_TIER_CONFIGS[currentTerritory.villageTier]
    : VILLAGE_TIER_CONFIGS[2];

  return (
    <>
      {/* 1. DESKTOP HUD (sm: and above) */}
      <div className="hidden sm:flex absolute top-3 left-4 right-4 z-30 flex-col gap-2 pointer-events-none">
        <HudDesktopBar
          inventory={inventory}
          onlineCount={onlineCount}
          unlockedCount={unlockedCount}
          totalIslands={totalIslands}
          currentTerritory={currentTerritory}
          tierName={curTierCfg.name}
          isMuted={isMuted}
          copied={copied}
          onCopyLink={handleCopyLink}
          onToggleSound={toggleSound}
          onOpenMinimap={onOpenMinimap}
          onOpenVillageModal={onOpenVillageModal}
          onOpenSettings={openSettings}
        />

        <HudWaveSection
          waveState={waveState}
          alertMessage={alertMessage}
          onTriggerRegularWave={onTriggerRegularWave}
          onTriggerBossWave={onTriggerBossWave}
          onSummonEarlyWave={onSummonEarlyWave}
          onCycleTimeScale={cycleTimeScale}
          onAddTestResources={onAddTestResources}
        />
      </div>

      {/* 2. MOBILE HUD (sm:hidden) */}
      <HudMobileBar
        inventory={inventory}
        unlockedCount={unlockedCount}
        totalIslands={totalIslands}
        currentTerritory={currentTerritory}
        waveState={waveState}
        alertMessage={alertMessage}
        onOpenMinimap={onOpenMinimap}
        onOpenVillageModal={onOpenVillageModal}
        onOpenSettings={openSettings}
        onTriggerRegularWave={onTriggerRegularWave}
        onTriggerBossWave={onTriggerBossWave}
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
        onResetGame={onResetGame}
      />

      <HudHelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />

      <SoundModal isOpen={showSoundModal} onClose={() => setShowSoundModal(false)} />
    </>
  );
};
