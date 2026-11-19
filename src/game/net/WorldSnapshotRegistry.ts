import { DomainSnapshotProvider } from './domainSyncContracts';

/**
 * 도메인별 초기/중도 합류 스냅샷 등록기 (Plugin Registry)
 * - 각 시스템(자원, 용병, 신규 콘텐츠)이 스스로 capture/apply를 등록하면
 *   호스트 스냅샷 송출 및 중도 합류 복구가 자동으로 통합 처리됩니다.
 */
export class WorldSnapshotRegistry {
  private providers = new Map<string, DomainSnapshotProvider<unknown>>();

  public register<T>(key: string, provider: DomainSnapshotProvider<T>): () => void {
    this.providers.set(key, provider as DomainSnapshotProvider<unknown>);
    return () => {
      if (this.providers.get(key) === (provider as DomainSnapshotProvider<unknown>)) {
        this.providers.delete(key);
      }
    };
  }

  public captureAll(): Record<string, unknown> {
    const slices: Record<string, unknown> = {};
    for (const [key, provider] of this.providers.entries()) {
      try {
        slices[key] = provider.capture();
      } catch {
        // 개별 슬라이스 캡처 실패가 전체 스냅샷을 깨지 않도록 격리
      }
    }
    return slices;
  }

  public applyAll(slices: Record<string, unknown> | null | undefined): void {
    if (!slices || typeof slices !== 'object') return;
    for (const [key, provider] of this.providers.entries()) {
      if (!(key in slices)) continue;
      try {
        provider.apply(slices[key]);
      } catch {
        // 개별 슬라이스 복구 실패 격리
      }
    }
  }

  public getRegisteredKeys(): string[] {
    return Array.from(this.providers.keys());
  }

  public clear(): void {
    this.providers.clear();
  }
}
