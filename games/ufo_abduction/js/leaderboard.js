/*
 * The online top 10, stored in Supabase and reached through its REST API with plain
 * fetch. Classic and Endless have separate boards in one table, split by `mode`.
 * The publishable key is meant to be public: the rules in leaderboard.sql decide what
 * visitors can do (read the boards and add a score, nothing else).
 */
(function (U) {
  "use strict";

  const API = "https://rhlwushiprnnivtksvlu.supabase.co/rest/v1";
  const PUBLISHABLE_KEY = "sb_publishable_6wecWNZ6eUBc2VDVNv0q9Q__GSboSQe";
  const TABLE = "ufo_abduction_scores";
  const TIMEOUT_MS = 8000;
  const NAME_KEY = "ufoAbduction.playerName";
  const NAME_MAX = 16;
  const MODES = ["classic", "endless"];

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

  U.Leaderboard = {
    NAME_MAX,
    cleanName,
    loadName,
    saveName,

    // Highest first. On a tie the earlier score ranks higher.
    async top(mode, limit = 10) {
      if (!MODES.includes(mode)) throw new Error("Unknown mode");
      const rows = await request(
        `?select=nickname,score,level,abductions,rescues,best_combo,seconds,finished` +
          `&mode=eq.${mode}&order=score.desc,created_at.asc,id.asc&limit=${limit}`,
      );
      return rows.map((row) => ({
        name: String(row.nickname),
        score: Number(row.score) || 0,
        level: Number(row.level) || 1,
        abductions: Number(row.abductions) || 0,
        rescues: Number(row.rescues) || 0,
        bestCombo: Number(row.best_combo) || 0,
        seconds: Number(row.seconds) || 0,
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
          mode: entry.mode,
          level: Math.floor(entry.level),
          abductions: Math.floor(entry.abductions),
          rescues: Math.floor(entry.rescues),
          best_combo: Math.floor(entry.bestCombo),
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
})(window.UFO);
