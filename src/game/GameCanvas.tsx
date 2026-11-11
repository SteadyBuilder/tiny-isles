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
} from './constants';
import { Entity, FloatingText, Inventory, Island, Particle, Player, PlayerAction, PlayerColor } from '../types/game';
import { sound } from '../lib/sound';
import { supabase } from '../lib/supabase';
import { storage } from '../lib/storage';

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
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastNearIslandRef = useRef<Island | null>(null);
  const lastGridPosRef = useRef<{ gridX: number; gridY: number }>({ gridX: 0, gridY: 0 });

  // Camera Zoom State
  const targetZoomRef = useRef<number>(zoom);
  const zoomRef = useRef<number>(zoom);
  const isPinchingRef = useRef<boolean>(false);
  const lastPinchEndTimeRef = useRef<number>(0);

  // Loading state
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  // Local Player State
  const localPlayerRef = useRef<Player>({
    id: 'p_' + Math.random().toString(36).substring(2, 9),
    name: playerName,
    x: 256,
    y: 256,
    direction: 'right',
    action: 'idle',
    color: playerColor,
    lastUpdated: Date.now(),
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
  const unlockIslandLocally = (islandId: number, unlockedBy: string, isLocalTrigger: boolean) => {
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

    if (isLocalTrigger) {
      if (localBusRef.current) {
        localBusRef.current.postMessage({
          type: 'island_unlocked',
          senderId: localPlayerRef.current.id,
          payload: { islandId, unlockedBy },
        });
      }
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'island_unlocked',
          payload: { islandId, unlockedBy },
        });
      }
    }
  };

  // Perform Local Hit on Nearest Entity / Island Purchase
  const tryInteract = useCallback(() => {
    lastInteractTimeRef.current = Date.now();
    const player = localPlayerRef.current;
    const px = player.x;
    const py = player.y;

    // 1. Check if near any locked island signpost
    for (const island of islandsRef.current) {
      if (!island.unlocked) {
        const origin = getIslandOrigin(island.gridX, island.gridY);
        const signX = origin.x + 256;
        const signY = origin.y + 256;
        const dist = Math.hypot(px - signX, py - signY);

        if (dist < 180) {
          // Check costs
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
            // Not enough resources notice
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

    // 2. Find nearest interactable entity within range
    let nearestEntity: Entity | null = null;
    let minDist = 90;

    for (const ent of entitiesRef.current) {
      const dist = Math.hypot(px - (ent.x + 16), py - (ent.y + 16));
      if (dist < minDist) {
        minDist = dist;
        nearestEntity = ent;
      }
    }

    // Set Tool action
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

      // Local particles & sound
      createHitParticles(nearestEntity.x, nearestEntity.y, nearestEntity.type);
      if (nearestEntity.type === 'tree') {
        sound.playChop();
      } else {
        sound.playMine();
      }

      // Add resource to inventory
      const resType = nearestEntity.type === 'tree' ? 'wood' : nearestEntity.type === 'gold_rock' ? 'gold' : 'stone';
      onUpdateInventory((prev) => ({
        ...prev,
        [resType]: prev[resType] + 1,
      }));

      // Floating text
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

      // Broadcast hit to other online players
      if (localBusRef.current) {
        localBusRef.current.postMessage({
          type: 'hit',
          senderId: player.id,
          payload: {
            entityId: nearestEntity.id,
            damage,
            hitBy: player.name,
          },
        });
      }
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'entity_hit',
          payload: {
            entityId: nearestEntity.id,
            damage,
            hitBy: player.name,
          },
        });
      }

      // Check destruction
      if (nearestEntity.hp <= 0) {
        sound.playBreak();
        removeAndRespawnEntity(nearestEntity);
      }
    } else {
      // Swung tool in empty air
    }
  }, [inventory, onUpdateInventory]);

  // Keyboard & Action Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      keysRef.current[e.key.toLowerCase()] = true;
      if (e.key === ' ' || e.key.toLowerCase() === 'e') {
        e.preventDefault();
        if (!e.repeat) {
          tryInteract();
        }
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
      tryInteract();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('player-action', handlePlayerAction);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('player-action', handlePlayerAction);
    };
  }, [tryInteract]);

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
      const speed = 4.2;

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

      // 2. Camera follow (smooth lerp)
      cameraRef.current.x += (player.x - cameraRef.current.x) * 0.1;
      cameraRef.current.y += (player.y - cameraRef.current.y) * 0.1;

      // 2-1. Smooth Zoom lerp
      zoomRef.current += (targetZoomRef.current - zoomRef.current) * 0.18;

      const camX = Math.round(cameraRef.current.x);
      const camY = Math.round(cameraRef.current.y);

      // Clear & Draw Deep Ocean Background
      ctx.fillStyle = '#1e3d59';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(zoomRef.current, zoomRef.current);
      ctx.translate(-camX, -camY);

      // 3. Draw Water Grid Foam effect
      const now = Date.now();
      const foamFrame = Math.floor((now / 150) % 16);
      const foamW = 192;

      // 4. Draw Islands & Bridges
      for (const island of islandsRef.current) {
        const origin = getIslandOrigin(island.gridX, island.gridY);

        if (island.unlocked) {
          // Draw Island Ground Tiles
          for (let tx = 0; tx < ISLAND_TILES; tx++) {
            for (let ty = 0; ty < ISLAND_TILES; ty++) {
              const tileX = origin.x + tx * TILE_SIZE;
              const tileY = origin.y + ty * TILE_SIZE;

              // Center grass from tilemap (64x64 at srcX: 64, srcY: 64)
              ctx.drawImage(
                assets.tilemap,
                64, 64, 64, 64,
                tileX, tileY, TILE_SIZE, TILE_SIZE
              );
            }
          }

          // Draw coastal water foam around unlocked island edges
          if (assets.waterFoam && assets.waterFoam.complete) {
            ctx.drawImage(
              assets.waterFoam,
              foamFrame * foamW, 0, foamW, 192,
              origin.x - 40, origin.y - 40, 592, 120
            );
          }

          // Draw Connecting Bridges to adjacent unlocked islands
          const rightNeighbor = islandsRef.current.find(
            (other) => other.unlocked && other.gridX === island.gridX + 1 && other.gridY === island.gridY
          );
          if (rightNeighbor) {
            // Draw wooden bridge connecting right
            ctx.fillStyle = '#8d6e63';
            ctx.fillRect(origin.x + ISLAND_PX, origin.y + 192, ISLAND_GAP, 128);
            // Bridge planks
            ctx.strokeStyle = '#5d4037';
            ctx.lineWidth = 3;
            for (let bx = origin.x + ISLAND_PX + 16; bx < origin.x + ISLAND_PX + ISLAND_GAP; bx += 20) {
              ctx.beginPath();
              ctx.moveTo(bx, origin.y + 192);
              ctx.lineTo(bx, origin.y + 320);
              ctx.stroke();
            }
          }

          const bottomNeighbor = islandsRef.current.find(
            (other) => other.unlocked && other.gridX === island.gridX && other.gridY === island.gridY + 1
          );
          if (bottomNeighbor) {
            // Draw wooden bridge connecting down
            ctx.fillStyle = '#8d6e63';
            ctx.fillRect(origin.x + 192, origin.y + ISLAND_PX, 128, ISLAND_GAP);
            ctx.strokeStyle = '#5d4037';
            ctx.lineWidth = 3;
            for (let by = origin.y + ISLAND_PX + 16; by < origin.y + ISLAND_PX + ISLAND_GAP; by += 20) {
              ctx.beginPath();
              ctx.moveTo(origin.x + 192, by);
              ctx.lineTo(origin.x + 320, by);
              ctx.stroke();
            }
          }
        } else {
          // Locked Island: Semi-transparent mysterious preview
          ctx.save();
          ctx.globalAlpha = 0.35;
          ctx.strokeStyle = '#64b5f6';
          ctx.lineWidth = 4;
          ctx.setLineDash([12, 10]);
          ctx.strokeRect(origin.x, origin.y, ISLAND_PX, ISLAND_PX);
          ctx.fillStyle = '#172a3a';
          ctx.fillRect(origin.x, origin.y, ISLAND_PX, ISLAND_PX);
          ctx.restore();

          // Signpost & Cost Badge
          const signX = origin.x + 256;
          const signY = origin.y + 256;
          const canAfford =
            inventory.wood >= island.costWood &&
            inventory.stone >= island.costStone &&
            inventory.gold >= island.costGold;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
          ctx.beginPath();
          ctx.roundRect(signX - 115, signY - 48, 230, 96, 12);
          ctx.fill();
          ctx.strokeStyle = canAfford ? '#4ade80' : '#ffd700';
          ctx.lineWidth = canAfford ? 3 : 2;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 15px Pretendard, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(island.name, signX, signY - 20);

          ctx.font = 'bold 13px Pretendard, sans-serif';
          ctx.fillStyle = canAfford ? '#86efac' : '#ffd54f';
          const costStr = `필요: 🪵${island.costWood}  🪨${island.costStone}${island.costGold > 0 ? `  🪙${island.costGold}` : ''}`;
          ctx.fillText(costStr, signX, signY + 8);

          ctx.font = 'bold 12px Pretendard, sans-serif';
          const isMobile = canvas.width < 768;
          if (canAfford) {
            ctx.fillStyle = '#4ade80';
            ctx.fillText(isMobile ? '✨ 해금 가능! [개척 버튼 터치]' : '✨ 해금 가능! [E 키 / 클릭]', signX, signY + 32);
          } else {
            ctx.fillStyle = '#f87171';
            ctx.fillText('자원 부족 [가까이 가서 확인]', signX, signY + 32);
          }
        }
      }

      // 5. Draw Entities (Trees, Rocks, Gold Rocks)
      const sortedEntities = [...entitiesRef.current].sort((a, b) => a.y - b.y);

      for (const ent of sortedEntities) {
        let shakeOffset = 0;
        if (ent.shakeTime && ent.shakeTime > now) {
          shakeOffset = Math.sin((now / 20) * Math.PI) * 5;
        }

        const drawX = ent.x + shakeOffset;
        const drawY = ent.y;

        if (ent.type === 'tree') {
          // Tree1.png: 1536x256 (8 frames of 192x256)
          const treeFrame = Math.floor((now / 220) % 8);
          ctx.drawImage(
            assets.tree,
            treeFrame * 192, 0, 192, 256,
            drawX - 64, drawY - 160, 160, 200
          );
        } else if (ent.type === 'rock') {
          // Rock1.png: 64x64
          ctx.drawImage(assets.rock1, drawX, drawY - 16, 64, 64);
        } else if (ent.type === 'gold_rock') {
          // Gold tinted rock
          ctx.save();
          ctx.drawImage(assets.rock2, drawX, drawY - 16, 64, 64);
          // Sparkle overlay
          ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
          ctx.beginPath();
          ctx.arc(drawX + 32, drawY + 16, 24, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Draw Health Bar if damaged
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

      // 10. Draw Minimap (Screen-Space: in upper right corner, compact size)
      const isMobile = canvas.width < 768;
      const minimapSize = isMobile ? 84 : 108;
      const margin = isMobile ? 12 : 16;
      const mmX = canvas.width - minimapSize - margin;
      const mmY = isMobile ? 54 : 66;

      // Minimap background box
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(mmX, mmY, minimapSize, minimapSize, isMobile ? 10 : 12);
      ctx.fill();
      ctx.stroke();

      // Minimap Header / Title
      const unlockedTotal = islandsRef.current.filter((isl) => isl.unlocked).length;
      ctx.fillStyle = '#cbd5e1';
      ctx.font = isMobile ? 'bold 9px Pretendard, sans-serif' : 'bold 10px Pretendard, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(
        isMobile ? `🗺️ ${unlockedTotal}/${islandsRef.current.length}` : `🗺️ 지도 (${unlockedTotal}/${islandsRef.current.length})`,
        mmX + (isMobile ? 6 : 8),
        mmY + (isMobile ? 12 : 14)
      );

      // Grid center inside minimap (5x5 grid: -2 to 2)
      const mmCenterX = mmX + minimapSize / 2;
      const mmCenterY = mmY + minimapSize / 2 + (isMobile ? 5 : 6);
      const mmStep = isMobile ? 14 : 18;
      const islandBoxSize = isMobile ? 9 : 12;

      // Draw connecting bridges between adjacent unlocked islands
      ctx.strokeStyle = '#8d6e63';
      ctx.lineWidth = isMobile ? 2 : 2.5;
      for (const isl of islandsRef.current) {
        if (!isl.unlocked) continue;
        const ix = mmCenterX + isl.gridX * mmStep;
        const iy = mmCenterY + isl.gridY * mmStep;

        const right = islandsRef.current.find(
          (o) => o.unlocked && o.gridX === isl.gridX + 1 && o.gridY === isl.gridY
        );
        if (right) {
          ctx.beginPath();
          ctx.moveTo(ix, iy);
          ctx.lineTo(ix + mmStep, iy);
          ctx.stroke();
        }

        const bottom = islandsRef.current.find(
          (o) => o.unlocked && o.gridX === isl.gridX && o.gridY === isl.gridY + 1
        );
        if (bottom) {
          ctx.beginPath();
          ctx.moveTo(ix, iy);
          ctx.lineTo(ix, iy + mmStep);
          ctx.stroke();
        }
      }

      // Draw island nodes
      for (const isl of islandsRef.current) {
        const ix = mmCenterX + isl.gridX * mmStep;
        const iy = mmCenterY + isl.gridY * mmStep;

        if (isl.unlocked) {
          ctx.fillStyle = isl.id === 0 ? '#38bdf8' : '#22c55e';
          ctx.beginPath();
          ctx.roundRect(ix - islandBoxSize / 2, iy - islandBoxSize / 2, islandBoxSize, islandBoxSize, isMobile ? 2.5 : 3);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          const canAfford =
            inventory.wood >= isl.costWood &&
            inventory.stone >= isl.costStone &&
            inventory.gold >= isl.costGold;

          ctx.fillStyle = canAfford ? 'rgba(234, 179, 8, 0.4)' : 'rgba(51, 65, 85, 0.7)';
          ctx.beginPath();
          ctx.roundRect(ix - islandBoxSize / 2, iy - islandBoxSize / 2, islandBoxSize, islandBoxSize, isMobile ? 2.5 : 3);
          ctx.fill();
          ctx.strokeStyle = canAfford ? '#fbbf24' : 'rgba(100, 116, 139, 0.6)';
          ctx.lineWidth = canAfford ? 1.2 : 0.8;
          ctx.stroke();
        }
      }

      // Draw remote players on minimap
      remotePlayersRef.current.forEach((rp) => {
        const rNormX = mmCenterX + ((rp.x - 256) / (ISLAND_PX + ISLAND_GAP)) * mmStep;
        const rNormY = mmCenterY + ((rp.y - 256) / (ISLAND_PX + ISLAND_GAP)) * mmStep;
        ctx.fillStyle = rp.color === 'blue' ? '#60a5fa' : '#f87171';
        ctx.beginPath();
        ctx.arc(rNormX, rNormY, isMobile ? 2 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw local player marker on minimap (pulsing ring)
      const pNormX = mmCenterX + ((player.x - 256) / (ISLAND_PX + ISLAND_GAP)) * mmStep;
      const pNormY = mmCenterY + ((player.y - 256) / (ISLAND_PX + ISLAND_GAP)) * mmStep;
      const pulseSize = (isMobile ? 2.5 : 3.5) + Math.sin(now / 180) * 1;

      ctx.fillStyle = player.color === 'blue' ? '#00e5ff' : '#ff1744';
      ctx.beginPath();
      ctx.arc(pNormX, pNormY, pulseSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.restore();

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
