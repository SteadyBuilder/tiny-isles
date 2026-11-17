import { useCallback, useEffect, useRef, useState } from 'react';
import { THREAT_WAVE_CONFIG } from '../data/worldRules';
import { getInitialConstructedBuildings, INITIAL_ISLANDS } from '../game/constants';
import { GameEvents } from '../game/events/gameEvents';
import { storage } from '../lib/storage';
import { canBuildInTerritory } from '../game/territoryAccessRules';
import {
  ConstructedBuilding,
  Inventory,
  Island,
  PlayerColor,
  PlayerHpState,
  PlayerProgressionState,
  WaveState,
} from '../types/game';

const INITIAL_SESSION_INVENTORY: Inventory = {
  wood: 30,
  stone: 20,
  gold: 10,
};

const INITIAL_PLAYER_PROGRESSION: PlayerProgressionState = {
  level: 1,
  exp: 0,
  nextLevelExp: 60,
  jobPoints: 0,
  classId: 'pawn',
  skillCooldownRemainingMs: 0,
  skillCooldownMaxMs: 7000,
  equipped: {
    weapon: null,
    armor: null,
    relic: null,
  },
  bagItems: [],
  totalAttack: 18,
  totalMaxHp: 100,
  totalSpeed: 230,
};

function createInitialWaveState(): WaveState {
  return {
    threatPercent: 0,
    warningThreshold: THREAT_WAVE_CONFIG.warningThreshold,
    wavesUntilBoss: THREAT_WAVE_CONFIG.bossEveryNWaves,
    waveCount: 0,
    bossWaveCount: 0,
    activeMonstersCount: 0,
    countdownSecondsRemaining: null,
    nextWaveIsBoss: false,
    activeBoss: null,
    lastWaveMessage: null,
  };
}

/**
 * 게임 쉘(프로필, 세션 인벤토리, 영지, 웨이브, 모달, 단축키) 상태를 통합 관리하는 커스텀 훅
 */
export function useGameShellState() {
  const playerIdRef = useRef<string>(storage.getPlayerId());
  const [profile, setProfile] = useState(() => storage.loadProfile());
  const [inventory, setInventory] = useState<Inventory>(INITIAL_SESSION_INVENTORY);
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [unlockedIslandIds, setUnlockedIslandIds] = useState<number[]>([0]);
  const [islandStats, setIslandStats] = useState({
    unlocked: 1,
    total: INITIAL_ISLANDS.length,
  });

  const [territories, setTerritories] = useState<Island[]>(() => INITIAL_ISLANDS);
  const [constructedBuildings, setConstructedBuildings] = useState<ConstructedBuilding[]>(() =>
    getInitialConstructedBuildings()
  );
  const [waveState, setWaveState] = useState<WaveState>(createInitialWaveState);

  const [showVillageModal, setShowVillageModal] = useState<boolean>(false);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<number>(0);
  const [showInventoryModal, setShowInventoryModal] = useState<boolean>(false);
  const [showJobHallModal, setShowJobHallModal] = useState<boolean>(false);
  const [playerProgression, setPlayerProgression] = useState<PlayerProgressionState>(
    INITIAL_PLAYER_PROGRESSION
  );
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [zoom, setZoom] = useState<number>(() => storage.loadZoom());
  const [nearIsland, setNearIsland] = useState<Island | null>(null);
  const [showMinimapModal, setShowMinimapModal] = useState<boolean>(false);
  const [playerGridPos, setPlayerGridPos] = useState<{ gridX: number; gridY: number }>({
    gridX: 0,
    gridY: 0,
  });
  const [playerHp, setPlayerHp] = useState<PlayerHpState>({
    hp: 100,
    maxHp: 100,
    isFainted: false,
  });
  const joystickRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const handleHpUpdated = (next: PlayerHpState) => {
      setPlayerHp(next);
    };
    const handleProgressionUpdated = (next: PlayerProgressionState) => {
      setPlayerProgression(next);
    };
    const handleOpenJobHall = () => {
      setShowJobHallModal(true);
    };
    const handleOpenInventory = () => {
      setShowInventoryModal((prev) => !prev);
    };
    GameEvents.on('player-hp-updated', handleHpUpdated);
    GameEvents.on('player-progression-updated', handleProgressionUpdated);
    GameEvents.on('open-job-hall-modal', handleOpenJobHall);
    GameEvents.on('open-inventory-modal', handleOpenInventory);
    return () => {
      GameEvents.off('player-hp-updated', handleHpUpdated);
      GameEvents.off('player-progression-updated', handleProgressionUpdated);
      GameEvents.off('open-job-hall-modal', handleOpenJobHall);
      GameEvents.off('open-inventory-modal', handleOpenInventory);
    };
  }, []);

  const handleShowAlert = useCallback((msg: string) => {
    setAlertMessage(msg);
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    alertTimerRef.current = setTimeout(() => {
      setAlertMessage(null);
    }, 6500);
  }, []);

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

  const handleUpdateInventory = (updater: (prev: Inventory) => Inventory) => {
    setInventory((prev) => updater(prev));
  };

  const handleUnlockedCountChange = (unlocked: number, total: number) => {
    setIslandStats({ unlocked, total });
  };

  const handleMobileAction = useCallback(() => {
    GameEvents.emit('trigger-interact');
  }, []);

  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
    storage.saveZoom(newZoom);
  }, []);

  const playerStandingTerritory = territories.find(
    (t) => t.gridX === playerGridPos.gridX && t.gridY === playerGridPos.gridY
  );

  const currentTerritory =
    (playerStandingTerritory?.unlocked ? playerStandingTerritory : undefined) || territories[0];

  const canBuildInCurrentTerritory = canBuildInTerritory(
    playerStandingTerritory,
    playerIdRef.current,
    playerStandingTerritory?.id ?? null
  ).allowed;

  const handleOpenVillageModalForCurrent = useCallback(() => {
    const access = canBuildInTerritory(
      playerStandingTerritory,
      playerIdRef.current,
      playerStandingTerritory?.id ?? null
    );
    if (!access.allowed || !playerStandingTerritory) {
      handleShowAlert(access.reason || '메인 마을과 본인이 점령한 마을 영역 안에서만 건설할 수 있습니다.');
      return;
    }
    setSelectedTerritoryId(playerStandingTerritory.id);
    setShowVillageModal(true);
  }, [playerStandingTerritory, handleShowAlert]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'b' || e.key === 'B' || e.code === 'KeyB') {
        e.preventDefault();
        handleOpenVillageModalForCurrent();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleOpenVillageModalForCurrent]);

  const handleOpenVillageModalById = useCallback(
    (territoryId: number) => {
      const target = territories.find((t) => t.id === territoryId);
      const access = canBuildInTerritory(
        target,
        playerIdRef.current,
        playerStandingTerritory?.id ?? null
      );
      if (!access.allowed) {
        handleShowAlert(
          access.reason || '메인 마을과 본인이 점령한 마을 영역 안에서만 건설할 수 있습니다.'
        );
        return;
      }
      setSelectedTerritoryId(territoryId);
      setShowVillageModal(true);
    },
    [territories, playerStandingTerritory?.id, handleShowAlert]
  );

  const resetSessionShellState = useCallback(() => {
    setInventory(INITIAL_SESSION_INVENTORY);
    setOnlineCount(1);
    setUnlockedIslandIds([0]);
    setIslandStats({ unlocked: 1, total: INITIAL_ISLANDS.length });
    setTerritories(INITIAL_ISLANDS);
    setConstructedBuildings(getInitialConstructedBuildings());
    setWaveState(createInitialWaveState());
    setShowVillageModal(false);
    setSelectedTerritoryId(0);
    setShowInventoryModal(false);
    setShowJobHallModal(false);
    setPlayerProgression(INITIAL_PLAYER_PROGRESSION);
    setShowMinimapModal(false);
    setNearIsland(null);
    setPlayerGridPos({ gridX: 0, gridY: 0 });
    setPlayerHp({ hp: 100, maxHp: 100, isFainted: false });
    setAlertMessage(null);
    if (alertTimerRef.current) {
      clearTimeout(alertTimerRef.current);
      alertTimerRef.current = null;
    }
  }, []);

  return {
    playerId: playerIdRef.current,
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
    selectedTerritoryId,
    setSelectedTerritoryId,
    showInventoryModal,
    setShowInventoryModal,
    showJobHallModal,
    setShowJobHallModal,
    playerProgression,
    alertMessage,
    zoom,
    nearIsland,
    setNearIsland,
    showMinimapModal,
    setShowMinimapModal,
    playerGridPos,
    setPlayerGridPos,
    playerStandingTerritoryId: playerStandingTerritory?.id ?? null,
    playerHp,
    joystickRef,
    currentTerritory,
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
  };
}
