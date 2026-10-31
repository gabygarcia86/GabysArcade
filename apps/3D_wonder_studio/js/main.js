// Starts the studio and connects its parts. `app` is the shared object every module talks to.
import * as THREE from "three";
import { CameraRig } from "./camera.js";
import { History } from "./history.js";
import { Interaction, Picker } from "./interaction.js";
import { ObjectManager } from "./modeling.js";
import { SculptEngine } from "./sculpting.js";
import { PaintEngine } from "./painting.js";
import { ProjectManager, downloadBlob, safeName } from "./project-manager.js";
import { StudioScene } from "./scene.js";
import { Symmetry } from "./symmetry.js";
import { FUN_PARTS, TEMPLATES } from "./templates.js";
import { Tutor } from "./tutorials.js";
import { UI } from "./ui.js";

const SETTINGS_KEY = "wonderStudio.settings";
const BRUSH_KEY = "wonderStudio.brush";

const QUALITIES = {
  low: { label: "Low-poly", trisPerArea: 700, startTris: 9000, maxTris: 70000, textureSize: 512, pixelRatio: 1, shadowSize: 1024, minEdge: 0.03 },
  balanced: { label: "Balanced", trisPerArea: 2400, startTris: 30000, maxTris: 220000, textureSize: 1024, pixelRatio: 1.5, shadowSize: 2048, minEdge: 0.012 },
  high: { label: "High quality", trisPerArea: 6000, startTris: 90000, maxTris: 640000, textureSize: 2048, pixelRatio: 2, shadowSize: 2048, minEdge: 0.006 },
};

const SHAPE_COLORS = ["#7ed957", "#ff7a59", "#45b7ff", "#ffc53d", "#c98bff", "#ff5da8", "#5be0d0"];

function loadJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Settings just reset next visit if the browser won't store them.
  }
}

function defaultQuality() {
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  const touch = matchMedia("(pointer: coarse)").matches;
  return small && touch ? "low" : "balanced";
}

class App {
  constructor() {
    this.listeners = new Map();
    this.needsRender = true;
    this.tool = "draw";
    this.qualities = QUALITIES;
    this.settings = {
      theme: "dark", background: "#141634", quality: defaultQuality(), ...loadJson(SETTINGS_KEY),
    };
    if (!QUALITIES[this.settings.quality]) this.settings.quality = "balanced";
    this.quality = QUALITIES[this.settings.quality];
    this.view = { grid: true, wireframe: false };
    this.brush = {
      radius: 0.28, strength: 0.5, falloff: "smooth", frontOnly: true, autoDetail: true, pressure: true, detail: 1,
      ...loadJson(BRUSH_KEY),
    };
    this.paint = { radius: 0.12, color: "#ff5da8", opacity: 1, hardness: 0.6 };
    this.colorIndex = 1;

    const canvas = document.getElementById("viewport");
    this.canvas = canvas;
    this.scene = new StudioScene(canvas, this);
    this.rig = new CameraRig(this, canvas, document.getElementById("gizmo"));
    this.history = new History(this);
    this.symmetry = new Symmetry(this);
    this.objects = new ObjectManager(this);
    this.project = new ProjectManager(this);
    this.pick = new Picker(this, canvas);
    this.sculptor = new SculptEngine(this);
    this.painter = new PaintEngine(this);
    this.interaction = new Interaction(this, canvas);
    this.ui = new UI(this);
    this.tutor = new Tutor(this);

    this.on("camera", () => {
      this.objects.setGizmoCamera(this.rig.camera);
    });
    this.rig.controls.addEventListener("start", () => { this.orbiting = true; });
    this.rig.controls.addEventListener("end", () => {
      if (this.orbiting) this.emit("orbit");
      this.orbiting = false;
    });

    this._applyLook();
    this.scene.setQuality(this.quality);
    this._watchSize();
    this._keys();
    this._watchContext();
    window.addEventListener("beforeunload", (e) => {
      if (this.project.dirty) {
        this.project.autosave();
        e.preventDefault();
      }
    });
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // ---- Events and rendering ------------------------------------------------------------

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(fn);
  }

  emit(event, payload) {
    this.listeners.get(event)?.forEach((fn) => fn(payload));
  }

  requestRender() {
    this.needsRender = true;
  }

  markDirty() {
    this.project?.markDirty();
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    if (this.lost) return;
    this.sculptor.tick(now);
    this.painter.tick();
    this.interaction.tick();
    const moving = this.rig.update(now);
    if (this.needsRender || moving) this._render();
  }

  _render() {
    this.needsRender = false;
    this.scene.renderer.render(this.scene.scene, this.rig.camera);
  }

  // ---- Size, theme, quality ------------------------------------------------------------

  _watchSize() {
    const stage = document.getElementById("stage");
    const fit = () => {
      const { clientWidth: w, clientHeight: h } = stage;
      if (!w || !h) return;
      this.scene.resize(w, h);
      this.rig.resize(w, h);
      this.objects.setOutlineScreen(w, h);
      this.requestRender();
      this.interaction.hoverDirty = true;
    };
    new ResizeObserver(fit).observe(stage);
    fit();
  }

  _applyLook() {
    document.documentElement.dataset.theme = this.settings.theme;
    this.scene.setBackground(this.settings.background, this.settings.theme === "light");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = this.settings.theme === "light" ? "#f3efff" : "#141634";
  }

  setTheme(theme) {
    this.settings.theme = theme;
    this.settings.background = theme === "light" ? "#d9dcf2" : "#141634";
    saveJson(SETTINGS_KEY, this.settings);
    this._applyLook();
  }

  setBackground(hex) {
    this.settings.background = hex;
    saveJson(SETTINGS_KEY, this.settings);
    this._applyLook();
  }

  setQuality(id) {
    this.settings.quality = id;
    this.quality = QUALITIES[id];
    saveJson(SETTINGS_KEY, this.settings);
    for (const o of this.objects.list) o.sculpt.maxTris = Math.max(this.quality.maxTris, o.sculpt.tCount);
    this.scene.setQuality(this.quality);
    window.dispatchEvent(new Event("resize"));
    this.ui.toast(`${this.quality.label} mode is on.`);
  }

  setGrid(on) {
    this.view.grid = on;
    this.scene.setGridVisible(on);
  }

  setWireframe(on) {
    this.view.wireframe = on;
    this.objects.setWireframe(on);
  }

  saveBrush() {
    saveJson(BRUSH_KEY, this.brush);
  }

  // ---- Tools and content ---------------------------------------------------------------

  setTool(tool) {
    if (this.tool === tool) return;
    this.tool = tool;
    this.interaction.stopPlacing();
    this.objects.refreshGizmo();
    this.emit("tool");
    this.requestRender();
  }

  setBrushRadius(value, fromQuick = false) {
    const painting = this.tool === "paint" || this.tool === "erase";
    if (painting) this.paint.radius = value;
    else this.brush.radius = value;
    if (fromQuick) {
      const panel = document.getElementById(painting ? "paint-size" : "brush-size");
      if (panel) panel.value = value;
    } else {
      this.ui._syncQuick();
    }
    this.interaction.hoverDirty = true;
  }

  nextColor() {
    this.colorIndex = (this.colorIndex + 1) % SHAPE_COLORS.length;
    return SHAPE_COLORS[this.colorIndex];
  }

  addShape(shape) {
    this.objects.addShape(shape);
    this.setTool("select");
    this.objects.refreshGizmo();
    this.emit("add-shape");
  }

  buildTemplate(id) {
    return TEMPLATES[id].parts().map((part) => this.objects.build(part));
  }

  loadTemplate(id) {
    const objects = this.buildTemplate(id);
    this.project.startNew(objects, TEMPLATES[id].label === "Ball of Clay" ? "My Clay Creation" : `My ${TEMPLATES[id].label}`);
    this.setTool("draw");
  }

  loadBlank() {
    this.project.startNew([], "My Creation");
    this.setTool("select");
    this.ui.setDock("shapes");
  }

  beginPlacing(id) {
    if (!this.objects.list.length) {
      this.ui.toast("Add a shape first, then stick parts on it.");
      return;
    }
    this.interaction.startPlacing((hit) => { if (hit) this.placePart(id, hit); }, FUN_PARTS[id].label);
  }

  /** Builds a fun part on a surface, plus mirrored twins when symmetry is on. */
  placePart(id, hit) {
    const target = hit.object;
    target.mesh.updateMatrixWorld();
    const size = target.worldBox().getBoundingSphere(new THREE.Sphere()).radius;
    const scale = THREE.MathUtils.clamp(size / 1.1, 0.35, 1.4);
    const made = [];
    const up = new THREE.Vector3(0, 1, 0);
    for (const m of this.symmetry.mirrors()) {
      const { local } = hit;
      const point = new THREE.Vector3(local.x * m[0], local.y * m[1], local.z * m[2]).applyMatrix4(target.mesh.matrixWorld);
      const normal = new THREE.Vector3(local.nx * m[0], local.ny * m[1], local.nz * m[2]).transformDirection(target.mesh.matrixWorld);
      const place = new THREE.Matrix4().compose(point, new THREE.Quaternion().setFromUnitVectors(up, normal), new THREE.Vector3().setScalar(scale));
      const group = FUN_PARTS[id].parts().length > 1 ? this.objects.newGroupId() : null;
      for (const part of FUN_PARTS[id].parts()) {
        const object = this.objects.build(part);
        object.group = group;
        place.clone().multiply(object.mesh.matrixWorld).decompose(object.mesh.position, object.mesh.quaternion, object.mesh.scale);
        object.mesh.updateMatrixWorld();
        made.push(object);
      }
    }
    this.objects.addObjects(made, `Add ${FUN_PARTS[id].label}`, { select: false });
    this.emit("part-placed");
  }

  frameAll() {
    if (!this.objects.list.length) {
      this.rig.reset();
      return;
    }
    const sphere = this.objects.sceneBox().getBoundingSphere(new THREE.Sphere());
    this.rig.frame(sphere.center, sphere.radius);
  }

  frameSelection() {
    const targets = [...this.objects.selected];
    if (!targets.length) {
      this.frameAll();
      return;
    }
    const sphere = this.objects.sceneBox(targets).getBoundingSphere(new THREE.Sphere());
    this.rig.frame(sphere.center, sphere.radius);
  }

  // ---- Pictures ------------------------------------------------------------------------

  /** Draws one frame without brush rings, handles or outlines, then runs `read`. */
  _withCleanView(read) {
    const { objects, interaction, symmetry } = this;
    const cursor = interaction.cursor.group.visible;
    const helper = objects.gizmoHelper.visible;
    const guide = symmetry.group.visible;
    const outlined = [...objects.selected].filter((o) => o.outline.visible);
    interaction.cursor.group.visible = false;
    objects.gizmoHelper.visible = false;
    symmetry.group.visible = false;
    outlined.forEach((o) => { o.outline.visible = false; });
    this._render();
    const result = read(this.canvas);
    interaction.cursor.group.visible = cursor;
    objects.gizmoHelper.visible = helper;
    symmetry.group.visible = guide;
    outlined.forEach((o) => { o.outline.visible = true; });
    this.requestRender();
    return result;
  }

  screenshot() {
    this._withCleanView((canvas) => {
      canvas.toBlob((blob) => {
        if (!blob) return;
        downloadBlob(blob, `${safeName(this.project.name)}.png`);
        this.ui.toast("Picture saved! Look in your downloads.");
      });
    });
  }

  thumbnail(size) {
    return this._withCleanView((canvas) => {
      const small = document.createElement("canvas");
      const ratio = canvas.width / canvas.height;
      small.width = size;
      small.height = Math.round(size / ratio);
      small.getContext("2d").drawImage(canvas, 0, 0, small.width, small.height);
      return small.toDataURL("image/jpeg", 0.8);
    });
  }

  // ---- Keyboard ------------------------------------------------------------------------

  _keys() {
    window.addEventListener("keydown", (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== "range" && e.target.type !== "checkbox";
      const modal = this.ui.dialogs.length > 0;
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (ctrl && key === "s") {
        e.preventDefault();
        if (!modal) this.ui.saveProject();
        return;
      }
      if (typing || modal) return;
      if (ctrl && key === "z") {
        e.preventDefault();
        if (e.shiftKey) this.history.redo();
        else this.history.undo();
      } else if (ctrl && key === "y") {
        e.preventDefault();
        this.history.redo();
      } else if (ctrl && key === "d") {
        e.preventDefault();
        this.objects.duplicate();
      } else if (ctrl && key === "a") {
        e.preventDefault();
        this.objects.setSelection(this.objects.list.filter((o) => o.mesh.visible));
      } else if (key === "delete" || key === "backspace") {
        this.ui.confirmDelete();
      } else if (key === "escape") {
        this.interaction.stopPlacing();
        this.objects.setSelection([]);
      } else if (key === "]" || key === "[") {
        const painting = this.tool === "paint" || this.tool === "erase";
        const current = painting ? this.paint.radius : this.brush.radius;
        this.setBrushRadius(THREE.MathUtils.clamp(current * (key === "]" ? 1.15 : 0.87), 0.01, 1), true);
        this.ui._schedule("props");
      } else if (key === "w" || key === "e" || key === "r") {
        this.setTool("select");
        this.objects.setGizmoMode({ w: "translate", e: "rotate", r: "scale" }[key]);
      } else if (key === "f") {
        this.frameSelection();
      }
    });
  }

  _watchContext() {
    const { canvas } = this;
    const banner = document.getElementById("context-lost");
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.lost = true;
      banner.classList.remove("is-hidden");
      if (this.sculptor.active) this.sculptor.end();
      if (this.painter.active) this.painter.end();
    });
    canvas.addEventListener("webglcontextrestored", () => {
      this.lost = false;
      banner.classList.add("is-hidden");
      for (const o of this.objects.list) {
        if (o.paint) {
          o.paint.ready = false;
          o.paint.upload();
        }
      }
      this.requestRender();
    });
  }
}

function start() {
  let app;
  try {
    app = new App();
  } catch (error) {
    console.error(error);
    document.getElementById("no-webgl").classList.remove("is-hidden");
    return;
  }
  window.wonderStudio = app;
  app.loadTemplate("ball");
  app.ui.showStarter({ first: true });
  document.body.classList.add("is-ready");
}

start();
