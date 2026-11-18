import { MonsterVisual } from '../systems/MonsterVisualManager';

const CELL_SIZE_PX = 128;

function cellKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

/**
 * 100마리 이상 마물 대군 환경에서 O(1) 인접 셀 기반 고속 범위 탐색 및
 * 군집 겹침 방지(Boids Separation)를 수행하는 공간 해시 그리드 유틸리티
 */
export class MonsterSpatialGrid {
  private cells = new Map<string, MonsterVisual[]>();
  private bucketPool: MonsterVisual[][] = [];
  private lastFrameStamp = -1;

  private clearCells(): void {
    for (const bucket of this.cells.values()) {
      bucket.length = 0;
      if (this.bucketPool.length < 256) {
        this.bucketPool.push(bucket);
      }
    }
    this.cells.clear();
  }

  public ensureFresh(
    monsters: ReadonlyMap<string, MonsterVisual>,
    frameStamp: number
  ): void {
    if (monsters.size === 0) {
      if (this.cells.size > 0) this.clearCells();
      this.lastFrameStamp = frameStamp;
      return;
    }
    if (this.lastFrameStamp === frameStamp && frameStamp >= 0) {
      return;
    }
    this.rebuild(monsters, frameStamp);
  }

  public rebuild(monsters: ReadonlyMap<string, MonsterVisual>, frameStamp = -1): void {
    this.clearCells();
    this.lastFrameStamp = frameStamp;
    for (const mv of monsters.values()) {
      if (mv.monster.hp <= 0) continue;
      const cx = Math.floor(mv.monster.x / CELL_SIZE_PX);
      const cy = Math.floor(mv.monster.y / CELL_SIZE_PX);
      const key = cellKey(cx, cy);
      const bucket = this.cells.get(key);
      if (bucket) {
        bucket.push(mv);
      } else {
        const fresh = this.bucketPool.pop() ?? [];
        fresh.push(mv);
        this.cells.set(key, fresh);
      }
    }
  }

  public queryRadius(x: number, y: number, radiusPx: number): MonsterVisual[] {
    const minCx = Math.floor((x - radiusPx) / CELL_SIZE_PX);
    const maxCx = Math.floor((x + radiusPx) / CELL_SIZE_PX);
    const minCy = Math.floor((y - radiusPx) / CELL_SIZE_PX);
    const maxCy = Math.floor((y + radiusPx) / CELL_SIZE_PX);
    const rSq = radiusPx * radiusPx;
    const result: MonsterVisual[] = [];

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const bucket = this.cells.get(cellKey(cx, cy));
        if (!bucket) continue;
        for (const mv of bucket) {
          if (mv.monster.hp <= 0) continue;
          const dx = mv.monster.x - x;
          const dy = mv.monster.y - y;
          if (dx * dx + dy * dy <= rSq) {
            result.push(mv);
          }
        }
      }
    }
    return result;
  }

  public findNearestInRadius(
    x: number,
    y: number,
    radiusPx: number
  ): MonsterVisual | null {
    const minCx = Math.floor((x - radiusPx) / CELL_SIZE_PX);
    const maxCx = Math.floor((x + radiusPx) / CELL_SIZE_PX);
    const minCy = Math.floor((y - radiusPx) / CELL_SIZE_PX);
    const maxCy = Math.floor((y + radiusPx) / CELL_SIZE_PX);
    let bestDistSq = radiusPx * radiusPx;
    let best: MonsterVisual | null = null;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const bucket = this.cells.get(cellKey(cx, cy));
        if (!bucket) continue;
        for (const mv of bucket) {
          if (mv.monster.hp <= 0) continue;
          const dx = mv.monster.x - x;
          const dy = mv.monster.y - y;
          const dSq = dx * dx + dy * dy;
          if (dSq <= bestDistSq) {
            bestDistSq = dSq;
            best = mv;
          }
        }
      }
    }
    return best;
  }

  /**
   * 100마리 진격 시 한 픽셀에 겹치지 않도록 인접 마물과의 반발력(Separation) 벡터 계산
   */
  public computeSeparation(
    selfId: string,
    x: number,
    y: number,
    separationRadius = 38
  ): { pushX: number; pushY: number } {
    const cx = Math.floor(x / CELL_SIZE_PX);
    const cy = Math.floor(y / CELL_SIZE_PX);
    const rSq = separationRadius * separationRadius;
    let pushX = 0;
    let pushY = 0;
    let neighborCount = 0;

    for (let dxCell = -1; dxCell <= 1; dxCell++) {
      for (let dyCell = -1; dyCell <= 1; dyCell++) {
        const bucket = this.cells.get(cellKey(cx + dxCell, cy + dyCell));
        if (!bucket) continue;
        for (const other of bucket) {
          if (other.monster.id === selfId) continue;
          const dx = x - other.monster.x;
          const dy = y - other.monster.y;
          const dSq = dx * dx + dy * dy;
          if (dSq > 0.001 && dSq < rSq) {
            const dist = Math.sqrt(dSq);
            const strength = (separationRadius - dist) / separationRadius;
            pushX += (dx / dist) * strength;
            pushY += (dy / dist) * strength;
            neighborCount++;
            if (neighborCount >= 6) {
              return { pushX: pushX * 26, pushY: pushY * 26 };
            }
          }
        }
      }
    }

    return { pushX: pushX * 26, pushY: pushY * 26 };
  }
}
