/*
 * The player's saucer: movement, health, power-up timers, status effects and the crash.
 */
(function (U) {
  "use strict";

  const BASE_SPEED = 400;
  const BOOST_SPEED = 640;
  const ACCEL = 2100;
  const DECEL = 1500;
  const INVULN_TIME = 1.6;
  const MAX_HEALTH = 3;

  class Player {
    constructor(game) {
      this.game = game;
      this.rx = 58;
      this.ry = 24;
      this.power = { super: 0, shield: 0, speed: 0, double: 0, beacon: 0 };
      this.reset();
    }

    reset() {
      this.x = 640;
      this.y = 240;
      this.vx = 0;
      this.vy = 0;
      this.tilt = 0;
      this.health = MAX_HEALTH;
      this.maxHealth = MAX_HEALTH;
      this.clearEffects();
      this.alive = true;
      this.crash = null;
    }

    clearEffects() {
      this.invuln = 0;
      this.stun = 0;
      this.beamFried = 0;
      this.overload = 0;
      this.cheer = 0;
      this.hurtFlash = 0;
      this.trailT = 0;
      for (const k in this.power) this.power[k] = 0;
    }

    // Puts the saucer back at the top of the screen for a new level, keeping health.
    placeForStage(x) {
      this.x = x;
      this.y = 150;
      this.vx = 0;
      this.vy = 0;
      this.tilt = 0;
      this.clearEffects();
      this.alive = this.health > 0;
      this.crash = null;
    }

    get maxSpeed() {
      let s = this.power.speed > 0 ? BOOST_SPEED : BASE_SPEED;
      if (this.game.beam.active) s *= 0.85;
      if (this.stun > 0) s *= 0.2;
      return s;
    }

    update(dt, move) {
      for (const k in this.power) if (this.power[k] > 0) this.power[k] = Math.max(0, this.power[k] - dt);
      this.invuln = Math.max(0, this.invuln - dt);
      this.stun = Math.max(0, this.stun - dt);
      this.beamFried = Math.max(0, this.beamFried - dt);
      this.overload = Math.max(0, this.overload - dt);
      this.cheer = Math.max(0, this.cheer - dt);
      this.hurtFlash = Math.max(0, this.hurtFlash - dt);

      if (this.crash) {
        this.updateCrash(dt);
        return;
      }

      const max = this.maxSpeed;
      const tvx = move.x * max;
      const tvy = move.y * max;
      // Speeding up is quicker than slowing down, so the saucer feels light but floaty.
      const ax = Math.abs(tvx) > Math.abs(this.vx) || Math.sign(tvx) !== Math.sign(this.vx) ? ACCEL : DECEL;
      const ay = Math.abs(tvy) > Math.abs(this.vy) || Math.sign(tvy) !== Math.sign(this.vy) ? ACCEL : DECEL;
      this.vx = U.approach(this.vx, tvx, ax * dt);
      this.vy = U.approach(this.vy, tvy, ay * dt);
      if (this.stun > 0) {
        this.vx += Math.sin(this.game.time * 30) * 40 * dt;
      }

      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.x < 70) {
        this.x = 70;
        this.vx = 0;
      } else if (this.x > U.WORLD_W - 70) {
        this.x = U.WORLD_W - 70;
        this.vx = 0;
      }
      if (this.y < U.UFO_MIN_Y) {
        this.y = U.UFO_MIN_Y;
        this.vy = 0;
      } else if (this.y > U.UFO_MAX_Y) {
        this.y = U.UFO_MAX_Y;
        this.vy = 0;
      }

      // Bank into the direction of travel.
      const targetTilt = (this.vx / BOOST_SPEED) * 0.32 + (this.stun > 0 ? Math.sin(this.game.time * 25) * 0.25 : 0);
      this.tilt = U.damp(this.tilt, targetTilt, 10, dt);

      this.emitTrails(dt);
    }

    emitTrails(dt) {
      const fx = this.game.particles;
      this.trailT -= dt;
      if (this.trailT > 0) return;
      const speed = Math.hypot(this.vx, this.vy);
      if (this.power.speed > 0 && speed > 60) {
        this.trailT = 0.02;
        for (const side of [-1, 1]) {
          fx.emit({ x: this.x - Math.sign(this.vx || 1) * 50 + U.rand(-4, 4), y: this.y + side * 6, vx: -this.vx * 0.3, vy: -this.vy * 0.3, life: 0.45, size: 7, color: side > 0 ? "#ffb02e" : "#ff5fb4", drag: 0.9 });
        }
      } else {
        this.trailT = 0.07;
        fx.emit({ x: this.x + U.rand(-16, 16), y: this.y + 20, vx: -this.vx * 0.2 + U.rand(-10, 10), vy: 40 + U.rand(0, 30), life: 0.4, size: 4, color: "rgba(150, 240, 255, 0.8)", drag: 0.92 });
      }
      if (this.health === 1 && Math.random() < 0.4) fx.smoke(this.x + U.rand(-30, 30), this.y - 6, 1, "rgba(90, 80, 100, 0.6)");
    }

    // Returns true when the hit counted. The shield, invulnerability and celebrations block it.
    damage(label) {
      const g = this.game;
      if (!this.alive || this.crash || this.invuln > 0 || g.celebrating) return false;
      if (this.power.shield > 0) {
        g.blocked(this.x, this.y);
        this.invuln = 0.4;
        return false;
      }
      this.health -= 1;
      this.invuln = INVULN_TIME;
      this.hurtFlash = 0.5;
      g.onPlayerDamaged(label);
      if (this.health <= 0) this.startCrash();
      return true;
    }

    stunFor(seconds) {
      const g = this.game;
      if (!this.alive || this.crash || this.invuln > 0 || g.celebrating) return false;
      if (this.power.shield > 0) {
        g.blocked(this.x, this.y);
        return false;
      }
      this.stun = Math.max(this.stun, seconds);
      this.invuln = 0.8;
      g.onPlayerStunned();
      return true;
    }

    fryBeam(seconds) {
      const g = this.game;
      if (!this.alive || this.crash || g.celebrating) return false;
      if (this.power.shield > 0) {
        g.blocked(this.x, this.y);
        return false;
      }
      if (this.beamFried > 0.5) return false;
      this.beamFried = seconds;
      g.onBeamFried();
      return true;
    }

    startCrash() {
      this.crash = { t: 0, spin: 0, landed: false, vx: this.vx * 0.5 + U.rand(-80, 80), vy: -160 };
      this.alive = false;
      this.game.audio.play("crash");
    }

    updateCrash(dt) {
      const c = this.crash;
      c.t += dt;
      if (!c.landed) {
        c.vy += 700 * dt;
        this.x += c.vx * dt;
        this.y += c.vy * dt;
        c.spin += dt * 9;
        this.tilt = Math.sin(c.spin) * 0.6;
        if (Math.random() < 0.6) this.game.particles.smoke(this.x, this.y, 1, "rgba(60, 50, 70, 0.7)");
        if (this.y >= 600) {
          this.y = 600;
          c.landed = true;
          c.landT = c.t;
          this.game.onCrashLanded(this.x, this.y);
        }
      }
    }

    draw(ctx, t) {
      // Ground shadow, smaller the higher the saucer flies.
      const alt = U.clamp((this.y - U.UFO_MIN_Y) / (U.UFO_MAX_Y - U.UFO_MIN_Y), 0, 1);
      if (!this.crash || !this.crash.landed) U.Draw.shadow(ctx, this.x, 650, 30 + alt * 30, 0.12 + alt * 0.14);

      if (this.crash && this.crash.landed) {
        this.drawWreck(ctx, t);
        return;
      }
      // Blink while invulnerable.
      if (this.invuln > 0 && !this.crash && Math.floor(t * 16) % 2 === 0 && this.hurtFlash <= 0 && this.power.shield <= 0) {
        ctx.globalAlpha = 0.45;
      }
      const g = this.game;
      let mood = "normal";
      if (this.crash || this.stun > 0) mood = "dizzy";
      else if (this.hurtFlash > 0 || this.health === 1 || this.beamFried > 0) mood = "worried";
      else if (this.cheer > 0) mood = "happy";
      U.Art.drawUFO(ctx, this.x, this.y + Math.sin(t * 3) * 3, {
        t,
        tilt: this.tilt,
        flash: this.hurtFlash > 0 && Math.floor(t * 20) % 2 === 0,
        mood,
        look: this.vx / BASE_SPEED,
        beam: g.beam.active,
        cheer: this.cheer > 0,
      });
      ctx.globalAlpha = 1;

      if (this.beamFried > 0 || this.overload > 0) {
        // Broken beam: sparks crackling under the saucer.
        const seed = Math.floor(t * 20);
        const rnd = U.seeded(seed);
        ctx.strokeStyle = this.beamFried > 0 ? "#fff36b" : "#ff8a8a";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          let x = this.x + (rnd() - 0.5) * 40;
          let y = this.y + 18;
          ctx.moveTo(x, y);
          for (let k = 0; k < 4; k++) {
            x += (rnd() - 0.5) * 18;
            y += 6 + rnd() * 6;
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }
      if (this.stun > 0) U.Draw.dizzyStars(ctx, this.x, this.y - 52, 34, t);
      if (this.power.shield > 0) U.Art.drawShield(ctx, this.x, this.y, t, this.power.shield);
    }

    drawWreck(ctx, t) {
      const c = this.crash;
      const k = c.t - c.landT;
      // A dented saucer stuck in the ground, and the pilot floating away under a tiny parachute.
      U.Draw.shadow(ctx, this.x, 650, 60, 0.3);
      U.Art.drawUFO(ctx, this.x, 612, { t: 0, tilt: 0.35, mood: "dizzy", look: 0 });
      const px = this.x + 30 + k * 30;
      const py = 560 - Math.min(k, 1.2) * 260 + Math.max(0, k - 1.2) * 40;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.sin(t * 3) * 0.15);
      ctx.strokeStyle = U.Draw.OUT;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-20, -40);
      ctx.lineTo(0, 0);
      ctx.lineTo(20, -40);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -40, 26, Math.PI, U.TAU);
      ctx.closePath();
      ctx.fillStyle = "#ff5fb4";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.stroke();
      U.Draw.circ(ctx, 0, 2, 9, "#8dff5a", 2.5);
      U.Draw.eye(ctx, -3, 1, 2.5, 0, 0, "dizzy", t);
      U.Draw.eye(ctx, 3, 1, 2.5, 0, 0, "dizzy", t);
      ctx.restore();
    }
  }

  U.Player = Player;
  U.MAX_HEALTH = MAX_HEALTH;
})(window.UFO);
