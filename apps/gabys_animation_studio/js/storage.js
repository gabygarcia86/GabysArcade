/* Local storage in IndexedDB. Everything stays on this device: nothing is ever uploaded.
 * Stores:  projects  full project data (frames as PNG blobs)
 *          index     small cards for the "My Projects" list (name, date, thumbnail)
 *          meta      key/value (last opened project) */
(function () {
  "use strict";
  const GAS = window.GAS;
  const DB_NAME = "gabys-animation-studio";
  const VERSION = 1;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error("IndexedDB not available")); return; }
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
        if (!db.objectStoreNames.contains("index")) db.createObjectStore("index", { keyPath: "id" });
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("Database blocked"));
    });
    dbPromise.catch(() => { dbPromise = null; });
    return dbPromise;
  }

  function tx(stores, mode, fn) {
    return open().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(stores, mode);
      let result;
      Promise.resolve(fn(t)).then((r) => { result = r; }, reject);
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error("Transaction aborted"));
    }));
  }
  const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  async function saveProject(record, card) {
    return tx(["projects", "index"], "readwrite", (t) => {
      t.objectStore("projects").put(record);
      t.objectStore("index").put(card);
    });
  }
  const loadProject = (id) => tx(["projects"], "readonly", (t) => reqP(t.objectStore("projects").get(id)));
  const listProjects = () => tx(["index"], "readonly", (t) => reqP(t.objectStore("index").getAll()))
    .then((list) => (list || []).sort((a, b) => b.updatedAt - a.updatedAt));
  const deleteProject = (id) => tx(["projects", "index"], "readwrite", (t) => {
    t.objectStore("projects").delete(id);
    t.objectStore("index").delete(id);
  });
  const getMeta = (key) => tx(["meta"], "readonly", (t) => reqP(t.objectStore("meta").get(key)));
  const setMeta = (key, value) => tx(["meta"], "readwrite", (t) => { t.objectStore("meta").put(value, key); });

  async function estimate() {
    try {
      if (navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate();
    } catch { /* ignore */ }
    return null;
  }
  async function persist() {
    try {
      if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
    } catch { /* ignore */ }
    return false;
  }

  GAS.storage = { open, saveProject, loadProject, listProjects, deleteProject, getMeta, setMeta, estimate, persist };
})();
