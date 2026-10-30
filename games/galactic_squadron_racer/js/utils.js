/**
 * Math helpers. The base set (clamp, lerp, Pool, mulberry32 …) is shared with
 * Galactic Squadron; racing-specific helpers are added below.
 */
export * from '../../galactic_squadron/js/utils.js';
import { TAU } from '../../galactic_squadron/js/utils.js';

export const smoothstep = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** Exponential smoothing factor for a rate (1/s) over dt: framerate independent. */
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

/** Wraps a distance into [0, len). */
export const wrapLen = (s, len) => ((s % len) + len) % len;

/** Signed shortest difference a - b on a loop of length len, in (-len/2, len/2]. */
export function loopDelta(a, b, len) {
  let d = (a - b) % len;
  if (d > len / 2) d -= len;
  else if (d <= -len / 2) d += len;
  return d;
}

export function shuffle(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** "1:02.345" from seconds. */
export function formatTime(t) {
  if (!Number.isFinite(t)) return '--:--.---';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(3)}`;
}

export function ordinal(n) {
  return n + (['TH', 'ST', 'ND', 'RD'][n % 10 > 3 || Math.floor(n / 10) % 10 === 1 ? 0 : n % 10] || 'TH');
}

export const angleOf = (x, y) => Math.atan2(y, x);
export const fullTurn = TAU;
