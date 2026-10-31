// Perspective and orthographic cameras, orbit controls, snap views and the orientation gizmo.
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";

const VIEWS = {
  front: [0, 0, 1], back: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0],
  top: [0, 1, 0.0001], bottom: [0, -1, 0.0001],
};
const HOME_DIRECTION = new THREE.Vector3(0.5, 0.36, 1).normalize();
const HOME_DISTANCE = 6.4;
const FOV = 38;

const GIZMO_AXES = [
  { key: "right", label: "X", dir: [1, 0, 0], color: "#ff5d8f" },
  { key: "top", label: "Y", dir: [0, 1, 0], color: "#7dff6b" },
  { key: "front", label: "Z", dir: [0, 0, 1], color: "#45b7ff" },
  { key: "left", dir: [-1, 0, 0], color: "#ff5d8f" },
  { key: "bottom", dir: [0, -1, 0], color: "#7dff6b" },
  { key: "back", dir: [0, 0, -1], color: "#45b7ff" },
];

export class CameraRig {
  constructor(app, canvas, gizmoCanvas) {
    this.app = app;
    this.canvas = canvas;
    this.persp = new THREE.PerspectiveCamera(FOV, 1, 0.02, 400);
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 400);
    this.camera = this.persp;
    this.aspect = 1;

    this.controls = new OrbitControls(this.persp, canvas);
    const c = this.controls;
    c.enableDamping = true;
    c.dampingFactor = 0.14;
    c.minDistance = 0.4;
    c.maxDistance = 60;
    c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
    c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    c.addEventListener("change", () => app.requestRender());

    this.tween = null;
    this.reset(true);
    this.gizmo = new Gizmo(this, gizmoCanvas);
  }

  get isOrtho() {
    return this.camera === this.ortho;
  }

  resize(width, height) {
    this.aspect = width / Math.max(1, height);
    this.persp.aspect = this.aspect;
    this.persp.updateProjectionMatrix();
    this._fitOrtho();
  }

  /** Matches the orthographic frame to what the perspective camera sees at the target. */
  _fitOrtho() {
    const distance = this.camera.position.distanceTo(this.controls.target);
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * distance;
    if (!this.isOrtho) this.orthoHalf = halfHeight;
    const half = this.orthoHalf ?? halfHeight;
    this.ortho.top = half;
    this.ortho.bottom = -half;
    this.ortho.left = -half * this.aspect;
    this.ortho.right = half * this.aspect;
    this.ortho.updateProjectionMatrix();
  }

  setOrthographic(on) {
    if (on === this.isOrtho) return;
    const from = this.camera;
    this._fitOrtho();
    const to = on ? this.ortho : this.persp;
    if (on) {
      to.zoom = 1;
    } else {
      // Keep the apparent size by moving the perspective camera to the matching distance.
      const halfHeight = this.orthoHalf / this.ortho.zoom;
      const distance = halfHeight / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      from.position.sub(this.controls.target).setLength(distance).add(this.controls.target);
    }
    to.position.copy(from.position);
    to.quaternion.copy(from.quaternion);
    to.updateProjectionMatrix();
    this.camera = to;
    this.controls.object = to;
    this.controls.update();
    this.app.emit("camera");
    this.app.requestRender();
  }

  setView(name) {
    const target = this.controls.target;
    const distance = this.camera.position.distanceTo(target);
    const position = new THREE.Vector3(...VIEWS[name]).setLength(distance).add(target);
    this.flyTo(position, target);
  }

  reset(instant = false) {
    const target = new THREE.Vector3();
    const position = HOME_DIRECTION.clone().multiplyScalar(HOME_DISTANCE);
    if (instant) {
      this.camera.position.copy(position);
      this.controls.target.copy(target);
      this.controls.update();
    } else {
      this.flyTo(position, target, 1);
    }
  }

  /** Frames a center and radius, keeping the current viewing angle. */
  frame(center, radius, instant = false) {
    const distance = Math.max(2.5, radius / Math.sin(THREE.MathUtils.degToRad(FOV / 2)) * 1.25);
    const position = HOME_DIRECTION.clone().multiplyScalar(distance).add(center);
    if (instant) {
      this.camera.position.copy(position);
      this.controls.target.copy(center);
      this.camera.zoom = 1;
      this.camera.updateProjectionMatrix();
      this.controls.update();
      this._fitOrtho();
      this.app.requestRender();
    } else {
      this.flyTo(position, center, 1);
    }
  }

  flyTo(position, target, zoom = this.camera.zoom) {
    this.tween = {
      start: performance.now(),
      fromPosition: this.camera.position.clone(),
      toPosition: position.clone(),
      fromTarget: this.controls.target.clone(),
      toTarget: target.clone(),
      fromZoom: this.camera.zoom,
      toZoom: zoom,
    };
    this.app.requestRender();
  }

  /** Advances any camera flight. Returns true while the camera is moving. */
  update(now) {
    const t = this.tween;
    if (t) {
      const k = Math.min(1, (now - t.start) / 420);
      const ease = k * k * (3 - 2 * k);
      const offsetFrom = t.fromPosition.clone().sub(t.fromTarget);
      const offsetTo = t.toPosition.clone().sub(t.toTarget);
      // Swinging around the target looks better than a straight line through the model.
      const target = t.fromTarget.clone().lerp(t.toTarget, ease);
      const length = THREE.MathUtils.lerp(offsetFrom.length(), offsetTo.length(), ease);
      const direction = slerpVectors(offsetFrom.normalize(), offsetTo.normalize(), ease);
      this.camera.position.copy(target).addScaledVector(direction, length);
      this.controls.target.copy(target);
      this.camera.zoom = THREE.MathUtils.lerp(t.fromZoom, t.toZoom, ease);
      this.camera.updateProjectionMatrix();
      if (k >= 1) this.tween = null;
    }
    this.controls.update();
    this.gizmo.draw();
    return Boolean(t);
  }

  getState() {
    return {
      ortho: this.isOrtho,
      position: this.camera.position.toArray(),
      target: this.controls.target.toArray(),
      zoom: this.camera.zoom,
    };
  }

  setState(state) {
    if (!state) return;
    this.setOrthographic(Boolean(state.ortho));
    this.camera.position.fromArray(state.position);
    this.controls.target.fromArray(state.target);
    this.camera.zoom = state.zoom ?? 1;
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this._fitOrtho();
    this.app.requestRender();
  }
}

function slerpVectors(a, b, t) {
  const dot = THREE.MathUtils.clamp(a.dot(b), -1, 1);
  const angle = Math.acos(dot);
  if (angle < 1e-4) return a.clone();
  if (Math.PI - angle < 1e-3) {
    // Opposite directions have no unique arc, so swing up and over.
    const side = new THREE.Vector3(0, 1, 0).cross(a);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    const axis = side.normalize();
    return a.clone().applyAxisAngle(axis, angle * t);
  }
  const s = Math.sin(angle);
  return a.clone().multiplyScalar(Math.sin((1 - t) * angle) / s)
    .addScaledVector(b, Math.sin(t * angle) / s);
}

class Gizmo {
  constructor(rig, canvas) {
    this.rig = rig;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.size = 92;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = canvas.height = this.size * ratio;
    this.ratio = ratio;
    this.hover = null;
    this.spots = [];
    this.lastKey = "";
    canvas.addEventListener("pointermove", (e) => {
      this.hover = this._at(e);
      canvas.style.cursor = this.hover ? "pointer" : "default";
      this.lastKey = "";
    });
    canvas.addEventListener("pointerleave", () => {
      this.hover = null;
      this.lastKey = "";
    });
    canvas.addEventListener("click", (e) => {
      const spot = this._at(e);
      if (spot) rig.setView(spot.key);
    });
  }

  _at(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * this.size / rect.width;
    const y = (e.clientY - rect.top) * this.size / rect.height;
    let best = null;
    let bestDistance = 13;
    for (const spot of this.spots) {
      const d = Math.hypot(spot.x - x, spot.y - y);
      if (d < bestDistance) {
        bestDistance = d;
        best = spot;
      }
    }
    return best;
  }

  draw() {
    const q = this.rig.camera.quaternion;
    const key = `${q.x.toFixed(3)},${q.y.toFixed(3)},${q.z.toFixed(3)},${q.w.toFixed(3)}`;
    if (key === this.lastKey) return;
    this.lastKey = key;

    const { ctx, size } = this;
    const center = size / 2;
    const reach = center - 14;
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const inverse = q.clone().invert();
    this.spots = GIZMO_AXES.map((axis) => {
      const v = new THREE.Vector3(...axis.dir).applyQuaternion(inverse);
      return { ...axis, x: center + v.x * reach, y: center - v.y * reach, depth: v.z };
    }).sort((a, b) => a.depth - b.depth);
    for (const spot of this.spots) {
      const front = Boolean(spot.label);
      ctx.globalAlpha = front ? 1 : 0.55;
      if (front) {
        ctx.strokeStyle = spot.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(center, center);
        ctx.lineTo(spot.x, spot.y);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, front ? 10 : 6.5, 0, Math.PI * 2);
      ctx.fillStyle = spot.color;
      ctx.fill();
      if (this.hover?.key === spot.key) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (front) {
        ctx.fillStyle = "#14112a";
        ctx.font = "700 12px Fredoka, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(spot.label, spot.x, spot.y + 0.5);
      }
    }
    ctx.globalAlpha = 1;
  }
}
