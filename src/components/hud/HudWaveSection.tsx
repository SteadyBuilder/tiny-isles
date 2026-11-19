import React, { useEffect, useState } from 'react';
import { WaveState } from '../../types/game';
import { HUD_STATUS_ICONS } from '../../data/hudIcons';
import { PixelThreatGauge } from '../ui/PixelThreatGauge';

export interface HudWaveSectionProps {
  waveState?: WaveState;
  onlineCount?: number;
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
  onlineCount = 1,
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
  const activeMonsters = waveState?.activeMonstersCount ?? 0;
  const garrisonCount = waveState?.activeGarrisonCount ?? 0;
  const isBossNext = (waveState?.wavesUntilBoss ?? 2) <= 1;

  return (
    <>
      {waveState && (
        <div className="self-start flex flex-wrap items-center gap-2 pointer-events-none">
          {/* 좌측 상단 밀착 컴팩트 위협도 & 전황 위젯 */}
          <div
            className={`wood-hud-panel px-2.5 py-1.5 rounded-xl flex items-center gap-2 text-xs tabular-nums pointer-events-auto transition-all ${
              isWarning ? 'ring-1 ring-red-400/80 shadow-red-950/60' : ''
            }`}
          >
            {/* 위협도 액체 게이지 (이미지 아이콘 + 게이지 + 수치/카운트다운) */}
            <div
              className="flex items-center gap-1.5 font-black"
              title="위협도: 자원 채집, 마물 사냥, 건설 시 상승하며 100% 도달 시 웨이브 침공이 시작됩니다."
            >
              <img
                src={HUD_STATUS_ICONS.threat}
                alt="위협도"
                className={`w-4 h-4 pixel-art select-none shrink-0 transition-transform ${
                  isSurging ? 'scale-125 brightness-125' : isWarning ? 'animate-pulse' : ''
                }`}
              />
              <PixelThreatGauge
                containerId="threat-gauge-container"
                barId="threat-gauge-bar"
                threatPercent={threat}
                isWarning={isWarning}
                isSurging={isSurging}
                className="w-20 h-3"
              />
              {isCountingDown ? (
                <span
                  id="threat-countdown-badge"
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-600/95 text-white border border-red-300/70 text-[11px] font-black animate-pulse shadow"
                  title={`${countdown}초 후 ${waveState.nextWaveIsBoss ? '보스 침공' : '웨이브 침공'}`}
                >
                  <img
                    src={waveState.nextWaveIsBoss ? HUD_STATUS_ICONS.boss : HUD_STATUS_ICONS.clock}
                    alt=""
                    className="w-3 h-3 pixel-art shrink-0"
                  />
                  <span>{countdown}s</span>
                </span>
              ) : (
                <span
                  id="threat-percent-text"
                  className={`font-mono font-black text-[11px] min-w-[30px] text-right transition-transform pixel-btn-shadow ${
                    isSurging
                      ? 'scale-110 text-yellow-200'
                      : isWarning
                        ? 'text-red-300 animate-pulse'
                        : 'text-[#fde68a]'
                  }`}
                >
                  {threat}%
                </span>
              )}
            </div>

            <div className="h-4 w-px bg-[#85532a]/60 shrink-0" />

            {/* 보스까지 남은 웨이브 */}
            <div
              className={`wood-hud-slot flex items-center gap-1 px-1.5 py-0.5 rounded-lg font-black ${
                isBossNext ? 'border-red-400/70 text-red-200 animate-pulse' : 'text-red-200/90'
              }`}
              title={isBossNext ? '다음 웨이브에 보스 군단 출현!' : `보스 군단 출현까지 ${waveState.wavesUntilBoss}웨이브`}
            >
              <img
                src={HUD_STATUS_ICONS.boss}
                alt="보스"
                className="w-3.5 h-3.5 pixel-art select-none shrink-0"
              />
              <span className="font-mono text-[11px] pixel-btn-shadow">
                {isBossNext ? 'BOSS' : `${waveState.wavesUntilBoss}W`}
              </span>
            </div>

            {/* 현재 침공 마물 수 */}
            <div
              className={`wood-hud-slot flex items-center gap-1 px-1.5 py-0.5 rounded-lg font-black ${
                activeMonsters > 0 ? 'text-amber-300' : 'text-slate-300/75'
              }`}
              title={`현재 침공 중인 마물: ${activeMonsters}마리`}
            >
              <img
                src={HUD_STATUS_ICONS.monsters}
                alt="침공 마물"
                className={`w-3.5 h-3.5 pixel-art select-none shrink-0 ${
                  activeMonsters === 0 ? 'opacity-65' : ''
                }`}
              />
              <span id="active-monsters-count" className="font-mono text-[11px] pixel-btn-shadow">
                {activeMonsters}
              </span>
            </div>

            {/* 수비대 수 */}
            <div
              className={`wood-hud-slot flex items-center gap-1 px-1.5 py-0.5 rounded-lg font-black ${
                garrisonCount > 0 ? 'text-cyan-200' : 'text-slate-300/70'
              }`}
              title={`함께 마을을 지키는 수비대: ${garrisonCount}명`}
            >
              <img
                src={HUD_STATUS_ICONS.garrison}
                alt="수비대"
                className={`w-3.5 h-3.5 pixel-art select-none shrink-0 ${
                  garrisonCount === 0 ? 'opacity-65' : ''
                }`}
              />
              <span className="font-mono text-[11px] pixel-btn-shadow">{garrisonCount}</span>
            </div>

            {/* 협동(2인 이상) 시에만 간략 난이도 스케일 표시 */}
            {onlineCount > 1 && waveState.onlineScaleLabel && (
              <span
                className="px-1.5 py-0.5 rounded-lg bg-indigo-950/85 border border-indigo-400/40 text-indigo-200 text-[10px] font-black"
                title={`접속 인원 기반 웨이브 난이도 스케일링 (${waveState.onlineScaleLabel})`}
              >
                {waveState.onlineScaleLabel}
              </span>
            )}
          </div>

          {/* Compact Wave Trigger & Test Badges (Easter Egg) */}
          {showTestMenu && (
            <div className="flex items-center gap-1.5 pointer-events-auto">
              {onSummonEarlyWave && (
                <button
                  id="summon-early-wave-btn"
                  onClick={onSummonEarlyWave}
                  className="px-2 py-1 rounded-lg bg-amber-600/90 hover:bg-amber-500 text-black text-[11px] font-black border border-amber-300 transition active:scale-95"
                  title="준비 완료 시 웨이브 즉시 소환 (처치 보상 +35% 보너스)"
                >
                  조기소환
                </button>
              )}

              {onAddTestThreat && (
                <button
                  id="add-test-threat-btn"
                  onClick={onAddTestThreat}
                  className="px-2 py-1 rounded-lg bg-orange-700/85 hover:bg-orange-600 text-white text-[11px] font-black border border-orange-400/50 transition active:scale-95"
                  title="마물 위협도 +25% 증가 테스트"
                >
                  +25%
                </button>
              )}

              <button
                id="trigger-regular-wave-btn"
                onClick={onTriggerRegularWave}
                className="px-2 py-1 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 text-white text-[11px] font-black border border-emerald-400/50 transition active:scale-95"
                title="마물 웨이브 즉시 출현"
              >
                +Wave
              </button>

              <button
                id="trigger-boss-wave-btn"
                onClick={onTriggerBossWave}
                className="px-2 py-1 rounded-lg bg-red-700/85 hover:bg-red-600 text-white text-[11px] font-black border border-red-400/50 transition active:scale-95"
                title="보스몬스터 즉시 출현"
              >
                +Boss
              </button>

              {onAddTestResources && (
                <button
                  id="add-test-resources-btn"
                  onClick={onAddTestResources}
                  className="px-2 py-1 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-black text-[11px] font-black border border-amber-300 transition active:scale-95"
                  title="테스트 자원 +500 지급"
                >
                  +500
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Active Boss HP Bar Banner (보스 출현 시에만 상단 중앙 표시) */}
      {waveState?.activeBoss && (
        <div
          id="active-boss-banner"
          className="self-center w-full max-w-md bg-red-950/90 border-2 border-red-500 rounded-2xl px-3.5 py-1.5 shadow-2xl pointer-events-auto animate-fadeIn"
        >
          <div className="flex items-center justify-between text-xs font-black text-red-200 mb-1 tabular-nums">
            <span className="flex items-center gap-1.5">
              <img src={HUD_STATUS_ICONS.boss} alt="" className="w-4 h-4 pixel-art shrink-0" />
              <span>{waveState.activeBoss.targetTerritoryName}</span>
            </span>
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
          className="self-center flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900/95 border border-amber-400/70 text-amber-200 text-xs font-bold shadow-2xl pointer-events-auto"
        >
          <img src={HUD_STATUS_ICONS.alert} alt="" className="w-4 h-4 pixel-art shrink-0" />
          <span>{alertMessage}</span>
        </div>
      )}
    </>
  );
};

