/**
 * Top-down follow camera: smooth follow with velocity look-ahead, gentle zoom
 * out with speed, a little sway on boost and decaying screen shake.
 */
import { CONFIG } from './config.js';
import { damp, clamp } from './utils.js';

const C = CONFIG.camera;

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;       // CSS px per world unit
    this.scale = 1;      // device px per world unit (zoom × dpr)
    this.shakeMag = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.ready = false;
  }

  snap(x, y) {
    this.x = x;
    this.y = y;
    this.ready = true;
  }

  shake(amount) {
    this.shakeMag = Math.min(26, this.shakeMag + amount);
  }

  follow(r, dt, W, H, settings) {
    const ratio = clamp(r.speed / r.h.topSpeed, 0, 1.4);
    let lx = r.vx * C.lookAhead;
    let ly = r.vy * C.lookAhead;
    const l = Math.hypot(lx, ly);
    if (l > C.maxLookAhead) {
      lx *= C.maxLookAhead / l;
      ly *= C.maxLookAhead / l;
    }
    const tx = r.x + lx;
    const ty = r.y + ly;
    if (!this.ready) this.snap(tx, ty);
    const k = damp(C.follow, dt);
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;

    const short = Math.min(W, H);
    const want = short / (C.viewShort * (1 + C.viewZoomOut * Math.min(1, ratio) + (r.boosting ? 0.05 : 0)));
    this.zoom += (want - this.zoom) * damp(C.zoomFollow, dt);
    if (!Number.isFinite(this.zoom) || this.zoom <= 0) this.zoom = want;

    if (r.boosting && settings.screenShake) this.shake(C.boostShake * dt * 6);
    this.shakeMag *= Math.exp(-7 * dt);
    if (!settings.screenShake) this.shakeMag = 0;
    this.shakeX = (Math.random() * 2 - 1) * this.shakeMag;
    this.shakeY = (Math.random() * 2 - 1) * this.shakeMag;
  }

  /** World-space rectangle visible on a W×H (CSS px) screen, with a margin. */
  view(W, H, margin = 60) {
    const hw = W / 2 / this.zoom + margin;
    const hh = H / 2 / this.zoom + margin;
    const cx = this.x + this.shakeX / this.zoom;
    const cy = this.y + this.shakeY / this.zoom;
    return { x0: cx - hw, y0: cy - hh, x1: cx + hw, y1: cy + hh, cx, cy };
  }
}
