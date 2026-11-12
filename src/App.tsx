import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GameCanvas } from './game/GameCanvas';
import { PhaserGame } from './game/PhaserGame';
import { HUD } from './components/HUD';
import { MobileControls } from './components/MobileControls';
import { MinimapModal } from './components/MinimapModal';
import { Inventory, Island, PlayerColor } from './types/game';
import { storage } from './lib/storage';
import { serverSync } from './lib/serverSync';
import { INITIAL_ISLANDS } from './game/constants';

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

  // 탭 닫기/새로고침 시 대기 중인 플레이어 자원/프로필 즉시 서버에 플러시
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

  // Camera Zoom state (0.5x to 2.0x, with localStorage persistence)
  const [zoom, setZoom] = useState<number>(() => storage.loadZoom());

  // Mobile state
  const [nearIsland, setNearIsland] = useState<Island | null>(null);
  const [showMinimapModal, setShowMinimapModal] = useState<boolean>(false);
  const [playerGridPos, setPlayerGridPos] = useState<{ gridX: number; gridY: number }>({ gridX: 0, gridY: 0 });

  // Virtual Joystick Vector (mutable ref for 60fps performance without re-render)
  const joystickRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // 프로필(이름, 색상) 변경 시 영속화 및 서버 동기화
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

  // 인벤토리 변경 시 영속화 및 서버 동기화
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
    if (window.confirm('정말 게임 진행상황(자원 및 개척된 영지)을 초기화하시겠습니까?')) {
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

  // Engine switch state (Phaser 3 default vs Canvas 2D)
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
        onResetGame={handleResetGame}
        onOpenMinimap={() => setShowMinimapModal(true)}
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
