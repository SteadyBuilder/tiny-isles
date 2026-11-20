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
      className="fixed inset-x-0 top-14 sm:top-16 z-40 pointer-events-none flex justify-center px-3"
    >
      <div
        key={banner.key}
        className={`relative w-full max-w-md ts-wood-bar-tight pt-3.5 pb-2 px-3 sm:px-4 flex items-center gap-3 text-[#fef5df] ${
          banner.isLeaving ? 'animate-wave-banner-out' : 'animate-wave-banner-in'
        }`}
        style={
          banner.isLeaving
            ? { animationDuration: `${theme.fadeOutMs}ms` }
            : undefined
        }
      >
        {/* 상단 Tiny Swords 리본 배지 스프라이트 */}
        <div className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 flex items-center justify-center">
          <div className="relative inline-flex items-center justify-center gap-1.5 px-6 py-1 min-w-[175px] sm:min-w-[205px]">
            <img
              src={theme.ribbonPath}
              alt=""
              className="absolute inset-0 w-full h-full object-fill pixel-art drop-shadow-[0_3px_5px_rgba(0,0,0,0.7)]"
            />
            <img
              src={theme.iconPath}
              alt=""
              className="relative z-10 w-3.5 h-3.5 pixel-art shrink-0"
            />
            <span className="relative z-10 text-[10px] sm:text-[11px] font-black tracking-wider uppercase text-[#fef5df] pixel-btn-shadow whitespace-nowrap">
              {theme.badgeLabel} · W{banner.waveNumber}
            </span>
          </div>
        </div>

        {/* 좌측: 우드 슬롯 + 픽셀 아트 몬스터/보스 스프라이트 애니메이션 */}
        <div
          className="relative w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-lg wood-hud-slot overflow-hidden flex items-center justify-center"
          style={{
            boxShadow: `inset 0 1.5px 3px rgba(0, 0, 0, 0.75), 0 0 12px ${auraColor}`,
          }}
        >
          <div
            className="w-full h-full overflow-hidden relative"
            style={{
              transform: `scale(${banner.sprite.scale ?? 1.5})`,
            }}
          >
            <img
              src={banner.sprite.path}
              alt=""
              className="h-full max-w-none pixel-art select-none"
              style={{
                width: `${banner.sprite.frames * 100}%`,
                animation: `spriteStripRun ${banner.sprite.durationMs}ms steps(${banner.sprite.frames}) infinite`,
                filter: banner.tintColorCss
                  ? `drop-shadow(0 0 5px ${banner.tintColorCss})`
                  : undefined,
              }}
            />
          </div>
        </div>

        {/* 우측: 타이틀 + 서브타이틀 + 보조 태그 */}
        <div className="min-w-0 flex-1 flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2
              className={`text-sm sm:text-base font-black tracking-tight truncate pixel-btn-shadow ${theme.titleClass}`}
            >
              {banner.title}
            </h2>
            {banner.scalingLabel && (
              <span className="px-1.5 py-0.5 rounded bg-[#24160e]/85 border border-[#85532a] text-[#fde68a] text-[10px] font-bold shrink-0">
                {banner.scalingLabel}
              </span>
            )}
            {banner.isEarlySummon && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-400/50 text-emerald-200 text-[10px] font-bold shrink-0">
                조기소환 +35%
              </span>
            )}
          </div>

          <p className="text-[11px] sm:text-xs text-[#f3e4c7] font-semibold leading-snug line-clamp-1 pixel-btn-shadow">
            {banner.subtitle}
          </p>
        </div>
      </div>
    </div>
  );
};
