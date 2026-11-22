/*
 * The environment: asteroids, solid structures, station arms, laser barriers, energy gates
 * and the eruptions and lightning that warn before they strike. All from one pool.
 */
(function (MQ) {
  const S = MQ.SPACE;
  const { clamp, glow, line, box, oval } = MQ.U;
  const { sin, cos, abs, hypot, max, min } = Math;

  const MAX = 150;
  const STRIKE_TIME = 0.65;
  const DAMAGE = { rock: 16, block: 16, arm: 18, barrier: 18, gate: 14, strike: 20 };
  const { top: TOP, bottom: BOTTOM } = S.FIELD;

  function segmentDistance(px, py, x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const k = clamp(((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return hypot(px - x0 - dx * k, py - y0 - dy * k);
  }

  // Whether an ellipse touches a rectangle.
  function touchesRect(x, y, rx, ry, left, top, right, bottom) {
    const dx = (x - clamp(x, left, right)) / rx;
    const dy = (y - clamp(y, top, bottom)) / ry;
    return dx * dx + dy * dy < 1;
  }

  class SpaceObstacle {
    constructor() {
      this.active = false;
      this.kind = "";
      this.style = "";
      this.x = this.y = this.w = this.h = this.vy = this.rx = this.ry = 0;
      this.hp = this.flash = this.age = this.angle = this.spin = this.seed = 0;
      this.baseY = this.amp = this.freq = this.gap = this.warn = this.drift = 0;
      this.fromTop = false;
      this.surface = false;
      this.world = null;
    }

    get hittable() {
      if (!this.active || this.x > MQ.VW - 8) return false;
      return (this.kind === "rock" && this.hp > 0) || (this.kind === "gate" && this.hp > 0);
    }

    get left() {
      return this.x;
    }

    get striking() {
      return this.age >= this.warn;
    }

    hurt(amount) {
      if (!this.hittable) return false;
      const { world } = this;
      this.hp -= amount;
      this.flash = 0.07;
      if (this.hp > 0) return true;
      this.hp = 0;
      world.particles.explosion(this.x, this.y, this.kind === "gate" ? 0.9 : clamp(this.rx / 50, 0.4, 1));
      if (this.kind === "rock") {
        world.particles.chunks(this.x, this.y, "#7a6a62", 8, 240);
        this.active = false;
        world.sfx("crumble");
        world.addPoints(40);
      } else {
        world.sfx("shipExplosion");
        world.addPoints(300, this.x, this.y);
      }
      return true;
    }

    update(dt) {
      const { world, kind } = this;
      this.age += dt;
      this.flash -= dt;
      if (kind === "strike") {
        if (this.drift) this.x -= world.speed * dt;
        if (this.age >= this.warn && this.age - dt < this.warn) {
          world.sfx(this.style === "lightning" ? "shipBurst" : "shipExplosion");
          world.shake(0.15);
        }
        if (this.age > this.warn + STRIKE_TIME || this.x < -80) this.active = false;
        return;
      }

      this.x -= (world.speed + this.drift) * dt;
      if (kind === "rock") {
        this.y += this.vy * dt;
        this.angle += this.spin * dt;
        if ((this.y < TOP + 24 && this.vy < 0) || (this.y > BOTTOM - 24 && this.vy > 0)) this.vy *= -1;
      } else if (kind === "arm") {
        this.angle += this.spin * dt;
      } else if (this.amp) {
        this.y = this.baseY + sin(this.age * this.freq) * this.amp;
      }
      const reach = kind === "block" ? this.w : kind === "arm" ? this.w + 30 : 70;
      if (this.x + reach < -20) this.active = false;
    }

    // Returns the damage for touching it, or 0.
    touch(x, y, rx, ry) {
      switch (this.kind) {
        case "rock": {
          const dx = (x - this.x) / (rx + this.rx * 0.85);
          const dy = (y - this.y) / (ry + this.ry * 0.85);
          return dx * dx + dy * dy < 1 ? DAMAGE.rock : 0;
        }
        case "block":
          return touchesRect(x, y, rx, ry, this.x + 4, this.y, this.x + this.w - 4, this.y + this.h) ? DAMAGE.block : 0;
        case "arm": {
          const ex = cos(this.angle) * this.w;
          const ey = sin(this.angle) * this.w;
          return segmentDistance(x, y, this.x - ex, this.y - ey, this.x + ex, this.y + ey) < this.h + (rx + ry) / 2 ? DAMAGE.arm : 0;
        }
        case "barrier":
          return abs(x - this.x) < rx + 7 && (y - ry < this.y - this.gap / 2 || y + ry > this.y + this.gap / 2) ? DAMAGE.barrier : 0;
        case "gate":
          return this.hp > 0 && abs(x - this.x) < rx + 6 ? DAMAGE.gate : 0;
        case "strike":
          return this.striking && abs(x - this.x) < rx * 0.7 + this.w / 2 && (this.fromTop ? y - ry < this.y : y + ry > this.y) ? DAMAGE.strike : 0;
      }
      return 0;
    }

    // Whether a shot at this point is stopped.
    blocks(x, y) {
      if (this.kind === "block") return x > this.x && x < this.x + this.w && y > this.y && y < this.y + this.h;
      if (this.kind === "rock" && this.hp <= 0) return hypot(x - this.x, y - this.y) < this.rx * 0.9;
      if (this.kind === "arm") return hypot(x - this.x, y - this.y) < 30;
      return false;
    }

    draw(ctx, time) {
      switch (this.kind) {
        case "rock":
          MQ.SpaceArt.rock(ctx, this.x, this.y, this.rx, this.angle, this.seed, this.style, this.hp <= 0, this.flash > 0);
          break;
        case "block":
          MQ.SpaceArt.block(ctx, this, time);
          break;
        case "arm":
          MQ.SpaceArt.arm(ctx, this, time);
          break;
        case "barrier":
          this.drawBarrier(ctx, time);
          break;
        case "gate":
          this.drawGate(ctx, time);
          break;
        case "strike":
          this.drawStrike(ctx, time);
      }
    }

    beam(ctx, top, bottom, color, time) {
      if (bottom <= top) return;
      const wobble = sin(time * 30 + this.seed) * 2;
      line(ctx, this.x, top, this.x, bottom, color, 14 + wobble, "butt");
      line(ctx, this.x, top, this.x, bottom, "#ffffff", 3, "butt");
    }

    drawBarrier(ctx, time) {
      const upper = this.y - this.gap / 2;
      const lower = this.y + this.gap / 2;
      this.beam(ctx, TOP, upper, "rgba(255,70,90,0.75)", time);
      this.beam(ctx, lower, BOTTOM, "rgba(255,70,90,0.75)", time);
      for (const y of [upper, lower]) {
        box(ctx, this.x - 15, y - 9, 30, 18, 4, "#39414b", MQ.INK, 2);
        glow(ctx, this.x, y, 24, "#ff465a", 0.7);
      }
    }

    drawGate(ctx, time) {
      const live = this.hp > 0;
      if (live) this.beam(ctx, TOP, BOTTOM, "rgba(255,190,70,0.65)", time);
      const color = this.flash > 0 ? "#ffffff" : live ? "#ffc84d" : "#4a4f57";
      oval(ctx, this.x, this.y, this.rx, this.ry, "#2c333c", color, 4);
      oval(ctx, this.x, this.y, 11, 11, color);
      if (live) glow(ctx, this.x, this.y, 46, "#ffc84d", 0.5 + sin(time * 9) * 0.2);
    }

    drawStrike(ctx, time) {
      const from = this.fromTop ? TOP : BOTTOM;
      const half = this.w / 2;
      const top = min(from, this.y);
      const height = abs(from - this.y);
      if (!this.striking) {
        const k = this.age / this.warn;
        ctx.fillStyle = `rgba(255,110,70,${0.08 + k * 0.17})`;
        ctx.fillRect(this.x - half, top, this.w, height);
        if ((time * 9) % 1 < 0.6) MQ.U.text(ctx, "!", this.x, this.fromTop ? from + 34 : from - 14, 30, "#ffd45c", "center", 800);
        glow(ctx, this.x, from, 30 + k * 50, this.style === "lightning" ? "#9fe8ff" : "#ff8a3d", 0.8);
        return;
      }
      const fade = max(0, 1 - ((this.age - this.warn) / STRIKE_TIME) ** 3);
      ctx.save();
      ctx.globalAlpha = fade;
      MQ.SpaceArt.strike(ctx, this, from, time);
      ctx.restore();
    }
  }

  class SpaceObstaclePool {
    constructor(world) {
      this.world = world;
      this.items = Array.from({ length: MAX }, () => new SpaceObstacle());
    }

    take(kind, x, y) {
      for (let i = 0; i < MAX; i++) {
        const o = this.items[i];
        if (o.active) continue;
        o.active = true;
        o.world = this.world;
        o.kind = kind;
        o.x = x;
        o.y = o.baseY = y;
        o.w = o.h = o.rx = o.ry = o.vy = o.hp = o.age = o.flash = o.angle = o.spin = o.drift = o.amp = o.freq = 0;
        o.fromTop = false;
        o.surface = false;
        o.style = "";
        o.seed = (i * 7919) % 997;
        return o;
      }
      return null;
    }

    // Big rocks can't be destroyed.
    rock(x, y, radius, options) {
      const o = this.take("rock", x, y);
      if (!o) return;
      o.rx = o.ry = radius;
      o.hp = radius > 46 ? 0 : radius * 1.1;
      o.vy = options.vy || 0;
      o.drift = options.drift || 0;
      o.spin = options.spin || 0.4;
      o.style = options.style || "stone";
    }

    block(x, y, w, h, style) {
      const o = this.take("block", x, y);
      if (!o) return null;
      o.w = w;
      o.h = h;
      o.style = style;
      return o;
    }

    arm(x, y, length, spin, angle) {
      const o = this.take("arm", x, y);
      if (!o) return;
      o.w = length;
      o.h = 12;
      o.spin = spin;
      o.angle = angle;
    }

    barrier(x, y, gap, amp, freq) {
      const o = this.take("barrier", x, y);
      if (!o) return;
      o.gap = gap;
      o.amp = amp;
      o.freq = freq;
    }

    gate(x, y, hp) {
      const o = this.take("gate", x, y);
      if (!o) return;
      o.rx = o.ry = 30;
      o.hp = hp;
      o.surface = y > 500;
    }

    strike(x, edge, width, warn, style, fromTop, drift) {
      const o = this.take("strike", x, edge);
      if (!o) return;
      o.w = width;
      o.warn = warn;
      o.style = style;
      o.fromTop = fromTop;
      o.drift = drift ? 1 : 0;
    }

    clear() {
      for (let i = 0; i < MAX; i++) this.items[i].active = false;
    }

    any() {
      for (let i = 0; i < MAX; i++) if (this.items[i].active) return true;
      return false;
    }

    update(dt) {
      for (let i = 0; i < MAX; i++) if (this.items[i].active) this.items[i].update(dt);
    }

    draw(ctx, time) {
      for (let i = 0; i < MAX; i++) if (this.items[i].active) this.items[i].draw(ctx, time);
    }
  }

  MQ.SpaceObstacle = SpaceObstacle;
  MQ.SpaceObstaclePool = SpaceObstaclePool;
})(window.MQ);
