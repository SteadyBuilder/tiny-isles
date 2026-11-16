import { useCallback, useEffect, useRef, useState } from 'react';
import { THREAT_WAVE_CONFIG } from '../data/worldRules';
import { INITIAL_ISLANDS } from '../game/constants';
import { GameEvents } from '../game/events/gameEvents';
import { serverSync } from '../lib/serverSync';
import { storage } from '../lib/storage';
import { isPlayDataResetting, markPlayDataResetting } from '../lib/adminResetService';
import { worldStateSync } from '../lib/worldStateSync';
import { canBuildInTerritory } from '../game/territoryAccessRules';
import {
  ConstructedBuilding,
  Inventory,
  Island,
  PlayerColor,
  PlayerHpState,
  WaveState,
} from '../types/game';

/**
 * 게임 쉘(프로필, 인벤토리, 영지, 웨이브, 모달, 서버 동기화, 단축키) 상태를 통합 관리하는 커스텀 훅
 */
export function useGameShellState() {
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

  const [territories, setTerritories] = useState<Island[]>(() => INITIAL_ISLANDS);
  const [constructedBuildings, setConstructedBuildings] = useState<ConstructedBuilding[]>(() =>
    storage.loadConstructedBuildings()
  );
  const [waveState, setWaveState] = useState<WaveState>({
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
  });

  const [showVillageModal, setShowVillageModal] = useState<boolean>(false);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<number>(0);
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
  const [defenseFailedResetAt, setDefenseFailedResetAt] = useState<string | null>(null);
  const joystickRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const handleHpUpdated = (next: PlayerHpState) => {
      setPlayerHp(next);
    };
    const handleDefenseFailed = (payload?: { resetAt?: string }) => {
      const resetAt = payload?.resetAt || new Date().toISOString();
      setDefenseFailedResetAt(resetAt);
    };
    GameEvents.on('player-hp-updated', handleHpUpdated);
    GameEvents.on('world-defense-failed', handleDefenseFailed);
    return () => {
      GameEvents.off('player-hp-updated', handleHpUpdated);
      GameEvents.off('world-defense-failed', handleDefenseFailed);
    };
  }, []);

  // 미접속 플레이어가 재접속했을 때 본진 파괴로 인한 세계 초기화 공지 확인
  useEffect(() => {
    let isMounted = true;
    const prevLastActiveAt = localStorage.getItem('tiny_isles_last_active_at');
    const lastSeenResetAt = localStorage.getItem('tiny_isles_last_seen_reset_at');
    localStorage.setItem('tiny_isles_last_active_at', new Date().toISOString());

    worldStateSync.fetchLatestDefenseResetAt().then((resetAt) => {
      if (!isMounted || !resetAt) return;
      const resetMs = Date.parse(resetAt);
      const prevActiveMs = prevLastActiveAt ? Date.parse(prevLastActiveAt) : NaN;
      const lastSeenMs = lastSeenResetAt ? Date.parse(lastSeenResetAt) : NaN;

      const playedBeforeReset = !Number.isNaN(prevActiveMs) && prevActiveMs < resetMs;
      const notYetAcknowledged = Number.isNaN(lastSeenMs) || lastSeenMs < resetMs;

      if (playedBeforeReset && notYetAcknowledged) {
        markPlayDataResetting(true);
        storage.resetAll();
        setDefenseFailedResetAt(resetAt);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleShowAlert = useCallback((msg: string) => {
    setAlertMessage(msg);
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    alertTimerRef.current = setTimeout(() => {
      setAlertMessage(null);
    }, 6500);
  }, []);

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
        const syncedInventory = {
          wood: saved.wood,
          stone: saved.stone,
          gold: saved.gold,
        };
        setInventory(syncedInventory);
        storage.saveInventory(syncedInventory);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!isPlayDataResetting()) {
        serverSync.flushPlayerSync();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, []);

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

  const handleConfirmDefenseFailed = useCallback(() => {
    if (defenseFailedResetAt) {
      try {
        localStorage.setItem('tiny_isles_last_seen_reset_at', defenseFailedResetAt);
        localStorage.setItem('tiny_isles_last_active_at', new Date().toISOString());
      } catch {
        // ignore storage error
      }
    }
    setDefenseFailedResetAt(null);
    window.location.reload();
  }, [defenseFailedResetAt]);

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
    defenseFailedResetAt,
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
    handleConfirmDefenseFailed,
  };
}
