import React, { useEffect, useState } from 'react';
import { sound, BGM_TRACKS, BgmTrackId, SoundSettings } from '../lib/sound';
import {
  Volume2,
  VolumeX,
  Music,
  X,
  Play,
  Volume1,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface SoundModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SoundModal: React.FC<SoundModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<SoundSettings>(() => sound.getSettings());

  useEffect(() => {
    const unsubscribe = sound.subscribe((updated) => {
      setSettings(updated);
    });
    return unsubscribe;
  }, []);

  if (!isOpen) return null;

  const handleTrackChange = (trackId: BgmTrackId) => {
    sound.setBgmTrack(trackId);
    sound.playClick();
  };

  const handleToggleMute = () => {
    sound.toggleMute();
    sound.playClick();
  };

  const handleToggleBgm = () => {
    sound.toggleBgm();
    sound.playClick();
  };

  const handleToggleSfx = () => {
    sound.toggleSfx();
    sound.playClick();
  };

  const handleBgmVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    sound.setBgmVolume(parseFloat(e.target.value));
  };

  const handleSfxVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    sound.setSfxVolume(parseFloat(e.target.value));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-[#1e293b] border border-amber-500/40 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl text-white max-h-[90vh] overflow-y-auto flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg sm:text-xl font-bold text-amber-300">
              오디오 & 사운드 설정
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-full text-slate-300 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Master Mute Quick Button */}
        <div className="flex items-center justify-between bg-white/5 p-3 rounded-2xl border border-white/10">
          <div className="flex items-center gap-2.5">
            {settings.muted ? (
              <VolumeX className="w-5 h-5 text-red-400" />
            ) : (
              <Volume2 className="w-5 h-5 text-green-400" />
            )}
            <div>
              <div className="text-sm font-bold text-white">
                전체 마스터 음소거
              </div>
              <div className="text-[11px] text-slate-400">
                {settings.muted ? '현재 모든 소리가 꺼져 있습니다.' : '모든 오디오가 정상 출력됩니다.'}
              </div>
            </div>
          </div>
          <button
            onClick={handleToggleMute}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 ${
              settings.muted
                ? 'bg-red-500/30 text-red-200 border border-red-500/40 hover:bg-red-500/40'
                : 'bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30'
            }`}
          >
            {settings.muted ? '음소거 중' : '켜짐'}
          </button>
        </div>

        {/* ========================================================= */}
        {/* BGM Section                                               */}
        {/* ========================================================= */}
        <div className="flex flex-col gap-3 bg-amber-500/5 border border-amber-500/20 p-4 rounded-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-extrabold text-amber-300">배경음악 (BGM)</span>
            </div>
            <button
              onClick={handleToggleBgm}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition active:scale-95 ${
                settings.bgmEnabled && !settings.muted
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'bg-white/10 text-slate-400'
              }`}
            >
              {settings.bgmEnabled && !settings.muted ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* BGM Volume Slider */}
          <div className="flex items-center gap-3">
            <Volume1 className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.bgmVolume}
              onChange={handleBgmVolume}
              disabled={settings.muted || !settings.bgmEnabled}
              className="w-full accent-amber-400 cursor-pointer disabled:opacity-30"
            />
            <span className="text-xs font-mono text-slate-300 w-9 text-right shrink-0">
              {Math.round(settings.bgmVolume * 100)}%
            </span>
          </div>

          {/* Track Selection Cards */}
          <div className="flex flex-col gap-2 pt-1">
            <div className="text-[11px] font-semibold text-slate-400">
              배경음 테마 곡 선택:
            </div>
            {(Object.keys(BGM_TRACKS) as BgmTrackId[]).map((key) => {
              const track = BGM_TRACKS[key];
              const isSelected = settings.bgmTrack === key;
              return (
                <button
                  key={key}
                  onClick={() => handleTrackChange(key)}
                  className={`text-left p-2.5 rounded-xl border transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-500/60 shadow-md ring-1 ring-amber-400/30'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
                  }`}
                >
                  <div className="flex flex-col leading-snug">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white">{track.name}</span>
                      {isSelected && settings.bgmEnabled && !settings.muted && (
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {track.description}
                    </span>
                  </div>
                  {isSelected && (
                    <Play className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================= */}
        {/* SFX Section                                               */}
        {/* ========================================================= */}
        <div className="flex flex-col gap-3 bg-white/5 border border-white/10 p-4 rounded-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-extrabold text-emerald-300">효과음 (SFX)</span>
            </div>
            <button
              onClick={handleToggleSfx}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition active:scale-95 ${
                settings.sfxEnabled && !settings.muted
                  ? 'bg-emerald-500 text-black shadow-md'
                  : 'bg-white/10 text-slate-400'
              }`}
            >
              {settings.sfxEnabled && !settings.muted ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* SFX Volume Slider */}
          <div className="flex items-center gap-3">
            <Volume1 className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.sfxVolume}
              onChange={handleSfxVolume}
              disabled={settings.muted || !settings.sfxEnabled}
              className="w-full accent-emerald-400 cursor-pointer disabled:opacity-30"
            />
            <span className="text-xs font-mono text-slate-300 w-9 text-right shrink-0">
              {Math.round(settings.sfxVolume * 100)}%
            </span>
          </div>

          {/* SFX Test Buttons */}
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="text-[11px] font-semibold text-slate-400">
              효과음 미리듣기:
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              <button
                onClick={() => sound.playChop()}
                className="py-1.5 px-2 bg-white/10 hover:bg-white/20 active:scale-95 rounded-lg text-xs text-amber-200 transition text-center"
                title="도끼로 나무 치기"
              >
                🪵 도끼
              </button>
              <button
                onClick={() => sound.playMine()}
                className="py-1.5 px-2 bg-white/10 hover:bg-white/20 active:scale-95 rounded-lg text-xs text-slate-200 transition text-center"
                title="곡괭이로 돌 깨기"
              >
                🪨 채굴
              </button>
              <button
                onClick={() => sound.playPop()}
                className="py-1.5 px-2 bg-white/10 hover:bg-white/20 active:scale-95 rounded-lg text-xs text-yellow-300 transition text-center"
                title="자원 획득"
              >
                🪙 획득
              </button>
              <button
                onClick={() => sound.playBreak()}
                className="py-1.5 px-2 bg-white/10 hover:bg-white/20 active:scale-95 rounded-lg text-xs text-orange-300 transition text-center"
                title="오브젝트 파괴"
              >
                💥 파괴
              </button>
              <button
                onClick={() => sound.playUnlock()}
                className="py-1.5 px-2 bg-white/10 hover:bg-white/20 active:scale-95 rounded-lg text-xs text-emerald-300 transition text-center col-span-2 sm:col-span-1"
                title="신규 섬 개척 팡파레"
              >
                🏝️ 해금
              </button>
            </div>
          </div>
        </div>

        {/* License & Source Info */}
        <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex flex-col gap-1 text-[11px] text-slate-400">
          <div className="flex items-center justify-between text-slate-300 font-semibold">
            <span>오픈소스 라이선스 안내</span>
            <span className="text-[10px] text-emerald-400">CC0 1.0 (Public Domain)</span>
          </div>
          <p className="leading-relaxed">
            모든 오디오는 <strong>Kenney</strong> (kenney.nl), <strong>OpenGameArt</strong>, <strong>Komiku</strong>의 CC0 오픈소스 사운드 팩을 기반으로 최적화되었습니다.
          </p>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-extrabold rounded-xl shadow-lg transition text-sm active:scale-95"
        >
          완료
        </button>
      </div>
    </div>
  );
};
