/* Smooth follow camera with level bounds, boss arena framing and screen shake. */
(function (MQ) {
  const { clamp, damp } = MQ.U;
  const LOOK_AHEAD = 110;
  const ANCHOR_Y = 0.63; // Where the player's feet sit on screen.

  class Camera {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.x = 0;
      this.y = 0;
      this.zoom = 1;
      this.lead = 0;
      this.arena = null;
      this.focus = null;
      this.trauma = 0;
      this.shakeX = 0;
      this.shakeY = 0;
      this.time = 0;
      this.shakeEnabled = true;
    }

    get viewW() {
      return MQ.VW / this.zoom;
    }

    get viewH() {
      return MQ.VH / this.zoom;
    }

    setArena(arena) {
      this.arena = arena;
    }

    shake(amount) {
      if (this.shakeEnabled) this.trauma = Math.min(1, this.trauma + amount);
    }

    snap(target) {
      this.lead = target.facing * LOOK_AHEAD;
      this.follow(target, 10, true);
    }

    update(target, dt) {
      this.time += dt;
      this.trauma = Math.max(0, this.trauma - dt * 1.6);
      const power = this.trauma * this.trauma;
      this.shakeX = Math.sin(this.time * 61) * 16 * power;
      this.shakeY = Math.sin(this.time * 47 + 2) * 12 * power;
      this.follow(target, dt, false);
    }

    follow(target, dt, instant) {
      let zoom = 1;
      let x;
      let y;

      if (this.focus) {
        zoom = this.focus.zoom;
        x = this.focus.x - MQ.VW / zoom / 2;
        y = this.focus.y - MQ.VH / zoom / 2;
      } else if (this.arena) {
        const a = this.arena;
        zoom = clamp(MQ.VW / (a.x1 - a.x0), 0.74, 1);
        const viewW = MQ.VW / zoom;
        const viewH = MQ.VH / zoom;
        x = clamp(target.x - viewW / 2, a.x0, Math.max(a.x0, a.x1 - viewW));
        // Keep the floor low on screen, rising only if the player climbs.
        y = Math.min(a.floor - viewH * 0.82, target.y - target.h - 90);
      } else {
        this.lead = damp(this.lead, target.facing * LOOK_AHEAD, 1.8, dt);
        x = target.x + this.lead - MQ.VW / 2;
        y = target.y - MQ.VH * ANCHOR_Y;
      }

      this.zoom = instant ? zoom : damp(this.zoom, zoom, 3, dt);
      const falling = target.vy > 500;
      this.x = instant ? x : damp(this.x, x, this.focus || this.arena ? 3.5 : 7, dt);
      this.y = instant ? y : damp(this.y, y, falling ? 10 : this.focus ? 3.5 : 4.5, dt);

      // Never lose sight of the player during quick falls and flights.
      if (!this.focus && !instant) {
        this.x = clamp(this.x, target.x - this.viewW * 0.88, target.x - this.viewW * 0.12);
        this.y = clamp(this.y, target.y + 40 - this.viewH, target.y - target.h - 40);
      }
      this.x = clamp(this.x, 0, Math.max(0, this.width - this.viewW));
      this.y = clamp(this.y, 0, Math.max(0, this.height - this.viewH));
    }

    apply(ctx) {
      ctx.scale(this.zoom, this.zoom);
      ctx.translate(-this.x + this.shakeX, -this.y + this.shakeY);
    }

    sees(x, y, margin = 120) {
      return x > this.x - margin && x < this.x + this.viewW + margin && y > this.y - margin && y < this.y + this.viewH + margin;
    }
  }

  MQ.Camera = Camera;
})(window.MQ);
