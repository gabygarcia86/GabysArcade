// Routes the pointer: picks objects under it, starts sculpt and paint strokes, drags objects,
// places fun parts, and leaves everything else to the orbit controls.
import * as THREE from "three";
import { BRUSHES } from "./brushes.js";

const CLICK_SLOP = 6;
const CLICK_TIME = 450;

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const inverse = new THREE.Matrix4();
const origin = new THREE.Vector3();
const direction = new THREE.Vector3();
const normal = new THREE.Vector3();
const hitData = { t: 0, tri: 0, u: 0, v: 0 };
const scratchA = new THREE.Vector3();
const scratchB = new THREE.Vector3();

export class Picker {
  constructor(app, canvas) {
    this.app = app;
    this.canvas = canvas;
  }

  screenPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  rayFrom(screen) {
    const rect = this.canvas.getBoundingClientRect();
    ndc.set(screen.x / rect.width * 2 - 1, -(screen.y / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, this.app.rig.camera);
    return raycaster;
  }

  _castObject(object) {
    inverse.copy(object.mesh.matrixWorld).invert();
    origin.copy(raycaster.ray.origin).applyMatrix4(inverse);
    direction.copy(raycaster.ray.direction).transformDirection(inverse);
    return object.sculpt.bvh.raycast(origin.x, origin.y, origin.z, direction.x, direction.y, direction.z, hitData);
  }

  _result(object) {
    const mesh = object.sculpt;
    const { idx, nor } = mesh;
    const { tri, u, v, t } = hitData;
    const w = 1 - u - v;
    const a = idx[tri * 3] * 3, b = idx[tri * 3 + 1] * 3, c = idx[tri * 3 + 2] * 3;
    normal.set(
      nor[a] * w + nor[b] * u + nor[c] * v,
      nor[a + 1] * w + nor[b + 1] * u + nor[c + 1] * v,
      nor[a + 2] * w + nor[b + 2] * u + nor[c + 2] * v,
    ).normalize();
    const lx = origin.x + direction.x * t, ly = origin.y + direction.y * t, lz = origin.z + direction.z * t;
    const point = new THREE.Vector3(lx, ly, lz).applyMatrix4(object.mesh.matrixWorld);
    return {
      object,
      point,
      local: { x: lx, y: ly, z: lz, nx: normal.x, ny: normal.y, nz: normal.z },
    };
  }

  /** The nearest visible object under a screen point, or null. */
  fromScreen(screen) {
    this.rayFrom(screen);
    let best = null;
    let bestDistance = Infinity;
    for (const object of this.app.objects.list) {
      if (!object.mesh.visible || !this._castObject(object)) continue;
      const hit = this._result(object);
      const distance = hit.point.distanceToSquared(raycaster.ray.origin);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = hit;
      }
    }
    return best;
  }

  /** Like fromScreen, but only looks at one object, as a stroke does once it has started. */
  onObject(object, screen) {
    this.rayFrom(screen);
    return this._castObject(object) ? this._result(object) : null;
  }

  /** How many screen pixels a world length covers at a point on an object. */
  worldToPixels(length, local, object) {
    const rect = this.canvas.getBoundingClientRect();
    const { camera } = this.app.rig;
    scratchA.set(local.x, local.y, local.z).applyMatrix4(object.mesh.matrixWorld);
    if (camera.isOrthographicCamera) {
      return length * camera.zoom * rect.height / (camera.top - camera.bottom);
    }
    const depth = scratchA.distanceTo(camera.position);
    const worldHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * depth;
    return length / worldHeight * rect.height;
  }
}

export class BrushCursor {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    this.group.visible = false;
    const ring = new THREE.RingGeometry(0.965, 1, 64);
    const disc = new THREE.CircleGeometry(1, 48);
    const square = new THREE.BufferGeometry().setFromPoints(
      [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([x, y]) => new THREE.Vector3(x * 0.74, y * 0.74, 0)));
    this.markers = [];
    for (let i = 0; i < 8; i++) {
      const color = i === 0 ? 0xffffff : 0xffc53d;
      const material = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      });
      const marker = new THREE.Group();
      marker.add(new THREE.Mesh(ring, material));
      marker.add(new THREE.Mesh(disc, new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.1, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      })));
      const box = new THREE.Line(square, new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true }));
      box.visible = false;
      marker.add(box);
      marker.userData.box = box;
      marker.renderOrder = 20;
      marker.children.forEach((child) => { child.renderOrder = 20; });
      marker.visible = false;
      this.group.add(marker);
      this.markers.push(marker);
    }
    app.scene.scene.add(this.group);
  }

  hide() {
    if (this.group.visible) {
      this.group.visible = false;
      this.app.requestRender();
    }
  }

  show(hit, radius, squared, stretch) {
    const { app } = this;
    const mirrors = app.symmetry.mirrors();
    const object = hit.object;
    const world = object.mesh.matrixWorld;
    const local = hit.local;
    this.markers.forEach((marker, i) => {
      const m = mirrors[i];
      marker.visible = Boolean(m);
      if (!m) return;
      scratchA.set(local.x * m[0], local.y * m[1], local.z * m[2]).applyMatrix4(world);
      scratchB.set(local.nx * m[0], local.ny * m[1], local.nz * m[2]).transformDirection(world);
      marker.position.copy(scratchA).addScaledVector(scratchB, 0.004);
      marker.quaternion.setFromUnitVectors(FORWARD, scratchB);
      marker.scale.setScalar(radius);
      marker.children[0].visible = !squared;
      marker.children[1].visible = !squared;
      marker.userData.box.visible = squared;
      if (squared && stretch) {
        // Line the strip's box up with the stroke by turning it within the surface plane.
        scratchA.set(stretch.x * m[0], stretch.y * m[1], stretch.z * m[2]).transformDirection(world)
          .applyQuaternion(marker.quaternion.clone().invert());
        marker.rotateZ(Math.atan2(scratchA.y, scratchA.x));
      }
    });
    this.group.visible = true;
    app.requestRender();
  }
}

const FORWARD = new THREE.Vector3(0, 0, 1);

export class Interaction {
  constructor(app, canvas) {
    this.app = app;
    this.canvas = canvas;
    this.cursor = new BrushCursor(app);
    this.pointers = new Map();
    this.press = null;
    this.drag = null;
    this.hoverPoint = null;
    this.placing = null;
    this.handingOver = false;

    // Capture on the parent runs before the orbit and transform controls see the event.
    const stage = canvas.parentElement;
    stage.addEventListener("pointerdown", (e) => this._down(e), true);
    window.addEventListener("pointermove", (e) => this._move(e));
    window.addEventListener("pointerup", (e) => this._up(e));
    window.addEventListener("pointercancel", (e) => this._up(e, true));
    canvas.addEventListener("pointerleave", () => {
      this.hoverPoint = null;
      this.cursor.hide();
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("wheel", () => {
      this.hoverDirty = true;
    }, { passive: true });
  }

  /** Waits for the next tap on a model, then calls `place` with the hit. */
  startPlacing(place, label) {
    this.placing = { place, label };
    this.canvas.classList.add("is-placing");
    this.app.emit("placing", label);
  }

  stopPlacing() {
    if (!this.placing) return;
    this.placing = null;
    this.canvas.classList.remove("is-placing");
    this.app.emit("placing", null);
  }

  _isViewport(e) {
    return e.target === this.canvas;
  }

  _down(e) {
    if (!this._isViewport(e) || this.handingOver) return;
    const { app } = this;
    this.pointers.set(e.pointerId, e);

    if (this.pointers.size === 2) {
      this._secondFinger(e);
      return;
    }
    if (this.pointers.size > 2 || e.button !== 0 || e.altKey) return;

    const screen = app.pick.screenPoint(e);
    const tool = app.tool;

    if (this.placing) {
      const hit = app.pick.fromScreen(screen);
      this.press = { screen, placing: true, hit };
      app.rig.controls.enabled = false;
      return;
    }

    if (tool === "select") {
      if (app.objects.gizmo.axis) return;
      const hit = app.pick.fromScreen(screen);
      this.press = { screen, time: performance.now(), hit, shift: e.shiftKey };
      if (hit && app.objects.selected.has(hit.object)) {
        app.rig.controls.enabled = false;
        this.drag = { before: app.objects.snapshotSelection(), plane: null, last: hit.point.clone(), hit };
      }
      return;
    }

    const hit = app.pick.fromScreen(screen);
    if (!hit) return;
    app.rig.controls.enabled = false;
    this.strokePointer = e.pointerId;
    this.strokeStart = performance.now();
    this.canvas.setPointerCapture?.(e.pointerId);
    this.cursor.show(hit, this._radius(), this._squared(), null);
    app.objects.focusOn(hit.object);
    const pressure = pressureOf(e);
    if (tool === "paint" || tool === "erase") {
      app.painter.begin(tool === "erase", hit, screen, pressure);
    } else {
      app.sculptor.begin(tool, hit, screen, {
        pressure,
        invert: e.ctrlKey || e.metaKey,
        smoothKey: e.shiftKey,
      });
    }
  }

  /**
   * A second finger means the press was a pinch or pan. Very young strokes are undone. Either
   * way the first finger is replayed to the orbit controls so they see a real two-finger gesture.
   */
  _secondFinger() {
    const { app } = this;
    const captured = !app.rig.controls.enabled;
    if (app.sculptor.active || app.painter.active) {
      const young = performance.now() - this.strokeStart < 220;
      if (app.sculptor.active) {
        if (young) app.sculptor.cancel();
        else app.sculptor.end();
      }
      if (app.painter.active) app.painter.end();
      this.strokePointer = null;
      this.cursor.hide();
    }
    this.drag = null;
    this.press = null;
    app.rig.controls.enabled = true;
    if (!captured) return;
    const first = [...this.pointers.values()][0];
    this.handingOver = true;
    this.canvas.dispatchEvent(new PointerEvent("pointerdown", {
      pointerId: first.pointerId, pointerType: first.pointerType, button: 0, buttons: 1,
      clientX: first.clientX, clientY: first.clientY, bubbles: true, isPrimary: true,
    }));
    this.handingOver = false;
  }

  _move(e) {
    const { app } = this;
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, e);
    const screen = app.pick.screenPoint(e);
    if (e.pointerId === this.strokePointer) {
      const samples = e.getCoalescedEvents?.() ?? [];
      const last = samples.length ? samples[samples.length - 1] : e;
      const point = app.pick.screenPoint(last);
      const pressure = pressureOf(last);
      app.sculptor.move(point, pressure);
      app.painter.move(point, pressure);
      this.hoverPoint = point;
      return;
    }
    if (this.drag) {
      this._dragMove(screen);
      return;
    }
    if (this.press?.placing) return;
    if (e.pointerType === "mouse" && e.target === this.canvas && !e.buttons) {
      this.hoverPoint = screen;
      this.hoverDirty = true;
    } else if (e.target !== this.canvas) {
      this.hoverPoint = null;
      this.cursor.hide();
    }
  }

  _dragMove(screen) {
    const { app, drag, press } = this;
    if (app.objects.gizmo.dragging) {
      this.drag = null;
      return;
    }
    if (!drag.moving) {
      if (Math.hypot(screen.x - press.screen.x, screen.y - press.screen.y) < CLICK_SLOP) return;
      drag.moving = true;
      const forward = app.rig.camera.getWorldDirection(new THREE.Vector3());
      drag.plane = new THREE.Plane().setFromNormalAndCoplanarPoint(forward, drag.last);
    }
    const ray = app.pick.rayFrom(screen).ray;
    const point = ray.intersectPlane(drag.plane, new THREE.Vector3());
    if (!point) return;
    app.objects.moveBy(point.clone().sub(drag.last));
    drag.last.copy(point);
    app.requestRender();
  }

  _up(e, cancelled = false) {
    const { app } = this;
    const had = this.pointers.delete(e.pointerId);
    if (e.pointerId === this.strokePointer) {
      this.strokePointer = null;
      if (cancelled) app.sculptor.cancel();
      else app.sculptor.end();
      app.painter.end();
      app.rig.controls.enabled = true;
      app.emit("stroke-end");
      this.hoverDirty = true;
      return;
    }
    if (!had) return;
    const press = this.press;
    this.press = null;
    const screen = app.pick.screenPoint(e);
    const moved = press ? Math.hypot(screen.x - press.screen.x, screen.y - press.screen.y) : Infinity;

    if (press?.placing) {
      app.rig.controls.enabled = true;
      if (moved < CLICK_SLOP * 2 && !cancelled) {
        const placing = this.placing;
        const hit = press.hit;
        this.stopPlacing();
        placing?.place(hit);
      }
      return;
    }

    if (this.drag) {
      const { drag } = this;
      this.drag = null;
      app.rig.controls.enabled = true;
      if (drag.moving) {
        app.objects.recordTransforms(drag.before, "Move");
        app.objects.refreshGizmo();
        return;
      }
    }
    if (press && !cancelled && moved < CLICK_SLOP && performance.now() - press.time < CLICK_TIME && !app.objects.gizmo.dragging) {
      app.objects.selectClick(press.hit?.object ?? null, press.shift);
    }
  }

  _radius() {
    const { app } = this;
    const painting = app.tool === "paint" || app.tool === "erase";
    return painting ? app.paint.radius : app.brush.radius;
  }

  _squared() {
    return Boolean(BRUSHES[this.app.tool]?.square);
  }

  /** Keeps the brush ring on the surface. Runs once a frame. */
  tick() {
    const { app } = this;
    const isBrush = app.tool !== "select" || this.placing;
    if (!isBrush || !this.hoverPoint) {
      if (!this.hoverPoint || app.tool === "select") this.cursor.hide();
      return;
    }
    if (!this.hoverDirty && !app.sculptor.active && !app.painter.active) return;
    this.hoverDirty = false;
    const hit = app.pick.fromScreen(this.hoverPoint);
    if (hit) this.cursor.show(hit, this.placing ? 0.12 : this._radius(), !this.placing && this._squared(), this._strokeDirection());
    else this.cursor.hide();
  }

  _strokeDirection() {
    const s = this.app.sculptor.stroke;
    return s?.brush.square && s.direction.lengthSq() ? s.direction : null;
  }
}

function pressureOf(e) {
  return e.pointerType === "pen" && e.pressure > 0 ? e.pressure : 1;
}
