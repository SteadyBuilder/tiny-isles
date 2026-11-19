/**
 * 몬스터 웨이브·보스·던전 침공 중앙 반투명 배너 설정 및 스프라이트 매핑 데이터
 * [AI Guideline]: 배너 지속 시간, 스타일, 스프라이트 경로는 이 데이터 파일에서만 관리합니다.
 */

export type WaveBannerKind = 'regular' | 'boss' | 'dungeon';

export interface BannerSpriteSpec {
  readonly path: string;
  readonly frames: number;
  readonly durationMs: number;
}

export interface WaveBannerThemeConfig {
  readonly durationMs: number;
  readonly fadeOutMs: number;
  readonly badgeLabel: string;
  readonly defaultTitle: string;
  readonly defaultSubtitle: string;
  readonly containerClass: string;
  readonly badgeClass: string;
  readonly titleClass: string;
  readonly accentLineClass: string;
  readonly glowColor: string;
}

export const WAVE_BANNER_THEMES: Record<WaveBannerKind, WaveBannerThemeConfig> = {
  regular: {
    durationMs: 3600,
    fadeOutMs: 420,
    badgeLabel: 'WAVE INVASION',
    defaultTitle: '마물 웨이브 침공!',
    defaultSubtitle: '지도 외곽에서 마물 무리가 진격을 시작했습니다.',
    containerClass:
      'bg-slate-950/65 border-amber-400/55 shadow-[0_12px_40px_rgba(0,0,0,0.55)]',
    badgeClass: 'bg-amber-500/25 text-amber-200 border-amber-400/50',
    titleClass: 'text-amber-100',
    accentLineClass: 'via-amber-400/70',
    glowColor: 'rgba(251, 191, 36, 0.35)',
  },
  boss: {
    durationMs: 4600,
    fadeOutMs: 500,
    badgeLabel: 'BOSS INCOMING',
    defaultTitle: '보스 군단 출현!',
    defaultSubtitle: '강력한 보스와 호위 군단이 영지를 향해 진격합니다.',
    containerClass:
      'bg-red-950/70 border-red-400/65 shadow-[0_14px_48px_rgba(127,29,29,0.55)]',
    badgeClass: 'bg-red-500/30 text-red-200 border-red-400/60',
    titleClass: 'text-red-100',
    accentLineClass: 'via-red-400/80',
    glowColor: 'rgba(248, 113, 113, 0.45)',
  },
  dungeon: {
    durationMs: 4400,
    fadeOutMs: 480,
    badgeLabel: 'ABYSSAL GATE',
    defaultTitle: '심연의 던전 게이트 개방!',
    defaultSubtitle: '어둠의 마물 군단이 중앙 마을을 향해 총진격합니다.',
    containerClass:
      'bg-purple-950/70 border-purple-400/65 shadow-[0_14px_48px_rgba(88,28,135,0.55)]',
    badgeClass: 'bg-purple-500/30 text-purple-200 border-purple-400/60',
    titleClass: 'text-purple-100',
    accentLineClass: 'via-purple-400/80',
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
  },
  enemyArchmageRun: {
    path: '/assets/units/enemies/Black_Archmage_Run.png',
    frames: 6,
    durationMs: 760,
  },
  enemyLancerRun: {
    path: '/assets/units/enemies/Black_Lancer_Run.png',
    frames: 6,
    durationMs: 700,
  },
  enemyArcherRun: {
    path: '/assets/units/enemies/Black_Archer_Run.png',
    frames: 4,
    durationMs: 640,
  },
  enemyPurpleWarriorRun: {
    path: '/assets/units/enemies/Purple_Warrior_Run.png',
    frames: 6,
    durationMs: 720,
  },
};

/**
 * 일반 웨이브 중앙 배너용 대표 몬스터 스프라이트 목록 (웨이브 번호 순환)
 */
export const REGULAR_WAVE_PREVIEW_SPRITES: readonly BannerSpriteSpec[] = [
  { path: '/assets/units/enemies/Zombie_Run.png', frames: 4, durationMs: 720 },
  { path: '/assets/units/enemies/Skeleton_Run.png', frames: 4, durationMs: 640 },
  { path: '/assets/units/enemies/Goblin_Run.png', frames: 4, durationMs: 640 },
  { path: '/assets/units/enemies/Lizardman_Run.png', frames: 4, durationMs: 680 },
];

/**
 * 던전 게이트 침공 배너용 대표 스프라이트
 */
export const DUNGEON_PREVIEW_SPRITE: BannerSpriteSpec = {
  path: '/assets/units/enemies/Black_Archmage_Run.png',
  frames: 6,
  durationMs: 760,
};
