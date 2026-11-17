import Phaser from 'phaser';
import { PLAYER_COMBAT_CONFIG, THREAT_WAVE_CONFIG } from '../../../data/worldRules';
import { sound } from '../../../lib/sound';
import {
  ConstructedBuilding,
  Entity,
  Inventory,
  Island,
  PlayerAction,
  PlayerClassDefinition,
} from '../../../types/game';
import {
  TERRITORY_CENTER_X,
  TERRITORY_CENTER_Y,
  getIslandOrigin,
} from '../../constants';
import { GameEvents } from '../../events/gameEvents';
import { canClaimTerritory } from '../../territoryAccessRules';
import { checkJobHallProximity } from '../../utils/jobHallUtils';
import { checkToolShopProximity } from '../../utils/toolShopUtils';
import { ProjectileSystem } from '../../systems/ProjectileSystem';
import { MonsterVisual } from '../../systems/WaveSystem';
import { EntityVisual } from '../renderers/ResourceEntityRenderer';

export interface IPlayerInteractionContext {
  scene: Phaser.Scene;
  getPlayerId: () => string;
  getPlayerPosition: () => { x: number; y: number };
  getPlayerName: () => string;
  isPlayerFainted: () => boolean;
  getCurrentAction: () => PlayerAction;
  playPlayerAnimation: (action: PlayerAction) => void;
  markInteractTime: (now: number) => void;
  getIslands: () => Island[];
  getConstructedBuildings?: () => ConstructedBuilding[];
  getInventory: () => Inventory;
  spendInventory: (wood: number, stone: number, gold: number) => void;
  addHarvestedResource: (resKey: keyof Inventory, amount: number) => void;
  getMonsterVisuals: () => Map<string, MonsterVisual>;
  damageMonster: (
    monsterId: string,
    damage: number,
    attackerName: string,
    attackerId: string,
    hitMeta?: { isSkill?: boolean; isCrit?: boolean }
  ) => void;
  getPlayerClassDef?: () => PlayerClassDefinition;
  getPlayerAttackDamage?: () => number;
  getEffectiveAttackCooldownMs?: () => number;
  getEffectiveAttackRange?: () => number;
  rollNormalAttackWithAffixes?: (baseDamage: number) => {
    finalDamage: number;
    isCrit: boolean;
    lifestealHeal: number;
  };
  healPlayer?: (amount: number) => void;
  tryAttackCampCore?: (px: number, py: number, rangePx: number, damage: number) => boolean;
  projectileSystem?: ProjectileSystem;
  findGatherableEntityVisual: (x: number, y: number) => EntityVisual | null;
  updateEntityHpBar: (entityId: string) => void;
  removeAndRespawnEntity: (ent: Entity) => void;
  addThreat: (amount: number) => void;
  emitThreatOrb?: (worldX: number, worldY: number, amount: number) => void;
  broadcastEntityHit: (entityId: string, damage: number) => void;
  unlockIslandLocally: (islandId: number, unlockedBy: string, isLocalTrigger: boolean) => void;
  updateCoreGemVisual: (territoryId: number) => void;
  saveWorldState: (immediate?: boolean) => void;
  emitWorldStateToReact: (immediate?: boolean) => void;
  shakeObject: (target: Phaser.GameObjects.Container) => void;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
}

/**
 * 플레이어 상호작용(전직별 평타/원거리·광역 공격, 몬스터 부락 본진 타격, 전직소 이용, 자원 채집, 건설) 전담 컨트롤러
 */
export class PlayerInteractionController {
  private ctx: IPlayerInteractionContext;
  private lastCombatAttackTime = 0;

  constructor(ctx: IPlayerInteractionContext) {
    this.ctx = ctx;
  }

  private dealNormalAttackHit(targetId: string, baseDamage: number, tx: number, ty: number): void {
    const rolled = this.ctx.rollNormalAttackWithAffixes?.(baseDamage) ?? {
      finalDamage: baseDamage,
      isCrit: false,
      lifestealHeal: 0,
    };
    this.ctx.damageMonster(
      targetId,
      rolled.finalDamage,
      this.ctx.getPlayerName(),
      this.ctx.getPlayerId(),
      { isCrit: rolled.isCrit }
    );
    if (rolled.isCrit) {
      this.ctx.showFloatingText(tx, ty - 38, '💥 치명타!', '#fde047');
    }
    if (rolled.lifestealHeal > 0) {
      this.ctx.healPlayer?.(rolled.lifestealHeal);
    }
  }

  public tryInteract(): void {
    if (this.ctx.isPlayerFainted()) return;

    const { scene } = this.ctx;
    const now = scene.time.now;
    this.ctx.markInteractTime(now);
    const { x: px, y: py } = this.ctx.getPlayerPosition();

    const classDef = this.ctx.getPlayerClassDef?.();
    const baseRange =
      this.ctx.getEffectiveAttackRange?.() ??
      classDef?.attackRange ??
      PLAYER_COMBAT_CONFIG.meleeRangeRegular;
    const attackDamage = this.ctx.getPlayerAttackDamage?.() ?? PLAYER_COMBAT_CONFIG.meleeDamage;
    const attackCooldownMs =
      this.ctx.getEffectiveAttackCooldownMs?.() ?? classDef?.attackCooldownMs ?? 320;

    // 1. 마물 타격 (전직 클래스별 사거리·공속·치명타·흡혈·원거리·광역·관통 반영)
    const targetsInRange: Array<{ mv: MonsterVisual; dist: number }> = [];
    for (const mv of this.ctx.getMonsterVisuals().values()) {
      const range = mv.monster.isBoss
        ? Math.max(baseRange, PLAYER_COMBAT_CONFIG.meleeRangeBoss)
        : baseRange;
      const d = Math.hypot(px - mv.monster.x, py - mv.monster.y);
      if (d <= range) {
        targetsInRange.push({ mv, dist: d });
      }
    }
    targetsInRange.sort((a, b) => a.dist - b.dist);

    if (targetsInRange.length > 0) {
      if (now - this.lastCombatAttackTime < attackCooldownMs) return;
      this.lastCombatAttackTime = now;

      this.ctx.playPlayerAnimation('axe');
      scene.time.delayedCall(250, () => {
        if (this.ctx.getCurrentAction() === 'axe') {
          this.ctx.playPlayerAnimation('idle');
        }
      });

      const primary = targetsInRange[0].mv;
      if (classDef?.isRanged && this.ctx.projectileSystem) {
        if (classDef.id === 'archmage') sound.playMagicCast();
        else sound.playBowRelease();
        const targetId = primary.monster.id;
        const hitX = primary.monster.x;
        const hitY = primary.monster.y;
        const isMage = classDef.id === 'archmage';

        this.ctx.projectileSystem.fireProjectile({
          startX: px,
          startY: py - 20,
          targetX: hitX,
          targetY: hitY,
          durationMs: 165,
          tint: isMage ? undefined : 0x38bdf8,
          size: isMage ? 46 : 34,
          isMagic: isMage,
          onArrive: () => {
            if (isMage) {
              for (const mv of this.ctx.getMonsterVisuals().values()) {
                if (Math.hypot(mv.monster.x - hitX, mv.monster.y - hitY) <= 95) {
                  this.dealNormalAttackHit(
                    mv.monster.id,
                    attackDamage,
                    mv.monster.x,
                    mv.monster.y
                  );
                }
              }
            } else {
              this.dealNormalAttackHit(targetId, attackDamage, hitX, hitY);
            }
          },
        });
      } else {
        if (classDef?.id === 'lancer') sound.playLanceThrust();
        else sound.playSwordSlash();
        const maxTargets = classDef?.isSplash || classDef?.isPiercing ? 4 : 1;
        for (let i = 0; i < Math.min(maxTargets, targetsInRange.length); i++) {
          const mv = targetsInRange[i].mv;
          this.dealNormalAttackHit(mv.monster.id, attackDamage, mv.monster.x, mv.monster.y);
        }
      }
      return;
    }

    // 1-B. 사냥 특화 모드: 몬스터 부락 본진 건물 직접 타격
    if (now - this.lastCombatAttackTime >= attackCooldownMs) {
      if (this.ctx.tryAttackCampCore?.(px, py, baseRange, attackDamage)) {
        this.lastCombatAttackTime = now;
        this.ctx.playPlayerAnimation('axe');
        scene.time.delayedCall(250, () => {
          if (this.ctx.getCurrentAction() === 'axe') {
            this.ctx.playPlayerAnimation('idle');
          }
        });
        sound.playChop();
        return;
      }
    }

    // 2. 건설된 '왕국 전직소(job_hall)' 또는 '도구 상점(tool_shop)' 앞에서 상호작용 시 모달 열기
    const buildings = this.ctx.getConstructedBuildings?.() ?? [];
    const jobHallStatus = checkJobHallProximity(px, py, buildings);
    if (jobHallStatus.isNear) {
      sound.playUnlock();
      GameEvents.emit('open-job-hall-modal');
      return;
    }

    const toolShopStatus = checkToolShopProximity(px, py, buildings);
    if (toolShopStatus.isNear) {
      sound.playUnlock();
      GameEvents.emit('open-tool-shop-modal');
      return;
    }

    // 3. 미점령 영지 개척 제단 확인 (몬스터 부락은 제외)
    const islands = this.ctx.getIslands();
    const inventory = this.ctx.getInventory();
    for (const isl of islands) {
      if (!isl.unlocked && !isl.isMonsterCamp) {
        const origin = getIslandOrigin(isl.gridX, isl.gridY);
        const signX = origin.x + TERRITORY_CENTER_X;
        const signY = origin.y + TERRITORY_CENTER_Y;
        const dist = Math.hypot(px - signX, py - signY);

        if (dist < 260) {
          const claimCheck = canClaimTerritory(islands, isl, this.ctx.getPlayerId());
          if (!claimCheck.allowed) {
            const reason = claimCheck.reason || '1인당 1곳만 점령할 수 있습니다.';
            this.ctx.showFloatingText(signX, signY - 40, reason, '#f87171');
            GameEvents.emit('game-alert', reason);
            return;
          }

          if (
            inventory.wood >= isl.costWood &&
            inventory.stone >= isl.costStone &&
            inventory.gold >= isl.costGold
          ) {
            this.ctx.spendInventory(isl.costWood, isl.costStone, isl.costGold);
            this.ctx.unlockIslandLocally(isl.id, this.ctx.getPlayerName(), true);
            return;
          } else {
            this.ctx.showFloatingText(
              signX,
              signY - 40,
              `자원 부족! (🪵${isl.costWood} 🪨${isl.costStone}${isl.costGold > 0 ? ` 🪙${isl.costGold}` : ''})`,
              '#ff5252'
            );
            return;
          }
        }
      }
    }

    // 4. 자원 엔티티 채집
    const nearestVisual = this.ctx.findGatherableEntityVisual(px, py);
    if (nearestVisual) {
      const ent = nearestVisual.entity;

      if (ent.type === 'sheep') {
        sound.playClick();
        this.ctx.shakeObject(nearestVisual.container);
        this.ctx.showFloatingText(ent.x + 16, ent.y - 20, '🐑 음메에~ ❤️', '#f472b6');
        return;
      }

      const toolAction: PlayerAction = ent.type === 'tree' ? 'axe' : 'pickaxe';
      this.ctx.playPlayerAnimation(toolAction);
      scene.time.delayedCall(280, () => {
        if (this.ctx.getCurrentAction() === toolAction) {
          this.ctx.playPlayerAnimation('idle');
        }
      });

      const damage = 1;
      ent.hp -= damage;
      this.ctx.shakeObject(nearestVisual.container);
      this.ctx.updateEntityHpBar(ent.id);

      if (ent.type === 'tree') sound.playChop();
      else sound.playMine();

      const resKey: keyof Inventory =
        ent.type === 'tree' ? 'wood' : ent.type === 'gold_rock' ? 'gold' : 'stone';
      const harvestAmount = 1;
      this.ctx.addHarvestedResource(resKey, harvestAmount);

      const icon =
        resKey === 'wood'
          ? `🪵 +${harvestAmount}`
          : resKey === 'gold'
          ? `🪙 +${harvestAmount}`
          : `🪨 +${harvestAmount}`;
      const color = resKey === 'wood' ? '#8bc34a' : resKey === 'gold' ? '#ffd700' : '#cfd8dc';
      this.ctx.showFloatingText(ent.x + 16, ent.y, icon, color);

      this.ctx.broadcastEntityHit(ent.id, damage);

      if (ent.hp <= 0) {
        sound.playBreak();
        this.ctx.removeAndRespawnEntity(ent);
        this.ctx.emitThreatOrb?.(ent.x, ent.y, THREAT_WAVE_CONFIG.gatherThreatGain);
        this.ctx.addThreat(THREAT_WAVE_CONFIG.gatherThreatGain);
      }
      return;
    }

    this.ctx.playPlayerAnimation('axe');
    scene.time.delayedCall(280, () => {
      if (this.ctx.getCurrentAction() === 'axe') {
        this.ctx.playPlayerAnimation('idle');
      }
    });
  }
}
