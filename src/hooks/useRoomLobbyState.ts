import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PublicRoomListing } from '../data/dropInConfig';
import {
  AURA_DEFINITIONS,
  COSMETIC_TITLES,
  COSTUME_DEFINITIONS,
  DEFAULT_META_PROGRESSION,
  TRAIT_DEFINITIONS,
  calculateRefundableTraitPoints,
  computeMetaBonuses,
  getTraitUpgradeCost,
} from '../data/metaProgression';
import { INSTANCE_ROOM_DEFAULTS, getMissionById } from '../data/missions';
import { GameEvents } from '../game/events/gameEvents';
import { getDropInLockReasonLabel } from '../game/utils/dropInPolicyUtils';
import { publicRoomDirectory } from '../lib/publicRoomDirectory';
import { saveRepository } from '../lib/repositories/LocalStorageSaveRepository';
import { SupabaseRoomTransport } from '../lib/transports/SupabaseRoomTransport';
import { getCurrentBuildId } from '../lib/versionGuard';
import { shouldTriggerSoloPauseOnEscape } from './useEscapeToClose';
import { PlayerColor } from '../types/game';
import {
  AuraEffectId,
  CostumeId,
  MetaProgressionState,
  MissionProgressState,
  MissionResultPayload,
  RoomConfig,
  RoomDifficultyId,
  RoomMember,
  RoomSessionStatus,
  TraitId,
} from '../types/room';

function generateInviteCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function useRoomLobbyState(
  playerId: string,
  playerName: string,
  playerColor: PlayerColor
) {
  const [sessionStatus, setSessionStatus] = useState<RoomSessionStatus>('lobby');
  const [roomConfig, setRoomConfig] = useState<RoomConfig>({
    roomId: 'solo_local',
    mode: 'solo',
    missionId: INSTANCE_ROOM_DEFAULTS.defaultMissionId,
    difficulty: INSTANCE_ROOM_DEFAULTS.defaultDifficulty,
    maxPlayers: INSTANCE_ROOM_DEFAULTS.maxPlayers,
    hostPlayerId: playerId,
    allowDropIn: true,
  });
  const [waitingMembers, setWaitingMembers] = useState<RoomMember[]>([]);
  const [isLobbyHost, setIsLobbyHost] = useState<boolean>(true);
  const [showMetaModal, setShowMetaModal] = useState<boolean>(false);
  const [publicRooms, setPublicRooms] = useState<PublicRoomListing[]>([]);
  const [joinErrorMessage, setJoinErrorMessage] = useState<string | null>(null);

  const [meta, setMeta] = useState<MetaProgressionState>(() =>
    saveRepository.loadMetaProgression()
  );
  const metaBonuses = useMemo(() => computeMetaBonuses(meta), [meta]);

  const [missionProgress, setMissionProgress] = useState<MissionProgressState | null>(null);
  const [missionResult, setMissionResult] = useState<MissionResultPayload | null>(null);

  const lobbyTransportRef = useRef<SupabaseRoomTransport | null>(null);

  // 로비 또는 대기실에 있을 때 공용 방 목록 구독
  useEffect(() => {
    if (sessionStatus !== 'lobby' && sessionStatus !== 'waiting') return;
    return publicRoomDirectory.subscribeListings((rooms) => {
      setPublicRooms(rooms);
    });
  }, [sessionStatus]);

  // 대기실 방장인 경우 공용 방 디렉토리에 대기실 상태 브로드캐스트
  useEffect(() => {
    if (sessionStatus !== 'waiting' || !isLobbyHost || roomConfig.mode !== 'coop') {
      return;
    }
    const mission = getMissionById(roomConfig.missionId);
    const publish = () => {
      void publicRoomDirectory.publishHostRoom({
        roomId: roomConfig.roomId,
        inviteCode: roomConfig.inviteCode ?? roomConfig.roomId,
        hostPlayerId: playerId,
        hostName: playerName,
        missionId: roomConfig.missionId,
        missionTitle: mission.title,
        difficulty: roomConfig.difficulty,
        status: 'waiting',
        currentPlayers: Math.max(1, waitingMembers.length),
        maxPlayers: roomConfig.maxPlayers,
        currentCount: 0,
        targetCount: mission.goal.targetCount,
        elapsedSec: 0,
        timeLimitSec: mission.timeLimitSec,
        allowDropIn: roomConfig.allowDropIn !== false,
        hostAppVersion: getCurrentBuildId(),
      });
    };
    publish();
    const timer = setInterval(publish, 4000);
    return () => clearInterval(timer);
  }, [isLobbyHost, playerId, playerName, roomConfig, sessionStatus, waitingMembers.length]);

  const disconnectLobbyTransport = useCallback(() => {
    if (lobbyTransportRef.current) {
      lobbyTransportRef.current.disconnect();
      lobbyTransportRef.current = null;
    }
    setWaitingMembers([]);
  }, []);

  const connectLobbyTransport = useCallback(
    (cfg: RoomConfig) => {
      disconnectLobbyTransport();
      const transport = new SupabaseRoomTransport();
      lobbyTransportRef.current = transport;

      transport.onPresenceSync((snapshot) => {
        setIsLobbyHost(snapshot.isHost);
        setWaitingMembers(snapshot.members.slice(0, cfg.maxPlayers));
        if (snapshot.hostId) {
          setRoomConfig((prev) =>
            prev.hostPlayerId === snapshot.hostId
              ? prev
              : { ...prev, hostPlayerId: snapshot.hostId }
          );
        }
      });

      transport.on<{ roomConfig: RoomConfig }>('room_start', (payload) => {
        if (payload?.roomConfig) {
          setRoomConfig({ ...payload.roomConfig, isDropInJoin: false });
        }
        disconnectLobbyTransport();
        setMissionProgress(null);
        setMissionResult(null);
        setSessionStatus('playing');
      });

      transport.connect(`${cfg.roomId}_lobby`, playerId, {
        name: playerName,
        color: playerColor,
        preferredHostId: cfg.hostPlayerId || undefined,
      });
    },
    [disconnectLobbyTransport, playerColor, playerId, playerName]
  );

  const handleJoinPublicRoomListing = useCallback(
    (listing: PublicRoomListing): boolean => {
      setJoinErrorMessage(null);
      if (listing.lockReason !== 'open') {
        setJoinErrorMessage(
          `입장할 수 없는 방입니다: ${getDropInLockReasonLabel(listing.lockReason)}`
        );
        return false;
      }

      if (listing.status === 'playing') {
        disconnectLobbyTransport();
        const dropInCfg: RoomConfig = {
          roomId: listing.roomId,
          inviteCode: listing.inviteCode,
          mode: 'coop',
          missionId: listing.missionId,
          difficulty: listing.difficulty,
          maxPlayers: listing.maxPlayers,
          hostPlayerId: listing.hostPlayerId,
          hostAppVersion: listing.hostAppVersion,
          isDropInJoin: true,
          allowDropIn: listing.allowDropIn,
        };
        setRoomConfig(dropInCfg);
        setIsLobbyHost(false);
        setMissionProgress(null);
        setMissionResult(null);
        setSessionStatus('playing');
        return true;
      }

      const waitingCfg: RoomConfig = {
        roomId: listing.roomId,
        inviteCode: listing.inviteCode,
        mode: 'coop',
        missionId: listing.missionId,
        difficulty: listing.difficulty,
        maxPlayers: listing.maxPlayers,
        hostPlayerId: listing.hostPlayerId,
        hostAppVersion: listing.hostAppVersion,
        isDropInJoin: false,
        allowDropIn: listing.allowDropIn,
      };
      setRoomConfig(waitingCfg);
      setIsLobbyHost(false);
      setSessionStatus('waiting');
      connectLobbyTransport(waitingCfg);
      return true;
    },
    [connectLobbyTransport, disconnectLobbyTransport]
  );

  // URL 초대 링크(?room=XXXXXX) 자동 입장 감지
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room')?.trim().toUpperCase();
    if (!roomParam) return;

    const existingListing = publicRoomDirectory.findRoomByCode(roomParam);
    if (existingListing) {
      handleJoinPublicRoomListing(existingListing);
      return;
    }

    const missionParam = params.get('mission') || INSTANCE_ROOM_DEFAULTS.defaultMissionId;
    const diffParam = (params.get('diff') as RoomDifficultyId) || 'normal';
    const nextCfg: RoomConfig = {
      roomId: roomParam,
      inviteCode: roomParam,
      mode: 'coop',
      missionId: missionParam,
      difficulty: diffParam,
      maxPlayers: INSTANCE_ROOM_DEFAULTS.maxPlayers,
      hostPlayerId: '',
      allowDropIn: true,
    };
    setRoomConfig(nextCfg);
    setIsLobbyHost(false);
    setSessionStatus('waiting');
    connectLobbyTransport(nextCfg);
  }, [connectLobbyTransport, handleJoinPublicRoomListing]);

  useEffect(() => {
    return () => disconnectLobbyTransport();
  }, [disconnectLobbyTransport]);

  // 인게임 미션 진행도 및 종료/보상 수신
  useEffect(() => {
    const onProgress = (progress: MissionProgressState) => {
      setMissionProgress(progress);
    };
    const onEnded = (result: MissionResultPayload) => {
      setMissionResult(result);
      setSessionStatus('ended');
      void publicRoomDirectory.unpublishHostRoom();
      setMeta((prev) => {
        const nextTitles =
          result.unlockedTitleId && !prev.unlockedTitleIds.includes(result.unlockedTitleId)
            ? [...prev.unlockedTitleIds, result.unlockedTitleId]
            : prev.unlockedTitleIds;
        const nextCleared =
          result.victory &&
          (result.contribution?.isQualified ?? true) &&
          !prev.clearedMissionIds.includes(result.missionId)
            ? [...prev.clearedMissionIds, result.missionId]
            : prev.clearedMissionIds;
        const next: MetaProgressionState = {
          ...prev,
          points: prev.points + result.earnedPoints,
          totalClears:
            result.victory && (result.contribution?.isQualified ?? true)
              ? prev.totalClears + 1
              : prev.totalClears,
          unlockedTitleIds: nextTitles,
          clearedMissionIds: nextCleared,
        };
        saveRepository.saveMetaProgression(next);
        return next;
      });
    };

    GameEvents.on('mission-progress-updated', onProgress);
    GameEvents.on('mission-ended', onEnded);
    return () => {
      GameEvents.off('mission-progress-updated', onProgress);
      GameEvents.off('mission-ended', onEnded);
    };
  }, []);

  // 솔플 ESC 일시정지 토글
  const toggleSoloPause = useCallback(() => {
    if (roomConfig.mode !== 'solo') return;
    setSessionStatus((prev) => {
      if (prev === 'playing') {
        GameEvents.emit('game-pause-toggled', true);
        return 'paused';
      }
      if (prev === 'paused') {
        GameEvents.emit('game-pause-toggled', false);
        return 'playing';
      }
      return prev;
    });
  }, [roomConfig.mode]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!shouldTriggerSoloPauseOnEscape(e)) return;
      if (sessionStatus === 'playing' || sessionStatus === 'paused') {
        toggleSoloPause();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sessionStatus, toggleSoloPause]);

  const handleStartSolo = useCallback(
    (missionId: string, difficulty: RoomDifficultyId) => {
      disconnectLobbyTransport();
      void publicRoomDirectory.unpublishHostRoom();
      const soloId = `solo_${Date.now()}`;
      setRoomConfig({
        roomId: soloId,
        mode: 'solo',
        missionId,
        difficulty,
        maxPlayers: 1,
        hostPlayerId: playerId,
        isDropInJoin: false,
      });
      setMissionProgress(null);
      setMissionResult(null);
      setSessionStatus('playing');
    },
    [disconnectLobbyTransport, playerId]
  );

  const handleCreateCoopRoom = useCallback(
    (missionId: string, difficulty: RoomDifficultyId) => {
      setJoinErrorMessage(null);
      const code = generateInviteCode(INSTANCE_ROOM_DEFAULTS.inviteCodeLength);
      const cfg: RoomConfig = {
        roomId: code,
        inviteCode: code,
        mode: 'coop',
        missionId,
        difficulty,
        maxPlayers: INSTANCE_ROOM_DEFAULTS.maxPlayers,
        hostPlayerId: playerId,
        isDropInJoin: false,
        allowDropIn: true,
      };
      setRoomConfig(cfg);
      setIsLobbyHost(true);
      setSessionStatus('waiting');
      connectLobbyTransport(cfg);
    },
    [connectLobbyTransport, playerId]
  );

  const handleToggleAllowDropIn = useCallback(() => {
    setRoomConfig((prev) => ({
      ...prev,
      allowDropIn: prev.allowDropIn === false,
    }));
  }, []);

  const handleJoinCoopRoom = useCallback(
    (inviteCode: string): boolean => {
      const code = inviteCode.trim().toUpperCase();
      if (!code) return false;
      setJoinErrorMessage(null);

      // 1) 먼저 실시간 공용 디렉토리에서 해당 코드의 방 상태를 확인 (진행 중인 방 및 종반부 잠금 판별)
      const matched = publicRoomDirectory.findRoomByCode(code);
      if (matched) {
        return handleJoinPublicRoomListing(matched);
      }

      // 2) 디렉토리에 아직 없거나 비공개 코드인 경우 대기실 채널로 연결
      const cfg: RoomConfig = {
        roomId: code,
        inviteCode: code,
        mode: 'coop',
        missionId: INSTANCE_ROOM_DEFAULTS.defaultMissionId,
        difficulty: INSTANCE_ROOM_DEFAULTS.defaultDifficulty,
        maxPlayers: INSTANCE_ROOM_DEFAULTS.maxPlayers,
        hostPlayerId: '',
        isDropInJoin: false,
        allowDropIn: true,
      };
      setRoomConfig(cfg);
      setIsLobbyHost(false);
      setSessionStatus('waiting');
      connectLobbyTransport(cfg);
      return true;
    },
    [connectLobbyTransport, handleJoinPublicRoomListing]
  );

  const handleStartCoopMatch = useCallback(() => {
    if (!isLobbyHost) return;
    const transport = lobbyTransportRef.current;
    lobbyTransportRef.current = null;
    const startedRoomConfig: RoomConfig = {
      ...roomConfig,
      hostPlayerId: playerId,
      hostAppVersion: getCurrentBuildId(),
      isDropInJoin: false,
    };
    setRoomConfig(startedRoomConfig);
    if (transport) {
      transport.emit('room_start', { roomConfig: startedRoomConfig });
      setTimeout(() => {
        transport.emit('room_start', { roomConfig: startedRoomConfig });
      }, 140);
      setTimeout(() => {
        transport.emit('room_start', { roomConfig: startedRoomConfig });
      }, 300);
      setTimeout(() => {
        transport.disconnect();
      }, 650);
    }
    setWaitingMembers([]);
    setMissionProgress(null);
    setMissionResult(null);
    setSessionStatus('playing');
  }, [isLobbyHost, playerId, roomConfig]);

  const handleLeaveToLobby = useCallback(() => {
    disconnectLobbyTransport();
    void publicRoomDirectory.unpublishHostRoom();
    setMissionProgress(null);
    setMissionResult(null);
    setJoinErrorMessage(null);
    setSessionStatus('lobby');
    if (window.location.search.includes('room=')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [disconnectLobbyTransport]);

  const handleUpgradeTrait = useCallback((traitId: TraitId) => {
    const def = TRAIT_DEFINITIONS.find((t) => t.id === traitId);
    if (!def) return;
    setMeta((prev) => {
      const lv = prev.traitLevels[traitId] ?? 0;
      if (lv >= def.maxLevel) return prev;
      const cost = getTraitUpgradeCost(def, lv);
      if (prev.points < cost) return prev;
      const next: MetaProgressionState = {
        ...prev,
        points: prev.points - cost,
        traitLevels: { ...prev.traitLevels, [traitId]: lv + 1 },
      };
      saveRepository.saveMetaProgression(next);
      return next;
    });
  }, []);

  const handleSelectOrUnlockTitle = useCallback((titleId: string) => {
    const def = COSMETIC_TITLES.find((t) => t.id === titleId);
    if (!def) return;
    setMeta((prev) => {
      if (prev.unlockedTitleIds.includes(titleId)) {
        const next = { ...prev, equippedTitleId: titleId };
        saveRepository.saveMetaProgression(next);
        return next;
      }
      if (prev.points < def.costPoints) return prev;
      const next: MetaProgressionState = {
        ...prev,
        points: prev.points - def.costPoints,
        unlockedTitleIds: [...prev.unlockedTitleIds, titleId],
        equippedTitleId: titleId,
      };
      saveRepository.saveMetaProgression(next);
      return next;
    });
  }, []);

  const handleSelectOrUnlockCostume = useCallback((costumeId: CostumeId) => {
    const def = COSTUME_DEFINITIONS.find((c) => c.id === costumeId);
    if (!def) return;
    setMeta((prev) => {
      if (prev.unlockedCostumeIds.includes(costumeId)) {
        const next: MetaProgressionState = { ...prev, equippedCostumeId: costumeId };
        saveRepository.saveMetaProgression(next);
        return next;
      }
      if (prev.points < def.costPoints) return prev;
      const next: MetaProgressionState = {
        ...prev,
        points: prev.points - def.costPoints,
        unlockedCostumeIds: [...prev.unlockedCostumeIds, costumeId],
        equippedCostumeId: costumeId,
      };
      saveRepository.saveMetaProgression(next);
      return next;
    });
  }, []);

  const handleSelectOrUnlockAura = useCallback((auraId: AuraEffectId) => {
    const def = AURA_DEFINITIONS.find((a) => a.id === auraId);
    if (!def) return;
    setMeta((prev) => {
      if (prev.unlockedAuraIds.includes(auraId)) {
        const next: MetaProgressionState = { ...prev, equippedAuraId: auraId };
        saveRepository.saveMetaProgression(next);
        return next;
      }
      if (prev.points < def.costPoints) return prev;
      const next: MetaProgressionState = {
        ...prev,
        points: prev.points - def.costPoints,
        unlockedAuraIds: [...prev.unlockedAuraIds, auraId],
        equippedAuraId: auraId,
      };
      saveRepository.saveMetaProgression(next);
      return next;
    });
  }, []);

  const handleResetTraits = useCallback(() => {
    setMeta((prev) => {
      const refund = calculateRefundableTraitPoints(prev);
      if (refund <= 0) return prev;
      const next: MetaProgressionState = {
        ...prev,
        points: prev.points + refund,
        traitLevels: { ...DEFAULT_META_PROGRESSION.traitLevels },
      };
      saveRepository.saveMetaProgression(next);
      return next;
    });
  }, []);

  const handleApplyMetaProgression = useCallback((nextMeta: MetaProgressionState) => {
    saveRepository.saveMetaProgression(nextMeta);
    setMeta(nextMeta);
  }, []);

  return {
    sessionStatus,
    roomConfig,
    waitingMembers,
    isLobbyHost,
    showMetaModal,
    setShowMetaModal,
    publicRooms,
    joinErrorMessage,
    clearJoinError: () => setJoinErrorMessage(null),
    meta,
    metaBonuses,
    missionProgress,
    missionResult,
    toggleSoloPause,
    handleStartSolo,
    handleCreateCoopRoom,
    handleToggleAllowDropIn,
    handleJoinCoopRoom,
    handleJoinPublicRoomListing,
    handleStartCoopMatch,
    handleLeaveToLobby,
    handleUpgradeTrait,
    handleSelectOrUnlockTitle,
    handleSelectOrUnlockCostume,
    handleSelectOrUnlockAura,
    handleResetTraits,
    handleApplyMetaProgression,
  };
}

