// Objects in the scene: creating them, selecting them, moving them, and every action on them
// that the panels expose. All changes go through here so they land in undo history.
import * as THREE from "three";
import { TransformControls } from "three/addons/TransformControls.js";
import { SHAPES, SculptMesh, buildShape } from "./geometry.js";
import { PRESETS, createMaterial, setMaterialPaint } from "./materials.js";
import { PaintLayer } from "./painting.js";

const OUTLINE_VERTEX = /* glsl */ `
  uniform vec2 screen;
  uniform float width;
  void main() {
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vec2 offset = n.xy;
    float len = length(offset);
    if (len > 0.0001) offset /= len;
    clip.xy += offset * width * clip.w * 2.0 / screen;
    gl_Position = clip;
  }
`;

const OUTLINE_FRAGMENT = /* glsl */ `
  uniform vec3 color;
  void main() {
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

const outlineMaterial = new THREE.ShaderMaterial({
  vertexShader: OUTLINE_VERTEX,
  fragmentShader: OUTLINE_FRAGMENT,
  side: THREE.BackSide,
  toneMapped: false,
  uniforms: {
    screen: { value: new THREE.Vector2(1, 1) },
    width: { value: 2.5 },
    color: { value: new THREE.Color("#7dff6b") },
  },
});

const wireMaterial = new THREE.MeshBasicMaterial({
  color: 0x0a0a1e, wireframe: true, transparent: true, opacity: 0.32, depthWrite: false,
});

let nextId = 1;

export class StudioObject {
  constructor({ id, name, sculpt, props, group = null, open = false, paint = null, visible = true }) {
    this.id = id ?? nextId++;
    nextId = Math.max(nextId, this.id + 1);
    this.name = name;
    this.sculpt = sculpt;
    this.props = props;
    this.group = group;
    this.open = open;
    this.paint = paint;
    this.mesh = new THREE.Mesh(sculpt.geometry, createMaterial(props, paint?.texture, open));
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.userData.object = this;
    this.mesh.visible = visible;
    this.outline = new THREE.Mesh(sculpt.geometry, outlineMaterial);
    this.outline.visible = false;
    this.outline.frustumCulled = false;
    this.wire = new THREE.Mesh(sculpt.geometry, wireMaterial);
    this.wire.visible = false;
    this.wire.frustumCulled = false;
    this.wire.renderOrder = 2;
    this.mesh.add(this.outline, this.wire);
  }

  meanScale() {
    const s = this.mesh.scale;
    return (Math.abs(s.x) + Math.abs(s.y) + Math.abs(s.z)) / 3;
  }

  localSize() {
    const b = this.sculpt.bvh.rootBounds();
    const reach = (i) => Math.max(Math.abs(b[i]), Math.abs(b[i + 3])) * 2;
    return new THREE.Vector3(reach(0), reach(1), reach(2));
  }

  worldBox(box = new THREE.Box3()) {
    const b = this.sculpt.bvh.rootBounds();
    box.min.set(b[0], b[1], b[2]);
    box.max.set(b[3], b[4], b[5]);
    this.mesh.updateMatrixWorld();
    return box.applyMatrix4(this.mesh.matrixWorld);
  }

  refreshMaterial() {
    const old = this.mesh.material;
    this.mesh.material = createMaterial(this.props, this.paint?.texture, this.open);
    old.dispose();
  }

  disposeAll() {
    this.sculpt.dispose();
    this.mesh.material.dispose();
    this.paint?.dispose();
  }
}

export class ObjectManager {
  constructor(app) {
    this.app = app;
    this.list = [];
    this.selected = new Set();
    this.focus = null;

    const { rig, scene } = app;
    this.gizmo = new TransformControls(rig.camera, scene.canvas);
    this.gizmo.size = 0.85;
    this.gizmoHelper = this.gizmo.getHelper();
    scene.scene.add(this.gizmoHelper);
    this.pivot = new THREE.Object3D();
    scene.scene.add(this.pivot);
    this.gizmo.addEventListener("dragging-changed", (e) => {
      rig.controls.enabled = !e.value;
      if (e.value) this._beginTransform();
      else this._endTransform("Move");
    });
    this.gizmo.addEventListener("objectChange", () => {
      this._applyTransform();
      app.requestRender();
    });
    this.gizmo.addEventListener("change", () => app.requestRender());
    this.dragBefore = null;
  }

  // ---- Building ------------------------------------------------------------------------

  /** Makes an object from a shape description. Sizes are baked in, so the scale starts at 1. */
  build(spec) {
    const { quality } = this.app;
    const size = toSize(spec.size);
    const stretch = (Math.abs(size[0] * size[1]) + Math.abs(size[1] * size[2]) + Math.abs(size[0] * size[2])) / 3;
    const area = (SHAPES[spec.shape]?.area ?? 12) * stretch * (spec.detail ?? 1);
    const tris = Math.round(THREE.MathUtils.clamp(area * quality.trisPerArea, 600, quality.startTris));
    const data = buildShape(spec.shape, tris, spec.params);
    const p = data.positions;
    let center = [0, 0, 0];
    if (spec.shape === "tube" || spec.shape === "lathe") center = boundsCenter(p);
    for (let i = 0; i < p.length; i += 3) {
      let x = (p[i] - center[0]) * size[0];
      let y = (p[i + 1] - center[1]) * size[1];
      let z = (p[i + 2] - center[2]) * size[2];
      if (spec.deform) [x, y, z] = spec.deform(x, y, z);
      p[i] = x;
      p[i + 1] = y;
      p[i + 2] = z;
    }
    const sculpt = new SculptMesh(data);
    sculpt.maxTris = quality.maxTris;
    const preset = spec.preset ?? "clay";
    const object = new StudioObject({
      name: spec.name ?? SHAPES[spec.shape]?.label ?? "Shape",
      sculpt,
      open: Boolean(SHAPES[spec.shape]?.open),
      props: {
        color: spec.color ?? "#7ed957",
        preset,
        roughness: PRESETS[preset].roughness,
        metalness: PRESETS[preset].metalness,
      },
    });
    const m = object.mesh;
    const at = spec.pos ?? [0, 0, 0];
    m.position.set(at[0] + center[0] * size[0], at[1] + center[1] * size[1], at[2] + center[2] * size[2]);
    if (spec.rot) m.rotation.set(...spec.rot.map(THREE.MathUtils.degToRad));
    m.updateMatrixWorld();
    return object;
  }

  _attach(object, index = this.list.length) {
    this.list.splice(index, 0, object);
    this.app.scene.objectRoot.add(object.mesh);
    object.wire.visible = this.app.view.wireframe;
    object.mesh.updateMatrixWorld();
  }

  _detach(object) {
    const index = this.list.indexOf(object);
    if (index !== -1) this.list.splice(index, 1);
    object.mesh.removeFromParent();
    this.selected.delete(object);
    if (this.focus === object) this.focus = null;
    return index;
  }

  /** Adds objects with an undo step. */
  addObjects(objects, label, { select = true } = {}) {
    const { app } = this;
    const previous = [...this.selected];
    objects.forEach((o) => this._attach(o));
    if (select) this.setSelection(objects);
    let present = true;
    app.history.push({
      label,
      bytes: objects.reduce((sum, o) => sum + o.sculpt.vCount * 40, 0),
      undo: () => {
        present = false;
        objects.forEach((o) => this._detach(o));
        this.setSelection(previous.filter((o) => this.list.includes(o)));
        this._changed();
      },
      redo: () => {
        present = true;
        objects.forEach((o) => this._attach(o));
        this.setSelection(objects);
        this._changed();
      },
      drop: (state) => {
        if (state === "redone" && !present) objects.forEach((o) => o.disposeAll());
      },
    });
    this._changed();
  }

  /** Replaces the scene with no undo. Used by New, Open and templates. */
  replaceAll(objects) {
    this.setSelection([]);
    for (const object of this.list.slice()) {
      this._detach(object);
      object.disposeAll();
    }
    objects.forEach((o) => this._attach(o));
    this._changed();
  }

  addShape(shape) {
    const crowded = this.list.length > 0;
    const size = crowded ? 0.6 : 1;
    const object = this.build({ shape, size, color: this.app.nextColor(), pos: this._freeSpot(size) });
    this.addObjects([object], `Add ${object.name}`);
    return object;
  }

  _freeSpot(size) {
    if (!this.list.length) return [0, 0, 0];
    const box = this.sceneBox();
    return [box.max.x + size * 1.15, (box.min.y + box.max.y) / 2, 0];
  }

  // ---- Selection -----------------------------------------------------------------------

  /** Picking one member of a group brings along the rest of its group. */
  withGroup(object) {
    if (!object.group) return [object];
    return this.list.filter((o) => o.group === object.group);
  }

  setSelection(objects) {
    for (const o of this.selected) o.outline.visible = false;
    this.selected = new Set(objects);
    this.focus = objects[objects.length - 1] ?? null;
    this.refreshGizmo();
    this.app.symmetry.refresh();
    this.app.emit("selection");
    this.app.requestRender();
  }

  selectClick(object, additive) {
    if (!object) {
      if (!additive) this.setSelection([]);
      return;
    }
    const members = this.withGroup(object);
    if (additive) {
      const next = new Set(this.selected);
      const removing = next.has(object);
      members.forEach((o) => (removing ? next.delete(o) : next.add(o)));
      this.setSelection([...next]);
    } else {
      this.setSelection(members);
    }
  }

  /** Makes an object the panels' subject while sculpting, without moving handles onto it. */
  focusOn(object) {
    if (this.focus === object && this.selected.has(object)) return;
    this.setSelection(this.withGroup(object).filter((o) => o !== object).concat(object));
  }

  _attachGizmo() {
    const { gizmo } = this;
    const useGizmo = this.app.tool === "select" && this.selected.size > 0;
    gizmo.detach();
    if (!useGizmo) return;
    if (this.selected.size === 1) {
      gizmo.attach(this.focus.mesh);
    } else {
      const box = new THREE.Box3();
      for (const o of this.selected) box.union(o.worldBox());
      box.getCenter(this.pivot.position);
      this.pivot.quaternion.identity();
      this.pivot.scale.setScalar(1);
      this.pivot.updateMatrixWorld();
      gizmo.attach(this.pivot);
    }
  }

  setGizmoCamera(camera) {
    this.gizmo.camera = camera;
  }

  setGizmoMode(mode) {
    this.gizmo.setMode(mode);
    this.app.emit("gizmo");
    this.app.requestRender();
  }

  /** Outlines and handles only show with the Move tool, where they can't hide the sculpt. */
  refreshGizmo() {
    const show = this.app.tool === "select";
    for (const o of this.selected) o.outline.visible = show;
    this._attachGizmo();
    this.app.requestRender();
  }

  _beginTransform() {
    this.dragBefore = [...this.selected].map((o) => ({ o, ...readTransform(o) }));
    this.pivot.updateMatrixWorld();
    this.pivotStart = this.pivot.matrixWorld.clone().invert();
    this.dragStart = [...this.selected].map((o) => ({ o, matrix: o.mesh.matrixWorld.clone() }));
  }

  _applyTransform() {
    if (this.gizmo.object === this.pivot && this.dragStart) {
      this.pivot.updateMatrixWorld();
      const delta = this.pivot.matrixWorld.clone().multiply(this.pivotStart);
      for (const { o, matrix } of this.dragStart) {
        delta.clone().multiply(matrix).decompose(o.mesh.position, o.mesh.quaternion, o.mesh.scale);
        o.mesh.updateMatrixWorld();
      }
    }
    this.app.symmetry.refresh();
    this.app.emit("transform");
  }

  _endTransform(label) {
    const before = this.dragBefore;
    this.dragBefore = null;
    if (!before) return;
    if (this.gizmo.object === this.pivot) this._attachGizmo();
    this.recordTransforms(before, label);
  }

  /** Stores an undo step from a list of { o, position, quaternion, scale } start states. */
  recordTransforms(before, label) {
    const after = before.map(({ o }) => ({ o, ...readTransform(o) }));
    const moved = before.some((b, i) =>
      !b.position.equals(after[i].position) ||
      !b.quaternion.equals(after[i].quaternion) ||
      !b.scale.equals(after[i].scale));
    if (!moved) return;
    const apply = (states) => {
      states.forEach(writeTransform);
      this.refreshGizmo();
      this.afterMove();
    };
    this.app.history.push({ label, undo: () => apply(before), redo: () => apply(after) });
    this.afterMove();
  }

  /** Call after objects move: keeps the floor under them and the panels in step. */
  afterMove() {
    this.fitFloor();
    this.app.symmetry.refresh();
    this.app.emit("transform");
    this.app.requestRender();
  }

  moveBy(worldDelta) {
    for (const o of this.selected) {
      o.mesh.position.add(worldDelta);
      o.mesh.updateMatrixWorld();
    }
    if (this.gizmo.object === this.pivot) this.pivot.position.add(worldDelta);
    this.app.symmetry.refresh();
    this.app.emit("transform");
  }

  snapshotSelection() {
    return [...this.selected].map((o) => ({ o, ...readTransform(o) }));
  }

  // ---- Actions -------------------------------------------------------------------------

  rename(object, name) {
    const before = object.name;
    if (!name || name === before) return;
    const apply = (value) => {
      object.name = value;
      this.app.emit("objects");
      this.app.emit("selection");
    };
    apply(name);
    this.app.history.push({ label: "Rename", undo: () => apply(before), redo: () => apply(name) });
  }

  duplicate() {
    const sources = [...this.selected];
    if (!sources.length) return;
    const groups = new Map();
    const copies = sources.map((source) => {
      const copy = new StudioObject({
        name: `${source.name} copy`,
        sculpt: source.sculpt.clone(),
        props: { ...source.props },
        open: source.open,
      });
      if (source.paint) {
        copy.paint = new PaintLayer(source.paint.size, source.props.color, source.paint.data.slice());
        setMaterialPaint(copy.mesh.material, copy.paint.texture);
      }
      copy.mesh.position.copy(source.mesh.position);
      copy.mesh.quaternion.copy(source.mesh.quaternion);
      copy.mesh.scale.copy(source.mesh.scale);
      if (source.group) {
        if (!groups.has(source.group)) groups.set(source.group, this.newGroupId());
        copy.group = groups.get(source.group);
      }
      return copy;
    });
    const box = new THREE.Box3();
    sources.forEach((o) => box.union(o.worldBox()));
    const shift = box.getSize(new THREE.Vector3()).x * 0.6 + 0.25;
    copies.forEach((c) => {
      c.mesh.position.x += shift;
      c.mesh.updateMatrixWorld();
    });
    this.addObjects(copies, "Duplicate");
  }

  deleteSelected() {
    const removed = [...this.selected].map((o) => ({ o, index: this.list.indexOf(o) }))
      .sort((a, b) => a.index - b.index);
    if (!removed.length) return;
    this.removeWithUndo(removed, "Delete");
  }

  removeWithUndo(removed, label, extra = {}) {
    const { app } = this;
    removed.forEach(({ o }) => this._detach(o));
    this.setSelection(extra.select ?? []);
    let gone = true;
    app.history.push({
      label,
      bytes: 512,
      undo: () => {
        gone = false;
        extra.beforeUndo?.();
        removed.forEach(({ o, index }) => this._attach(o, index));
        this.setSelection(removed.map((r) => r.o));
        this._changed();
      },
      redo: () => {
        gone = true;
        removed.forEach(({ o }) => this._detach(o));
        extra.afterRedo?.();
        this.setSelection(extra.select ?? []);
        this._changed();
      },
      drop: (state) => {
        if (state === "done" && gone) removed.forEach(({ o }) => o.disposeAll());
      },
    });
    this._changed();
  }

  newGroupId() {
    return `group-${Date.now().toString(36)}-${nextId++}`;
  }

  group() {
    const members = [...this.selected];
    if (members.length < 2) return;
    this._setGroups(members, this.newGroupId(), "Group");
  }

  ungroup() {
    const members = [...this.selected].filter((o) => o.group);
    if (members.length) this._setGroups(members, null, "Ungroup");
  }

  _setGroups(members, value, label) {
    const before = members.map((o) => o.group);
    const apply = (read) => {
      members.forEach((o, i) => { o.group = read(i); });
      this.app.emit("selection");
      this.app.emit("objects");
    };
    apply(() => value);
    this.app.history.push({
      label,
      undo: () => apply((i) => before[i]),
      redo: () => apply(() => value),
    });
  }

  /**
   * Joins the selection into one object. Each source keeps its look by being packed into its
   * own cell of a shared texture, which is filled with the source's color and paint.
   */
  combine() {
    const sources = [...this.selected];
    if (sources.length < 2) return;
    const { app } = this;
    const cells = Math.ceil(Math.sqrt(sources.length));
    const center = new THREE.Box3();
    sources.forEach((o) => center.union(o.worldBox()));
    const origin = center.getCenter(new THREE.Vector3());

    const totals = sources.reduce((sum, o) => ({ v: sum.v + o.sculpt.vCount, t: sum.t + o.sculpt.tCount }), { v: 0, t: 0 });
    const positions = new Float32Array(totals.v * 3);
    const uvs = new Float32Array(totals.v * 2);
    const indices = new Uint32Array(totals.t * 3);
    const canon = new Int32Array(totals.v);
    const size = Math.min(2048, app.quality.textureSize * Math.max(1, cells));
    const layerData = new Uint8Array(size * size * 4);
    const cellPixels = Math.floor(size / cells);

    let vBase = 0;
    let tBase = 0;
    const p = new THREE.Vector3();
    sources.forEach((o, n) => {
      const s = o.sculpt;
      const cu = (n % cells) / cells;
      const cv = Math.floor(n / cells) / cells;
      o.mesh.updateMatrixWorld();
      for (let v = 0; v < s.vCount; v++) {
        p.set(s.pos[v * 3], s.pos[v * 3 + 1], s.pos[v * 3 + 2]).applyMatrix4(o.mesh.matrixWorld).sub(origin);
        const out = (vBase + v) * 3;
        positions[out] = p.x;
        positions[out + 1] = p.y;
        positions[out + 2] = p.z;
        uvs[(vBase + v) * 2] = cu + s.uv[v * 2] / cells;
        uvs[(vBase + v) * 2 + 1] = cv + s.uv[v * 2 + 1] / cells;
        canon[vBase + v] = s.canon[v] + vBase;
      }
      for (let i = 0; i < s.tCount * 3; i++) indices[tBase * 3 + i] = s.idx[i] + vBase;
      vBase += s.vCount;
      tBase += s.tCount;
      stampCell(layerData, size, cu, cv, cellPixels, o);
    });

    const sculpt = new SculptMesh({ positions, uvs, indices, canon });
    sculpt.maxTris = Math.max(app.quality.maxTris, sculpt.tCount * 1.5);
    const first = this.focus ?? sources[0];
    const combined = new StudioObject({
      name: "Combined shape",
      sculpt,
      props: { ...first.props, color: "#ffffff" },
      paint: new PaintLayer(size, "#ffffff", layerData),
    });
    combined.mesh.position.copy(origin);
    combined.mesh.updateMatrixWorld();

    const removed = sources.map((o) => ({ o, index: this.list.indexOf(o) })).sort((a, b) => a.index - b.index);
    this._attach(combined);
    this.removeWithUndo(removed, "Combine", {
      select: [combined],
      beforeUndo: () => this._detach(combined),
      afterRedo: () => this._attach(combined),
    });
  }

  /** Runs a whole-surface edit on an object and makes it undoable. */
  editSurface(object, label, edit) {
    const mesh = object.sculpt;
    mesh.beginEdit();
    edit(mesh);
    const delta = mesh.endEdit();
    if (!delta) return;
    this.app.history.push({
      label,
      bytes: delta.bytes,
      undo: () => { mesh.applyDelta(delta, false); this.surfaceChanged(object); },
      redo: () => { mesh.applyDelta(delta, true); this.surfaceChanged(object); },
    });
    this.surfaceChanged(object);
  }

  /** Doubles the detail of the focused object, unless that would be too heavy to sculpt. */
  subdivideFocus() {
    const object = this.focus;
    if (!object) return false;
    if (object.sculpt.tCount * 4 > this.app.quality.maxTris) return false;
    this.editSurface(object, "Add Detail", (mesh) => mesh.subdivide());
    return true;
  }

  smoothFocus() {
    if (this.focus) this.editSurface(this.focus, "Smooth All", (mesh) => mesh.smoothAll(0.5, 2));
  }

  surfaceChanged(object) {
    this.app.markDirty();
    if (object === this.focus) this.app.symmetry.refresh();
    this.fitFloor();
    this.app.emit("stats");
    this.app.requestRender();
  }

  setProps(objects, changes, label) {
    const before = objects.map((o) => ({ ...o.props }));
    const after = before.map((props) => ({ ...props, ...changes }));
    const apply = (states) => {
      objects.forEach((o, i) => {
        const rebuild = o.props.preset !== states[i].preset;
        const recolor = o.props.color !== states[i].color;
        o.props = { ...states[i] };
        if (rebuild) {
          o.refreshMaterial();
        } else {
          this.applyProps(o);
        }
        if (recolor) o.paint?.fillBase(o.props.color);
      });
      this.app.emit("selection");
      this.app.requestRender();
    };
    apply(after);
    this.app.history.push({ label, undo: () => apply(before), redo: () => apply(after) });
  }

  /** Live slider preview, with no undo step. setProps records the change on release. */
  applyProps(object, values = object.props) {
    const m = object.mesh.material;
    m.color.set(values.color);
    if (m.isMeshPhysicalMaterial) {
      m.roughness = values.roughness;
      m.metalness = values.metalness;
    }
    this.app.requestRender();
  }

  setVisible(object, visible) {
    object.mesh.visible = visible;
    if (!visible) this.setSelection([...this.selected].filter((o) => o !== object));
    this.app.emit("objects");
    this.app.requestRender();
    this.app.markDirty();
  }

  setWireframe(on) {
    this.list.forEach((o) => { o.wire.visible = on; });
    this.app.requestRender();
  }

  setOutlineScreen(width, height) {
    outlineMaterial.uniforms.screen.value.set(width, height);
  }

  // ---- Scene measures ------------------------------------------------------------------

  sceneBox(objects = this.list) {
    const box = new THREE.Box3();
    const piece = new THREE.Box3();
    for (const o of objects) if (o.mesh.visible) box.union(o.worldBox(piece));
    return box;
  }

  fitFloor() {
    const visible = this.list.filter((o) => o.mesh.visible);
    if (!visible.length) return;
    const box = this.sceneBox(visible);
    this.app.scene.setGroundY(box.min.y - 0.03);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    this.app.scene.fitShadow(sphere.radius + sphere.center.length());
  }

  stats() {
    let vertices = 0;
    let triangles = 0;
    for (const o of this.list) {
      vertices += o.sculpt.vCount;
      triangles += o.sculpt.tCount;
    }
    return { objects: this.list.length, vertices, triangles };
  }

  _changed() {
    this.fitFloor();
    this.app.symmetry.refresh();
    this.app.emit("objects");
    this.app.emit("stats");
    this.app.requestRender();
  }
}

function toSize(size) {
  if (size === undefined) return [1, 1, 1];
  return typeof size === "number" ? [size, size, size] : size;
}

function boundsCenter(p) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      if (p[i + k] < min[k]) min[k] = p[i + k];
      if (p[i + k] > max[k]) max[k] = p[i + k];
    }
  }
  return [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
}

function readTransform(o) {
  return {
    position: o.mesh.position.clone(),
    quaternion: o.mesh.quaternion.clone(),
    scale: o.mesh.scale.clone(),
  };
}

function writeTransform({ o, position, quaternion, scale }) {
  o.mesh.position.copy(position);
  o.mesh.quaternion.copy(quaternion);
  o.mesh.scale.copy(scale);
  o.mesh.updateMatrixWorld();
}

/** Writes a source object's color and paint into one cell of a combined texture. */
function stampCell(target, size, cu, cv, cellPixels, object) {
  const value = parseInt(object.props.color.slice(1), 16);
  const r = value >> 16 & 255, g = value >> 8 & 255, b = value & 255;
  const x0 = Math.round(cu * size);
  const y0 = Math.round(cv * size);
  const paint = object.paint;
  for (let y = 0; y < cellPixels; y++) {
    for (let x = 0; x < cellPixels; x++) {
      const o = ((y0 + y) * size + x0 + x) * 4;
      let pr = r, pg = g, pb = b;
      if (paint) {
        const sx = Math.floor(x / cellPixels * paint.size);
        const sy = Math.floor(y / cellPixels * paint.size);
        const s = (sy * paint.size + sx) * 4;
        const a = paint.data[s + 3] / 255;
        pr = r + (paint.data[s] - r) * a;
        pg = g + (paint.data[s + 1] - g) * a;
        pb = b + (paint.data[s + 2] - b) * a;
      }
      target[o] = pr;
      target[o + 1] = pg;
      target[o + 2] = pb;
      target[o + 3] = 255;
    }
  }
}
