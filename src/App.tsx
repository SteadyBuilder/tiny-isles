import React, { useState, useEffect } from 'react';
import { GameCanvas } from './game/GameCanvas';
import { HUD } from './components/HUD';
import { MobileControls } from './components/MobileControls';
import { Inventory, PlayerColor } from './types/game';
import { storage } from './lib/storage';

export function App() {
  const [profile, setProfile] = useState(() => storage.loadProfile());
  const [inventory, setInventory] = useState<Inventory>(() => storage.loadInventory());
  const [onlineCount, setOnlineCount] = useState<number>(1);

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
        onResetGame={handleResetGame}
      />

      <GameCanvas
        playerName={profile.name}
        playerColor={profile.color}
        inventory={inventory}
        onUpdateInventory={handleUpdateInventory}
        onlineCount={onlineCount}
        setOnlineCount={setOnlineCount}
      />

      <MobileControls onAction={handleMobileAction} />
    </div>
  );
}

export default App;
