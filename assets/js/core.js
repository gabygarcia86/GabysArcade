/* Catalog loading, favorites and small helpers shared by the arcade pages. */
window.Arcade = (function () {
  const COMING_SOON_PREFIX = /^\s*coming\s+soon\b[\s:|–—-]*/i;
  const TITLE_TIMEOUT_MS = 4000;
  const FAVORITES_KEY = "gabysArcade.favorites";

  const catalog = window.ARCADE_CATALOG || { games: [], apps: [] };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
  }

  function decodeEntities(text) {
    return new DOMParser().parseFromString(text, "text/html").documentElement.textContent;
  }

  function normalizeEntry(entry, baseFolder) {
    const base = `${baseFolder}/${entry.folder}`;
    return {
      id: entry.folder,
      title: entry.title || entry.folder.replace(/[_-]+/g, " "),
      description: entry.description || "",
      category: entry.category || "Other",
      tags: Array.isArray(entry.tags) ? entry.tags : [],
      added: entry.added || "",
      url: entry.url || `${base}/index.html`,
      icon: entry.icon || `${base}/icon/icon-256.png`,
    };
  }

  /*
   * Reads a page's <title>. Titles sit near the top of the file, so the download
   * stops as soon as one is found. Returns null if the page can't be read, which
   * includes opening the site from file://, where fetch is blocked.
   */
  async function readPageTitle(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TITLE_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok || !response.body) return null;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let html = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (value) html += decoder.decode(value, { stream: true });
        const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        if (match) {
          controller.abort();
          return decodeEntities(match[1]).trim();
        }
        if (done) return null;
      }
    } catch (error) {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  /*
   * The title in each game's index.html decides its name and Coming Soon status,
   * so publishing a game needs no change here. The catalog title is the fallback.
   */
  async function resolveGame(entry) {
    const game = normalizeEntry(entry, "games");
    const rawTitle = (await readPageTitle(game.url)) || game.title;
    const comingSoon = COMING_SOON_PREFIX.test(rawTitle);
    const displayTitle = rawTitle.replace(COMING_SOON_PREFIX, "");
    return { ...game, comingSoon, title: displayTitle || game.title.replace(COMING_SOON_PREFIX, "") };
  }

  let gamesPromise = null;
  function loadGames() {
    gamesPromise ??= Promise.all(catalog.games.filter((entry) => entry.folder).map(resolveGame));
    return gamesPromise;
  }

  function getApps() {
    return catalog.apps.filter((entry) => entry.folder).map((entry) => normalizeEntry(entry, "apps"));
  }

  function storageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  const favorites = (function () {
    const listeners = new Set();
    let ids = read();

    function read() {
      try {
        const stored = JSON.parse(storageGet(FAVORITES_KEY));
        return new Set(Array.isArray(stored) ? stored : []);
      } catch (error) {
        return new Set();
      }
    }

    function notify() {
      listeners.forEach((listener) => listener());
    }

    // Keeps other open tabs of the arcade in step.
    window.addEventListener("storage", (event) => {
      if (event.key === FAVORITES_KEY) {
        ids = read();
        notify();
      }
    });

    return {
      has: (id) => ids.has(id),
      toggle(id) {
        if (!ids.delete(id)) ids.add(id);
        storageSet(FAVORITES_KEY, JSON.stringify([...ids]));
        notify();
      },
      subscribe: (listener) => listeners.add(listener),
    };
  })();

  return { escapeHtml, favorites, getApps, loadGames, storageSet };
})();
