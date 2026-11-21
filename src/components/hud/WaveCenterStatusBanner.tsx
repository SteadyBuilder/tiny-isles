import React from 'react';
import { CenterVillageHp, WaveState } from '../../types/game';
import { HUD_STATUS_ICONS } from '../../data/hudIcons';

export interface WaveCenterStatusBannerProps {
  waveState?: WaveState;
  centerVillageHp?: CenterVillageHp;
  variant?: 'desktop' | 'mobile';
}

function getHpPercent(hp: number, maxHp: number): number {
  const safeMax = Math.max(1, maxHp);
  return Math.max(0, Math.min(100, Math.round((hp / safeMax) * 100)));
}

/**
 * 웨이브 침공 중 및 보스 출현 시 중앙 상단에 마을(본진) 체력과 보스 체력을 명확히 분리 표시하는 배너
 */
export const WaveCenterStatusBanner: React.FC<WaveCenterStatusBannerProps> = ({
  waveState,
  centerVillageHp,
  variant = 'desktop',
}) => {
  const isWaveActive =
    (waveState?.activeMonstersCount ?? 0) > 0 || Boolean(waveState?.activeBoss);
  const isVillageDamaged = Boolean(
    centerVillageHp && centerVillageHp.hp < centerVillageHp.maxHp
  );
  const showVillageHp = Boolean(centerVillageHp && (isWaveActive || isVillageDamaged));
  const activeBoss = waveState?.activeBoss ?? null;

  if (!showVillageHp && !activeBoss) return null;

  const isMobile = variant === 'mobile';
  const containerWidthClass = isMobile ? 'w-full max-w-sm gap-1' : 'w-full max-w-md gap-1.5';

  const villagePct = centerVillageHp
    ? getHpPercent(centerVillageHp.hp, centerVillageHp.maxHp)
    : 100;
  const isVillageCritical = villagePct <= 30;
  const isVillageWarning = !isVillageCritical && villagePct <= 60;

  return (
    <div className={`self-center flex flex-col ${containerWidthClass} pointer-events-auto`}>
      {/* 1. 마을(본진) 체력 바: 웨이브 진행 중 또는 본진 피해 발생 시 표시 */}
      {showVillageHp && centerVillageHp && (
        <div
          id={isMobile ? 'village-core-hp-banner-mobile' : 'village-core-hp-banner'}
          className={`rounded-xl border shadow-xl transition-colors animate-fadeIn ${
            isMobile ? 'px-2.5 py-1' : 'px-3.5 py-1.5'
          } ${
            isVillageCritical
              ? 'bg-rose-950/90 border-red-400 animate-pulse'
              : isVillageWarning
                ? 'bg-slate-900/90 border-amber-400/80'
                : 'bg-slate-900/88 border-emerald-400/75'
          }`}
          title="중심 마을 본진 코어 체력 (0이 되면 방어 실패)"
        >
          <div
            className={`flex items-center justify-between font-black tabular-nums ${
              isMobile ? 'text-[10px] mb-0.5' : 'text-xs mb-1'
            } ${
              isVillageCritical
                ? 'text-red-200'
                : isVillageWarning
                  ? 'text-amber-200'
                  : 'text-emerald-200'
            }`}
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <img
                src={HUD_STATUS_ICONS.garrison}
                alt="마을 본진"
                className={`${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'} pixel-art shrink-0`}
              />
              <span className="truncate">본진 · {centerVillageHp.name}</span>
            </span>
            <span className="shrink-0 ml-2">
              {centerVillageHp.hp} / {centerVillageHp.maxHp}
            </span>
          </div>
          <div
            className={`w-full bg-black/70 rounded-full overflow-hidden border border-white/15 ${
              isMobile ? 'h-1.5' : 'h-2'
            }`}
          >
            <div
              className={`h-full transition-all duration-200 ${
                isVillageCritical
                  ? 'bg-gradient-to-r from-red-600 to-rose-400'
                  : isVillageWarning
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-400'
              }`}
              style={{ width: `${villagePct}%` }}
            />
          </div>
        </div>
      )}

      {/* 2. 보스 몬스터 체력 바: 보스 출현 시에만 표시 (보스 이름 + 목표 거점 명시) */}
      {activeBoss && (
        <div
          id={isMobile ? 'active-boss-banner-mobile' : 'active-boss-banner'}
          className={`bg-red-950/90 border-2 border-red-500 rounded-2xl shadow-2xl animate-fadeIn ${
            isMobile ? 'px-2.5 py-1' : 'px-3.5 py-1.5'
          }`}
          title={`보스 '${activeBoss.name}' 체력 (목표: ${activeBoss.targetTerritoryName})`}
        >
          <div
            className={`flex items-center justify-between font-black text-red-200 tabular-nums ${
              isMobile ? 'text-[10px] mb-0.5' : 'text-xs mb-1'
            }`}
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <img
                src={HUD_STATUS_ICONS.boss}
                alt="보스"
                className={`${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'} pixel-art shrink-0`}
              />
              <span className="truncate">{activeBoss.name}</span>
              <span
                className={`px-1.5 py-0.2 rounded bg-black/45 border border-red-400/40 text-amber-200 font-bold shrink-0 ${
                  isMobile ? 'text-[9px]' : 'text-[10px]'
                }`}
              >
                목표: {activeBoss.targetTerritoryName}
              </span>
            </span>
            <span className="shrink-0 ml-2">
              {activeBoss.hp} / {activeBoss.maxHp}
            </span>
          </div>
          <div
            className={`w-full bg-black/70 rounded-full overflow-hidden border border-red-400/40 ${
              isMobile ? 'h-2' : 'h-2.5'
            }`}
          >
            <div
              className="h-full bg-gradient-to-r from-red-600 to-amber-500 transition-all duration-200"
              style={{ width: `${getHpPercent(activeBoss.hp, activeBoss.maxHp)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
