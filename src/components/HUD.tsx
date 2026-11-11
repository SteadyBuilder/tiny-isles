import React, { useState } from 'react';
import { Inventory, PlayerColor } from '../types/game';
import { sound } from '../lib/sound';
import {
  Volume2,
  VolumeX,
  Users,
  HelpCircle,
  Share2,
  Check,
  RotateCcw,
  MapPin,
  Settings,
  X,
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
  const [isMuted, setIsMuted] = useState(sound.isMuted());
  const [showHelp, setShowHelp] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(playerName);
  const [copied, setCopied] = useState(false);

  const toggleSound = () => {
    sound.toggleMute();
    setIsMuted(sound.isMuted());
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
        {/* Left: Inventory Resources & Island Progress */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Resources */}
          <div className="flex items-center gap-2 bg-black/65 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 shadow-xl">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-950/40 rounded-xl border border-amber-500/30">
              <span className="text-xl">🪵</span>
              <span className="font-extrabold text-amber-200 text-lg min-w-[28px]">{inventory.wood}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/40 rounded-xl border border-slate-400/30">
              <span className="text-xl">🪨</span>
              <span className="font-extrabold text-slate-200 text-lg min-w-[28px]">{inventory.stone}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-yellow-950/40 rounded-xl border border-yellow-500/30">
              <span className="text-xl">🪙</span>
              <span className="font-extrabold text-yellow-300 text-lg min-w-[28px]">{inventory.gold}</span>
            </div>
          </div>

          {/* Island Explorer Badge (Click to open map) */}
          <button
            onClick={onOpenMinimap}
            className="flex items-center gap-2 bg-black/65 backdrop-blur-md px-3 py-2 rounded-2xl border border-emerald-500/30 shadow-xl hover:bg-emerald-950/40 transition active:scale-95"
            title="클릭하여 전체 군도 지도 보기"
          >
            <Compass className="w-5 h-5 text-emerald-400" />
            <div className="flex flex-col leading-none text-left">
              <span className="text-[10px] text-emerald-400 font-semibold tracking-wider uppercase">군도 개척</span>
              <span className="font-extrabold text-white text-sm">
                <span className="text-emerald-300">{unlockedCount}</span>
                <span className="text-white/40 mx-0.5">/</span>
                <span>{totalIslands}</span>
              </span>
            </div>
          </button>
        </div>

        {/* Center: Online Status & Room Code */}
        <div className="flex items-center gap-3 pointer-events-auto bg-black/65 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 shadow-xl">
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

        {/* Right: Controls & Player Profile */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Player Name / Color */}
          <div className="flex items-center gap-2 bg-black/65 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10 shadow-xl text-sm">
            <button
              onClick={toggleColor}
              className={`w-6 h-6 rounded-full border-2 border-white/70 shadow-sm transition transform hover:scale-110 active:scale-90 ${
                playerColor === 'blue' ? 'bg-blue-500' : 'bg-red-500'
              }`}
              title="캐릭터 색상 변경 (Blue / Red)"
            />
            {isEditingName ? (
              <input
                type="text"
                value={tempName}
                maxLength={10}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={() => {
                  setPlayerName(tempName.trim() || '모험가');
                  setIsEditingName(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setPlayerName(tempName.trim() || '모험가');
                    setIsEditingName(false);
                  }
                }}
                autoFocus
                className="bg-white/20 text-white px-2 py-0.5 rounded text-xs w-20 outline-none"
              />
            ) : (
              <span
                onClick={() => setIsEditingName(true)}
                className="cursor-pointer hover:underline text-white font-medium text-xs max-w-[80px] truncate"
                title="클릭하여 이름 변경"
              >
                {playerName}
              </span>
            )}
          </div>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="p-2.5 bg-black/65 backdrop-blur-md hover:bg-black/80 active:scale-95 text-white rounded-2xl border border-white/10 shadow-xl transition"
            title={isMuted ? '음소거 해제' : '음소거'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-green-400" />}
          </button>

          {/* Help Toggle */}
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="p-2.5 bg-black/65 backdrop-blur-md hover:bg-black/80 active:scale-95 text-white rounded-2xl border border-white/10 shadow-xl transition"
            title="조작법 안내"
          >
            <HelpCircle className="w-4 h-4 text-amber-300" />
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. MOBILE HUD (sm:hidden)                                */}
      {/* ======================================================== */}
      <div
        className="sm:hidden absolute top-2 left-2 right-2 z-30 flex items-center justify-between pointer-events-none"
        style={{ top: 'max(0.6rem, env(safe-area-inset-top, 0.6rem))' }}
      >
        {/* Mobile Left: Compact Resource Bar */}
        <div className="flex items-center gap-1.5 bg-black/75 backdrop-blur-md px-2.5 py-1.5 rounded-2xl border border-white/15 shadow-xl pointer-events-auto">
          <div className="flex items-center gap-1">
            <span className="text-sm">🪵</span>
            <span className="font-extrabold text-amber-200 text-xs">{inventory.wood}</span>
          </div>
          <div className="w-[1px] h-3 bg-white/20" />
          <div className="flex items-center gap-1">
            <span className="text-sm">🪨</span>
            <span className="font-extrabold text-slate-200 text-xs">{inventory.stone}</span>
          </div>
          <div className="w-[1px] h-3 bg-white/20" />
          <div className="flex items-center gap-1">
            <span className="text-sm">🪙</span>
            <span className="font-extrabold text-yellow-300 text-xs">{inventory.gold}</span>
          </div>
        </div>

        {/* Mobile Right: Utility Buttons Cluster */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Minimap Button */}
          <button
            onClick={onOpenMinimap}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-950/80 backdrop-blur-md active:scale-90 text-emerald-300 rounded-xl border border-emerald-500/40 shadow-xl font-bold text-xs"
            title="전체 지도"
          >
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            <span>{unlockedCount}/{totalIslands}</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="p-2 bg-black/75 backdrop-blur-md active:scale-90 text-white rounded-xl border border-white/15 shadow-xl"
            title={isMuted ? '음소거 해제' : '음소거'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-green-400" />}
          </button>

          {/* Mobile Menu & Profile Toggle */}
          <button
            onClick={() => setShowMobileMenu(true)}
            className="relative p-2 bg-black/75 backdrop-blur-md active:scale-90 text-white rounded-xl border border-white/15 shadow-xl flex items-center justify-center"
            title="모바일 메뉴 & 프로필"
          >
            <Settings className="w-4 h-4 text-amber-300" />
            {/* Online status indicator dot */}
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-black animate-pulse" />
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. MOBILE MENU / PROFILE DRAWER MODAL                    */}
      {/* ======================================================== */}
      {showMobileMenu && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-3 animate-fadeIn"
          onClick={() => setShowMobileMenu(false)}
        >
          <div
            className="w-full max-w-sm bg-[#14213d] border border-amber-500/40 rounded-3xl p-5 shadow-2xl text-white flex flex-col gap-4 max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-400" />
                <h3 className="font-black text-lg text-amber-300">메뉴 & 설정</h3>
              </div>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-1.5 hover:bg-white/10 rounded-full text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Section */}
            <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl flex flex-col gap-2.5">
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
                    className="bg-black/40 border border-white/20 text-white px-3 py-1.5 rounded-xl text-sm flex-1 outline-none focus:border-amber-400"
                    placeholder="모험가 이름"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400">
                색상 원을 터치하면 캐릭터 옷 색상(Blue / Red)이 변경됩니다.
              </p>
            </div>

            {/* Multiplayer & Invite Section */}
            <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <Users className="w-3.5 h-3.5" />
                  <span>실시간 온라인: {onlineCount}명</span>
                </div>
              </div>
              <button
                onClick={handleCopyLink}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-white/10 hover:bg-white/20 active:scale-95 rounded-xl text-xs font-bold text-white transition border border-white/10"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Share2 className="w-4 h-4" />}
                <span>{copied ? '초대 링크가 복사되었습니다!' : '친구 초대 링크 복사'}</span>
              </button>
            </div>

            {/* Archipelago Map Quick Access */}
            <button
              onClick={() => {
                setShowMobileMenu(false);
                onOpenMinimap?.();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600/30 hover:bg-emerald-600/40 active:scale-95 border border-emerald-500/50 rounded-2xl text-emerald-200 font-bold text-sm transition"
            >
              <Compass className="w-4 h-4 text-emerald-400" />
              <span>🗺️ 전체 군도 지도 보기 ({unlockedCount}/{totalIslands})</span>
            </button>

            {/* Action Buttons: Help & Reset */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  setShowHelp(true);
                }}
                className="flex-1 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 border border-amber-500/40 text-amber-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <HelpCircle className="w-4 h-4" />
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
          <div className="bg-[#1e293b] border border-amber-500/40 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <h3 className="text-lg sm:text-xl font-bold text-amber-400 flex items-center gap-2">
                <span>⚔️ Tiny Isles 가이드</span>
              </h3>
              <button
                onClick={() => setShowHelp(false)}
                className="p-1.5 hover:bg-white/10 rounded-full text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-slate-200">
              {/* Mobile Controls Guide */}
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl">
                <span className="font-extrabold text-amber-300 block mb-1 text-sm">📱 스마트폰 조작법</span>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  <li>• <strong className="text-white">이동:</strong> 왼쪽 하단의 <strong>가상 조이스틱</strong>을 드래그하여 자유롭게 이동</li>
                  <li>• <strong className="text-white">채집/행동:</strong> 오른쪽 하단 <strong>⚔️ 버튼</strong>을 탭하거나 화면의 나무/바위를 직접 터치</li>
                  <li>• <strong className="text-white">섬 개척:</strong> 새 섬 표지판에 다가가면 나타나는 <strong>🏝️ [개척] 버튼</strong> 터치</li>
                  <li>• <strong className="text-white">전체 지도:</strong> 상단 <strong>🗺️ 버튼</strong>을 터치해 21개 섬 위치와 해금 현황 확인</li>
                </ul>
              </div>

              {/* PC Controls Guide */}
              <div className="bg-white/5 p-3 rounded-2xl">
                <span className="font-extrabold text-slate-300 block mb-1 text-sm">💻 PC 키보드 & 마우스 조작법</span>
                <ul className="space-y-1 text-xs text-slate-400">
                  <li>• 이동: <kbd className="px-1 py-0.5 bg-slate-700 rounded text-[11px] text-white">W</kbd><kbd className="px-1 py-0.5 bg-slate-700 rounded text-[11px] text-white ml-0.5">A</kbd><kbd className="px-1 py-0.5 bg-slate-700 rounded text-[11px] text-white ml-0.5">S</kbd><kbd className="px-1 py-0.5 bg-slate-700 rounded text-[11px] text-white ml-0.5">D</kbd> 또는 마우스 클릭</li>
                  <li>• 채집: <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-[11px] text-white">Space</kbd> 또는 마우스 클릭</li>
                  <li>• 섬 개척: 표지판 근처에서 <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-[11px] text-white">E</kbd> 키 누르기</li>
                </ul>
              </div>

              {/* Multiplayer and Save Info */}
              <div className="flex items-start gap-2.5 bg-white/5 p-2.5 rounded-xl">
                <span className="font-bold text-amber-300 shrink-0">🌐 멀티플레이</span>
                <span className="text-xs text-slate-300">
                  [친구 초대] 링크를 공유해 다른 스마트폰이나 PC로 접속하면 같은 월드에서 실시간으로 함께 플레이할 수 있습니다.
                </span>
              </div>

              <div className="flex items-start gap-2.5 bg-white/5 p-2.5 rounded-xl">
                <span className="font-bold text-emerald-300 shrink-0">💾 자동 저장</span>
                <span className="text-xs text-slate-300">
                  자원과 군도 개척 상태는 브라우저에 자동 저장되어 언제든 다시 접속해 이어서 즐길 수 있습니다.
                </span>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              {onResetGame && (
                <button
                  onClick={onResetGame}
                  className="px-3.5 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
                  title="자원 및 해금 상태 리셋"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  초기화
                </button>
              )}
              <button
                onClick={() => setShowHelp(false)}
                className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-extrabold rounded-xl shadow-lg transition text-sm"
              >
                확인하고 시작하기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
