import Phaser from 'phaser';
import { ACTIVE_WAVE_ACCELERATION_CONFIG } from '../../../data/worldRules';
import { sound } from '../../../lib/sound';
import { Entity, Inventory, Island, PlayerAction } from '../../../types/game';
import { getIslandOrigin, getTerritoryCorePos } from '../../constants';
import { GameEvents } from '../../events/gameEvents';
import { MonsterVisual } from '../../systems/WaveSystem';
import { EntityVisual } from '../renderers/ResourceEntityRenderer';

export interface IPlayerInteractionContext {
  scene: Phaser.Scene;
  getPlayerPosition: () => { x: number; y: number };
  getPlayerName: () => string;
  getCurrentAction: () => PlayerAction;
  playPlayerAnimation: (action: PlayerAction) => void;
  markInteractTime: (now: number) => void;
  getIslands: () => Island[];
  getInventory: () => Inventory;
  spendInventory: (wood: number, stone: number, gold: number) => void;
  addHarvestedResource: (resKey: keyof Inventory, amount: number) => void;
  getMonsterVisuals: () => Map<string, MonsterVisual>;
  damageMonster: (monsterId: string, damage: number, attackerName: string) => void;
  findNearestEntityVisual: (x: number, y: number, maxDist: number) => EntityVisual | null;
  updateEntityHpBar: (entityId: string) => void;
  removeAndRespawnEntity: (ent: Entity) => void;
  reduceWaveCooldown: (seconds: number) => void;
  broadcastEntityHit: (entityId: string, damage: number) => void;
  unlockIslandLocally: (islandId: number, unlockedBy: string, isLocalTrigger: boolean) => void;
  updateCoreGemVisual: (territoryId: number) => void;
  saveWorldState: (immediate?: boolean) => void;
  emitWorldStateToReact: (immediate?: boolean) => void;
  shakeObject: (target: Phaser.GameObjects.Container) => void;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
}

/**
 * 플레이어 상호작용(마물 타격, 영지 개척 제단, 자원 채집, 코어 보석 관리) 전담 컨트롤러
 */
export class PlayerInteractionController {
  private ctx: IPlayerInteractionContext;

  constructor(ctx: IPlayerInteractionContext) {
    this.ctx = ctx;
  }

  public tryInteract(): void {
    const { scene } = this.ctx;
    this.ctx.markInteractTime(scene.time.now);
    const { x: px, y: py } = this.ctx.getPlayerPosition();

    // 1. 마물 직접 타격 (전투 최우선!)
    let nearestMonster: MonsterVisual | null = null;
    let minMonDist = 115;
    for (const mv of this.ctx.getMonsterVisuals().values()) {
      const d = Math.hypot(px - mv.monster.x, py - mv.monster.y);
      if (d < minMonDist) {
        minMonDist = d;
        nearestMonster = mv;
      }
    }

    if (nearestMonster) {
      this.ctx.playPlayerAnimation('axe');
      scene.time.delayedCall(260, () => {
        if (this.ctx.getCurrentAction() === 'axe') {
          this.ctx.playPlayerAnimation('idle');
        }
      });
      sound.playChop();
      this.ctx.damageMonster(nearestMonster.monster.id, 35, this.ctx.getPlayerName());
      return;
    }

    // 2. 미점령 영지 개척 제단 확인
    const islands = this.ctx.getIslands();
    const inventory = this.ctx.getInventory();
    for (const isl of islands) {
      if (!isl.unlocked) {
        const origin = getIslandOrigin(isl.gridX, isl.gridY);
        const signX = origin.x + 320;
        const signY = origin.y + 320;
        const dist = Math.hypot(px - signX, py - signY);

        if (dist < 260) {
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

    // 3. 자원 엔티티 채집
    const nearestVisual = this.ctx.findNearestEntityVisual(px, py, 95);
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
        this.ctx.reduceWaveCooldown(ACTIVE_WAVE_ACCELERATION_CONFIG.gatherCooldownReductionSec);
      }
      return;
    }

    // 4. 점령한 땅의 코어 보석 근처에서 상호작용 시 코어 회복 및 마을/건설 창 열기
    for (const isl of islands) {
      if (!isl.unlocked) continue;
      const cPos = getTerritoryCorePos(isl.gridX, isl.gridY);
      if (Math.hypot(px - cPos.x, py - cPos.y) < 95) {
        sound.playUnlock();
        if (isl.coreHp < isl.coreMaxHp) {
          isl.coreHp = Math.min(isl.coreMaxHp, isl.coreHp + 15);
          this.ctx.updateCoreGemVisual(isl.id);
          this.ctx.saveWorldState(false);
          this.ctx.emitWorldStateToReact(false);
        }
        this.ctx.showFloatingText(cPos.x, cPos.y - 60, `💎 [${isl.name}] 마을/건설 관리`, '#38bdf8');
        GameEvents.emit('open-village-modal', isl.id);
        return;
      }
    }

    this.ctx.playPlayerAnimation('axe');
    scene.time.delayedCall(280, () => {
      if (this.ctx.getCurrentAction() === 'axe') {
        this.ctx.playPlayerAnimation('idle');
      }
    });
  }
}
