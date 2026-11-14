import React, { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { PlayerColor } from '../types/game';
import { sound, SoundSettings } from '../lib/sound';
import { EventBus } from '../game/phaser/EventBus';

interface HudSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  setPlayerName: (name: string) => void;
  playerColor: PlayerColor;
  setPlayerColor: (color: PlayerColor) => void;
  soundSettings: SoundSettings;
  isMuted: boolean;
  onToggleSound: () => void;
  onOpenSoundModal: () => void;
  onOpenHelp: () => void;
  onResetGame?: () => void;
}

export const HudSettingsModal: React.FC<HudSettingsModalProps> = ({
  isOpen,
  onClose,
  playerName,
  setPlayerName,
  playerColor,
  setPlayerColor,
  soundSettings,
  isMuted,
  onToggleSound,
  onOpenSoundModal,
  onOpenHelp,
  onResetGame,
}) => {
  const [tempName, setTempName] = useState(playerName);

  useEffect(() => {
    setTempName(playerName);
  }, [playerName]);

  if (!isOpen) return null;

  const toggleColor = () => {
    setPlayerColor(playerColor === 'blue' ? 'red' : 'blue');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 animate-fadeIn"
      onClick={onClose}
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
            onClick={onClose}
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
        <div className="bg-black/40 border border-white/10 p-3.5 rounded-2xl flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">사운드 & 배경음악</span>
            <button
              onClick={onToggleSound}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-bold transition active:scale-95 ${
                isMuted
                  ? 'bg-red-500/20 border-red-500/40 text-red-300'
                  : 'bg-green-500/20 border-green-500/40 text-green-300'
              }`}
            >
              <img
                src="/assets/ui/Icons/Icon_12.png"
                alt="sound"
                className={`w-3.5 h-3.5 pixel-art ${isMuted ? 'grayscale opacity-50' : ''}`}
              />
              <span>{isMuted ? '음소거' : '켜짐'}</span>
            </button>
          </div>

          {/* Quick Sliders */}
          <div className="flex flex-col gap-2 text-[11px] text-slate-300">
            <div className="flex items-center justify-between">
              <span>BGM: {Math.round(soundSettings.bgmVolume * 100)}%</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={soundSettings.bgmVolume}
                onChange={(e) => sound.setBgmVolume(parseFloat(e.target.value))}
                className="w-32 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>
            <div className="flex items-center justify-between">
              <span>SFX: {Math.round(soundSettings.sfxVolume * 100)}%</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={soundSettings.sfxVolume}
                onChange={(e) => sound.setSfxVolume(parseFloat(e.target.value))}
                className="w-32 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
            </div>
          </div>

          <button
            onClick={() => {
              onClose();
              onOpenSoundModal();
            }}
            className="w-full flex items-center justify-center py-2 px-3 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded-xl text-amber-200 text-xs font-bold transition"
          >
            <span>BGM 트랙 변경 및 효과음 테스트</span>
          </button>
        </div>

        {/* Screen / Zoom Presets */}
        <div className="bg-black/40 border border-white/10 p-3.5 rounded-2xl flex flex-col gap-2">
          <div className="text-xs font-semibold text-slate-300">화면 & 카메라 줌 프리셋</div>
          <div className="grid grid-cols-4 gap-1.5">
            {[0.75, 1.0, 1.25, 1.5].map((z) => (
              <button
                key={z}
                onClick={() => {
                  EventBus.emit('set-zoom', z);
                }}
                className="py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 active:scale-95 transition"
              >
                {z}x
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => {
              onClose();
              onOpenHelp();
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
  );
};
