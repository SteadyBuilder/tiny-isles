import { EliteAffixId } from '../types/hunting';
import { RoomDifficultyId } from '../types/room';

export interface EliteAffixDefinition {
  id: EliteAffixId;
  badge: string;
  label: string;
  auraColorHex: number;
  hpMultiplier: number;
  attackMultiplier: number;
  speedMultiplier: number;
  expMultiplier: number;
}

export const ELITE_AFFIXES: Record<EliteAffixId, EliteAffixDefinition> = {
  berserker: {
    id: 'berserker',
    badge: '🔥 광폭',
    label: '광폭한',
    auraColorHex: 0xf97316,
    hpMultiplier: 1.5,
    attackMultiplier: 1.45,
    speedMultiplier: 1.12,
    expMultiplier: 2.2,
  },
  swift: {
    id: 'swift',
    badge: '⚡ 신속',
    label: '신속한',
    auraColorHex: 0x38bdf8,
    hpMultiplier: 1.4,
    attackMultiplier: 1.2,
    speedMultiplier: 1.42,
    expMultiplier: 2.0,
  },
  vampiric: {
    id: 'vampiric',
    badge: '🩸 흡혈',
    label: '흡혈의',
    auraColorHex: 0xe11d48,
    hpMultiplier: 1.65,
    attackMultiplier: 1.25,
    speedMultiplier: 1.05,
    expMultiplier: 2.3,
  },
  arcane_nova: {
    id: 'arcane_nova',
    badge: '💀 자폭',
    label: '비전 폭발',
    auraColorHex: 0xa855f7,
    hpMultiplier: 1.55,
    attackMultiplier: 1.3,
    speedMultiplier: 1.05,
    expMultiplier: 2.4,
  },
  fortified: {
    id: 'fortified',
    badge: '🛡️ 강철',
    label: '불굴의',
    auraColorHex: 0xfbbf24,
    hpMultiplier: 2.0,
    attackMultiplier: 1.2,
    speedMultiplier: 0.95,
    expMultiplier: 2.3,
  },
};

export const ELITE_SPAWN_CHANCE_BY_DIFFICULTY: Record<RoomDifficultyId, number> = {
  normal: 0.14,
  hard: 0.24,
  nightmare: 0.36,
};

export const ELITE_AFFIX_IDS: EliteAffixId[] = [
  'berserker',
  'swift',
  'vampiric',
  'arcane_nova',
  'fortified',
];

export function pickRandomEliteAffix(): EliteAffixDefinition {
  const id = ELITE_AFFIX_IDS[Math.floor(Math.random() * ELITE_AFFIX_IDS.length)] ?? 'berserker';
  return ELITE_AFFIXES[id];
}
