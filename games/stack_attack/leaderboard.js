/**
 * Online top 10 per difficulty, stored in Supabase and reached through its REST
 * API with plain fetch. The publishable key is meant to be public: the rules in
 * leaderboard.sql decide what visitors can do.
 */
window.StackAttackLeaderboard = (() => {
  'use strict';

  const API = 'https://rhlwushiprnnivtksvlu.supabase.co/rest/v1';
  const PUBLISHABLE_KEY = 'sb_publishable_6wecWNZ6eUBc2VDVNv0q9Q__GSboSQe';
  const TABLE = 'stack_attack_scores';
  const TIMEOUT_MS = 8000;
  const NAME_KEY = 'stackAttack.playerName';
  const NAME_MAX = 16;

  /** Trims, collapses whitespace, drops control characters and caps the length. */
  function cleanName(raw) {
    return String(raw)
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, NAME_MAX)
      .trim();
  }

  function loadName() {
    try {
      return localStorage.getItem(NAME_KEY) || '';
    } catch {
      return '';
    }
  }

  function saveName(name) {
    try {
      localStorage.setItem(NAME_KEY, name);
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

  /** Highest first. On a tie the earlier score ranks higher. */
  async function top(difficulty, limit = 10) {
    const filter = `difficulty=eq.${encodeURIComponent(difficulty)}`;
    const res = await request(`?select=nickname,score&${filter}&order=score.desc,created_at.asc&limit=${limit}`);
    const rows = await res.json();
    return rows.map((r) => ({ name: r.nickname, score: r.score }));
  }

  async function submit(difficulty, name, score) {
    await request('', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ difficulty, nickname: cleanName(name), score }),
    });
  }

  return { NAME_MAX, cleanName, loadName, saveName, top, submit };
})();
