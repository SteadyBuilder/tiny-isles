import React, { useState, useEffect } from 'react';
import { GameCanvas } from './game/GameCanvas';
import { HUD } from './components/HUD';
import { MobileControls } from './components/MobileControls';
import { Inventory, PlayerColor } from './types/game';

export function App() {
  const [playerName, setPlayerName] = useState(() => {
    return '모험가_' + Math.floor(100 + Math.random() * 900);
  });
  const [playerColor, setPlayerColor] = useState<PlayerColor>(() => {
    return Math.random() > 0.5 ? 'blue' : 'red';
  });
  const [inventory, setInventory] = useState<Inventory>({
    wood: 5,
    stone: 2,
    gold: 0,
  });
  const [onlineCount, setOnlineCount] = useState<number>(1);

  const handleMobileAction = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1e3d59]">
      <HUD
        inventory={inventory}
        onlineCount={onlineCount}
        playerName={playerName}
        setPlayerName={setPlayerName}
        playerColor={playerColor}
        setPlayerColor={setPlayerColor}
      />

      <GameCanvas
        playerName={playerName}
        playerColor={playerColor}
        inventory={inventory}
        onUpdateInventory={setInventory}
        onlineCount={onlineCount}
        setOnlineCount={setOnlineCount}
      />

      <MobileControls onAction={handleMobileAction} />
    </div>
  );
}

export default App;
