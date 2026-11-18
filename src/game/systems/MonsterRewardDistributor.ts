import { FIELD_MONSTER_CONFIG } from '../../data/fieldMonsters';
import { POTION_DEFINITIONS, rollMonsterLoot } from '../../data/potions';
import { MONSTER_KILL_REWARDS } from '../../data/waves';
import { MONSTER_SYNC_CONFIG, THREAT_WAVE_CONFIG } from '../../data/worldRules';
import { sound } from '../../lib/sound';
import { EquipmentItem } from '../../types/game';
import { FieldEliteTier, PotionId } from '../../types/hunting';
import { MonsterKillSyncPayload } from '../../types/monsterSync';
import { RoomDifficultyId } from '../../types/room';
import { GameEvents } from '../events/gameEvents';
import { MonsterKilledMeta } from './MonsterCombatAI';

export interface MonsterRewardContext {
  isHuntingMode: () => boolean;
  getDifficultyId: () => RoomDifficultyId;
  getLocalPlayerId: () => string;
  getLocalPlayerPosition: () => { x: number; y: number };
  addThreat: (amount: number) => void;
  emitThreatOrb: (worldX: number, worldY: number, amount: number) => void;
  addResources: (wood: number, stone: number, gold: number) => void;
  gainExp: (exp: number) => void;
  grantRewardItem: (item: EquipmentItem) => void;
  grantPotion: (potionId: PotionId, count: number) => number;
  playChestDrop: (
    x: number,
    y: number,
    item: EquipmentItem,
    onOpened: (openedItem: EquipmentItem) => void
  ) => void;
  playLootIconDrop: (x: number, y: number, textureKey: string, glowColorHex: string) => void;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
}

function distributeLootDrops(
  ctx: MonsterRewardContext,
  params: {
    x: number;
    y: number;
    isBoss: boolean;
    isElite: boolean;
    campRing?: 1 | 2 | 3 | 4;
    eliteTier?: FieldEliteTier;
  }
): void {
  const lootResults = rollMonsterLoot({
    ring: params.campRing ?? 2,
    isElite: params.isElite,
    isBoss: params.isBoss,
    isHuntingMode: ctx.isHuntingMode(),
    difficultyId: ctx.getDifficultyId(),
    eliteTier: params.eliteTier,
  });

  for (const loot of lootResults) {
    if (loot.kind === 'equipment') {
      ctx.playChestDrop(params.x, params.y, loot.item, (openedItem) => {
        ctx.grantRewardItem(openedItem);
        GameEvents.emit('game-alert', `💎 전리품 드랍! [${openedItem.name}] 획득!`);
      });
    } else if (loot.kind === 'potion') {
      const added = ctx.grantPotion(loot.potionId, loot.count);
      const def = POTION_DEFINITIONS[loot.potionId];
      if (added > 0 && def) {
        sound.playGemDrop();
        ctx.playLootIconDrop(params.x, params.y, def.textureKey, '#4ade80');
        ctx.showFloatingText(params.x, params.y - 26, `${def.name} +${added}`, '#4ade80');
        GameEvents.emit('game-alert', `🧪 몬스터가 [${def.name}]을(를) 드랍했습니다!`);
      }
    } else if (loot.kind === 'resource') {
      const { wood, stone, gold, label, icon, textureKey } = loot.bundle;
      ctx.addResources(wood, stone, gold);
      const parts: string[] = [];
      if (wood > 0) parts.push(`🪵+${wood}`);
      if (stone > 0) parts.push(`🪨+${stone}`);
      if (gold > 0) parts.push(`🪙+${gold}`);
      if (parts.length > 0) {
        ctx.playLootIconDrop(params.x, params.y, textureKey, '#fbbf24');
        ctx.showFloatingText(params.x, params.y - 12, parts.join(' '), '#fde047');
        if (params.isBoss || params.isElite) {
          GameEvents.emit('game-alert', `${icon} ${label} 획득! (${parts.join(' ')})`);
        }
      }
    }
  }
}

/**
 * 호스트 처치 시 위협도 상승 + 참여 플레이어 기준 경험치/전리품 지급
 */
export function distributeHostMonsterKillReward(
  ctx: MonsterRewardContext,
  x: number,
  y: number,
  isBoss: boolean,
  expReward: number,
  isCampMonster: boolean,
  meta?: MonsterKilledMeta
): void {
  if (isCampMonster || !ctx.isHuntingMode()) {
    ctx.addThreat(THREAT_WAVE_CONFIG.huntThreatGain);
    ctx.emitThreatOrb(x, y, THREAT_WAVE_CONFIG.huntThreatGain);
  } else if (meta?.isFieldMonster) {
    const fieldGain = FIELD_MONSTER_CONFIG.threatGainOnKill;
    ctx.addThreat(fieldGain);
    ctx.emitThreatOrb(x, y, fieldGain);
  }

  if (meta?.isParticipant === false) return;

  ctx.gainExp(expReward);
  distributeLootDrops(ctx, {
    x,
    y,
    isBoss,
    isElite: Boolean(meta?.isElite),
    campRing: meta?.campRing,
    eliteTier: meta?.eliteTier,
  });
}

/**
 * 게스트가 호스트로부터 처치 델타 패킷을 수신했을 때 처치 기여/주변 협동 범위 내면 개인 보상·전리품 지급
 */
export function distributeRemoteMonsterKillReward(
  ctx: MonsterRewardContext,
  kill: MonsterKillSyncPayload
): void {
  const localId = ctx.getLocalPlayerId();
  const localPos = ctx.getLocalPlayerPosition();
  const isParticipant =
    !kill.killerId ||
    kill.killerId === localId ||
    kill.isBoss ||
    Math.hypot(localPos.x - kill.x, localPos.y - kill.y) <=
      MONSTER_SYNC_CONFIG.coopKillShareRadiusPx;

  if (!isParticipant) return;

  const rewardTier = kill.isBoss ? MONSTER_KILL_REWARDS.boss : MONSTER_KILL_REWARDS.regular;
  const rewardWood = Math.round(rewardTier.wood * kill.bonusMultiplier);
  const rewardStone = Math.round(rewardTier.stone * kill.bonusMultiplier);
  const rewardGold = Math.round(rewardTier.gold * kill.bonusMultiplier);

  ctx.addResources(rewardWood, rewardStone, rewardGold);
  sound.playMonsterDeath();
  const rewardText = kill.isBoss
    ? `🏆 보스 처치! (+🪵${rewardWood} +🪨${rewardStone} +🪙${rewardGold} +✨${kill.expReward}EXP)`
    : `⚔️ +🪵${rewardWood} +🪨${rewardStone} +🪙${rewardGold} (+${kill.expReward}EXP)`;
  ctx.showFloatingText(kill.x, kill.y - 45, rewardText, '#4ade80');
  ctx.gainExp(kill.expReward);

  distributeLootDrops(ctx, {
    x: kill.x,
    y: kill.y,
    isBoss: kill.isBoss,
    isElite: kill.isElite,
    campRing: kill.campRing,
    eliteTier: kill.eliteTier,
  });
}
