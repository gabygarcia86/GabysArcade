/* Renders the favorites, library, Coming Soon and Apps sections, plus the PIN dialog. */
(function () {
  const { escapeHtml, favorites, getApps, loadGames, storageSet } = window.Arcade;

  const PREVIEW_PASS_KEY = "gabysArcade.previewUntil";
  const PREVIEW_PASS_MS = 12 * 60 * 60 * 1000;

  const ICONS = {
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.6l6.5-.9z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  };

  const SORTS = {
    az: { label: "Alphabetical: A–Z", compare: (a, b) => byTitle(a, b) },
    za: { label: "Alphabetical: Z–A", compare: (a, b) => byTitle(b, a) },
    recent: {
      label: "Recently added",
      compare: (a, b) => b.added.localeCompare(a.added) || byTitle(a, b),
    },
    favorites: {
      label: "Favorites first",
      compare: (a, b) => favorites.has(b.id) - favorites.has(a.id) || byTitle(a, b),
    },
  };

  function byTitle(a, b) {
    return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" });
  }

  function announce(message) {
    const region = document.getElementById("live-region");
    if (region) region.textContent = message;
  }

  function art(item, altSuffix) {
    return `
      <div class="card-art" data-initial="${escapeHtml(item.title.charAt(0))}">
        <img src="${escapeHtml(item.icon)}" alt="${escapeHtml(item.title)} ${altSuffix}"
          width="256" height="256" loading="lazy" decoding="async">
      </div>`;
  }

  function favoriteButton(game) {
    const active = favorites.has(game.id);
    const verb = active ? "Remove" : "Add";
    const preposition = active ? "from" : "to";
    return `
      <button class="fav-btn" type="button" data-fav="${escapeHtml(game.id)}"
        data-title="${escapeHtml(game.title)}" aria-pressed="${active}"
        aria-label="${verb} ${escapeHtml(game.title)} ${preposition} favorites">${ICONS.star}</button>`;
  }

  function gameCard(game) {
    return `
      <article class="card">
        ${art(game, "game icon")}
        <div class="card-body">
          <h3 class="card-title">
            <a class="card-link" href="${escapeHtml(game.url)}" target="_blank" rel="noopener">
              ${escapeHtml(game.title)}<span class="sr-only"> (opens in a new tab)</span>
            </a>
          </h3>
          <p class="card-desc">${escapeHtml(game.description)}</p>
          <div class="card-meta">
            <span class="tag">${escapeHtml(game.category)}</span>
            <span class="card-cta" aria-hidden="true">Play ${ICONS.arrow}</span>
          </div>
        </div>
        ${favoriteButton(game)}
      </article>`;
  }

  function comingSoonCard(game) {
    return `
      <article class="card card-locked">
        ${art({ ...game, title: "Coming Soon" }, "game icon")}
        <div class="card-body">
          <h3 class="card-title">
            <button class="card-link" type="button" data-unlock="${escapeHtml(game.id)}">
              <span class="sr-only">Coming Soon game (PIN required)</span>
            </button>
          </h3>
          <div class="card-meta">
            <span class="tag">Coming Soon</span>
            <span class="card-cta" aria-hidden="true">${ICONS.lock}</span>
          </div>
        </div>
      </article>`;
  }

  function appCard(app) {
    return `
      <article class="card">
        ${art(app, "app icon")}
        <div class="card-body">
          <h3 class="card-title">
            <a class="card-link" href="${escapeHtml(app.url)}" target="_blank" rel="noopener">
              ${escapeHtml(app.title)}<span class="sr-only"> (opens in a new tab)</span>
            </a>
          </h3>
          <p class="card-desc">${escapeHtml(app.description)}</p>
          <div class="card-meta">
            <span class="tag">${escapeHtml(app.category)}</span>
            <span class="card-cta" aria-hidden="true">Launch ${ICONS.arrow}</span>
          </div>
        </div>
      </article>`;
  }

  function matchesQuery(game, query) {
    const searchable = [game.title, game.description, game.category, ...game.tags]
      .join(" ")
      .toLowerCase();
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .every((word) => searchable.includes(word));
  }

  function createLibrary(root, games) {
    const state = { query: "", category: "All", sort: "az" };

    const categoryCounts = new Map();
    games.forEach((game) => {
      categoryCounts.set(game.category, (categoryCounts.get(game.category) || 0) + 1);
    });
    const categories = [...categoryCounts.keys()].sort((a, b) => a.localeCompare(b));

    // Sorting by date means nothing until real dates exist, so the option stays hidden.
    const hasDates = games.filter((game) => game.added).length >= 2;
    const sortOptions = Object.entries(SORTS)
      .filter(([key]) => key !== "recent" || hasDates)
      .map(([key, sort]) => `<option value="${key}">${sort.label}</option>`)
      .join("");

    const chip = (value, label, count) => `
      <button class="chip" type="button" data-category="${escapeHtml(value)}" aria-pressed="${value === state.category}">
        ${escapeHtml(label)} <span class="chip-count">${count}</span>
      </button>`;

    root.innerHTML = `
      <div class="library-tools">
        <div class="search-field">
          ${ICONS.search}
          <input type="search" id="library-search" placeholder="Search games, genres, tags…"
            aria-label="Search games" autocomplete="off" enterkeyhint="search">
          <button class="search-clear" type="button" aria-label="Clear search" hidden>${ICONS.close}</button>
        </div>
        <div class="sort-field">
          <label for="library-sort">Sort</label>
          <select id="library-sort">${sortOptions}</select>
        </div>
      </div>
      <div class="chips" role="group" aria-label="Filter by category">
        ${chip("All", "All", games.length)}
        ${categories.map((name) => chip(name, name, categoryCounts.get(name))).join("")}
      </div>
      <p class="library-count" role="status"></p>
      <div class="card-grid" data-library-grid></div>`;

    const grid = root.querySelector("[data-library-grid]");
    const count = root.querySelector(".library-count");
    const search = root.querySelector("#library-search");
    const clearSearch = root.querySelector(".search-clear");
    const sort = root.querySelector("#library-sort");

    function render() {
      const focusedFavorite = document.activeElement?.dataset?.fav;
      const visible = games
        .filter((game) => state.category === "All" || game.category === state.category)
        .filter((game) => matchesQuery(game, state.query))
        .sort(SORTS[state.sort].compare);

      count.textContent = `Showing ${visible.length} of ${games.length} games`;
      clearSearch.hidden = !state.query;
      root.querySelectorAll(".chip").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.category === state.category));
      });

      grid.innerHTML = visible.length
        ? visible.map(gameCard).join("")
        : `<div class="empty-state">
             <h3>No games found</h3>
             <p>Nothing matches your search and filters.</p>
             <button class="btn btn-ghost" type="button" data-clear-filters>Clear search and filters</button>
           </div>`;

      if (focusedFavorite) grid.querySelector(`[data-fav="${focusedFavorite}"]`)?.focus();
    }

    function reset() {
      state.query = "";
      state.category = "All";
      search.value = "";
      render();
    }

    search.addEventListener("input", () => {
      state.query = search.value.trim();
      render();
    });
    clearSearch.addEventListener("click", () => {
      search.value = "";
      state.query = "";
      render();
      search.focus();
    });
    sort.addEventListener("change", () => {
      state.sort = sort.value;
      render();
    });
    root.addEventListener("click", (event) => {
      const categoryButton = event.target.closest("[data-category]");
      if (categoryButton) {
        state.category = categoryButton.dataset.category;
        render();
      } else if (event.target.closest("[data-clear-filters]")) {
        reset();
        search.focus();
      }
    });

    render();
    favorites.subscribe(() => {
      if (state.sort === "favorites") render();
    });
  }

  function renderFavorites(root, games) {
    const favoriteGames = games.filter((game) => favorites.has(game.id)).sort(byTitle);
    const emptied = !favoriteGames.length && root.contains(document.activeElement);

    root.innerHTML = favoriteGames.length
      ? `<div class="card-grid">${favoriteGames.map(gameCard).join("")}</div>`
      : `<div class="empty-state empty-state-compact">
           <span class="empty-star">${ICONS.star}</span>
           <p><strong>No favorites yet.</strong> Tap the star on any game and it will show up here, saved in this browser.</p>
         </div>`;

    // The star that had focus was just removed, so keep keyboard users in this section.
    if (emptied) document.getElementById("favorites-heading")?.focus();
  }

  function createPinDialog(games) {
    const dialog = document.createElement("dialog");
    dialog.className = "pin-dialog";
    dialog.setAttribute("aria-labelledby", "pin-title");
    dialog.innerHTML = `
      <form method="dialog" novalidate>
        <p class="eyebrow">Restricted build</p>
        <h2 id="pin-title">Coming Soon</h2>
        <p class="pin-help">This game is still in development. Enter the PIN to open the test build.</p>
        <label for="pin-input">PIN</label>
        <input id="pin-input" type="password" inputmode="numeric" autocomplete="off"
          maxlength="8" aria-describedby="pin-error">
        <p class="field-error" id="pin-error" role="alert"></p>
        <div class="pin-actions">
          <button class="btn btn-ghost" type="button" data-pin-cancel>Cancel</button>
          <button class="btn btn-primary" type="submit">Unlock</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);

    const input = dialog.querySelector("#pin-input");
    const error = dialog.querySelector("#pin-error");
    let activeGame = null;

    dialog.querySelector("[data-pin-cancel]").addEventListener("click", () => dialog.close());

    // Clicking the backdrop lands on the dialog element itself.
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });

    dialog.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      if (hashPin(input.value.trim()) !== window.ARCADE_CONFIG.comingSoonPinHash) {
        error.textContent = "That PIN isn’t correct. Please try again.";
        input.setAttribute("aria-invalid", "true");
        input.value = "";
        input.focus();
        return;
      }

      storageSet(PREVIEW_PASS_KEY, String(Date.now() + PREVIEW_PASS_MS));
      dialog.close();
      // Runs inside the submit gesture so popup blockers allow it. If one still
      // blocks the new tab, the game opens in this tab instead.
      const opened = window.open(activeGame.url, "_blank");
      if (!opened) location.href = activeGame.url;
    });

    document.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-unlock]");
      if (!trigger) return;
      activeGame = games.find((game) => game.id === trigger.dataset.unlock);
      error.textContent = "";
      input.value = "";
      input.removeAttribute("aria-invalid");
      dialog.showModal();
      input.focus();
    });
  }

  // FNV-1a. A 4-digit PIN can't be secured in the browser whatever the hash; this only
  // keeps it out of plain view. tools/hash-pin.mjs produces the same value.
  function hashPin(pin) {
    let hash = 0x811c9dc5;
    for (const char of `gabys-arcade:${pin}`) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }

  function syncFavoriteButtons() {
    document.querySelectorAll("[data-fav]").forEach((button) => {
      const active = favorites.has(button.dataset.fav);
      const title = button.dataset.title;
      button.setAttribute("aria-pressed", String(active));
      button.setAttribute(
        "aria-label",
        active ? `Remove ${title} from favorites` : `Add ${title} to favorites`,
      );
    });
  }

  function setStat(name, value) {
    const element = document.querySelector(`[data-stat="${name}"]`);
    if (element) element.textContent = value;
  }

  // Lands on the right section for links like index.html#coming-soon, because the
  // browser's own jump happens before the cards have loaded.
  function restoreHashTarget() {
    if (location.hash.length > 1) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView();
    }
  }

  // Shows the card's initial on its panel if an icon is missing.
  document.addEventListener(
    "error",
    (event) => {
      if (event.target.matches?.(".card-art img")) {
        event.target.closest(".card-art").classList.add("is-missing");
        event.target.remove();
      }
    },
    true,
  );

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-fav]");
    if (!button) return;
    const { fav: id, title } = button.dataset;
    favorites.toggle(id);
    announce(favorites.has(id) ? `${title} added to favorites` : `${title} removed from favorites`);
  });

  async function init() {
    const appsRoot = document.querySelector("[data-apps]");
    const apps = getApps();
    setStat("apps", apps.length);
    if (appsRoot) {
      appsRoot.innerHTML = apps.length
        ? `<div class="card-grid">${apps.map(appCard).join("")}</div>`
        : `<div class="empty-state"><h3>No apps yet</h3><p>Check back soon.</p></div>`;
    }

    const libraryRoot = document.querySelector("[data-library]");
    const favoritesRoot = document.querySelector("[data-favorites]");
    const comingSoonRoot = document.querySelector("[data-coming-soon]");
    if (!libraryRoot && !favoritesRoot && !comingSoonRoot) return;

    const games = await loadGames();
    const publicGames = games.filter((game) => !game.comingSoon);
    const upcomingGames = games.filter((game) => game.comingSoon).sort(byTitle);

    setStat("games", publicGames.length);
    setStat("upcoming", upcomingGames.length);

    if (libraryRoot) createLibrary(libraryRoot, publicGames);

    if (comingSoonRoot) {
      comingSoonRoot.innerHTML = upcomingGames.length
        ? `<div class="card-grid">${upcomingGames.map(comingSoonCard).join("")}</div>`
        : `<div class="empty-state empty-state-compact"><p><strong>Nothing in the lab right now.</strong> New projects will appear here while they’re in development.</p></div>`;
      if (upcomingGames.length) createPinDialog(upcomingGames);
    }

    if (favoritesRoot) {
      renderFavorites(favoritesRoot, publicGames);
      favorites.subscribe(() => renderFavorites(favoritesRoot, publicGames));
    }
    favorites.subscribe(syncFavoriteButtons);

    restoreHashTarget();
  }

  init();
})();
