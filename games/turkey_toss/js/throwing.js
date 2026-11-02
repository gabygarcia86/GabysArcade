import * as THREE from 'three';
import { LAUNCH } from './config.js';
import { simulateTrajectory } from './physics.js';

const _projected = new THREE.Vector3();
const _ndc = new THREE.Vector2();
const _plane = new THREE.Plane();
const _hit = new THREE.Vector3();
const _sphere = new THREE.Sphere();
const _up = new THREE.Vector3(0, 1, 0);

/**
 * Drag-to-aim, release-to-toss input built on Pointer Events, so mouse, touch and pen all
 * share one code path. This is the Latke Toss control scheme.
 *
 * Mapping from screen drag to launch velocity:
 *  - Power: drag length past the cancel distance, as a fraction of the distance from there to
 *    fullPowerDragFraction * viewport height, clamped to 0..1, mapped
 *    to LAUNCH.minSpeed..maxSpeed so distance grows evenly. Releasing below cancelDragFraction
 *    cancels.
 *  - Direction: the drag direction on screen is projected onto the horizontal plane through
 *    the slice (via a camera ray), so the throw heads where the drag points *in the 3D
 *    scene*, correcting for perspective. The resulting yaw is clamped to +/- maxYawDegrees.
 *  - Elevation is fixed (LAUNCH.elevationDegrees); drag length alone sets distance/height.
 */
export class AimController {
  constructor(canvas, camera, { canStartAim, getSlicePosition, onAimStart, onAimChange, onThrow, onCancel, onHover }) {
    this.canvas = canvas;
    this.camera = camera;
    this.canStartAim = canStartAim;
    this.getSlicePosition = getSlicePosition;
    this.onAimStart = onAimStart;
    this.onAimChange = onAimChange;
    this.onThrow = onThrow;
    this.onCancel = onCancel;
    this.onHover = onHover;

    this.raycaster = new THREE.Raycaster();
    this.activePointerId = null;
    this.startX = 0;
    this.startY = 0;
    this.sliceScreen = new THREE.Vector2();
    this.aim = {
      power: 0,
      speed: 0,
      yaw: 0,
      valid: false,
      velocity: new THREE.Vector3(),
    };

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onPointerCancel = this._onPointerCancel.bind(this);
    canvas.addEventListener('pointerdown', this._onPointerDown);
    canvas.addEventListener('pointermove', this._onPointerMove);
    canvas.addEventListener('pointerup', this._onPointerUp);
    canvas.addEventListener('pointercancel', this._onPointerCancel);
    canvas.addEventListener('lostpointercapture', this._onPointerCancel);
    // Stop long-press menus and double-tap zoom on the game canvas only.
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  get isAiming() {
    return this.activePointerId !== null;
  }

  _localPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top, width: rect.width, height: rect.height };
  }

  // Projects a world point to canvas pixel coordinates.
  _toScreen(world, width, height, out) {
    _projected.copy(world).project(this.camera);
    out.set((_projected.x + 1) * 0.5 * width, (1 - _projected.y) * 0.5 * height);
    return out;
  }

  _setRayFromPixel(x, y, width, height) {
    _ndc.set((x / width) * 2 - 1, -(y / height) * 2 + 1);
    this.raycaster.setFromCamera(_ndc, this.camera);
  }

  // Grab test: generous 3D hit sphere around the slice OR a screen-space radius.
  _isOverSlice(point) {
    const slicePosition = this.getSlicePosition();
    if (!slicePosition) return false;
    this._toScreen(slicePosition, point.width, point.height, this.sliceScreen);
    const screenDistance = Math.hypot(point.x - this.sliceScreen.x, point.y - this.sliceScreen.y);
    if (screenDistance <= LAUNCH.grabRadiusPx) return true;
    this._setRayFromPixel(point.x, point.y, point.width, point.height);
    _sphere.set(slicePosition, 0.6);
    return this.raycaster.ray.intersectsSphere(_sphere);
  }

  _onPointerDown(event) {
    if (this.activePointerId !== null) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!this.canStartAim()) return;
    const point = this._localPoint(event);
    if (!this._isOverSlice(point)) return;

    event.preventDefault();
    this.activePointerId = event.pointerId;
    try {
      this.canvas.setPointerCapture(event.pointerId);
    } catch {
      // Capture can fail on synthetic events; aiming still works without it.
    }
    this.startX = point.x;
    this.startY = point.y;
    this._updateAim(point);
    this.onAimStart(this.aim);
  }

  _onPointerMove(event) {
    const point = this._localPoint(event);
    if (event.pointerId !== this.activePointerId) {
      if (this.activePointerId === null && event.pointerType === 'mouse') {
        this.onHover(this.canStartAim() && this._isOverSlice(point));
      }
      return;
    }
    event.preventDefault();
    this._updateAim(point);
    this.onAimChange(this.aim);
  }

  _onPointerUp(event) {
    if (event.pointerId !== this.activePointerId) return;
    event.preventDefault();
    const point = this._localPoint(event);
    this._updateAim(point);
    this._release(event.pointerId);
    if (this.aim.valid) this.onThrow(this.aim);
    else this.onCancel();
  }

  _onPointerCancel(event) {
    if (event.pointerId !== this.activePointerId) return;
    this._release(event.pointerId);
    this.onCancel();
  }

  _release(pointerId) {
    this.activePointerId = null;
    try {
      if (this.canvas.hasPointerCapture(pointerId)) this.canvas.releasePointerCapture(pointerId);
    } catch {
      // Ignore: the pointer may already be gone.
    }
  }

  /** Cancels any in-progress aim (e.g. on pause or when the round ends). */
  cancel() {
    if (this.activePointerId === null) return;
    this._release(this.activePointerId);
    this.onCancel();
  }

  _updateAim(point) {
    const aim = this.aim;
    const dragX = point.x - this.startX;
    const dragY = point.y - this.startY;
    const dragLength = Math.hypot(dragX, dragY);
    const fullPowerPixels = Math.max(120, point.height * LAUNCH.fullPowerDragFraction);
    const cancelPixels = point.height * LAUNCH.cancelDragFraction;
    const slicePosition = this.getSlicePosition();

    let yaw = 0;
    let forward = true;
    if (dragLength > 2 && slicePosition) {
      // Perspective-correct heading: step a short distance along the drag direction on
      // screen, cast a ray through that pixel, and intersect the horizontal plane at the
      // slice's height. The world-space vector from the slice to that hit point is the
      // ground-track direction the player is pointing at.
      this._toScreen(slicePosition, point.width, point.height, this.sliceScreen);
      const stepPixels = 60;
      const sampleX = this.sliceScreen.x + (dragX / dragLength) * stepPixels;
      const sampleY = this.sliceScreen.y + (dragY / dragLength) * stepPixels;
      this._setRayFromPixel(sampleX, sampleY, point.width, point.height);
      _plane.set(_up, -slicePosition.y);
      const hit = this.raycaster.ray.intersectPlane(_plane, _hit);
      if (hit) {
        const dx = hit.x - slicePosition.x;
        const dz = hit.z - slicePosition.z;
        forward = dz < 0; // -Z is "into the scene", toward the table
        yaw = Math.atan2(dx, -dz);
      } else {
        // Pointing above the horizon: treat as straight ahead along the screen's x drift.
        yaw = Math.atan2(dragX, -dragY);
        forward = dragY < 0;
      }
    }

    const maxYaw = THREE.MathUtils.degToRad(LAUNCH.maxYawDegrees);
    yaw = THREE.MathUtils.clamp(yaw, -maxYaw, maxYaw);
    // Measured from the cancel point, so the shortest valid drag is the gentlest throw and
    // no distance is out of reach.
    const power = THREE.MathUtils.clamp((dragLength - cancelPixels) / (fullPowerPixels - cancelPixels), 0, 1);

    aim.valid = forward && dragLength >= cancelPixels;
    aim.power = aim.valid ? power : 0;
    aim.yaw = yaw;
    aimVelocity(aim.power, aim.yaw, aim);
  }
}

/** Fills target.speed and target.velocity for a power (0..1) and yaw (radians). */
export function aimVelocity(power, yaw, target) {
  // Throw distance grows with speed squared, so power blends the squares. That makes an
  // inch of drag worth the same distance at both ends of the table.
  const min = LAUNCH.minSpeed ** 2;
  target.speed = Math.sqrt(min + (LAUNCH.maxSpeed ** 2 - min) * power);
  const elevation = THREE.MathUtils.degToRad(LAUNCH.elevationDegrees);
  const horizontalSpeed = Math.cos(elevation) * target.speed;
  target.velocity.set(
    Math.sin(yaw) * horizontalSpeed,
    Math.sin(elevation) * target.speed,
    -Math.cos(yaw) * horizontalSpeed,
  );
}

// Enough dots to reach the table on the longest throw.
const TRAJECTORY_DOTS = 60;
const TRAJECTORY_SAMPLE_SECONDS = 0.05;

/** Aiming preview: a dotted arc and a power arrow on the table. */
export class AimVisuals {
  constructor(scene, launchPosition, restPosition) {
    this.launchPosition = launchPosition;
    this.points = Array.from({ length: TRAJECTORY_DOTS }, () => new THREE.Vector3());
    const dotGeometry = new THREE.SphereGeometry(0.07, 10, 8);
    // No depth test, so the arc stays readable where it passes behind the giant turkey.
    const dotMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.92, depthWrite: false, depthTest: false,
    });
    this.dots = new THREE.InstancedMesh(dotGeometry, dotMaterial, TRAJECTORY_DOTS);
    this.dots.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.dots.frustumCulled = false;
    this.dots.renderOrder = 4;
    const near = new THREE.Color(0x2a0f05);
    const far = new THREE.Color(0x6a1408);
    const color = new THREE.Color();
    for (let i = 0; i < TRAJECTORY_DOTS; i++) {
      this.dots.setColorAt(i, color.copy(near).lerp(far, i / TRAJECTORY_DOTS));
    }
    this.dots.count = 0;
    scene.add(this.dots);

    const shape = new THREE.Shape();
    shape.moveTo(-0.07, 0);
    shape.lineTo(0.07, 0);
    shape.lineTo(0.07, -0.75);
    shape.lineTo(0.2, -0.75);
    shape.lineTo(0, -1);
    shape.lineTo(-0.2, -0.75);
    shape.lineTo(-0.07, -0.75);
    shape.closePath();
    const arrowGeometry = new THREE.ShapeGeometry(shape);
    // Shape is drawn in XY with the tip at -Y; lay it flat so the tip points down -Z.
    arrowGeometry.rotateX(Math.PI / 2);
    this.arrow = new THREE.Mesh(arrowGeometry, new THREE.MeshBasicMaterial({
      color: 0xf2c14e, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide,
    }));
    this.arrow.position.set(restPosition.x, 0.2, restPosition.z - 0.3);
    this.arrow.renderOrder = 3;
    this.arrow.visible = false;
    scene.add(this.arrow);

    this.lowPowerColor = new THREE.Color(0xf2c14e);
    this.highPowerColor = new THREE.Color(0xff5a36);
    this._matrix = new THREE.Matrix4();
    this._scale = new THREE.Vector3();
    this._quaternion = new THREE.Quaternion();
  }

  show(aim) {
    if (!aim.valid) {
      this.hide();
      return;
    }
    const total = simulateTrajectory(
      this.launchPosition, aim.velocity, this.points, TRAJECTORY_DOTS, TRAJECTORY_SAMPLE_SECONDS, 3,
    );
    for (let i = 0; i < total; i++) {
      const size = 1 - (i / TRAJECTORY_DOTS) * 0.45;
      this._scale.setScalar(size);
      this._matrix.compose(this.points[i], this._quaternion, this._scale);
      this.dots.setMatrixAt(i, this._matrix);
    }
    this.dots.count = total;
    this.dots.instanceMatrix.needsUpdate = true;

    this.arrow.visible = true;
    this.arrow.rotation.y = -aim.yaw;
    this.arrow.scale.set(1, 1, 0.55 + aim.power * 0.9);
    this.arrow.material.color.copy(this.lowPowerColor).lerp(this.highPowerColor, aim.power);
  }

  hide() {
    this.dots.count = 0;
    this.arrow.visible = false;
  }
}
