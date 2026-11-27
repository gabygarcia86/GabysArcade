import { MAX_VALUE } from './multipliers.js';

const compactNumber = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });
const fullNumber = new Intl.NumberFormat('en-US');

/** Commas up to a billion, then "1.25B", so huge scores still fit the HUD. */
export function formatNumber(value) {
  return value < 1e9 ? fullNumber.format(value) : compactNumber.format(value);
}

/**
 * Points for one slice landing on a plate. `calculation` is the sum shown to the player,
 * for example "5 × 120X = 600", and is null when no multiplier applied.
 */
export function scoreLanding(platePoints, multipliers, { bounced = false } = {}) {
  const multiplier = multipliers.totalFor({ bounced });
  const points = Math.min(MAX_VALUE, platePoints * multiplier);
  return {
    points,
    multiplier,
    calculation: multiplier > 1
      ? `${formatNumber(platePoints)} × ${formatNumber(multiplier)}X = ${formatNumber(points)}`
      : null,
  };
}

/** Adds to a running total, staying between zero and the largest score the leaderboard can hold. */
export function addScore(score, points) {
  return Math.min(MAX_VALUE, Math.max(0, score + points));
}

// Closing line on the results screen, best match first.
const MESSAGES = [
  { min: 20000, text: 'Legendary! The whole family is asking you to carve next year.' },
  { min: 2000, text: 'Grandma says that was the best dinner in years!' },
  { min: 250, text: 'Seconds for everyone! That table looks delicious.' },
  { min: 50, text: 'A respectable feast. Save room for pumpkin pie!' },
  { min: 1, text: 'A modest helping. There is always next Thanksgiving!' },
  { min: 0, text: 'The dog ate well today. Everyone else, not so much.' },
];

export function resultMessage(score) {
  return MESSAGES.find((message) => score >= message.min).text;
}
