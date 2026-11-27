// Online top 10 per difficulty, stored in Supabase. Reading the boards uses its REST API
// with plain fetch. Adding a score goes through the latke-toss-score Edge Function, which
// checks the round's event log before saving it (see supabase/functions/). The publishable
// key is meant to be public: the rules in leaderboard.sql stop visitors writing directly.

const PROJECT = 'https://rhlwushiprnnivtksvlu.supabase.co';
const API = `${PROJECT}/rest/v1`;
const FUNCTION_URL = `${PROJECT}/functions/v1/latke-toss-score`;
const PUBLISHABLE_KEY = 'sb_publishable_6wecWNZ6eUBc2VDVNv0q9Q__GSboSQe';
const TABLE = 'latke_toss_scores';
const TIMEOUT_MS = 8000;
const NAME_KEY = 'latkeToss.playerName';

export const NAME_MAX = 16;

/** A failed request. `message` is fit to show the player when `fromServer` is true. */
export class LeaderboardError extends Error {
  constructor(message, { fromServer = false } = {}) {
    super(message);
    this.fromServer = fromServer;
  }
}

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

function timeoutSignal() {
  return typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(TIMEOUT_MS) : undefined;
}

async function request(query, options = {}) {
  const res = await fetch(`${API}/${TABLE}${query}`, {
    ...options,
    signal: timeoutSignal(),
    headers: { apikey: PUBLISHABLE_KEY, ...options.headers },
  });
  if (!res.ok) throw new LeaderboardError(`Leaderboard request failed (${res.status})`);
  return res;
}

async function callFunction(body) {
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    signal: timeoutSignal(),
    headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // No JSON body, such as a gateway error page.
  }
  if (!res.ok) {
    const message = typeof data?.error === 'string' ? data.error : null;
    throw new LeaderboardError(message || `Leaderboard request failed (${res.status})`, { fromServer: !!message });
  }
  return data;
}

export const leaderboard = {
  /** Returns a difficulty's [{ name, score }], highest first. On a tie the earlier score ranks higher. */
  async top(difficulty, limit = 10) {
    const filter = `difficulty=eq.${encodeURIComponent(difficulty)}`;
    const res = await request(`?select=nickname,score&${filter}&order=score.desc,created_at.asc&limit=${limit}`);
    const rows = await res.json();
    return rows.map((r) => ({ name: r.nickname, score: r.score }));
  },

  /** Asks for a single-use ticket at the start of a round. Resolves to null if offline. */
  async startRound(difficulty) {
    try {
      const data = await callFunction({ action: 'start', difficulty });
      return typeof data?.token === 'string' ? data.token : null;
    } catch {
      return null;
    }
  },

  /** `round` is { ticket, events } from the game: the ticket promise and the event log. */
  async submit(difficulty, name, score, round) {
    const token = await round.ticket;
    if (!token) {
      throw new LeaderboardError(
        "The leaderboard couldn't be reached when this round started, so it can't be submitted.",
        { fromServer: true },
      );
    }
    await callFunction({
      action: 'submit', token, difficulty, nickname: cleanName(name), score, events: round.events,
    });
  },
};
