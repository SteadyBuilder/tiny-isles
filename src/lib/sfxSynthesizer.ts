import { SFX_RECIPES, SfxRecipeId, SynthNoiseStep, SynthToneStep } from '../data/sfxConfig';

/**
 * Web Audio API 기반 다층(Oscillator + Filtered Noise) SFX 합성기
 */
export class SfxSynthesizer {
  private noiseBuffer: AudioBuffer | null = null;

  public playRecipe(ctx: AudioContext, recipeId: SfxRecipeId, sfxVolume: number, pitchJitter = 0.04): void {
    const recipe = SFX_RECIPES[recipeId];
    if (!recipe || sfxVolume <= 0) return;

    const now = ctx.currentTime;
    const pitchMult = pitchJitter > 0 ? 1 + (Math.random() * 2 - 1) * pitchJitter : 1;

    if (recipe.tones) {
      for (const tone of recipe.tones) {
        this.scheduleTone(ctx, now, tone, sfxVolume, pitchMult);
      }
    }

    if (recipe.noises) {
      for (const noise of recipe.noises) {
        this.scheduleNoise(ctx, now, noise, sfxVolume);
      }
    }
  }

  private scheduleTone(
    ctx: AudioContext,
    baseTime: number,
    step: SynthToneStep,
    sfxVolume: number,
    pitchMult: number
  ): void {
    const start = baseTime + (step.delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = step.type;
    osc.frequency.setValueAtTime(Math.max(20, step.startFreq * pitchMult), start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, step.endFreq * pitchMult), start + step.dur);

    const peak = Math.max(0.001, step.vol * sfxVolume);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.007);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + step.dur);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + step.dur + 0.015);
  }

  private scheduleNoise(
    ctx: AudioContext,
    baseTime: number,
    step: SynthNoiseStep,
    sfxVolume: number
  ): void {
    const buffer = this.ensureNoiseBuffer(ctx);
    const start = baseTime + (step.delay ?? 0);

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = step.filterType;
    filter.Q.setValueAtTime(step.q ?? 1.0, start);
    filter.frequency.setValueAtTime(Math.max(40, step.startFreq), start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, step.endFreq), start + step.dur);

    const gain = ctx.createGain();
    const peak = Math.max(0.001, step.vol * sfxVolume);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + step.dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(start);
    src.stop(start + step.dur + 0.015);
  }

  private ensureNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const length = Math.floor(ctx.sampleRate * 0.6);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }
}
