import React, { useEffect, useState } from 'react';
import { Flame, ShieldAlert, Skull } from 'lucide-react';
import { WaveState } from '../../types/game';

export interface HudWaveSectionProps {
  waveState?: WaveState;
  alertMessage?: string | null;
  onTriggerRegularWave?: () => void;
  onTriggerBossWave?: () => void;
  onSummonEarlyWave?: () => void;
  onAddTestThreat?: () => void;
  onAddTestResources?: () => void;
  showTestMenu?: boolean;
}

export const HudWaveSection: React.FC<HudWaveSectionProps> = ({
  waveState,
  alertMessage,
  onTriggerRegularWave,
  onTriggerBossWave,
  onSummonEarlyWave,
  onAddTestThreat,
  onAddTestResources,
  showTestMenu = false,
}) => {
  const [isSurging, setIsSurging] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    const handleArrived = () => {
      setIsSurging(true);
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setIsSurging(false), 320);
    };
    window.addEventListener('threat-orb-arrived', handleArrived);
    return () => {
      window.removeEventListener('threat-orb-arrived', handleArrived);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const threat = waveState?.threatPercent ?? 0;
  const countdown = waveState?.countdownSecondsRemaining ?? null;
  const isCountingDown = countdown !== null;
  const isWarning = isCountingDown || threat >= (waveState?.warningThreshold ?? 80);

  return (
    <>
      {waveState && (
        <div
          className={`flex flex-wrap items-center justify-between gap-2 bg-slate-950/88 backdrop-blur-md border px-3 py-1.5 rounded-2xl shadow-xl pointer-events-auto transition-colors ${
            isWarning ? 'border-red-500/80 shadow-red-950/50' : 'border-red-500/35'
          }`}
        >
          <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums">
            {/* 활동 기반 마물 위협도 액체 게이지 */}
            <div
              className="flex items-center gap-2 font-bold"
              title="자원 채집, 마물 사냥, 건물 건설, 새 마을 해금 시 노란 구슬이 모여 위협도가 차오르며 100% 도달 시 웨이브 카운트다운이 시작됩니다."
            >
              <Flame
                className={`w-3.5 h-3.5 transition-transform ${
                  isSurging ? 'scale-125 text-yellow-300' : isWarning ? 'text-red-400 animate-pulse' : 'text-amber-400'
                }`}
              />
              <span className={isWarning ? 'text-red-300' : 'text-amber-200'}>위협도</span>
              <div
                id="threat-gauge-container"
                className={`w-28 h-3 bg-slate-800/95 rounded-full overflow-hidden border transition-all duration-300 ${
                  isSurging
                    ? 'border-yellow-300 threat-liquid-surge scale-y-110'
                    : isWarning
                    ? 'border-red-400/70'
                    : 'border-slate-700'
                }`}
              >
                <div
                  id="threat-gauge-bar"
                  className="h-full threat-liquid-fill transition-all duration-700 ease-out rounded-full"
                  style={{
                    width: `${Math.min(100, Math.max(0, threat))}%`,
                    backgroundImage: isWarning
                      ? 'linear-gradient(90deg, #ea580c 0%, #ef4444 35%, #facc15 50%, #ef4444 65%, #ea580c 100%)'
                      : 'linear-gradient(90deg, #ca8a04 0%, #facc15 35%, #fef08a 50%, #f59e0b 65%, #ca8a04 100%)',
                  }}
                />
              </div>
              <span
                id="threat-percent-text"
                className={`font-mono font-black px-1.5 py-0.5 rounded transition-transform ${
                  isSurging ? 'scale-110 text-yellow-200 bg-amber-900/80' : ''
                } ${
                  isWarning
                    ? 'text-red-200 bg-red-950/80 border border-red-500/40 animate-pulse'
                    : 'text-white bg-slate-800'
                }`}
              >
                {threat}%
              </span>
              {isCountingDown ? (
                <span
                  id="threat-countdown-badge"
                  className="text-[11px] font-black px-2 py-0.5 rounded-md bg-red-600/90 text-white border border-red-300/70 animate-pulse shadow"
                >
                  ⏳ {countdown}초 후 {waveState.nextWaveIsBoss ? '보스 침공!' : '침공!'}
                </span>
              ) : (
                isWarning && (
                  <span className="text-[11px] font-black text-red-300 animate-pulse">
                    곧 침공!
                  </span>
                )
              )}
            </div>

            <div
              className="flex items-center gap-1 text-red-300 font-bold"
              title="보스 군단 출현까지 남은 웨이브 횟수"
            >
              <Skull className="w-3.5 h-3.5 text-red-400" />
              <span>👹</span>
              <span className="font-mono font-black text-red-200 bg-red-950/70 border border-red-500/30 px-1.5 py-0.5 rounded">
                {waveState.wavesUntilBoss <= 1 ? '다음 보스!' : `보스까지 ${waveState.wavesUntilBoss}웨이브`}
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
              title="함께 마을을 지키는 수비대"
            >
              🛡️ 수비대 {waveState.activeGarrisonCount ?? 0}
            </span>
          </div>

          {/* Compact Wave Trigger & Test Badges (Easter Egg) */}
          {showTestMenu && (
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

              {onAddTestThreat && (
                <button
                  id="add-test-threat-btn"
                  onClick={onAddTestThreat}
                  className="px-2 py-1 rounded-lg bg-orange-700/85 hover:bg-orange-600 text-white text-[11px] font-black border border-orange-400/50 transition active:scale-95"
                  title="마물 위협도 +25% 증가 테스트"
                >
                  🔥 +25%
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
          )}
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
