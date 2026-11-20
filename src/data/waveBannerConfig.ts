/**
 * 몬스터 웨이브·보스·던전 침공 중앙 반투명 배너 설정 및 스프라이트 매핑 데이터
 * [AI Guideline]: 배너 지속 시간, 스타일, 스프라이트 경로는 이 데이터 파일에서만 관리합니다.
 */

export type WaveBannerKind = 'regular' | 'boss' | 'dungeon';

export interface BannerSpriteSpec {
  readonly path: string;
  readonly frames: number;
  readonly durationMs: number;
  readonly scale?: number;
}

export interface WaveBannerThemeConfig {
  readonly durationMs: number;
  readonly fadeOutMs: number;
  readonly badgeLabel: string;
  readonly defaultTitle: string;
  readonly defaultSubtitle: string;
  readonly ribbonPath: string;
  readonly iconPath: string;
  readonly titleClass: string;
  readonly glowColor: string;
}

export const WAVE_BANNER_THEMES: Record<WaveBannerKind, WaveBannerThemeConfig> = {
  regular: {
    durationMs: 1800,
    fadeOutMs: 260,
    badgeLabel: 'WAVE INVASION',
    defaultTitle: '마물 웨이브 침공!',
    defaultSubtitle: '지도 외곽에서 마물 무리가 진격을 시작했습니다.',
    ribbonPath: '/assets/ui/ribbon_yellow_256.png',
    iconPath: '/assets/ui/Icons/Icon_05.png',
    titleClass: 'text-[#fde68a]',
    glowColor: 'rgba(251, 191, 36, 0.35)',
  },
  boss: {
    durationMs: 2400,
    fadeOutMs: 300,
    badgeLabel: 'BOSS INCOMING',
    defaultTitle: '보스 군단 출현!',
    defaultSubtitle: '강력한 보스와 호위 군단이 영지를 향해 진격합니다.',
    ribbonPath: '/assets/ui/ribbon_red_256.png',
    iconPath: '/assets/ui/Icons/Icon_Boss.png',
    titleClass: 'text-[#fecaca]',
    glowColor: 'rgba(248, 113, 113, 0.45)',
  },
  dungeon: {
    durationMs: 2200,
    fadeOutMs: 280,
    badgeLabel: 'ABYSSAL GATE',
    defaultTitle: '심연의 던전 게이트 개방!',
    defaultSubtitle: '어둠의 마물 군단이 중앙 마을을 향해 총진격합니다.',
    ribbonPath: '/assets/ui/ribbon_slate_256.png',
    iconPath: '/assets/ui/Icons/Icon_Flame.png',
    titleClass: 'text-[#e9d5ff]',
    glowColor: 'rgba(192, 132, 252, 0.45)',
  },
};

/**
 * 보스 spriteKey → 실제 스프라이트 시트 경로 및 프레임 수 매핑
 */
export const BOSS_SPRITE_KEY_TO_ASSET: Record<string, BannerSpriteSpec> = {
  enemyBlackWarriorRun: {
    path: '/assets/units/enemies/Black_Warrior_Run.png',
    frames: 6,
    durationMs: 720,
    scale: 1.5,
  },
  enemyArchmageRun: {
    path: '/assets/units/enemies/Black_Archmage_Run.png',
    frames: 6,
    durationMs: 760,
    scale: 1.45,
  },
  enemyLancerRun: {
    path: '/assets/units/enemies/Black_Lancer_Run.png',
    frames: 6,
    durationMs: 700,
    scale: 1.8,
  },
  enemyArcherRun: {
    path: '/assets/units/enemies/Black_Archer_Run.png',
    frames: 4,
    durationMs: 640,
    scale: 1.5,
  },
  enemyPurpleWarriorRun: {
    path: '/assets/units/enemies/Purple_Warrior_Run.png',
    frames: 6,
    durationMs: 720,
    scale: 1.5,
  },
};

/**
 * 일반 웨이브 중앙 배너용 대표 몬스터 스프라이트 목록 (웨이브 번호 순환)
 */
export const REGULAR_WAVE_PREVIEW_SPRITES: readonly BannerSpriteSpec[] = [
  { path: '/assets/units/enemies/Zombie_Run.png', frames: 4, durationMs: 720, scale: 1.5 },
  { path: '/assets/units/enemies/Skeleton_Run.png', frames: 4, durationMs: 640, scale: 1.5 },
  { path: '/assets/units/enemies/Goblin_Run.png', frames: 4, durationMs: 640, scale: 1.5 },
  { path: '/assets/units/enemies/Lizardman_Run.png', frames: 4, durationMs: 680, scale: 1.5 },
];

/**
 * 던전 게이트 침공 배너용 대표 스프라이트
 */
export const DUNGEON_PREVIEW_SPRITE: BannerSpriteSpec = {
  path: '/assets/units/enemies/Black_Archmage_Run.png',
  frames: 6,
  durationMs: 760,
  scale: 1.45,
};
