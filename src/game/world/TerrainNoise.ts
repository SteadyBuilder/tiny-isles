/**
 * Deterministic 2D procedural noise utilities for Necesse-style terrain generation.
 * Pure functions with zero external dependencies so multiplayer clients compute identical maps.
 */

/**
 * 32-bit integer hash (Murmur-inspired mixing). Deterministic for any integer `(x, y, seed)`.
 */
export function hash2D(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

/**
 * Deterministic 1D PRNG in [0, 1) from integer seed.
 */
export function seededUnit(seed: number): number {
  let h = (seed | 0) + 0x6d2b79f5;
  h = Math.imul(h ^ (h >>> 15), h | 1);
  h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
  return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Smooth 2D value noise in [0, 1].
 */
export function valueNoise2D(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  const u = fade(xf);
  const v = fade(yf);

  const n00 = hash2D(xi, yi, seed);
  const n10 = hash2D(xi + 1, yi, seed);
  const n01 = hash2D(xi, yi + 1, seed);
  const n11 = hash2D(xi + 1, yi + 1, seed);

  const nx0 = lerp(n00, n10, u);
  const nx1 = lerp(n01, n11, u);
  return lerp(nx0, nx1, v);
}

/**
 * Multi-octave Fractal Brownian Motion (FBM) 2D noise normalized to [0, 1].
 */
export function fbm2D(
  x: number,
  y: number,
  seed: number,
  octaves: number = 3,
  lacunarity: number = 2.0,
  gain: number = 0.5
): number {
  let amplitude = 1.0;
  let frequency = 1.0;
  let total = 0.0;
  let maxAmplitude = 0.0;

  for (let i = 0; i < octaves; i++) {
    total += valueNoise2D(x * frequency, y * frequency, seed + i * 1013) * amplitude;
    maxAmplitude += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }

  return maxAmplitude > 0 ? total / maxAmplitude : 0;
}
