// Web Audio API & BGM Sound Engine for Tiny Isles
export type BgmTrackId = 'adventure' | 'peaceful' | 'ocean';
export interface BgmTrackInfo { id: BgmTrackId; name: string; artist: string; description: string; src: string; }

export const BGM_TRACKS: Record<BgmTrackId, BgmTrackInfo> = {
  adventure: { id: 'adventure', name: '신나는 모험', artist: 'TinyWorlds', description: '활기찬 모험 테마', src: '/assets/audio/bgm/adventure.mp3' },
  peaceful: { id: 'peaceful', name: '평화로운 섬', artist: 'Komiku', description: '따뜻한 어쿠스틱 테마', src: '/assets/audio/bgm/peaceful.mp3' },
  ocean: { id: 'ocean', name: '파도와 바람', artist: 'TRP', description: '잔잔한 파도 앰비언스', src: '/assets/audio/bgm/ocean.mp3' },
};

export interface SoundSettings {
  muted: boolean; bgmEnabled: boolean; sfxEnabled: boolean;
  bgmVolume: number; sfxVolume: number; bgmTrack: BgmTrackId;
}

class SoundSystem {
  private ctx: AudioContext | null = null;
  private sfxBuffers = new Map<string, AudioBuffer>();
  private bgmAudio: HTMLAudioElement | null = null;
  private listeners = new Set<(s: SoundSettings) => void>();
  private hasInteracted = false;
  private settings: SoundSettings = {
    muted: false, bgmEnabled: true, sfxEnabled: true, bgmVolume: 0.35, sfxVolume: 0.6, bgmTrack: 'adventure',
  };

  constructor() {
    try {
      const saved = localStorage.getItem('tiny_isles_sound_settings');
      if (saved) Object.assign(this.settings, JSON.parse(saved));
    } catch {}
    if (typeof window !== 'undefined') {
      const unlock = () => {
        if (!this.hasInteracted) {
          this.hasInteracted = true;
          this.initCtx();
          if (this.settings.bgmEnabled && !this.settings.muted) this.playBgm();
        }
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('pointerdown', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });
      ['chop', 'mine', 'step', 'pop', 'break', 'unlock', 'click'].forEach((name) => {
        fetch(`/assets/audio/sfx/${name}.mp3`).then((r) => r.ok ? r.arrayBuffer() : null).then((buf) => {
          if (buf) this.initCtx()?.decodeAudioData(buf, (d) => this.sfxBuffers.set(name, d), () => {});
        }).catch(() => {});
      });
    }
  }

  private initCtx(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  private save() {
    try { localStorage.setItem('tiny_isles_sound_settings', JSON.stringify(this.settings)); } catch {}
    this.listeners.forEach((l) => l({ ...this.settings }));
  }

  public subscribe(l: (s: SoundSettings) => void): () => void {
    this.listeners.add(l);
    l({ ...this.settings });
    return () => { this.listeners.delete(l); };
  }

  public getSettings(): SoundSettings { return { ...this.settings }; }
  public isMuted() { return this.settings.muted; }
  public isBgmEnabled() { return this.settings.bgmEnabled; }
  public isSfxEnabled() { return this.settings.sfxEnabled; }

  private playBgm() {
    if (typeof window === 'undefined') return;
    if (!this.bgmAudio) { this.bgmAudio = new Audio(); this.bgmAudio.loop = true; }
    const track = BGM_TRACKS[this.settings.bgmTrack] || BGM_TRACKS.adventure;
    if (this.bgmAudio.src !== track.src) this.bgmAudio.src = track.src;
    this.bgmAudio.volume = this.settings.muted || !this.settings.bgmEnabled ? 0 : this.settings.bgmVolume;
    if (this.settings.bgmEnabled && !this.settings.muted) this.bgmAudio.play().catch(() => {});
  }

  public setBgmTrack(id: BgmTrackId) {
    this.settings.bgmTrack = id;
    this.save();
    if (this.bgmAudio) {
      this.bgmAudio.src = BGM_TRACKS[id]?.src || '';
      if (this.settings.bgmEnabled && !this.settings.muted) this.bgmAudio.play().catch(() => {});
    }
  }

  public setBgmVolume(v: number) {
    this.settings.bgmVolume = Math.max(0, Math.min(1, v));
    if (this.bgmAudio && !this.settings.muted && this.settings.bgmEnabled) this.bgmAudio.volume = this.settings.bgmVolume;
    this.save();
  }

  public setSfxVolume(v: number) { this.settings.sfxVolume = Math.max(0, Math.min(1, v)); this.save(); }
  public toggleMute() { this.settings.muted = !this.settings.muted; this.playBgm(); this.save(); return !this.settings.muted; }
  public toggleBgm() { this.settings.bgmEnabled = !this.settings.bgmEnabled; this.playBgm(); this.save(); return this.settings.bgmEnabled; }
  public toggleSfx() { this.settings.sfxEnabled = !this.settings.sfxEnabled; this.save(); return this.settings.sfxEnabled; }

  private playTone(type: OscillatorType, start: number, end: number, dur: number, vol = 0.3) {
    if (this.settings.muted || !this.settings.sfxEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(start, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(10, end), ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol * this.settings.sfxVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + dur);
  }

  private playBuffer(name: string, vol = 1.0, pitch = 0.05): boolean {
    if (this.settings.muted || !this.settings.sfxEnabled) return true;
    const buf = this.sfxBuffers.get(name);
    const ctx = this.initCtx();
    if (!buf || !ctx) return false;
    try {
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      src.buffer = buf;
      src.playbackRate.setValueAtTime(1.0 + (Math.random() * 2 - 1) * pitch, ctx.currentTime);
      gain.gain.setValueAtTime(this.settings.sfxVolume * vol, ctx.currentTime);
      src.connect(gain); gain.connect(ctx.destination);
      src.start(0); return true;
    } catch { return false; }
  }

  public playChop() { if (!this.playBuffer('chop', 0.9)) this.playTone('triangle', 160, 40, 0.12, 0.4); }
  public playMine() { if (!this.playBuffer('mine', 0.85)) this.playTone('sawtooth', 600, 120, 0.09, 0.3); }
  public playPop() { if (!this.playBuffer('pop', 0.75)) this.playTone('sine', 320, 680, 0.08, 0.35); }
  public playStep() { this.playBuffer('step', 0.35, 0.05); }
  public playBreak() { if (!this.playBuffer('break', 0.9)) this.playTone('triangle', 220, 50, 0.2, 0.45); }
  public playUnlock() {
    if (this.playBuffer('unlock', 0.95)) return;
    [261.6, 329.6, 392.0, 523.2].forEach((f, i) => setTimeout(() => this.playTone('square', f, f, 0.2, 0.25), i * 90));
  }
  public playTowerShoot() { this.playTone('sine', 880, 220, 0.15, 0.35); }
  public playClick() { if (!this.playBuffer('click', 0.6)) this.playTone('sine', 800, 400, 0.04, 0.2); }
}

export const sound = new SoundSystem();
