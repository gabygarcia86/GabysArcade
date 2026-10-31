// Undo and redo for every kind of change. Each entry is { label, undo, redo, bytes, drop }.
// `drop` runs when an entry falls off the list, so it can free GPU resources.

const MAX_BYTES = 384 * 1024 * 1024;
const MIN_ENTRIES = 12;

export class History {
  constructor(app) {
    this.app = app;
    this.entries = [];
    this.position = 0;
    this.bytes = 0;
  }

  push(entry) {
    for (const stale of this.entries.splice(this.position)) this._discard(stale, "redone");
    this.entries.push(entry);
    this.position = this.entries.length;
    this.bytes += entry.bytes ?? 0;
    while (this.bytes > MAX_BYTES && this.entries.length > MIN_ENTRIES) {
      this._discard(this.entries.shift(), "done");
      this.position--;
    }
    this._changed();
  }

  _discard(entry, state) {
    this.bytes -= entry.bytes ?? 0;
    entry.drop?.(state);
  }

  undo() {
    if (!this.canUndo) return;
    const entry = this.entries[--this.position];
    entry.undo();
    this._changed(`Undid ${entry.label}`);
  }

  redo() {
    if (!this.canRedo) return;
    const entry = this.entries[this.position++];
    entry.redo();
    this._changed(`Redid ${entry.label}`);
  }

  get canUndo() {
    return this.position > 0;
  }

  get canRedo() {
    return this.position < this.entries.length;
  }

  clear() {
    this.entries.forEach((entry, i) => this._discard(entry, i < this.position ? "done" : "redone"));
    this.entries = [];
    this.position = 0;
    this.bytes = 0;
    this.app.emit("history");
  }

  _changed(message) {
    this.app.markDirty();
    this.app.emit("history", message);
    this.app.emit("stats");
    this.app.requestRender();
  }
}
