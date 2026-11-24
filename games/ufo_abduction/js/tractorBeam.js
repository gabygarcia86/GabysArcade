/*
 * The tractor beam is a cone hanging under the saucer. Its length is the effective range:
 * fly too high and it doesn't reach the ground. Targets, aliens and power-ups ask
 * contains() whether they're inside, and do their own floating up.
 */
(function (U) {
  "use strict";

  const D = U.Draw;
  const RANGE = 290;
  const SUPER_RANGE = 580;

  class TractorBeam {
    constructor(game) {
      this.game = game;
      this.reset();
    }

    reset() {
      this.active = false;
      this.intensity = 0;
      this.length = 0;
      this.ox = 0;
      this.oy = 0;
      this.big = false;
      this.phase = 0;
      this.sparkT = 0;
      this.wasOn = false;
    }

    // Whether the beam could switch on right now.
    usable() {
      const p = this.game.player;
      return p.alive && !p.crash && p.stun <= 0 && p.beamFried <= 0 && p.overload <= 0;
    }

    update(dt, wanted) {
      const p = this.game.player;
      const on = wanted && this.usable();
      if (on && !this.wasOn) this.game.audio.play("beamOn");
      this.wasOn = on;
      this.active = on;
      this.big = p.power.super > 0;
      this.intensity = U.approach(this.intensity, on ? 1 : 0, dt * (on ? 6 : 9));
      const full = this.big ? SUPER_RANGE : RANGE;
      this.length = full * U.easeOutCubic(this.intensity);
      this.ox = p.x;
      this.oy = p.y + 22;
      this.phase += dt;
      this.game.audio.setBeam(on, this.big);

      if (this.intensity > 0.3) {
        this.sparkT -= dt;
        if (this.sparkT <= 0) {
          this.sparkT = 0.03;
          const y = this.oy + Math.random() * this.reachLength();
          const hw = this.halfWidthAt(y) * 0.9;
          this.game.particles.emit({
            x: this.ox + U.rand(-hw, hw),
            y,
            vy: -90 - Math.random() * 80,
            life: 0.6,
            size: U.rand(2, 4),
            color: U.pick(["#ffffff", "#bfffee", "#fff7a8"]),
            drag: 0.98,
            kind: Math.random() < 0.3 ? "star" : "circle",
          });
        }
      }
    }

    // The beam stops at the ground.
    reachLength() {
      return Math.min(this.length, U.VH - 8 - this.oy);
    }

    halfWidthAt(y) {
      const d = Math.max(0, y - this.oy);
      return this.big ? 26 + d * 0.5 : 16 + d * 0.32;
    }

    contains(x, y, pad = 0) {
      if (!this.active || this.intensity < 0.5) return false;
      const d = y - this.oy;
      if (d < -10 || d > this.length) return false;
      return Math.abs(x - this.ox) <= this.halfWidthAt(y) + pad;
    }

    // Is a rectangle (a hazard's body) touching the beam anywhere?
    touchesRect(x, y, w, h) {
      if (!this.active || this.intensity < 0.5) return false;
      const steps = 4;
      for (let i = 0; i <= steps; i++) {
        const py = y + (h * i) / steps;
        const d = py - this.oy;
        if (d < 0 || d > this.length) continue;
        const hw = this.halfWidthAt(py);
        if (x < this.ox + hw && x + w > this.ox - hw) return true;
      }
      return false;
    }

    draw(ctx, t) {
      if (this.intensity <= 0.01) return;
      const len = this.reachLength();
      const top = this.oy;
      const bottom = top + len;
      const hw0 = this.halfWidthAt(top);
      const hw1 = this.halfWidthAt(bottom);
      const a = this.intensity;
      // Red and flickering while it touches a hazard.
      const danger = this.game.beamDanger && Math.floor(t * 14) % 2 === 0;
      const tint = danger ? "255, 90, 100" : this.big ? "255, 236, 140" : "150, 255, 226";

      const g = ctx.createLinearGradient(0, top, 0, bottom);
      g.addColorStop(0, `rgba(${tint}, ${0.62 * a})`);
      g.addColorStop(1, `rgba(${tint}, ${0.16 * a})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(this.ox - hw0, top);
      ctx.lineTo(this.ox + hw0, top);
      ctx.lineTo(this.ox + hw1, bottom);
      ctx.lineTo(this.ox - hw1, bottom);
      ctx.closePath();
      ctx.fill();

      // A brighter core.
      ctx.fillStyle = `rgba(255, 255, 255, ${0.16 * a})`;
      ctx.beginPath();
      ctx.moveTo(this.ox - hw0 * 0.4, top);
      ctx.lineTo(this.ox + hw0 * 0.4, top);
      ctx.lineTo(this.ox + hw1 * 0.35, bottom);
      ctx.lineTo(this.ox - hw1 * 0.35, bottom);
      ctx.closePath();
      ctx.fill();

      // Glowing edges that shimmer.
      ctx.lineWidth = 3;
      ctx.strokeStyle = `rgba(255, 255, 255, ${(0.55 + Math.sin(t * 20) * 0.2) * a})`;
      ctx.beginPath();
      ctx.moveTo(this.ox - hw0, top);
      ctx.lineTo(this.ox - hw1, bottom);
      ctx.moveTo(this.ox + hw0, top);
      ctx.lineTo(this.ox + hw1, bottom);
      ctx.stroke();

      // Energy rings rising up the beam.
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 5; i++) {
        const k = 1 - ((this.phase * 0.9 + i / 5) % 1);
        const y = top + k * len;
        const hw = this.halfWidthAt(y);
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 * a * (1 - Math.abs(k - 0.5))})`;
        ctx.beginPath();
        ctx.ellipse(this.ox, y, hw, 5 + hw * 0.08, 0, 0, U.TAU);
        ctx.stroke();
      }

      // A pool of light where it meets the ground.
      if (bottom >= U.FEET_MIN) {
        ctx.fillStyle = `rgba(${tint}, ${0.35 * a})`;
        ctx.beginPath();
        ctx.ellipse(this.ox, bottom, hw1 * 1.05, 10, 0, 0, U.TAU);
        ctx.fill();
      } else {
        // Out of range: the end of the beam fizzles.
        ctx.fillStyle = `rgba(${tint}, ${0.25 * a})`;
        for (let i = 0; i < 4; i++) {
          D.circ(ctx, this.ox + Math.sin(t * 9 + i * 2) * hw1 * 0.7, bottom + Math.cos(t * 7 + i) * 6, 4, `rgba(${tint}, ${0.5 * a})`, 0);
        }
      }
    }
  }

  U.TractorBeam = TractorBeam;
  U.BEAM_RANGE = RANGE;
})(window.UFO);
