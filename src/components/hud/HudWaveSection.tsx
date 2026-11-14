import React from 'react';
import { FastForward, Flame, ShieldAlert, Skull } from 'lucide-react';
import { WaveState } from '../../types/game';
import { formatHudSeconds } from './hudUtils';

export interface HudWaveSectionProps {
  waveState?: WaveState;
  alertMessage?: string | null;
  onTriggerRegularWave?: () => void;
  onTriggerBossWave?: () => void;
  onSummonEarlyWave?: () => void;
  onCycleTimeScale: () => void;
  onAddTestResources?: () => void;
}

export const HudWaveSection: React.FC<HudWaveSectionProps> = ({
  waveState,
  alertMessage,
  onTriggerRegularWave,
  onTriggerBossWave,
  onSummonEarlyWave,
  onCycleTimeScale,
  onAddTestResources,
}) => {
  return (
    <>
      {waveState && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/88 backdrop-blur-md border border-red-500/35 px-3 py-1.5 rounded-2xl shadow-xl pointer-events-auto">
          <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums">
            <div
              className="flex items-center gap-1 text-emerald-300 font-bold"
              title="30분 주기 일반 마물 웨이브 남은 시간"
            >
              <Skull className="w-3.5 h-3.5 text-emerald-400" />
              <span>🧟</span>
              <span id="regular-wave-timer" className="font-mono font-black text-white bg-slate-800 px-1.5 py-0.5 rounded">
                {formatHudSeconds(waveState.regularWaveRemainingSec)}
              </span>
            </div>

            <div
              className="flex items-center gap-1 text-red-300 font-bold"
              title="60분 주기 보스몬스터 출현 남은 시간"
            >
              <Flame className="w-3.5 h-3.5 text-red-400" />
              <span>👹</span>
              <span id="boss-wave-timer" className="font-mono font-black text-red-200 bg-red-950/70 border border-red-500/30 px-1.5 py-0.5 rounded">
                {formatHudSeconds(waveState.bossWaveRemainingSec)}
              </span>
            </div>

            <div
              className="flex items-center gap-1 text-slate-200 font-bold"
              title="현재 침공 중인 마물 수"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
              <span>⚔️</span>
              <span id="active-monsters-count" className="font-black text-amber-300">
                {waveState.activeMonstersCount}
              </span>
            </div>

            {waveState.onlineScaleLabel && (
              <span
                className="px-2 py-0.5 rounded-md bg-indigo-950/80 border border-indigo-400/40 text-indigo-200 text-[11px] font-bold"
                title="접속 인원 기반 실시간 웨이브 난이도 스케일링"
              >
                🌐 {waveState.onlineScaleLabel}
              </span>
            )}

            <span
              className="px-2 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-400/40 text-cyan-200 text-[11px] font-bold"
              title="함께 마을을 지키는 오프라인 유저 AI 수비대"
            >
              🛡️ 수비대 {waveState.activeGarrisonCount ?? 0}
            </span>
          </div>

          {/* Compact Wave Trigger & Speed Test Badges */}
          <div className="flex items-center gap-1.5">
            {onSummonEarlyWave && (
              <button
                id="summon-early-wave-btn"
                onClick={onSummonEarlyWave}
                className="px-2.5 py-1 rounded-lg bg-amber-600/90 hover:bg-amber-500 text-black text-[11px] font-black border border-amber-300 transition active:scale-95"
                title="준비 완료 시 웨이브 즉시 소환 (처치 보상 +35% 보너스)"
              >
                ⚔️ 조기 소환 (+35%)
              </button>
            )}

            <button
              id="trigger-regular-wave-btn"
              onClick={onTriggerRegularWave}
              className="px-2 py-1 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 text-white text-[11px] font-black border border-emerald-400/50 transition active:scale-95"
              title="마물 웨이브 즉시 출현"
            >
              🧟 +Wave
            </button>

            <button
              id="trigger-boss-wave-btn"
              onClick={onTriggerBossWave}
              className="px-2 py-1 rounded-lg bg-red-700/85 hover:bg-red-600 text-white text-[11px] font-black border border-red-400/50 transition active:scale-95"
              title="보스몬스터 즉시 출현"
            >
              👹 +Boss
            </button>

            <button
              id="toggle-timescale-btn"
              onClick={onCycleTimeScale}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-bold border border-slate-600 flex items-center gap-1 transition active:scale-95 tabular-nums"
              title="웨이브 타이머 배속 전환 (1x / 60x / 300x)"
            >
              <FastForward className="w-3 h-3" />
              <span>{waveState.timeScale}x</span>
            </button>

            {onAddTestResources && (
              <button
                id="add-test-resources-btn"
                onClick={onAddTestResources}
                className="px-2 py-1 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-black text-[11px] font-black border border-amber-300 transition active:scale-95"
                title="테스트 자원 +500 지급"
              >
                🎁 +500
              </button>
            )}
          </div>
        </div>
      )}

      {/* Active Boss HP Bar Banner */}
      {waveState?.activeBoss && (
        <div
          id="active-boss-banner"
          className="w-full max-w-xl mx-auto bg-red-950/90 border-2 border-red-500 rounded-2xl px-3.5 py-1.5 shadow-2xl pointer-events-auto animate-fadeIn"
        >
          <div className="flex items-center justify-between text-xs font-black text-red-200 mb-1 tabular-nums">
            <span>👹 {waveState.activeBoss.targetTerritoryName}</span>
            <span>
              {waveState.activeBoss.hp} / {waveState.activeBoss.maxHp}
            </span>
          </div>
          <div className="w-full h-2.5 bg-black/70 rounded-full overflow-hidden border border-red-400/40">
            <div
              className="h-full bg-gradient-to-r from-red-600 to-amber-500 transition-all duration-200"
              style={{
                width: `${Math.round(
                  (waveState.activeBoss.hp / Math.max(1, waveState.activeBoss.maxHp)) * 100
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Alert Toast Banner */}
      {alertMessage && (
        <div
          id="game-alert-banner"
          className="mx-auto px-4 py-2 rounded-2xl bg-slate-900/95 border border-amber-400/70 text-amber-200 text-xs font-bold shadow-2xl pointer-events-auto"
        >
          {alertMessage}
        </div>
      )}
    </>
  );
};
