/*
 * Camera: follows the hero with a little look-ahead, stays inside the level, and can be
 * locked to a combat arena or boss arena.
 */
(function (XM) {
  "use strict";
  const U = XM.U;

  class Camera {
    constructor() {
      this.x = 0;
      this.y = 0;
      this.look = 0;
      this.lock = null; // {x0, x1} while an arena is active
      this.bounds = { w: 1000, h: 540 };
    }

    setBounds(w, h) {
      this.bounds.w = w;
      this.bounds.h = Math.max(h, XM.VIEW.h);
    }

    snap(target) {
      this.look = 0;
      this.x = this.targetX(target);
      this.y = this.targetY(target);
      this.clampToBounds();
    }

    targetX(t) {
      return t.x + t.w / 2 - XM.VIEW.w / 2 + this.look;
    }

    targetY(t) {
      return t.y + t.h - XM.VIEW.h * 0.62;
    }

    follow(t, dt) {
      const ahead = t.facing * Math.min(110, XM.VIEW.w * 0.1);
      this.look = U.lerp(this.look, ahead, Math.min(1, dt * 1.6));
      const tx = this.targetX(t);
      const ty = this.targetY(t);
      this.x = U.lerp(this.x, tx, Math.min(1, dt * 7));
      // Vertical: move faster when the hero falls so they never leave the screen.
      const yk = ty > this.y ? 9 : 5;
      this.y = U.lerp(this.y, ty, Math.min(1, dt * yk));
      this.clampToBounds();
    }

    clampToBounds() {
      const vw = XM.VIEW.w;
      const vh = XM.VIEW.h;
      let x0 = 0;
      let x1 = this.bounds.w - vw;
      if (this.lock) {
        const span = this.lock.x1 - this.lock.x0;
        if (span <= vw) {
          x0 = x1 = this.lock.x0 + span / 2 - vw / 2;
        } else {
          x0 = Math.max(x0, this.lock.x0);
          x1 = Math.min(x1, this.lock.x1 - vw);
        }
      }
      this.x = U.clamp(this.x, Math.min(x0, x1), Math.max(x0, x1));
      this.y = U.clamp(this.y, 0, this.bounds.h - vh);
    }

    visible(x, y, w, h, margin = 80) {
      return x + w > this.x - margin && x < this.x + XM.VIEW.w + margin && y + h > this.y - margin && y < this.y + XM.VIEW.h + margin;
    }
  }

  XM.Camera = Camera;
})(window.XM);
