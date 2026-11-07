/* Undo / redo.
 * Three kinds of entries:
 *   page    JSON snapshot of one page before/after (object & layer edits)
 *   doc     JSON snapshot of the page list + cover/settings (add/delete/reorder pages, cover edits)
 *   raster  before/after pixels of the changed rectangle of a drawing layer
 * Raster pixels are never part of page snapshots: layers point at them by rasterId, so the
 * two kinds of entries stay independent. */
(function () {
  "use strict";
  const CBS = window.CBS;
  const { bus } = CBS;

  const replacer = (k, v) => (k && k[0] === "_" ? undefined : v);
  const MAX_ENTRIES = 100;
  const MAX_RASTER_BYTES = 450 * 1024 * 1024;

  function snapDoc(p) {
    return JSON.stringify({
      pages: p.pages, cover: p.cover, settings: p.settings, title: p.title, author: p.author,
      description: p.description, pageSize: p.pageSize,
    }, replacer);
  }

  const history = {
    undoStack: [],
    redoStack: [],
    pending: null,
    depth: 0,
    rasterBytes: 0,

    reset() {
      this.undoStack = [];
      this.redoStack = [];
      this.pending = null;
      this.depth = 0;
      this.rasterBytes = 0;
      bus.emit("history:changed");
    },

    snap(scope) {
      const doc = CBS.doc;
      if (scope === "doc") return snapDoc(doc.project);
      return JSON.stringify(doc.page, replacer);
    },

    begin(scope = "page") {
      if (!CBS.doc.project) return;
      if (this.depth++ > 0) {
        // A nested doc-level edit inside a page-level one: widen the pending snapshot if nothing changed yet.
        if (scope === "doc" && this.pending && this.pending.scope === "page" && this.snap("page") === this.pending.before) {
          this.pending = this._pending("doc");
        }
        return;
      }
      this.pending = this._pending(scope);
    },
    _pending(scope) {
      const doc = CBS.doc;
      return { scope, before: this.snap(scope), pageId: doc.page && doc.page.id, sel: doc.selection.slice() };
    },

    end(label = "Edit") {
      if (this.depth === 0) return false;
      if (--this.depth > 0) return false;
      const p = this.pending;
      this.pending = null;
      if (!p) return false;
      const doc = CBS.doc;
      if (p.scope === "page" && (!doc.page || doc.page.id !== p.pageId)) return false;
      const after = this.snap(p.scope);
      if (after === p.before) return false;
      this._push({ type: p.scope, label, pageId: p.pageId, before: p.before, after, selBefore: p.sel, selAfter: doc.selection.slice() });
      return true;
    },

    /* Roll back the pending edit without recording it (e.g. Escape during a drag). */
    cancel() {
      const p = this.pending;
      this.pending = null;
      this.depth = 0;
      if (!p) return;
      this._apply({ type: p.scope, pageId: p.pageId, before: p.before }, "before", p.sel);
    },

    pushRaster(entry) {
      entry.type = "raster";
      entry.bytes = (entry.before ? entry.before.data.length : 0) + (entry.after ? entry.after.data.length : 0);
      entry.pageId = CBS.doc.page && CBS.doc.page.id;
      this._push(entry);
    },

    _push(entry) {
      this.undoStack.push(entry);
      if (entry.bytes) this.rasterBytes += entry.bytes;
      for (const r of this.redoStack) if (r.bytes) this.rasterBytes -= r.bytes;
      this.redoStack = [];
      while (this.undoStack.length > MAX_ENTRIES || (this.rasterBytes > MAX_RASTER_BYTES && this.undoStack.length > 1)) {
        const old = this.undoStack.shift();
        if (old.bytes) this.rasterBytes -= old.bytes;
      }
      bus.emit("history:changed");
    },

    get canUndo() { return this.undoStack.length > 0; },
    get canRedo() { return this.redoStack.length > 0; },
    get undoLabel() { const e = this.undoStack[this.undoStack.length - 1]; return e ? e.label || "" : ""; },
    get redoLabel() { const e = this.redoStack[this.redoStack.length - 1]; return e ? e.label || "" : ""; },

    undo() {
      if (this.depth > 0) return;
      const e = this.undoStack.pop();
      if (!e) return;
      this.redoStack.push(e);
      this._apply(e, "before", e.selBefore);
      CBS.ui && CBS.ui.toast("Undo " + (e.label || ""), { kind: "dim", ms: 900 });
      bus.emit("history:changed");
    },
    redo() {
      if (this.depth > 0) return;
      const e = this.redoStack.pop();
      if (!e) return;
      this.undoStack.push(e);
      this._apply(e, "after", e.selAfter);
      CBS.ui && CBS.ui.toast("Redo " + (e.label || ""), { kind: "dim", ms: 900 });
      bus.emit("history:changed");
    },

    _apply(e, which, sel) {
      const doc = CBS.doc;
      const p = doc.project;
      if (!p) return;
      if (e.type === "raster") {
        const img = e[which];
        if (img) CBS.raster.putPixels(e.rasterId, img, e.x, e.y);
        if (e.pageId && e.pageId !== doc.pageId && p.pages.some((pg) => pg.id === e.pageId)) doc.setPage(e.pageId);
        doc.changed("raster");
        return;
      }
      if (e.type === "doc") {
        const data = JSON.parse(e[which]);
        Object.assign(p, data);
        if (!p.pages.some((pg) => pg.id === doc.pageId)) doc.pageId = p.pages[0] ? p.pages[0].id : null;
        doc.selection = [];
        bus.emit("page:changed");
        bus.emit("pages:changed");
      } else {
        const idx = p.pages.findIndex((pg) => pg.id === e.pageId);
        if (idx < 0) return;
        p.pages[idx] = JSON.parse(e[which]);
        if (doc.pageId !== e.pageId) { doc.pageId = e.pageId; bus.emit("page:changed"); }
        doc.selection = (sel || []).filter((id) => doc.obj(id));
      }
      bus.emit("layers:changed");
      bus.emit("selection:changed");
      doc.changed(e.type === "doc" ? "doc" : "page");
    },
  };

  CBS.history = history;
  CBS.snapReplacer = replacer;
})();
