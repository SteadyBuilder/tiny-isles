import {
  ConstructableType,
  ConstructedBuilding,
  GarrisonUnit,
  Inventory,
  Island,
  OfflineResolutionReport,
  PlayerColor,
  VillageTier,
  WaveState,
  WorldSyncState,
} from '../../types/game';
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
  'unlocked-islands': [ids: number[], total: number];
  'near-island-changed': Island | null;
  'open-village-modal': number; // territoryId

  // 건물 건설 및 파괴
  'construct-building': { territoryId: number; type: ConstructableType; slotIndex?: number };
  'constructed-buildings-updated': ConstructedBuilding[];
  'building-placed': ConstructedBuilding;
  'building-damaged': { buildingId: string; hp: number; maxHp: number };
  'building-destroyed': { territoryId: number; buildingId: string; slotIndex: number };

  // 웨이브 및 방어 시스템
  'trigger-regular-wave': void;
  'trigger-boss-wave': void;
  'summon-early-wave': { isBossWave: boolean };
  'reduce-wave-cooldown': number; // seconds
  'set-wave-timescale': number;
  'wave-state-updated': WaveState;
  'wave-spawned': { isBossWave: boolean; waveNumber: number };
  'monster-killed': { monsterId: string; monsterType: string; killer: string };

  // 리빙 아일즈: 글로벌 동기화, 오프라인 정산, 수비대
  'offline-report-ready': OfflineResolutionReport;
  'garrisons-updated': GarrisonUnit[];
  'world-state-synced': WorldSyncState;

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
