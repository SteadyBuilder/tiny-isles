import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GameCanvas } from './game/GameCanvas';
import { DefenseHUD } from './components/DefenseHUD';
import { BuildHotbar } from './components/BuildHotbar';
import { MobileControls } from './components/MobileControls';
import { SessionModal } from './components/SessionModal';
import { MinimapModal } from './components/MinimapModal';
import { Inventory, Island, PlayerColor, BuildingType, DefenseSession } from './types/game';
import { storage } from './lib/storage';
import { serverSync } from './lib/serverSync';
import { INITIAL_ISLANDS } from './game/constants';

export function App() {
  const playerIdRef = useRef<string>(storage.getPlayerId());
  const [profile, setProfile] = useState(() => storage.loadProfile());
  const [inventory, setInventory] = useState<Inventory>(() => {
    const saved = storage.loadInventory();
    // 시작 시 기본 건축 자원(방책 2개 지을 수 있는 목재) 보너스 제공
    return {
      wood: Math.max(saved.wood, 15),
      stone: Math.max(saved.stone, 10),
      gold: saved.gold,
    };
  });
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [unlockedIslandIds, setUnlockedIslandIds] = useState<number[]>(() => {
    const saved = storage.loadUnlockedIslands();
    return saved.length > 0 ? saved : [0];
  });
  const [islandStats, setIslandStats] = useState({
    unlocked: unlockedIslandIds.length,
    total: INITIAL_ISLANDS.length,
  });

  // Defense Session State (30분 / 60분 모드)
  const [session, setSession] = useState<DefenseSession>({
    modeMinutes: 30,
    elapsedSeconds: 0,
    waveIndex: 0,
    waveIncoming: false,
    timeToNextWave: 600, // 10분 후 첫 침공
    isBossWave: false,
    totalWaves: 3,
    isGameOver: false,
    isVictory: false,
  });

  const [showSessionModal, setShowSessionModal] = useState<boolean>(true);

  // Capital Core & Player Health
  const [capitalCoreHp, setCapitalCoreHp] = useState<number>(500);
  const [maxCapitalCoreHp, setMaxCapitalCoreHp] = useState<number>(500);
  const [playerHp, setPlayerHp] = useState<number>(100);
  const [maxPlayerHp, setMaxPlayerHp] = useState<number>(100);
  const [incomingMonsterCount, setIncomingMonsterCount] = useState<number>(0);
  const [warningDirection, setWarningDirection] = useState<
    'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW' | null
  >(null);

  // Construction State
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingType | null>(null);
  const [isBuildHotbarOpen, setIsBuildHotbarOpen] = useState<boolean>(false);

  // Contextual Interaction State
  const [isNearCore, setIsNearCore] = useState<boolean>(false);
  const [isNearVillageCenter, setIsNearVillageCenter] = useState<boolean>(false);

  // Camera Zoom state (0.5x to 2.0x, mobile defaults to 0.85 for wide FOV)
  const [zoom, setZoom] = useState<number>(() => {
    const saved = storage.loadZoom();
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 0.85;
    }
    return saved;
  });

  // Mobile state
  const [nearIsland, setNearIsland] = useState<Island | null>(null);
  const [showMinimapModal, setShowMinimapModal] = useState<boolean>(false);
  const [playerGridPos, setPlayerGridPos] = useState<{ gridX: number; gridY: number }>({
    gridX: 0,
    gridY: 0,
  });

  // Virtual Joystick Vector
  const joystickRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // 세션 모드 선택
  const handleSelectMode = (minutes: 30 | 60) => {
    setSession({
      modeMinutes: minutes,
      elapsedSeconds: 0,
      waveIndex: 0,
      waveIncoming: false,
      timeToNextWave: minutes === 30 ? 600 : 900,
      isBossWave: false,
      totalWaves: minutes === 30 ? 3 : 4,
      isGameOver: false,
      isVictory: false,
    });
    setShowSessionModal(false);
  };

  const handleRestartSession = () => {
    storage.resetAll();
    window.location.reload();
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

  // 액션 이벤트 트리거
  const handleMobileAction = useCallback(() => {
    window.dispatchEvent(new CustomEvent('player-action'));
  }, []);

  const handleMobileDash = useCallback(() => {
    window.dispatchEvent(new CustomEvent('player-dash'));
  }, []);

  const handleMobileBuildCurrent = useCallback(() => {
    window.dispatchEvent(new CustomEvent('player-build'));
  }, []);

  const handleCallWaveEarly = useCallback(() => {
    window.dispatchEvent(new CustomEvent('call-wave'));
  }, []);

  const handleInteractCore = useCallback(() => {
    window.dispatchEvent(new CustomEvent('player-interact-core'));
  }, []);

  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
    storage.saveZoom(newZoom);
  }, []);

  // Capital Core HP 상태 업데이트 수신
  const handleCapitalCoreHpChange = useCallback((hp: number, maxHp: number) => {
    setCapitalCoreHp(hp);
    setMaxCapitalCoreHp(maxHp);
  }, []);

  const handlePlayerHpChange = useCallback((hp: number, maxHp: number) => {
    setPlayerHp(hp);
    setMaxPlayerHp(maxHp);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1e3d59] touch-none select-none">
      {/* 1. 상단 디펜스 HUD */}
      <DefenseHUD
        inventory={inventory}
        session={session}
        capitalCoreHp={capitalCoreHp}
        maxCapitalCoreHp={maxCapitalCoreHp}
        playerHp={playerHp}
        maxPlayerHp={maxPlayerHp}
        onCallWaveEarly={handleCallWaveEarly}
        onOpenMinimap={() => setShowMinimapModal(true)}
        onToggleBuildHotbar={() => setIsBuildHotbarOpen((prev) => !prev)}
        isBuildHotbarOpen={isBuildHotbarOpen}
        incomingMonsterCount={incomingMonsterCount}
        warningDirection={warningDirection}
      />

      {/* 2. 게임 메인 캔버스 */}
      <GameCanvas
        playerName={profile.name}
        playerColor={profile.color}
        inventory={inventory}
        onUpdateInventory={handleUpdateInventory}
        onlineCount={onlineCount}
        setOnlineCount={setOnlineCount}
        onUnlockedCountChange={(unlocked, total) => setIslandStats({ unlocked, total })}
        onUnlockedIslandIdsChange={setUnlockedIslandIds}
        joystickRef={joystickRef}
        onNearIslandChange={setNearIsland}
        onPlayerPositionChange={setPlayerGridPos}
        onOpenMinimap={() => setShowMinimapModal(true)}
        zoom={zoom}
        onZoomChange={handleZoomChange}
        selectedBuilding={selectedBuilding}
        onBuildSuccess={() => {
          // 설치 완료 후 건물 선택 유지 (연속 배치 가능)
        }}
        session={session}
        onUpdateSession={setSession}
        onCapitalCoreHpChange={handleCapitalCoreHpChange}
        onPlayerHpChange={handlePlayerHpChange}
        onMonsterCountChange={setIncomingMonsterCount}
        onWarningDirectionChange={setWarningDirection}
        onNearCoreChange={setIsNearCore}
        onNearVillageCenterChange={setIsNearVillageCenter}
      />

      {/* 3. 모바일/PC 반응형 건설 핫바 */}
      <BuildHotbar
        selectedBuilding={selectedBuilding}
        onSelectBuilding={setSelectedBuilding}
        inventory={inventory}
        isOpen={isBuildHotbarOpen}
        onToggleOpen={() => setIsBuildHotbarOpen((prev) => !prev)}
      />

      {/* 4. 모바일 전용 터치 컨트롤러 (플로팅 조이스틱 + 액션 클러스터) */}
      <MobileControls
        onAction={handleMobileAction}
        onDash={handleMobileDash}
        onBuildCurrent={handleMobileBuildCurrent}
        onToggleBuildHotbar={() => setIsBuildHotbarOpen((prev) => !prev)}
        selectedBuilding={selectedBuilding}
        joystickRef={joystickRef}
        nearIsland={nearIsland}
        isNearCore={isNearCore}
        onInteractCore={handleInteractCore}
        isNearVillageCenter={isNearVillageCenter}
        onUpgradeVillage={handleInteractCore}
      />

      {/* 5. 세션 설정 / 승리 / 게임 오버 모달 */}
      <SessionModal
        isOpen={showSessionModal || session.isGameOver || session.isVictory}
        onSelectMode={handleSelectMode}
        isGameOver={session.isGameOver}
        isVictory={session.isVictory}
        onRestart={handleRestartSession}
        survivedTime={session.elapsedSeconds}
      />

      {/* 6. 미니맵 모달 */}
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
