/* Small IndexedDB wrapper.
 * Stores:
 *   projects  full project data, keyed by project id
 *   meta      lightweight project list entries (title, thumbnail, dates)
 *   library   the user's personal asset library, shared by every comic
 *   kv        misc values (last open project, recovery pointer) */
(function () {
  "use strict";
  const CBS = window.CBS;
  const DB_NAME = "comic-book-studio";
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!window.indexedDB) { rej(new Error("IndexedDB not available")); return; }
      let req;
      try { req = indexedDB.open(DB_NAME, 1); } catch (e) { rej(e); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of ["projects", "meta", "library"]) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv", { keyPath: "key" });
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
      req.onblocked = () => rej(new Error("Database blocked by another tab"));
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
      t.onabort = () => rej(t.error || new Error("Storage transaction aborted (the disk may be full)"));
    }));
  }

  CBS.storage = {
    available: null,
    async check() {
      try { await open(); this.available = true; } catch (e) { this.available = false; }
      return this.available;
    },
    put: (store, value) => tx(store, "readwrite", (s) => s.put(value)),
    get: (store, key) => tx(store, "readonly", (s) => s.get(key)),
    del: (store, key) => tx(store, "readwrite", (s) => s.delete(key)),
    all: (store) => tx(store, "readonly", (s) => s.getAll()),
    async kvGet(key) { const r = await tx("kv", "readonly", (s) => s.get(key)); return r ? r.value : undefined; },
    kvSet: (key, value) => tx("kv", "readwrite", (s) => s.put({ key, value })),
  };
})();
