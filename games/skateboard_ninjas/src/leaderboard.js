// Online top-10 leaderboard in Supabase. New scores go into the `scores`
// table (id, nickname, score, created_at); the top 10 is read from the
// `leaderboard` view over it. Talks to the Supabase REST API with plain fetch
// so the game still has no build step. The anon key is meant to be public;
// the tables' row-level security policies decide what visitors can do.

const API = 'https://mazoblhzuykswhmcsgxj.supabase.co/rest/v1';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hem9ibGh6dXlrc3dobWNzZ3hqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5NDc1NjQsImV4cCI6MjEwODUyMzU2NH0.BBfgQovE4PX7ElsfdglJTfwcfb9t0rgr0AfIyH7Rx-U';
const TIMEOUT_MS = 8000;

export const NAME_MAX = 16;

// Trim, collapse whitespace, drop control characters and cap the length.
export function cleanName(raw) {
  return String(raw)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX);
}

async function request(path, options = {}) {
  const signal = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(TIMEOUT_MS) : undefined;
  const res = await fetch(`${API}/${path}`, {
    ...options,
    signal,
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, ...options.headers },
  });
  if (!res.ok) throw new Error(`Leaderboard request failed (${res.status})`);
  return res;
}

export const leaderboard = {
  // [{ name, score }], highest first; on a tie the earlier score ranks higher.
  async top(limit = 10) {
    const res = await request(`leaderboard?select=nickname,score&order=score.desc,created_at.asc&limit=${limit}`);
    const rows = await res.json();
    return rows.map((r) => ({ name: r.nickname, score: r.score }));
  },

  async submit(name, score) {
    await request('scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ nickname: cleanName(name), score: Math.round(score) }),
    });
  },
};
