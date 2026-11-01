// Online top 10, stored in Supabase and reached through its REST API with plain fetch.
// The publishable key is meant to be public: the rules in leaderboard.sql decide what
// visitors can do.

const API = 'https://rhlwushiprnnivtksvlu.supabase.co/rest/v1';
const PUBLISHABLE_KEY = 'sb_publishable_6wecWNZ6eUBc2VDVNv0q9Q__GSboSQe';
const TABLE = 'turkey_toss_scores';
const TIMEOUT_MS = 8000;
const NAME_KEY = 'turkeyToss.playerName';

export const NAME_MAX = 16;

/** Trims, collapses whitespace, drops control characters and caps the length. */
export function cleanName(raw) {
  return String(raw)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
    .trim();
}

export function loadName() {
  try {
    return window.localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
}

export function saveName(name) {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    // Storage blocked: the player just types their name again next time.
  }
}

async function request(query, options = {}) {
  const signal = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(TIMEOUT_MS) : undefined;
  const res = await fetch(`${API}/${TABLE}${query}`, {
    ...options,
    signal,
    headers: { apikey: PUBLISHABLE_KEY, ...options.headers },
  });
  if (!res.ok) throw new Error(`Leaderboard request failed (${res.status})`);
  return res;
}

export const leaderboard = {
  /** Returns [{ name, score }], highest first. On a tie the earlier score ranks higher. */
  async top(limit = 10) {
    const res = await request(`?select=nickname,score&order=score.desc,created_at.asc&limit=${limit}`);
    const rows = await res.json();
    return rows.map((r) => ({ name: r.nickname, score: r.score }));
  },

  async submit(name, score) {
    await request('', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ nickname: cleanName(name), score }),
    });
  },
};
