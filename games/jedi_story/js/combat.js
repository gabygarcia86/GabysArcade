/*
 * The shared combat layer: Actor physics, Lightsaber drawing, pooled Projectiles,
 * and the Combat helpers that decide what happens when something gets hit.
 */
(function (J) {
  const { clamp, rand, overlap } = J.U;

  J.PHYS = {
    GRAVITY: 1800,
    MAX_FALL: 900,
    RUN: 250,
    JUMP: 640,
    DOUBLE_JUMP: 570,
  };

  // Anything that walks, falls and lands. x is the center, y is the feet.
  class Actor {
    constructor(x, y, w, h) {
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.vx = 0;
      this.vy = 0;
      this.facing = 1;
      this.onGround = false;
      this.ground = null;
      this.hitWall = 0;
    }

    get box() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
    get cx() { return this.x; }
    get cy() { return this.y - this.h / 2; }

    physics(level, dt, gravityScale = 1) {
      // Ride whatever is underfoot before working out this frame's own movement.
      if (this.ground && this.ground.mover && this.ground.active) {
        this.x += this.ground.dx;
        this.y = this.ground.y;
      }
      this.vy = Math.min(this.vy + J.PHYS.GRAVITY * gravityScale * dt, J.PHYS.MAX_FALL);

      this.hitWall = 0;
      this.x += this.vx * dt;
      const halfW = this.w / 2;
      const near = level.near(this.x - halfW - 32, this.x + halfW + 32);
      for (let i = 0; i < near.length; i++) {
        const s = near[i];
        if (s.oneway || !s.active) continue;
        if (this.x + halfW > s.x && this.x - halfW < s.x + s.w && this.y > s.y + 1 && this.y - this.h < s.y + s.h) {
          if (this.x < s.x + s.w / 2) {
            this.x = s.x - halfW;
            this.hitWall = 1;
          } else {
            this.x = s.x + s.w + halfW;
            this.hitWall = -1;
          }
          this.vx = 0;
        }
      }

      const before = this.y;
      this.y += this.vy * dt;
      this.onGround = false;
      this.ground = null;
      for (let i = 0; i < near.length; i++) {
        const s = near[i];
        if (!s.active || this.x + halfW <= s.x || this.x - halfW >= s.x + s.w) continue;
        if (s.oneway) {
          const top = s.y - (s.dy || 0);
          if (this.vy >= 0 && !this.dropThrough && before <= top + 6 && this.y >= s.y) this.land(s);
        } else if (this.y > s.y && this.y - this.h < s.y + s.h) {
          if (this.vy >= 0 && before <= s.y + 12) {
            this.land(s);
          } else if (this.vy < 0) {
            this.y = s.y + s.h + this.h;
            this.vy = 0;
          }
        }
      }
    }

    land(platform) {
      this.y = platform.y;
      if (this.vy > 0) this.vy = 0;
      this.onGround = true;
      this.ground = platform;
      if (platform.onStand) platform.onStand();
    }
  }

  // ---------- Lightsabers ----------

  const COLORS = {
    blue: { name: "Blue", blade: "#3d9bff", glow: "61,155,255" },
    green: { name: "Green", blade: "#3bea5c", glow: "59,234,92" },
    purple: { name: "Purple", blade: "#b45cff", glow: "180,92,255" },
    yellow: { name: "Yellow", blade: "#ffe23d", glow: "255,226,61" },
    cyan: { name: "Cyan", blade: "#2df0ee", glow: "45,240,238" },
    orange: { name: "Orange", blade: "#ff9326", glow: "255,147,38" },
    white: { name: "White", blade: "#f1f6ff", glow: "225,235,255" },
    red: { name: "Red", blade: "#ff2f2f", glow: "255,47,47" },
    rainbow: { name: "Rainbow", blade: "#ff5ad0", glow: "255,120,220", rainbow: true },
  };

  class Lightsaber {
    constructor(colorKey = "blue", type = "single") {
      this.colorKey = colorKey;
      this.type = type;
      this.spec = COLORS[colorKey] || COLORS.blue;
      this.length = 46;
      this.power = 1; // 0..1 as it ignites
    }

    // The color used by this moment's sparks, waves and trails.
    fxColor(t = performance.now() / 1000) {
      return this.spec.rainbow ? `hsl(${(t * 220) % 360},100%,62%)` : this.spec.blade;
    }

    fxPick() {
      return this.spec.rainbow ? `hsl(${rand(360)},100%,62%)` : this.spec.blade;
    }

    drawBlade(ctx, x0, y0, x1, y1, t) {
      const lengthScale = this.power;
      if (lengthScale <= 0.01) return;
      const x = x0 + (x1 - x0) * lengthScale;
      const y = y0 + (y1 - y0) * lengthScale;
      let color;
      if (this.spec.rainbow) {
        const g = ctx.createLinearGradient(x0, y0, x, y);
        for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsl(${(i * 60 + t * 260) % 360},100%,60%)`);
        color = g;
      } else {
        color = this.spec.blade;
      }
      const pulse = 1 + Math.sin(t * 34) * 0.06;
      ctx.lineCap = "round";
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = color;
      for (const [width, alpha] of [[13, 0.1], [9, 0.18], [6, 0.42]]) {
        ctx.globalAlpha = alpha;
        ctx.lineWidth = width * pulse;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = this.colorKey === "white" ? "#fff" : "#fdfeff";
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    draw(ctx, x, y, angle, t, scale = 1) {
      const dx = Math.sin(angle);
      const dy = Math.cos(angle);
      const length = this.length * scale;
      ctx.lineCap = "butt";
      const half = this.type === "double" ? 9 : 6;
      ctx.lineWidth = 3.6;
      ctx.strokeStyle = "#20242c";
      ctx.beginPath();
      ctx.moveTo(x - dx * half, y - dy * half);
      ctx.lineTo(x + dx * half, y + dy * half);
      ctx.stroke();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = "#b9c2cc";
      ctx.beginPath();
      ctx.moveTo(x - dx * (half - 1), y - dy * (half - 1));
      ctx.lineTo(x + dx * (half - 1), y + dy * (half - 1));
      ctx.stroke();
      this.drawBlade(ctx, x + dx * half, y + dy * half, x + dx * (half + length), y + dy * (half + length), t);
      if (this.type === "double") {
        this.drawBlade(ctx, x - dx * half, y - dy * half, x - dx * (half + length), y - dy * (half + length), t);
      }
    }
  }

  Lightsaber.COLORS = COLORS;

  // A plain red blade for the Sith, drawn the same way as the player's.
  const SITH_BLADE = new Lightsaber("red");

  // ---------- Projectiles ----------

  class Projectile {
    constructor() { this.alive = false; }

    reset(game, o) {
      this.alive = true;
      this.game = game;
      this.kind = o.kind || "bolt"; // bolt | orb | rock | saber | spark
      this.x = o.x;
      this.y = o.y;
      this.vx = o.vx;
      this.vy = o.vy || 0;
      this.r = o.r || (this.kind === "bolt" ? 4 : 9);
      this.dmg = o.dmg || 8;
      this.friendly = !!o.friendly;
      this.color = o.color || "#ff4040";
      this.life = o.life || 3;
      this.age = 0;
      this.owner = o.owner || null;
      this.homing = o.homing || 0;
      this.gravity = o.gravity || 0;
      this.deflectable = o.deflectable !== false;
      this.pushable = !!o.pushable;
      this.pierce = !!o.pierce; // Passes through walls
      this.returns = o.returns || 0; // Boomerang strength
      this.perfect = false;
      this.spin = 0;
      this.onDie = o.onDie || null;
    }

    get angle() { return Math.atan2(this.vy, this.vx); }

    update(dt) {
      const { game } = this;
      this.age += dt;
      this.life -= dt;
      this.spin += dt * 16;
      if (this.life <= 0) return this.kill(false);

      if (this.homing) {
        const target = this.friendly ? Combat.nearestEnemy(game, this.x, this.y, 900) : game.player;
        if (target) {
          const a = Math.atan2(target.cy - this.y, target.cx - this.x);
          const speed = Math.hypot(this.vx, this.vy);
          const current = this.angle;
          let d = a - current;
          while (d > Math.PI) d -= J.TAU;
          while (d < -Math.PI) d += J.TAU;
          const turn = clamp(d, -this.homing * dt, this.homing * dt);
          this.vx = Math.cos(current + turn) * speed;
          this.vy = Math.sin(current + turn) * speed;
        }
      }
      if (this.returns && this.owner) {
        const dx = this.owner.cx - this.x;
        const dy = this.owner.cy - this.y;
        const d = Math.hypot(dx, dy) || 1;
        this.vx += (dx / d) * this.returns * dt;
        this.vy += (dy / d) * this.returns * dt;
        if (this.age > 0.6 && d < 34) return this.kill(false);
      }
      this.vy += this.gravity * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      if (!this.pierce && game.level.pointSolid(this.x, this.y)) {
        game.particles.sparks(this.x, this.y, this.color, 5, 130);
        if (this.kind === "rock") game.particles.dust(this.x, this.y, "rgba(120,110,100,.7)", 8);
        return this.kill(true);
      }

      const hit = { x: this.x - this.r, y: this.y - this.r, w: this.r * 2, h: this.r * 2 };
      if (this.friendly) {
        for (const enemy of game.enemies) {
          if (enemy.dead || enemy.dormant || !overlap(hit, enemy.box)) continue;
          enemy.takeHit({ dmg: this.dmg, dir: Math.sign(this.vx) || 1, knock: 170, source: "bolt", stun: 0.3 });
          game.particles.sparks(this.x, this.y, this.color, 8, 200);
          return this.kill(true);
        }
        const { boss } = game;
        if (boss && boss.targetable && overlap(hit, boss.box)) {
          boss.takeHit({ dmg: this.dmg, dir: Math.sign(this.vx) || 1, source: "bolt" });
          game.particles.sparks(this.x, this.y, this.color, 8, 200);
          return this.kill(true);
        }
      } else if (overlap(hit, game.player.box) && !game.player.dead) {
        const outcome = game.player.receiveProjectile(this);
        if (outcome === "deflected") return undefined;
        if (outcome === "hit") {
          game.particles.sparks(this.x, this.y, this.color, 6, 160);
          return this.kill(true);
        }
      }
      return undefined;
    }

    kill(impact) {
      this.alive = false;
      if (this.onDie) this.onDie(this, impact);
    }

    // Sends the shot back the way it came, or at a target when aimed.
    reflect(target, perfect) {
      this.friendly = true;
      this.perfect = perfect;
      this.age = 0;
      this.life = 2.2;
      this.pierce = false;
      this.returns = 0;
      const speed = Math.max(Math.hypot(this.vx, this.vy) * 1.2, 560);
      if (target) {
        const a = Math.atan2(target.cy - this.y, target.cx - this.x);
        this.vx = Math.cos(a) * speed;
        this.vy = Math.sin(a) * speed;
      } else {
        const dir = -Math.sign(this.vx) || 1;
        const a = rand(-0.5, 0.35);
        this.vx = Math.cos(a) * speed * dir;
        this.vy = Math.sin(a) * speed;
      }
      this.dmg = Math.max(this.dmg, 10) * (perfect ? 2.2 : 1.2);
    }

    draw(ctx, t) {
      ctx.save();
      ctx.translate(this.x, this.y);
      if (this.kind === "bolt") {
        ctx.rotate(this.angle);
        ctx.lineCap = "round";
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = this.friendly && this.color === "#ff4040" ? "#ffb060" : this.color;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(-15, 0);
        ctx.lineTo(9, 0);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-13, 0);
        ctx.lineTo(8, 0);
        ctx.stroke();
      } else if (this.kind === "orb") {
        const pulse = this.r + Math.sin(t * 16) * 1.6;
        ctx.globalCompositeOperation = "lighter";
        const g = ctx.createRadialGradient(0, 0, 1, 0, 0, pulse * 2.2);
        g.addColorStop(0, "#fff");
        g.addColorStop(0.35, this.color);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, pulse * 2.2, 0, J.TAU);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      } else if (this.kind === "rock") {
        ctx.rotate(this.spin * 0.4);
        ctx.fillStyle = "#5b5450";
        ctx.strokeStyle = "#1c1a18";
        ctx.lineWidth = 2;
        ctx.beginPath();
        const r = this.r;
        ctx.moveTo(-r, -r * 0.5);
        ctx.lineTo(-r * 0.2, -r);
        ctx.lineTo(r, -r * 0.5);
        ctx.lineTo(r * 0.8, r * 0.7);
        ctx.lineTo(-r * 0.4, r);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (this.kind === "saber") {
        ctx.rotate(this.spin);
        SITH_BLADE.length = 40;
        SITH_BLADE.type = this.doubleBlade ? "double" : "single";
        SITH_BLADE.draw(ctx, 0, 0, 0, t);
        SITH_BLADE.type = "single";
        SITH_BLADE.length = 46;
      }
      ctx.restore();
    }
  }

  class ProjectilePool {
    constructor(game, size = 90) {
      this.game = game;
      this.items = Array.from({ length: size }, () => new Projectile());
    }

    fire(o) {
      const p = this.items.find((item) => !item.alive);
      if (!p) return null;
      p.reset(this.game, o);
      p.doubleBlade = !!o.doubleBlade;
      return p;
    }

    update(dt) {
      for (const p of this.items) if (p.alive) p.update(dt);
    }

    draw(ctx, t) {
      for (const p of this.items) if (p.alive) p.draw(ctx, t);
    }

    clear() {
      for (const p of this.items) p.alive = false;
    }

    clearHostile() {
      for (const p of this.items) if (!p.friendly) p.alive = false;
    }
  }

  // ---------- Combat rules ----------

  const Combat = {
    nearestEnemy(game, x, y, range) {
      let best = null;
      let bestDist = range;
      for (const enemy of game.enemies) {
        if (enemy.dead || enemy.dormant) continue;
        const d = Math.hypot(enemy.cx - x, enemy.cy - y);
        if (d < bestDist) {
          best = enemy;
          bestDist = d;
        }
      }
      const { boss } = game;
      if (boss && boss.targetable && Math.hypot(boss.cx - x, boss.cy - y) < bestDist) best = boss;
      return best;
    },

    // Applies one saber swing to everything in the box. Each target is hit once per swing.
    saberSweep(game, box, attack, struck) {
      let any = false;
      for (const enemy of game.enemies) {
        if (enemy.dead || enemy.dormant || struck.has(enemy) || !overlap(box, enemy.box)) continue;
        struck.add(enemy);
        enemy.takeHit(attack);
        any = true;
      }
      const { boss } = game;
      if (boss && boss.targetable && !struck.has(boss) && overlap(box, boss.box)) {
        struck.add(boss);
        boss.takeHit(attack);
        any = true;
      }
      for (const prop of game.level.breakables) {
        if (prop.broken || struck.has(prop) || !prop.saberable || !overlap(box, prop)) continue;
        struck.add(prop);
        prop.smash(game);
        any = true;
      }
      return any;
    },
  };

  J.Actor = Actor;
  J.Lightsaber = Lightsaber;
  J.Projectile = Projectile;
  J.ProjectilePool = ProjectilePool;
  J.Combat = Combat;
})(window.JEDI);
