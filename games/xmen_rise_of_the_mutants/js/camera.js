/*
 * Camera: follows the hero with a little look-ahead and keeps them near the middle of the
 * screen, clear of the touch controls at the sides and bottom. It may look past the level's
 * left, right and bottom edges to do that; the world draws solid ground out there.
 */
(function (XM) {
  "use strict";
  const U = XM.U;

  // Where the hero's feet sit, as a share of the view height (a bit above center-bottom).
  const FEET_Y = 0.6;
  // How far below the level's bottom edge the camera may look, as a share of the view.
  const BOTTOM_SLACK = 0.3;

  class Camera {
    constructor() {
      this.x = 0;
      this.y = 0;
      this.look = 0;
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
      return t.y + t.h - XM.VIEW.h * FEET_Y;
    }

    follow(t, dt) {
      const ahead = t.facing * Math.min(70, XM.VIEW.w * 0.06);
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
      // The hero can always be centered, even at the very start or end of a level.
      this.x = U.clamp(this.x, -vw / 2, this.bounds.w - vw / 2);
      this.y = U.clamp(this.y, 0, this.bounds.h - vh + vh * BOTTOM_SLACK);
    }

    visible(x, y, w, h, margin = 80) {
      return x + w > this.x - margin && x < this.x + XM.VIEW.w + margin && y + h > this.y - margin && y < this.y + XM.VIEW.h + margin;
    }
  }

  XM.Camera = Camera;
})(window.XM);
