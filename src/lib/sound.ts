// Web Audio API & BGM Sound Engine for Tiny Isles
// Open-source sound effects & background music with CC0 licensing

export type BgmTrackId = 'adventure' | 'peaceful' | 'ocean';

export interface BgmTrackInfo {
  id: BgmTrackId;
  name: string;
  artist: string;
  description: string;
  src: string;
}

export const BGM_TRACKS: Record<BgmTrackId, BgmTrackInfo> = {
  adventure: {
    id: 'adventure',
    name: '신나는 모험 (Adventure)',
    artist: 'TinyWorlds (OpenGameArt CC0)',
    description: '활기차고 경쾌한 아일랜드 탐험 테마',
    src: '/assets/audio/bgm/adventure.mp3',
  },
  peaceful: {
    id: 'peaceful',
    name: '평화로운 섬 (Peaceful)',
    artist: 'Komiku (CC0 1.0)',
    description: '따뜻하고 아늑한 레트로 어쿠스틱 멜로디',
    src: '/assets/audio/bgm/peaceful.mp3',
  },
  ocean: {
    id: 'ocean',
    name: '파도와 바닷바람 (Ocean Breeze)',
    artist: 'TRP (CC0 1.0)',
    description: '잔잔한 파도 소리와 바다 자연 앰비언스',
    src: '/assets/audio/bgm/ocean.mp3',
  },
};

export interface SoundSettings {
  muted: boolean;
  bgmEnabled: boolean;
  sfxEnabled: boolean;
  bgmVolume: number; // 0.0 ~ 1.0
  sfxVolume: number; // 0.0 ~ 1.0
  bgmTrack: BgmTrackId;
}

const STORAGE_KEY = 'tiny_isles_sound_settings';

class SoundSystem {
  private ctx: AudioContext | null = null;
  private sfxBuffers: Map<string, AudioBuffer> = new Map();
  private bgmAudio: HTMLAudioElement | null = null;
  private listeners: Set<(settings: SoundSettings) => void> = new Set();
  private hasInteracted: boolean = false;
  private stepToggle: boolean = false;

  private settings: SoundSettings = {
    muted: false,
    bgmEnabled: true,
    sfxEnabled: true,
    bgmVolume: 0.35,
    sfxVolume: 0.6,
    bgmTrack: 'adventure',
  };

  constructor() {
    this.loadSettings();
    if (typeof window !== 'undefined') {
      this.setupUserGestureListener();
      // Preload lightweight SFX
      this.preloadSFX();
    }
  }

  private loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.settings = {
          ...this.settings,
          ...parsed,
          bgmVolume: typeof parsed.bgmVolume === 'number' ? Math.max(0, Math.min(1, parsed.bgmVolume)) : 0.35,
          sfxVolume: typeof parsed.sfxVolume === 'number' ? Math.max(0, Math.min(1, parsed.sfxVolume)) : 0.6,
        };
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  private saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Ignore localStorage errors
    }
    this.notify();
  }

  private notify() {
    const copy = { ...this.settings };
    this.listeners.forEach((listener) => {
      try {
        listener(copy);
      } catch (err) {
        console.error('Error in sound listener:', err);
      }
    });
  }

  public subscribe(listener: (settings: SoundSettings) => void): () => void {
    this.listeners.add(listener);
    listener({ ...this.settings });
    return () => this.listeners.delete(listener);
  }

  public getSettings(): SoundSettings {
    return { ...this.settings };
  }

  private setupUserGestureListener() {
    const handleGesture = () => {
      if (!this.hasInteracted) {
        this.hasInteracted = true;
        this.initCtx();
        if (this.settings.bgmEnabled && !this.settings.muted) {
          this.playBgm();
        }
      }
      window.removeEventListener('pointerdown', handleGesture);
      window.removeEventListener('keydown', handleGesture);
      window.removeEventListener('touchstart', handleGesture);
    };

    window.addEventListener('pointerdown', handleGesture, { passive: true });
    window.addEventListener('keydown', handleGesture, { passive: true });
    window.addEventListener('touchstart', handleGesture, { passive: true });
  }

  private initCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private async preloadSFX() {
    const sfxList = ['chop', 'mine', 'step', 'step2', 'pop', 'break', 'unlock', 'click'];
    for (const name of sfxList) {
      this.loadSfxBuffer(name, `/assets/audio/sfx/${name}.mp3`);
    }
  }

  private async loadSfxBuffer(name: string, url: string) {
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const arrayBuffer = await res.arrayBuffer();
      const ctx = this.initCtx();
      if (!ctx) return;
      ctx.decodeAudioData(
        arrayBuffer,
        (decoded) => {
          this.sfxBuffers.set(name, decoded);
        },
        () => {}
      );
    } catch {
      // Fallback synthesis will be used if loading fails
    }
  }

  // Play a preloaded audio buffer with pitch variation
  private playBuffer(name: string, volumeScale = 1.0, pitchVariation = 0): boolean {
    if (this.settings.muted || !this.settings.sfxEnabled) return false;
    const ctx = this.initCtx();
    if (!ctx) return false;

    const buffer = this.sfxBuffers.get(name);
    if (!buffer) return false;

    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      if (pitchVariation > 0) {
        // Random pitch offset between -pitchVariation and +pitchVariation
        const rate = 1.0 + (Math.random() * 2 - 1) * pitchVariation;
        source.playbackRate.setValueAtTime(rate, ctx.currentTime);
      }

      const gain = ctx.createGain();
      const effectiveVol = this.settings.sfxVolume * volumeScale;
      gain.gain.setValueAtTime(effectiveVol, ctx.currentTime);

      source.connect(gain);
      gain.connect(ctx.destination);

      source.start(0);
      return true;
    } catch {
      return false;
    }
  }

  // ----------------------------------------------------
  // BGM (Background Music) Management
  // ----------------------------------------------------

  private playBgm() {
    if (typeof window === 'undefined') return;
    const track = BGM_TRACKS[this.settings.bgmTrack] || BGM_TRACKS.adventure;

    if (!this.bgmAudio) {
      this.bgmAudio = new Audio();
      this.bgmAudio.loop = true;
      this.bgmAudio.preload = 'auto';
    }

    const currentSrc = this.bgmAudio.getAttribute('src');
    if (currentSrc !== track.src) {
      this.bgmAudio.src = track.src;
    }

    const effectiveVolume = this.settings.muted || !this.settings.bgmEnabled ? 0 : this.settings.bgmVolume;
    this.bgmAudio.volume = effectiveVolume;

    if (this.settings.bgmEnabled && !this.settings.muted) {
      this.bgmAudio.play().catch(() => {
        // Waiting for user gesture
      });
    }
  }

  public setBgmTrack(trackId: BgmTrackId) {
    if (!BGM_TRACKS[trackId]) return;
    this.settings.bgmTrack = trackId;
    this.saveSettings();

    if (this.bgmAudio) {
      this.bgmAudio.src = BGM_TRACKS[trackId].src;
      if (this.settings.bgmEnabled && !this.settings.muted) {
        this.bgmAudio.play().catch(() => {});
      }
    }
  }

  public getBgmTrack(): BgmTrackId {
    return this.settings.bgmTrack;
  }

  public setBgmVolume(volume: number) {
    const clamped = Math.max(0, Math.min(1, volume));
    this.settings.bgmVolume = clamped;
    if (this.bgmAudio && !this.settings.muted && this.settings.bgmEnabled) {
      this.bgmAudio.volume = clamped;
    }
    this.saveSettings();
  }

  public getBgmVolume(): number {
    return this.settings.bgmVolume;
  }

  public setSfxVolume(volume: number) {
    const clamped = Math.max(0, Math.min(1, volume));
    this.settings.sfxVolume = clamped;
    this.saveSettings();
  }

  public getSfxVolume(): number {
    return this.settings.sfxVolume;
  }

  public toggleBgm(): boolean {
    this.settings.bgmEnabled = !this.settings.bgmEnabled;
    if (this.bgmAudio) {
      if (this.settings.bgmEnabled && !this.settings.muted) {
        this.bgmAudio.volume = this.settings.bgmVolume;
        this.bgmAudio.play().catch(() => {});
      } else {
        this.bgmAudio.pause();
      }
    } else if (this.settings.bgmEnabled && !this.settings.muted) {
      this.playBgm();
    }
    this.saveSettings();
    return this.settings.bgmEnabled;
  }

  public isBgmEnabled(): boolean {
    return this.settings.bgmEnabled;
  }

  public toggleSfx(): boolean {
    this.settings.sfxEnabled = !this.settings.sfxEnabled;
    this.saveSettings();
    return this.settings.sfxEnabled;
  }

  public isSfxEnabled(): boolean {
    return this.settings.sfxEnabled;
  }

  public toggleMute(): boolean {
    this.settings.muted = !this.settings.muted;
    if (this.bgmAudio) {
      if (this.settings.muted) {
        this.bgmAudio.pause();
      } else if (this.settings.bgmEnabled) {
        this.bgmAudio.volume = this.settings.bgmVolume;
        this.bgmAudio.play().catch(() => {});
      }
    } else if (!this.settings.muted && this.settings.bgmEnabled) {
      this.playBgm();
    }
    this.saveSettings();
    return !this.settings.muted;
  }

  public isMuted(): boolean {
    return this.settings.muted;
  }

  // ----------------------------------------------------
  // Sound Effects (SFX) with fallback procedural audio
  // ----------------------------------------------------

  // 도끼로 나무 치는 소리 (Thud & Wood Crunch)
  public playChop() {
    if (this.settings.muted || !this.settings.sfxEnabled) return;
    if (this.playBuffer('chop', 0.9, 0.08)) return;

    // Fallback Oscillator
    const ctx = this.initCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140 + Math.random() * 20, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.4 * this.settings.sfxVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  }

  // 곡괭이로 돌 깨는 소리 (Metallic Clang & Rock Crack)
  public playMine() {
    if (this.settings.muted || !this.settings.sfxEnabled) return;
    if (this.playBuffer('mine', 0.85, 0.08)) return;

    // Fallback Oscillator
    const ctx = this.initCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600 + Math.random() * 50, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.09);
    gain.gain.setValueAtTime(0.3 * this.settings.sfxVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  }

  // 자원 획득 소리 (Pop / Coin pickup)
  public playPop() {
    if (this.settings.muted || !this.settings.sfxEnabled) return;
    if (this.playBuffer('pop', 0.75, 0.06)) return;

    // Fallback Oscillator
    const ctx = this.initCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(680, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.35 * this.settings.sfxVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  }

  // 발자국 소리 (Crisp walking footstep - alternating left/right)
  public playStep() {
    if (this.settings.muted || !this.settings.sfxEnabled) return;
    this.stepToggle = !this.stepToggle;
    const bufferName = this.stepToggle ? 'step' : 'step2';
    if (this.playBuffer(bufferName, 0.85, 0.08)) return;

    // Fallback Oscillator
    const ctx = this.initCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const baseFreq = this.stepToggle ? 140 : 120;
    osc.frequency.setValueAtTime(baseFreq + Math.random() * 20, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.12 * this.settings.sfxVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }

  // 자원 파괴 소리 (Tree felled / Rock broken)
  public playBreak() {
    if (this.settings.muted || !this.settings.sfxEnabled) return;
    if (this.playBuffer('break', 0.9, 0.05)) return;

    // Fallback Oscillator
    const ctx = this.initCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.4 * this.settings.sfxVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  }

  // 신규 섬 해금 팡파레 (Victory Fanfare)
  public playUnlock() {
    if (this.settings.muted || !this.settings.sfxEnabled) return;
    if (this.playBuffer('unlock', 0.95)) return;

    // Fallback Fanfare
    const ctx = this.initCtx();
    if (!ctx) return;
    const notes = [261.63, 329.63, 392.0, 523.25]; // C, E, G, High C
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);
      gain.gain.setValueAtTime(0.2 * this.settings.sfxVolume, ctx.currentTime + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + idx * 0.1 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.1);
      osc.stop(ctx.currentTime + idx * 0.1 + 0.25);
    });
  }

  // UI 버튼 클릭 / 토글 소리
  public playClick() {
    if (this.settings.muted || !this.settings.sfxEnabled) return;
    if (this.playBuffer('click', 0.6)) return;

    // Fallback Click
    const ctx = this.initCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.03);
    gain.gain.setValueAtTime(0.2 * this.settings.sfxVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.03);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.03);
  }
}

export const sound = new SoundSystem();
