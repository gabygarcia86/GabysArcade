// Online top 10 per song and difficulty, stored in Supabase and reached through
// its REST API with plain fetch. The publishable key is meant to be public: the
// rules in leaderboard.sql decide what visitors can do.

const API = 'https://rhlwushiprnnivtksvlu.supabase.co/rest/v1';
const PUBLISHABLE_KEY = 'sb_publishable_6wecWNZ6eUBc2VDVNv0q9Q__GSboSQe';
const TABLE = 'touch_the_beat_scores';
const TIMEOUT_MS = 8000;
const NAME_KEY = 'ttb.playerName';

export const NAME_MAX = 16;

/** Trim, collapse whitespace, drop control characters and cap the length. */
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
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
}

export function saveName(name) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* storage blocked — the player just types their name again next time */
  }
}

/** Only shipped songs have a board, because other charts differ per device. */
export function hasBoard(song) {
  return song.source !== 'imported';
}

/** Why a run can't be submitted, or '' when it can. Boards only compare like with like. */
export function submitBlockReason(song, timingWindows) {
  if (!hasBoard(song)) return "Imported songs are only on this device, so they aren't on the leaderboard.";
  if (song.recompiled) return 'Recompiled charts differ from everyone else\'s. Reset this song to its default chart to join the leaderboard.';
  if (timingWindows === 'lenient') return 'Lenient timing makes hits easier. Switch to Standard or Strict in Settings to join the leaderboard.';
  return '';
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
  /** Highest first. On a tie the earlier score ranks higher. */
  async top(song, difficulty, limit = 10) {
    const filter = `song=eq.${encodeURIComponent(song)}&difficulty=eq.${encodeURIComponent(difficulty)}`;
    const res = await request(`?select=nickname,score,accuracy&${filter}&order=score.desc,created_at.asc&limit=${limit}`);
    const rows = await res.json();
    return rows.map((r) => ({ name: r.nickname, score: r.score, accuracy: Number(r.accuracy) }));
  },

  async submit({ song, difficulty, name, score, accuracy }) {
    await request('', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ song, difficulty, nickname: cleanName(name), score, accuracy }),
    });
  },
};
