import React, { useEffect, useState } from 'react';
import { sound, BGM_TRACKS, BgmTrackId, SoundSettings } from '../lib/sound';
import { WoodModalFrame } from './ui/WoodModalFrame';
import { PixelGameButton } from './ui/PixelGameButton';
import { PixelRangeSlider } from './ui/PixelRangeSlider';

interface SoundModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SFX_PREVIEW_ITEMS: ReadonlyArray<{
  label: string;
  iconSrc: string;
  play: () => void;
}> = [
  { label: '벌목 효과음', iconSrc: '/assets/ui/Icons/Tool_Axe.png', play: () => sound.playChop() },
  { label: '채광 효과음', iconSrc: '/assets/ui/Icons/Tool_Pickaxe.png', play: () => sound.playMine() },
  { label: '자원 획득', iconSrc: '/assets/ui/Icons/Icon_03.png', play: () => sound.playPop() },
  { label: '영지 해금', iconSrc: '/assets/ui/Icons/Icon_06.png', play: () => sound.playUnlock() },
  { label: '건물 파괴', iconSrc: '/assets/ui/Icons/Icon_09.png', play: () => sound.playBreak() },
  { label: '타워 발사', iconSrc: '/assets/ui/Icons/Icon_05.png', play: () => sound.playTowerShoot() },
];

export const SoundModal: React.FC<SoundModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<SoundSettings>(() => sound.getSettings());

  useEffect(() => {
    const unsub = sound.subscribe((updated) => setSettings(updated));
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const trackList: BgmTrackId[] = ['adventure', 'peaceful', 'ocean'];

  return (
    <WoodModalFrame
      title="오디오 & 사운드 설정"
      ribbonVariant="blue"
      frameVariant="wood"
      maxWidthClass="max-w-md"
      onClose={onClose}
      headerRight={
        <div className="flex items-center gap-1.5 text-[11px] font-black text-[#fef3c7] pixel-btn-shadow">
          <img src="/assets/ui/Icons/Icon_12.png" alt="" className="w-4 h-4 pixel-art" />
          <span>음향 & BGM 튜닝</span>
        </div>
      }
    >
      {/* Master Mute Toggle */}
      <div className="ts-paper-sheet p-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src="/assets/ui/Icons/Icon_12.png"
            alt=""
            className={`w-5 h-5 pixel-art shrink-0 ${settings.muted ? 'grayscale opacity-50' : ''}`}
          />
          <div className="min-w-0">
            <div className="font-black text-xs text-[#2b1810]">마스터 사운드</div>
            <div className="text-[10px] font-bold text-[#6e4625] truncate">
              {settings.muted ? '전체 음소거 켜짐' : '전체 소리 정상 출력'}
            </div>
          </div>
        </div>
        <PixelGameButton
          label={settings.muted ? '음소거 해제' : '음소거'}
          variant={settings.muted ? 'red' : 'blue'}
          size="sm"
          onClick={() => sound.toggleMute()}
        />
      </div>

      {/* BGM Track Switcher */}
      <div className="ts-paper-sheet p-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-[#3a200f] flex items-center gap-1.5">
            <img src="/assets/ui/Icons/Icon_12.png" alt="" className="w-4 h-4 pixel-art" />
            <span>배경음악 (BGM) 트랙</span>
          </span>
          <button
            type="button"
            onClick={() => {
              sound.toggleBgm();
              sound.playClick();
            }}
            className={`px-2 py-0.5 rounded border-2 text-[10px] font-black transition active:scale-95 ${
              settings.bgmEnabled
                ? 'bg-[#dcfce7] border-[#15803d] text-[#166534]'
                : 'bg-[#fee2e2] border-[#b91c1c] text-[#991b1b]'
            }`}
          >
            {settings.bgmEnabled ? 'BGM ON' : 'BGM OFF'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {trackList.map((tid) => {
            const trk = BGM_TRACKS[tid];
            const isCur = settings.bgmTrack === tid;
            return (
              <button
                key={tid}
                type="button"
                onClick={() => {
                  sound.setBgmTrack(tid);
                  sound.playClick();
                }}
                className={`flex flex-col p-1.5 rounded-lg text-left border-2 transition active:scale-95 ${
                  isCur
                    ? 'bg-[#fde68a] border-[#92400e] text-[#2b1810] shadow-inner'
                    : 'bg-[#e6cfab] border-[#b89568] text-[#5c3c24] hover:bg-[#f3e2c7]'
                }`}
              >
                <span className="font-black text-[11px] leading-tight">{trk.name}</span>
                <span className="text-[9px] font-bold opacity-80 leading-tight mt-0.5">
                  {trk.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Volume Sliders */}
      <div className="ts-paper-sheet p-2 space-y-2">
        <PixelRangeSlider
          label="BGM 볼륨"
          iconSrc="/assets/ui/Icons/Icon_12.png"
          value={settings.bgmVolume}
          accentVariant="amber"
          onChange={(val) => sound.setBgmVolume(val)}
        />
        <PixelRangeSlider
          label="SFX 효과음 볼륨"
          iconSrc="/assets/ui/Icons/Icon_05.png"
          value={settings.sfxVolume}
          accentVariant="emerald"
          onChange={(val) => sound.setSfxVolume(val)}
        />
      </div>

      {/* SFX Previews */}
      <div className="ts-paper-sheet p-2 space-y-1.5">
        <span className="text-xs font-black text-[#3a200f] flex items-center gap-1.5">
          <img src="/assets/ui/Icons/Icon_07.png" alt="" className="w-4 h-4 pixel-art" />
          <span>상황별 SFX 효과음 테스트</span>
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {SFX_PREVIEW_ITEMS.map((btn) => (
            <button
              key={btn.label}
              type="button"
              onClick={btn.play}
              className="flex items-center gap-1.5 px-2 py-1.5 bg-[#e6cfab] hover:bg-[#f3e2c7] active:scale-95 rounded-lg border-2 border-[#b89568] text-[11px] font-black text-[#3a200f] transition"
            >
              <img src={btn.iconSrc} alt="" className="w-4 h-4 pixel-art shrink-0" />
              <span className="truncate">{btn.label}</span>
            </button>
          ))}
        </div>
      </div>
    </WoodModalFrame>
  );
};
