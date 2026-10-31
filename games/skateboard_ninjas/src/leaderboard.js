// Online top-10 leaderboard in Supabase, stored in the skateboard_ninjas_scores
// table (see leaderboard.sql). Talks to the Supabase REST API with plain fetch
// so the game still has no build step. The publishable key is meant to be
// public; the table's row-level security policies decide what visitors can do.

const API = 'https://rhlwushiprnnivtksvlu.supabase.co/rest/v1';
const PUBLISHABLE_KEY = 'sb_publishable_6wecWNZ6eUBc2VDVNv0q9Q__GSboSQe';
const TABLE = 'skateboard_ninjas_scores';
const TIMEOUT_MS = 8000;

export const NAME_MAX = 16;

// Trim, collapse whitespace, drop control characters and cap the length.
export function cleanName(raw) {
  return String(raw)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
    .trim();
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
  // [{ name, score }], highest first; on a tie the earlier score ranks higher.
  async top(limit = 10) {
    const res = await request(`?select=nickname,score&order=score.desc,created_at.asc&limit=${limit}`);
    const rows = await res.json();
    return rows.map((r) => ({ name: r.nickname, score: r.score }));
  },

  async submit(name, score) {
    await request('', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ nickname: cleanName(name), score: Math.round(score) }),
    });
  },
};
