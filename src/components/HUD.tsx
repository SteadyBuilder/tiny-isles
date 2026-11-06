import React, { useState } from 'react';
import { Inventory, PlayerColor } from '../types/game';
import { sound } from '../lib/sound';
import { Volume2, VolumeX, Users, HelpCircle, Palette, Share2, Check } from 'lucide-react';

interface HUDProps {
  inventory: Inventory;
  onlineCount: number;
  playerName: string;
  setPlayerName: (name: string) => void;
  playerColor: PlayerColor;
  setPlayerColor: (color: PlayerColor) => void;
}

export const HUD: React.FC<HUDProps> = ({
  inventory,
  onlineCount,
  playerName,
  setPlayerName,
  playerColor,
  setPlayerColor,
}) => {
  const [isMuted, setIsMuted] = useState(sound.isMuted());
  const [showHelp, setShowHelp] = useState(false);
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
      {/* Top Main HUD Bar */}
      <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
        {/* Left: Inventory Resources */}
        <div className="flex items-center gap-2 pointer-events-auto bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 shadow-xl">
          <div className="flex items-center gap-2 px-2 py-1 bg-amber-950/40 rounded-xl border border-amber-500/30">
            <span className="text-xl">🪵</span>
            <span className="font-extrabold text-amber-200 text-lg min-w-[28px]">{inventory.wood}</span>
          </div>
          <div className="flex items-center gap-2 px-2 py-1 bg-slate-800/40 rounded-xl border border-slate-400/30">
            <span className="text-xl">🪨</span>
            <span className="font-extrabold text-slate-200 text-lg min-w-[28px]">{inventory.stone}</span>
          </div>
          <div className="flex items-center gap-2 px-2 py-1 bg-yellow-950/40 rounded-xl border border-yellow-500/30">
            <span className="text-xl">🪙</span>
            <span className="font-extrabold text-yellow-300 text-lg min-w-[28px]">{inventory.gold}</span>
          </div>
        </div>

        {/* Center: Online Status & Room Code */}
        <div className="hidden sm:flex items-center gap-3 pointer-events-auto bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 shadow-xl">
          <div className="flex items-center gap-1.5 text-emerald-400 text-sm font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <Users className="w-4 h-4 ml-1" />
            <span>실시간 접속: {onlineCount}명</span>
          </div>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 text-white/90 px-2.5 py-1 rounded-lg transition"
            title="친구 초대 링크 복사"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copied ? '복사됨!' : '친구 초대'}</span>
          </button>
        </div>

        {/* Right: Controls & Player Profile */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Player Name / Color */}
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10 shadow-xl text-sm">
            <button
              onClick={toggleColor}
              className={`w-6 h-6 rounded-full border-2 border-white/70 shadow-sm transition transform hover:scale-110 ${
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
            className="p-2.5 bg-black/60 backdrop-blur-md hover:bg-black/80 text-white rounded-2xl border border-white/10 shadow-xl transition"
            title={isMuted ? '음소거 해제' : '음소거'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-green-400" />}
          </button>

          {/* Help Toggle */}
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="p-2.5 bg-black/60 backdrop-blur-md hover:bg-black/80 text-white rounded-2xl border border-white/10 shadow-xl transition"
            title="조작법 안내"
          >
            <HelpCircle className="w-4 h-4 text-amber-300" />
          </button>
        </div>
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1e293b] border border-amber-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl text-white">
            <h3 className="text-xl font-bold mb-4 text-amber-400 flex items-center gap-2">
              <span>⚔️ Tiny Isles 가이드</span>
            </h3>

            <div className="space-y-3 text-sm text-slate-200">
              <div className="flex items-start gap-3 bg-white/5 p-3 rounded-xl">
                <span className="font-bold text-amber-300 w-16 shrink-0">이동</span>
                <span>키보드 <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">W</kbd><kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs ml-1">A</kbd><kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs ml-1">S</kbd><kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs ml-1">D</kbd> 또는 방향키, 화면 클릭/터치</span>
              </div>

              <div className="flex items-start gap-3 bg-white/5 p-3 rounded-xl">
                <span className="font-bold text-amber-300 w-16 shrink-0">채집/행동</span>
                <span>
                  자원 근처에서 <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">Space</kbd> 또는 마우스 클릭 / 터치
                  <br />
                  <span className="text-xs text-slate-400">• 나무 근처: 도끼로 벌목 🪵</span>
                  <br />
                  <span className="text-xs text-slate-400">• 바위 근처: 곡괭이로 채광 🪨 / 🪙</span>
                </span>
              </div>

              <div className="flex items-start gap-3 bg-white/5 p-3 rounded-xl">
                <span className="font-bold text-amber-300 w-16 shrink-0">영토 확장</span>
                <span>
                  새로운 섬 표지판에 다가가 <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">E</kbd> 키 또는 클릭
                  <br />
                  <span className="text-xs text-slate-400">• 목재와 석재를 모아 바다 위의 새로운 섬을 해금하세요!</span>
                </span>
              </div>

              <div className="flex items-start gap-3 bg-white/5 p-3 rounded-xl">
                <span className="font-bold text-amber-300 w-16 shrink-0">멀티플레이</span>
                <span>
                  오른쪽 상단 [친구 초대] 링크를 복사해 다른 브라우저 탭이나 스마트폰으로 접속하면 같은 섬에서 실시간으로 마주칩니다!
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowHelp(false)}
              className="mt-6 w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-extrabold rounded-xl shadow-lg transition"
            >
              확인하고 시작하기
            </button>
          </div>
        </div>
      )}
    </>
  );
};
