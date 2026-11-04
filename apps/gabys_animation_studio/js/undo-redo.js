/* Undo / redo.
 * Each history entry knows how to undo and redo itself. Pixel changes store only the
 * rectangle that changed, so long drawing sessions stay light on memory. */
(function () {
  "use strict";
  const GAS = window.GAS;
  const { state, Layer, ctxOf } = GAS;

  const MAX_STEPS = 100;
  const MAX_BYTES = 280 * 1024 * 1024;

  const stack = [];
  let index = 0; // entries [0, index) are applied
  let bytes = 0;

  function emitChange() {
    GAS.bus.emit("history-changed", { canUndo: index > 0, canRedo: index < stack.length });
  }

  function push(entry) {
    // Drop everything that could have been redone.
    for (let i = index; i < stack.length; i++) bytes -= stack[i].bytes || 0;
    stack.length = index;
    stack.push(entry);
    bytes += entry.bytes || 0;
    index = stack.length;
    while (stack.length > 1 && (stack.length > MAX_STEPS || bytes > MAX_BYTES)) {
      const old = stack.shift();
      bytes -= old.bytes || 0;
      index--;
    }
    emitChange();
    GAS.bus.emit("dirty");
  }

  function undo() {
    if (GAS.selection) {
      GAS.selection.flushEdit();
      if (GAS.selection.cancelFloat()) return true; // first undo just drops a floating selection
    }
    if (index === 0) return false;
    const entry = stack[--index];
    entry.undo();
    GAS.bus.emit("history-applied", { entry, dir: "undo" });
    emitChange();
    GAS.bus.emit("dirty");
    return true;
  }

  function redo() {
    if (index >= stack.length) return false;
    if (GAS.selection) GAS.selection.commitFloat();
    const entry = stack[index++];
    entry.redo();
    GAS.bus.emit("history-applied", { entry, dir: "redo" });
    emitChange();
    GAS.bus.emit("dirty");
    return true;
  }

  function clear() {
    stack.length = 0;
    index = 0;
    bytes = 0;
    emitChange();
  }

  /* ---------- entry builders ---------- */

  /* Pixel change. Call with the ImageData captured BEFORE drawing; the "after" pixels are read now. */
  function pushRaster(layer, rect, before, frameId, label) {
    const ctx = ctxOf(layer.canvas);
    const after = ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
    const wasEmpty = layer._wasEmpty;
    delete layer._wasEmpty;
    push({
      label,
      frameId,
      bytes: before.data.length * 2,
      undo() {
        ctxOf(layer.canvas).putImageData(before, rect.x, rect.y);
        layer.v++;
        layer.empty = wasEmpty === true;
      },
      redo() {
        ctxOf(layer.canvas).putImageData(after, rect.x, rect.y);
        Layer.touch(layer);
      },
    });
  }

  /* Captures the pixels in `rect` before a change. Use with pushRaster. */
  function captureRaster(layer, rect) {
    layer._wasEmpty = layer.empty;
    return ctxOf(layer.canvas).getImageData(rect.x, rect.y, rect.w, rect.h);
  }

  /* Clamp a rectangle to the layer, returning null when nothing is left. */
  function clipRect(layer, x, y, w, h) {
    const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(layer.canvas.width, Math.ceil(x + w)), y1 = Math.min(layer.canvas.height, Math.ceil(y + h));
    if (x1 <= x0 || y1 <= y0) return null;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  const cloneObjs = (objs) => objs.map((o) => ({ ...o }));

  /* Object list change on one frame. `before` is a clone taken before the change. */
  function pushObjects(frame, before, label) {
    const after = cloneObjs(frame.objects);
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    push({
      label,
      frameId: frame.id,
      bytes: 2000,
      undo() { frame.objects = cloneObjs(before); },
      redo() { frame.objects = cloneObjs(after); },
    });
  }

  /* Frame list change (add, delete, move, duplicate, paste). */
  function pushFrames(beforeFrames, beforeCur, label) {
    const p = state.project;
    const after = p.frames.slice();
    const afterCur = state.cur;
    push({
      label,
      bytes: 1000,
      undo() { p.frames = beforeFrames.slice(); state.cur = Math.min(beforeCur, p.frames.length - 1); },
      redo() { p.frames = after.slice(); state.cur = Math.min(afterCur, p.frames.length - 1); },
      structural: true,
    });
  }

  /* Anything else: give it undo/redo functions. */
  function pushChange(label, undoFn, redoFn, frameId, extra) {
    push({ label, frameId, bytes: 500, undo: undoFn, redo: redoFn, ...(extra || {}) });
  }

  /* Several entries that undo/redo together. */
  function pushGroup(label, entries, frameId) {
    push({
      label,
      frameId,
      bytes: entries.reduce((s, e) => s + (e.bytes || 0), 0),
      undo() { for (let i = entries.length - 1; i >= 0; i--) entries[i].undo(); },
      redo() { for (const e of entries) e.redo(); },
      structural: entries.some((e) => e.structural),
    });
  }

  /* Builds a raster entry without pushing it (for groups). */
  function rasterEntry(layer, rect, before) {
    const after = ctxOf(layer.canvas).getImageData(rect.x, rect.y, rect.w, rect.h);
    return {
      bytes: before.data.length * 2,
      undo() { ctxOf(layer.canvas).putImageData(before, rect.x, rect.y); layer.v++; },
      redo() { ctxOf(layer.canvas).putImageData(after, rect.x, rect.y); Layer.touch(layer); },
    };
  }

  GAS.history = {
    push, undo, redo, clear, pushRaster, captureRaster, clipRect, pushObjects, pushFrames, pushChange, pushGroup,
    rasterEntry, cloneObjs,
    get canUndo() { return index > 0; },
    get canRedo() { return index < stack.length; },
    get nextUndoLabel() { return index > 0 ? stack[index - 1].label : ""; },
    get nextRedoLabel() { return index < stack.length ? stack[index].label : ""; },
  };
})();
