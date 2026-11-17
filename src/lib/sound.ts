// Web Audio API & BGM Sound Engine for Tiny Isles
import { SfxRecipeId } from '../data/sfxConfig';
import { SfxSynthesizer } from './sfxSynthesizer';
import { PlayerClassId } from '../types/hunting';

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
  private synth = new SfxSynthesizer();
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
      let sfxPreloaded = false;
      const preloadSfx = () => {
        if (sfxPreloaded) return;
        sfxPreloaded = true;
        ['chop', 'mine', 'step', 'pop', 'break', 'unlock', 'click'].forEach((name) => {
          fetch(`/assets/audio/sfx/${name}.mp3`)
            .then((r) => (r.ok ? r.arrayBuffer() : null))
            .then((buf) => {
              if (buf) this.initCtx()?.decodeAudioData(buf, (d) => this.sfxBuffers.set(name, d), () => {});
            })
            .catch(() => {});
        });
      };
      const unlock = () => {
        if (!this.hasInteracted) {
          this.hasInteracted = true;
          this.initCtx();
          preloadSfx();
          if (this.settings.bgmEnabled && !this.settings.muted) this.playBgm();
        }
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('pointerdown', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });
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
  public playPop() {
    if (this.playBuffer('pop', 0.8, 0.0)) return;
    this.playTone('sine', 987.77, 987.77, 0.08, 0.3);
    setTimeout(() => this.playTone('sine', 1318.51, 1318.51, 0.35, 0.35), 80);
  }
  public playStep() { this.playBuffer('step', 0.35, 0.05); }
  public playBreak() { if (!this.playBuffer('break', 0.9)) this.playTone('triangle', 220, 50, 0.2, 0.45); }
  public playUnlock() {
    if (this.playBuffer('unlock', 0.95, 0.0)) return;
    [
      { freq: 392.0, delay: 0, dur: 0.13 },
      { freq: 523.25, delay: 160, dur: 0.13 },
      { freq: 783.99, delay: 330, dur: 0.55 },
    ].forEach(({ freq, delay, dur }) =>
      setTimeout(() => this.playTone('sawtooth', freq, freq, dur, 0.22), delay),
    );
  }
  public playTowerShoot() { this.playTone('sine', 880, 220, 0.15, 0.35); }
  public playGemDrop() {
    if (this.settings.muted || !this.settings.sfxEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const sfxVol = this.settings.sfxVolume;
    const notes: Array<{ freq: number; delay: number; dur: number; vol: number; type: OscillatorType }> = [
      { freq: 1567.98, delay: 0.0, dur: 0.09, vol: 0.22, type: 'triangle' },
      { freq: 3135.96, delay: 0.0, dur: 0.11, vol: 0.12, type: 'sine' },
      { freq: 2093.0, delay: 0.065, dur: 0.1, vol: 0.24, type: 'sine' },
      { freq: 2637.02, delay: 0.135, dur: 0.12, vol: 0.22, type: 'sine' },
      { freq: 3520.0, delay: 0.21, dur: 0.22, vol: 0.18, type: 'sine' },
    ];

    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + n.delay;
      osc.type = n.type;
      osc.frequency.setValueAtTime(n.freq, startTime);
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(n.vol * sfxVol, startTime + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + n.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + n.dur + 0.01);
    }
  }
  public playDash() {
    this.playTone('triangle', 520, 170, 0.14, 0.28);
    this.playTone('sine', 960, 320, 0.09, 0.16);
  }
  public playSkillImpact() {
    this.playRecipe('hitCrit', 0.05);
  }
  public playRecipe(id: SfxRecipeId, pitchJitter = 0.04) {
    if (this.settings.muted || !this.settings.sfxEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    this.synth.playRecipe(ctx, id, this.settings.sfxVolume, pitchJitter);
  }
  public playSwordSlash() { this.playRecipe('swordSlash', 0.06); }
  public playLanceThrust() { this.playRecipe('lanceThrust', 0.05); }
  public playBowRelease() { this.playRecipe('bowRelease', 0.05); }
  public playMagicCast() { this.playRecipe('magicCast', 0.04); }
  public playHitBasic() { this.playRecipe('hitBasic', 0.07); }
  public playHitCrit() { this.playRecipe('hitCrit', 0.04); }
  public playPlayerHurt() { this.playRecipe('playerHurt', 0.04); }
  public playSkillCast(classId: PlayerClassId) {
    switch (classId) {
      case 'guardian': this.playRecipe('skillWhirlwind', 0.03); break;
      case 'lancer': this.playRecipe('skillDragonCharge', 0.03); break;
      case 'ranger': this.playRecipe('skillArrowStorm', 0.03); break;
      case 'archmage': this.playRecipe('skillMeteorNova', 0.02); break;
      case 'pawn':
      default:
        this.playRecipe('swordSlash', 0.04);
        this.playRecipe('hitCrit', 0.03);
        break;
    }
  }
  public playLevelUp() { this.playRecipe('levelUp', 0); }
  public playClassAdvance() { this.playRecipe('classAdvance', 0); }
  public playWaveHorn() { this.playRecipe('waveHorn', 0); }
  public playBossRoar() { this.playRecipe('bossRoar', 0.02); }
  public playMonsterDeath() { this.playRecipe('monsterDeath', 0.08); }
  public playHeal() { this.playRecipe('heal', 0); }
  public playBuildComplete() { this.playRecipe('buildComplete', 0.02); }
  public playClick() { if (!this.playBuffer('click', 0.6)) this.playTone('sine', 800, 400, 0.04, 0.2); }
}

export const sound = new SoundSystem();
