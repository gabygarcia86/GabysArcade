// Online top 10, stored in Supabase and reached through its REST API with plain
// fetch. The publishable key is meant to be public: the rules in leaderboard.sql
// decide what visitors can do.
window.SkylineLeaderboard = (() => {
  const API = "https://rhlwushiprnnivtksvlu.supabase.co/rest/v1";
  const PUBLISHABLE_KEY = "sb_publishable_6wecWNZ6eUBc2VDVNv0q9Q__GSboSQe";
  const TABLE = "skyline_slinger_scores";
  const TIMEOUT_MS = 8000;
  const NAME_KEY = "skylineSlinger.playerName";
  const NAME_MAX = 16;

  // Trims, collapses whitespace, drops control characters and caps the length.
  function cleanName(raw) {
    return String(raw)
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, NAME_MAX)
      .trim();
  }

  function loadName() {
    try {
      return localStorage.getItem(NAME_KEY) || "";
    } catch {
      return "";
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
    const signal =
      typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(TIMEOUT_MS)
        : undefined;
    const response = await fetch(`${API}/${TABLE}${query}`, {
      ...options,
      signal,
      headers: { apikey: PUBLISHABLE_KEY, ...options.headers },
    });
    if (!response.ok) {
      throw new Error(`Leaderboard request failed (${response.status})`);
    }
    return response;
  }

  // Farthest first. More stars breaks a tie, then the earlier score ranks higher.
  async function top(limit = 10) {
    const response = await request(
      `?select=nickname,distance,stars&order=distance.desc,stars.desc,created_at.asc&limit=${limit}`,
    );
    const rows = await response.json();
    return rows.map((row) => ({
      name: row.nickname,
      distance: row.distance,
      stars: row.stars,
    }));
  }

  async function submit(name, distance, stars) {
    await request("", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ nickname: cleanName(name), distance, stars }),
    });
  }

  return { NAME_MAX, cleanName, loadName, saveName, top, submit };
})();
