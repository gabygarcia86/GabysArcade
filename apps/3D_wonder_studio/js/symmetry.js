// Mirror sculpting across the planes through an object's own center, and the guides that
// show those planes in the viewport.
import * as THREE from "three";

const AXES = ["x", "y", "z"];
const COLORS = { x: 0xff5d8f, y: 0x7dff6b, z: 0x45b7ff };
const ROTATIONS = { x: [0, Math.PI / 2, 0], y: [Math.PI / 2, 0, 0], z: [0, 0, 0] };

export class Symmetry {
  constructor(app) {
    this.app = app;
    this.enabled = false;
    this.axes = { x: true, y: false, z: false };
    this.group = new THREE.Group();
    this.group.visible = false;
    this.group.matrixAutoUpdate = false;
    this.planes = {};
    for (const axis of AXES) {
      const geometry = new THREE.PlaneGeometry(2, 2);
      const plane = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
        color: COLORS[axis], transparent: true, opacity: 0.11, side: THREE.DoubleSide, depthWrite: false,
      }));
      plane.add(new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: COLORS[axis], transparent: true, opacity: 0.75 }),
      ));
      plane.rotation.set(...ROTATIONS[axis]);
      plane.renderOrder = 5;
      this.group.add(plane);
      this.planes[axis] = plane;
    }
    app.scene.scene.add(this.group);
  }

  /** The sign flips for every active mirror, always starting with the real brush. */
  mirrors() {
    const out = [[1, 1, 1]];
    if (!this.enabled) return out;
    AXES.forEach((axis, i) => {
      if (!this.axes[axis]) return;
      for (const m of out.slice()) {
        const flip = m.slice();
        flip[i] = -flip[i];
        out.push(flip);
      }
    });
    return out;
  }

  setEnabled(on) {
    this.enabled = on;
    this.refresh();
  }

  setAxis(axis, on) {
    this.axes[axis] = on;
    if (on) this.enabled = true;
    else if (!Object.values(this.axes).some(Boolean)) this.enabled = false;
    this.refresh();
  }

  /** Fits the guides to the focused object. Call after anything moves. */
  refresh() {
    const focus = this.app.objects?.focus;
    const show = this.enabled && Boolean(focus);
    this.group.visible = show;
    if (show) {
      const size = focus.localSize();
      for (const axis of AXES) this.planes[axis].visible = this.axes[axis];
      this.planes.x.scale.set(size.z * 0.62, size.y * 0.62, 1);
      this.planes.y.scale.set(size.x * 0.62, size.z * 0.62, 1);
      this.planes.z.scale.set(size.x * 0.62, size.y * 0.62, 1);
      this.group.matrix.copy(focus.mesh.matrixWorld);
      this.group.matrixWorldNeedsUpdate = true;
    }
    this.app.emit("symmetry");
    this.app.requestRender();
  }
}
