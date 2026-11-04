/* Small IndexedDB wrapper. Stores: projects, assets (audio bytes), meta (recovery, settings). */
(function () {
  "use strict";
  const GBL = window.GBL;
  const DB_NAME = "gabys-beat-lab";
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!window.indexedDB) { rej(new Error("IndexedDB not available")); return; }
      let req;
      try { req = indexedDB.open(DB_NAME, 1); } catch (e) { rej(e); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
        if (!db.objectStoreNames.contains("assets")) db.createObjectStore("assets", { keyPath: "id" });
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
      req.onblocked = () => rej(new Error("Database blocked"));
    });
    dbp.catch(() => { /* reported by callers */ });
    return dbp;
  }

  function tx(store, mode, fn) {
    return open().then((db) => new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      let result;
      const r = fn(s);
      if (r) r.onsuccess = () => { result = r.result; };
      t.oncomplete = () => res(result);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    }));
  }

  const storage = {
    available: null,
    async check() {
      try { await open(); this.available = true; } catch (e) { this.available = false; }
      return this.available;
    },
    put: (store, value) => tx(store, "readwrite", (s) => s.put(value)),
    get: (store, key) => tx(store, "readonly", (s) => s.get(key)),
    del: (store, key) => tx(store, "readwrite", (s) => s.delete(key)),
    all: (store) => tx(store, "readonly", (s) => s.getAll()),
  };
  GBL.storage = storage;
})();
