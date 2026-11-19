import { DomainSyncEventMap, DomainSyncEventName } from './domainSyncContracts';

export interface IDomainTransportAdapter {
  registerDynamicEvent: (event: string, handler: (payload: unknown) => void) => () => void;
  emitDynamic: (
    event: string,
    payload: Record<string, unknown>,
    batched?: boolean,
    coalesceKey?: string
  ) => void;
}

/**
 * 타입 안전 도메인 멀티플레이 이벤트 버스
 * - 35종 중앙 수동 배관을 늘리지 않고 각 게임 시스템이 독립적으로 송수신
 */
export class DomainSyncBus {
  private adapter: IDomainTransportAdapter;
  private unsubscribers: Array<() => void> = [];

  constructor(adapter: IDomainTransportAdapter) {
    this.adapter = adapter;
  }

  public on<K extends DomainSyncEventName>(
    event: K,
    handler: (payload: DomainSyncEventMap[K]) => void
  ): () => void {
    const unsub = this.adapter.registerDynamicEvent(event, (raw) => {
      if (!raw || typeof raw !== 'object') return;
      handler(raw as DomainSyncEventMap[K]);
    });
    this.unsubscribers.push(unsub);
    return () => {
      unsub();
      this.unsubscribers = this.unsubscribers.filter((u) => u !== unsub);
    };
  }

  public emit<K extends DomainSyncEventName>(event: K, payload: DomainSyncEventMap[K]): void {
    this.adapter.emitDynamic(event, payload as unknown as Record<string, unknown>, false);
  }

  public emitBatched<K extends DomainSyncEventName>(
    event: K,
    payload: DomainSyncEventMap[K],
    coalesceKey?: string
  ): void {
    this.adapter.emitDynamic(
      event,
      payload as unknown as Record<string, unknown>,
      true,
      coalesceKey
    );
  }

  public destroy(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
  }
}
