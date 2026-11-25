// Online top 10 for Stunt Showdown, stored in Supabase and reached through its REST API with
// plain fetch. The publishable key is meant to be public: the rules in leaderboard.sql decide
// what visitors can do (read the board and add a score, nothing else).
import { SKIS } from './data.js';

const API = 'https://rhlwushiprnnivtksvlu.supabase.co/rest/v1';
const PUBLISHABLE_KEY = 'sb_publishable_6wecWNZ6eUBc2VDVNv0q9Q__GSboSQe';
const TABLE = 'jet_ski_paradise_scores';
const TIMEOUT_MS = 8000;
const NAME_KEY = 'jetSkiParadise.playerName';

export const NAME_MAX = 16;

// Printable characters only, single spaces, at most 16 Unicode characters.
export function cleanName(raw) {
  const tidy = String(raw || '')
    .replace(/\s+/g, ' ')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .trim();
  return Array.from(tidy).slice(0, NAME_MAX).join('').trim();
}

export function loadName() {
  try { return localStorage.getItem(NAME_KEY) || ''; } catch (error) { return ''; }
}

export function saveName(name) {
  try { localStorage.setItem(NAME_KEY, name); } catch (error) { /* type it again next time */ }
}

async function request(query, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${API}/${TABLE}${query}`, {
      ...options,
      signal: controller.signal,
      headers: { apikey: PUBLISHABLE_KEY, ...options.headers },
    });
    if (!response.ok) {
      const error = new Error(`Leaderboard request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return options.method === 'POST' ? null : await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// Highest first; on a tie the earlier score ranks higher.
export async function fetchTop(limit = 10) {
  const rows = await request(`?select=nickname,score,tricks,best_combo,ski,created_at&order=score.desc,created_at.asc,id.asc&limit=${limit}`);
  return rows.map((row) => ({
    name: String(row.nickname),
    score: Number(row.score) || 0,
    tricks: Number(row.tricks) || 0,
    combo: Number(row.best_combo) || 0,
    ski: (SKIS.find((s) => s.id === row.ski) || { name: '' }).name,
  }));
}

export async function submitScore(entry) {
  await request('', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({
      nickname: cleanName(entry.name),
      score: Math.floor(entry.score),
      tricks: Math.floor(entry.tricks),
      best_combo: Math.floor(entry.combo),
      ski: entry.ski,
      seconds: Math.round(entry.seconds),
    }),
  });
}

// A failed request in words a player understands.
export function explain(error) {
  if (error.status === 404) return "The leaderboard isn't set up yet. Please try again later.";
  if (error.status === 400) return 'That score or name was not accepted.';
  if (error.status === 401 || error.status === 403) return 'The leaderboard refused the request. Please try again later.';
  if (error.status) return 'The leaderboard had a problem. Please try again.';
  return "Can't reach the leaderboard. Check your connection and try again.";
}
