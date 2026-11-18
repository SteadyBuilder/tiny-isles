export type MercenaryId = 'merc_warrior' | 'merc_archer' | 'merc_lancer';

export interface MercenaryConfig {
  id: MercenaryId;
  name: string;
  roleLabel: string;
  icon: string;
  description: string;
  costMeat: number;
  costGold: number;
  maxHp: number;
  attack: number;
  range: number;
  attackCooldownMs: number;
  speed: number;
  isRanged: boolean;
  spritePrefix: 'yellowWarrior' | 'yellowArcher' | 'yellowLancer';
  displaySize: number;
}

export interface MercenaryUnit {
  id: string;
  guildId: string;
  territoryId: number;
  mercenaryId: MercenaryId;
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  range: number;
  attackCooldownMs: number;
  speed: number;
  isRanged: boolean;
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  direction: 'left' | 'right';
}
