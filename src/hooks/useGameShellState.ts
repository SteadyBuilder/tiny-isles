import { useCallback, useEffect, useRef, useState } from 'react';
import { getRequiredExpForLevel } from '../data/classes';
import { PLAYER_DASH_CONFIG } from '../data/combatFeedbackConfig';
import { INITIAL_POTION_INVENTORY } from '../data/potions';
import { PLAYER_COMBAT_CONFIG, THREAT_WAVE_CONFIG } from '../data/worldRules';
import { getInitialConstructedBuildings, INITIAL_ISLANDS } from '../game/constants';
import { GameEvents } from '../game/events/gameEvents';
import { storage } from '../lib/storage';
import { canBuildInTerritory } from '../game/territoryAccessRules';
import { isSameInventory } from '../game/utils/inventoryUtils';
import { hasBlockingModifier, isEditableDomTarget } from '../game/utils/keyboardInputUtils';
import {
  ConstructedBuilding,
  DashCooldownState,
  Inventory,
  Island,
  MercenaryUnit,
  PlayerColor,
  PlayerHpState,
  PlayerProgressionState,
  WaveState,
} from '../types/game';

const INITIAL_SESSION_INVENTORY: Inventory = {
  wood: 30,
  stone: 20,
  gold: 10,
  meat: 0,
};

const INITIAL_PLAYER_PROGRESSION: PlayerProgressionState = {
  level: 1,
  exp: 0,
  nextLevelExp: getRequiredExpForLevel(1),
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
  potions: { ...INITIAL_POTION_INVENTORY },
  potionCooldownRemainingMs: 0,
  totalAttack: PLAYER_COMBAT_CONFIG.meleeDamage,
  totalMaxHp: PLAYER_COMBAT_CONFIG.maxHp,
  totalSpeed: 250,
  totalCritChance: 5,
  totalCritDamagePercent: 175,
  totalLifestealPercent: 0,
  totalCooldownReductionPercent: 0,
  totalAttackSpeedPercent: 0,
  totalSkillDamagePercent: 0,
  totalDamageReductionPercent: 0,
  totalThornsDamage: 0,
  totalHpRegenPerSec: 0,
  totalAttackRangeBonus: 0,
  activeSetBonuses: [],
};

const INITIAL_DASH_STATE: DashCooldownState = {
  cooldownRemainingMs: 0,
  cooldownMaxMs: PLAYER_DASH_CONFIG.cooldownMs,
  isDashing: false,
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
  const [isNearJobHall, setIsNearJobHall] = useState<boolean>(false);
  const [showToolShopModal, setShowToolShopModal] = useState<boolean>(false);
  const [isNearToolShop, setIsNearToolShop] = useState<boolean>(false);
  const [showMercenaryGuildModal, setShowMercenaryGuildModal] = useState<boolean>(false);
  const [isNearMercenaryGuild, setIsNearMercenaryGuild] = useState<boolean>(false);
  const [mercenaries, setMercenaries] = useState<MercenaryUnit[]>([]);
  const [playerProgression, setPlayerProgression] = useState<PlayerProgressionState>(
    INITIAL_PLAYER_PROGRESSION
  );
  const [dashState, setDashState] = useState<DashCooldownState>(INITIAL_DASH_STATE);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [zoom, setZoom] = useState<number>(() => storage.loadZoom());
  const [nearIsland, setNearIsland] = useState<Island | null>(null);
  const [showMinimapModal, setShowMinimapModal] = useState<boolean>(false);
  const [playerGridPos, setPlayerGridPos] = useState<{ gridX: number; gridY: number }>({
    gridX: 0,
    gridY: 0,
  });
  const [playerStandingTerritoryId, setPlayerStandingTerritoryId] = useState<number | null>(0);
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
    const handleDashStateUpdated = (next: DashCooldownState) => {
      setDashState(next);
    };
    const handleOpenJobHall = () => {
      setShowJobHallModal(true);
    };
    const handleJobHallProximity = (isNear: boolean) => {
      setIsNearJobHall(isNear);
    };
    const handleOpenToolShop = () => {
      setShowToolShopModal(true);
    };
    const handleToolShopProximity = (isNear: boolean) => {
      setIsNearToolShop(isNear);
    };
    const handleOpenMercGuild = () => {
      setShowMercenaryGuildModal(true);
    };
    const handleMercGuildProximity = (isNear: boolean) => {
      setIsNearMercenaryGuild(isNear);
    };
    const handleMercenariesUpdated = (next: MercenaryUnit[]) => {
      setMercenaries(next);
    };
    const handleOpenInventory = () => {
      setShowInventoryModal((prev) => !prev);
    };
    const handleStandingTerritoryChanged = (territoryId: number | null) => {
      setPlayerStandingTerritoryId(territoryId);
    };
    GameEvents.on('player-hp-updated', handleHpUpdated);
    GameEvents.on('player-progression-updated', handleProgressionUpdated);
    GameEvents.on('dash-state-updated', handleDashStateUpdated);
    GameEvents.on('open-job-hall-modal', handleOpenJobHall);
    GameEvents.on('job-hall-proximity-changed', handleJobHallProximity);
    GameEvents.on('open-tool-shop-modal', handleOpenToolShop);
    GameEvents.on('tool-shop-proximity-changed', handleToolShopProximity);
    GameEvents.on('open-mercenary-guild-modal', handleOpenMercGuild);
    GameEvents.on('mercenary-guild-proximity-changed', handleMercGuildProximity);
    GameEvents.on('mercenaries-updated', handleMercenariesUpdated);
    GameEvents.on('open-inventory-modal', handleOpenInventory);
    GameEvents.on('player-standing-territory-changed', handleStandingTerritoryChanged);
    return () => {
      GameEvents.off('player-hp-updated', handleHpUpdated);
      GameEvents.off('player-progression-updated', handleProgressionUpdated);
      GameEvents.off('dash-state-updated', handleDashStateUpdated);
      GameEvents.off('open-job-hall-modal', handleOpenJobHall);
      GameEvents.off('job-hall-proximity-changed', handleJobHallProximity);
      GameEvents.off('open-tool-shop-modal', handleOpenToolShop);
      GameEvents.off('tool-shop-proximity-changed', handleToolShopProximity);
      GameEvents.off('open-mercenary-guild-modal', handleOpenMercGuild);
      GameEvents.off('mercenary-guild-proximity-changed', handleMercGuildProximity);
      GameEvents.off('mercenaries-updated', handleMercenariesUpdated);
      GameEvents.off('open-inventory-modal', handleOpenInventory);
      GameEvents.off('player-standing-territory-changed', handleStandingTerritoryChanged);
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
    setInventory((prev) => {
      const next = updater(prev);
      return isSameInventory(prev, next) ? prev : next;
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

  const playerStandingTerritory =
    playerStandingTerritoryId !== null
      ? territories.find((t) => t.id === playerStandingTerritoryId)
      : undefined;

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
      if (e.defaultPrevented) return;
      if (isEditableDomTarget(e.target) || isEditableDomTarget(document.activeElement)) return;
      if (hasBlockingModifier(e)) return;
      if (e.code === 'KeyB' || e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        handleOpenVillageModalForCurrent();
      } else if (e.code === 'KeyM' || e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setShowMinimapModal((prev) => !prev);
      } else if (e.code === 'Digit1' || e.key === '1') {
        GameEvents.emit('use-potion', 'potion_small');
      } else if (e.code === 'Digit2' || e.key === '2') {
        GameEvents.emit('use-potion', 'potion_medium');
      } else if (e.code === 'Digit3' || e.key === '3') {
        GameEvents.emit('use-potion', 'potion_large');
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
    setIsNearJobHall(false);
    setShowToolShopModal(false);
    setIsNearToolShop(false);
    setPlayerProgression(INITIAL_PLAYER_PROGRESSION);
    setDashState(INITIAL_DASH_STATE);
    setShowMinimapModal(false);
    setNearIsland(null);
    setPlayerGridPos({ gridX: 0, gridY: 0 });
    setPlayerStandingTerritoryId(0);
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
