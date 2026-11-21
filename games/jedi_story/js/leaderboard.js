/*
 * The online top 10, stored in Supabase and reached through its REST API with plain
 * fetch. The publishable key is meant to be public: the rules in leaderboard.sql
 * decide what visitors can do (read the board and add a score, nothing else).
 */
(function (J) {
  const API = "https://rhlwushiprnnivtksvlu.supabase.co/rest/v1";
  const PUBLISHABLE_KEY = "sb_publishable_6wecWNZ6eUBc2VDVNv0q9Q__GSboSQe";
  const TABLE = "jedi_story_scores";
  const TIMEOUT_MS = 8000;
  const NAME_KEY = "jediStory.playerName";
  const NAME_MAX = 16;

  // Trim, collapse whitespace, drop control characters and cap the length.
  function cleanName(raw) {
    return String(raw || "")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, NAME_MAX)
      .trim();
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
      // Storage blocked: the player just types their name again next time.
    }
  }

  async function request(query, options = {}) {
    const signal = typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(TIMEOUT_MS) : undefined;
    const response = await fetch(`${API}/${TABLE}${query}`, {
      ...options,
      signal,
      headers: { apikey: PUBLISHABLE_KEY, ...options.headers },
    });
    if (!response.ok) throw new Error(`Leaderboard request failed (${response.status})`);
    return response;
  }

  J.Leaderboard = {
    NAME_MAX,
    cleanName,
    loadName,
    saveName,

    // Highest first; on a tie the earlier score ranks higher.
    async top(limit = 10) {
      const response = await request(
        `?select=nickname,score,levels_cleared,finished&order=score.desc,created_at.asc&limit=${limit}`,
      );
      const rows = await response.json();
      return rows.map((row) => ({
        name: row.nickname,
        score: row.score,
        levels: row.levels_cleared,
        finished: row.finished,
      }));
    },

    async submit({ name, score, levels, finished }) {
      await request("", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ nickname: cleanName(name), score, levels_cleared: levels, finished: !!finished }),
      });
    },
  };
})(window.JEDI);
