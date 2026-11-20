import { useCallback, useEffect, useRef, useState } from 'react';
import { PublicRoomListing } from '../data/dropInConfig';
import { INSTANCE_ROOM_DEFAULTS, getMissionById } from '../data/missions';
import { GameEvents } from '../game/events/gameEvents';
import { getDropInLockReasonLabel } from '../game/utils/dropInPolicyUtils';
import { roomDirectoryClient } from '../lib/roomDirectoryClient';
import { activeRoomTransportStore } from '../lib/transports/activeRoomTransportStore';
import { CloudflareRoomTransport } from '../lib/transports/CloudflareRoomTransport';
import { getCurrentBuildId } from '../lib/versionGuard';
import { PlayerColor } from '../types/game';
import {
  MissionProgressState,
  MissionResultPayload,
  RoomConfig,
  RoomDifficultyId,
  RoomMember,
  RoomSessionStatus,
} from '../types/room';
import { shouldTriggerSoloPauseOnEscape } from './useEscapeToClose';
import { useMetaProgressionState } from './useMetaProgressionState';

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

  const [missionProgress, setMissionProgress] = useState<MissionProgressState | null>(null);
  const [missionResult, setMissionResult] = useState<MissionResultPayload | null>(null);

  const metaState = useMetaProgressionState();
  const lobbyTransportRef = useRef<CloudflareRoomTransport | null>(null);
  const lobbyUnsubsRef = useRef<Array<() => void>>([]);

  // 로비 화면에서만 Cloudflare LobbyDirectoryDO 실시간 방 목록 구독 (대기실 진입 시 소켓 정리)
  useEffect(() => {
    if (sessionStatus !== 'lobby') return;
    return roomDirectoryClient.subscribeListings((rooms) => {
      setPublicRooms(rooms);
    });
  }, [sessionStatus]);

  const clearLobbyListeners = useCallback(() => {
    for (const unsub of lobbyUnsubsRef.current) unsub();
    lobbyUnsubsRef.current = [];
  }, []);

  const disconnectLobbyTransport = useCallback(() => {
    clearLobbyListeners();
    if (lobbyTransportRef.current) {
      lobbyTransportRef.current.disconnect();
      lobbyTransportRef.current = null;
    }
    activeRoomTransportStore.clear(true);
    setWaitingMembers([]);
  }, [clearLobbyListeners]);

  const handoffTransportToGame = useCallback(
    (transport: CloudflareRoomTransport, nextCfg: RoomConfig) => {
      clearLobbyListeners();
      lobbyTransportRef.current = null;
      activeRoomTransportStore.register(nextCfg.roomId, transport);
      setRoomConfig(nextCfg);
      setWaitingMembers([]);
      setMissionProgress(null);
      setMissionResult(null);
      setSessionStatus('playing');
    },
    [clearLobbyListeners]
  );

  const connectRoomTransport = useCallback(
    (cfg: RoomConfig, options?: { requireExisting?: boolean }) => {
      disconnectLobbyTransport();
      const transport = new CloudflareRoomTransport();
      lobbyTransportRef.current = transport;

      const mission = getMissionById(cfg.missionId);
      const unsubPresence = transport.onPresenceSync((snapshot) => {
        setIsLobbyHost(snapshot.isHost);
        setWaitingMembers(snapshot.members.slice(0, cfg.maxPlayers));

        const serverMeta = snapshot.roomMeta;
        const syncedCfg: RoomConfig = {
          ...cfg,
          roomId: serverMeta?.roomId ?? cfg.roomId,
          inviteCode: serverMeta?.inviteCode ?? cfg.inviteCode ?? cfg.roomId,
          missionId: serverMeta?.missionId ?? cfg.missionId,
          difficulty: (serverMeta?.difficulty as RoomDifficultyId | undefined) ?? cfg.difficulty,
          maxPlayers: serverMeta?.maxPlayers ?? cfg.maxPlayers,
          allowDropIn: serverMeta?.allowDropIn ?? cfg.allowDropIn,
          hostPlayerId: snapshot.hostId || cfg.hostPlayerId,
          hostAppVersion:
            snapshot.members.find((m) => m.isHost)?.appVersion ?? cfg.hostAppVersion,
        };
        setRoomConfig(syncedCfg);

        // 초대 링크/코드로 접속한 방이 이미 진행 중이면 대기실을 건너뛰고 동일 WebSocket으로 즉시 중도 합류
        if (snapshot.roomStatus === 'playing') {
          handoffTransportToGame(transport, { ...syncedCfg, isDropInJoin: true });
        }
      });

      const unsubStarted = transport.onGameStarted((startedConfig, snapshot) => {
        const mergedCfg: RoomConfig = {
          ...cfg,
          ...(startedConfig as Partial<RoomConfig>),
          hostPlayerId: snapshot.hostId || (startedConfig.hostPlayerId as string) || cfg.hostPlayerId,
          isDropInJoin: false,
        };
        handoffTransportToGame(transport, mergedCfg);
      });

      const unsubRejected = transport.onJoinRejected((_reason, message) => {
        disconnectLobbyTransport();
        setJoinErrorMessage(message);
        setSessionStatus('lobby');
        if (window.location.search.includes('room=')) {
          window.history.replaceState({}, '', window.location.pathname);
        }
      });

      lobbyUnsubsRef.current = [unsubPresence, unsubStarted, unsubRejected];

      transport.connect(cfg.roomId, playerId, {
        name: playerName,
        color: playerColor,
        appVersion: getCurrentBuildId(),
        requireExisting: options?.requireExisting,
        initialMeta: {
          roomId: cfg.roomId,
          inviteCode: cfg.inviteCode ?? cfg.roomId,
          missionId: cfg.missionId,
          missionTitle: mission.title,
          difficulty: cfg.difficulty,
          maxPlayers: cfg.maxPlayers,
          allowDropIn: cfg.allowDropIn !== false,
          currentCount: 0,
          targetCount: mission.goal.targetCount,
          elapsedSec: 0,
          timeLimitSec: mission.timeLimitSec,
        },
      });
    },
    [disconnectLobbyTransport, handoffTransportToGame, playerColor, playerId, playerName]
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

      const targetCfg: RoomConfig = {
        roomId: listing.roomId,
        inviteCode: listing.inviteCode,
        mode: 'coop',
        missionId: listing.missionId,
        difficulty: listing.difficulty,
        maxPlayers: listing.maxPlayers,
        hostPlayerId: listing.hostPlayerId,
        hostAppVersion: listing.hostAppVersion,
        isDropInJoin: listing.status === 'playing',
        allowDropIn: listing.allowDropIn,
      };
      setRoomConfig(targetCfg);
      setIsLobbyHost(false);
      setSessionStatus('waiting');
      connectRoomTransport(targetCfg, { requireExisting: true });
      return true;
    },
    [connectRoomTransport]
  );

  // URL 초대 링크(?room=XXXXXX) 자동 입장: 공개 방 목록 대기 없이 방 서버(GameRoomDO)에 직접 연결
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room')?.trim().toUpperCase();
    if (!roomParam) return;

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
    connectRoomTransport(nextCfg, { requireExisting: true });
  }, [connectRoomTransport]);

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
      metaState.applyMissionResultReward(result);
    };

    GameEvents.on('mission-progress-updated', onProgress);
    GameEvents.on('mission-ended', onEnded);
    return () => {
      GameEvents.off('mission-progress-updated', onProgress);
      GameEvents.off('mission-ended', onEnded);
    };
  }, [metaState.applyMissionResultReward]);

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
        hostAppVersion: getCurrentBuildId(),
        isDropInJoin: false,
        allowDropIn: true,
      };
      setRoomConfig(cfg);
      setIsLobbyHost(true);
      setSessionStatus('waiting');
      connectRoomTransport(cfg, { requireExisting: false });
    },
    [connectRoomTransport, playerId]
  );

  const handleToggleAllowDropIn = useCallback(() => {
    setRoomConfig((prev) => {
      const nextAllow = prev.allowDropIn === false;
      lobbyTransportRef.current?.updateRoomMeta({ allowDropIn: nextAllow });
      return { ...prev, allowDropIn: nextAllow };
    });
  }, []);

  const handleJoinCoopRoom = useCallback(
    (inviteCode: string): boolean => {
      const code = inviteCode.trim().toUpperCase();
      if (!code) return false;
      setJoinErrorMessage(null);

      const matched = roomDirectoryClient.findRoomByCode(code);
      if (matched) {
        return handleJoinPublicRoomListing(matched);
      }

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
      connectRoomTransport(cfg, { requireExisting: true });
      return true;
    },
    [connectRoomTransport, handleJoinPublicRoomListing]
  );

  const handleStartCoopMatch = useCallback(() => {
    if (!isLobbyHost) return;
    const transport = lobbyTransportRef.current;
    const startedRoomConfig: RoomConfig = {
      ...roomConfig,
      hostPlayerId: playerId,
      hostAppVersion: getCurrentBuildId(),
      isDropInJoin: false,
    };

    if (transport) {
      const mission = getMissionById(startedRoomConfig.missionId);
      transport.startGame(startedRoomConfig as unknown as Record<string, unknown>, {
        missionId: startedRoomConfig.missionId,
        missionTitle: mission.title,
        difficulty: startedRoomConfig.difficulty,
        allowDropIn: startedRoomConfig.allowDropIn !== false,
        targetCount: mission.goal.targetCount,
        timeLimitSec: mission.timeLimitSec,
      });
      handoffTransportToGame(transport, startedRoomConfig);
    } else {
      setRoomConfig(startedRoomConfig);
      setSessionStatus('playing');
    }
  }, [handoffTransportToGame, isLobbyHost, playerId, roomConfig]);

  const handleLeaveToLobby = useCallback(() => {
    disconnectLobbyTransport();
    setMissionProgress(null);
    setMissionResult(null);
    setJoinErrorMessage(null);
    setSessionStatus('lobby');
    if (window.location.search.includes('room=')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [disconnectLobbyTransport]);

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
    meta: metaState.meta,
    metaBonuses: metaState.metaBonuses,
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
    handleUpgradeTrait: metaState.handleUpgradeTrait,
    handleSelectOrUnlockTitle: metaState.handleSelectOrUnlockTitle,
    handleSelectOrUnlockCostume: metaState.handleSelectOrUnlockCostume,
    handleSelectOrUnlockAura: metaState.handleSelectOrUnlockAura,
    handleResetTraits: metaState.handleResetTraits,
    handleApplyMetaProgression: metaState.handleApplyMetaProgression,
  };
}
