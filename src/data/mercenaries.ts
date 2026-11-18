import { MercenaryConfig, MercenaryId } from '../types/mercenary';

export interface MercenaryGuildConfig {
  interactionRadiusPx: number;
  maxMercenariesPerGuild: number;
  patrolRadiusPx: number;
  aggroRadiusPx: number;
  monsterRetaliateRadiusPx: number;
  monsterRetaliateIntervalMs: number;
}

/**
 * 용병 길드 및 용병 고용 밸런스 설정 (데이터 분리)
 */
export const MERCENARY_GUILD_CONFIG: MercenaryGuildConfig = {
  interactionRadiusPx: 155,
  maxMercenariesPerGuild: 4,
  patrolRadiusPx: 260,
  aggroRadiusPx: 380,
  monsterRetaliateRadiusPx: 72,
  monsterRetaliateIntervalMs: 1100,
};

/**
 * 용병 길드에서 고용 가능한 용병 도감
 */
export const MERCENARY_CATALOG: MercenaryConfig[] = [
  {
    id: 'merc_warrior',
    name: '용병 전사',
    roleLabel: '근접 탱커',
    icon: '⚔️',
    description: '튼튼한 체력으로 길드와 영지 앞선을 지키며 근접 마물을 막아냅니다.',
    costMeat: 4,
    costGold: 2,
    maxHp: 240,
    attack: 26,
    range: 64,
    attackCooldownMs: 950,
    speed: 125,
    isRanged: false,
    spritePrefix: 'yellowWarrior',
    displaySize: 136,
  },
  {
    id: 'merc_archer',
    name: '용병 궁수',
    roleLabel: '원거리 딜러',
    icon: '🏹',
    description: '먼 거리에서 화살을 쏘아 침입하는 마물과 원거리 적을 요격합니다.',
    costMeat: 4,
    costGold: 3,
    maxHp: 140,
    attack: 22,
    range: 260,
    attackCooldownMs: 900,
    speed: 115,
    isRanged: true,
    spritePrefix: 'yellowArcher',
    displaySize: 136,
  },
  {
    id: 'merc_lancer',
    name: '용병 창병',
    roleLabel: '돌격 창기사',
    icon: '🔱',
    description: '긴 창과 기동력으로 마물에게 강력한 일격을 가하는 정예 용병입니다.',
    costMeat: 6,
    costGold: 4,
    maxHp: 190,
    attack: 34,
    range: 86,
    attackCooldownMs: 1050,
    speed: 140,
    isRanged: false,
    spritePrefix: 'yellowLancer',
    displaySize: 156,
  },
];

export function getMercenaryConfig(id: MercenaryId): MercenaryConfig {
  return MERCENARY_CATALOG.find((m) => m.id === id) ?? MERCENARY_CATALOG[0];
}
