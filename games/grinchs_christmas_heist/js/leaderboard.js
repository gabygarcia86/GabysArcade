/*
 * The online top 10, stored in Supabase and reached through its REST API with plain
 * fetch (no library). The publishable key is meant to be public: the rules in
 * leaderboard.sql decide what visitors can do (read the board and add a score, nothing else).
 */
(function (G) {
  "use strict";

  const API = "https://rhlwushiprnnivtksvlu.supabase.co/rest/v1";
  const PUBLISHABLE_KEY = "sb_publishable_6wecWNZ6eUBc2VDVNv0q9Q__GSboSQe";
  const TABLE = "grinch_heist_scores";
  const TIMEOUT_MS = 8000;
  const NAME_KEY = "grinchHeist.playerName";
  const NAME_MAX = 16;

  // Printable characters only, single spaces, at most 16 Unicode characters.
  function cleanName(raw) {
    const tidy = String(raw || "")
      .replace(/\s+/g, " ")
      .replace(/[\p{Cc}\p{Cf}]/gu, "")
      .trim();
    return Array.from(tidy).slice(0, NAME_MAX).join("").trim();
  }

  function loadName() {
    try {
      return localStorage.getItem(NAME_KEY) || "";
    } catch (error) {
      return "";
    }
  }

  function saveName(name) {
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch (error) {
      // Storage is blocked, so the player types their name again next time.
    }
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

  G.Leaderboard = {
    NAME_MAX,
    cleanName,
    loadName,
    saveName,

    // Highest first. On a tie the earlier score ranks higher.
    async top(limit = 10) {
      const rows = await request(
        `?select=nickname,score,level,loot,presents,caught,finished` + `&order=score.desc,created_at.asc,id.asc&limit=${limit}`,
      );
      return rows.map((row) => ({
        name: String(row.nickname),
        score: Number(row.score) || 0,
        level: Number(row.level) || 1,
        loot: Number(row.loot) || 0,
        presents: Number(row.presents) || 0,
        caught: Number(row.caught) || 0,
        finished: row.finished === true,
      }));
    },

    async submit(entry) {
      await request("", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          nickname: cleanName(entry.name),
          score: Math.floor(entry.score),
          level: Math.floor(entry.level),
          loot: Math.floor(entry.loot),
          presents: Math.floor(entry.presents),
          caught: Math.floor(entry.caught),
          seconds: Math.max(1, Math.floor(entry.seconds)),
          finished: !!entry.finished,
        }),
      });
    },

    // A failed request, in words a player understands.
    explain(error) {
      if (error.status === 404) return "The leaderboard isn't set up yet. Please try again later.";
      if (error.status === 400) return "That score or name was not accepted.";
      if (error.status === 401 || error.status === 403) return "The leaderboard refused the request. Please try again later.";
      if (error.status) return "The leaderboard had a problem. Please try again.";
      return "Can't reach the leaderboard. Check your connection and try again.";
    },
  };
})(window.GH);
