/* Persistent state in localStorage (guest mode, no account needed).
 * Every read and write is wrapped so private browsing or blocked storage never breaks the app:
 * it falls back to memory for the session and the UI says so. */
(function () {
  "use strict";
  const CF = window.CF;
  const PREFIX = "cf.v1.";
  const memory = {};
  let persistent = true;
  try {
    const k = PREFIX + "__probe";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
  } catch (e) { persistent = false; }

  const store = {
    persistent,
    get(key, def) {
      try {
        const raw = persistent ? localStorage.getItem(PREFIX + key) : memory[key];
        return raw == null ? CF.clone(def) : JSON.parse(raw);
      } catch (e) { return CF.clone(def); }
    },
    set(key, val) {
      const raw = JSON.stringify(val);
      try {
        if (persistent) localStorage.setItem(PREFIX + key, raw);
        else memory[key] = raw;
      } catch (e) {
        memory[key] = raw;
        CF.ui?.toast("Couldn't save to this browser's storage. Your change lasts until you close the tab.", "warn");
      }
      CF.bus.emit("store:" + key, val);
      return val;
    },
    update(key, def, fn) { const v = store.get(key, def); const out = fn(v) ?? v; return store.set(key, out); },
    remove(key) { try { if (persistent) localStorage.removeItem(PREFIX + key); delete memory[key]; } catch (e) {} },
    keys() {
      try { return persistent ? Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).map((k) => k.slice(PREFIX.length)) : Object.keys(memory); }
      catch (e) { return []; }
    },
    exportAll() { const out = {}; for (const k of store.keys()) out[k] = store.get(k, null); return out; },
    importAll(obj) { for (const [k, v] of Object.entries(obj || {})) if (/^[a-zA-Z]+$/.test(k)) store.set(k, v); },
    clearAll() { for (const k of store.keys()) store.remove(k); },
  };
  CF.store = store;

  /* ---------- settings ---------- */
  // homePorts: default departure ports for new searches: Miami, Fort Lauderdale and Port Canaveral (Orlando).
  // Change or clear them in Settings. FLORIDA_PORTS (all four, incl. Tampa) backs the "All Florida ports" button.
  const FLORIDA_PORTS = ["MIA", "PCV", "FLL", "TPA"];
  const DEFAULT_HOME_PORTS = ["MIA", "FLL", "PCV"];
  const DEFAULT_SETTINGS = { currency: "USD", theme: "auto", aiEngine: "builtin", aiEndpoint: "", notify: false, homePorts: DEFAULT_HOME_PORTS };
  CF.settings = {
    all: () => ({ ...DEFAULT_SETTINGS, ...store.get("settings", {}) }),
    get: (k) => CF.settings.all()[k],
    set: (k, v) => store.update("settings", {}, (s) => { s[k] = v; }),
    currency: () => CF.settings.get("currency"),
    FLORIDA_PORTS,
    DEFAULT_HOME_PORTS,
    homePorts: () => (Array.isArray(CF.settings.get("homePorts")) ? CF.settings.get("homePorts") : []),
    homePortsLabel() {
      const p = CF.settings.homePorts();
      if (!p.length) return "Any port";
      if (p.length === FLORIDA_PORTS.length && FLORIDA_PORTS.every((x) => p.includes(x))) return "Florida ports";
      if (p.length === DEFAULT_HOME_PORTS.length && DEFAULT_HOME_PORTS.every((x) => p.includes(x))) return "Miami, Fort Lauderdale & Orlando";
      return p.map((id) => (id === "PCV" ? "Port Canaveral (Orlando)" : CF.data?.port(id)?.name.split(",")[0] || id)).join(", ");
    },
    // Changing the default also updates the current search so it takes effect right away.
    setHomePorts(ports) {
      CF.settings.set("homePorts", ports);
      store.update("search", {}, (s) => { s.ports = [...ports]; s.v = 3; });
      store.update("datesForm", {}, (f) => { f.port = "home"; });
    },
  };

  /* ---------- error log (shown in Admin) ---------- */
  CF.log = {
    error(err, context) {
      const entry = { at: Date.now(), message: String(err?.message || err), context: context || "", stack: String(err?.stack || "").split("\n").slice(0, 4).join("\n") };
      console.error("[Cruise Finder]", context || "", err);
      store.update("errors", [], (list) => { list.unshift(entry); return list.slice(0, 50); });
    },
    count(metric, n = 1) { store.update("usage", {}, (u) => { u[metric] = (u[metric] || 0) + n; }); },
  };
  window.addEventListener("error", (e) => CF.log.error(e.error || e.message, "window.onerror"));
  window.addEventListener("unhandledrejection", (e) => CF.log.error(e.reason, "unhandled promise"));

  /* ---------- favorites, wish lists, recently viewed ---------- */
  CF.saved = {
    favorites: () => store.get("favorites", []),
    isFav: (id) => CF.saved.favorites().includes(id),
    toggleFav(id) {
      let on = false;
      store.update("favorites", [], (f) => {
        const i = f.indexOf(id);
        if (i >= 0) f.splice(i, 1); else { f.unshift(id); on = true; }
      });
      CF.bus.emit("favorites");
      return on;
    },
    lists: () => store.get("lists", []),
    createList(name) { const l = { id: CF.uid("list"), name: name || "My wish list", items: [], created: Date.now() }; store.update("lists", [], (ls) => { ls.push(l); }); return l; },
    renameList(id, name) { store.update("lists", [], (ls) => { const l = ls.find((x) => x.id === id); if (l) l.name = name; }); },
    deleteList(id) { store.update("lists", [], (ls) => ls.filter((x) => x.id !== id)); },
    toggleInList(listId, sailingId) {
      let on = false;
      store.update("lists", [], (ls) => {
        const l = ls.find((x) => x.id === listId);
        if (!l) return;
        const i = l.items.indexOf(sailingId);
        if (i >= 0) l.items.splice(i, 1); else { l.items.push(sailingId); on = true; }
      });
      return on;
    },
    recent: () => store.get("recent", []),
    addRecent(id) { store.update("recent", [], (r) => { const out = [id, ...r.filter((x) => x !== id)]; return out.slice(0, 12); }); },

    // Saved pricing configurations
    configs: () => store.get("configs", []),
    saveConfig(sailingId, config, name, total) {
      const c = { id: CF.uid("cfg"), sailingId, config: CF.clone(config), name, total, savedAt: Date.now() };
      store.update("configs", [], (list) => { list.unshift(c); });
      return c;
    },
    updateConfig(id, patch) { store.update("configs", [], (list) => { const c = list.find((x) => x.id === id); if (c) Object.assign(c, patch, { savedAt: Date.now() }); }); },
    deleteConfig(id) { store.update("configs", [], (list) => list.filter((x) => x.id !== id)); },

    // Saved comparisons
    comparisons: () => store.get("comparisons", []),
    saveComparison(name, compare, profile) {
      const c = { id: CF.uid("cmp"), name, items: CF.clone(compare), profile: CF.clone(profile), savedAt: Date.now() };
      store.update("comparisons", [], (list) => { list.unshift(c); });
      return c;
    },
    deleteComparison(id) { store.update("comparisons", [], (list) => list.filter((x) => x.id !== id)); },
  };

  /* ---------- compare tray: up to 5 sailings, each optionally with its own configuration ---------- */
  const MAX_COMPARE = 5;
  CF.compare = {
    MAX: MAX_COMPARE,
    items: () => store.get("compare", []), // [{id, config|null}]
    has: (id) => CF.compare.items().some((x) => x.id === id),
    toggle(id) {
      const items = CF.compare.items();
      const i = items.findIndex((x) => x.id === id);
      if (i >= 0) { items.splice(i, 1); store.set("compare", items); CF.bus.emit("compare"); return false; }
      if (items.length >= MAX_COMPARE) { CF.ui.toast(`You can compare up to ${MAX_COMPARE} cruises. Remove one first.`, "warn"); return false; }
      items.push({ id, config: null });
      store.set("compare", items);
      CF.bus.emit("compare");
      return true;
    },
    add(id, config) {
      const items = CF.compare.items().filter((x) => x.id !== id);
      if (items.length >= MAX_COMPARE) return false;
      items.push({ id, config: config ? CF.clone(config) : null });
      store.set("compare", items);
      CF.bus.emit("compare");
      return true;
    },
    setConfig(id, config) {
      store.update("compare", [], (items) => { const it = items.find((x) => x.id === id); if (it) it.config = config ? CF.clone(config) : null; });
      CF.bus.emit("compare");
    },
    set(items) { store.set("compare", items.slice(0, MAX_COMPARE)); CF.bus.emit("compare"); },
    clear() { store.set("compare", []); CF.bus.emit("compare"); },
  };

  /* ---------- trip preferences (the shared configuration used for search totals and fair comparisons) ---------- */
  CF.profile = {
    get: () => {
      const p = store.get("profile", null);
      return p && p.v === 1 ? p : CF.pricing.defaultConfig();
    },
    set: (p) => { store.set("profile", p); CF.bus.emit("profile", p); },
    reset: () => { store.remove("profile"); CF.bus.emit("profile", CF.profile.get()); },
  };

  /* ---------- price tracker ---------- */
  CF.tracker = {
    list: () => store.get("trackers", []),
    add(sailingId, config, target, total) {
      const t = { id: CF.uid("trk"), sailingId, config: CF.clone(config), target: target || 0, created: Date.now(), checks: [{ at: Date.now(), total }] };
      store.update("trackers", [], (list) => { list.unshift(t); });
      return t;
    },
    update(id, fn) { store.update("trackers", [], (list) => { const t = list.find((x) => x.id === id); if (t) fn(t); }); },
    remove(id) { store.update("trackers", [], (list) => list.filter((x) => x.id !== id)); },
  };
})();
