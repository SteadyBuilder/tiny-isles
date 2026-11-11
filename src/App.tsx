import React, { useState, useRef } from 'react';
import { GameCanvas } from './game/GameCanvas';
import { HUD } from './components/HUD';
import { MobileControls } from './components/MobileControls';
import { MinimapModal } from './components/MinimapModal';
import { Inventory, Island, PlayerColor } from './types/game';
import { storage } from './lib/storage';
import { INITIAL_ISLANDS } from './game/constants';

export function App() {
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

  // Mobile state
  const [nearIsland, setNearIsland] = useState<Island | null>(null);
  const [showMinimapModal, setShowMinimapModal] = useState<boolean>(false);
  const [playerGridPos, setPlayerGridPos] = useState<{ gridX: number; gridY: number }>({ gridX: 0, gridY: 0 });

  // Virtual Joystick Vector (mutable ref for 60fps performance without re-render)
  const joystickRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // 프로필(이름, 색상) 변경 시 영속화
  const handleUpdateName = (name: string) => {
    setProfile((prev) => {
      const next = { ...prev, name };
      storage.saveProfile(next);
      return next;
    });
  };

  const handleUpdateColor = (color: PlayerColor) => {
    setProfile((prev) => {
      const next = { ...prev, color };
      storage.saveProfile(next);
      return next;
    });
  };

  // 인벤토리 변경 시 영속화
  const handleUpdateInventory = (updater: (prev: Inventory) => Inventory) => {
    setInventory((prev) => {
      const next = updater(prev);
      storage.saveInventory(next);
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
    if (window.confirm('정말 게임 진행상황(자원 및 해금된 섬)을 초기화하시겠습니까?')) {
      storage.resetAll();
      window.location.reload();
    }
  };

  const handleMobileAction = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1e3d59]">
      <HUD
        inventory={inventory}
        onlineCount={onlineCount}
        playerName={profile.name}
        setPlayerName={handleUpdateName}
        playerColor={profile.color}
        setPlayerColor={handleUpdateColor}
        unlockedCount={islandStats.unlocked}
        totalIslands={islandStats.total}
        onResetGame={handleResetGame}
        onOpenMinimap={() => setShowMinimapModal(true)}
      />

      <GameCanvas
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
      />

      <MobileControls
        onAction={handleMobileAction}
        joystickRef={joystickRef}
        nearIsland={nearIsland}
      />

      <MinimapModal
        isOpen={showMinimapModal}
        onClose={() => setShowMinimapModal(false)}
        unlockedIslandIds={unlockedIslandIds}
        inventory={inventory}
        playerGridPos={playerGridPos}
        playerColor={profile.color}
        playerName={profile.name}
      />
    </div>
  );
}

export default App;
