import { Entity, MercenaryUnit } from '../../types/game';

/**
 * 도메인별 확장형 멀티플레이 이벤트 타입 맵 (Contract-First)
 * - 신규 콘텐츠(용병, 자원, 보스 기믹 등) 추가 시 중앙 컨트롤러를 수정하지 않고
 *   이 맵에 이벤트 계약을 추가한 뒤 각 시스템이 DomainSyncBus로 직접 구독/송신합니다.
 */
export interface DomainSyncEventMap {
  mercenary_sync: {
    ownerId: string;
    ownerName: string;
    units: MercenaryUnit[];
  };
  domain_snapshot_sync: {
    hostEpoch: number;
    slices: Record<string, unknown>;
  };
}

export type DomainSyncEventName = keyof DomainSyncEventMap;

export interface DomainSnapshotSliceMap {
  resources: Entity[];
  mercenaries: Array<{
    ownerId: string;
    ownerName: string;
    units: MercenaryUnit[];
  }>;
}

export interface DomainSnapshotProvider<T = unknown> {
  capture: () => T;
  apply: (data: T) => void;
}
