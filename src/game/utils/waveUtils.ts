import { Island, MonsterType } from '../../types/game';
import { getTerritoryCorePos } from '../constants';
import { WORLD_BOUNDS, WorldBounds } from '../worldBounds';
import {
  BOSS_MONSTER_TEMPLATES,
  MAP_OUTER_SPAWN_CONFIG,
  REGULAR_MONSTER_TEMPLATES,
} from '../../data/waves';

export type CardinalDirection = 'north' | 'south' | 'east' | 'west';

export interface PerimeterSpawnPoint {
  territory: Island;
  spawnX: number;
  spawnY: number;
  direction: CardinalDirection;
  directionLabel: string;
}

export interface MonsterTemplate {
  type: MonsterType;
  role: import('../../types/game').MonsterCombatRole;
  name: string;
  hp: number;
  attack: number;
  speed: number;
}

const CARDINAL_DIRECTIONS: readonly { direction: CardinalDirection; label: string }[] = [
  { direction: 'north', label: '북쪽 외곽' },
  { direction: 'south', label: '남쪽 외곽' },
  { direction: 'east', label: '동쪽 외곽' },
  { direction: 'west', label: '서쪽 외곽' },
] as const;

function resolveTargetTerritory(spawnX: number, spawnY: number, islands: Island[]): Island {
  const targetId = findNextInwardTargetTerritory(spawnX, spawnY, islands);
  return islands.find((i) => i.id === targetId && i.unlocked) ?? islands[0];
}

function clampCoord(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computeEdgeCoordinate(
  direction: CardinalDirection,
  offset: number,
  bounds: WorldBounds
): { spawnX: number; spawnY: number } {
  const margin = MAP_OUTER_SPAWN_CONFIG.edgeMarginPx;
  const minBound = bounds.min + margin;
  const maxBound = bounds.max - margin;
  const mapCenter = (bounds.min + bounds.max) / 2;

  switch (direction) {
    case 'north':
      return {
        spawnX: clampCoord(mapCenter + offset, minBound, maxBound),
        spawnY: minBound,
      };
    case 'south':
      return {
        spawnX: clampCoord(mapCenter + offset, minBound, maxBound),
        spawnY: maxBound,
      };
    case 'east':
      return {
        spawnX: maxBound,
        spawnY: clampCoord(mapCenter + offset, minBound, maxBound),
      };
    case 'west':
      return {
        spawnX: minBound,
        spawnY: clampCoord(mapCenter + offset, minBound, maxBound),
      };
  }
}

/**
 * 전체 지도(WORLD_BOUNDS)의 동·서·남·북 최외곽 경계 대표 스폰 지점 계산 순수 함수
 * 마물 웨이브는 지도 외곽에서 시작해 가장 가까운 점령 영지를 향해 진격합니다.
 */
export function getOuterPerimeterSpawns(
  islands: Island[],
  bounds: WorldBounds = WORLD_BOUNDS
): PerimeterSpawnPoint[] {
  if (islands.length === 0) return [];

  return CARDINAL_DIRECTIONS.map(({ direction, label }) => {
    const { spawnX, spawnY } = computeEdgeCoordinate(direction, 0, bounds);
    return {
      territory: resolveTargetTerritory(spawnX, spawnY, islands),
      spawnX,
      spawnY,
      direction,
      directionLabel: label,
    };
  });
}

/**
 * 동·서·남·북 지도 외곽 중 무작위 방향과 변 내 랜덤 좌표를 선택하는 함수
 */
export function pickRandomMapEdgeSpawn(
  islands: Island[],
  bounds: WorldBounds = WORLD_BOUNDS,
  rng: () => number = Math.random
): PerimeterSpawnPoint | null {
  if (islands.length === 0) return null;

  const dirIndex = Math.floor(rng() * CARDINAL_DIRECTIONS.length);
  const picked = CARDINAL_DIRECTIONS[dirIndex] ?? CARDINAL_DIRECTIONS[0];
  const halfSpread = MAP_OUTER_SPAWN_CONFIG.spreadHalfWidthPx;
  const offset = (rng() * 2 - 1) * halfSpread;
  const { spawnX, spawnY } = computeEdgeCoordinate(picked.direction, offset, bounds);

  return {
    territory: resolveTargetTerritory(spawnX, spawnY, islands),
    spawnX,
    spawnY,
    direction: picked.direction,
    directionLabel: picked.label,
  };
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
 * [AI Guideline]: 신규 몬스터 스펙 변경은 src/data/waves.ts를 참고하세요.
 */
export function getRegularMonsterTemplates(waveNum: number): MonsterTemplate[] {
  return REGULAR_MONSTER_TEMPLATES.map((tmpl) => ({
    type: tmpl.type,
    role: tmpl.role,
    name: tmpl.name,
    hp: tmpl.baseHp + waveNum * tmpl.hpPerWave,
    attack: tmpl.baseAttack + waveNum * tmpl.attackPerWave,
    speed: tmpl.speed,
  }));
}

export interface BossMonsterTemplate extends MonsterTemplate {
  templateId: string;
  spriteKey: string;
  tintHex: number;
  scale: number;
  skillId: import('../../types/game').BossSkillId;
}

export function getBossMonsterTemplate(bossWaveCount: number): BossMonsterTemplate {
  const index = Math.max(0, bossWaveCount - 1) % BOSS_MONSTER_TEMPLATES.length;
  const tmpl = BOSS_MONSTER_TEMPLATES[index];
  const waveTierMult = 1 + Math.max(0, bossWaveCount - 1) * 0.28;
  const atkTierMult = 1 + Math.max(0, bossWaveCount - 1) * 0.18;
  return {
    templateId: tmpl.id,
    type: tmpl.type,
    role: tmpl.role,
    name: `${tmpl.name} (${bossWaveCount}차 보스)`,
    spriteKey: tmpl.spriteKey,
    tintHex: tmpl.tintHex,
    scale: tmpl.scale,
    skillId: tmpl.skillId,
    hp: Math.round((tmpl.baseHp + bossWaveCount * tmpl.hpPerBossWave) * waveTierMult),
    attack: Math.round((tmpl.baseAttack + bossWaveCount * tmpl.attackPerBossWave) * atkTierMult),
    speed: tmpl.speed + Math.max(0, bossWaveCount - 1) * 2,
  };
}
