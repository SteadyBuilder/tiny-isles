import assert from 'node:assert/strict';
import test from 'node:test';
import { BatchedGameEvent } from '../../../shared/multiplayerProtocol';
import { NetworkBatchQueue } from '../NetworkBatchQueue';

test('NetworkBatchQueue는 동일 coalesceKey 이벤트를 최신 값으로 병합해 1회 배치로 플러시한다', () => {
  const flushed: BatchedGameEvent[][] = [];
  const queue = new NetworkBatchQueue({
    flushIntervalMs: 80,
    maxBatchSize: 10,
    onFlush: (events) => flushed.push(events),
  });

  queue.enqueue('building_hp_sync', { buildingId: 'w1', hp: 90 }, 'bld_hp_w1');
  queue.enqueue('building_hp_sync', { buildingId: 'w1', hp: 70 }, 'bld_hp_w1');
  queue.enqueue('monster_hit', { monsterId: 'm1', damage: 25 });
  queue.enqueue('monster_hit', { monsterId: 'm2', damage: 25 });

  assert.equal(queue.getPendingCount(), 3);
  queue.flushNow();

  assert.equal(flushed.length, 1);
  assert.equal(flushed[0].length, 3);
  assert.equal(flushed[0][0].payload.hp, 70);
  assert.equal(queue.getPendingCount(), 0);
  queue.destroy();
});

test('NetworkBatchQueue는 maxBatchSize 도달 시 타이머를 기다리지 않고 즉시 플러시한다', () => {
  const flushed: BatchedGameEvent[][] = [];
  const queue = new NetworkBatchQueue({
    flushIntervalMs: 1000,
    maxBatchSize: 3,
    onFlush: (events) => flushed.push(events),
  });

  queue.enqueue('monster_hit', { id: 1 });
  queue.enqueue('monster_hit', { id: 2 });
  assert.equal(flushed.length, 0);

  queue.enqueue('monster_hit', { id: 3 });
  assert.equal(flushed.length, 1);
  assert.equal(flushed[0].length, 3);
  queue.destroy();
});
