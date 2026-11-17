import {
  ConstructableType,
  ConstructedBuilding,
  DungeonPortalState,
  EquipmentSlot,
  GarrisonUnit,
  Inventory,
  Island,
  PlayerClassId,
  PlayerColor,
  PlayerHpState,
  PlayerProgressionState,
  ThreatOrbFxPayload,
  VillageTier,
  WaveState,
  WorldSyncState,
} from '../../types/game';
import {
  MissionProgressState,
  MissionResultPayload,
  RoomMember,
} from '../../types/room';
import { EventBus } from '../phaser/EventBus';

/**
 * 게임 시스템 간 이벤트 계약 (AI Guideline: 시스템 간 직접 호출을 금지하고 반드시 이 이벤트를 경유할 것)
 * 실제 EventBus 런타임 호출부와 1:1로 동기화된 단일 이벤트 스키마
 */
export interface GameEventPayloads {
  // 씬 라이프사이클 & 로딩
  'load-progress': number;
  'load-complete': void;
  'scene-ready': unknown;

  // 영지 및 마을 테크트리
  'upgrade-village': number; // territoryId
  'village-upgraded': { territoryId: number; tier: VillageTier };
  'repair-territory-core': number; // territoryId
  'damage-territory-core': { territoryId: number; damage: number };
  'core-damaged': { territoryId: number; currentHp: number; maxHp: number };
  'territory-lost': { territoryId: number; name: string };
  'territories-updated': Island[];
  'unlocked-islands': { ids: number[]; total: number };
  'near-island-changed': Island | null;
  'open-village-modal': number; // territoryId

  // 건물 건설 및 파괴
  'construct-building': {
    territoryId: number;
    type: ConstructableType;
    slotIndex?: number;
    customPos?: { x: number; y: number };
  };
  'enter-tower-placement': { territoryId: number; type: ConstructableType };
  'cancel-tower-placement': void;
  'confirm-tower-placement': void;
  'placement-state-changed': {
    active: boolean;
    territoryId?: number;
    type?: ConstructableType;
    hasSelection?: boolean;
    isValid?: boolean;
    reason?: string;
  };
  'constructed-buildings-updated': ConstructedBuilding[];
  'building-placed': ConstructedBuilding;
  'building-damaged': { buildingId: string; hp: number; maxHp: number };
  'building-destroyed': { territoryId: number; buildingId: string; slotIndex: number };

  // 웨이브 및 방어 시스템
  'trigger-regular-wave': void;
  'trigger-boss-wave': void;
  'summon-early-wave': { isBossWave: boolean };
  'add-threat': number; // percent
  'threat-orb-fx': ThreatOrbFxPayload;
  'wave-state-updated': WaveState;
  'wave-spawned': { isBossWave: boolean; waveNumber: number };
  'monster-killed': { monsterId: string; monsterType: string; killer: string };

  // 사냥 특화 모드: 개인 성장, 전직, 장비 인벤토리, 몬스터 부락, 던전 게이트
  'player-progression-updated': PlayerProgressionState;
  'job-hall-proximity-changed': boolean;
  'open-job-hall-modal': void;
  'open-inventory-modal': void;
  'select-player-class': PlayerClassId;
  'equip-item': string; // instanceId
  'unequip-slot': EquipmentSlot;
  'salvage-item': string; // instanceId
  'cast-active-skill': void;
  'camp-conquered': { territoryId: number; campName: string; firstClearedCount: number };
  'dungeon-portal-updated': DungeonPortalState | null;

  // 리빙 아일즈: 글로벌 동기화, 수비대
  'garrisons-updated': GarrisonUnit[];
  'world-state-synced': WorldSyncState;
  'world-defense-failed': { resetAt: string; attackerName: string };

  // 인스턴스 룸 & 미션 시스템
  'mission-progress-updated': MissionProgressState;
  'mission-ended': MissionResultPayload;
  'game-pause-toggled': boolean;
  'room-members-updated': RoomMember[];

  // 자원 및 인벤토리
  'add-test-resources': void;
  'set-inventory': Inventory;
  'inventory-updated': Inventory;

  // 플레이어, 입력, 카메라 및 멀티 동기화
  'set-player-profile': { name: string; color: PlayerColor };
  'set-zoom': number;
  'zoom-changed': number;
  'joystick-move': { x: number; y: number };
  'player-action-start': void;
  'player-action-stop': void;
  'trigger-interact': void;
  'player-grid-pos-changed': { gridX: number; gridY: number };
  'player-moved': { x: number; y: number; direction: string; action: string };
  'player-hp-updated': PlayerHpState;
  'player-fainted': void;
  'player-respawned': void;
  'online-count-changed': number;
  'game-alert': string;
}

/**
 * 타입 안전성이 보장된 게임 이벤트 브로커
 */
export const GameEvents = {
  emit: <K extends keyof GameEventPayloads>(
    event: K,
    ...args: GameEventPayloads[K] extends void ? [] : [GameEventPayloads[K]]
  ) => {
    EventBus.emit(event as string, args[0]);
  },

  on: <K extends keyof GameEventPayloads>(
    event: K,
    handler: (payload: GameEventPayloads[K]) => void
  ) => {
    EventBus.on(event as string, handler);
  },

  off: <K extends keyof GameEventPayloads>(
    event: K,
    handler: (payload: GameEventPayloads[K]) => void
  ) => {
    EventBus.off(event as string, handler);
  },
};
