import { EliteAffixId, FieldEliteTier } from '../types/hunting';
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

export interface FieldEliteTierProfile {
  tier: FieldEliteTier;
  badgePrefix: string;
  hpScale: number;
  attackScale: number;
  speedScale: number;
  expScale: number;
}

export const FIELD_ELITE_TIER_PROFILES: Record<FieldEliteTier, FieldEliteTierProfile> = {
  none: {
    tier: 'none',
    badgePrefix: '',
    hpScale: 1,
    attackScale: 1,
    speedScale: 1,
    expScale: 1,
  },
  weakened: {
    tier: 'weakened',
    badgePrefix: '☆ 약화 정예',
    hpScale: 0.72,
    attackScale: 0.72,
    speedScale: 0.94,
    expScale: 0.85,
  },
  standard: {
    tier: 'standard',
    badgePrefix: '★ 야생 정예',
    hpScale: 1.0,
    attackScale: 1.0,
    speedScale: 1.0,
    expScale: 1.0,
  },
  empowered: {
    tier: 'empowered',
    badgePrefix: '👑 강화 필드 정예',
    hpScale: 1.28,
    attackScale: 1.22,
    speedScale: 1.06,
    expScale: 1.35,
  },
};

export const ELITE_AFFIXES: Record<EliteAffixId, EliteAffixDefinition> = {
  berserker: {
    id: 'berserker',
    badge: '🔥 광폭',
    label: '광폭한',
    auraColorHex: 0xf97316,
    hpMultiplier: 1.75,
    attackMultiplier: 1.55,
    speedMultiplier: 1.15,
    expMultiplier: 2.4,
  },
  swift: {
    id: 'swift',
    badge: '⚡ 신속',
    label: '신속한',
    auraColorHex: 0x38bdf8,
    hpMultiplier: 1.6,
    attackMultiplier: 1.3,
    speedMultiplier: 1.45,
    expMultiplier: 2.2,
  },
  vampiric: {
    id: 'vampiric',
    badge: '🩸 흡혈',
    label: '흡혈의',
    auraColorHex: 0xe11d48,
    hpMultiplier: 1.9,
    attackMultiplier: 1.35,
    speedMultiplier: 1.08,
    expMultiplier: 2.5,
  },
  arcane_nova: {
    id: 'arcane_nova',
    badge: '💀 자폭',
    label: '비전 폭발',
    auraColorHex: 0xa855f7,
    hpMultiplier: 1.75,
    attackMultiplier: 1.4,
    speedMultiplier: 1.08,
    expMultiplier: 2.6,
  },
  fortified: {
    id: 'fortified',
    badge: '🛡️ 강철',
    label: '불굴의',
    auraColorHex: 0xfbbf24,
    hpMultiplier: 2.35,
    attackMultiplier: 1.3,
    speedMultiplier: 0.98,
    expMultiplier: 2.5,
  },
};

export const ELITE_SPAWN_CHANCE_BY_DIFFICULTY: Record<RoomDifficultyId, number> = {
  normal: 0.2,
  hard: 0.3,
  nightmare: 0.42,
};

export const ELITE_AFFIX_IDS: EliteAffixId[] = [
  'berserker',
  'swift',
  'vampiric',
  'arcane_nova',
  'fortified',
];

export const ELITE_SHIELD_BUFF_CONFIG = {
  /** 방어막 버프 재사용 대기시간 (ms) */
  cooldownMs: 11_000,
  /** 방어막 버프 유지 시간 (ms) */
  durationMs: 3_600,
  /** 최대 체력 대비 생성되는 임시 방어막 비율 */
  shieldHpRatio: 0.25,
} as const;

export function pickRandomEliteAffix(): EliteAffixDefinition {
  const id = ELITE_AFFIX_IDS[Math.floor(Math.random() * ELITE_AFFIX_IDS.length)] ?? 'berserker';
  return ELITE_AFFIXES[id];
}
