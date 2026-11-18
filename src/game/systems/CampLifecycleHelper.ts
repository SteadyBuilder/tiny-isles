import type Phaser from 'phaser';
import { rollCampRewardItem } from '../../data/items';
import { CAMP_RING_TEMPLATES, computeCampRing } from '../../data/monsterCamps';
import { sound } from '../../lib/sound';
import { EquipmentItem, Island, MonsterCampState } from '../../types/game';
import { HuntingScalingFactors } from '../../types/hunting';
import { TERRITORY_CENTER_X, TERRITORY_CENTER_Y, getIslandOrigin } from '../constants';
import { GameEvents } from '../events/gameEvents';
import {
  CampVisualNode,
  createCampVisualNode,
  updateCampHpVisualNode,
} from '../phaser/renderers/CampVisualHelper';
import { MonsterVisual, MonsterVisualManager } from './MonsterVisualManager';

export function initializeIslandCampState(
  isl: Island,
  hpMult: number
): { campState: MonsterCampState; buildingSprite: 'blackTower' | 'blackCastle' | 'purpleCastle' } {
  const ring = computeCampRing(isl.gridX, isl.gridY);
  const tpl = CAMP_RING_TEMPLATES[ring];
  const scaledCoreHp = Math.round(tpl.coreMaxHp * hpMult);

  isl.unlocked = false;
  isl.isMonsterCamp = true;
  isl.campRing = ring;
  isl.campLevel = tpl.baseLevel;
  isl.campDestroyed = false;
  isl.campRespawnSec = null;
  isl.coreHp = scaledCoreHp;
  isl.coreMaxHp = scaledCoreHp;

  const campState: MonsterCampState = {
    territoryId: isl.id,
    gridX: isl.gridX,
    gridY: isl.gridY,
    name: isl.name.replace('마을터', '마물 부락'),
    ring,
    level: tpl.baseLevel,
    coreHp: scaledCoreHp,
    coreMaxHp: scaledCoreHp,
    destroyed: false,
    respawnRemainingSec: null,
    firstCleared: false,
    clearCount: 0,
  };

  return { campState, buildingSprite: tpl.buildingSprite };
}

export interface CampRewardExecutionCallbacks {
  islands: Island[];
  campNodes: ReadonlyMap<number, CampVisualNode>;
  playExplosionAt: (x: number, y: number) => void;
  addResources: (wood: number, stone: number, gold: number) => void;
  gainExp: (amount: number) => void;
  grantRewardItem: (item: EquipmentItem) => void;
  playChestDropAt?: (
    x: number,
    y: number,
    item: EquipmentItem,
    onOpened: (item: EquipmentItem) => void
  ) => void;
  emitTerritoriesUpdated: () => void;
}

/**
 * 접속자 수 변화에 따른 부락 본진 및 주둔병 스케일링 조정
 */
export function scaleCampsForOnlineCount(params: {
  campNodes: ReadonlyMap<number, CampVisualNode>;
  islands: Island[];
  monsters: Map<string, MonsterVisual>;
  hpRatio: number;
  atkRatio: number;
  isHost: boolean;
}): void {
  const { campNodes, islands, monsters, hpRatio, atkRatio, isHost } = params;
  for (const node of campNodes.values()) {
    const { camp } = node;
    if (camp.destroyed) continue;
    const coreRatio = camp.coreHp / Math.max(1, camp.coreMaxHp);
    camp.coreMaxHp = Math.max(1, Math.round(camp.coreMaxHp * hpRatio));
    camp.coreHp = Math.max(1, Math.round(camp.coreMaxHp * coreRatio));
    updateCampHpVisualNode(node, false);
    const isl = islands.find((i) => i.id === camp.territoryId);
    if (isl) {
      isl.coreMaxHp = camp.coreMaxHp;
      isl.coreHp = camp.coreHp;
    }
  }

  if (!isHost) return;

  for (const mv of monsters.values()) {
    const m = mv.monster;
    if (!m.isCampMonster || m.hp <= 0) continue;
    const hpPct = m.hp / Math.max(1, m.maxHp);
    m.maxHp = Math.max(1, Math.round(m.maxHp * hpRatio));
    m.hp = Math.max(1, Math.round(m.maxHp * hpPct));
    m.attack = Math.max(1, Math.round(m.attack * atkRatio));
    MonsterVisualManager.updateHpBar(mv, false);
  }
}

/**
 * 파괴된 부락의 섬 상태 동기화, 폭발/상자 드랍 연출, 개인 보상 지급 및 알림 발송
 */
export function executeCampClearedPresentationAndRewards(
  node: CampVisualNode,
  cb: CampRewardExecutionCallbacks
): void {
  const { camp, container } = node;
  const tpl = CAMP_RING_TEMPLATES[camp.ring];

  const isl = cb.islands.find((i) => i.id === camp.territoryId);
  if (isl) {
    isl.coreHp = 0;
    isl.campDestroyed = true;
    isl.campRespawnSec = camp.respawnRemainingSec ?? tpl.respawnSec;
  }

  cb.playExplosionAt(container.x, container.y);
  sound.playBreak();
  updateCampHpVisualNode(node);

  const { wood, stone, gold } = tpl.clearResourceReward;
  cb.addResources(wood, stone, gold);
  cb.gainExp(tpl.clearBonusExp);

  const rewardItem = rollCampRewardItem(camp.ring, camp.clearCount);
  if (cb.playChestDropAt) {
    cb.playChestDropAt(container.x, container.y, rewardItem, (openedItem) => {
      cb.grantRewardItem(openedItem);
      GameEvents.emit(
        'game-alert',
        `🎁 [${camp.name}] 보물 상자 오픈! [${openedItem.icon}${openedItem.name}] 획득!`
      );
    });
  } else {
    cb.grantRewardItem(rewardItem);
  }

  const firstClearedTotal = Array.from(cb.campNodes.values()).filter(
    (n) => n.camp.firstCleared
  ).length;
  GameEvents.emit('camp-conquered', {
    territoryId: camp.territoryId,
    campName: camp.name,
    firstClearedCount: firstClearedTotal,
  });
  GameEvents.emit(
    'game-alert',
    `🏆 [${camp.name}] 본진 파괴! +${tpl.clearBonusExp} EXP! 보물 상자가 드랍되었습니다!`
  );
  cb.emitTerritoriesUpdated();
}

/**
 * 부락 재건 완료 시 Island 상태 및 본진 스탯 갱신
 */
export function applyCampRebuildState(
  node: CampVisualNode,
  islands: Island[],
  nextState: { level: number; coreHp: number; coreMaxHp: number }
): void {
  const { camp } = node;
  camp.destroyed = false;
  camp.respawnRemainingSec = null;
  camp.level = nextState.level;
  camp.coreMaxHp = Math.max(1, nextState.coreMaxHp);
  camp.coreHp = Math.max(1, Math.min(camp.coreMaxHp, nextState.coreHp));
  node.hpTrailRatio = 1;
  node.hpFlashUntil = 0;

  const isl = islands.find((i) => i.id === camp.territoryId);
  if (isl) {
    isl.campDestroyed = false;
    isl.campRespawnSec = null;
    isl.campLevel = camp.level;
    isl.coreHp = camp.coreHp;
    isl.coreMaxHp = camp.coreMaxHp;
  }
}

export function applyCampRebuildAlert(camp: MonsterCampState): void {
  GameEvents.emit(
    'game-alert',
    `🔥 [${camp.name}] 부락이 Lv.${camp.level}로 재건되어 더욱 강력한 보상을 품고 부활했습니다!`
  );
}

export function drainCampHpTrails(
  campNodes: ReadonlyMap<number, CampVisualNode>,
  deltaMs: number
): void {
  const now = performance.now();
  const drainStep = (1.35 * deltaMs) / 1000;
  for (const node of campNodes.values()) {
    if (node.camp.destroyed) continue;
    const ratio = Math.max(0, Math.min(1, node.camp.coreHp / Math.max(1, node.camp.coreMaxHp)));
    const wasFlashing = node.hpFlashUntil > 0 && now >= node.hpFlashUntil;
    if (node.hpTrailRatio > ratio + 0.002 || now < node.hpFlashUntil || wasFlashing) {
      if (node.hpTrailRatio > ratio + 0.002) {
        node.hpTrailRatio = Math.max(ratio, node.hpTrailRatio - drainStep);
      }
      if (wasFlashing) node.hpFlashUntil = 0;
      updateCampHpVisualNode(node, false);
    }
  }
}

export function initializeCampVisualNodes(params: {
  scene: Phaser.Scene;
  islands: Island[];
  campNodes: Map<number, CampVisualNode>;
  scaling: HuntingScalingFactors;
  hostAuthoritative: boolean;
  onSpawnFortification: (camp: MonsterCampState, hpMult: number, atkMult: number) => void;
  onSpawnGarrison: (camp: MonsterCampState) => void;
}): void {
  const { scene, islands, campNodes, scaling, hostAuthoritative, onSpawnFortification, onSpawnGarrison } = params;
  for (const isl of islands) {
    if (isl.id === 0) continue;
    const { campState, buildingSprite } = initializeIslandCampState(isl, scaling.hpMult);
    const origin = getIslandOrigin(isl.gridX, isl.gridY);
    const node = createCampVisualNode(
      scene,
      origin.x + TERRITORY_CENTER_X,
      origin.y + TERRITORY_CENTER_Y,
      campState,
      buildingSprite
    );
    campNodes.set(isl.id, node);
    onSpawnFortification(campState, scaling.hpMult, scaling.atkMult);
    if (hostAuthoritative) {
      onSpawnGarrison(campState);
    }
  }
}

export function tickDestroyedCampRespawns(params: {
  campNodes: ReadonlyMap<number, CampVisualNode>;
  islands: Island[];
  hostAuthoritative: boolean;
  getScaling: () => HuntingScalingFactors;
  onRebuildCamp: (camp: MonsterCampState, hpMult: number, atkMult: number) => void;
  onCampRespawned: (camp: MonsterCampState) => void;
}): boolean {
  let anyChanged = false;
  const { campNodes, islands, hostAuthoritative, getScaling, onRebuildCamp, onCampRespawned } = params;

  for (const node of campNodes.values()) {
    const { camp } = node;
    if (!camp.destroyed || camp.respawnRemainingSec === null) continue;

    if (!hostAuthoritative) {
      camp.respawnRemainingSec = Math.max(1, camp.respawnRemainingSec - 1);
      updateCampHpVisualNode(node);
      continue;
    }

    camp.respawnRemainingSec = Math.max(0, camp.respawnRemainingSec - 1);
    if (camp.respawnRemainingSec <= 0) {
      const tpl = CAMP_RING_TEMPLATES[camp.ring];
      const { hpMult, atkMult } = getScaling();
      const nextHp = Math.round(tpl.coreMaxHp * (1 + camp.clearCount * 0.25) * hpMult);
      applyCampRebuildState(node, islands, {
        level: camp.level + 2,
        coreMaxHp: nextHp,
        coreHp: nextHp,
      });
      onRebuildCamp(camp, hpMult, atkMult);
      anyChanged = true;
      applyCampRebuildAlert(camp);
      onCampRespawned(camp);
    }
    updateCampHpVisualNode(node);
  }

  return anyChanged;
}

