/* Pooled projectiles: bolts, homing darts, rockets, waves, shockwaves and lobbed shots. */
(function (MQ) {
  const { glow, line, oval, poly, clamp, alpha } = MQ.U;
  const { hypot, atan2, sin, cos, max, ceil, PI, abs } = Math;
  const CAPACITY = 220;
  const HIT_MEMORY = 10;
  const SUBSTEP = 14;

  const PLAYER = 0;
  const ENEMY = 1;

  class ProjectileManager {
    constructor(world) {
      this.world = world;
      this.items = Array.from({ length: CAPACITY }, () => ({
        active: false, kind: "bolt", team: PLAYER, x: 0, y: 0, vx: 0, vy: 0, r: 4, damage: 0, life: 0, color: "#fff",
        gravity: 0, pierce: 0, blast: 0, knock: 0, age: 0, target: null, hits: new Array(HIT_MEMORY).fill(null), hitCount: 0,
      }));
      this.cursor = 0;
    }

    /*
     * Takes a free slot, resets it and returns it for optional tweaks. If the pool is
     * full, the oldest slot in the rotation is reused.
     */
    fire(team, kind, x, y, vx, vy, damage, color, life = 2.5) {
      let p = this.items[this.cursor];
      for (let i = 0; i < CAPACITY; i++) {
        const candidate = this.items[(this.cursor + i) % CAPACITY];
        if (!candidate.active) {
          p = candidate;
          this.cursor = (this.cursor + i) % CAPACITY;
          break;
        }
      }
      this.cursor = (this.cursor + 1) % CAPACITY;
      p.active = true;
      p.team = team;
      p.kind = kind;
      p.x = x;
      p.y = y;
      p.vx = vx;
      p.vy = vy;
      p.damage = damage;
      p.color = color;
      p.life = life;
      p.r = team === PLAYER ? 7 : 5;
      p.gravity = 0;
      p.pierce = 0;
      p.blast = 0;
      p.knock = 60;
      p.age = 0;
      p.target = null;
      p.hits.fill(null);
      p.hitCount = 0;
      return p;
    }

    /*
     * Carries a new shot from where it was fired to (x, y), colliding on the way. Shots
     * leave from the muzzle but still hit a wall or enemy between the body and the barrel.
     */
    advance(p, x, y) {
      const dx = x - p.x;
      const dy = y - p.y;
      const steps = ceil(hypot(dx, dy) / SUBSTEP) || 1;
      for (let s = 0; s < steps && p.active; s++) {
        p.x += dx / steps;
        p.y += dy / steps;
        this.collide(p);
      }
      return p;
    }

    clear(team) {
      for (const p of this.items) {
        if (team === undefined || p.team === team) {
          p.active = false;
          p.target = null;
        }
      }
    }

    threatens(body, distance) {
      for (let i = 0; i < CAPACITY; i++) {
        const p = this.items[i];
        if (!p.active || p.team !== PLAYER) continue;
        const dx = body.x - p.x;
        if (abs(dx) < distance && dx * p.vx > 0 && p.y > body.y - body.h - 20 && p.y < body.y + 20) return true;
      }
      return false;
    }

    // Force Push sends small shots back where they came from.
    deflect(x, y, radius) {
      for (let i = 0; i < CAPACITY; i++) {
        const p = this.items[i];
        if (!p.active || p.team !== ENEMY || p.kind === "shock") continue;
        if (hypot(p.x - x, p.y - y) > radius) continue;
        p.team = PLAYER;
        p.vx *= -1.4;
        p.vy *= -1.4;
        p.damage *= 1.5;
        p.color = "#7fd4ff";
        p.r = 8;
        p.life = max(p.life, 1);
      }
    }

    // Blades knock down shots inside their arc.
    cut(left, top, right, bottom) {
      for (let i = 0; i < CAPACITY; i++) {
        const p = this.items[i];
        if (!p.active || p.team !== ENEMY || p.kind === "shock" || p.kind === "slash") continue;
        if (p.x > left && p.x < right && p.y > top && p.y < bottom) {
          p.active = false;
          this.world.particles.sparks(p.x, p.y, "#fff3c0", 6);
        }
      }
    }

    update(dt) {
      for (let i = 0; i < CAPACITY; i++) {
        if (this.items[i].active) this.step(this.items[i], dt);
      }
    }

    step(p, dt) {
      const { world } = this;
      p.age += dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.stop(p);
        return;
      }
      if (p.kind === "bird") this.steer(p, dt);
      p.vy += p.gravity * dt;

      if (p.kind === "rocket" || p.kind === "bird") {
        if (Math.random() < dt * 70) world.particles.smoke(p.x, p.y, p.kind === "rocket" ? "#b8b0a8" : "#e8d8a0", 1, 4);
      }

      const steps = ceil(hypot(p.vx, p.vy) * dt / SUBSTEP) || 1;
      for (let s = 0; s < steps && p.active; s++) {
        p.x += (p.vx * dt) / steps;
        p.y += (p.vy * dt) / steps;
        this.collide(p);
      }
    }

    steer(p, dt) {
      const { targets } = this.world;
      if (!p.target?.hittable) {
        p.target = null;
        let best = 720;
        for (let i = 0; i < targets.length; i++) {
          const t = targets[i];
          if (!t.hittable) continue;
          // Darts prefer enemies that no other dart has taken.
          const d = hypot(t.x - p.x, t.y - t.h / 2 - p.y) + (t.claimed === this.world.step ? 220 : 0);
          if (d < best) {
            best = d;
            p.target = t;
          }
        }
        if (p.target) p.target.claimed = this.world.step;
      }
      if (!p.target || p.age < 0.08) return;
      const wanted = atan2(p.target.y - p.target.h / 2 - p.y, p.target.x - p.x);
      const current = atan2(p.vy, p.vx);
      let turn = wanted - current;
      if (turn > PI) turn -= MQ.TAU;
      if (turn < -PI) turn += MQ.TAU;
      const angle = current + clamp(turn, -8 * dt, 8 * dt);
      const speed = hypot(p.vx, p.vy);
      p.vx = cos(angle) * speed;
      p.vy = sin(angle) * speed;
    }

    collide(p) {
      const { world } = this;

      if (p.kind === "shock") {
        if (world.col.insideSolid(p.x, p.y - 14)) {
          p.active = false;
          return;
        }
        if (MQ.touches(world.player, p.x - 18, p.y - p.r, p.x + 18, p.y) && world.hurtPlayer(p.damage, p.x - p.vx, 300)) p.active = false;
        return;
      }

      if (p.team === PLAYER) {
        const { targets } = world;
        for (let i = 0; i < targets.length; i++) {
          const t = targets[i];
          if (!t.hittable || !MQ.nearBody(t, p.x, p.y, p.r) || p.hits.includes(t.owner || t)) continue;
          if (p.blast) {
            this.stop(p);
            return;
          }
          p.hits[p.hitCount++ % HIT_MEMORY] = t.owner || t;
          t.hurt(p.damage, p.x - p.vx, p.knock, p.kind);
          world.particles.sparks(p.x, p.y, p.color, 7);
          world.sfx("hit");
          if (p.pierce > 0) {
            p.pierce--;
          } else {
            p.active = false;
            return;
          }
        }
      } else if (MQ.nearBody(world.player, p.x, p.y, p.r)) {
        if (p.blast) {
          if (!world.player.invulnerable) this.stop(p);
        } else if (world.hurtPlayer(p.damage, p.x - p.vx, 180)) {
          if (p.kind === "ion") world.player.disrupt();
          if (p.kind === "web") world.player.slow();
          world.particles.sparks(p.x, p.y, p.color, 8);
          p.active = false;
          return;
        }
      }

      // Sword waves pass through scenery.
      if (p.kind === "slash") return;
      const solid = world.col.insideSolid(p.x, p.y);
      if (!solid) return;
      if (p.team === PLAYER && solid.hurt && !p.blast) solid.hurt(p.damage, p.x, 0, p.kind);
      if (!p.blast) world.particles.sparks(p.x, p.y, p.color, 5, 220);
      this.stop(p);
    }

    stop(p) {
      p.active = false;
      p.target = null;
      if (p.blast) this.world.blast(p.x, p.y, p.blast, p.damage, p.team);
    }

    draw(ctx, camera) {
      ctx.lineCap = "round";
      for (let i = 0; i < CAPACITY; i++) {
        const p = this.items[i];
        if (p.active && camera.sees(p.x, p.y, 90)) this.drawOne(ctx, p);
      }
    }

    drawOne(ctx, p) {
      const { x, y, color } = p;
      const speed = hypot(p.vx, p.vy) || 1;
      const ux = p.vx / speed;
      const uy = p.vy / speed;

      switch (p.kind) {
        case "bolt":
        case "ion": {
          const length = p.r > 7 ? 30 : 22;
          glow(ctx, x - ux * 6, y - uy * 6, 20, color, 0.7);
          line(ctx, x - ux * length, y - uy * length, x, y, color, p.r > 7 ? 7 : 5);
          line(ctx, x - ux * length * 0.6, y - uy * length * 0.6, x, y, "#ffffff", 2);
          break;
        }
        case "lance":
          glow(ctx, x, y, 34, color, 0.9);
          line(ctx, x - ux * 110, y - uy * 110, x, y, alpha(color, 0.4), 11);
          line(ctx, x - ux * 80, y - uy * 80, x, y, "#ffffff", 3);
          break;
        case "bird":
          glow(ctx, x, y, 16, color, 0.8);
          poly(ctx, [x + ux * 7, y + uy * 7, x - ux * 6 - uy * 4, y - uy * 6 + ux * 4, x - ux * 6 + uy * 4, y - uy * 6 - ux * 4], "#fff1b8");
          break;
        case "rocket":
          line(ctx, x - ux * 16, y - uy * 16, x, y, "#c9d0d6", 7);
          line(ctx, x - ux * 2, y - uy * 2, x + ux * 5, y + uy * 5, "#d63a3a", 6);
          glow(ctx, x - ux * 18, y - uy * 18, 24, "#ff9a30", 0.9);
          break;
        case "grenade":
          oval(ctx, x, y, 8, 8, "#3c434b", MQ.INK, 2);
          oval(ctx, x, y, 3, 3, sin(p.age * 30) > 0 ? "#ff5348" : "#5a2020");
          glow(ctx, x, y, 18, "#ff5348", 0.4);
          break;
        case "slash": {
          const s = p.r * 1.3;
          glow(ctx, x, y, s * 1.8, color, 0.7);
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(atan2(uy, ux));
          poly(ctx, [-s * 0.3, -s, s * 0.35, -s * 0.5, s * 0.6, 0, s * 0.35, s * 0.5, -s * 0.3, s, s * 0.1, 0], "#101015", color, 3);
          ctx.restore();
          break;
        }
        case "shock":
          glow(ctx, x, y - 12, 36, color, 0.6);
          for (let i = -1; i <= 1; i++) {
            const height = p.r * (i ? 0.55 : 1) * (0.85 + sin(p.age * 30 + i) * 0.15);
            poly(ctx, [x + i * 16 - 10, y, x + i * 16, y - height, x + i * 16 + 10, y], color);
          }
          break;
        case "rock":
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(p.age * 8);
          poly(ctx, [-p.r, -2, -p.r * 0.3, -p.r, p.r, -p.r * 0.4, p.r * 0.7, p.r * 0.8, -p.r * 0.5, p.r], color, MQ.INK, 2);
          ctx.restore();
          break;
        default: // Spit, webs and other globs.
          glow(ctx, x, y, p.r * 3, color, 0.6);
          oval(ctx, x, y, p.r + sin(p.age * 25), p.r, color);
          line(ctx, x, y, x - ux * p.r * 2, y - uy * p.r * 2, color, p.r);
      }
    }
  }

  ProjectileManager.PLAYER = PLAYER;
  ProjectileManager.ENEMY = ENEMY;
  MQ.ProjectileManager = ProjectileManager;
})(window.MQ);
