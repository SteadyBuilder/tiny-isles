import Phaser from 'phaser';
import { SKILL_FX_STYLE_CONFIG } from '../../../data/combatFeedbackConfig';
import { Inventory, PlayerClassId } from '../../../types/game';
import { MetaBonusSummary } from '../../../types/metaProgression';
import { PlayerHealthSystem } from '../../systems/PlayerHealthSystem';
import { PlayerProgressionSystem } from '../../systems/PlayerProgressionSystem';
import { ProjectileSystem } from '../../systems/ProjectileSystem';
import { WaveSystem } from '../../systems/WaveSystem';
import { checkJobHallProximity } from '../../utils/jobHallUtils';
import { checkToolShopProximity } from '../../utils/toolShopUtils';
import { CombatFeedbackRenderer } from '../renderers/CombatFeedbackRenderer';
import { PlayerCelebrationEffects } from '../renderers/PlayerCelebrationEffects';
import { SkillEffectsRenderer } from '../renderers/SkillEffectsRenderer';
import { WorldEffectsRenderer } from '../renderers/WorldEffectsRenderer';

export interface IWorldPlayerSystemsHost {
  scene: Phaser.Scene;
  isSceneAlive: () => boolean;
  getPlayerId: () => string;
  getPlayerName: () => string;
  getPlayerPosition: () => { x: number; y: number };
  getPlayerDirection?: () => 'left' | 'right';
  getMetaBonuses?: () => MetaBonusSummary;
  triggerSkillSurge?: (dirX: number, dirY: number, speedPx: number, durationMs: number) => void;
  respawnPlayerAt: (x: number, y: number) => void;
  onPlayerFaintedVisual: (fainted: boolean) => void;
  onPlayerHitVisual: () => void;
  onPlayerCastVisual?: (durationMs?: number) => void;
  onPlayerClassVisualChanged?: (classId: PlayerClassId) => void;
  getInventory: () => Inventory;
  spendResources: (wood: number, stone: number, gold: number) => void;
  addResources: (wood: number, stone: number, gold: number) => void;
  getConstructedBuildings: () => import('../../../types/game').ConstructedBuilding[];
  effectsRenderer: WorldEffectsRenderer;
  combatFeedbackRenderer: CombatFeedbackRenderer;
  skillEffectsRenderer: SkillEffectsRenderer;
  celebrationEffects: PlayerCelebrationEffects;
}

/**
 * PlayerHealthSystem & PlayerProgressionSystem 조립 팩토리
 */
export function createWorldPlayerSystems(
  host: IWorldPlayerSystemsHost,
  projectileSystem: ProjectileSystem,
  deps: {
    getWaveSystem: () => WaveSystem | undefined;
    tryDamageCampCoreInRadius: (x: number, y: number, r: number, dmg: number) => boolean;
  }
): {
  playerHealthSystem: PlayerHealthSystem;
  playerProgressionSystem: PlayerProgressionSystem;
} {
  let playerProgressionSystem!: PlayerProgressionSystem;

  const playerHealthSystem = new PlayerHealthSystem({
    scene: host.scene,
    isSceneAlive: host.isSceneAlive,
    getPlayerPosition: host.getPlayerPosition,
    respawnPlayerAt: host.respawnPlayerAt,
    onPlayerFaintedVisual: host.onPlayerFaintedVisual,
    onPlayerHitVisual: host.onPlayerHitVisual,
    onPlayerDamagedShake: () => host.combatFeedbackRenderer.triggerPlayerDamagedShake(),
    onPlayerHealed: (px, py) => host.effectsRenderer.playHealEffectAt(px, py),
    getDamageReductionPercent: () => playerProgressionSystem?.getDamageReductionPercent() ?? 0,
    onThornsReflect: (px, py) => {
      const thorns = playerProgressionSystem?.getThornsDamage() ?? 0;
      const ws = deps.getWaveSystem();
      if (thorns <= 0 || !ws) return;
      const mv = ws.getSpatialGrid().findNearestInRadius(px, py, 115);
      if (!mv) return;
      ws.damageMonster(
        mv.monster.id,
        thorns,
        `${host.getPlayerName()} (가시반사)`,
        false,
        host.getPlayerId()
      );
      host.effectsRenderer.showFloatingText(
        mv.monster.x,
        mv.monster.y - 30,
        `🛡️ 반사 -${thorns}`,
        '#34d399'
      );
    },
    showFloatingText: (x, y, text, color) => host.effectsRenderer.showFloatingText(x, y, text, color),
  });

  playerProgressionSystem = new PlayerProgressionSystem({
    scene: host.scene,
    getPlayerId: host.getPlayerId,
    getPlayerName: host.getPlayerName,
    getPlayerPosition: host.getPlayerPosition,
    getPlayerDirection: host.getPlayerDirection,
    getMetaBonuses: host.getMetaBonuses,
    isPlayerFainted: () => playerHealthSystem.isFainted(),
    getGold: () => host.getInventory().gold,
    spendGold: (amount) => host.spendResources(0, 0, amount),
    addGold: (amount) => host.addResources(0, 0, amount),
    onMaxHpChanged: (newMaxHp, healDelta) => playerHealthSystem.setMaxHp(newMaxHp, healDelta),
    healPlayer: (amount) => playerHealthSystem.healPlayer(amount),
    onClassChangedVisual: (classId) => host.onPlayerClassVisualChanged?.(classId),
    getMonsterVisuals: () => deps.getWaveSystem()?.getMonsterVisuals() ?? new Map(),
    queryMonstersInRadius: (x, y, r) => deps.getWaveSystem()?.getSpatialGrid().queryRadius(x, y, r) ?? [],
    damageMonster: (id, dmg, attacker, attackerId, hitMeta) =>
      deps.getWaveSystem()?.damageMonster(id, dmg, attacker, false, attackerId, hitMeta),
    tryDamageCampCoreInRadius: deps.tryDamageCampCoreInRadius,
    projectileSystem,
    showFloatingText: (x, y, text, color) => host.effectsRenderer.showFloatingText(x, y, text, color),
    playExplosionAt: (x, y) => host.effectsRenderer.playExplosionAt(x, y),
    playSkillEffect: (fxCtx) => {
      const chargeMs = SKILL_FX_STYLE_CONFIG[fxCtx.classId].chargeDurationMs;
      if (chargeMs > 0) {
        host.onPlayerCastVisual?.(chargeMs);
      }
      host.skillEffectsRenderer.playClassSkill(fxCtx);
    },
    triggerSkillSurge: host.triggerSkillSurge,
    getJobHallStatus: () => {
      const pos = host.getPlayerPosition();
      const status = checkJobHallProximity(pos.x, pos.y, host.getConstructedBuildings());
      return { hasBuilt: status.hasBuilt, isNear: status.isNear };
    },
    getToolShopStatus: () => {
      const pos = host.getPlayerPosition();
      const status = checkToolShopProximity(pos.x, pos.y, host.getConstructedBuildings());
      return { hasBuilt: status.hasBuilt, isNear: status.isNear };
    },
    getPlayerHpState: () => playerHealthSystem.getState(),
    playLevelUpEffect: (x, y, level, delayMs) =>
      host.celebrationEffects.playLevelUpEffect(x, y, level, delayMs),
    playClassAdvancementEffect: (x, y, classId) =>
      host.celebrationEffects.playClassAdvancementEffect(x, y, classId),
  });

  return { playerHealthSystem, playerProgressionSystem };
}
