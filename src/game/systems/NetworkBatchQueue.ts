import { BatchedGameEvent } from '../../shared/multiplayerProtocol';

export interface NetworkBatchQueueOptions {
  flushIntervalMs: number;
  maxBatchSize?: number;
  onFlush: (events: BatchedGameEvent[]) => void;
}

/**
 * 고빈도 멀티플레이 이벤트(광역 타격, 성벽/건물 피격, 몬스터 공격 등)를
 * 고정 주기(기본 80ms)로 묶어 1회 WebSocket 프레임으로 전송하는 배치 큐
 * - 동일 coalesceKey가 들어오면 최신 상태만 유지해 중복 패킷을 제거합니다.
 */
export class NetworkBatchQueue {
  private readonly flushIntervalMs: number;
  private readonly maxBatchSize: number;
  private readonly onFlush: (events: BatchedGameEvent[]) => void;
  private queue: BatchedGameEvent[] = [];
  private coalescedIndex = new Map<string, number>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: NetworkBatchQueueOptions) {
    this.flushIntervalMs = Math.max(16, options.flushIntervalMs);
    this.maxBatchSize = Math.max(1, options.maxBatchSize ?? 24);
    this.onFlush = options.onFlush;
  }

  public enqueue(event: string, payload: Record<string, unknown>, coalesceKey?: string): void {
    if (coalesceKey) {
      const existingIdx = this.coalescedIndex.get(coalesceKey);
      if (existingIdx !== undefined && this.queue[existingIdx]) {
        this.queue[existingIdx] = { event, payload };
        return;
      }
      this.coalescedIndex.set(coalesceKey, this.queue.length);
    }

    this.queue.push({ event, payload });

    if (this.queue.length >= this.maxBatchSize) {
      this.flushNow();
      return;
    }

    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.flushNow();
      }, this.flushIntervalMs);
    }
  }

  public flushNow(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.queue.length === 0) return;

    const batch = this.queue;
    this.queue = [];
    this.coalescedIndex.clear();
    this.onFlush(batch);
  }

  public getPendingCount(): number {
    return this.queue.length;
  }

  public destroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.queue = [];
    this.coalescedIndex.clear();
  }
}
