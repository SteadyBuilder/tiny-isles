import React, { useEffect, useState } from 'react';
import { sound, BGM_TRACKS, BgmTrackId, SoundSettings } from '../lib/sound';
import { Volume2, VolumeX, Music, Volume1 } from 'lucide-react';

interface SoundModalProps { isOpen: boolean; onClose: () => void; }

export const SoundModal: React.FC<SoundModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<SoundSettings>(() => sound.getSettings());
  useEffect(() => {
    const unsub = sound.subscribe((updated) => setSettings(updated));
    return () => unsub();
  }, []);
  if (!isOpen) return null;

  const trackList: BgmTrackId[] = ['adventure', 'peaceful', 'ocean'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn" onClick={onClose}>
      <div className="bg-[#1e293b] border-2 border-amber-500/50 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl text-white max-h-[90vh] overflow-y-auto flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg sm:text-xl font-black text-amber-300">오디오 & 사운드 설정</h3>
          </div>
          <button onClick={onClose} className="relative w-8 h-8 active:scale-90 transition-transform flex items-center justify-center" aria-label="닫기">
            <img src="/assets/ui/Buttons/SmallRedRoundButton_Regular.png" alt="close" className="w-full h-full pixel-art select-none" />
            <img src="/assets/ui/Icons/Icon_09.png" alt="x" className="absolute w-3.5 h-3.5 pixel-art" />
          </button>
        </div>

        {/* Master Mute Toggle */}
        <div className="flex items-center justify-between bg-black/40 p-3 rounded-2xl border border-white/10">
          <div className="flex items-center gap-2.5">
            {settings.muted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-green-400" />}
            <div>
              <div className="font-bold text-sm">마스터 사운드</div>
              <div className="text-[11px] text-slate-400">{settings.muted ? '전체 음소거 켜짐' : '전체 소리 정상 출력'}</div>
            </div>
          </div>
          <button
            onClick={() => { sound.toggleMute(); sound.playClick(); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition active:scale-95 ${settings.muted ? 'bg-red-500 text-white' : 'bg-emerald-600 text-white'}`}
          >
            {settings.muted ? '음소거 해제' : '음소거'}
          </button>
        </div>

        {/* BGM Track Switcher */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span>배경음악 (BGM) 트랙</span>
            <button onClick={() => { sound.toggleBgm(); sound.playClick(); }} className={`text-[10px] px-2 py-0.5 rounded font-black ${settings.bgmEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
              {settings.bgmEnabled ? 'BGM ON' : 'BGM OFF'}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {trackList.map((tid) => {
              const trk = BGM_TRACKS[tid];
              const isCur = settings.bgmTrack === tid;
              return (
                <button
                  key={tid}
                  onClick={() => { sound.setBgmTrack(tid); sound.playClick(); }}
                  className={`flex flex-col p-2 rounded-xl text-left border transition active:scale-95 ${isCur ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-2 ring-amber-400/30' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                >
                  <span className="font-bold text-xs truncate">{trk.name}</span>
                  <span className="text-[10px] text-slate-400 truncate">{trk.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Volume Sliders */}
        <div className="flex flex-col gap-3 bg-black/30 p-3.5 rounded-2xl border border-white/10">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="flex items-center gap-1.5"><Music className="w-3.5 h-3.5 text-amber-400" /> BGM 볼륨</span>
              <span className="font-mono text-amber-300">{Math.round(settings.bgmVolume * 100)}%</span>
            </div>
            <input type="range" min="0" max="1" step="0.05" value={settings.bgmVolume} onChange={(e) => sound.setBgmVolume(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="flex items-center gap-1.5"><Volume1 className="w-3.5 h-3.5 text-emerald-400" /> SFX 효과음 볼륨</span>
              <span className="font-mono text-emerald-300">{Math.round(settings.sfxVolume * 100)}%</span>
            </div>
            <input type="range" min="0" max="1" step="0.05" value={settings.sfxVolume} onChange={(e) => sound.setSfxVolume(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-400" />
          </div>
        </div>

        {/* SFX Previews */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-slate-300">상황별 SFX 효과음 테스트</span>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: '🪓 벌목(Chop)', fn: () => sound.playChop() },
              { label: '⛏️ 채광(Mine)', fn: () => sound.playMine() },
              { label: '🪙 획득(Pop)', fn: () => sound.playPop() },
              { label: '🏰 해금(Unlock)', fn: () => sound.playUnlock() },
              { label: '💥 파괴(Break)', fn: () => sound.playBreak() },
              { label: '🏹 타워발사', fn: () => sound.playTowerShoot() },
            ].map((btn, i) => (
              <button key={i} onClick={btn.fn} className="px-2 py-1.5 bg-white/5 hover:bg-white/10 active:scale-95 rounded-lg border border-white/10 text-[11px] font-bold text-slate-200 transition">
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
