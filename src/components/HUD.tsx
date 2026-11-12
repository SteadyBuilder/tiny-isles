import React, { useState, useEffect } from 'react';
import { Inventory, PlayerColor } from '../types/game';
import { sound, SoundSettings } from '../lib/sound';
import { SoundModal } from './SoundModal';
import {
  Users,
  Share2,
  Check,
  RotateCcw,
  Compass,
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
  onResetGame?: () => void;
  onOpenMinimap?: () => void;
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
  onResetGame,
  onOpenMinimap,
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

  return (
    <>
      {/* ======================================================== */}
      {/* 1. DESKTOP HUD (sm: and above)                           */}
      {/* ======================================================== */}
      <div className="hidden sm:flex absolute top-4 left-4 right-4 z-30 items-center justify-between pointer-events-none">
        {/* Left: Wood Styled Resource Bar & Territory Ribbon */}
        <div className="flex items-center gap-3 pointer-events-auto">
          {/* Wood HUD Bar */}
          <div className="wood-hud-panel px-4 py-2 rounded-2xl flex items-center gap-3">
            {/* Wood */}
            <div className="flex items-center gap-1.5 wood-hud-slot px-2.5 py-1 rounded-xl">
              <img
                src="/assets/ui/Icons/Icon_02.png"
                alt="Wood"
                className="w-6 h-6 pixel-art select-none drop-shadow"
              />
              <span className="font-black text-amber-200 text-lg min-w-[28px] tabular-nums">
                {inventory.wood}
              </span>
            </div>

            {/* Stone / Hammer */}
            <div className="flex items-center gap-1.5 wood-hud-slot px-2.5 py-1 rounded-xl">
              <img
                src="/assets/ui/Icons/Icon_01.png"
                alt="Stone"
                className="w-6 h-6 pixel-art select-none drop-shadow"
              />
              <span className="font-black text-slate-200 text-lg min-w-[28px] tabular-nums">
                {inventory.stone}
              </span>
            </div>

            {/* Gold */}
            <div className="flex items-center gap-1.5 wood-hud-slot px-2.5 py-1 rounded-xl">
              <img
                src="/assets/ui/Icons/Icon_03.png"
                alt="Gold"
                className="w-6 h-6 pixel-art select-none drop-shadow"
              />
              <span className="font-black text-yellow-300 text-lg min-w-[28px] tabular-nums">
                {inventory.gold}
              </span>
            </div>
          </div>

          {/* Territory Explorer Ribbon Badge (Click to open map) */}
          <button
            onClick={onOpenMinimap}
            className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-teal-800 to-cyan-900 border-2 border-teal-400/60 rounded-2xl shadow-xl hover:brightness-110 active:scale-95 transition"
            title="클릭하여 군도 전체 영지 지도 보기"
          >
            <img
              src="/assets/ui/Icons/Icon_05.png"
              alt="Sword"
              className="w-5 h-5 pixel-art select-none"
            />
            <div className="flex flex-col leading-none text-left">
              <span className="text-[10px] text-teal-300 font-black tracking-wider uppercase">
                영지 개척
              </span>
              <span className="font-extrabold text-white text-sm">
                <span className="text-teal-200">{unlockedCount}</span>
                <span className="text-white/40 mx-0.5">/</span>
                <span>{totalIslands}</span>
              </span>
            </div>
          </button>
        </div>

        {/* Center: Online Status & Room Code */}
        <div className="flex items-center gap-3 pointer-events-auto bg-black/70 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/15 shadow-xl">
          <div className="flex items-center gap-1.5 text-emerald-400 text-sm font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <Users className="w-4 h-4" />
            <span>실시간 접속: {onlineCount}명</span>
          </div>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 px-2.5 py-1 rounded-lg transition"
            title="친구 초대 링크 복사"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copied ? '복사됨!' : '친구 초대'}</span>
          </button>
        </div>

        {/* Right: Tiny Swords Pixel Art Round Buttons */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Audio Quick Mute Button */}
          <button
            onClick={toggleSound}
            className="relative w-11 h-11 active:scale-90 transition-transform flex items-center justify-center group"
            title={isMuted ? '음소거 해제' : '음소거'}
          >
            <img
              src="/assets/ui/Buttons/SmallBlueRoundButton_Regular.png"
              alt="Sound button"
              className="w-full h-full pixel-art select-none group-active:brightness-90"
            />
            <img
              src="/assets/ui/Icons/Icon_12.png"
              alt="Music"
              className={`absolute w-5 h-5 pixel-art ${isMuted ? 'opacity-35 grayscale' : ''}`}
            />
            {isMuted && (
              <span className="absolute text-red-500 font-black text-lg select-none">✕</span>
            )}
          </button>

          {/* Minimap Button */}
          <button
            onClick={onOpenMinimap}
            className="relative w-11 h-11 active:scale-90 transition-transform flex items-center justify-center group"
            title="군도 영지 지도"
          >
            <img
              src="/assets/ui/Buttons/SmallBlueRoundButton_Regular.png"
              alt="Map button"
              className="w-full h-full pixel-art select-none group-active:brightness-90"
            />
            <Compass className="absolute w-5 h-5 text-amber-100 group-hover:rotate-12 transition-transform" />
          </button>

          {/* Settings Button */}
          <button
            onClick={() => {
              sound.playClick();
              setShowSettingsModal(true);
            }}
            className="relative w-11 h-11 active:scale-90 transition-transform flex items-center justify-center group"
            title="게임 설정 & 메뉴"
          >
            <img
              src="/assets/ui/Buttons/SmallBlueRoundButton_Regular.png"
              alt="Settings button"
              className="w-full h-full pixel-art select-none group-active:brightness-90"
            />
            <img
              src="/assets/ui/Icons/Icon_10.png"
              alt="Gear"
              className="absolute w-5 h-5 pixel-art group-hover:rotate-45 transition-transform"
            />
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. MOBILE HUD (sm:hidden - Appropriate Compact Sizing)   */}
      {/* ======================================================== */}
      <div
        className="sm:hidden absolute top-2 left-2 right-2 z-30 flex items-center justify-between pointer-events-none"
        style={{ top: 'max(0.5rem, env(safe-area-inset-top, 0.5rem))' }}
      >
        {/* Mobile Left: Wood Styled Compact Resource Plaque */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <div className="wood-hud-panel px-2 py-1 rounded-xl flex items-center gap-1.5 shadow-xl">
            {/* Wood */}
            <div className="flex items-center gap-1 wood-hud-slot px-1.5 py-0.5 rounded-lg">
              <img
                src="/assets/ui/Icons/Icon_02.png"
                alt="Wood"
                className="w-4 h-4 pixel-art select-none"
              />
              <span className="font-extrabold text-amber-200 text-xs tabular-nums">
                {inventory.wood}
              </span>
            </div>

            {/* Stone */}
            <div className="flex items-center gap-1 wood-hud-slot px-1.5 py-0.5 rounded-lg">
              <img
                src="/assets/ui/Icons/Icon_01.png"
                alt="Stone"
                className="w-4 h-4 pixel-art select-none"
              />
              <span className="font-extrabold text-slate-200 text-xs tabular-nums">
                {inventory.stone}
              </span>
            </div>

            {/* Gold */}
            <div className="flex items-center gap-1 wood-hud-slot px-1.5 py-0.5 rounded-lg">
              <img
                src="/assets/ui/Icons/Icon_03.png"
                alt="Gold"
                className="w-4 h-4 pixel-art select-none"
              />
              <span className="font-extrabold text-yellow-300 text-xs tabular-nums">
                {inventory.gold}
              </span>
            </div>
          </div>

          {/* Mobile Territory Ribbon Badge */}
          <button
            onClick={onOpenMinimap}
            className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-teal-800 to-cyan-900 border border-teal-400/60 rounded-xl shadow-lg active:scale-95 transition"
            title="지도 보기"
          >
            <img
              src="/assets/ui/Icons/Icon_05.png"
              alt="Sword"
              className="w-3.5 h-3.5 pixel-art"
            />
            <span className="text-[11px] font-black text-teal-200">
              {unlockedCount}/{totalIslands}
            </span>
          </button>
        </div>

        {/* Mobile Right: Tiny Swords Pixel Art Round Buttons */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Audio Quick Mute Button */}
          <button
            onClick={toggleSound}
            className="relative w-9 h-9 active:scale-90 transition-transform flex items-center justify-center group"
            title={isMuted ? '음소거 해제' : '음소거'}
          >
            <img
              src="/assets/ui/Buttons/SmallBlueRoundButton_Regular.png"
              alt="Sound"
              className="w-full h-full pixel-art select-none group-active:brightness-90"
            />
            <img
              src="/assets/ui/Icons/Icon_12.png"
              alt="Music"
              className={`absolute w-4 h-4 pixel-art ${isMuted ? 'opacity-35 grayscale' : ''}`}
            />
            {isMuted && (
              <span className="absolute text-red-500 font-black text-xs select-none">✕</span>
            )}
          </button>

          {/* Settings Button */}
          <button
            onClick={() => {
              sound.playClick();
              setShowSettingsModal(true);
            }}
            className="relative w-9 h-9 active:scale-90 transition-transform flex items-center justify-center group"
            title="게임 설정 & 메뉴"
          >
            <img
              src="/assets/ui/Buttons/SmallBlueRoundButton_Regular.png"
              alt="Settings"
              className="w-full h-full pixel-art select-none group-active:brightness-90"
            />
            <img
              src="/assets/ui/Icons/Icon_10.png"
              alt="Gear"
              className="absolute w-4 h-4 pixel-art group-hover:rotate-45 transition-transform"
            />
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. SETTINGS & MENU MODAL (Universal: Desktop & Mobile)    */}
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
            {/* Modal Header with Blue Ribbon Style */}
            <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
              <div className="flex items-center gap-2">
                <img src="/assets/ui/Icons/Icon_10.png" alt="gear" className="w-5 h-5 pixel-art" />
                <h3 className="font-black text-lg text-amber-300">게임 설정 & 메뉴</h3>
              </div>
              {/* Close Button using Small Red Round Button */}
              <button
                onClick={() => setShowSettingsModal(false)}
                className="relative w-8 h-8 active:scale-90 transition-transform flex items-center justify-center"
                title="닫기"
              >
                <img
                  src="/assets/ui/Buttons/SmallRedRoundButton_Regular.png"
                  alt="close"
                  className="w-full h-full pixel-art select-none"
                />
                <img
                  src="/assets/ui/Icons/Icon_09.png"
                  alt="x"
                  className="absolute w-3.5 h-3.5 pixel-art"
                />
              </button>
            </div>

            {/* Profile Section */}
            <div className="bg-black/40 border border-white/10 p-3.5 rounded-2xl flex flex-col gap-2.5">
              <div className="text-xs font-semibold text-slate-300">내 모험가 프로필</div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <button
                    onClick={toggleColor}
                    className={`w-9 h-9 rounded-full border-2 border-white/80 shadow-md transition transform active:scale-90 flex items-center justify-center ${
                      playerColor === 'blue' ? 'bg-blue-500' : 'bg-red-500'
                    }`}
                    title="색상 변경 (Blue / Red)"
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
                    onBlur={() => setPlayerName(tempName.trim() || '모험가')}
                    className="bg-black/60 border border-white/20 text-white px-3 py-1.5 rounded-xl text-sm flex-1 outline-none focus:border-amber-400"
                    placeholder="모험가 이름"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400">
                색상 원을 클릭/터치하면 캐릭터 의상 색상(Blue / Red)이 변경됩니다.
              </p>
            </div>

            {/* Audio & Music Quick Controls */}
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
                  title={isMuted ? '음소거 해제' : '음소거'}
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
                  className="flex-1 flex items-center justify-between py-2 px-3 bg-amber-500/15 hover:bg-amber-500/25 active:scale-95 border border-amber-500/30 rounded-xl text-amber-200 text-xs font-bold transition"
                >
                  <div className="flex items-center gap-1.5">
                    <img src="/assets/ui/Icons/Icon_12.png" alt="bgm" className="w-4 h-4 pixel-art" />
                    <span>BGM & 음향 상세</span>
                  </div>
                  <span className="text-[10px] text-slate-300 font-mono">
                    {soundSettings.bgmEnabled && !soundSettings.muted ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>
            </div>

            {/* Archipelago Map Quick Access */}
            <button
              onClick={() => {
                setShowSettingsModal(false);
                onOpenMinimap?.();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-teal-700 to-cyan-800 hover:brightness-110 active:scale-95 border border-teal-400/60 rounded-2xl text-teal-100 font-bold text-sm transition shadow-lg"
            >
              <img src="/assets/ui/Icons/Icon_05.png" alt="map" className="w-4 h-4 pixel-art" />
              <span>🗺️ 전체 군도 지도 보기 ({unlockedCount}/{totalIslands})</span>
            </button>

            {/* Multiplayer & Invite Section */}
            <div className="bg-black/40 border border-white/10 p-3.5 rounded-2xl flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <Users className="w-3.5 h-3.5" />
                  <span>실시간 온라인: {onlineCount}명</span>
                </div>
              </div>
              <button
                onClick={handleCopyLink}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white/10 hover:bg-white/20 active:scale-95 rounded-xl text-xs font-bold text-white transition border border-white/10"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Share2 className="w-4 h-4" />}
                <span>{copied ? '초대 링크가 복사되었습니다!' : '친구 초대 링크 복사'}</span>
              </button>
            </div>

            {/* Action Buttons: Help & Reset */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  setShowHelp(true);
                }}
                className="flex-1 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 border border-amber-500/40 text-amber-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <img src="/assets/ui/Icons/Icon_11.png" alt="guide" className="w-4 h-4 pixel-art" />
                조작 가이드
              </button>

              {onResetGame && (
                <button
                  onClick={onResetGame}
                  className="py-2.5 px-3 bg-red-500/20 hover:bg-red-500/30 active:scale-95 border border-red-500/40 text-red-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                  title="게임 초기화"
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
      {/* 4. HELP / GUIDE MODAL (Universal: Mobile & Desktop)       */}
      {/* ======================================================== */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#162238] border-2 border-amber-600/60 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-amber-500/20 mb-3">
              <h3 className="text-lg sm:text-xl font-black text-amber-300 flex items-center gap-2">
                <img src="/assets/ui/Icons/Icon_05.png" alt="sword" className="w-5 h-5 pixel-art" />
                <span>Tiny Isles 모험 가이드</span>
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
                <img
                  src="/assets/ui/Icons/Icon_09.png"
                  alt="x"
                  className="absolute w-3.5 h-3.5 pixel-art"
                />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-slate-200">
              {/* Mobile Screen Touch Controls Guide */}
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl">
                <span className="font-extrabold text-amber-300 block mb-1 text-sm flex items-center gap-1.5">
                  <img src="/assets/ui/Cursors/Cursor_02.png" alt="touch" className="w-4 h-4 pixel-art inline" />
                  📱 스마트폰 화면 터치 조작법
                </span>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  <li>• <strong className="text-white">화면 터치 이동:</strong> 가고 싶은 위치를 탭하거나 드래그하여 유지하면 캐릭터가 자연스럽게 따라 움직입니다.</li>
                  <li>• <strong className="text-white">스마트 터치 채집/공격:</strong> 나무, 바위, 양, 코어를 터치하면 다가가서 즉시 채집하며, <strong>손가락을 대고 있으면 연속 채집</strong>됩니다.</li>
                  <li>• <strong className="text-white">영지 개척:</strong> 미개척 영지에 다가가면 나타나는 <strong>🚩 [개척 배너]</strong>나 제단을 터치해 즉시 개척할 수 있습니다.</li>
                  <li>• <strong className="text-white">화면 줌 조절:</strong> <strong>두 손가락 핀치 제스처</strong>(벌리기: 확대, 모으기: 축소)로 자유롭게 시야를 변경합니다.</li>
                </ul>
              </div>

              {/* PC Controls Guide */}
              <div className="bg-black/40 border border-white/10 p-3 rounded-2xl">
                <span className="font-extrabold text-slate-300 block mb-1 text-sm">💻 PC 키보드 & 마우스 조작법</span>
                <ul className="space-y-1 text-xs text-slate-400">
                  <li>• 이동: <kbd className="px-1 py-0.5 bg-slate-700 rounded text-[11px] text-white">W</kbd><kbd className="px-1 py-0.5 bg-slate-700 rounded text-[11px] text-white ml-0.5">A</kbd><kbd className="px-1 py-0.5 bg-slate-700 rounded text-[11px] text-white ml-0.5">S</kbd><kbd className="px-1 py-0.5 bg-slate-700 rounded text-[11px] text-white ml-0.5">D</kbd> 또는 마우스 클릭</li>
                  <li>• 채집/공격: <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-[11px] text-white">Space</kbd> 키 누르고 있기 또는 대상 마우스 클릭</li>
                  <li>• 영지 코어 공명 & 개척: 코어 및 개척 제단 근처에서 <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-[11px] text-white">E</kbd> 키 또는 터치</li>
                  <li>• 시야/줌: <strong className="text-white">마우스 휠 스크롤</strong></li>
                </ul>
              </div>

              {/* Multiplayer and Save Info */}
              <div className="flex items-start gap-2.5 bg-black/40 border border-white/10 p-2.5 rounded-xl">
                <img src="/assets/ui/Icons/Icon_06.png" alt="shield" className="w-4 h-4 pixel-art shrink-0 mt-0.5" />
                <span className="text-xs text-slate-300">
                  <strong className="text-amber-300">멀티플레이 & 자동저장:</strong> 초대 링크를 복사해 다른 사람과 공유하면 실시간으로 같은 군도에서 플레이할 수 있으며, 자원과 개척 상태는 브라우저와 클라우드에 영구 보존됩니다.
                </span>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={() => setShowHelp(false)}
                className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black rounded-xl shadow-lg transition text-sm"
              >
                확인하고 시작하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. SOUND / AUDIO MODAL (Universal: Mobile & Desktop)     */}
      {/* ======================================================== */}
      <SoundModal
        isOpen={showSoundModal}
        onClose={() => setShowSoundModal(false)}
      />
    </>
  );
};
