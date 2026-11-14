import React, { useEffect, useRef, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { GameAssets, loadGameAssets } from './AssetLoader';
import {
  TERRITORY_PX,
  TERRITORY_GAP,
  TERRITORY_STEP,
  INITIAL_ISLANDS,
  CENTRAL_CORE,
  generateTerritoryBuildings,
  getIslandOrigin,
  getBuildingCollisionBox,
} from './constants';
import { GOLD_MINE_BIOME_CONFIG, RESOURCE_DISTRIBUTION_CONFIG } from '../data/biomes';
import { WORLD_BOUNDS } from './worldBounds';
import { drawGoldMineZoneOverlay2D, drawVisibleTerrain2D } from './world/Canvas2DTerrainPainter';
import {
  generateWorldTerrain,
  isWaterAtWorld,
  WorldTerrainMap,
} from './world/MapTerrainGenerator';
import {
  generateGoldMineClusterEntities,
  generateWorldResourceEntities,
  pickRespawnSpot,
} from './world/ResourceDistributionSystem';
import {
  Building,
  Entity,
  FloatingText,
  Inventory,
  Island,
  Particle,
  Player,
  PlayerAction,
  PlayerColor,
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
  onGameAlert?: (msg: string) => void;
}

interface Cloud {
  x: number;
  y: number;
  speed: number;
  scale: number;
  type: 1 | 2;
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
  onGameAlert,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastNearIslandRef = useRef<Island | null>(null);
  const lastGridPosRef = useRef<{ gridX: number; gridY: number }>({ gridX: 0, gridY: 0 });

  // Up-to-date refs for callbacks
  const inventoryRef = useRef<Inventory>(inventory);
  inventoryRef.current = inventory;

  const onUpdateInventoryRef = useRef(onUpdateInventory);
  onUpdateInventoryRef.current = onUpdateInventory;

  const onNearIslandChangeRef = useRef(onNearIslandChange);
  onNearIslandChangeRef.current = onNearIslandChange;

  const onPlayerPositionChangeRef = useRef(onPlayerPositionChange);
  onPlayerPositionChangeRef.current = onPlayerPositionChange;

  const onUnlockedIslandIdsChangeRef = useRef(onUnlockedIslandIdsChange);
  onUnlockedIslandIdsChangeRef.current = onUnlockedIslandIdsChange;

  const onUnlockedCountChangeRef = useRef(onUnlockedCountChange);
  onUnlockedCountChangeRef.current = onUnlockedCountChange;

  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;

  const onGameAlertRef = useRef(onGameAlert);
  onGameAlertRef.current = onGameAlert;

  const isSubscribedRef = useRef<boolean>(false);
  const targetZoomRef = useRef<number>(zoom);
  const zoomRef = useRef<number>(zoom);
  const isPinchingRef = useRef<boolean>(false);
  const lastPinchEndTimeRef = useRef<number>(0);

  // Sync zoom prop changes into targetZoomRef
  useEffect(() => {
    targetZoomRef.current = zoom;
  }, [zoom]);

  // Loading state
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  // Local Player State (Spawns in Central Town Square)
  const localPlayerRef = useRef<Player>({
    id: storage.getPlayerId(),
    name: playerName,
    x: 320,
    y: 420,
    direction: 'right',
    action: 'idle',
    color: playerColor,
    lastUpdated: Date.now(),
  });

  // Remote Players State
  const remotePlayersRef = useRef<Map<string, Player>>(new Map());

  // Territories, Terrain, Buildings, Entities State
  const terrainMapRef = useRef<WorldTerrainMap>(generateWorldTerrain(WORLD_BOUNDS, INITIAL_ISLANDS));

  const islandsRef = useRef<Island[]>(
    (() => {
      const savedUnlocked = storage.loadUnlockedIslands();
      return INITIAL_ISLANDS.map((island) => ({
        ...island,
        unlocked: savedUnlocked.includes(island.id) || island.id === 0,
      }));
    })()
  );

  const buildingsRef = useRef<Building[]>(
    (() => {
      const savedUnlocked = storage.loadUnlockedIslands();
      const allBuildings: Building[] = [];
      for (const isl of INITIAL_ISLANDS) {
        if (savedUnlocked.includes(isl.id) || isl.id === 0) {
          allBuildings.push(...generateTerritoryBuildings(isl.id, isl.gridX, isl.gridY));
        }
      }
      return allBuildings;
    })()
  );

  const entitiesRef = useRef<Entity[]>(
    generateWorldResourceEntities(
      terrainMapRef.current,
      INITIAL_ISLANDS,
      WORLD_BOUNDS,
      buildingsRef.current,
      storage.loadUnlockedIslands().includes(GOLD_MINE_BIOME_CONFIG.unlockTerritoryId)
    )
  );

  // Core Resonance timestamp
  const lastCoreResonanceRef = useRef<number>(0);

  // Ambient Drifting Clouds
  const cloudsRef = useRef<Cloud[]>([
    { x: -400, y: -200, speed: 0.35, scale: 0.9, type: 1 },
    { x: 150, y: 100, speed: 0.42, scale: 1.1, type: 2 },
    { x: 800, y: -80, speed: 0.3, scale: 0.85, type: 1 },
    { x: -100, y: 650, speed: 0.38, scale: 1.0, type: 2 },
    { x: 600, y: 800, speed: 0.28, scale: 0.95, type: 1 },
    { x: -700, y: 350, speed: 0.34, scale: 1.05, type: 2 },
  ]);

  // Visual Effects
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);

  // Input State
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const mouseTargetRef = useRef<{ worldX: number; worldY: number; active: boolean }>({
    worldX: 0,
    worldY: 0,
    active: false,
  });

  // Camera
  const cameraRef = useRef({ x: 320, y: 420 });

  // Action cooldown timer
  const actionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInteractTimeRef = useRef<number>(0);

  // Broadcast Channels
  const localBusRef = useRef<BroadcastChannel | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const assetsRef = useRef<GameAssets | null>(null);

  // Update profile
  useEffect(() => {
    localPlayerRef.current.name = playerName;
    localPlayerRef.current.color = playerColor;
  }, [playerName, playerColor]);

  // Load Assets
  useEffect(() => {
    loadGameAssets((ratio) => {
      setLoadProgress(ratio);
    }).then((assets) => {
      assetsRef.current = assets;
      setAssetsLoaded(true);
    });
  }, []);

  // Fetch Unlocked Territories from Server DB
  useEffect(() => {
    let isMounted = true;
    serverSync.fetchUnlockedIslands().then((records) => {
      if (!isMounted || !records || records.length === 0) return;
      let hasNewUnlocks = false;
      for (const rec of records) {
        const isl = islandsRef.current.find((i) => i.id === rec.island_id);
        if (isl && !isl.unlocked) {
          isl.unlocked = true;
          const newBuildings = generateTerritoryBuildings(isl.id, isl.gridX, isl.gridY);
          buildingsRef.current.push(...newBuildings);
          hasNewUnlocks = true;
        }
      }
      if (hasNewUnlocks) {
        const goldMineUnlocked = islandsRef.current.some(
          (isl) => isl.id === GOLD_MINE_BIOME_CONFIG.unlockTerritoryId && isl.unlocked
        );
        if (goldMineUnlocked && !entitiesRef.current.some((e) => e.zoneTag === 'gold_mine')) {
          const mineNodes = generateGoldMineClusterEntities(
            terrainMapRef.current,
            islandsRef.current,
            WORLD_BOUNDS,
            entitiesRef.current
          );
          entitiesRef.current.push(...mineNodes);
        }
        const currentUnlockedIds = islandsRef.current.filter((isl) => isl.unlocked).map((isl) => isl.id);
        storage.saveUnlockedIslands(currentUnlockedIds);
        onUnlockedIslandIdsChangeRef.current?.(currentUnlockedIds);
        onUnlockedCountChangeRef.current?.(currentUnlockedIds.length, islandsRef.current.length);
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
  }, [onUnlockedIslandIdsChange, onUnlockedCountChange]);

  // Remote player movement handler
  const handleRemotePlayerMove = useCallback((playerData: Player) => {
    if (playerData.id === localPlayerRef.current.id) return;
    const remote = remotePlayersRef.current.get(playerData.id);
    if (remote) {
      remote.x = playerData.x;
      remote.y = playerData.y;
      remote.direction = playerData.direction;
      remote.action = playerData.action;
      remote.color = playerData.color;
      remote.name = playerData.name;
      remote.lastUpdated = Date.now();
    } else {
      remotePlayersRef.current.set(playerData.id, {
        ...playerData,
        lastUpdated: Date.now(),
      });
    }
  }, []);

  // Multiplayer setup (BroadcastChannel & Supabase Realtime)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bus = new BroadcastChannel('tiny_isles_multiplayer');
      localBusRef.current = bus;
      bus.onmessage = (event) => {
        const { data } = event;
        if (!data || data.senderId === localPlayerRef.current.id) return;
        if (data.type === 'player_move') {
          handleRemotePlayerMove(data.payload);
        } else if (data.type === 'hit') {
          const { entityId, damage, hitBy } = data.payload;
          handleRemoteHit(entityId, damage, hitBy);
        } else if (data.type === 'island_unlocked') {
          const { islandId, unlockedBy } = data.payload;
          unlockIslandLocally(islandId, unlockedBy, false);
        }
      };
    }

    const roomId = 'tiny_isles_global_hub';
    const channel = supabase.channel(roomId, {
      config: {
        broadcast: { self: false },
        presence: { key: localPlayerRef.current.id },
      },
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const onlineIds = Object.keys(presenceState);
        const count = Math.max(1, onlineIds.length);
        setOnlineCount(count);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        if (key !== localPlayerRef.current.id && !remotePlayersRef.current.has(key)) {
          remotePlayersRef.current.set(key, {
            id: key,
            name: '탐험가',
            x: 320,
            y: 420,
            direction: 'right',
            action: 'idle',
            color: 'blue',
            lastUpdated: Date.now(),
          });
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        remotePlayersRef.current.delete(key);
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
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          isSubscribedRef.current = true;
          await channel.track({
            name: localPlayerRef.current.name,
            color: localPlayerRef.current.color,
            joinedAt: Date.now(),
          });
        }
      });

    return () => {
      if (localBusRef.current) {
        localBusRef.current.close();
        localBusRef.current = null;
      }
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [setOnlineCount, handleRemotePlayerMove]);

  // Remote hit handler
  const handleRemoteHit = (entityId: string, damage: number, _hitByName: string) => {
    const entity = entitiesRef.current.find((e) => e.id === entityId);
    if (!entity) return;

    entity.hp -= damage;
    entity.shakeTime = Date.now() + 200;

    createHitParticles(entity.x, entity.y, entity.type);
    if (entity.type === 'tree') sound.playChop();
    else sound.playMine();

    if (entity.hp <= 0) {
      sound.playBreak();
      removeAndRespawnEntity(entity);
    }
  };

  // Particles generator
  const createHitParticles = (x: number, y: number, type: string) => {
    const color =
      type === 'tree'
        ? '#8bc34a'
        : type === 'gold_rock'
        ? '#ffd700'
        : type === 'sheep'
        ? '#f472b6'
        : '#b0bec5';
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

  // Remove and respawn entity evenly across outdoor wilderness sectors
  const removeAndRespawnEntity = (entity: Entity) => {
    entitiesRef.current = entitiesRef.current.filter((e) => e.id !== entity.id);
    setTimeout(() => {
      const goldMineUnlocked = islandsRef.current.some(
        (i) => i.id === GOLD_MINE_BIOME_CONFIG.unlockTerritoryId && i.unlocked
      );
      const nextSpot = pickRespawnSpot(
        entity.type,
        entitiesRef.current,
        terrainMapRef.current,
        islandsRef.current,
        WORLD_BOUNDS,
        [],
        {
          goldMineUnlocked,
          zoneTag: entity.zoneTag,
        }
      );
      if (nextSpot) {
        entitiesRef.current.push({
          ...entity,
          x: nextSpot.x,
          y: nextSpot.y,
          type: nextSpot.type,
          hp: nextSpot.maxHp,
          maxHp: nextSpot.maxHp,
          islandId: -1,
          zoneTag: nextSpot.zoneTag,
          shakeTime: undefined,
        });
      }
    }, RESOURCE_DISTRIBUTION_CONFIG.respawnDelayMs);
  };

  // Unlock Territory Logic
  const unlockIslandLocally = (
    islandId: number,
    unlockedBy: string,
    isLocalTrigger: boolean,
    showEffects: boolean = true
  ) => {
    const target = islandsRef.current.find((isl) => isl.id === islandId);
    if (!target || target.unlocked) return;

    target.unlocked = true;

    // Save unlocked state to localStorage
    const currentUnlockedIds = islandsRef.current.filter((isl) => isl.unlocked).map((isl) => isl.id);
    storage.saveUnlockedIslands(currentUnlockedIds);
    if (onUnlockedCountChange) {
      onUnlockedCountChange(currentUnlockedIds.length, islandsRef.current.length);
    }
    if (onUnlockedIslandIdsChange) {
      onUnlockedIslandIdsChange(currentUnlockedIds);
    }

    // Construct village buildings for newly unlocked territory (resources spawn map-wide)
    const newBuildings = generateTerritoryBuildings(target.id, target.gridX, target.gridY);
    buildingsRef.current.push(...newBuildings);

    if (islandId === GOLD_MINE_BIOME_CONFIG.unlockTerritoryId) {
      const hasCluster = entitiesRef.current.some((e) => e.zoneTag === 'gold_mine');
      if (!hasCluster) {
        const mineNodes = generateGoldMineClusterEntities(
          terrainMapRef.current,
          islandsRef.current,
          WORLD_BOUNDS,
          entitiesRef.current
        );
        entitiesRef.current.push(...mineNodes);
      }
      const gm = GOLD_MINE_BIOME_CONFIG;
      onGameAlertRef.current?.(gm.announcementText);
      floatingTextsRef.current.push({
        id: 'gm_' + Math.random(),
        text: `⛏️ ${gm.announcementText}`,
        x: gm.centerX,
        y: gm.centerY - 40,
        color: '#fde047',
        alpha: 1,
        vy: -1.0,
      });
      if (showEffects) {
        confetti({ particleCount: 130, spread: 95, origin: { y: 0.55 } });
      }
    }

    if (showEffects) {
      sound.playUnlock();
      confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.6 },
      });

      const origin = getIslandOrigin(target.gridX, target.gridY);
      floatingTextsRef.current.push({
        id: 'unlock_' + Math.random(),
        text: `🎉 ${unlockedBy}님이 ${target.name}을 개척했습니다!`,
        x: origin.x + 320,
        y: origin.y + 240,
        color: '#ffd700',
        alpha: 1,
        vy: -1.2,
      });
    }

    if (isLocalTrigger) {
      serverSync.saveUnlockedIsland(islandId, target.name, unlockedBy);

      if (localBusRef.current) {
        localBusRef.current.postMessage({
          type: 'island_unlocked',
          senderId: localPlayerRef.current.id,
          payload: { islandId, unlockedBy },
        });
      }
      if (channelRef.current && isSubscribedRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'island_unlocked',
          payload: { islandId, unlockedBy },
        });
      }
    }
  };

  // Check collision with solid buildings, core, water, and world bounds
  const checkCollision = (nextX: number, nextY: number): boolean => {
    const footX = nextX;
    const footY = nextY + 16;

    // 1. Building solid collisions
    for (const b of buildingsRef.current) {
      const box = getBuildingCollisionBox(b);
      if (
        footX >= box.x &&
        footX <= box.x + box.w &&
        footY >= box.y &&
        footY <= box.y + box.h
      ) {
        return true;
      }
    }

    // 2. Core solid pedestal collision (Territory 0)
    const distToCore = Math.hypot(nextX - CENTRAL_CORE.x, footY - CENTRAL_CORE.y);
    if (distToCore < 26) {
      return true;
    }

    // 3. Impassable water bodies (bridges are walkable because cell.biome !== 'water')
    if (isWaterAtWorld(terrainMapRef.current, footX, footY)) {
      return true;
    }

    // 4. World bounds across expanded wilderness
    if (
      nextX < WORLD_BOUNDS.min + 24 ||
      nextX > WORLD_BOUNDS.max - 24 ||
      nextY < WORLD_BOUNDS.min + 24 ||
      nextY > WORLD_BOUNDS.max - 24
    ) {
      return true;
    }

    return false;
  };

  // Perform Local Interaction (Core resonance / Claim territory / Harvest node / Pet sheep)
  const tryInteract = useCallback(() => {
    lastInteractTimeRef.current = Date.now();
    const player = localPlayerRef.current;
    const px = player.x;
    const py = player.y;

    // 1. Check Territory Core resonance (in Territory 0)
    const distToCore = Math.hypot(px - CENTRAL_CORE.x, py - CENTRAL_CORE.y);
    if (distToCore < 90) {
      lastCoreResonanceRef.current = Date.now();
      sound.playUnlock();
      floatingTextsRef.current.push({
        id: 'core_' + Math.random(),
        text: '✨ 영지 코어 공명 완료! 왕국 번영도 상승 (+100)',
        x: CENTRAL_CORE.x,
        y: CENTRAL_CORE.y - 60,
        color: '#38bdf8',
        alpha: 1,
        vy: -1.2,
      });

      // Burst energy particles
      for (let i = 0; i < 24; i++) {
        const angle = (Math.PI * 2 * i) / 24;
        const speed = 2 + Math.random() * 3.5;
        particlesRef.current.push({
          x: CENTRAL_CORE.x,
          y: CENTRAL_CORE.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: i % 2 === 0 ? '#38bdf8' : '#fbbf24',
          size: 4 + Math.random() * 3,
          life: 1,
          maxLife: 35,
        });
      }
      return;
    }

    // 2. Check if near any locked territory expansion altar
    for (const island of islandsRef.current) {
      if (!island.unlocked) {
        const origin = getIslandOrigin(island.gridX, island.gridY);
        const signX = origin.x + 320;
        const signY = origin.y + 320;
        const dist = Math.hypot(px - signX, py - signY);

        if (dist < 260) {
          const curInv = inventoryRef.current;
          if (
            curInv.wood >= island.costWood &&
            curInv.stone >= island.costStone &&
            curInv.gold >= island.costGold
          ) {
            onUpdateInventoryRef.current((prev) => ({
              wood: prev.wood - island.costWood,
              stone: prev.stone - island.costStone,
              gold: prev.gold - island.costGold,
            }));
            unlockIslandLocally(island.id, player.name, true);
            return;
          } else {
            floatingTextsRef.current.push({
              id: 'cost_' + Math.random(),
              text: `자원이 부족합니다! (🪵${island.costWood} 🪨${island.costStone}${island.costGold > 0 ? ` 🪙${island.costGold}` : ''})`,
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

    // 3. Find nearest interactable entity within range
    let nearestEntity: Entity | null = null;
    let minDist = 90;

    for (const ent of entitiesRef.current) {
      const dist = Math.hypot(px - (ent.x + 16), py - (ent.y + 16));
      if (dist < minDist) {
        minDist = dist;
        nearestEntity = ent;
      }
    }

    if (nearestEntity) {
      // If entity is sheep: pet and bounce with heart!
      if (nearestEntity.type === 'sheep') {
        sound.playClick();
        nearestEntity.shakeTime = Date.now() + 250;
        floatingTextsRef.current.push({
          id: 'sheep_' + Math.random(),
          text: '🐑 음메에~ ❤️',
          x: nearestEntity.x + 16,
          y: nearestEntity.y - 20,
          color: '#f472b6',
          alpha: 1,
          vy: -1.0,
        });
        createHitParticles(nearestEntity.x, nearestEntity.y, 'sheep');
        return;
      }

      // Tool swing animation
      const toolAction: PlayerAction = nearestEntity.type === 'tree' ? 'axe' : 'pickaxe';
      player.action = toolAction;
      if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current);
      actionTimeoutRef.current = setTimeout(() => {
        player.action = 'idle';
      }, 280);

      const damage = 1;
      nearestEntity.hp -= damage;
      nearestEntity.shakeTime = Date.now() + 200;

      createHitParticles(nearestEntity.x, nearestEntity.y, nearestEntity.type);
      if (nearestEntity.type === 'tree') sound.playChop();
      else sound.playMine();

      const resType =
        nearestEntity.type === 'tree'
          ? 'wood'
          : nearestEntity.type === 'gold_rock'
          ? 'gold'
          : 'stone';
      onUpdateInventoryRef.current((prev) => ({
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

      // Broadcast hit
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
      if (channelRef.current && isSubscribedRef.current) {
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

      if (nearestEntity.hp <= 0) {
        sound.playBreak();
        removeAndRespawnEntity(nearestEntity);
      }
    } else {
      player.action = 'axe';
      if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current);
      actionTimeoutRef.current = setTimeout(() => {
        player.action = 'idle';
      }, 280);
    }
  }, []);

  const tryInteractRef = useRef(tryInteract);
  tryInteractRef.current = tryInteract;

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

    // Wheel Zoom handler
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

    // Touch Pinch-to-Zoom handlers
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

    // Broadcast position throttler
    let lastBroadcastTime = 0;

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

      // Mobile Virtual Joystick
      if (joystickRef?.current) {
        const jx = joystickRef.current.x;
        const jy = joystickRef.current.y;
        if (Math.abs(jx) > 0.05 || Math.abs(jy) > 0.05) {
          dx += jx;
          dy += jy;
          mouseTargetRef.current.active = false;
        }
      }

      if (dx !== 0 || dy !== 0) {
        mouseTargetRef.current.active = false;
      }

      // Mouse click movement
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
        const moveX = (dx / len) * speed * factor;
        const moveY = (dy / len) * speed * factor;

        const nextX = player.x + moveX;
        const nextY = player.y + moveY;

        // Collision check with buildings and world bounds
        if (!checkCollision(nextX, nextY)) {
          player.x = nextX;
          player.y = nextY;
        } else if (!checkCollision(nextX, player.y)) {
          player.x = nextX;
        } else if (!checkCollision(player.x, nextY)) {
          player.y = nextY;
        }

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

      // Continuous interaction when Space or E is held
      const currentNow = Date.now();
      if ((keysRef.current[' '] || keysRef.current['e']) && currentNow - lastInteractTimeRef.current >= 240) {
        lastInteractTimeRef.current = currentNow;
        tryInteractRef.current();
      }

      // Track nearest locked territory for mobile action prompt
      let nearLocked: Island | null = null;
      for (const isl of islandsRef.current) {
        if (!isl.unlocked) {
          const origin = getIslandOrigin(isl.gridX, isl.gridY);
          const signX = origin.x + 320;
          const signY = origin.y + 320;
          const dist = Math.hypot(player.x - signX, player.y - signY);
          if (dist < 260) {
            nearLocked = isl;
            break;
          }
        }
      }
      if (nearLocked?.id !== lastNearIslandRef.current?.id) {
        lastNearIslandRef.current = nearLocked;
        onNearIslandChangeRef.current?.(nearLocked);
      }

      // Track player grid coordinate for minimap
      const currentGridX = Math.round((player.x - 320) / TERRITORY_STEP);
      const currentGridY = Math.round((player.y - 320) / TERRITORY_STEP);
      if (
        currentGridX !== lastGridPosRef.current.gridX ||
        currentGridY !== lastGridPosRef.current.gridY
      ) {
        lastGridPosRef.current = { gridX: currentGridX, gridY: currentGridY };
        onPlayerPositionChangeRef.current?.({ gridX: currentGridX, gridY: currentGridY });
      }

      // Camera follow (smooth lerp)
      cameraRef.current.x += (player.x - cameraRef.current.x) * 0.1;
      cameraRef.current.y += (player.y - cameraRef.current.y) * 0.1;
      zoomRef.current += (targetZoomRef.current - zoomRef.current) * 0.18;

      const camX = Math.round(cameraRef.current.x);
      const camY = Math.round(cameraRef.current.y);

      // Throttled multiplayer broadcast
      if (currentNow - lastBroadcastTime > 60) {
        lastBroadcastTime = currentNow;
        if (localBusRef.current) {
          localBusRef.current.postMessage({
            type: 'player_move',
            senderId: player.id,
            payload: { ...player },
          });
        }
        if (channelRef.current && isSubscribedRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'player_move',
            payload: { ...player },
          });
        }
      }

      // Clear Canvas
      ctx.fillStyle = '#223824';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(zoomRef.current, zoomRef.current);
      ctx.translate(-camX, -camY);

      const now = Date.now();

      // Viewport bounds in world coordinates
      const viewHalfW = (canvas.width / 2) / zoomRef.current + 120;
      const viewHalfH = (canvas.height / 2) / zoomRef.current + 120;
      const minX = camX - viewHalfW;
      const maxX = camX + viewHalfW;
      const minY = camY - viewHalfH;
      const maxY = camY + viewHalfH;

      // 2. Draw Necesse-style Procedural Biomes, Lakes, Roads & Wooden Bridges
      drawVisibleTerrain2D(ctx, terrainMapRef.current, assets, minX, minY, maxX, maxY);
      const gmUnlocked = islandsRef.current.some(
        (i) => i.id === GOLD_MINE_BIOME_CONFIG.unlockTerritoryId && i.unlocked
      );
      drawGoldMineZoneOverlay2D(ctx, terrainMapRef.current, gmUnlocked);

      // 3. Draw Village Pathways & Territory Borders
      // Central Village (Territory 0) Plaza and Roads
      const origin0 = getIslandOrigin(0, 0);

      // Cobblestone Plaza around Core
      ctx.fillStyle = 'rgba(168, 162, 158, 0.45)';
      ctx.beginPath();
      ctx.arc(origin0.x + 320, origin0.y + 350, 64, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120, 113, 108, 0.55)';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Magic runic circle around Core
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(origin0.x + 320, origin0.y + 350, 50, now / 2500, now / 2500 + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Road connecting Castle entrance to Core Plaza
      ctx.fillStyle = 'rgba(168, 162, 158, 0.38)';
      ctx.fillRect(origin0.x + 320 - 24, origin0.y + 220, 48, 130);

      // Crossroads branching outwards
      ctx.fillRect(origin0.x, origin0.y + 350 - 20, 320, 40); // West
      ctx.fillRect(origin0.x + 320, origin0.y + 350 - 20, 320, 40); // East
      ctx.fillRect(origin0.x + 320 - 20, origin0.y + 350, 40, 290); // South
      ctx.fillRect(origin0.x + 320 - 20, origin0.y, 40, 220); // North

      // Draw road extensions connecting across village gaps
      for (const isl of islandsRef.current) {
        if (!isl.unlocked) continue;
        const origin = getIslandOrigin(isl.gridX, isl.gridY);
        ctx.fillStyle = 'rgba(168, 162, 158, 0.32)';

        ctx.fillRect(origin.x - TERRITORY_GAP / 2, origin.y + 350 - 18, TERRITORY_STEP, 36);
        ctx.fillRect(origin.x + 320 - 18, origin.y - TERRITORY_GAP / 2, 36, TERRITORY_STEP);
      }

      // 4. Draw Territory Borders & Locked Fog-of-War
      for (const island of islandsRef.current) {
        const origin = getIslandOrigin(island.gridX, island.gridY);

        if (island.unlocked) {
          // Unlocked territory: Subtle stone boundary edgings
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 2;
          ctx.strokeRect(origin.x, origin.y, TERRITORY_PX, TERRITORY_PX);

          // Corner milestone stones
          ctx.fillStyle = 'rgba(203, 213, 225, 0.45)';
          ctx.beginPath();
          ctx.arc(origin.x, origin.y, 6, 0, Math.PI * 2);
          ctx.arc(origin.x + TERRITORY_PX, origin.y, 6, 0, Math.PI * 2);
          ctx.arc(origin.x, origin.y + TERRITORY_PX, 6, 0, Math.PI * 2);
          ctx.arc(origin.x + TERRITORY_PX, origin.y + TERRITORY_PX, 6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Locked territory: Mystical exploration fog overlay
          ctx.save();
          ctx.fillStyle = 'rgba(16, 32, 22, 0.62)';
          ctx.fillRect(origin.x, origin.y, TERRITORY_PX, TERRITORY_PX);

          const curInv = inventoryRef.current;
          const canAfford =
            curInv.wood >= island.costWood &&
            curInv.stone >= island.costStone &&
            curInv.gold >= island.costGold;

          ctx.strokeStyle = canAfford ? 'rgba(74, 222, 128, 0.85)' : 'rgba(251, 191, 36, 0.65)';
          ctx.lineWidth = canAfford ? 3.5 : 2;
          ctx.setLineDash([16, 12]);
          ctx.strokeRect(origin.x + 4, origin.y + 4, TERRITORY_PX - 8, TERRITORY_PX - 8);
          ctx.setLineDash([]);
          ctx.restore();

          // Central Expansion Altar & Banner
          const signX = origin.x + 320;
          const signY = origin.y + 320;

          // Altar base shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.beginPath();
          ctx.ellipse(signX, signY + 36, 80, 20, 0, 0, Math.PI * 2);
          ctx.fill();

          // Banner Card
          ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
          ctx.beginPath();
          ctx.roundRect(signX - 125, signY - 56, 250, 108, 14);
          ctx.fill();
          ctx.strokeStyle = canAfford ? '#4ade80' : '#fbbf24';
          ctx.lineWidth = canAfford ? 3 : 2;
          ctx.stroke();

          // Territory Name
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 15px Pretendard, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`🚩 ${island.name}`, signX, signY - 26);

          // Resource Requirements
          ctx.font = 'bold 13px Pretendard, sans-serif';
          ctx.fillStyle = canAfford ? '#86efac' : '#fde047';
          const costStr = `필요: 🪵${island.costWood}  🪨${island.costStone}${
            island.costGold > 0 ? `  🪙${island.costGold}` : ''
          }`;
          ctx.fillText(costStr, signX, signY + 4);

          // Action Prompt
          ctx.font = 'bold 12px Pretendard, sans-serif';
          const isMobile = canvas.width < 768;
          if (canAfford) {
            ctx.fillStyle = '#4ade80';
            ctx.fillText(
              isMobile ? '✨ 개척 가능! [개척 버튼 터치]' : '✨ 개척 가능! [E 키 / 클릭]',
              signX,
              signY + 32
            );
          } else {
            ctx.fillStyle = '#f87171';
            ctx.fillText('자원 부족 (주변 자원 채집 필요)', signX, signY + 32);
          }
        }
      }

      // 5. Y-Sorted Depth Rendering (Buildings, Core, Entities, Players)
      interface Renderable {
        depthY: number;
        draw: () => void;
      }
      const renderables: Renderable[] = [];

      // Add Buildings
      for (const b of buildingsRef.current) {
        let bDepth = b.y + b.height - 20;
        if (b.type === 'castle') bDepth = b.y + 240;
        else if (b.type === 'tower') bDepth = b.y + 240;
        else if (b.type === 'monastery') bDepth = b.y + 290;
        else if (b.type === 'barracks' || b.type === 'archery') bDepth = b.y + 230;

        renderables.push({
          depthY: bDepth,
          draw: () => {
            // Shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
            ctx.beginPath();
            ctx.ellipse(b.x + b.width / 2, b.y + b.height - 12, b.width / 2.3, 18, 0, 0, Math.PI * 2);
            ctx.fill();

            let bImg: HTMLImageElement | null = null;
            switch (b.type) {
              case 'castle': bImg = assets.castle; break;
              case 'house1': bImg = assets.house1; break;
              case 'house2': bImg = assets.house2; break;
              case 'house3': bImg = assets.house3; break;
              case 'tower': bImg = assets.tower; break;
              case 'barracks': bImg = assets.barracks; break;
              case 'archery': bImg = assets.archery; break;
              case 'monastery': bImg = assets.monastery; break;
            }

            if (bImg && bImg.complete) {
              ctx.drawImage(bImg, b.x, b.y, b.width, b.height);
            }

            // Overhead Banner for Castle
            if (b.type === 'castle') {
              ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
              ctx.beginPath();
              ctx.roundRect(b.x + b.width / 2 - 95, b.y - 30, 190, 26, 6);
              ctx.fill();
              ctx.strokeStyle = '#38bdf8';
              ctx.lineWidth = 1.5;
              ctx.stroke();

              ctx.fillStyle = '#f8fafc';
              ctx.font = 'bold 12px Pretendard, sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText(b.name, b.x + b.width / 2, b.y - 13);
            }
          },
        });
      }

      // Add Central Territory Core (Territory 0)
      const coreX = CENTRAL_CORE.x;
      const coreY = CENTRAL_CORE.y;

      renderables.push({
        depthY: coreY + 24,
        draw: () => {
          // Core Glowing Aura
          const corePulse = Math.sin(now / 240) * 8;
          const coreGrd = ctx.createRadialGradient(coreX, coreY, 8, coreX, coreY, 52 + corePulse);
          coreGrd.addColorStop(0, 'rgba(56, 189, 248, 0.6)');
          coreGrd.addColorStop(0.6, 'rgba(14, 165, 233, 0.25)');
          coreGrd.addColorStop(1, 'rgba(14, 165, 233, 0)');
          ctx.fillStyle = coreGrd;
          ctx.beginPath();
          ctx.arc(coreX, coreY, 52 + corePulse, 0, Math.PI * 2);
          ctx.fill();

          // Floating Nexus Crystal
          const crystalHover = Math.sin(now / 180) * 6;
          const crystalY = coreY - 26 + crystalHover;

          // Shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
          ctx.beginPath();
          ctx.ellipse(coreX, coreY + 14, 18, 8, 0, 0, Math.PI * 2);
          ctx.fill();

          // Magical Diamond Crystal
          ctx.save();
          ctx.translate(coreX, crystalY);
          ctx.fillStyle = '#38bdf8';
          ctx.strokeStyle = '#e0f2fe';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(0, -22);
          ctx.lineTo(14, 0);
          ctx.lineTo(0, 22);
          ctx.lineTo(-14, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Inner facet highlight
          ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.beginPath();
          ctx.moveTo(0, -22);
          ctx.lineTo(14, 0);
          ctx.lineTo(0, 2);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          // Resonance wave effect
          if (now - lastCoreResonanceRef.current < 1500) {
            const waveProgress = (now - lastCoreResonanceRef.current) / 1500;
            const waveRadius = waveProgress * 280;
            ctx.save();
            ctx.strokeStyle = `rgba(56, 189, 248, ${1 - waveProgress})`;
            ctx.lineWidth = 4 * (1 - waveProgress);
            ctx.beginPath();
            ctx.arc(coreX, coreY, waveRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }

          // Core title & interaction badge
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.beginPath();
          ctx.roundRect(coreX - 70, coreY - 74, 140, 36, 8);
          ctx.fill();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px Pretendard, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('💎 영지 코어 Lv.1', coreX, coreY - 55);

          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 10px Pretendard, sans-serif';
          ctx.fillText('[E] 코어 공명', coreX, coreY - 42);
        },
      });

      // Add Entities (Trees, Rocks, Gold, Sheep)
      for (const ent of entitiesRef.current) {
        let entDepth = ent.y + 16;
        if (ent.type === 'rock' || ent.type === 'gold_rock') entDepth = ent.y + 20;

        renderables.push({
          depthY: entDepth,
          draw: () => {
            let shakeOffset = 0;
            if (ent.shakeTime && ent.shakeTime > now) {
              shakeOffset = Math.sin((now / 20) * Math.PI) * 5;
            }
            const drawX = ent.x + shakeOffset;
            const drawY = ent.y;

            if (ent.type === 'tree') {
              const treeFrame = Math.floor((now / 220) % 8);
              const treeImg = ent.id.includes('2') || ent.id.includes('4') ? (assets.tree3 || assets.tree) : assets.tree;
              const srcH = treeImg === assets.tree3 ? 192 : 256;
              const drawH = treeImg === assets.tree3 ? 160 : 200;

              // Tree shadow
              ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
              ctx.beginPath();
              ctx.ellipse(drawX + 16, drawY + 28, 44, 14, 0, 0, Math.PI * 2);
              ctx.fill();

              ctx.drawImage(
                treeImg,
                treeFrame * 192, 0, 192, srcH,
                drawX - 64, drawY - (drawH - 40), 160, drawH
              );
            } else if (ent.type === 'rock') {
              ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
              ctx.beginPath();
              ctx.ellipse(drawX + 32, drawY + 36, 26, 12, 0, 0, Math.PI * 2);
              ctx.fill();

              const rockImg = ent.id.includes('2') ? assets.rock2 : assets.rock1;
              ctx.drawImage(rockImg, drawX, drawY - 16, 64, 64);
            } else if (ent.type === 'gold_rock') {
              ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
              ctx.beginPath();
              ctx.ellipse(drawX + 32, drawY + 36, 28, 12, 0, 0, Math.PI * 2);
              ctx.fill();

              if (assets.goldResource && assets.goldResource.complete) {
                ctx.drawImage(assets.goldResource, drawX, drawY - 24, 72, 72);
              } else {
                ctx.save();
                ctx.drawImage(assets.rock2, drawX, drawY - 16, 64, 64);
                ctx.fillStyle = 'rgba(255, 215, 0, 0.35)';
                ctx.beginPath();
                ctx.arc(drawX + 32, drawY + 16, 24, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
              }
            } else if (ent.type === 'sheep') {
              const sheepFrame = Math.floor((now / 200 + (ent.id.charCodeAt(ent.id.length - 1) % 6)) % 6);
              const sheepDrawX = drawX - 16;
              const sheepDrawY = drawY - 24;

              ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
              ctx.beginPath();
              ctx.ellipse(drawX + 32, drawY + 36, 28, 10, 0, 0, Math.PI * 2);
              ctx.fill();

              if (assets.sheep && assets.sheep.complete) {
                ctx.drawImage(
                  assets.sheep,
                  sheepFrame * 128, 0, 128, 128,
                  sheepDrawX, sheepDrawY, 96, 96
                );
              } else {
                ctx.font = '28px sans-serif';
                ctx.fillText('🐑', drawX + 16, drawY + 24);
              }
            }

            // Health bar if damaged
            if (ent.hp < ent.maxHp && ent.type !== 'sheep') {
              const barW = 40;
              const barH = 5;
              const barX = ent.x + 16 - barW / 2;
              const barY = ent.y - 12;

              ctx.fillStyle = 'rgba(0,0,0,0.6)';
              ctx.fillRect(barX, barY, barW, barH);
              ctx.fillStyle = '#4caf50';
              ctx.fillRect(barX, barY, (ent.hp / ent.maxHp) * barW, barH);
            }
          },
        });
      }

      // Add Remote Players
      remotePlayersRef.current.forEach((remote) => {
        renderables.push({
          depthY: remote.y + 24,
          draw: () => drawCharacter(ctx, assets, remote, now, false),
        });
      });

      // Add Local Player
      renderables.push({
        depthY: player.y + 24,
        draw: () => drawCharacter(ctx, assets, localPlayerRef.current, now, true),
      });

      // Sort & Draw all renderables in Y order
      renderables.sort((a, b) => a.depthY - b.depthY);
      for (const r of renderables) {
        r.draw();
      }

      // 6. Draw Ambient Floating Clouds & Shadows
      for (const c of cloudsRef.current) {
        c.x += c.speed;
        if (c.x > 2200) {
          c.x = -2200;
          c.y = -800 + Math.random() * 2400;
        }

        const cloudImg = c.type === 1 ? assets.cloud1 : assets.cloud2;
        if (cloudImg && cloudImg.complete) {
          const cw = cloudImg.width * c.scale;
          const ch = cloudImg.height * c.scale;

          // Soft ground shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
          ctx.beginPath();
          ctx.ellipse(c.x + cw / 2, c.y + ch / 2 + 100, cw / 2.2, ch / 3, 0, 0, Math.PI * 2);
          ctx.fill();

          // Sky cloud
          ctx.save();
          ctx.globalAlpha = 0.65;
          ctx.drawImage(cloudImg, c.x, c.y, cw, ch);
          ctx.restore();
        }
      }

      // 7. Draw Particles
      particlesRef.current.forEach((p) => {
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

      // 8. Draw Floating Texts
      floatingTextsRef.current.forEach((ft) => {
        ft.y += ft.vy;
        ft.alpha -= 0.016;

        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.font = 'bold 15px Pretendard, sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      });
      floatingTextsRef.current = floatingTextsRef.current.filter((ft) => ft.alpha > 0);

      // 9. Minimap (Top-right HUD radar)
      ctx.restore(); // Exit camera space

      ctx.save();
      const isMobile = canvas.width < 768;
      const mmSize = isMobile ? 128 : 160;
      const mmPadding = isMobile ? 12 : 20;
      const mmX = canvas.width - mmSize - mmPadding;
      const mmY = mmPadding + (isMobile ? 56 : 72);

      // Minimap Card Background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      ctx.roundRect(mmX, mmY, mmSize, mmSize, isMobile ? 14 : 18);
      ctx.fill();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Minimap Header
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = 'bold 10px Pretendard, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('🚩 왕국 영지 지도', mmX + 10, mmY + 16);

      // 5x5 Territory Grid Radar
      const mmCenterX = mmX + mmSize / 2;
      const mmCenterY = mmY + mmSize / 2 + 6;
      const mmStep = isMobile ? 18 : 22;
      const boxSize = isMobile ? 14 : 17;

      for (const isl of islandsRef.current) {
        const ix = mmCenterX + isl.gridX * mmStep;
        const iy = mmCenterY + isl.gridY * mmStep;

        if (isl.unlocked) {
          ctx.fillStyle = isl.id === 0 ? '#38bdf8' : '#22c55e';
          ctx.beginPath();
          ctx.roundRect(ix - boxSize / 2, iy - boxSize / 2, boxSize, boxSize, 3);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          const currentInv = inventoryRef.current;
          const canAfford =
            currentInv.wood >= isl.costWood &&
            currentInv.stone >= isl.costStone &&
            currentInv.gold >= isl.costGold;

          ctx.fillStyle = canAfford ? 'rgba(234, 179, 8, 0.45)' : 'rgba(51, 65, 85, 0.7)';
          ctx.beginPath();
          ctx.roundRect(ix - boxSize / 2, iy - boxSize / 2, boxSize, boxSize, 3);
          ctx.fill();
          ctx.strokeStyle = canAfford ? '#fbbf24' : 'rgba(100, 116, 139, 0.5)';
          ctx.lineWidth = canAfford ? 1.2 : 0.8;
          ctx.stroke();
        }
      }

      // Remote players on minimap
      remotePlayersRef.current.forEach((rp) => {
        const rNormX = mmCenterX + ((rp.x - 320) / TERRITORY_STEP) * mmStep;
        const rNormY = mmCenterY + ((rp.y - 320) / TERRITORY_STEP) * mmStep;
        ctx.fillStyle = rp.color === 'blue' ? '#60a5fa' : '#f87171';
        ctx.beginPath();
        ctx.arc(rNormX, rNormY, isMobile ? 2 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Local player on minimap (pulsing marker)
      const pNormX = mmCenterX + ((player.x - 320) / TERRITORY_STEP) * mmStep;
      const pNormY = mmCenterY + ((player.y - 320) / TERRITORY_STEP) * mmStep;
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
      window.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);
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
    let spriteSheet: HTMLImageElement;
    let totalFrames = 6;
    let fps = 150;

    const isBlue = p.color === 'blue';

    if (p.action === 'idle') {
      spriteSheet = isBlue ? assets.bluePawnIdle : assets.redPawnIdle;
      totalFrames = 6;
      fps = 160;
    } else if (p.action === 'run') {
      spriteSheet = isBlue ? assets.bluePawnRun : assets.redPawnRun;
      totalFrames = 6;
      fps = 110;
    } else if (p.action === 'axe') {
      spriteSheet = isBlue ? assets.bluePawnAxe : assets.redPawnAxe;
      totalFrames = 6;
      fps = 70;
    } else {
      spriteSheet = isBlue ? assets.bluePawnPickaxe : assets.redPawnPickaxe;
      totalFrames = 6;
      fps = 70;
    }

    const frame = Math.floor((now / fps) % totalFrames);
    const frameW = 192;
    const frameH = 192;

    const renderW = 128;
    const renderH = 128;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 24, 22, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(p.x, p.y);

    if (p.direction === 'left') {
      ctx.scale(-1, 1);
    }

    ctx.drawImage(
      spriteSheet,
      frame * frameW,
      0,
      frameW,
      frameH,
      -renderW / 2,
      -renderH / 2,
      renderW,
      renderH
    );

    ctx.restore();

    // Name label
    ctx.fillStyle = isLocal ? '#38bdf8' : '#f87171';
    ctx.font = 'bold 12px Pretendard, sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.strokeText(p.name, p.x, p.y - 42);
    ctx.fillText(p.name, p.x, p.y - 42);

    if (isLocal) {
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('▼', p.x, p.y - 54);
    }
  };

  // Pointer Down on canvas
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Minimap radar click detection
    const isMobile = canvas.width < 768;
    const minimapSize = isMobile ? 128 : 160;
    const margin = isMobile ? 12 : 20;
    const mmX = canvas.width - minimapSize - margin;
    const mmY = margin + (isMobile ? 56 : 72);

    if (
      screenX >= mmX &&
      screenX <= mmX + minimapSize &&
      screenY >= mmY &&
      screenY <= mmY + minimapSize
    ) {
      sound.playClick();
      onOpenMinimap?.();
      return;
    }

    if (isPinchingRef.current || Date.now() - lastPinchEndTimeRef.current < 250) {
      return;
    }

    const currentZoom = zoomRef.current;
    const worldClickX = cameraRef.current.x + (screenX - canvas.width / 2) / currentZoom;
    const worldClickY = cameraRef.current.y + (screenY - canvas.height / 2) / currentZoom;

    const player = localPlayerRef.current;
    const distToPlayer = Math.hypot(worldClickX - player.x, worldClickY - player.y);

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
            ⚔️ Tiny Isles 평원 영지 로딩 중...
          </div>
          <div className="w-64 h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-600">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-green-500 transition-all duration-200"
              style={{ width: `${Math.round(loadProgress * 100)}%` }}
            />
          </div>
          <div className="mt-2 text-sm text-gray-400">
            영지 그리드 및 건물 에셋 로딩 {Math.round(loadProgress * 100)}%
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
