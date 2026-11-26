/*
 * Online top 10, stored in Supabase and reached through its REST API with plain fetch.
 * The publishable key is meant to be public: the rules in leaderboard.sql decide what
 * visitors can do (read the board and add a score, nothing else).
 *
 * A campaign score is the best score from each level, plus 2,500 per X symbol found.
 * A game over also adds the points earned in the run that just ended.
 */
(function (XM) {
  "use strict";
  const API = "https://rhlwushiprnnivtksvlu.supabase.co/rest/v1";
  const PUBLISHABLE_KEY = "sb_publishable_6wecWNZ6eUBc2VDVNv0q9Q__GSboSQe";
  const TABLE = "xmen_rise_of_the_mutants_scores";
  const TIMEOUT_MS = 8000;
  const NAME_KEY = "xmenRiseOfTheMutants.playerName";
  const NAME_MAX = 16;
  const LEVEL_CAP = 90000; // matches the scoring cap in game.js and leaderboard.sql

  function cleanName(raw) {
    const tidy = String(raw || "")
      .replace(/\s+/g, " ")
      .replace(/[\p{Cc}\p{Cf}]/gu, "")
      .trim();
    return Array.from(tidy).slice(0, NAME_MAX).join("").trim();
  }

  async function request(query, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
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
      return options.method === "POST" ? null : await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  XM.Leaderboard = {
    NAME_MAX,
    LEVEL_CAP,
    cleanName,
    loadName() {
      try {
        return localStorage.getItem(NAME_KEY) || "";
      } catch (error) {
        return "";
      }
    },
    saveName(name) {
      try {
        localStorage.setItem(NAME_KEY, name);
      } catch (error) {
        // Storage is blocked; the player types their name again next time.
      }
    },

    // The campaign score the leaderboard uses. runScore adds an unfinished run (game over).
    campaignEntry(runScore = 0, hero = XM.Save.data.selected) {
      const d = XM.Save.data;
      const xs = d.levels.reduce((n, l) => n + l.x.filter(Boolean).length, 0);
      const cleared = d.levels.filter((l) => l.cleared).length;
      const best = d.levels.reduce((n, l) => n + Math.min(LEVEL_CAP, l.best), 0);
      return {
        score: Math.floor(best + xs * 2500 + Math.min(LEVEL_CAP, Math.max(0, runScore))),
        levels: cleared,
        xSymbols: xs,
        hero,
        finished: !!d.campaign.finished && cleared === 20,
      };
    },

    // Highest first. On a tie the earlier score ranks higher.
    async top(limit = 10) {
      const rows = await request(`?select=nickname,score,levels_cleared,x_symbols,hero,finished&order=score.desc,created_at.asc,id.asc&limit=${limit}`);
      return rows.map((row) => ({
        name: String(row.nickname),
        score: Number(row.score) || 0,
        levels: Number(row.levels_cleared) || 0,
        xSymbols: Number(row.x_symbols) || 0,
        hero: (XM.CHAR[row.hero] || { name: "" }).name,
        finished: row.finished === true,
      }));
    },

    async submit({ name, score, levels, xSymbols, hero, finished }) {
      await request("", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ nickname: cleanName(name), score, levels_cleared: levels, x_symbols: xSymbols, hero, finished }),
      });
    },

    explain(error) {
      if (error.status === 404) return "The leaderboard isn't set up yet. Please try again later.";
      if (error.status === 400) return "That score or name was not accepted.";
      if (error.status === 401 || error.status === 403) return "The leaderboard refused the request. Please try again later.";
      if (error.status) return "The leaderboard had a problem. Please try again.";
      return "Can't reach the leaderboard. Check your connection and try again.";
    },
  };
})(window.XM);
