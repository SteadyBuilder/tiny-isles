export interface SynthToneStep {
  type: OscillatorType;
  startFreq: number;
  endFreq: number;
  dur: number;
  vol: number;
  delay?: number;
}

export interface SynthNoiseStep {
  dur: number;
  vol: number;
  filterType: BiquadFilterType;
  startFreq: number;
  endFreq: number;
  q?: number;
  delay?: number;
}

export interface SfxRecipe {
  tones?: ReadonlyArray<SynthToneStep>;
  noises?: ReadonlyArray<SynthNoiseStep>;
}

export type SfxRecipeId =
  | 'swordSlash'
  | 'lanceThrust'
  | 'bowRelease'
  | 'magicCast'
  | 'hitBasic'
  | 'hitCrit'
  | 'playerHurt'
  | 'skillWhirlwind'
  | 'skillDragonCharge'
  | 'skillArrowStorm'
  | 'skillMeteorNova'
  | 'levelUp'
  | 'classAdvance'
  | 'waveHorn'
  | 'bossRoar'
  | 'monsterDeath'
  | 'heal'
  | 'buildComplete';

/**
 * 데이터 기반 다층 Web Audio SFX 레시피 테이블
 * [AI Guideline]: 주파수, 길이, 볼륨, 필터 수치 조정은 이 파일에서만 수행합니다.
 */
export const SFX_RECIPES: Record<SfxRecipeId, SfxRecipe> = {
  swordSlash: {
    noises: [{ dur: 0.11, vol: 0.28, filterType: 'bandpass', startFreq: 2400, endFreq: 750, q: 1.8 }],
    tones: [{ type: 'triangle', startFreq: 480, endFreq: 130, dur: 0.09, vol: 0.22 }],
  },
  lanceThrust: {
    noises: [{ dur: 0.12, vol: 0.26, filterType: 'highpass', startFreq: 1800, endFreq: 600, q: 1.4 }],
    tones: [
      { type: 'sawtooth', startFreq: 740, endFreq: 180, dur: 0.11, vol: 0.16 },
      { type: 'sine', startFreq: 1120, endFreq: 320, dur: 0.08, vol: 0.18 },
    ],
  },
  bowRelease: {
    noises: [{ dur: 0.09, vol: 0.18, filterType: 'bandpass', startFreq: 3200, endFreq: 1200, q: 2.0 }],
    tones: [
      { type: 'triangle', startFreq: 340, endFreq: 140, dur: 0.09, vol: 0.24 },
      { type: 'sine', startFreq: 920, endFreq: 520, dur: 0.06, vol: 0.12, delay: 0.015 },
    ],
  },
  magicCast: {
    tones: [
      { type: 'sine', startFreq: 523.25, endFreq: 1046.5, dur: 0.16, vol: 0.2 },
      { type: 'triangle', startFreq: 783.99, endFreq: 1567.98, dur: 0.18, vol: 0.14, delay: 0.03 },
    ],
  },
  hitBasic: {
    noises: [{ dur: 0.07, vol: 0.24, filterType: 'lowpass', startFreq: 1400, endFreq: 260 }],
    tones: [{ type: 'triangle', startFreq: 190, endFreq: 58, dur: 0.08, vol: 0.34 }],
  },
  hitCrit: {
    noises: [{ dur: 0.12, vol: 0.3, filterType: 'bandpass', startFreq: 2600, endFreq: 600, q: 1.5 }],
    tones: [
      { type: 'sawtooth', startFreq: 260, endFreq: 65, dur: 0.14, vol: 0.26 },
      { type: 'sine', startFreq: 1567.98, endFreq: 2093.0, dur: 0.16, vol: 0.22, delay: 0.02 },
      { type: 'triangle', startFreq: 2637.02, endFreq: 1975.53, dur: 0.18, vol: 0.14, delay: 0.04 },
    ],
  },
  playerHurt: {
    noises: [{ dur: 0.14, vol: 0.24, filterType: 'lowpass', startFreq: 900, endFreq: 180 }],
    tones: [
      { type: 'sawtooth', startFreq: 165, endFreq: 55, dur: 0.18, vol: 0.3 },
      { type: 'square', startFreq: 110, endFreq: 48, dur: 0.16, vol: 0.16, delay: 0.02 },
    ],
  },
  skillWhirlwind: {
    noises: [
      { dur: 0.26, vol: 0.3, filterType: 'bandpass', startFreq: 1200, endFreq: 2800, q: 2.2 },
      { dur: 0.2, vol: 0.24, filterType: 'bandpass', startFreq: 2600, endFreq: 900, q: 1.8, delay: 0.12 },
    ],
    tones: [
      { type: 'sawtooth', startFreq: 220, endFreq: 540, dur: 0.16, vol: 0.18 },
      { type: 'triangle', startFreq: 620, endFreq: 180, dur: 0.22, vol: 0.22, delay: 0.1 },
    ],
  },
  skillDragonCharge: {
    noises: [{ dur: 0.3, vol: 0.34, filterType: 'bandpass', startFreq: 3200, endFreq: 420, q: 1.4, delay: 0.06 }],
    tones: [
      { type: 'sawtooth', startFreq: 140, endFreq: 420, dur: 0.12, vol: 0.22 },
      { type: 'sawtooth', startFreq: 580, endFreq: 90, dur: 0.24, vol: 0.28, delay: 0.08 },
      { type: 'sine', startFreq: 1760, endFreq: 440, dur: 0.18, vol: 0.16, delay: 0.1 },
    ],
  },
  skillArrowStorm: {
    noises: [
      { dur: 0.14, vol: 0.22, filterType: 'highpass', startFreq: 2400, endFreq: 1100 },
      { dur: 0.14, vol: 0.22, filterType: 'highpass', startFreq: 2800, endFreq: 950, delay: 0.08 },
      { dur: 0.16, vol: 0.24, filterType: 'bandpass', startFreq: 2200, endFreq: 750, delay: 0.16 },
    ],
    tones: [
      { type: 'triangle', startFreq: 1200, endFreq: 420, dur: 0.1, vol: 0.18 },
      { type: 'triangle', startFreq: 1380, endFreq: 460, dur: 0.1, vol: 0.18, delay: 0.07 },
      { type: 'triangle', startFreq: 1560, endFreq: 380, dur: 0.12, vol: 0.2, delay: 0.14 },
    ],
  },
  skillMeteorNova: {
    noises: [
      { dur: 0.22, vol: 0.22, filterType: 'bandpass', startFreq: 900, endFreq: 2200, q: 2.0 },
      { dur: 0.42, vol: 0.42, filterType: 'lowpass', startFreq: 1400, endFreq: 140, delay: 0.18 },
    ],
    tones: [
      { type: 'sine', startFreq: 240, endFreq: 680, dur: 0.18, vol: 0.2 },
      { type: 'sawtooth', startFreq: 180, endFreq: 42, dur: 0.38, vol: 0.32, delay: 0.18 },
      { type: 'triangle', startFreq: 420, endFreq: 68, dur: 0.34, vol: 0.26, delay: 0.2 },
    ],
  },
  levelUp: {
    tones: [
      { type: 'triangle', startFreq: 523.25, endFreq: 523.25, dur: 0.11, vol: 0.24, delay: 0.0 },
      { type: 'triangle', startFreq: 659.25, endFreq: 659.25, dur: 0.11, vol: 0.24, delay: 0.08 },
      { type: 'triangle', startFreq: 783.99, endFreq: 783.99, dur: 0.12, vol: 0.26, delay: 0.16 },
      { type: 'sine', startFreq: 1046.5, endFreq: 1046.5, dur: 0.32, vol: 0.28, delay: 0.24 },
      { type: 'sine', startFreq: 1567.98, endFreq: 1567.98, dur: 0.28, vol: 0.15, delay: 0.28 },
    ],
  },
  classAdvance: {
    tones: [
      { type: 'sawtooth', startFreq: 392.0, endFreq: 392.0, dur: 0.14, vol: 0.18, delay: 0.0 },
      { type: 'sawtooth', startFreq: 523.25, endFreq: 523.25, dur: 0.14, vol: 0.2, delay: 0.11 },
      { type: 'sawtooth', startFreq: 659.25, endFreq: 659.25, dur: 0.16, vol: 0.22, delay: 0.22 },
      { type: 'triangle', startFreq: 783.99, endFreq: 783.99, dur: 0.48, vol: 0.28, delay: 0.34 },
      { type: 'sine', startFreq: 1046.5, endFreq: 1046.5, dur: 0.48, vol: 0.24, delay: 0.34 },
    ],
  },
  waveHorn: {
    tones: [
      { type: 'sawtooth', startFreq: 146.83, endFreq: 142.0, dur: 0.46, vol: 0.24, delay: 0.0 },
      { type: 'sawtooth', startFreq: 220.0, endFreq: 215.0, dur: 0.44, vol: 0.18, delay: 0.05 },
      { type: 'triangle', startFreq: 293.66, endFreq: 288.0, dur: 0.38, vol: 0.16, delay: 0.1 },
    ],
  },
  bossRoar: {
    noises: [{ dur: 0.48, vol: 0.34, filterType: 'bandpass', startFreq: 620, endFreq: 180, q: 1.6 }],
    tones: [
      { type: 'sawtooth', startFreq: 118, endFreq: 52, dur: 0.45, vol: 0.3 },
      { type: 'square', startFreq: 86, endFreq: 42, dur: 0.42, vol: 0.18, delay: 0.04 },
    ],
  },
  monsterDeath: {
    noises: [{ dur: 0.11, vol: 0.2, filterType: 'bandpass', startFreq: 1600, endFreq: 420 }],
    tones: [
      { type: 'sine', startFreq: 520, endFreq: 180, dur: 0.11, vol: 0.22 },
      { type: 'triangle', startFreq: 880, endFreq: 1320, dur: 0.09, vol: 0.14, delay: 0.04 },
    ],
  },
  heal: {
    tones: [
      { type: 'sine', startFreq: 880.0, endFreq: 880.0, dur: 0.12, vol: 0.18, delay: 0.0 },
      { type: 'sine', startFreq: 1174.66, endFreq: 1174.66, dur: 0.14, vol: 0.2, delay: 0.06 },
      { type: 'sine', startFreq: 1760.0, endFreq: 1760.0, dur: 0.24, vol: 0.16, delay: 0.12 },
    ],
  },
  buildComplete: {
    noises: [{ dur: 0.09, vol: 0.24, filterType: 'lowpass', startFreq: 950, endFreq: 240 }],
    tones: [
      { type: 'triangle', startFreq: 220, endFreq: 110, dur: 0.1, vol: 0.28 },
      { type: 'sine', startFreq: 659.25, endFreq: 659.25, dur: 0.12, vol: 0.2, delay: 0.07 },
      { type: 'sine', startFreq: 987.77, endFreq: 987.77, dur: 0.22, vol: 0.22, delay: 0.14 },
    ],
  },
};
