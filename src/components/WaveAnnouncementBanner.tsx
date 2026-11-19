import React, { useEffect, useRef, useState } from 'react';
import {
  BannerSpriteSpec,
  BOSS_SPRITE_KEY_TO_ASSET,
  DUNGEON_PREVIEW_SPRITE,
  REGULAR_WAVE_PREVIEW_SPRITES,
  WAVE_BANNER_THEMES,
  WaveBannerKind,
} from '../data/waveBannerConfig';
import { GameEventPayloads, GameEvents } from '../game/events/gameEvents';

interface ActiveBannerState {
  key: number;
  kind: WaveBannerKind;
  waveNumber: number;
  title: string;
  subtitle: string;
  sprite: BannerSpriteSpec;
  directionLabel?: string;
  scalingLabel?: string;
  isEarlySummon?: boolean;
  tintColorCss?: string;
  isLeaving: boolean;
}

function hexNumberToCss(hex?: number): string | undefined {
  if (typeof hex !== 'number') return undefined;
  return `#${hex.toString(16).padStart(6, '0')}`;
}

function resolveBannerContent(payload: GameEventPayloads['wave-spawned']): Omit<ActiveBannerState, 'key' | 'isLeaving'> {
  const kind: WaveBannerKind =
    payload.kind ?? (payload.isBossWave ? 'boss' : 'regular');
  const theme = WAVE_BANNER_THEMES[kind];
  const waveNumber = Math.max(1, payload.waveNumber || 1);

  if (kind === 'boss') {
    const sprite =
      (payload.bossSpriteKey && BOSS_SPRITE_KEY_TO_ASSET[payload.bossSpriteKey]) ||
      BOSS_SPRITE_KEY_TO_ASSET.enemyPurpleWarriorRun;
    const title = payload.bossName ? `${payload.bossName} 출현!` : theme.defaultTitle;
    const subtitle = payload.bossTitle
      ? `${payload.bossTitle}${payload.directionLabel ? ` · ${payload.directionLabel}에서 침공` : ''}`
      : theme.defaultSubtitle;
    return {
      kind,
      waveNumber,
      title,
      subtitle,
      sprite,
      directionLabel: payload.directionLabel,
      scalingLabel: payload.scalingLabel,
      isEarlySummon: payload.isEarlySummon,
      tintColorCss: hexNumberToCss(payload.bossTintHex),
    };
  }

  if (kind === 'dungeon') {
    const countText = payload.totalSpawns ? `마물 ${payload.totalSpawns}마리` : '심연 군단';
    return {
      kind,
      waveNumber,
      title: theme.defaultTitle,
      subtitle: `${payload.directionLabel ?? '외곽'}에서 ${countText}이 중앙 마을로 진격합니다.`,
      sprite: DUNGEON_PREVIEW_SPRITE,
      directionLabel: payload.directionLabel,
      scalingLabel: payload.scalingLabel,
      isEarlySummon: payload.isEarlySummon,
    };
  }

  const regularIndex = (waveNumber - 1) % REGULAR_WAVE_PREVIEW_SPRITES.length;
  return {
    kind: 'regular',
    waveNumber,
    title: `웨이브 ${waveNumber} · ${theme.defaultTitle}`,
    subtitle: payload.directionLabel
      ? `${payload.directionLabel}에서 마물 무리가 진격을 시작했습니다.`
      : theme.defaultSubtitle,
    sprite: REGULAR_WAVE_PREVIEW_SPRITES[regularIndex],
    directionLabel: payload.directionLabel,
    scalingLabel: payload.scalingLabel,
    isEarlySummon: payload.isEarlySummon,
  };
}

/**
 * 실제 웨이브·보스·던전 침공 시 화면 중앙에 반투명 배너와 픽셀 아트 스프라이트 애니메이션을 표시하는 컴포넌트
 */
export const WaveAnnouncementBanner: React.FC = () => {
  const [banner, setBanner] = useState<ActiveBannerState | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }
    };

    const handleWaveSpawned = (payload: GameEventPayloads['wave-spawned']) => {
      clearTimers();
      const resolved = resolveBannerContent(payload);
      const theme = WAVE_BANNER_THEMES[resolved.kind];
      const stayDurationMs = Math.max(800, theme.durationMs - theme.fadeOutMs);

      setBanner((prev) => ({
        ...resolved,
        key: (prev?.key ?? 0) + 1,
        isLeaving: false,
      }));

      fadeTimerRef.current = setTimeout(() => {
        setBanner((prev) => (prev ? { ...prev, isLeaving: true } : null));
      }, stayDurationMs);

      clearTimerRef.current = setTimeout(() => {
        setBanner(null);
        clearTimers();
      }, theme.durationMs);
    };

    GameEvents.on('wave-spawned', handleWaveSpawned);
    return () => {
      GameEvents.off('wave-spawned', handleWaveSpawned);
      clearTimers();
    };
  }, []);

  if (!banner) return null;

  const theme = WAVE_BANNER_THEMES[banner.kind];
  const auraColor = banner.tintColorCss ?? theme.glowColor;

  return (
    <div
      id="wave-announcement-banner"
      aria-live="polite"
      className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center px-4"
    >
      <div
        key={banner.key}
        className={`relative w-full max-w-lg rounded-2xl border backdrop-blur-md px-4 py-3 sm:px-5 sm:py-3.5 flex items-center gap-3.5 sm:gap-4 ${
          theme.containerClass
        } ${banner.isLeaving ? 'animate-wave-banner-out' : 'animate-wave-banner-in'}`}
      >
        {/* 상단 하이라이트 라인 */}
        <div
          className={`pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent ${theme.accentLineClass} to-transparent`}
        />

        {/* 좌측: 기존 픽셀 아트 몬스터/보스 스프라이트 애니메이션 */}
        <div
          className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-xl bg-black/35 border border-white/15 overflow-hidden flex items-center justify-center"
          style={{
            boxShadow: `0 0 18px ${auraColor}`,
          }}
        >
          <div className="w-full h-full overflow-hidden relative">
            <img
              src={banner.sprite.path}
              alt=""
              className="h-full max-w-none pixel-art select-none"
              style={{
                width: `${banner.sprite.frames * 100}%`,
                animation: `spriteStripRun ${banner.sprite.durationMs}ms steps(${banner.sprite.frames}) infinite`,
                filter: banner.tintColorCss
                  ? `drop-shadow(0 0 6px ${banner.tintColorCss})`
                  : undefined,
              }}
            />
          </div>
        </div>

        {/* 우측: 배지 + 타이틀 + 서브타이틀 */}
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`px-2 py-0.5 rounded-md border text-[10px] sm:text-[11px] font-black tracking-wider uppercase ${theme.badgeClass}`}
            >
              {theme.badgeLabel}
            </span>
            <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-white/85 text-[10px] font-bold tabular-nums">
              WAVE {banner.waveNumber}
            </span>
            {banner.scalingLabel && (
              <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/25 border border-indigo-300/35 text-indigo-100 text-[10px] font-bold">
                {banner.scalingLabel}
              </span>
            )}
            {banner.isEarlySummon && (
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/25 border border-emerald-300/40 text-emerald-200 text-[10px] font-bold">
                조기소환 +35%
              </span>
            )}
          </div>

          <h2
            className={`text-base sm:text-xl font-black tracking-tight truncate drop-shadow ${theme.titleClass}`}
          >
            {banner.title}
          </h2>

          <p className="text-xs sm:text-sm text-slate-200/90 font-medium leading-snug line-clamp-2">
            {banner.subtitle}
          </p>
        </div>
      </div>
    </div>
  );
};
