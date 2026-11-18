import type { IWaveSystemContext } from '../../types/waveSystem';
import type { CoreGemSystem } from './CoreGemSystem';
import { MonsterCombatAI } from './MonsterCombatAI';
import type { MonsterVisual } from './MonsterVisualManager';
import type { WaveNetworkSyncBridge } from './WaveNetworkSyncBridge';
import type { WaveThreatTracker } from './WaveThreatTracker';

/**
 * WaveSystem과 MonsterCombatAI 간 전투·동기화·보상 콜백 어댑터를 조립하는 팩토리
 */
export function createWaveCombatAI(params: {
  ctx: IWaveSystemContext;
  coreGemSystem: CoreGemSystem;
  monsters: Map<string, MonsterVisual>;
  isHost: () => boolean;
  syncBridge: WaveNetworkSyncBridge;
  threatTracker: WaveThreatTracker;
}): MonsterCombatAI {
  const { ctx, coreGemSystem, monsters, isHost, syncBridge, threatTracker } = params;
  return new MonsterCombatAI({
    scene: ctx.scene,
    getMonsters: () => monsters,
    getIslands: () => ctx.getIslands(),
    getConstructedBuildings: () => ctx.getConstructedBuildings(),
    updateConstructedBuildingHpBar: (id) => ctx.updateConstructedBuildingHpBar(id),
    getConstructedVisualContainer: (id) => ctx.getConstructedVisualContainer(id),
    destroyConstructedBuilding: (id) => ctx.destroyConstructedBuilding(id),
    onBuildingDamaged: (id, hp, maxHp, damageDelta) =>
      ctx.onBuildingDamaged?.(id, hp, maxHp, damageDelta),
    isHost,
    damageTerritoryCore: (territoryId, dmg, attacker) =>
      coreGemSystem.damageTerritoryCore(territoryId, dmg, attacker, isHost()),
    getLocalPlayerId: () => ctx.getLocalPlayerId(),
    getLocalPlayerPosition: () => ctx.getLocalPlayerPosition(),
    isLocalPlayerFainted: () => ctx.isLocalPlayerFainted(),
    getActivePlayers: ctx.getActivePlayers,
    damageLocalPlayer: (dmg, attacker) => ctx.damageLocalPlayer(dmg, attacker),
    broadcastMonsterPlayerAttack: (payload) => ctx.broadcastMonsterPlayerAttack?.(payload),
    healCampCore: (territoryId, amount) => ctx.healCampCore?.(territoryId, amount),
    projectileSystem: ctx.projectileSystem,
    markLocalMonsterHit: (monsterId) => syncBridge.markLocalHit(monsterId),
    onMonsterDamaged: () => syncBridge.scheduleDeltaSyncFlush(() => monsters),
    onMonsterHitImpact: (opts, restoreTint) => ctx.onMonsterHitImpact?.(opts, restoreTint),
    onMonsterKilled: (x, y, isBoss, expReward, isCampMonster, meta) => {
      if (meta?.monsterId) {
        syncBridge.recordKill({
          id: meta.monsterId,
          x: Math.round(x),
          y: Math.round(y),
          killerId: meta.killerId,
          isBoss,
          isElite: meta.isElite,
          isCampMonster,
          isFieldMonster: Boolean(meta.isFieldMonster),
          campRing: meta.campRing,
          eliteTier: meta.eliteTier,
          expReward,
          bonusMultiplier: meta.bonusMultiplier ?? threatTracker.getActiveBonusMultiplier(),
        });
      }
      ctx.onMonsterKilledReward?.(x, y, isBoss, expReward, isCampMonster, meta);
    },
    showFloatingText: (x, y, text, color) => ctx.showFloatingText(x, y, text, color),
    shakeObject: (target) => ctx.shakeObject(target),
    playExplosionAt: (x, y) => ctx.playExplosionAt(x, y),
    addRewardResources: (w, s, g) => ctx.addRewardResources(w, s, g),
    broadcastMonsterHit: (payload) => ctx.broadcastMonsterHit?.(payload),
  });
}
