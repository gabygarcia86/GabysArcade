/*
 * Online top 10s, stored in Supabase and reached through its REST API with plain fetch.
 * The publishable key is meant to be public: the rules in leaderboard.sql decide what
 * visitors can do.
 */
(function (D) {
  const API = "https://rhlwushiprnnivtksvlu.supabase.co/rest/v1";
  const PUBLISHABLE_KEY = "sb_publishable_6wecWNZ6eUBc2VDVNv0q9Q__GSboSQe";
  const TABLE = "droid_chomp_scores";
  const TIMEOUT_MS = 8000;
  const NAME_MAX = 16;

  async function request(query, options = {}) {
    const signal = typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(TIMEOUT_MS) : undefined;
    const response = await fetch(`${API}/${TABLE}${query}`, {
      ...options,
      signal,
      headers: { apikey: PUBLISHABLE_KEY, ...options.headers },
    });
    if (!response.ok) throw new Error(`Leaderboard request failed (${response.status})`);
    return response;
  }

  D.Leaderboard = {
    NAME_MAX,

    // Trim, collapse whitespace, drop control characters and cap the length.
    cleanName(raw) {
      return String(raw)
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, NAME_MAX)
        .trim();
    },

    // One difficulty's board. Highest first; on a tie the earlier score ranks higher.
    async top(difficulty, limit = 10) {
      const filter = `difficulty=eq.${encodeURIComponent(difficulty)}`;
      const response = await request(
        `?select=nickname,score,droid,level,cycle&${filter}&order=score.desc,created_at.asc&limit=${limit}`,
      );
      const rows = await response.json();
      return rows.map((row) => ({ name: row.nickname, score: row.score, droid: row.droid, level: row.level, cycle: row.cycle }));
    },

    async submit({ name, score, difficulty, droid, level, cycle }) {
      await request("", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ nickname: this.cleanName(name), score, difficulty, droid, level, cycle }),
      });
    },
  };
})(window.DROID);
