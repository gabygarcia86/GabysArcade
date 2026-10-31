/*
 * Camera follows the Jedi with some look-ahead, stays inside the level, and can
 * lock onto a boss arena or a fixed spot during a cinematic moment.
 */
(function (J) {
  const { clamp, lerp, rand } = J.U;

  class Camera {
    constructor() {
      this.x = 0;
      this.y = 0;
      this.shakeTime = 0;
      this.shakePower = 0;
      this.offsetX = 0;
      this.offsetY = 0;
      this.look = 0;
      this.lock = null; // { x, y } top-left corner while locked
      this.bounds = { left: 0, right: 1000, top: -2000, bottom: 2000 };
      this.floorAt = null; // Function giving the lowest camera y at a world x.
      this.shakeEnabled = true;
    }

    snap(target) {
      this.look = 0;
      this.x = target.x - J.VIEW_W * 0.4;
      this.y = target.y - J.VIEW_H * 0.6;
      this.clampToBounds();
    }

    follow(target, dt) {
      if (this.lock) {
        this.x = lerp(this.x, this.lock.x, 1 - Math.pow(0.002, dt));
        this.y = lerp(this.y, this.lock.y, 1 - Math.pow(0.002, dt));
      } else {
        this.look = lerp(this.look, target.facing * 110, 1 - Math.pow(0.05, dt));
        const wantX = target.x + this.look - J.VIEW_W / 2;
        const wantY = target.y - J.VIEW_H * 0.62;
        this.x = lerp(this.x, wantX, 1 - Math.pow(0.0006, dt));
        // Vertical moves stay gentle unless the Jedi is falling fast or near the screen edge.
        const screenY = target.y - this.y;
        const rate = screenY > J.VIEW_H * 0.82 || screenY < J.VIEW_H * 0.22 ? 0.0002 : 0.04;
        this.y = lerp(this.y, wantY, 1 - Math.pow(rate, dt));
        this.clampToBounds();
      }

      if (this.shakeTime > 0) {
        this.shakeTime -= dt;
        const power = this.shakeEnabled ? this.shakePower * clamp(this.shakeTime * 5, 0, 1) : 0;
        this.offsetX = rand(-power, power);
        this.offsetY = rand(-power, power);
      } else {
        this.offsetX = 0;
        this.offsetY = 0;
      }
    }

    clampToBounds() {
      const { left, right, top, bottom } = this.bounds;
      this.x = clamp(this.x, left, Math.max(left, right - J.VIEW_W));
      const floor = this.floorAt ? this.floorAt(this.x + J.VIEW_W / 2) : bottom;
      this.y = clamp(this.y, top, Math.max(top, floor - J.VIEW_H));
    }

    shake(power, time = 0.25) {
      this.shakePower = Math.max(power, this.shakeTime > 0 ? this.shakePower : 0);
      this.shakeTime = Math.max(this.shakeTime, time);
    }

    get viewX() { return Math.round((this.x + this.offsetX) * 2) / 2; }
    get viewY() { return Math.round((this.y + this.offsetY) * 2) / 2; }
  }

  J.Camera = Camera;
})(window.JEDI);
