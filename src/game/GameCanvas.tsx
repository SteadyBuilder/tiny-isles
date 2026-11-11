import React, { useEffect, useRef, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { GameAssets, loadGameAssets } from './AssetLoader';
import {
  ISLAND_GAP,
  ISLAND_PX,
  ISLAND_TILES,
  INITIAL_ISLANDS,
  TILE_SIZE,
  generateIslandEntities,
  getIslandOrigin,
  BUILDING_DEFS,
  INITIAL_CAPITAL_BUILDINGS,
  VILLAGE_TIER_CONFIG,
} from './constants';
import {
  Entity,
  FloatingText,
  Inventory,
  Island,
  Particle,
  Player,
  PlayerAction,
  PlayerColor,
  Building,
  BuildingType,
  Monster,
  Projectile,
  DefenseSession,
  VillageTier,
} from '../types/game';
import { sound } from '../lib/sound';
import { supabase } from '../lib/supabase';
import { storage } from '../lib/storage';
import { serverSync } from '../lib/serverSync';

interface GameCanvasProps {
  playerName: string;
  playerColor: PlayerColor;
  inventory: Inventory;
  onUpdateInventory: (updater: (prev: Inventory) => Inventory) => void;
  onlineCount: number;
  setOnlineCount: (count: number) => void;
  onUnlockedCountChange?: (count: number, total: number) => void;
  onUnlockedIslandIdsChange?: (ids: number[]) => void;
  joystickRef?: React.MutableRefObject<{ x: number; y: number }>;
  onNearIslandChange?: (island: Island | null) => void;
  onPlayerPositionChange?: (pos: { gridX: number; gridY: number }) => void;
  onOpenMinimap?: () => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  selectedBuilding?: BuildingType | null;
  onBuildSuccess?: () => void;
  session: DefenseSession;
  onUpdateSession: (updater: (prev: DefenseSession) => DefenseSession) => void;
  onCapitalCoreHpChange?: (hp: number, maxHp: number) => void;
  onPlayerHpChange?: (hp: number, maxHp: number) => void;
  onMonsterCountChange?: (count: number) => void;
  onWarningDirectionChange?: (dir: 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW' | null) => void;
  onNearCoreChange?: (isNear: boolean) => void;
  onNearVillageCenterChange?: (isNear: boolean) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  playerName,
  playerColor,
  inventory,
  onUpdateInventory,
  setOnlineCount,
  onUnlockedCountChange,
  onUnlockedIslandIdsChange,
  joystickRef,
  onNearIslandChange,
  onPlayerPositionChange,
  onOpenMinimap,
  zoom = 1.0,
  onZoomChange,
  selectedBuilding = null,
  onBuildSuccess,
  session,
  onUpdateSession,
  onCapitalCoreHpChange,
  onPlayerHpChange,
  onMonsterCountChange,
  onWarningDirectionChange,
  onNearCoreChange,
  onNearVillageCenterChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastNearIslandRef = useRef<Island | null>(null);
  const lastGridPosRef = useRef<{ gridX: number; gridY: number }>({ gridX: 0, gridY: 0 });

  // Camera Zoom State
  const targetZoomRef = useRef<number>(zoom);
  const zoomRef = useRef<number>(zoom);
  const isPinchingRef = useRef<boolean>(false);
  const lastPinchEndTimeRef = useRef<number>(0);

  // Defense & Session Refs
  const sessionRef = useRef<DefenseSession>(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const selectedBuildingRef = useRef<BuildingType | null>(selectedBuilding);
  useEffect(() => {
    selectedBuildingRef.current = selectedBuilding;
  }, [selectedBuilding]);

  const buildingsRef = useRef<Building[]>([...INITIAL_CAPITAL_BUILDINGS]);
  const monstersRef = useRef<Monster[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const dashCooldownRef = useRef<number>(0);
  const lastWaveCheckRef = useRef<number>(Date.now());

  // Loading state
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  // Local Player State (hp: 100)
  const localPlayerRef = useRef<Player>({
    id: storage.getPlayerId(),
    name: playerName,
    x: 256,
    y: 256,
    direction: 'right',
    action: 'idle',
    color: playerColor,
    lastUpdated: Date.now(),
    hp: 100,
    maxHp: 100,
  });

  // Remote Players State
  const remotePlayersRef = useRef<Map<string, Player>>(new Map());

  // Islands & Entities State (로드 시 로컬 스토리지에서 해금 상태 복원)
  const islandsRef = useRef<Island[]>(
    (() => {
      const savedUnlocked = storage.loadUnlockedIslands();
      return INITIAL_ISLANDS.map((island) => ({
        ...island,
        unlocked: savedUnlocked.includes(island.id) || island.id === 0,
      }));
    })()
  );
  const entitiesRef = useRef<Entity[]>(
    (() => {
      const savedUnlocked = storage.loadUnlockedIslands();
      const allEntities: Entity[] = [];
      for (const isl of INITIAL_ISLANDS) {
        if (savedUnlocked.includes(isl.id) || isl.id === 0) {
          allEntities.push(...generateIslandEntities(isl.id, isl.gridX, isl.gridY));
        }
      }
      return allEntities;
    })()
  );

  // Visual Effects
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);

  // Input State
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const mouseTargetRef = useRef<{ worldX: number; worldY: number; active: boolean }>({ worldX: 0, worldY: 0, active: false });

  // Camera
  const cameraRef = useRef({ x: 256, y: 256 });

  // Action cooldown & continuous hold timer
  const actionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInteractTimeRef = useRef<number>(0);

  // Local BroadcastChannel for instant same-browser sync
  const localBusRef = useRef<BroadcastChannel | null>(null);

  // Supabase Realtime Channel Reference
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Preload Assets
  const assetsRef = useRef<GameAssets | null>(null);

  useEffect(() => {
    loadGameAssets((progress) => setLoadProgress(progress)).then((assets) => {
      assetsRef.current = assets;
      setAssetsLoaded(true);
    });
  }, []);

  // 서버 DB에서 해금된 섬 목록을 조회하여 로컬 월드와 동기화 (기존 해금 상태는 이펙트 없이 조용히 적용)
  useEffect(() => {
    let isMounted = true;
    serverSync.fetchUnlockedIslands().then((records) => {
      if (!isMounted || !records || records.length === 0) return;
      for (const rec of records) {
        const isl = islandsRef.current.find((i) => i.id === rec.island_id);
        if (isl && !isl.unlocked) {
          unlockIslandLocally(rec.island_id, rec.unlocked_by || '동료 모험가', false, false);
        }
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const unlockedIds = islandsRef.current.filter((isl) => isl.unlocked).map((isl) => isl.id);
    if (onUnlockedIslandIdsChange) {
      onUnlockedIslandIdsChange(unlockedIds);
    }
    if (onUnlockedCountChange) {
      onUnlockedCountChange(unlockedIds.length, islandsRef.current.length);
    }
  }, [onUnlockedCountChange, onUnlockedIslandIdsChange]);

  // Sync zoom prop with targetZoomRef
  const onZoomChangeRef = useRef(onZoomChange);
  useEffect(() => {
    onZoomChangeRef.current = onZoomChange;
  }, [onZoomChange]);

  useEffect(() => {
    if (typeof zoom === 'number' && !isNaN(zoom)) {
      targetZoomRef.current = Math.min(2.0, Math.max(0.5, Number(zoom.toFixed(2))));
    }
  }, [zoom]);

  // Update local player info when props change & sync via presence
  useEffect(() => {
    localPlayerRef.current.name = playerName;
    localPlayerRef.current.color = playerColor;

    if (channelRef.current) {
      channelRef.current.track({
        id: localPlayerRef.current.id,
        name: playerName,
        color: playerColor,
      });
    }
  }, [playerName, playerColor]);

  // Handle remote player position & action update
  const handleRemotePlayerMove = useCallback((p: Player) => {
    if (!p || p.id === localPlayerRef.current.id) return;

    const existing = remotePlayersRef.current.get(p.id);
    if (existing) {
      existing.name = p.name;
      existing.color = p.color;
      existing.direction = p.direction;
      existing.action = p.action;
      existing.x = p.x;
      existing.y = p.y;
      existing.lastUpdated = Date.now();
    } else {
      remotePlayersRef.current.set(p.id, {
        ...p,
        lastUpdated: Date.now(),
      });
      setOnlineCount(remotePlayersRef.current.size + 1);
    }
  }, [setOnlineCount]);

  // Realtime & Local Multi-Tab Setup
  useEffect(() => {
    const myId = localPlayerRef.current.id;

    // 1. Local Browser BroadcastChannel (Instant local multi-tab sync)
    const localBus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('tiny_isles_sync') : null;
    localBusRef.current = localBus;

    if (localBus) {
      localBus.onmessage = (event) => {
        const data = event.data;
        if (!data || data.senderId === myId) return;

        if (data.type === 'player_move') {
          handleRemotePlayerMove(data.payload);
        } else if (data.type === 'hit') {
          const { entityId, damage, hitBy } = data.payload;
          handleRemoteHit(entityId, damage, hitBy);
        } else if (data.type === 'island_unlocked') {
          const { islandId, unlockedBy } = data.payload;
          unlockIslandLocally(islandId, unlockedBy, false);
        } else if (data.type === 'sync_world_request') {
          const unlockedIds = islandsRef.current.filter((isl) => isl.unlocked).map((isl) => isl.id);
          localBus.postMessage({
            type: 'sync_world_response',
            senderId: myId,
            payload: { unlockedIds },
          });
        } else if (data.type === 'sync_world_response') {
          const { unlockedIds } = data.payload || {};
          if (Array.isArray(unlockedIds)) {
            for (const id of unlockedIds) {
              const isl = islandsRef.current.find((i) => i.id === id);
              if (isl && !isl.unlocked) {
                unlockIslandLocally(id, '동료 모험가', false);
              }
            }
          }
        }
      };

      // 접속 시 같은 브라우저 탭들에 월드 상태 동기화 요청
      localBus.postMessage({
        type: 'sync_world_request',
        senderId: myId,
      });
    }

    // 2. Supabase Realtime Channel (Cross-device global multiplayer)
    const channel = supabase.channel('tiny_isles_world', {
      config: {
        presence: { key: myId },
        broadcast: { ack: false, self: false },
      },
    });
    channelRef.current = channel;

    // Send immediate movement broadcast
    const sendMoveBroadcast = () => {
      const p = localPlayerRef.current;
      const payload: Player = {
        id: p.id,
        name: p.name,
        color: p.color,
        x: Math.round(p.x),
        y: Math.round(p.y),
        direction: p.direction,
        action: p.action,
        lastUpdated: Date.now(),
        hp: p.hp,
        maxHp: p.maxHp,
      };

      if (localBus) {
        localBus.postMessage({
          type: 'player_move',
          senderId: myId,
          payload,
        });
      }

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'player_move',
          payload,
        });
      }
    };

    // Presence update helper: maintains accurate online player count and handles join/leave
    const updatePresenceState = () => {
      const state = channel.presenceState();
      const keys = Object.keys(state);
      setOnlineCount(Math.max(1, keys.length));

      // Register or update basic presence metadata for any existing player
      keys.forEach((key) => {
        if (key !== myId) {
          const presences = state[key] as unknown as { id?: string; name?: string; color?: PlayerColor }[];
          if (presences && presences.length > 0) {
            const p = presences[presences.length - 1];
            const pId = p.id || key;
            const existing = remotePlayersRef.current.get(pId);
            if (!existing) {
              remotePlayersRef.current.set(pId, {
                id: pId,
                name: p.name || '모험가',
                color: p.color || 'blue',
                x: 256,
                y: 256,
                direction: 'right',
                action: 'idle',
                lastUpdated: Date.now(),
                hp: 100,
                maxHp: 100,
              });
            } else {
              if (p.name) existing.name = p.name;
              if (p.color) existing.color = p.color;
            }
          }
        }
      });
    };

    channel
      .on('presence', { event: 'sync' }, () => {
        updatePresenceState();
      })
      .on('presence', { event: 'join' }, () => {
        updatePresenceState();
        // Greet newly joined player by announcing our position immediately
        sendMoveBroadcast();
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        if (Array.isArray(leftPresences)) {
          leftPresences.forEach((lp: any) => {
            const key = lp.id || lp.presence_ref;
            if (key) {
              remotePlayersRef.current.delete(key);
            }
          });
        }
        updatePresenceState();
      })
      .on('broadcast', { event: 'player_move' }, ({ payload }) => {
        handleRemotePlayerMove(payload);
      })
      .on('broadcast', { event: 'entity_hit' }, ({ payload }) => {
        const { entityId, damage, hitBy } = payload;
        handleRemoteHit(entityId, damage, hitBy);
      })
      .on('broadcast', { event: 'island_unlocked' }, ({ payload }) => {
        const { islandId, unlockedBy } = payload;
        unlockIslandLocally(islandId, unlockedBy, false);
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'unlocked_islands' },
        (payload) => {
          const newRow = payload.new as any;
          if (newRow && typeof newRow.island_id === 'number') {
            unlockIslandLocally(newRow.island_id, newRow.unlocked_by || '동료 모험가', false, true);
          }
        }
      )
      .on('broadcast', { event: 'sync_world_request' }, () => {
        const unlockedIds = islandsRef.current.filter((isl) => isl.unlocked).map((isl) => isl.id);
        channel.send({
          type: 'broadcast',
          event: 'sync_world_response',
          payload: { unlockedIds },
        });
      })
      .on('broadcast', { event: 'sync_world_response' }, ({ payload }) => {
        const { unlockedIds } = payload || {};
        if (Array.isArray(unlockedIds)) {
          for (const id of unlockedIds) {
            const isl = islandsRef.current.find((i) => i.id === id);
            if (isl && !isl.unlocked) {
              unlockIslandLocally(id, '동료 모험가', false);
            }
          }
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: myId,
            name: localPlayerRef.current.name,
            color: localPlayerRef.current.color,
          });
          sendMoveBroadcast();

          // 신규 접속 시 월드 상태 동기화 요청
          channel.send({
            type: 'broadcast',
            event: 'sync_world_request',
            payload: { requesterId: myId },
          });
        }
      });

    // 15Hz (approx 66ms) movement transmission & stale player cleaner
    let lastSentX = 0;
    let lastSentY = 0;
    let lastSentAction = '';
    let lastSentDirection = '';
    let heartbeatTick = 0;

    const moveInterval = setInterval(() => {
      const p = localPlayerRef.current;
      heartbeatTick++;

      const hasMoved = Math.abs(p.x - lastSentX) > 1 || Math.abs(p.y - lastSentY) > 1;
      const hasActionChanged = p.action !== lastSentAction || p.direction !== lastSentDirection;
      const isHeartbeat = heartbeatTick % 15 === 0; // Heartbeat ~1s to ensure position sync

      if (hasMoved || hasActionChanged || isHeartbeat) {
        lastSentX = p.x;
        lastSentY = p.y;
        lastSentAction = p.action;
        lastSentDirection = p.direction;
        sendMoveBroadcast();
      }

      // Cleanup inactive remote players (no update received for > 8s)
      const now = Date.now();
      let changed = false;
      remotePlayersRef.current.forEach((remote, key) => {
        if (now - remote.lastUpdated > 8000) {
          remotePlayersRef.current.delete(key);
          changed = true;
        }
      });
      if (changed) {
        updatePresenceState();
      }
    }, 66);

    return () => {
      clearInterval(moveInterval);
      if (localBus) localBus.close();
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [setOnlineCount, handleRemotePlayerMove]);

  // Remote hit handler
  const handleRemoteHit = (entityId: string, damage: number, hitByName: string) => {
    const entity = entitiesRef.current.find((e) => e.id === entityId);
    if (!entity) return;

    entity.hp -= damage;
    entity.shakeTime = Date.now() + 200;

    // Particles and sound
    createHitParticles(entity.x, entity.y, entity.type);
    if (entity.type === 'tree') sound.playChop();
    else sound.playMine();

    // Check destruction
    if (entity.hp <= 0) {
      sound.playBreak();
      removeAndRespawnEntity(entity);
    }
  };

  // Particles generator
  const createHitParticles = (x: number, y: number, type: string) => {
    const color = type === 'tree' ? '#8bc34a' : type === 'gold_rock' ? '#ffd700' : '#b0bec5';
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.5;
      particlesRef.current.push({
        x: x + 16,
        y: y + 16,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 3 + Math.random() * 4,
        life: 1,
        maxLife: 20 + Math.random() * 15,
      });
    }
  };

  // Remove and respawn entity
  const removeAndRespawnEntity = (entity: Entity) => {
    // Remove entity
    entitiesRef.current = entitiesRef.current.filter((e) => e.id !== entity.id);

    // Schedule respawn in 15 seconds
    setTimeout(() => {
      const currentIsland = islandsRef.current.find((isl) => isl.id === entity.islandId);
      if (currentIsland && currentIsland.unlocked) {
        entitiesRef.current.push({
          ...entity,
          hp: entity.maxHp,
          shakeTime: undefined,
        });
      }
    }, 15000);
  };

  // Unlock Island Logic
  const unlockIslandLocally = (
    islandId: number,
    unlockedBy: string,
    isLocalTrigger: boolean,
    showEffects: boolean = true
  ) => {
    const target = islandsRef.current.find((isl) => isl.id === islandId);
    if (!target || target.unlocked) return;

    target.unlocked = true;

    // Save unlocked islands state to localStorage
    const currentUnlockedIds = islandsRef.current.filter((isl) => isl.unlocked).map((isl) => isl.id);
    storage.saveUnlockedIslands(currentUnlockedIds);
    if (onUnlockedCountChange) {
      onUnlockedCountChange(currentUnlockedIds.length, islandsRef.current.length);
    }
    if (onUnlockedIslandIdsChange) {
      onUnlockedIslandIdsChange(currentUnlockedIds);
    }

    // Spawn entities for newly unlocked island
    const newEntities = generateIslandEntities(target.id, target.gridX, target.gridY);
    entitiesRef.current.push(...newEntities);

    if (showEffects) {
      // Fanfare and Confetti
      sound.playUnlock();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });

      // Floating banner text
      const origin = getIslandOrigin(target.gridX, target.gridY);
      floatingTextsRef.current.push({
        id: 'unlock_' + Math.random(),
        text: `🎉 ${unlockedBy}님이 ${target.name}을 해금했습니다!`,
        x: origin.x + 256,
        y: origin.y + 200,
        color: '#ffd700',
        alpha: 1,
        vy: -1.2,
      });
    }

    if (isLocalTrigger) {
      // 1. Supabase 서버 DB에 영구 저장 (전체 유저 공유)
      serverSync.saveUnlockedIsland(islandId, target.name, unlockedBy);

      // 2. 같은 브라우저 다른 탭 즉시 동기화
      if (localBusRef.current) {
        localBusRef.current.postMessage({
          type: 'island_unlocked',
          senderId: localPlayerRef.current.id,
          payload: { islandId, unlockedBy },
        });
      }
      // 3. 다른 온라인 접속자 실시간 브로드캐스트
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'island_unlocked',
          payload: { islandId, unlockedBy },
        });
      }
    }
  };

  // 1. Dash / Dodge Function (Space Bar & Mobile Dash)
  const tryDash = useCallback(() => {
    const now = Date.now();
    if (now < dashCooldownRef.current) return;
    dashCooldownRef.current = now + 1200;

    const player = localPlayerRef.current;
    const dashDist = 130;
    let dx = 0;
    let dy = 0;

    if (joystickRef?.current && (joystickRef.current.x !== 0 || joystickRef.current.y !== 0)) {
      dx = joystickRef.current.x;
      dy = joystickRef.current.y;
    } else if (keysRef.current['w'] || keysRef.current['arrowup']) dy -= 1;
    else if (keysRef.current['s'] || keysRef.current['arrowdown']) dy += 1;
    else if (keysRef.current['a'] || keysRef.current['arrowleft']) dx -= 1;
    else if (keysRef.current['d'] || keysRef.current['arrowright']) dx += 1;
    else {
      dx = player.direction === 'left' ? -1 : 1;
    }

    const len = Math.hypot(dx, dy) || 1;
    player.x += (dx / len) * dashDist;
    player.y += (dy / len) * dashDist;

    // Dash trail particles
    for (let i = 0; i < 8; i++) {
      particlesRef.current.push({
        x: player.x + (Math.random() - 0.5) * 24,
        y: player.y + (Math.random() - 0.5) * 24,
        vx: -(dx / len) * (Math.random() * 3),
        vy: -(dy / len) * (Math.random() * 3),
        color: '#818cf8',
        size: 4,
        life: 0,
        maxLife: 18,
      });
    }
    sound.playBreak();
  }, [joystickRef]);

  // 2. Wave Spawner (Timer or Early Call)
  const spawnWave = useCallback(
    (isBoss = false) => {
      const capitalCore = { x: 256, y: 256 };
      const directions = ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'] as const;
      const pickedDir = directions[Math.floor(Math.random() * directions.length)];
      onWarningDirectionChange?.(pickedDir);

      const angleMap: Record<typeof directions[number], number> = {
        E: 0,
        SE: Math.PI / 4,
        S: Math.PI / 2,
        SW: (3 * Math.PI) / 4,
        W: Math.PI,
        NW: -(3 * Math.PI) / 4,
        N: -Math.PI / 2,
        NE: -Math.PI / 4,
      };
      const baseAngle = angleMap[pickedDir];
      const spawnDist = 650;

      const count = isBoss ? 16 : 10;
      for (let i = 0; i < count; i++) {
        const angle = baseAngle + (Math.random() - 0.5) * 0.75;
        const dist = spawnDist + Math.random() * 120;
        const sx = capitalCore.x + Math.cos(angle) * dist;
        const sy = capitalCore.y + Math.sin(angle) * dist;

        const isSkeleton = Math.random() < 0.35;
        const mType = isSkeleton ? 'skeleton' : 'zombie';

        monstersRef.current.push({
          id: `m_${Date.now()}_${i}_${Math.random()}`,
          type: mType,
          x: sx,
          y: sy,
          hp: isSkeleton ? 35 : 50,
          maxHp: isSkeleton ? 35 : 50,
          speed: isSkeleton ? 1.0 : 1.15,
          attackPower: isSkeleton ? 6 : 8,
          attackRange: isSkeleton ? 160 : 38,
          attackCooldown: isSkeleton ? 1800 : 1000,
          lastAttackTime: 0,
          targetType: 'core',
          targetX: capitalCore.x,
          targetY: capitalCore.y,
        });
      }

      if (isBoss) {
        const sx = capitalCore.x + Math.cos(baseAngle) * (spawnDist + 50);
        const sy = capitalCore.y + Math.sin(baseAngle) * (spawnDist + 50);
        monstersRef.current.push({
          id: `boss_${Date.now()}`,
          type: 'boss',
          x: sx,
          y: sy,
          hp: 550,
          maxHp: 550,
          speed: 0.85,
          attackPower: 30,
          attackRange: 55,
          attackCooldown: 1600,
          lastAttackTime: 0,
          targetType: 'core',
          targetX: capitalCore.x,
          targetY: capitalCore.y,
        });

        floatingTextsRef.current.push({
          id: 'boss_alert_' + Math.random(),
          text: '👑 거대 보스 몬스터 침공!',
          x: localPlayerRef.current.x,
          y: localPlayerRef.current.y - 60,
          color: '#f43f5e',
          alpha: 1,
          vy: -1.0,
        });
      }

      sound.playBreak();
    },
    [onWarningDirectionChange]
  );

  // 3. Building Placement
  const tryPlaceBuilding = useCallback(
    (typeToBuild?: BuildingType | null) => {
      const bType = typeToBuild || selectedBuildingRef.current;
      if (!bType) return;
      const def = BUILDING_DEFS[bType];
      if (!def) return;

      if (
        inventory.wood < def.costWood ||
        inventory.stone < def.costStone ||
        inventory.gold < def.costGold
      ) {
        floatingTextsRef.current.push({
          id: 'b_cost_' + Math.random(),
          text: '자원이 부족합니다!',
          x: localPlayerRef.current.x,
          y: localPlayerRef.current.y - 30,
          color: '#ef4444',
          alpha: 1,
          vy: -1.0,
        });
        return;
      }

      const player = localPlayerRef.current;
      const forwardX = player.direction === 'left' ? -56 : 56;
      const targetX = Math.round((player.x + forwardX) / 32) * 32;
      const targetY = Math.round(player.y / 32) * 32;

      const isOverlap = buildingsRef.current.some(
        (b) => Math.hypot(b.x - targetX, b.y - targetY) < 28
      );
      if (isOverlap) {
        floatingTextsRef.current.push({
          id: 'b_over_' + Math.random(),
          text: '이미 건물이 있습니다',
          x: targetX,
          y: targetY - 20,
          color: '#f59e0b',
          alpha: 1,
          vy: -0.8,
        });
        return;
      }

      onUpdateInventory((prev) => ({
        wood: prev.wood - def.costWood,
        stone: prev.stone - def.costStone,
        gold: prev.gold - def.costGold,
      }));

      const newBuilding: Building = {
        id: `b_${Date.now()}_${Math.random()}`,
        type: bType,
        x: targetX,
        y: targetY,
        hp: def.hp,
        maxHp: def.hp,
        territoryId: 0,
        range: def.range,
        damage: def.damage,
        attackCooldown: def.attackCooldown,
        lastAttackTime: 0,
      };
      buildingsRef.current.push(newBuilding);

      for (let i = 0; i < 6; i++) {
        particlesRef.current.push({
          x: targetX,
          y: targetY,
          vx: (Math.random() - 0.5) * 3,
          vy: (Math.random() - 0.5) * 3,
          color: '#d97706',
          size: 4,
          life: 0,
          maxLife: 15,
        });
      }

      floatingTextsRef.current.push({
        id: 'b_done_' + Math.random(),
        text: `🔨 ${def.name} 건설!`,
        x: targetX,
        y: targetY - 25,
        color: '#fbbf24',
        alpha: 1,
        vy: -1.2,
      });

      sound.playBreak();
      onBuildSuccess?.();
    },
    [inventory, onUpdateInventory, onBuildSuccess]
  );

  // 4. Action: Attack Monster or Harvest Resource
  const tryAttackOrHarvest = useCallback(() => {
    lastInteractTimeRef.current = Date.now();
    const player = localPlayerRef.current;
    const px = player.x;
    const py = player.y;

    // 1) Monster Attack Priority
    let nearestMonster: Monster | null = null;
    let minMonsterDist = 95;

    for (const monster of monstersRef.current) {
      const dist = Math.hypot(px - monster.x, py - monster.y);
      if (dist < minMonsterDist) {
        minMonsterDist = dist;
        nearestMonster = monster;
      }
    }

    if (nearestMonster) {
      player.action = 'axe';
      if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current);
      actionTimeoutRef.current = setTimeout(() => {
        player.action = 'idle';
      }, 250);

      const damage = 25;
      nearestMonster.hp -= damage;

      // Knockback
      const kx = nearestMonster.x - px;
      const ky = nearestMonster.y - py;
      const klen = Math.hypot(kx, ky) || 1;
      nearestMonster.x += (kx / klen) * 22;
      nearestMonster.y += (ky / klen) * 22;

      for (let i = 0; i < 6; i++) {
        particlesRef.current.push({
          x: nearestMonster.x,
          y: nearestMonster.y,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4,
          color: '#f43f5e',
          size: 3,
          life: 0,
          maxLife: 15,
        });
      }

      floatingTextsRef.current.push({
        id: 'dmg_' + Math.random(),
        text: `⚔️ -${damage}`,
        x: nearestMonster.x,
        y: nearestMonster.y - 15,
        color: '#fb7185',
        alpha: 1,
        vy: -1.4,
      });

      if (nearestMonster.hp <= 0) {
        const goldDrop = nearestMonster.type === 'boss' ? 15 : nearestMonster.type === 'skeleton' ? 2 : 1;
        onUpdateInventory((prev) => ({
          ...prev,
          gold: prev.gold + goldDrop,
          stone: prev.stone + 1,
        }));

        floatingTextsRef.current.push({
          id: 'gold_' + Math.random(),
          text: `🪙 +${goldDrop}`,
          x: nearestMonster.x,
          y: nearestMonster.y - 30,
          color: '#facc15',
          alpha: 1,
          vy: -1.6,
        });

        monstersRef.current = monstersRef.current.filter((m) => m.id !== nearestMonster!.id);
        sound.playBreak();
      } else {
        sound.playMine();
      }
      return;
    }

    // 2) Entity Harvest (Wood, Stone, Gold)
    let nearestEntity: Entity | null = null;
    let minDist = 90;

    for (const ent of entitiesRef.current) {
      if (ent.type === 'core_gem') continue; // core gem handled in tryInteract
      const dist = Math.hypot(px - (ent.x + 16), py - (ent.y + 16));
      if (dist < minDist) {
        minDist = dist;
        nearestEntity = ent;
      }
    }

    const toolAction: PlayerAction = nearestEntity?.type === 'tree' ? 'axe' : 'pickaxe';
    player.action = toolAction;

    if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current);
    actionTimeoutRef.current = setTimeout(() => {
      player.action = 'idle';
    }, 280);

    if (nearestEntity) {
      const damage = 1;
      nearestEntity.hp -= damage;
      nearestEntity.shakeTime = Date.now() + 200;

      createHitParticles(nearestEntity.x, nearestEntity.y, nearestEntity.type);
      if (nearestEntity.type === 'tree') {
        sound.playChop();
      } else {
        sound.playMine();
      }

      const resType =
        nearestEntity.type === 'tree'
          ? 'wood'
          : nearestEntity.type === 'gold_rock'
          ? 'gold'
          : 'stone';

      onUpdateInventory((prev) => ({
        ...prev,
        [resType]: prev[resType] + 1,
      }));

      const icon = resType === 'wood' ? '🪵 +1' : resType === 'gold' ? '🪙 +1' : '🪨 +1';
      const color = resType === 'wood' ? '#8bc34a' : resType === 'gold' ? '#ffd700' : '#cfd8dc';
      floatingTextsRef.current.push({
        id: 'txt_' + Math.random(),
        text: icon,
        x: nearestEntity.x + 16,
        y: nearestEntity.y,
        color,
        alpha: 1,
        vy: -1.2,
      });

      if (nearestEntity.hp <= 0) {
        sound.playBreak();
        removeAndRespawnEntity(nearestEntity);
      }
    }
  }, [onUpdateInventory]);

  // 5. Interacting with Core Gems, Village Hall, or Territory Expansion
  const tryInteract = useCallback(() => {
    lastInteractTimeRef.current = Date.now();
    const player = localPlayerRef.current;
    const px = player.x;
    const py = player.y;

    // Check Core Gem repair
    const capitalIsland = islandsRef.current[0];
    const capitalCoreX = 256;
    const capitalCoreY = 256;
    if (Math.hypot(px - capitalCoreX, py - capitalCoreY) < 100) {
      if (capitalIsland.coreHp < capitalIsland.maxCoreHp) {
        if (inventory.stone >= 8) {
          onUpdateInventory((prev) => ({ ...prev, stone: prev.stone - 8 }));
          capitalIsland.coreHp = Math.min(capitalIsland.maxCoreHp, capitalIsland.coreHp + 100);
          onCapitalCoreHpChange?.(capitalIsland.coreHp, capitalIsland.maxCoreHp);
          floatingTextsRef.current.push({
            id: 'core_rep_' + Math.random(),
            text: '💎 수도 코어 수리 (+100)',
            x: capitalCoreX,
            y: capitalCoreY - 30,
            color: '#38bdf8',
            alpha: 1,
            vy: -1.2,
          });
          sound.playBreak();
          return;
        } else {
          floatingTextsRef.current.push({
            id: 'core_no_stone_' + Math.random(),
            text: '수리 필요: 🪨석재 8',
            x: capitalCoreX,
            y: capitalCoreY - 30,
            color: '#f87171',
            alpha: 1,
            vy: -1.0,
          });
          return;
        }
      }
    }

    // Check Territory Unlock
    for (const island of islandsRef.current) {
      if (!island.unlocked) {
        const origin = getIslandOrigin(island.gridX, island.gridY);
        const signX = origin.x + 256;
        const signY = origin.y + 256;
        const dist = Math.hypot(px - signX, py - signY);

        if (dist < 180) {
          if (
            inventory.wood >= island.costWood &&
            inventory.stone >= island.costStone &&
            inventory.gold >= island.costGold
          ) {
            onUpdateInventory((prev) => ({
              wood: prev.wood - island.costWood,
              stone: prev.stone - island.costStone,
              gold: prev.gold - island.costGold,
            }));
            unlockIslandLocally(island.id, player.name, true);
            return;
          } else {
            floatingTextsRef.current.push({
              id: 'cost_' + Math.random(),
              text: `자원이 부족합니다! (🪵${island.costWood} 🪨${island.costStone})`,
              x: signX,
              y: signY - 40,
              color: '#ff5252',
              alpha: 1,
              vy: -0.8,
            });
            return;
          }
        }
      }
    }
  }, [inventory, onUpdateInventory, onCapitalCoreHpChange]);

  // Keyboard & Action Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      keysRef.current[e.key.toLowerCase()] = true;

      if (e.key === ' ') {
        e.preventDefault();
        tryDash();
      } else if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        tryInteract();
      } else if (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'q') {
        e.preventDefault();
        tryAttackOrHarvest();
      } else if (e.key === '1') {
        tryPlaceBuilding('fence');
      } else if (e.key === '2') {
        tryPlaceBuilding('wall');
      } else if (e.key === '3') {
        tryPlaceBuilding('arrow_tower');
      } else if (e.key === '4') {
        tryPlaceBuilding('cannon_tower');
      } else if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
        e.preventDefault();
        const next = Math.min(2.0, Number((targetZoomRef.current + 0.15).toFixed(2)));
        targetZoomRef.current = next;
        onZoomChangeRef.current?.(next);
      } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        const next = Math.max(0.5, Number((targetZoomRef.current - 0.15).toFixed(2)));
        targetZoomRef.current = next;
        onZoomChangeRef.current?.(next);
      } else if (e.key === '0' || e.code === 'Numpad0') {
        e.preventDefault();
        targetZoomRef.current = 1.0;
        onZoomChangeRef.current?.(1.0);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };

    const handleWindowBlur = () => {
      keysRef.current = {};
    };

    const handlePlayerAction = () => {
      tryAttackOrHarvest();
    };

    const handlePlayerDash = () => {
      tryDash();
    };

    const handlePlayerBuild = () => {
      tryPlaceBuilding();
    };

    const handleCallWave = () => {
      spawnWave(sessionRef.current.isBossWave);
      onUpdateSession((prev) => ({
        ...prev,
        waveIncoming: true,
        timeToNextWave: prev.modeMinutes === 30 ? 600 : 900,
      }));
    };

    const handleInteractCore = () => {
      tryInteract();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('player-action', handlePlayerAction);
    window.addEventListener('player-dash', handlePlayerDash);
    window.addEventListener('player-build', handlePlayerBuild);
    window.addEventListener('call-wave', handleCallWave);
    window.addEventListener('player-interact-core', handleInteractCore);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('player-action', handlePlayerAction);
      window.removeEventListener('player-dash', handlePlayerDash);
      window.removeEventListener('player-build', handlePlayerBuild);
      window.removeEventListener('call-wave', handleCallWave);
      window.removeEventListener('player-interact-core', handleInteractCore);
    };
  }, [tryAttackOrHarvest, tryDash, tryInteract, tryPlaceBuilding, spawnWave, onUpdateSession]);

  // Main Canvas Render Loop
  useEffect(() => {
    if (!assetsLoaded) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const handleResize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // Wheel Zoom handler (smooth mouse wheel zoom on PC)
    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('.overflow-y-auto, input, textarea, select')) {
        return;
      }
      e.preventDefault();
      const step = 0.12;
      const next = e.deltaY < 0 ? targetZoomRef.current + step : targetZoomRef.current - step;
      const clamped = Math.min(2.0, Math.max(0.5, Number(next.toFixed(2))));
      targetZoomRef.current = clamped;
      onZoomChangeRef.current?.(clamped);
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('wheel', handleWheel, { passive: false });

    // Touch Pinch-to-Zoom handlers on mobile (two-finger spread/pinch)
    let touchStartDist: number | null = null;
    let touchStartZoom = 1.0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        isPinchingRef.current = true;
        mouseTargetRef.current.active = false;
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        touchStartZoom = targetZoomRef.current;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        isPinchingRef.current = true;
        mouseTargetRef.current.active = false;

        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );

        if (touchStartDist === null || touchStartDist <= 0) {
          touchStartDist = currentDist;
          touchStartZoom = targetZoomRef.current;
          return;
        }

        const factor = currentDist / touchStartDist;
        const next = Math.min(2.0, Math.max(0.5, Number((touchStartZoom * factor).toFixed(2))));
        targetZoomRef.current = next;
        onZoomChangeRef.current?.(next);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        if (touchStartDist !== null || isPinchingRef.current) {
          isPinchingRef.current = false;
          touchStartDist = null;
          lastPinchEndTimeRef.current = Date.now();
        }
      }
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: true });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    const render = () => {
      const assets = assetsRef.current;
      if (!assets) return;

      const player = localPlayerRef.current;
      const speed = 4.8;

      // 1. Process Movement
      let dx = 0;
      let dy = 0;
      const keys = keysRef.current;

      if (keys['w'] || keys['arrowup']) dy -= 1;
      if (keys['s'] || keys['arrowdown']) dy += 1;
      if (keys['a'] || keys['arrowleft']) dx -= 1;
      if (keys['d'] || keys['arrowright']) dx += 1;

      // Mobile Virtual Joystick movement
      if (joystickRef?.current) {
        const jx = joystickRef.current.x;
        const jy = joystickRef.current.y;
        if (Math.abs(jx) > 0.05 || Math.abs(jy) > 0.05) {
          dx += jx;
          dy += jy;
          mouseTargetRef.current.active = false;
        }
      }

      // Cancel mouse target if keyboard is pressed
      if (dx !== 0 || dy !== 0) {
        mouseTargetRef.current.active = false;
      }

      // Mouse click movement if active
      if (mouseTargetRef.current.active) {
        const dist = Math.hypot(mouseTargetRef.current.worldX - player.x, mouseTargetRef.current.worldY - player.y);
        if (dist > 8) {
          dx = (mouseTargetRef.current.worldX - player.x) / dist;
          dy = (mouseTargetRef.current.worldY - player.y) / dist;
        } else {
          mouseTargetRef.current.active = false;
        }
      }

      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        const factor = Math.min(1, len);
        player.x += (dx / len) * speed * factor;
        player.y += (dy / len) * speed * factor;

        if (dx < 0) player.direction = 'left';
        else if (dx > 0) player.direction = 'right';

        if (player.action !== 'axe' && player.action !== 'pickaxe') {
          player.action = 'run';
        }
      } else {
        if (player.action === 'run') {
          player.action = 'idle';
        }
      }

      // Continuous keyboard action if Space or E is held down
      const currentNow = Date.now();
      if ((keysRef.current[' '] || keysRef.current['e']) && currentNow - lastInteractTimeRef.current >= 240) {
        lastInteractTimeRef.current = currentNow;
        tryInteract();
      }

      // Track nearest locked island for mobile action button & contextual prompt
      let nearLocked: Island | null = null;
      for (const isl of islandsRef.current) {
        if (!isl.unlocked) {
          const origin = getIslandOrigin(isl.gridX, isl.gridY);
          const signX = origin.x + 256;
          const signY = origin.y + 256;
          const dist = Math.hypot(player.x - signX, player.y - signY);
          if (dist < 190) {
            nearLocked = isl;
            break;
          }
        }
      }
      if (nearLocked?.id !== lastNearIslandRef.current?.id) {
        lastNearIslandRef.current = nearLocked;
        onNearIslandChange?.(nearLocked);
      }

      // Track current player island grid coordinate for minimap
      const currentGridX = Math.round(player.x / (ISLAND_PX + ISLAND_GAP));
      const currentGridY = Math.round(player.y / (ISLAND_PX + ISLAND_GAP));
      if (
        currentGridX !== lastGridPosRef.current.gridX ||
        currentGridY !== lastGridPosRef.current.gridY
      ) {
        lastGridPosRef.current = { gridX: currentGridX, gridY: currentGridY };
        onPlayerPositionChange?.({ gridX: currentGridX, gridY: currentGridY });
      }

      // ──────────────────────────────────────────────────────────
      // [Defense Simulation Engine] Waves, Monsters, Towers, Core
      // ──────────────────────────────────────────────────────────
      const simNow = Date.now();
      const capitalIsland = islandsRef.current[0];
      const capitalCoreX = 256;
      const capitalCoreY = 256;

      // A. Periodic 1-Second Timer Tick (Wave Countdown & Healing)
      if (simNow - lastWaveCheckRef.current >= 1000) {
        lastWaveCheckRef.current = simNow;

        // Capital Core Healing Zone: If player is near Capital core, heal +4 HP
        const distToCore = Math.hypot(player.x - capitalCoreX, player.y - capitalCoreY);
        if (distToCore < 180 && player.hp < player.maxHp) {
          player.hp = Math.min(player.maxHp, player.hp + 4);
          onPlayerHpChange?.(player.hp, player.maxHp);
          particlesRef.current.push({
            x: player.x + (Math.random() - 0.5) * 20,
            y: player.y + (Math.random() - 0.5) * 20,
            vx: 0,
            vy: -1.5,
            color: '#4ade80',
            size: 3,
            life: 0,
            maxLife: 20,
          });
        }

        // Check if near core for contextual HUD prompt
        onNearCoreChange?.(distToCore < 100);
        onNearVillageCenterChange?.(distToCore < 120);

        // Wave Timer Countdown
        onUpdateSession((prev) => {
          if (prev.isGameOver || prev.isVictory) return prev;

          const nextElapsed = prev.elapsedSeconds + 1;
          let nextTimeToWave = prev.timeToNextWave;
          let nextWaveIncoming = prev.waveIncoming;
          let nextWaveIndex = prev.waveIndex;
          let nextIsBoss = prev.isBossWave;
          let isVictory: boolean = prev.isVictory;

          // Victory Condition Check
          const targetDuration = prev.modeMinutes * 60;
          if (nextElapsed >= targetDuration && !nextWaveIncoming && monstersRef.current.length === 0) {
            isVictory = true;
          }

          if (!prev.waveIncoming) {
            nextTimeToWave = Math.max(0, prev.timeToNextWave - 1);
            if (nextTimeToWave <= 0) {
              nextWaveIncoming = true;
              spawnWave(prev.isBossWave);
            }
          } else {
            // During wave: if all monsters defeated, wave complete!
            if (monstersRef.current.length === 0) {
              nextWaveIncoming = false;
              nextWaveIndex = prev.waveIndex + 1;
              const waveInterval = prev.modeMinutes === 30 ? 600 : 900;
              nextTimeToWave = waveInterval;

              // Check if next wave is boss wave
              if (prev.modeMinutes === 30 && nextWaveIndex >= 2) {
                nextIsBoss = true;
              } else if (prev.modeMinutes === 60 && nextWaveIndex >= 3) {
                nextIsBoss = true;
              }

              floatingTextsRef.current.push({
                id: 'wave_clear_' + Math.random(),
                text: '🎉 웨이브 방어 성공! 잠시 휴식 시간',
                x: player.x,
                y: player.y - 45,
                color: '#34d399',
                alpha: 1,
                vy: -1.2,
              });
            }
          }

          return {
            ...prev,
            elapsedSeconds: nextElapsed,
            timeToNextWave: nextTimeToWave,
            waveIncoming: nextWaveIncoming,
            waveIndex: nextWaveIndex,
            isBossWave: nextIsBoss,
            isVictory,
          };
        });

        // Update monster count in HUD
        onMonsterCountChange?.(monstersRef.current.length);
        onCapitalCoreHpChange?.(capitalIsland.coreHp, capitalIsland.maxCoreHp);
        onPlayerHpChange?.(player.hp, player.maxHp);
      }

      // B. Tower Auto-Attack Logic
      for (const b of buildingsRef.current) {
        if (b.type === 'arrow_tower' || b.type === 'cannon_tower') {
          if (simNow - b.lastAttackTime >= b.attackCooldown) {
            let targetMonster: Monster | null = null;
            let minDist = b.range;

            for (const m of monstersRef.current) {
              const d = Math.hypot(b.x - m.x, b.y - m.y);
              if (d < minDist) {
                minDist = d;
                targetMonster = m;
              }
            }

            if (targetMonster) {
              b.lastAttackTime = simNow;
              projectilesRef.current.push({
                id: `p_${simNow}_${Math.random()}`,
                x: b.x,
                y: b.y - 12,
                targetX: targetMonster.x,
                targetY: targetMonster.y,
                targetId: targetMonster.id,
                speed: b.type === 'arrow_tower' ? 7.5 : 5.0,
                damage: b.damage,
                type: b.type === 'arrow_tower' ? 'arrow' : 'cannonball',
                source: 'tower',
              });
            }
          }
        }
      }

      // C. Projectiles Simulation & Collision
      projectilesRef.current.forEach((p) => {
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.hypot(dx, dy);

        if (dist <= p.speed + 4) {
          // Hit Target
          p.x = p.targetX;
          p.y = p.targetY;

          // Apply damage to monsters
          for (const m of monstersRef.current) {
            const hitDist = Math.hypot(p.x - m.x, p.y - m.y);
            const splashRadius = p.type === 'cannonball' ? 65 : 24;

            if (hitDist <= splashRadius) {
              m.hp -= p.damage;
              floatingTextsRef.current.push({
                id: 'p_dmg_' + Math.random(),
                text: `-${p.damage}`,
                x: m.x,
                y: m.y - 15,
                color: p.type === 'cannonball' ? '#f97316' : '#fbbf24',
                alpha: 1,
                vy: -1.2,
              });

              for (let i = 0; i < (p.type === 'cannonball' ? 8 : 4); i++) {
                particlesRef.current.push({
                  x: m.x,
                  y: m.y,
                  vx: (Math.random() - 0.5) * 4,
                  vy: (Math.random() - 0.5) * 4,
                  color: p.type === 'cannonball' ? '#ea580c' : '#fbbf24',
                  size: p.type === 'cannonball' ? 4 : 2.5,
                  life: 0,
                  maxLife: 15,
                });
              }
            }
          }
        } else {
          p.x += (dx / dist) * p.speed;
          p.y += (dy / dist) * p.speed;
        }
      });

      // Filter dead monsters and dead projectiles
      projectilesRef.current = projectilesRef.current.filter((p) => {
        return Math.hypot(p.targetX - p.x, p.targetY - p.y) > p.speed;
      });

      monstersRef.current = monstersRef.current.filter((m) => {
        if (m.hp <= 0) {
          onUpdateInventory((prev) => ({
            ...prev,
            gold: prev.gold + (m.type === 'boss' ? 20 : 1),
            stone: prev.stone + 1,
          }));
          return false;
        }
        return true;
      });

      // D. Monster AI & Attack Simulation
      for (const m of monstersRef.current) {
        // Target 1: Check nearby barricades or walls blocking path
        let blockingBuilding: Building | null = null;
        for (const b of buildingsRef.current) {
          if (Math.hypot(m.x - b.x, m.y - b.y) < 28) {
            blockingBuilding = b;
            break;
          }
        }

        if (blockingBuilding) {
          // Attack Building
          if (simNow - m.lastAttackTime >= m.attackCooldown) {
            m.lastAttackTime = simNow;
            blockingBuilding.hp -= m.attackPower;
            floatingTextsRef.current.push({
              id: 'b_hit_' + Math.random(),
              text: `-${m.attackPower}`,
              x: blockingBuilding.x,
              y: blockingBuilding.y - 12,
              color: '#ef4444',
              alpha: 1,
              vy: -0.8,
            });
            if (blockingBuilding.hp <= 0) {
              sound.playBreak();
              buildingsRef.current = buildingsRef.current.filter((b) => b.id !== blockingBuilding!.id);
            }
          }
          continue; // Blocked by wall, cannot walk
        }

        // Target 2: Attack player if close
        const distToPlayer = Math.hypot(m.x - player.x, m.y - player.y);
        if (distToPlayer < 36) {
          if (simNow - m.lastAttackTime >= m.attackCooldown) {
            m.lastAttackTime = simNow;
            player.hp = Math.max(0, player.hp - m.attackPower);
            onPlayerHpChange?.(player.hp, player.maxHp);
            floatingTextsRef.current.push({
              id: 'p_hit_' + Math.random(),
              text: `-${m.attackPower} HP`,
              x: player.x,
              y: player.y - 20,
              color: '#dc2626',
              alpha: 1,
              vy: -1.2,
            });
          }
          continue;
        }

        // Target 3: Attack Capital Core if close
        const distToCapitalCore = Math.hypot(m.x - capitalCoreX, m.y - capitalCoreY);
        if (distToCapitalCore < 48) {
          if (simNow - m.lastAttackTime >= m.attackCooldown) {
            m.lastAttackTime = simNow;
            capitalIsland.coreHp = Math.max(0, capitalIsland.coreHp - m.attackPower);
            onCapitalCoreHpChange?.(capitalIsland.coreHp, capitalIsland.maxCoreHp);
            floatingTextsRef.current.push({
              id: 'core_dmg_' + Math.random(),
              text: `💎 -${m.attackPower}`,
              x: capitalCoreX,
              y: capitalCoreY - 25,
              color: '#dc2626',
              alpha: 1,
              vy: -1.2,
            });

            // GAME OVER CHECK
            if (capitalIsland.coreHp <= 0) {
              onUpdateSession((prev) => ({ ...prev, isGameOver: true }));
              sound.playBreak();
            }
          }
          continue;
        }

        // Otherwise: Move towards Capital Core (256, 256)
        const mx = capitalCoreX - m.x;
        const my = capitalCoreY - m.y;
        const mdist = Math.hypot(mx, my) || 1;
        m.x += (mx / mdist) * m.speed;
        m.y += (my / mdist) * m.speed;
      }

      // 2. Camera follow (smooth lerp)
      cameraRef.current.x += (player.x - cameraRef.current.x) * 0.1;
      cameraRef.current.y += (player.y - cameraRef.current.y) * 0.1;

      // 2-1. Smooth Zoom lerp
      zoomRef.current += (targetZoomRef.current - zoomRef.current) * 0.18;

      const camX = Math.round(cameraRef.current.x);
      const camY = Math.round(cameraRef.current.y);

      // Clear & Draw Continual Green Plains Continent Background
      ctx.fillStyle = '#1e381f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(zoomRef.current, zoomRef.current);
      ctx.translate(-camX, -camY);

      const now = Date.now();

      // 4. Draw Continuous Continent Territories (바다가 아닌 광활한 육지 마을 단위)
      for (const island of islandsRef.current) {
        const origin = getIslandOrigin(island.gridX, island.gridY);

        if (island.unlocked) {
          // A. Draw Lush Green Ground Grass Tiles
          for (let tx = 0; tx < ISLAND_TILES; tx++) {
            for (let ty = 0; ty < ISLAND_TILES; ty++) {
              const tileX = origin.x + tx * TILE_SIZE;
              const tileY = origin.y + ty * TILE_SIZE;

              // Grass from tilemap (64x64 at srcX: 64, srcY: 64)
              ctx.drawImage(
                assets.tilemap,
                64, 64, 64, 64,
                tileX, tileY, TILE_SIZE, TILE_SIZE
              );
            }
          }

          // Territory Boundary Line (영토 경계 흙길/경계선 마커)
          ctx.strokeStyle = 'rgba(74, 222, 128, 0.25)';
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 8]);
          ctx.strokeRect(origin.x + 2, origin.y + 2, ISLAND_PX - 4, ISLAND_PX - 4);
          ctx.setLineDash([]);
        } else {
          // B. Locked Territory: Dark Mysterious Mist & Ancient Border Marker
          ctx.save();
          // Dark fog covering unexplored wild territory
          ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
          ctx.fillRect(origin.x, origin.y, ISLAND_PX, ISLAND_PX);

          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 3;
          ctx.setLineDash([12, 10]);
          ctx.strokeRect(origin.x, origin.y, ISLAND_PX, ISLAND_PX);
          ctx.restore();

          // Signpost & Cost Badge
          const signX = origin.x + 256;
          const signY = origin.y + 256;
          const canAfford =
            inventory.wood >= island.costWood &&
            inventory.stone >= island.costStone &&
            inventory.gold >= island.costGold;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.beginPath();
          ctx.roundRect(signX - 110, signY - 45, 220, 90, 12);
          ctx.fill();
          ctx.strokeStyle = canAfford ? '#4ade80' : '#f59e0b';
          ctx.lineWidth = canAfford ? 2.5 : 1.5;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 14px Pretendard, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`🚩 ${island.name}`, signX, signY - 18);

          ctx.font = 'bold 12px Pretendard, sans-serif';
          ctx.fillStyle = canAfford ? '#86efac' : '#fcd34d';
          const costStr = `필요: 🪵${island.costWood}  🪨${island.costStone}${island.costGold > 0 ? `  🪙${island.costGold}` : ''}`;
          ctx.fillText(costStr, signX, signY + 8);

          ctx.font = 'bold 11px Pretendard, sans-serif';
          const isMobile = canvas.width < 768;
          if (canAfford) {
            ctx.fillStyle = '#4ade80';
            ctx.fillText(isMobile ? '✨ 개척 가능! [개척 터치]' : '✨ 개척 가능! [E 키]', signX, signY + 30);
          } else {
            ctx.fillStyle = '#f87171';
            ctx.fillText('미개척 구역 [자원 부족]', signX, signY + 30);
          }
        }
      }

      // 5. Draw Entities (Trees, Rocks, Gold Rocks, Core Gems)
      const sortedEntities = [...entitiesRef.current].sort((a, b) => a.y - b.y);

      for (const ent of sortedEntities) {
        let shakeOffset = 0;
        if (ent.shakeTime && ent.shakeTime > now) {
          shakeOffset = Math.sin((now / 20) * Math.PI) * 5;
        }

        const drawX = ent.x + shakeOffset;
        const drawY = ent.y;

        // Core Gem Rendering (수호 코어 보석)
        if (ent.type === 'core_gem') {
          const isCapital = ent.islandId === 0;
          ctx.save();
          const glowGrad = ctx.createRadialGradient(
            drawX + 16,
            drawY + 16,
            4,
            drawX + 16,
            drawY + 16,
            isCapital ? 60 : 36
          );
          glowGrad.addColorStop(0, isCapital ? 'rgba(56, 189, 248, 0.75)' : 'rgba(168, 85, 247, 0.55)');
          glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.arc(drawX + 16, drawY + 16, isCapital ? 60 : 36, 0, Math.PI * 2);
          ctx.fill();

          const size = isCapital ? 26 : 18;
          ctx.fillStyle = isCapital ? '#38bdf8' : '#c084fc';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(drawX + 16, drawY + 16 - size);
          ctx.lineTo(drawX + 16 + size * 0.7, drawY + 16);
          ctx.lineTo(drawX + 16, drawY + 16 + size);
          ctx.lineTo(drawX + 16 - size * 0.7, drawY + 16);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(drawX + 16 - 4, drawY + 16 - 6, isCapital ? 4 : 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          const barW = isCapital ? 60 : 40;
          const barH = isCapital ? 6 : 4;
          const barX = drawX + 16 - barW / 2;
          const barY = drawY - (isCapital ? 24 : 14);
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillRect(barX, barY, barW, barH);
          ctx.fillStyle = isCapital ? '#38bdf8' : '#a855f7';
          ctx.fillRect(barX, barY, (ent.hp / ent.maxHp) * barW, barH);
          continue;
        }

        if (ent.type === 'tree') {
          const treeFrame = Math.floor((now / 220) % 8);
          ctx.drawImage(
            assets.tree,
            treeFrame * 192, 0, 192, 256,
            drawX - 64, drawY - 160, 160, 200
          );
        } else if (ent.type === 'rock') {
          ctx.drawImage(assets.rock1, drawX, drawY - 16, 64, 64);
        } else if (ent.type === 'gold_rock') {
          ctx.save();
          ctx.drawImage(assets.rock2, drawX, drawY - 16, 64, 64);
          ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
          ctx.beginPath();
          ctx.arc(drawX + 32, drawY + 16, 24, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        if (ent.hp < ent.maxHp) {
          const barW = 40;
          const barH = 5;
          const barX = ent.x + 16 - barW / 2;
          const barY = ent.y - 12;

          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(barX, barY, barW, barH);
          ctx.fillStyle = '#4caf50';
          ctx.fillRect(barX, barY, (ent.hp / ent.maxHp) * barW, barH);
        }
      }

      // 5-1. Draw Buildings: 중세 뾰족한 목재 말뚝 방책 & 석재 성벽 & 타워
      for (const b of buildingsRef.current) {
        ctx.save();
        if (b.type === 'fence') {
          // 진정한 중세 목재 방책(Wooden Palisade): 뾰족한 원목 말뚝 3개 묶음 + 가로 띠목
          ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
          ctx.fillRect(b.x - 14, b.y + 8, 28, 5);

          const logWidth = 8;
          for (let li = -1; li <= 1; li++) {
            const lx = b.x + li * 9;
            ctx.fillStyle = '#854d0e';
            ctx.fillRect(lx - 4, b.y - 10, logWidth, 22);

            ctx.fillStyle = '#a16207';
            ctx.beginPath();
            ctx.moveTo(lx, b.y - 18);
            ctx.lineTo(lx + 4, b.y - 10);
            ctx.lineTo(lx - 4, b.y - 10);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = '#451a03';
            ctx.lineWidth = 1;
            ctx.strokeRect(lx - 4, b.y - 10, logWidth, 22);
          }

          ctx.fillStyle = '#713f12';
          ctx.fillRect(b.x - 15, b.y - 6, 30, 4);
          ctx.fillRect(b.x - 15, b.y + 4, 30, 4);

          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(b.x - 9, b.y - 5, 2, 2);
          ctx.fillRect(b.x, b.y - 5, 2, 2);
          ctx.fillRect(b.x + 9, b.y - 5, 2, 2);
        } else if (b.type === 'wall') {
          ctx.fillStyle = '#334155';
          ctx.fillRect(b.x - 16, b.y - 16, 32, 32);
          ctx.fillStyle = '#64748b';
          ctx.fillRect(b.x - 14, b.y - 14, 28, 28);
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 2;
          ctx.strokeRect(b.x - 16, b.y - 16, 32, 32);
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(b.x - 12, b.y - 14, 8, 5);
          ctx.fillRect(b.x + 4, b.y - 14, 8, 5);
        } else if (b.type === 'arrow_tower') {
          ctx.fillStyle = '#475569';
          ctx.fillRect(b.x - 18, b.y - 18, 36, 36);
          ctx.fillStyle = '#b45309';
          ctx.beginPath();
          ctx.moveTo(b.x, b.y - 28);
          ctx.lineTo(b.x + 18, b.y - 12);
          ctx.lineTo(b.x - 18, b.y - 12);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#10b981';
          ctx.fillRect(b.x, b.y - 36, 12, 8);
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(b.x, b.y - 36);
          ctx.lineTo(b.x, b.y - 28);
          ctx.stroke();
        } else if (b.type === 'cannon_tower') {
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.arc(b.x, b.y, 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.arc(b.x, b.y, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(b.x - 4, b.y - 24, 8, 16);
        }
        ctx.restore();

        if (b.hp < b.maxHp) {
          const bw = 32;
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(b.x - bw / 2, b.y - 24, bw, 4);
          ctx.fillStyle = '#34d399';
          ctx.fillRect(b.x - bw / 2, b.y - 24, (b.hp / b.maxHp) * bw, 4);
        }
      }

      // 5-2. Draw Monsters: Tiny Swords 정품 애니메이션 스프라이트 (redPawnRun & redPawnAxe)
      for (const m of monstersRef.current) {
        ctx.save();

        const isBoss = m.type === 'boss';
        const isAttacking = now - m.lastAttackTime < 450;
        const enemySprite = isAttacking ? assets.redPawnAxe : assets.redPawnRun;
        const animFrame = Math.floor((now / 130) % 6);
        const spriteSize = 192;
        const scale = isBoss ? 1.6 : 0.95;

        // Facing direction towards Capital (256, 256)
        const faceDir = 256 < m.x ? -1 : 1;

        ctx.translate(m.x, m.y);
        ctx.scale(faceDir * scale, scale);

        // A. 몬스터 오라 및 발밑 이펙트
        if (isBoss) {
          // 거대한 보스 붉은 악마 마법진
          ctx.save();
          ctx.fillStyle = 'rgba(220, 38, 38, 0.45)';
          ctx.beginPath();
          ctx.arc(0, 15, 38, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (m.type === 'skeleton') {
          ctx.filter = 'grayscale(90%) brightness(130%)';
        } else {
          // 좀비 독기
          ctx.filter = 'hue-rotate(60deg) saturate(140%)';
        }

        // B. Tiny Swords 프레임 애니메이션 그리기
        if (enemySprite && enemySprite.complete) {
          ctx.drawImage(
            enemySprite,
            animFrame * spriteSize, 0, spriteSize, spriteSize,
            -48, -60, 96, 96
          );
        }

        ctx.restore();

        // C. 보스 뿔 & 체력 바 표시
        const mw = isBoss ? 64 : 32;
        const mh = isBoss ? 6 : 4;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(m.x - mw / 2, m.y - (isBoss ? 45 : 26), mw, mh);
        ctx.fillStyle = isBoss ? '#dc2626' : '#f43f5e';
        ctx.fillRect(m.x - mw / 2, m.y - (isBoss ? 45 : 26), (m.hp / m.maxHp) * mw, mh);

        if (isBoss) {
          ctx.fillStyle = '#fbbf24';
          ctx.font = 'black 11px Pretendard, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('👑 BOSS', m.x, m.y - 52);
        }
      }

      // 5-3. Draw Projectiles (화살, 뼈다귀, 포탄)
      for (const p of projectilesRef.current) {
        ctx.save();
        if (p.type === 'arrow') {
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === 'bone') {
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(p.x - 4, p.y - 2, 8, 4);
        } else if (p.type === 'cannonball') {
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 5-4. Draw Ghost Build Preview if selected
      if (selectedBuildingRef.current) {
        const bDef = BUILDING_DEFS[selectedBuildingRef.current];
        const forwardX = localPlayerRef.current.direction === 'left' ? -56 : 56;
        const ghostX = Math.round((localPlayerRef.current.x + forwardX) / 32) * 32;
        const ghostY = Math.round(localPlayerRef.current.y / 32) * 32;

        ctx.save();
        ctx.globalAlpha = 0.65;
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.strokeRect(ghostX - 16, ghostY - 16, 32, 32);

        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 11px Pretendard, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`[ ${bDef.name} ]`, ghostX, ghostY - 22);
        ctx.restore();
      }

      // 6. Draw Remote Players
      remotePlayersRef.current.forEach((remote) => {
        drawCharacter(ctx, assets, remote, now);
      });

      // 7. Draw Local Player
      drawCharacter(ctx, assets, localPlayerRef.current, now, true);

      // 8. Draw Particles
      particlesRef.current.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;

        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });
      particlesRef.current = particlesRef.current.filter((p) => p.life < p.maxLife);

      // 9. Draw Floating Texts
      floatingTextsRef.current.forEach((txt) => {
        txt.y += txt.vy;
        txt.alpha -= 0.015;

        ctx.save();
        ctx.font = 'bold 16px Pretendard, sans-serif';
        ctx.fillStyle = txt.color;
        ctx.globalAlpha = Math.max(0, txt.alpha);
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(txt.text, txt.x, txt.y);
        ctx.fillText(txt.text, txt.x, txt.y);
        ctx.restore();
      });
      floatingTextsRef.current = floatingTextsRef.current.filter((txt) => txt.alpha > 0);

      ctx.restore();

      // 10. Draw Minimap (Screen-Space: on Desktop only to prevent obscuring mobile view)
      const isMobile = canvas.width < 768;
      if (!isMobile) {
        const minimapSize = 108;
        const margin = 16;
        const mmX = canvas.width - minimapSize - margin;
        const mmY = 56;

        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(mmX, mmY, minimapSize, minimapSize, 12);
        ctx.fill();
        ctx.stroke();

        const unlockedTotal = islandsRef.current.filter((isl) => isl.unlocked).length;
        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 10px Pretendard, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`🗺️ 지도 (${unlockedTotal}/${islandsRef.current.length})`, mmX + 8, mmY + 14);

        const mmCenterX = mmX + minimapSize / 2;
        const mmCenterY = mmY + minimapSize / 2 + 6;
        const mmStep = 18;
        const islandBoxSize = 12;

        for (const isl of islandsRef.current) {
          const ix = mmCenterX + isl.gridX * mmStep;
          const iy = mmCenterY + isl.gridY * mmStep;

          if (isl.unlocked) {
            ctx.fillStyle = isl.id === 0 ? '#38bdf8' : '#22c55e';
            ctx.beginPath();
            ctx.roundRect(ix - islandBoxSize / 2, iy - islandBoxSize / 2, islandBoxSize, islandBoxSize, 3);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();
          } else {
            ctx.fillStyle = 'rgba(51, 65, 85, 0.7)';
            ctx.beginPath();
            ctx.roundRect(ix - islandBoxSize / 2, iy - islandBoxSize / 2, islandBoxSize, islandBoxSize, 3);
            ctx.fill();
          }
        }

        const pNormX = mmCenterX + ((player.x - 256) / (ISLAND_PX + ISLAND_GAP)) * mmStep;
        const pNormY = mmCenterY + ((player.y - 256) / (ISLAND_PX + ISLAND_GAP)) * mmStep;
        ctx.fillStyle = '#00e5ff';
        ctx.beginPath();
        ctx.arc(pNormX, pNormY, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);

      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);

      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [assetsLoaded]);

  // Character drawing helper
  const drawCharacter = (
    ctx: CanvasRenderingContext2D,
    assets: GameAssets,
    p: Player,
    now: number,
    isLocal: boolean = false
  ) => {
    const isBlue = p.color === 'blue';
    let img = isBlue ? assets.bluePawnIdle : assets.redPawnIdle;
    let totalFrames = 8;
    let frameSpeed = 130;

    if (p.action === 'run') {
      img = isBlue ? assets.bluePawnRun : assets.redPawnRun;
      totalFrames = 6;
      frameSpeed = 100;
    } else if (p.action === 'axe') {
      img = isBlue ? assets.bluePawnAxe : assets.redPawnAxe;
      totalFrames = 6;
      frameSpeed = 50;
    } else if (p.action === 'pickaxe') {
      img = isBlue ? assets.bluePawnPickaxe : assets.redPawnPickaxe;
      totalFrames = 6;
      frameSpeed = 50;
    }

    const frame = Math.floor((now / frameSpeed) % totalFrames);
    const frameW = 192;
    const frameH = 192;
    const destW = 128;
    const destH = 128;

    ctx.save();
    ctx.translate(p.x, p.y);

    if (p.direction === 'left') {
      ctx.scale(-1, 1);
    }

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 16, 24, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sprite drawing
    ctx.drawImage(
      img,
      frame * frameW, 0, frameW, frameH,
      -destW / 2, -destH / 2 - 12, destW, destH
    );

    ctx.restore();

    // Name tag & Status above head
    ctx.save();
    ctx.font = 'bold 13px Pretendard, sans-serif';
    ctx.textAlign = 'center';

    const tagY = p.y - 65;
    ctx.fillStyle = isLocal ? '#4fc3f7' : '#ffb74d';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeText(p.name, p.x, tagY);
    ctx.fillText(p.name, p.x, tagY);

    if (isLocal) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px Pretendard, sans-serif';
      ctx.fillText('(나)', p.x, tagY - 14);
    }
    ctx.restore();
  };

  // Pointer interactions (mouse click or touch)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Check if clicked inside minimap (in top-right corner)
    const isMobile = canvas.width < 768;
    const minimapSize = isMobile ? 84 : 108;
    const margin = isMobile ? 12 : 16;
    const mmX = canvas.width - minimapSize - margin;
    const mmY = isMobile ? 54 : 66;

    if (screenX >= mmX && screenX <= mmX + minimapSize && screenY >= mmY && screenY <= mmY + minimapSize) {
      sound.playClick();
      onOpenMinimap?.();
      return;
    }

    if (isMobile) {
      // Ignore clicks in mobile joystick zone (bottom-left) and action button zone (bottom-right)
      if (screenX <= 140 && screenY >= canvas.height - 140) return;
      if (screenX >= canvas.width - 140 && screenY >= canvas.height - 140) return;
    }

    if (isPinchingRef.current || Date.now() - lastPinchEndTimeRef.current < 250) {
      return;
    }

    // World coordinate at time of click (adjusted for zoom scale & camera position)
    const currentZoom = zoomRef.current;
    const worldClickX = cameraRef.current.x + (screenX - canvas.width / 2) / currentZoom;
    const worldClickY = cameraRef.current.y + (screenY - canvas.height / 2) / currentZoom;

    const player = localPlayerRef.current;
    const distToPlayer = Math.hypot(worldClickX - player.x, worldClickY - player.y);

    // If click is near the player (within 65px): just interact/swing, do NOT move
    if (distToPlayer < 65) {
      mouseTargetRef.current.active = false;
    } else {
      mouseTargetRef.current = {
        worldX: worldClickX,
        worldY: worldClickY,
        active: true,
      };
    }

    tryInteract();
  };

  return (
    <div className="relative w-full h-full overflow-hidden">
      {!assetsLoaded && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#101820] text-white">
          <div className="text-3xl font-bold mb-4 tracking-wider text-amber-400">
            ⚔️ Tiny Isles 로딩 중...
          </div>
          <div className="w-64 h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-600">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-green-500 transition-all duration-200"
              style={{ width: `${Math.round(loadProgress * 100)}%` }}
            />
          </div>
          <div className="mt-2 text-sm text-gray-400">
            스프라이트 에셋 및 맵 로딩 {Math.round(loadProgress * 100)}%
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        className="w-full h-full block cursor-crosshair touch-none"
      />
    </div>
  );
};
