import React, { useState, useEffect } from 'react';
import { Inventory, Island, PlayerColor, WaveState } from '../types/game';
import { sound, SoundSettings } from '../lib/sound';
import { SoundModal } from './SoundModal';
import { HudSettingsModal } from './HudSettingsModal';
import { HudHelpModal } from './HudHelpModal';
import { VILLAGE_TIER_CONFIGS } from '../game/constants';
import {
  Users,
  Share2,
  Check,
  Compass,
  Hammer,
  Skull,
  Flame,
  FastForward,
  ShieldAlert,
} from 'lucide-react';

interface HUDProps {
  inventory: Inventory;
  onlineCount: number;
  playerName: string;
  setPlayerName: (name: string) => void;
  playerColor: PlayerColor;
  setPlayerColor: (color: PlayerColor) => void;
  unlockedCount?: number;
  totalIslands?: number;
  currentTerritory?: Island;
  waveState?: WaveState;
  alertMessage?: string | null;
  onResetGame?: () => void;
  onOpenMinimap?: () => void;
  onOpenVillageModal?: () => void;
  onTriggerRegularWave?: () => void;
  onTriggerBossWave?: () => void;
  onSummonEarlyWave?: () => void;
  onChangeTimeScale?: (scale: number) => void;
  onAddTestResources?: () => void;
}

function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export const HUD: React.FC<HUDProps> = ({
  inventory,
  onlineCount,
  playerName,
  setPlayerName,
  playerColor,
  setPlayerColor,
  unlockedCount = 1,
  totalIslands = 21,
  currentTerritory,
  waveState,
  alertMessage,
  onResetGame,
  onOpenMinimap,
  onOpenVillageModal,
  onTriggerRegularWave,
  onTriggerBossWave,
  onSummonEarlyWave,
  onChangeTimeScale,
  onAddTestResources,
}) => {
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(() => sound.getSettings());
  const [isMuted, setIsMuted] = useState(sound.isMuted());
  const [showSoundModal, setShowSoundModal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsub = sound.subscribe((updated) => {
      setSoundSettings(updated);
      setIsMuted(updated.muted);
    });
    return () => unsub();
  }, []);

  const toggleSound = () => {
    sound.toggleMute();
    sound.playClick();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cycleTimeScale = () => {
    if (!waveState || !onChangeTimeScale) return;
    const next = waveState.timeScale === 1 ? 60 : waveState.timeScale === 60 ? 300 : 1;
    onChangeTimeScale(next);
  };

  const curTierCfg = currentTerritory
    ? VILLAGE_TIER_CONFIGS[currentTerritory.villageTier]
    : VILLAGE_TIER_CONFIGS[2];

  return (
    <>
      {/* ======================================================== */}
      {/* 1. DESKTOP HUD (sm: and above)                           */}
      {/* ======================================================== */}
      <div className="hidden sm:flex absolute top-3 left-4 right-4 z-30 flex-col gap-2 pointer-events-none">
        <div className="flex items-center justify-between w-full">
          {/* Left: Wood Resource Bar + Village Territory Map + Village Build Button */}
          <div className="flex items-center gap-2.5 pointer-events-auto">
            <div className="wood-hud-panel px-3.5 py-2 rounded-2xl flex items-center gap-2.5">
              {/* Wood */}
              <div className="flex items-center gap-1.5 wood-hud-slot px-2.5 py-1 rounded-xl">
                <img
                  src="/assets/ui/Icons/Icon_02.png"
                  alt="Wood"
                  className="w-5 h-5 pixel-art select-none drop-shadow"
                />
                <span id="hud-wood-count" className="font-black text-amber-200 text-base min-w-[26px] tabular-nums">
                  {inventory.wood}
                </span>
              </div>

              {/* Stone */}
              <div className="flex items-center gap-1.5 wood-hud-slot px-2.5 py-1 rounded-xl">
                <img
                  src="/assets/decorations/Rock2.png"
                  alt="Stone"
                  className="w-5 h-5 pixel-art select-none drop-shadow"
                />
                <span id="hud-stone-count" className="font-black text-slate-200 text-base min-w-[26px] tabular-nums">
                  {inventory.stone}
                </span>
              </div>

              {/* Gold */}
              <div className="flex items-center gap-1.5 wood-hud-slot px-2.5 py-1 rounded-xl">
                <img
                  src="/assets/ui/Icons/Icon_03.png"
                  alt="Gold"
                  className="w-5 h-5 pixel-art select-none drop-shadow"
                />
                <span id="hud-gold-count" className="font-black text-yellow-300 text-base min-w-[26px] tabular-nums">
                  {inventory.gold}
                </span>
              </div>
            </div>

            {/* Occupied Village Territory Count & Map Button (Single unified icon badge) */}
            <button
              id="open-minimap-btn"
              onClick={onOpenMinimap}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900/90 border border-teal-400/60 rounded-2xl shadow-xl hover:bg-slate-800 active:scale-95 transition"
              title="5×5 전체 영지 전략 미니맵 열기"
            >
              <Compass className="w-4 h-4 text-teal-300" />
              <span id="hud-unlocked-count" className="font-extrabold text-white text-sm tabular-nums">
                <span className="text-teal-200">{unlockedCount}</span>
                <span className="text-white/40 mx-0.5">/</span>
                <span>{totalIslands}</span>
              </span>
            </button>

            {/* Village Development & Construction Button (Compact Icon + Lv + Core HP Badge) */}
            <button
              id="open-village-modal-btn"
              onClick={onOpenVillageModal}
              className="flex items-center gap-2 px-3 py-2 bg-amber-600/90 hover:bg-amber-500 border-2 border-amber-300 rounded-2xl shadow-xl active:scale-95 transition text-black"
              title={`마을 발전 및 건설 (${curTierCfg.name} · 단축키 B)`}
            >
              <Hammer className="w-4 h-4 text-black shrink-0" />
              <div className="flex items-center gap-1.5 text-xs font-black text-black leading-none tabular-nums">
                <span>🏰 Lv.{currentTerritory?.villageTier ?? 2}</span>
                <span className="px-1.5 py-0.5 rounded-md bg-black/15 text-[11px] text-amber-950">
                  💎{currentTerritory?.coreHp ?? 350}
                </span>
                <span className="text-[10px] px-1 py-0.5 rounded bg-amber-950/20 text-amber-950">[B]</span>
              </div>
            </button>
          </div>

          {/* Center: Co-op Multiplayer Status (Compact Icon + Count + Share Icon) */}
          <div className="flex items-center gap-2 pointer-events-auto bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/15 shadow-xl">
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-black tabular-nums" title="접속 중인 수호자 수">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <Users className="w-3.5 h-3.5" />
              <span>{onlineCount}</span>
            </div>
            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center w-7 h-7 bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 rounded-lg transition"
              title={copied ? '초대 링크 복사됨!' : '협동 멀티플레이 초대 링크 복사'}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Share2 className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Right: Audio & Settings Icon Buttons */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={toggleSound}
              className="relative w-10 h-10 active:scale-90 transition-transform flex items-center justify-center group"
              title={isMuted ? '음소거 해제' : '음소거'}
            >
              <img
                src="/assets/ui/Buttons/SmallBlueRoundButton_Regular.png"
                alt="Sound button"
                className="w-full h-full pixel-art select-none"
              />
              <img
                src="/assets/ui/Icons/Icon_12.png"
                alt="Music"
                className={`absolute w-4 h-4 pixel-art ${isMuted ? 'opacity-35 grayscale' : ''}`}
              />
              {isMuted && (
                <span className="absolute text-red-500 font-black text-base select-none">✕</span>
              )}
            </button>

            <button
              onClick={() => {
                sound.playClick();
                setShowSettingsModal(true);
              }}
              className="relative w-10 h-10 active:scale-90 transition-transform flex items-center justify-center group"
              title="게임 설정 & 가이드"
            >
              <img
                src="/assets/ui/Buttons/SmallBlueRoundButton_Regular.png"
                alt="Settings button"
                className="w-full h-full pixel-art select-none"
              />
              <img
                src="/assets/ui/Icons/Icon_10.png"
                alt="Gear"
                className="absolute w-4 h-4 pixel-art"
              />
            </button>
          </div>
        </div>

        {/* Second Row: Compact Icon-First Wave Timers & Action Badges */}
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
                  {formatSeconds(waveState.regularWaveRemainingSec)}
                </span>
              </div>

              <div
                className="flex items-center gap-1 text-red-300 font-bold"
                title="60분 주기 보스몬스터 출현 남은 시간"
              >
                <Flame className="w-3.5 h-3.5 text-red-400" />
                <span>👹</span>
                <span id="boss-wave-timer" className="font-mono font-black text-red-200 bg-red-950/70 border border-red-500/30 px-1.5 py-0.5 rounded">
                  {formatSeconds(waveState.bossWaveRemainingSec)}
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
                onClick={cycleTimeScale}
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
      </div>

      {/* ======================================================== */}
      {/* 2. MOBILE HUD (sm:hidden)                                */}
      {/* ======================================================== */}
      <div
        className="sm:hidden absolute top-2 left-2 right-2 z-30 flex flex-col gap-1.5 pointer-events-none"
        style={{ top: 'max(0.5rem, env(safe-area-inset-top, 0.5rem))' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 pointer-events-auto">
            <div className="wood-hud-panel px-2 py-1 rounded-xl flex items-center gap-1.5 shadow-xl">
              <div className="flex items-center gap-0.5 wood-hud-slot px-1.5 py-0.5 rounded-lg">
                <img src="/assets/ui/Icons/Icon_02.png" alt="Wood" className="w-3.5 h-3.5 pixel-art" />
                <span className="font-extrabold text-amber-200 text-xs tabular-nums">{inventory.wood}</span>
              </div>
              <div className="flex items-center gap-0.5 wood-hud-slot px-1.5 py-0.5 rounded-lg">
                <img src="/assets/decorations/Rock2.png" alt="Stone" className="w-3.5 h-3.5 pixel-art" />
                <span className="font-extrabold text-slate-200 text-xs tabular-nums">{inventory.stone}</span>
              </div>
              <div className="flex items-center gap-0.5 wood-hud-slot px-1.5 py-0.5 rounded-lg">
                <img src="/assets/ui/Icons/Icon_03.png" alt="Gold" className="w-3.5 h-3.5 pixel-art" />
                <span className="font-extrabold text-yellow-300 text-xs tabular-nums">{inventory.gold}</span>
              </div>
            </div>

            <button
              onClick={onOpenVillageModal}
              className="flex items-center gap-1 px-2 py-1 bg-amber-500 text-black rounded-xl text-[11px] font-black shadow border border-amber-200 tabular-nums"
              title="마을 발전 & 건설"
            >
              <Hammer className="w-3 h-3" />
              <span>Lv.{currentTerritory?.villageTier ?? 2}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              id="open-minimap-mobile-btn"
              onClick={onOpenMinimap}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900/95 text-teal-200 rounded-xl text-[10px] font-black border border-teal-400/60 shadow active:scale-95 tabular-nums"
              title="5×5 전체 영지 미니맵 열기"
            >
              <Compass className="w-3.5 h-3.5 text-teal-300" />
              <span>{unlockedCount}/{totalIslands}</span>
            </button>

            <button
              onClick={() => {
                sound.playClick();
                setShowSettingsModal(true);
              }}
              className="relative w-8 h-8 active:scale-90 flex items-center justify-center"
              title="게임 & 사운드 통합 설정"
            >
              <img
                src="/assets/ui/Buttons/SmallBlueRoundButton_Regular.png"
                alt="Settings"
                className="w-full h-full pixel-art"
              />
              <img src="/assets/ui/Icons/Icon_10.png" alt="Gear" className="absolute w-3.5 h-3.5 pixel-art" />
            </button>
          </div>
        </div>

        {/* Mobile Compact Icon Wave Bar */}
        {waveState && (
          <div className="flex items-center justify-between bg-slate-950/90 border border-red-500/40 px-2.5 py-1 rounded-xl text-[10px] text-white pointer-events-auto tabular-nums">
            <div className="flex items-center gap-2.5">
              <span>🧟 <b>{formatSeconds(waveState.regularWaveRemainingSec)}</b></span>
              <span>👹 <b className="text-red-300">{formatSeconds(waveState.bossWaveRemainingSec)}</b></span>
              <span>⚔️ <b className="text-amber-300">{waveState.activeMonstersCount}</b></span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={onTriggerRegularWave}
                className="px-1.5 py-0.5 rounded bg-emerald-700 text-white font-bold"
                title="마물 웨이브 출현"
              >
                🧟⚡
              </button>
              <button
                onClick={onTriggerBossWave}
                className="px-1.5 py-0.5 rounded bg-red-700 text-white font-bold"
                title="보스 출현"
              >
                👹⚡
              </button>
            </div>
          </div>
        )}

        {/* Mobile Alert Toast Banner */}
        {alertMessage && (
          <div
            id="game-alert-banner-mobile"
            className="mx-auto px-3.5 py-1.5 rounded-xl bg-slate-900/95 border border-amber-400/80 text-amber-200 text-xs font-extrabold shadow-2xl pointer-events-auto text-center"
          >
            {alertMessage}
          </div>
        )}
      </div>

      <HudSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        playerName={playerName}
        setPlayerName={setPlayerName}
        playerColor={playerColor}
        setPlayerColor={setPlayerColor}
        soundSettings={soundSettings}
        isMuted={isMuted}
        onToggleSound={toggleSound}
        onOpenSoundModal={() => setShowSoundModal(true)}
        onOpenHelp={() => setShowHelp(true)}
        onResetGame={onResetGame}
      />

      <HudHelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />

      <SoundModal isOpen={showSoundModal} onClose={() => setShowSoundModal(false)} />
    </>
  );
};
