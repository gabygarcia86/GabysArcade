// Turns pointer movement into brush dabs on one object, from press to release.
import * as THREE from "three";
import { BRUSHES, FALLOFFS, applyGrab, captureGrab } from "./brushes.js";

const SPLITS_PER_DAB = 260;
const MAX_DABS_PER_FRAME = 8;
const HOLD_INTERVAL = 55;

const inverse = new THREE.Matrix4();
const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const plane = new THREE.Plane();
const ray = new THREE.Ray();

export class SculptEngine {
  constructor(app) {
    this.app = app;
    this.stroke = null;
  }

  get active() {
    return Boolean(this.stroke);
  }

  /** Starts a stroke from a pick result. `options` carries pressure and modifier keys. */
  begin(tool, hit, screen, options) {
    const { app } = this;
    const object = hit.object;
    const mesh = object.sculpt;
    const brush = BRUSHES[options.smoothKey ? "smooth" : tool];
    const params = app.brush;
    mesh.beginEdit();
    inverse.copy(object.mesh.matrixWorld).invert();
    const scale = object.meanScale();
    this.stroke = {
      tool, brush, object, mesh,
      inverse: inverse.clone(),
      scale,
      table: FALLOFFS[params.falloff].table,
      invert: options.invert,
      last: { x: screen.x, y: screen.y, hit: { ...hit.local } },
      direction: new THREE.Vector3(),
      queue: [],
      pressure: options.pressure,
      lastDab: 0,
      held: null,
      plane: null,
      touched: false,
      edited: [],
    };
    if (brush.drags) this._beginGrab(hit);
    else this._queueDab(hit.local, screen);
  }

  _beginGrab(hit) {
    const { stroke: s, app } = this;
    const { x, y, z, nx, ny, nz } = hit.local;
    const r = app.brush.radius / s.scale;
    const camera = app.rig.camera;
    camera.getWorldDirection(v1);
    plane.setFromNormalAndCoplanarPoint(v1, hit.point);
    s.plane = plane.clone();
    s.grabStart = hit.point.clone();
    const front = { nx, ny, nz, frontOnly: app.brush.frontOnly };
    s.held = app.symmetry.mirrors().map((m) => ({
      flip: m,
      set: captureGrab(s.mesh, x * m[0], y * m[1], z * m[2], r, s.table, {
        ...front, nx: nx * m[0], ny: ny * m[1], nz: nz * m[2],
      }),
    }));
  }

  /** Adds pointer samples. Press-time pressure comes through on each sample. */
  move(screen, pressure) {
    const s = this.stroke;
    if (!s) return;
    s.pressure = pressure;
    s.target = screen;
  }

  /** Runs once a frame while a stroke is active. */
  tick(now) {
    const s = this.stroke;
    if (!s) return;
    if (s.held) this._tickGrab();
    else this._tickDabs(now);
    s.mesh.flush();
    this.app.requestRender();
    this.app.emit("stats");
  }

  _tickGrab() {
    const s = this.stroke;
    if (!s.target) return;
    const raycaster = this.app.pick.rayFrom(s.target);
    const point = raycaster.ray.intersectPlane(s.plane, v1);
    if (!point) return;
    v2.copy(point).applyMatrix4(s.inverse);
    const startLocal = s.grabStart.clone().applyMatrix4(s.inverse);
    const dx = v2.x - startLocal.x, dy = v2.y - startLocal.y, dz = v2.z - startLocal.z;
    s.mesh.accBegin();
    for (const { flip, set } of s.held) applyGrab(s.mesh, set, dx * flip[0], dy * flip[1], dz * flip[2]);
    s.mesh.accApply();
    s.touched = true;
    s.target = null;
  }

  _tickDabs(now) {
    const s = this.stroke;
    const { pick } = this.app;
    const target = s.target;
    let dabs = 0;
    if (target) {
      const dx = target.x - s.last.x;
      const dy = target.y - s.last.y;
      const distance = Math.hypot(dx, dy);
      const step = Math.max(2, this._radiusInPixels() * (s.brush.square ? 0.32 : 0.22));
      const count = Math.min(MAX_DABS_PER_FRAME, Math.ceil(distance / step));
      for (let i = 1; i <= count; i++) {
        const t = i / count;
        const sample = { x: s.last.x + dx * t, y: s.last.y + dy * t };
        const hit = pick.onObject(s.object, sample);
        if (!hit) continue;
        const local = hit.local;
        const prev = s.last.hit;
        const tx = local.x - prev.x, ty = local.y - prev.y, tz = local.z - prev.z;
        if (tx * tx + ty * ty + tz * tz > 1e-10) {
          s.direction.set(tx, ty, tz).normalize();
          s.last.hit = { ...local };
        }
        this._dab(local);
        dabs++;
      }
      s.last.x = target.x;
      s.last.y = target.y;
      s.target = null;
    }
    while (s.queue.length) {
      this._dab(s.queue.shift());
      dabs++;
    }
    // Holding still keeps building up, the way pressing on real clay does.
    if (!dabs && now - s.lastDab > HOLD_INTERVAL && s.tool !== "strips" && s.tool !== "crease") {
      const hit = pick.onObject(s.object, s.last);
      if (hit) this._dab(hit.local);
    }
    if (dabs || now - s.lastDab > HOLD_INTERVAL) s.lastDab = now;
  }

  _queueDab(local) {
    this.stroke.queue.push({ ...local });
  }

  _radiusInPixels() {
    const { stroke: s, app } = this;
    return app.pick.worldToPixels(app.brush.radius, s.last.hit, s.object);
  }

  _dab(local) {
    const { stroke: s, app } = this;
    const { mesh, brush, table } = s;
    const params = app.brush;
    const r = params.radius / s.scale;
    const mirrors = app.symmetry.mirrors();
    const direction = s.direction.lengthSq() > 0 ? s.direction : this._cameraSide(s);
    const strength = params.strength * (params.pressure ? s.pressure : 1);
    mesh.accBegin();
    for (const m of mirrors) {
      const dab = {
        x: local.x * m[0], y: local.y * m[1], z: local.z * m[2],
        nx: local.nx * m[0], ny: local.ny * m[1], nz: local.nz * m[2],
        tx: direction.x * m[0], ty: direction.y * m[1], tz: direction.z * m[2],
        r, s: strength,
        invert: s.invert,
        frontOnly: params.frontOnly,
      };
      const count = mesh.queryVerts(dab.x, dab.y, dab.z, r * (brush.square ? 1.05 : 1));
      if (count) brush.apply(mesh, count, table, dab);
    }
    mesh.accApply();
    s.touched = true;

    if (params.autoDetail && brush.detail) {
      const edge = this._edgeLength(r);
      for (const m of mirrors) {
        mesh.splitEdgesIn(local.x * m[0], local.y * m[1], local.z * m[2], r * 0.9, edge, SPLITS_PER_DAB);
      }
    }
  }

  /** Smaller brushes ask for finer triangles, down to a floor set by the detail level. */
  _edgeLength(r) {
    const { app, stroke: s } = this;
    return Math.max(app.quality.minEdge / s.scale, r * 0.22 / app.brush.detail);
  }

  _cameraSide(s) {
    v1.setFromMatrixColumn(this.app.rig.camera.matrixWorld, 0);
    v2.copy(v1).transformDirection(s.inverse);
    return v2;
  }

  /** Finishes the stroke and records it for undo. */
  end() {
    const s = this.stroke;
    if (!s) return;
    if (s.held && s.touched && this.app.brush.autoDetail) this._repairGrab();
    s.mesh.flush();
    this.stroke = null;
    this._record(s);
  }

  /** Grab stretches triangles, so the area is refined once the drag ends. */
  _repairGrab() {
    const { stroke: s } = this;
    const edge = this._edgeLength(this.app.brush.radius / s.scale) * 1.4;
    const sets = s.held.map((h) => h.set);
    for (const set of sets) {
      const { pos } = s.mesh;
      const seen = Math.max(1, Math.floor(set.list.length / 24));
      for (let i = 0; i < set.list.length; i += seen) {
        if (set.weight[i] < 0.02) continue;
        const v = set.list[i];
        s.mesh.splitEdgesIn(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], this.app.brush.radius / s.scale * 0.5, edge, 200);
      }
    }
  }

  /** Abandons the stroke, used when a second finger shows the press was really a gesture. */
  cancel() {
    const s = this.stroke;
    if (!s) return;
    s.mesh.flush();
    this.stroke = null;
    const delta = s.mesh.endEdit();
    if (delta) s.mesh.applyDelta(delta, false);
    this.app.requestRender();
  }

  _record(s) {
    const { app } = this;
    const delta = s.mesh.endEdit();
    if (!delta) return;
    const { mesh, brush } = s;
    app.history.push({
      label: brush.label,
      bytes: delta.bytes,
      undo: () => { mesh.applyDelta(delta, false); app.objects.surfaceChanged(s.object); },
      redo: () => { mesh.applyDelta(delta, true); app.objects.surfaceChanged(s.object); },
    });
    app.objects.surfaceChanged(s.object);
  }
}
