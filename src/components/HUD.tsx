import React, { useState, useEffect } from 'react';
import { Inventory, Island, PlayerColor, WaveState } from '../types/game';
import { sound, SoundSettings } from '../lib/sound';
import { SoundModal } from './SoundModal';
import { VILLAGE_TIER_CONFIGS } from '../game/constants';
import {
  Users,
  Share2,
  Check,
  RotateCcw,
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
  onChangeTimeScale,
  onAddTestResources,
}) => {
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(() => sound.getSettings());
  const [isMuted, setIsMuted] = useState(sound.isMuted());
  const [showSoundModal, setShowSoundModal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [tempName, setTempName] = useState(playerName);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return sound.subscribe((updated) => {
      setSoundSettings(updated);
      setIsMuted(updated.muted);
    });
  }, []);

  const toggleSound = () => {
    sound.toggleMute();
    sound.playClick();
  };

  const toggleColor = () => {
    setPlayerColor(playerColor === 'blue' ? 'red' : 'blue');
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
                  src="/assets/ui/Icons/Icon_01.png"
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

            {/* Occupied Village Territory Count & Map Button */}
            <button
              id="open-minimap-btn"
              onClick={onOpenMinimap}
              className="flex items-center gap-2 px-3 py-2 bg-slate-900/90 border border-teal-400/60 rounded-2xl shadow-xl hover:bg-slate-800 active:scale-95 transition"
              title="클릭하여 전체 마을 영지 지도 보기"
            >
              <img
                src="/assets/ui/Icons/Icon_05.png"
                alt="Sword"
                className="w-5 h-5 pixel-art select-none"
              />
              <div className="flex flex-col leading-none text-left">
                <span className="text-[10px] text-teal-300 font-black tracking-wider">
                  점령 마을 영지
                </span>
                <span id="hud-unlocked-count" className="font-extrabold text-white text-sm">
                  <span className="text-teal-200">{unlockedCount}</span>
                  <span className="text-white/40 mx-0.5">/</span>
                  <span>{totalIslands}</span>
                </span>
              </div>
            </button>

            {/* Village Development & Construction Button */}
            <button
              id="open-village-modal-btn"
              onClick={onOpenVillageModal}
              className="flex items-center gap-2 px-3.5 py-2 bg-amber-600/90 hover:bg-amber-500 border-2 border-amber-300 rounded-2xl shadow-xl active:scale-95 transition text-black"
              title="마을 발전 및 방어타워/성벽/건물 건설 (단축키 B)"
            >
              <Hammer className="w-4 h-4 text-black" />
              <div className="flex flex-col leading-none text-left">
                <span className="text-[10px] font-black uppercase text-amber-950">
                  현재: {curTierCfg.name} · 코어 {currentTerritory?.coreHp ?? 350}HP
                </span>
                <span className="font-black text-xs text-black">
                  🏘️ 마을 발전 & 건설 [B]
                </span>
              </div>
            </button>
          </div>

          {/* Center: Co-op Multiplayer Status */}
          <div className="flex items-center gap-2.5 pointer-events-auto bg-black/75 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/15 shadow-xl">
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <Users className="w-3.5 h-3.5" />
              <span>협동 디펜스 접속: {onlineCount}명</span>
            </div>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 px-2.5 py-1 rounded-lg transition"
              title="협동 멀티플레이 초대 링크 복사"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copied ? '복사됨!' : '동료 초대'}</span>
            </button>
          </div>

          {/* Right: Audio, Map & Settings */}
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
              onClick={onOpenMinimap}
              className="relative w-10 h-10 active:scale-90 transition-transform flex items-center justify-center group"
              title="전체 마을 영지 지도"
            >
              <img
                src="/assets/ui/Buttons/SmallBlueRoundButton_Regular.png"
                alt="Map button"
                className="w-full h-full pixel-art select-none"
              />
              <Compass className="absolute w-4 h-4 text-amber-100" />
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

        {/* Second Row: Real-Time Tower Defense Wave Timers (30m Monster Wave / 60m Boss Wave) & Test Controls */}
        {waveState && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/88 backdrop-blur-md border border-red-500/35 px-3.5 py-2 rounded-2xl shadow-xl pointer-events-auto">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                <Skull className="w-4 h-4 text-emerald-400" />
                <span>30분 마물 침공(좀비·스켈레톤):</span>
                <span id="regular-wave-timer" className="font-mono font-black text-white bg-slate-800 px-2 py-0.5 rounded">
                  {formatSeconds(waveState.regularWaveRemainingSec)}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-red-300 font-bold">
                <Flame className="w-4 h-4 text-red-400" />
                <span>60분 보스몬스터 출현:</span>
                <span id="boss-wave-timer" className="font-mono font-black text-red-200 bg-red-950/70 border border-red-500/30 px-2 py-0.5 rounded">
                  {formatSeconds(waveState.bossWaveRemainingSec)}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-slate-200 font-bold">
                <ShieldAlert className="w-4 h-4 text-cyan-400" />
                <span>현재 침공 마물:</span>
                <span id="active-monsters-count" className="font-black text-amber-300">
                  {waveState.activeMonstersCount}마리
                </span>
                <span className="text-[11px] text-slate-400">
                  (점령지 외곽 진입 → 중심부 코어 노림)
                </span>
              </div>
            </div>

            {/* Immediate Wave Trigger & Speed Test Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                id="trigger-regular-wave-btn"
                onClick={onTriggerRegularWave}
                className="px-2.5 py-1 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 text-white text-[11px] font-bold border border-emerald-400/50 transition active:scale-95"
                title="현실시간 30분 주기 마물(좀비/스켈레톤) 웨이브 즉시 출현 테스트"
              >
                🧟 30분 마물웨이브 출현
              </button>

              <button
                id="trigger-boss-wave-btn"
                onClick={onTriggerBossWave}
                className="px-2.5 py-1 rounded-lg bg-red-700/85 hover:bg-red-600 text-white text-[11px] font-bold border border-red-400/50 transition active:scale-95"
                title="현실시간 60분 주기 보스몬스터 즉시 출현 테스트"
              >
                👹 60분 보스몬스터 출현
              </button>

              <button
                id="toggle-timescale-btn"
                onClick={cycleTimeScale}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-bold border border-slate-600 flex items-center gap-1 transition active:scale-95"
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
                  title="마을 발전 및 건물 건설 검증용 자원(+500) 지급"
                >
                  🎁 자원+500
                </button>
              )}
            </div>
          </div>
        )}

        {/* Active Boss HP Bar Banner */}
        {waveState?.activeBoss && (
          <div
            id="active-boss-banner"
            className="w-full max-w-2xl mx-auto bg-red-950/90 border-2 border-red-500 rounded-2xl px-4 py-2 shadow-2xl pointer-events-auto animate-fadeIn"
          >
            <div className="flex items-center justify-between text-xs font-black text-red-200 mb-1">
              <span>{waveState.activeBoss.name} (목표: {waveState.activeBoss.targetTerritoryName})</span>
              <span>
                HP {waveState.activeBoss.hp} / {waveState.activeBoss.maxHp}
              </span>
            </div>
            <div className="w-full h-3 bg-black/70 rounded-full overflow-hidden border border-red-400/40">
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
                <img src="/assets/ui/Icons/Icon_01.png" alt="Stone" className="w-3.5 h-3.5 pixel-art" />
                <span className="font-extrabold text-slate-200 text-xs tabular-nums">{inventory.stone}</span>
              </div>
              <div className="flex items-center gap-0.5 wood-hud-slot px-1.5 py-0.5 rounded-lg">
                <img src="/assets/ui/Icons/Icon_03.png" alt="Gold" className="w-3.5 h-3.5 pixel-art" />
                <span className="font-extrabold text-yellow-300 text-xs tabular-nums">{inventory.gold}</span>
              </div>
            </div>

            <button
              onClick={onOpenVillageModal}
              className="px-2 py-1 bg-amber-500 text-black rounded-xl text-[11px] font-black shadow border border-amber-200"
            >
              🏘️ 마을/건설
            </button>

            <button
              onClick={onOpenMinimap}
              className="px-2 py-1 bg-slate-900 text-teal-200 rounded-xl text-[11px] font-black border border-teal-400/50"
            >
              🗺️ {unlockedCount}/{totalIslands}
            </button>
          </div>

          <div className="flex items-center gap-1 pointer-events-auto">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="relative w-8 h-8 active:scale-90 flex items-center justify-center"
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

        {/* Mobile Compact Wave Bar */}
        {waveState && (
          <div className="flex items-center justify-between bg-slate-950/90 border border-red-500/40 px-2.5 py-1 rounded-xl text-[10px] text-white pointer-events-auto">
            <div className="flex items-center gap-2">
              <span>🧟30분: <b>{formatSeconds(waveState.regularWaveRemainingSec)}</b></span>
              <span>👹60분: <b className="text-red-300">{formatSeconds(waveState.bossWaveRemainingSec)}</b></span>
              <span>마물: <b className="text-amber-300">{waveState.activeMonstersCount}</b></span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={onTriggerRegularWave}
                className="px-1.5 py-0.5 rounded bg-emerald-700 text-white font-bold"
              >
                웨이브
              </button>
              <button
                onClick={onTriggerBossWave}
                className="px-1.5 py-0.5 rounded bg-red-700 text-white font-bold"
              >
                보스
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 3. SETTINGS & MENU MODAL                                  */}
      {/* ======================================================== */}
      {showSettingsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 animate-fadeIn"
          onClick={() => setShowSettingsModal(false)}
        >
          <div
            className="w-full max-w-sm sm:max-w-md bg-[#162238] border-2 border-amber-600/60 rounded-3xl p-5 sm:p-6 shadow-2xl text-white flex flex-col gap-4 max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
              <div className="flex items-center gap-2">
                <img src="/assets/ui/Icons/Icon_10.png" alt="gear" className="w-5 h-5 pixel-art" />
                <h3 className="font-black text-lg text-amber-300">게임 설정 & 메뉴</h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="relative w-8 h-8 active:scale-90 transition-transform flex items-center justify-center"
              >
                <img
                  src="/assets/ui/Buttons/SmallRedRoundButton_Regular.png"
                  alt="close"
                  className="w-full h-full pixel-art select-none"
                />
                <img src="/assets/ui/Icons/Icon_09.png" alt="x" className="absolute w-3.5 h-3.5 pixel-art" />
              </button>
            </div>

            {/* Profile Section */}
            <div className="bg-black/40 border border-white/10 p-3.5 rounded-2xl flex flex-col gap-2.5">
              <div className="text-xs font-semibold text-slate-300">내 수호자 프로필</div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <button
                    onClick={toggleColor}
                    className={`w-9 h-9 rounded-full border-2 border-white/80 shadow-md transition transform active:scale-90 flex items-center justify-center ${
                      playerColor === 'blue' ? 'bg-blue-500' : 'bg-red-500'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-white">
                      {playerColor === 'blue' ? '청' : '홍'}
                    </span>
                  </button>
                  <input
                    type="text"
                    value={tempName}
                    maxLength={10}
                    onChange={(e) => setTempName(e.target.value)}
                    onBlur={() => setPlayerName(tempName.trim() || '수호자')}
                    className="bg-black/60 border border-white/20 text-white px-3 py-1.5 rounded-xl text-sm flex-1 outline-none focus:border-amber-400"
                    placeholder="수호자 이름"
                  />
                </div>
              </div>
            </div>

            {/* Audio Controls */}
            <div className="bg-black/40 border border-white/10 p-3.5 rounded-2xl flex flex-col gap-2">
              <div className="text-xs font-semibold text-slate-300">사운드 & 배경음악</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSound}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition active:scale-95 ${
                    isMuted
                      ? 'bg-red-500/20 border-red-500/40 text-red-300'
                      : 'bg-green-500/20 border-green-500/40 text-green-300'
                  }`}
                >
                  <img
                    src="/assets/ui/Icons/Icon_12.png"
                    alt="sound"
                    className={`w-4 h-4 pixel-art ${isMuted ? 'grayscale opacity-50' : ''}`}
                  />
                  <span>{isMuted ? '음소거 됨' : '사운드 켜짐'}</span>
                </button>

                <button
                  onClick={() => {
                    setShowSettingsModal(false);
                    setShowSoundModal(true);
                  }}
                  className="flex-1 flex items-center justify-between py-2 px-3 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded-xl text-amber-200 text-xs font-bold transition"
                >
                  <span>BGM & 음향 상세</span>
                  <span className="text-[10px] text-slate-300 font-mono">
                    {soundSettings.bgmEnabled && !soundSettings.muted ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  setShowHelp(true);
                }}
                className="flex-1 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <img src="/assets/ui/Icons/Icon_11.png" alt="guide" className="w-4 h-4 pixel-art" />
                타워디펜스 기획 & 조작 가이드
              </button>

              {onResetGame && (
                <button
                  onClick={onResetGame}
                  className="py-2.5 px-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <RotateCcw className="w-4 h-4" />
                  초기화
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. HELP / GAME DESIGN GUIDE MODAL                         */}
      {/* ======================================================== */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#162238] border-2 border-amber-600/60 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-amber-500/20 mb-3">
              <h3 className="text-lg sm:text-xl font-black text-amber-300 flex items-center gap-2">
                <img src="/assets/ui/Icons/Icon_05.png" alt="sword" className="w-5 h-5 pixel-art" />
                <span>협동 실시간 마을 타워디펜스 가이드</span>
              </h3>
              <button
                onClick={() => setShowHelp(false)}
                className="relative w-8 h-8 active:scale-90 transition-transform flex items-center justify-center"
              >
                <img
                  src="/assets/ui/Buttons/SmallRedRoundButton_Regular.png"
                  alt="close"
                  className="w-full h-full pixel-art select-none"
                />
                <img src="/assets/ui/Icons/Icon_09.png" alt="x" className="absolute w-3.5 h-3.5 pixel-art" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-200 leading-relaxed">
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl">
                <div className="font-extrabold text-amber-300 text-sm mb-1">
                  🏰 핵심 게임 규칙 (멀티플레이 협동 실시간 타워디펜스)
                </div>
                <ul className="space-y-1 text-slate-300">
                  <li>• <b>마을 단위 영지:</b> 중심 마을은 처음부터 <b>중소마을</b>이며 4방면에 <b>나무 방책</b>이 설치되어 있습니다.</li>
                  <li>• <b>인접 땅 자원 풍요:</b> 중심 마을과 인접한 땅은 자원이 풍부하며(채집량 2배), 땅을 넓혀가며 자원을 확보할 수 있습니다.</li>
                  <li>• <b>마을 발전 6단계:</b> 점령한 땅은 <b>마을 → 중소마을 → 큰마을 → 소도시 → 중소도시 → 대도시</b>로 발전시킬 수 있습니다.</li>
                  <li>• <b>4대 건물 건설:</b> 점령한 땅에 <b>방어 타워, 성벽(나무 방책/석조 성벽), 기본건물, 특수건물</b>을 건설할 수 있습니다.</li>
                  <li>• <b>30분 마물 & 60분 보스 침공:</b> 현실 시간 30분마다 좀비·스켈레톤 등 마물이, 60분마다 보스몬스터가 출현합니다.</li>
                  <li>• <b>외곽 진입 & 코어 보석 파괴 시 땅 상실:</b> 마물 웨이브는 점령한 땅 외곽에서부터 진입하여 중심부를 노리며, 점령한 땅의 <b>코어 보석</b>이 부숴지면 해당 땅을 잃게 됩니다!</li>
                </ul>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => setShowHelp(false)}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl shadow-lg transition text-sm"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      <SoundModal isOpen={showSoundModal} onClose={() => setShowSoundModal(false)} />
    </>
  );
};
