import assert from 'node:assert/strict';
import test from 'node:test';
import { DomainSyncBus } from '../DomainSyncBus';
import { WorldSnapshotRegistry } from '../WorldSnapshotRegistry';

test('WorldSnapshotRegistry는 등록된 도메인 슬라이스를 일괄 캡처·복원하고 실패를 격리한다', () => {
  const registry = new WorldSnapshotRegistry();
  let restoredResources: number[] = [];

  registry.register('resources', {
    capture: () => [10, 20, 30],
    apply: (data: number[]) => {
      restoredResources = data;
    },
  });

  registry.register('broken_slice', {
    capture: () => {
      throw new Error('capture fail');
    },
    apply: () => {
      throw new Error('apply fail');
    },
  });

  const captured = registry.captureAll();
  assert.deepEqual(captured.resources, [10, 20, 30]);
  assert.equal('broken_slice' in captured, false);

  registry.applyAll({ resources: [99, 100], broken_slice: { x: 1 } });
  assert.deepEqual(restoredResources, [99, 100]);
});

test('DomainSyncBus는 타입 안전하게 배치 송신과 이벤트 구독 해제를 처리한다', () => {
  const handlers = new Map<string, (payload: unknown) => void>();
  const emitted: Array<{ event: string; batched: boolean; coalesceKey?: string }> = [];

  const bus = new DomainSyncBus({
    registerDynamicEvent: (event, handler) => {
      handlers.set(event, handler);
      return () => handlers.delete(event);
    },
    emitDynamic: (event, _payload, batched = false, coalesceKey) => {
      emitted.push({ event, batched, coalesceKey });
    },
  });

  let receivedOwner = '';
  const unsub = bus.on('mercenary_sync', (p) => {
    receivedOwner = p.ownerId;
  });

  handlers.get('mercenary_sync')?.({ ownerId: 'p2', ownerName: '팀원', units: [] });
  assert.equal(receivedOwner, 'p2');

  bus.emitBatched('mercenary_sync', { ownerId: 'p1', ownerName: '나', units: [] }, 'merc_p1');
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].batched, true);
  assert.equal(emitted[0].coalesceKey, 'merc_p1');

  unsub();
  assert.equal(handlers.has('mercenary_sync'), false);
  bus.destroy();
});
