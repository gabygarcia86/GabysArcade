// Saving and loading: JSON project files, plus a browser library in IndexedDB that also holds
// the autosave. Project records keep typed arrays as they are; only JSON files turn them into
// text, compressed when the browser can.
import * as THREE from "three";
import { SculptMesh } from "./geometry.js";
import { PRESETS } from "./materials.js";
import { StudioObject } from "./modeling.js";
import { PaintLayer } from "./painting.js";

const FORMAT = "3d-wonder-studio";
const VERSION = 1;
const DB_NAME = "wonder-studio";
const LAST_OPEN_KEY = "wonderStudio.lastProject";
const AUTOSAVE_DELAY = 4000;

const TYPES = { f32: Float32Array, u32: Uint32Array, i32: Int32Array, u8: Uint8Array };
const typeName = (array) => Object.keys(TYPES).find((key) => array instanceof TYPES[key]);

export class ProjectManager {
  constructor(app) {
    this.app = app;
    this.id = newId();
    this.name = "My Creation";
    this.dirty = false;
    this.unsavedToFile = false;
    this.revision = 0;
    this.timer = null;
    this.saving = false;
    this.dbPromise = null;
  }

  // ---- Storage -------------------------------------------------------------------------

  _db() {
    this.dbPromise ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("meta", { keyPath: "id" });
        request.result.createObjectStore("data", { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.dbPromise;
  }

  async _run(stores, mode, work) {
    const db = await this._db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      let result;
      Promise.resolve(work(tx)).then((value) => { result = value; });
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async listProjects() {
    const db = await this._db();
    return new Promise((resolve, reject) => {
      const request = db.transaction("meta").objectStore("meta").getAll();
      request.onsuccess = () => resolve(request.result.sort((a, b) => b.updated - a.updated));
      request.onerror = () => reject(request.error);
    });
  }

  async _read(id) {
    const db = await this._db();
    return new Promise((resolve, reject) => {
      const request = db.transaction("data").objectStore("data").get(id);
      request.onsuccess = () => resolve(request.result?.project ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async _write(id, name, project, thumb) {
    await this._run(["meta", "data"], "readwrite", (tx) => {
      tx.objectStore("meta").put({ id, name, thumb, updated: Date.now(), objects: project.objects.length });
      tx.objectStore("data").put({ id, project });
    });
  }

  async deleteProject(id) {
    await this._run(["meta", "data"], "readwrite", (tx) => {
      tx.objectStore("meta").delete(id);
      tx.objectStore("data").delete(id);
    });
  }

  async renameProject(id, name) {
    if (id === this.id) {
      this.setName(name);
      return;
    }
    const project = await this._read(id);
    const metas = await this.listProjects();
    const meta = metas.find((m) => m.id === id);
    if (!project || !meta) return;
    project.name = name;
    await this._run(["meta", "data"], "readwrite", (tx) => {
      tx.objectStore("meta").put({ ...meta, name });
      tx.objectStore("data").put({ id, project });
    });
  }

  async duplicateProject(id) {
    if (id === this.id) await this.saveToBrowser();
    const project = await this._read(id);
    const metas = await this.listProjects();
    const meta = metas.find((m) => m.id === id);
    if (!project || !meta) return;
    const name = `${meta.name} copy`;
    await this._write(newId(), name, { ...project, name }, meta.thumb);
  }

  lastProjectId() {
    try {
      return localStorage.getItem(LAST_OPEN_KEY);
    } catch {
      return null;
    }
  }

  _rememberProject() {
    try {
      localStorage.setItem(LAST_OPEN_KEY, this.id);
    } catch {
      // The library still lists this project, so only the "continue" shortcut is lost.
    }
  }

  // ---- Capture and restore -------------------------------------------------------------

  snapshot() {
    const { app } = this;
    return {
      format: FORMAT,
      version: VERSION,
      name: this.name,
      saved: new Date().toISOString(),
      camera: app.rig.getState(),
      objects: app.objects.list.map((o) => ({
        id: o.id,
        name: o.name,
        group: o.group,
        open: o.open,
        visible: o.mesh.visible,
        position: o.mesh.position.toArray(),
        quaternion: o.mesh.quaternion.toArray(),
        scale: o.mesh.scale.toArray(),
        props: { ...o.props },
        surface: o.sculpt.serialize(),
        paint: o.paint ? { size: o.paint.size, data: o.paint.data.slice() } : null,
      })),
    };
  }

  restore(project, { id = newId() } = {}) {
    const { app } = this;
    if (project.format !== FORMAT) throw new Error("This isn't a 3D Wonder Studio project.");
    if (project.version > VERSION) throw new Error("This project was made with a newer version.");
    const objects = project.objects.map((saved) => {
      const sculpt = new SculptMesh(saved.surface);
      sculpt.maxTris = Math.max(app.quality.maxTris, sculpt.tCount * 1.5);
      const props = saved.props;
      if (!PRESETS[props.preset]) props.preset = "clay";
      const paint = saved.paint
        ? new PaintLayer(saved.paint.size, props.color, saved.paint.data)
        : null;
      const object = new StudioObject({
        id: saved.id, name: saved.name, sculpt, props, paint,
        group: saved.group, open: saved.open, visible: saved.visible,
      });
      object.mesh.position.fromArray(saved.position);
      object.mesh.quaternion.fromArray(saved.quaternion);
      object.mesh.scale.fromArray(saved.scale);
      object.mesh.updateMatrixWorld();
      return object;
    });
    app.history.clear();
    app.objects.replaceAll(objects);
    this.id = id;
    this.setName(project.name, { silent: true });
    app.rig.setState(project.camera);
    this._clean();
    this._rememberProject();
  }

  /** Starts fresh, keeping the id new so older work stays in the library. */
  startNew(objects, name) {
    const { app } = this;
    app.history.clear();
    app.objects.replaceAll(objects);
    this.id = newId();
    this.setName(name, { silent: true });
    if (objects.length) {
      const sphere = app.objects.sceneBox().getBoundingSphere(new THREE.Sphere());
      app.rig.frame(sphere.center, sphere.radius, true);
    } else {
      app.rig.reset(true);
    }
    this._clean();
    this._rememberProject();
  }

  setName(name, { silent = false } = {}) {
    this.name = (name || "My Creation").trim().slice(0, 60) || "My Creation";
    this.app.emit("project");
    if (!silent) this.markDirty();
  }

  _clean() {
    this.dirty = false;
    this.unsavedToFile = false;
    this.app.emit("project");
  }

  // ---- Saving --------------------------------------------------------------------------

  markDirty() {
    this.dirty = true;
    this.unsavedToFile = true;
    this.revision++;
    this.app.emit("project");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.autosave(), AUTOSAVE_DELAY);
  }

  async autosave() {
    if (!this.dirty) return;
    if (this.app.sculptor.active || this.app.painter.active) {
      this.timer = setTimeout(() => this.autosave(), AUTOSAVE_DELAY);
      return;
    }
    try {
      await this.saveToBrowser();
    } catch (error) {
      console.warn("Autosave failed", error);
      this.app.emit("autosave-failed");
    }
  }

  async saveToBrowser() {
    if (this.saving) return;
    this.saving = true;
    try {
      const revision = this.revision;
      const project = this.snapshot();
      const thumb = this.app.thumbnail(96);
      await this._write(this.id, this.name, project, thumb);
      // Changes made while the write was running still need saving next time.
      if (revision === this.revision) this.dirty = false;
      this._rememberProject();
      this.app.emit("project");
    } finally {
      this.saving = false;
    }
  }

  async openFromBrowser(id) {
    const project = await this._read(id);
    if (!project) throw new Error("That project couldn't be found.");
    this.restore(project, { id });
  }

  /** Builds the text of a project file. */
  async toFile() {
    const project = this.snapshot();
    const packed = {
      ...project,
      objects: await Promise.all(project.objects.map(async (o) => ({
        ...o,
        surface: {
          positions: await packArray(o.surface.positions),
          uvs: await packArray(o.surface.uvs),
          indices: await packArray(o.surface.indices),
          canon: await packArray(o.surface.canon),
        },
        paint: o.paint ? { size: o.paint.size, data: await packArray(o.paint.data) } : null,
      }))),
    };
    return JSON.stringify(packed);
  }

  async saveToFile() {
    const text = await this.toFile();
    downloadBlob(new Blob([text], { type: "application/json" }), `${safeName(this.name)}.wonder.json`);
    this.unsavedToFile = false;
    await this.saveToBrowser().catch(() => {});
    this.app.emit("project");
  }

  async openFile(file) {
    const project = JSON.parse(await file.text());
    if (project.format !== FORMAT) throw new Error("This isn't a 3D Wonder Studio project.");
    for (const saved of project.objects) {
      const s = saved.surface;
      saved.surface = {
        positions: await unpackArray(s.positions),
        uvs: await unpackArray(s.uvs),
        indices: await unpackArray(s.indices),
        canon: await unpackArray(s.canon),
      };
      if (saved.paint) saved.paint = { size: saved.paint.size, data: await unpackArray(saved.paint.data) };
    }
    this.restore(project);
  }
}

function newId() {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function safeName(name) {
  return name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "my-creation";
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function pipe(bytes, stream) {
  const writer = stream.writable.getWriter();
  writer.write(bytes);
  writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

function toBase64(bytes) {
  let text = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    text += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
  }
  return btoa(text);
}

function fromBase64(text) {
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function packArray(array) {
  const raw = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  const canZip = typeof CompressionStream === "function";
  const bytes = canZip ? await pipe(raw, new CompressionStream("gzip")) : raw;
  return { type: typeName(array), zip: canZip, data: toBase64(bytes) };
}

async function unpackArray(packed) {
  let bytes = fromBase64(packed.data);
  if (packed.zip) bytes = await pipe(bytes, new DecompressionStream("gzip"));
  const Type = TYPES[packed.type];
  return new Type(bytes.buffer, bytes.byteOffset, bytes.byteLength / Type.BYTES_PER_ELEMENT);
}
