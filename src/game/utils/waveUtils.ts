import { Island, MonsterType } from '../../types/game';
import { getIslandOrigin, getTerritoryCorePos } from '../constants';

export interface PerimeterSpawnPoint {
  territory: Island;
  spawnX: number;
  spawnY: number;
}

export interface MonsterTemplate {
  type: MonsterType;
  name: string;
  hp: number;
  attack: number;
  speed: number;
}

/**
 * 점령된(unlocked === true) 영지들의 외곽 둘레 경계선 스폰 지점 계산 순수 함수
 * 마물 웨이브는 점령한 땅의 외곽 경계선에서부터 진입하여 중심부를 향해 진격합니다.
 */
export function getOuterPerimeterSpawns(islands: Island[]): PerimeterSpawnPoint[] {
  const unlocked = islands.filter((i) => i.unlocked);
  if (unlocked.length === 0) {
    const center = islands[0];
    const origin = getIslandOrigin(0, 0);
    return [{ territory: center, spawnX: origin.x + 320, spawnY: origin.y + 20 }];
  }

  const unlockedSet = new Set(unlocked.map((i) => `${i.gridX},${i.gridY}`));
  const spawns: PerimeterSpawnPoint[] = [];

  const dirs = [
    { dx: 0, dy: -1, relX: 320, relY: 20 },  // 북쪽 외곽 경계
    { dx: 0, dy: 1, relX: 320, relY: 620 },  // 남쪽 외곽 경계
    { dx: 1, dy: 0, relX: 620, relY: 350 },  // 동쪽 외곽 경계
    { dx: -1, dy: 0, relX: 20, relY: 350 },  // 서쪽 외곽 경계
  ];

  let maxDist = 0;
  for (const isl of unlocked) {
    const d = Math.abs(isl.gridX) + Math.abs(isl.gridY);
    if (d > maxDist) maxDist = d;
  }

  for (const isl of unlocked) {
    const origin = getIslandOrigin(isl.gridX, isl.gridY);
    for (const dir of dirs) {
      const nx = isl.gridX + dir.dx;
      const ny = isl.gridY + dir.dy;
      // 인접 방향이 미점령 상태라면 이 변은 점령지의 외곽 경계선!
      if (!unlockedSet.has(`${nx},${ny}`)) {
        if (unlocked.length === 1 || isl.id !== 0 || maxDist === 0) {
          spawns.push({
            territory: isl,
            spawnX: origin.x + dir.relX,
            spawnY: origin.y + dir.relY,
          });
        }
      }
    }
  }

  if (spawns.length === 0) {
    const first = unlocked[unlocked.length - 1];
    const origin = getIslandOrigin(first.gridX, first.gridY);
    spawns.push({ territory: first, spawnX: origin.x + 320, spawnY: origin.y + 20 });
  }

  return spawns;
}

/**
 * 몬스터의 현재 위치에서 중심 마을(Territory #0) 방향으로 가장 가까운 안쪽 점령 영지 ID 탐색
 */
export function findNextInwardTargetTerritory(
  mx: number,
  my: number,
  islands: Island[]
): number {
  const unlocked = islands.filter((i) => i.unlocked);
  if (unlocked.length <= 1) return 0;

  let bestId = 0;
  let bestScore = Infinity;
  for (const isl of unlocked) {
    const cPos = getTerritoryCorePos(isl.gridX, isl.gridY);
    const distToMonster = Math.hypot(mx - cPos.x, my - cPos.y);
    const distToCenter = Math.hypot(cPos.x - 320, cPos.y - 350);
    const score = distToMonster * 0.6 + distToCenter * 0.4;
    if (score < bestScore) {
      bestScore = score;
      bestId = isl.id;
    }
  }
  return bestId;
}

/**
 * 웨이브 차수 및 보스 여부에 따른 몬스터 기본 스탯 생성
 */
export function getRegularMonsterTemplates(waveNum: number): MonsterTemplate[] {
  return [
    {
      type: 'zombie',
      name: '🧟 부패한 좀비',
      hp: 90 + waveNum * 15,
      attack: 14 + waveNum * 2,
      speed: 48,
    },
    {
      type: 'skeleton',
      name: '💀 저주받은 스켈레톤',
      hp: 70 + waveNum * 12,
      attack: 18 + waveNum * 2,
      speed: 64,
    },
    {
      type: 'goblin',
      name: '👺 암흑 마물병',
      hp: 80 + waveNum * 14,
      attack: 16 + waveNum * 2,
      speed: 58,
    },
  ];
}
