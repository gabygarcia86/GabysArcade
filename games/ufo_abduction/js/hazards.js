/*
 * Hazards: things that hurt the saucer, chase it, throw things at it, or punish you for
 * trying to beam them up. Each hazard checks its own contact with the saucer and decides
 * the effect (damage, stun, or a fried beam). Beaming a "beamable" hazard is handled in
 * game.js, which calls beamPenalty() after a short grace period.
 */
(function (U) {
  "use strict";

  const C = U.Collision;

  class Hazard {
    constructor(game, key, name) {
      this.game = game;
      this.key = key;
      this.name = name;
      this.t = 0;
      this.dead = false;
      this.facing = 1;
      this.beamable = false;
      this.beamGrace = 0.55;
      this.beamContact = 0;
      this.ground = true;
      this.phase = 0;
      this.spin = 0;
      this.shout = 0;
      this.shoutText = "";
      this.moving = false;
      this.cd = U.rand(1, 2.5);
      this.alpha = 1;
    }

    get rate() {
      return this.game.diff.hazardRate;
    }

    get speedMul() {
      return this.game.diff.hazardSpeed;
    }

    update(dt) {
      this.t += dt;
      this.shout = Math.max(0, this.shout - dt);
      this.cd -= dt;
    }

    yell(text, time = 1.4) {
      this.shoutText = text;
      this.shout = time;
    }

    onScreen(margin = 80) {
      const g = this.game;
      return this.x > g.camX - margin && this.x < g.camX + g.VW + margin;
    }

    // The rectangle that counts for the beam penalty, or null when it doesn't apply.
    bodyRect() {
      return null;
    }

    threat() {
      const p = this.game.player;
      return p.alive && Math.abs(p.x - this.x) < 300 && p.y > 260;
    }

    warnY() {
      return this.groundY - 120;
    }

    onBeamed() {
      this.yell(U.pick(["HEY!", "PUT ME DOWN!", "NOPE!", "HANDS OFF!"]), 1);
    }

    // Drives back and forth around `home`, turning at the ends of its patrol.
    patrol(dt, speed, span) {
      if (this.x < this.home - span || this.x < 80) this.dir = 1;
      if (this.x > this.home + span || this.x > U.WORLD_W - 80) this.dir = -1;
      this.vx = this.dir * speed * this.speedMul;
      this.x += this.vx * dt;
      this.facing = this.dir;
      this.spin += (this.vx * dt) / 14;
      this.moving = true;
    }

    // Elevation angle from (x, y) to the saucer, measured toward the side it's facing.
    aimAt(x, y) {
      const p = this.game.player;
      return Math.atan2(y - p.y, Math.abs(p.x - x));
    }

    // Lobs a projectile from (x, y) so it lands where the saucer is heading.
    lob(kind, x, y, time, gravity, r, effect = "damage") {
      const p = this.game.player;
      const tx = p.x + p.vx * time * 0.45;
      const ty = p.y + p.vy * time * 0.3;
      const v = U.lob(x, y, tx, ty, time, gravity);
      this.game.projectiles.spawn({ kind, x, y, vx: v.vx, vy: v.vy, g: gravity, r, effect, life: time + 2, owner: this.name });
      if (this.onScreen()) this.game.audio.play("throw");
    }

    // Fires straight at the saucer.
    shoot(kind, x, y, speed, r, effect = "damage", spread = 0, gravity = 0) {
      const p = this.game.player;
      const a = Math.atan2(p.y - y, p.x - x) + spread;
      this.game.projectiles.spawn({ kind, x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - gravity * 0.3, g: gravity, r, effect, life: 4, owner: this.name });
    }
  }

  // ---------------------------------------------------------------- Ground hazards

  class Bull extends Hazard {
    constructor(game, x, y) {
      super(game, "bull", "Angry Bull");
      this.x = x;
      this.groundY = y;
      this.y = y;
      this.home = x;
      this.lift = 0;
      this.vy = 0;
      this.vx = 0;
      this.charging = false;
      this.snort = 0;
      this.goalX = x;
      this.decide = 0;
      this.beamable = true;
    }

    update(dt) {
      super.update(dt);
      const p = this.game.player;
      const dx = p.x - this.x;
      const low = p.alive && p.y > 300;
      this.snort = Math.max(0, this.snort - dt);

      if (this.lift > 0 || this.vy !== 0) {
        this.vy += 1500 * dt;
        this.lift -= this.vy * dt;
        if (this.lift <= 0) {
          this.lift = 0;
          this.vy = 0;
          if (this.onScreen()) {
            this.game.audio.play("stomp");
            this.game.particles.smoke(this.x, this.groundY, 5, "rgba(200, 170, 120, 0.7)");
          }
        }
      }

      // A charge is a pass: paw the ground, run through under the saucer (leaping once
      // if it's flying low), then stop and turn around. It never parks under the beam.
      this.stateT = (this.stateT || 0) - dt;
      const mode = this.mode || "wander";
      if (mode === "wander") {
        this.charging = false;
        this.decide -= dt;
        if (this.decide <= 0) {
          this.decide = U.rand(1.5, 3.5);
          this.goalX = U.clamp(this.home + U.rand(-300, 300), 80, U.WORLD_W - 80);
        }
        const gap = this.goalX - this.x;
        this.vx = Math.abs(gap) > 8 ? Math.sign(gap) * 55 * this.speedMul : 0;
        if (low && Math.abs(dx) < 340 && Math.abs(dx) > 120 && this.cd <= 0) {
          this.mode = "paw";
          this.stateT = 0.8;
          this.snort = 1.2;
          this.facing = Math.sign(dx) || 1;
          if (this.onScreen()) this.game.audio.play("snort");
        }
      } else if (mode === "paw") {
        this.charging = true;
        this.vx = 0;
        this.facing = Math.sign(dx) || this.facing;
        if (this.stateT <= 0) {
          this.mode = "charge";
          this.chargeDir = this.facing;
          this.stateT = 1.8;
          this.leapt = false;
        }
      } else if (mode === "charge") {
        this.charging = true;
        this.vx = this.chargeDir * 270 * this.speedMul;
        if (!this.leapt && low && Math.abs(dx) < 80 && this.lift === 0) {
          this.leapt = true;
          this.vy = -760;
          this.yell("MOOOVE!", 0.8);
        }
        const passed = Math.sign(this.x - p.x) === this.chargeDir && Math.abs(dx) > 160;
        if (this.stateT <= 0 || passed || this.x <= 61 || this.x >= U.WORLD_W - 61) {
          this.mode = "wander";
          this.cd = 2.2 / this.rate;
          this.decide = 0.8;
          this.goalX = this.x;
        }
      }
      this.x = U.clamp(this.x + this.vx * dt, 60, U.WORLD_W - 60);
      if (Math.abs(this.vx) > 3) this.facing = Math.sign(this.vx);
      this.moving = Math.abs(this.vx) > 3;
      this.phase += dt * (5 + Math.abs(this.vx) * 0.06);
      this.y = this.groundY - this.lift;

      if (this.lift > 20 && C.ufoRect(p, this.x - 44, this.y - 86, 88, 86)) p.damage(this.name);
    }

    bodyRect() {
      return { x: this.x - 44, y: this.y - 86, w: 88, h: 86 };
    }

    threat() {
      return this.charging || super.threat();
    }

    warnY() {
      return this.y - 110;
    }

    draw(ctx, t) {
      U.Art.hazards.bull(ctx, this, t);
      if (this.shout > 0) U.Draw.bubble(ctx, this.x, this.y - 92, this.shoutText, { size: 15, color: "#c4352b" });
    }
  }

  class Tractor extends Hazard {
    constructor(game, x, y) {
      super(game, "tractor", "Tractor");
      this.x = x;
      this.groundY = y;
      this.home = x;
      this.dir = Math.random() < 0.5 ? -1 : 1;
      this.beamable = true;
    }

    update(dt) {
      super.update(dt);
      this.patrol(dt, 70, 520);
      const p = this.game.player;
      if (p.alive && this.cd <= 0 && Math.abs(p.x - this.x) < 560) {
        this.cd = 5.5 / this.rate;
        this.lob("hay", this.x + this.facing * 20, this.groundY - 96, 1.5, 480, 16);
        if (this.onScreen()) this.game.audio.play("honk");
      }
      if (this.onScreen() && Math.random() < dt * 5) this.game.particles.smoke(this.x + this.facing * 15, this.groundY - 92, 1, "rgba(80,80,90,0.6)");
      if (C.ufoRect(p, this.x - 60, this.groundY - 100, 120, 100)) p.damage(this.name);
    }

    bodyRect() {
      return { x: this.x - 60, y: this.groundY - 100, w: 120, h: 100 };
    }

    draw(ctx, t) {
      U.Art.hazards.tractor(ctx, this, t);
      if (this.shout > 0) U.Draw.bubble(ctx, this.x, this.groundY - 110, this.shoutText, { size: 15, color: "#c4352b" });
    }
  }

  class Fence extends Hazard {
    constructor(game, x, variant) {
      super(game, "fence", variant === "power" ? "Power Lines" : "Electric Fence");
      this.variant = variant || "farm";
      this.x = x;
      this.w = this.variant === "power" ? 170 : 190;
      this.groundY = U.FEET_MIN + 10;
      this.zapTop = this.groundY - (this.variant === "power" ? 280 : 215);
      this.period = 4.6;
      this.cycle = U.rand(0, this.period);
      this.charging = false;
      this.zapping = false;
      this.beamGrace = 0.25;
    }

    update(dt) {
      super.update(dt);
      const period = this.period / this.rate;
      const wasZapping = this.zapping;
      const wasCharging = this.charging;
      this.cycle = (this.cycle + dt) % (period + 0.9);
      this.zapping = this.cycle >= period;
      this.charging = !this.zapping && this.cycle >= period - 1.0;
      this.beamable = this.zapping;
      if (this.charging && !wasCharging && this.onScreen()) this.game.audio.play("crackle");
      if (this.zapping && !wasZapping && this.onScreen()) this.game.audio.play("zap");
      const p = this.game.player;
      if (this.zapping && C.ufoColumn(p, this.x, this.w / 2, this.zapTop, this.groundY)) p.damage(this.name);
    }

    bodyRect() {
      return this.zapping ? { x: this.x - this.w / 2, y: this.groundY - 120, w: this.w, h: 110 } : null;
    }

    threat() {
      const p = this.game.player;
      return (this.charging || this.zapping) && Math.abs(p.x - this.x) < this.w / 2 + 180;
    }

    warnY() {
      return this.groundY - 150;
    }

    onBeamed() {}

    draw(ctx, t) {
      U.Art.hazards.fence(ctx, this, t);
    }
  }

  class RocketLauncher extends Hazard {
    constructor(game, x, y) {
      super(game, "rocket", "Rocket Launcher");
      this.x = x;
      this.groundY = y;
      this.home = x;
      this.dir = Math.random() < 0.5 ? -1 : 1;
      this.aim = 0.6;
      this.beamable = true;
    }

    update(dt) {
      super.update(dt);
      const p = this.game.player;
      const dx = p.x - this.x;
      if (Math.abs(dx) > 260) this.patrol(dt, 40, 400);
      else this.moving = false;
      this.facing = Math.sign(dx) || 1;
      this.aim = U.damp(this.aim, U.clamp(this.aimAt(this.x - 22 * this.facing, this.groundY - 50), 0.2, 1.4), 4, dt);
      if (p.alive && this.cd <= 0 && Math.abs(dx) < 820) {
        this.cd = 4.4 / this.rate;
        const tipX = this.x + this.facing * (-22 + Math.cos(this.aim) * 56);
        const tipY = this.groundY - 50 - Math.sin(this.aim) * 56;
        const a = Math.atan2(-Math.sin(this.aim), this.facing * Math.cos(this.aim));
        const speed = 200 * this.speedMul;
        this.game.projectiles.spawn({ kind: "rocket", x: tipX, y: tipY, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, g: 0, r: 11, effect: "damage", life: 6.5, homing: 2.4, turn: 1.6, owner: this.name });
        if (this.onScreen()) this.game.audio.play("shoot");
        this.game.particles.smoke(tipX, tipY, 5, "rgba(230,230,230,0.7)");
      }
    }

    bodyRect() {
      return { x: this.x - 60, y: this.groundY - 90, w: 120, h: 90 };
    }

    draw(ctx, t) {
      U.Art.hazards.rocket(ctx, this, t);
      if (this.shout > 0) U.Draw.bubble(ctx, this.x, this.groundY - 110, this.shoutText, { size: 15, color: "#c4352b" });
    }
  }

  class GiantFarmer extends Hazard {
    constructor(game, x, y) {
      super(game, "giantFarmer", "Giant Angry Farmer");
      this.x = x;
      this.groundY = y;
      this.throwT = 0;
      this.beamable = true;
      this.vx = 0;
    }

    update(dt) {
      super.update(dt);
      this.throwT = Math.max(0, this.throwT - dt);
      const p = this.game.player;
      const dx = p.x - this.x;
      this.facing = Math.sign(dx) || 1;
      this.vx = Math.abs(dx) > 160 ? Math.sign(dx) * 40 * this.speedMul : 0;
      this.x = U.clamp(this.x + this.vx * dt, 80, U.WORLD_W - 80);
      this.moving = this.vx !== 0;
      const stepBefore = Math.floor(this.phase / Math.PI);
      this.phase += dt * 4;
      if (this.moving && Math.floor(this.phase / Math.PI) !== stepBefore && this.onScreen()) this.game.audio.play("stomp");
      if (p.alive && this.cd <= 0 && Math.abs(dx) < 650) {
        this.cd = 2.7 / this.rate;
        this.throwT = 0.4;
        const kind = U.pick(["tomato", "boot", "hay", "tomato"]);
        this.lob(kind, this.x + this.facing * 30, this.groundY - 210, 1.1, 600, kind === "hay" ? 16 : 13);
        if (Math.random() < 0.5) {
          this.yell(U.pick(["GET OFF MY LAND!", "SHOO!", "LEAVE MY COWS!", "GIT!"]));
          if (this.onScreen()) this.game.audio.play("grumble");
        }
      }
      if (C.ufoRect(p, this.x - 38, this.groundY - 232, 76, 232)) p.damage(this.name);
    }

    bodyRect() {
      return { x: this.x - 40, y: this.groundY - 230, w: 80, h: 230 };
    }

    warnY() {
      return this.groundY - 250;
    }

    onBeamed() {
      this.yell("TOO BIG TO BEAM!", 1.2);
    }

    draw(ctx, t) {
      U.Art.hazards.giantFarmer(ctx, this, t);
    }
  }

  class Tank extends Hazard {
    constructor(game, x, y) {
      super(game, "tank", "Military Tank");
      this.x = x;
      this.groundY = y;
      this.home = x;
      this.dir = Math.random() < 0.5 ? -1 : 1;
      this.aim = 0.5;
      this.recoil = 0;
      this.beamable = true;
    }

    update(dt) {
      super.update(dt);
      const p = this.game.player;
      const dx = p.x - this.x;
      this.recoil = Math.max(0, this.recoil - dt * 3);
      this.patrol(dt, 45, 450);
      this.facing = Math.sign(dx) || 1;
      this.aim = U.damp(this.aim, U.clamp(this.aimAt(this.x + 8 * this.facing, this.groundY - 64), 0.15, 1.45), 3, dt);
      if (p.alive && this.cd <= 0 && Math.abs(dx) < 760) {
        this.cd = 3.6 / this.rate;
        this.recoil = 1;
        const tipX = this.x + this.facing * (8 + Math.cos(this.aim) * 64);
        const tipY = this.groundY - 64 - Math.sin(this.aim) * 64;
        const speed = 470 * this.speedMul;
        const dist = Math.hypot(p.x - tipX, p.y - tipY);
        const time = Math.max(0.4, dist / speed);
        const v = U.lob(tipX, tipY, p.x + p.vx * time * 0.4, p.y, time, 160);
        this.game.projectiles.spawn({ kind: "shell", x: tipX, y: tipY, vx: v.vx, vy: v.vy, g: 160, r: 9, effect: "damage", life: 4, owner: this.name });
        this.game.particles.smoke(tipX, tipY, 6, "rgba(220,220,220,0.8)");
        if (this.onScreen()) this.game.audio.play("shoot");
      }
    }

    bodyRect() {
      return { x: this.x - 66, y: this.groundY - 80, w: 132, h: 80 };
    }

    draw(ctx, t) {
      U.Art.hazards.tank(ctx, this, t);
      if (this.shout > 0) U.Draw.bubble(ctx, this.x, this.groundY - 110, this.shoutText, { size: 15, color: "#c4352b" });
    }
  }

  class PoliceCar extends Hazard {
    constructor(game, x, y) {
      super(game, "policeCar", "Police Car");
      this.x = x;
      this.groundY = y;
      this.home = x;
      this.dir = Math.random() < 0.5 ? -1 : 1;
      this.beamable = true;
      if (game.audio) game.audio.play("siren");
    }

    update(dt) {
      super.update(dt);
      this.patrol(dt, 150, 650);
      const p = this.game.player;
      const dx = p.x - this.x;
      if (p.alive && this.cd <= 0 && Math.abs(dx) < 170 && p.y > 180) {
        this.cd = 3.2 / this.rate;
        this.game.projectiles.spawn({ kind: "net", x: this.x, y: this.groundY - 74, vx: dx * 0.9 + p.vx * 0.3, vy: -520 * this.speedMul, g: 220, r: 20, effect: "stun", life: 3, owner: "Police Net" });
        this.yell("FREEZE!", 0.9);
        if (this.onScreen()) this.game.audio.play("throw");
      }
    }

    bodyRect() {
      return { x: this.x - 60, y: this.groundY - 74, w: 120, h: 74 };
    }

    draw(ctx, t) {
      U.Art.hazards.policeCar(ctx, this, t);
      if (this.shout > 0) U.Draw.bubble(ctx, this.x, this.groundY - 90, this.shoutText, { size: 15, color: "#2c3e78" });
    }
  }

  class Resident extends Hazard {
    constructor(game, x, y) {
      super(game, "resident", "Angry Resident");
      this.x = x;
      this.groundY = y;
      this.throwT = 0;
      this.beamable = true;
      this.vx = 0;
    }

    update(dt) {
      super.update(dt);
      this.throwT = Math.max(0, this.throwT - dt);
      const p = this.game.player;
      const dx = p.x - this.x;
      this.facing = Math.sign(dx) || 1;
      this.vx = Math.abs(dx) > 220 ? Math.sign(dx) * 55 * this.speedMul : 0;
      this.x = U.clamp(this.x + this.vx * dt, 40, U.WORLD_W - 40);
      this.moving = this.vx !== 0;
      this.phase += dt * (6 + Math.abs(this.vx) * 0.07);
      if (p.alive && this.cd <= 0 && Math.abs(dx) < 560) {
        this.cd = 3.0 / this.rate;
        this.throwT = 0.35;
        this.lob("gnome", this.x + this.facing * 10, this.groundY - 92, 1.05, 620, 13);
        if (Math.random() < 0.6) this.yell(U.pick(["GET OFF MY LAWN!", "I'M TELLING THE HOA!", "SHOO, SAUCER!", "NOT IN MY YARD!"]));
      }
    }

    bodyRect() {
      return { x: this.x - 18, y: this.groundY - 96, w: 36, h: 96 };
    }

    warnY() {
      return this.groundY - 120;
    }

    draw(ctx, t) {
      U.Art.hazards.resident(ctx, this, t);
    }
  }

  class Jeep extends Hazard {
    constructor(game, x, y) {
      super(game, "jeep", "Military Patrol");
      this.x = x;
      this.groundY = y;
      this.home = x;
      this.dir = Math.random() < 0.5 ? -1 : 1;
      this.aim = 0.6;
      this.beamable = true;
    }

    update(dt) {
      super.update(dt);
      const p = this.game.player;
      const dx = p.x - this.x;
      this.patrol(dt, 110, 600);
      this.aim = U.damp(this.aim, U.clamp(this.aimAt(this.x, this.groundY - 70), 0.2, 1.45), 4, dt);
      if (p.alive && this.cd <= 0 && Math.abs(dx) < 620) {
        this.cd = 3.4 / this.rate;
        for (const s of [-0.12, 0, 0.12]) this.shoot("dart", this.x - 10 * this.facing, this.groundY - 74, 430 * this.speedMul, 7, "damage", s, 120);
        if (this.onScreen()) this.game.audio.play("shoot");
        if (Math.random() < 0.4) this.yell(U.pick(["TARGET SPOTTED!", "FOAM 'EM!", "HOLD STILL!"]), 1);
      }
    }

    bodyRect() {
      return { x: this.x - 60, y: this.groundY - 90, w: 120, h: 90 };
    }

    draw(ctx, t) {
      U.Art.hazards.jeep(ctx, this, t);
      if (this.shout > 0) U.Draw.bubble(ctx, this.x, this.groundY - 110, this.shoutText, { size: 15, color: "#3d4f20" });
    }
  }

  class DustDevil extends Hazard {
    constructor(game, x, y) {
      super(game, "dustDevil", "Desert Storm");
      this.x = x;
      this.groundY = y;
      this.height = 330;
      this.vx = (Math.random() < 0.5 ? -1 : 1) * U.rand(90, 140);
      this.life = 24;
    }

    update(dt) {
      super.update(dt);
      this.life -= dt;
      this.alpha = U.clamp(Math.min(this.life, this.t) / 1.2, 0, 1);
      if (this.life <= 0) this.dead = true;
      this.x += (this.vx * this.speedMul + Math.sin(this.t * 1.7) * 60) * dt;
      if (this.x < 80 || this.x > U.WORLD_W - 80) this.vx = -this.vx;
      this.x = U.clamp(this.x, 80, U.WORLD_W - 80);
      if (this.onScreen() && Math.random() < dt * 20) {
        this.game.particles.emit({ x: this.x + U.rand(-50, 50), y: this.groundY - U.rand(0, this.height), vx: U.rand(-80, 80), vy: U.rand(-40, 10), life: 0.8, size: 3, color: "rgba(200,160,100,0.8)" });
      }
      if (this.onScreen() && Math.random() < dt * 0.4) this.game.audio.play("whoosh");
      // Spooks nearby people and animals.
      for (const tg of this.game.targets) {
        if (tg.state === "roam" && Math.abs(tg.x - this.x) < 120) tg.startPanic(1.5);
      }
      const p = this.game.player;
      if (this.alpha > 0.6 && C.ufoRect(p, this.x - 46, this.groundY - this.height, 92, this.height)) {
        if (p.damage(this.name)) {
          p.vx += Math.sign(p.x - this.x || 1) * 520;
          p.vy -= 160;
        }
      }
    }

    threat() {
      const p = this.game.player;
      return Math.abs(p.x - this.x) < 260 && p.y > this.groundY - this.height - 60;
    }

    warnY() {
      return this.groundY - this.height - 30;
    }

    draw(ctx, t) {
      ctx.globalAlpha = this.alpha;
      U.Art.hazards.dustDevil(ctx, this, t);
      ctx.globalAlpha = 1;
    }
  }

  class Monkey extends Hazard {
    constructor(game, x, y) {
      super(game, "monkey", "Angry Monkey");
      this.x = x;
      this.y = y;
      this.groundY = y;
      this.throwT = 0;
      this.beamable = true;
      this.ground = false;
      this.cd = U.rand(2, 4);
    }

    update(dt) {
      super.update(dt);
      this.throwT = Math.max(0, this.throwT - dt);
      const p = this.game.player;
      const dx = p.x - this.x;
      this.facing = Math.sign(dx) || 1;
      if (p.alive && this.cd <= 0 && Math.abs(dx) < 560) {
        this.cd = 2.7 / this.rate;
        this.throwT = 0.4;
        this.lob("coconut", this.x + this.facing * 10, this.y - 40, 0.9, 700, 12);
        if (Math.random() < 0.5) this.yell(U.pick(["OOK OOK!", "EEK!", "MY TREE!"]), 1);
      }
    }

    bodyRect() {
      return { x: this.x - 20, y: this.y - 54, w: 40, h: 54 };
    }

    threat() {
      const p = this.game.player;
      return Math.abs(p.x - this.x) < 300;
    }

    warnY() {
      return this.y - 80;
    }

    onBeamed() {
      this.yell("OOK! NO BEAM!", 1);
    }

    draw(ctx, t) {
      U.Art.hazards.monkey(ctx, this, t);
    }
  }

  // ---------------------------------------------------------------- Air hazards

  class Helicopter extends Hazard {
    constructor(game, x, y) {
      super(game, "helicopter", "Police Helicopter");
      this.ground = false;
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.tilt = 0;
      this.life = 22;
      this.leaving = false;
      this.cd = 2;
      this.side = x < game.player.x ? -1 : 1;
      this.rotorT = 0;
    }

    update(dt) {
      super.update(dt);
      const p = this.game.player;
      this.life -= dt;
      if (this.life <= 0 && !this.leaving) {
        this.leaving = true;
        this.yell("OUT OF FUEL!", 1.2);
      }
      if (this.leaving) {
        this.vy = U.approach(this.vy, -170, 300 * dt);
        this.vx = U.approach(this.vx, -this.facing * 200, 300 * dt);
        if (this.y < -120) this.dead = true;
      } else {
        const tx = p.x + this.side * 250;
        const ty = U.clamp(p.y - 150, 90, 300);
        const max = 250 * this.speedMul;
        this.vx = U.approach(this.vx, U.clamp((tx - this.x) * 1.3, -max, max), 320 * dt);
        this.vy = U.approach(this.vy, U.clamp((ty - this.y) * 1.3, -max, max), 320 * dt);
        this.facing = Math.sign(p.x - this.x) || 1;
        if (Math.random() < dt * 0.3) this.side = -this.side;
        const dist = Math.hypot(p.x - this.x, p.y - this.y);
        if (p.alive && this.cd <= 0 && dist < 680) {
          this.cd = 2.7 / this.rate;
          this.shoot("stun", this.x + this.facing * 30, this.y + 10, 290 * this.speedMul, 11, "stun");
          if (this.onScreen()) this.game.audio.play("shoot");
          if (Math.random() < 0.3) this.yell(U.pick(["PULL OVER!", "STOP RIGHT THERE!", "THIS IS THE POLICE!"]), 1.1);
        }
      }
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.tilt = U.clamp(this.vx / 260, -1, 1) * 0.22;
      this.rotorT -= dt;
      if (this.rotorT <= 0 && this.onScreen()) {
        this.rotorT = 1.2;
        this.game.audio.play("rotor");
      }
      if (!this.leaving && C.ufoCircle(p, this.x, this.y, 34)) p.damage(this.name);
    }

    threat() {
      return !this.leaving;
    }

    warnY() {
      return this.y - 60;
    }

    draw(ctx, t) {
      U.Art.hazards.helicopter(ctx, this, t);
      if (this.shout > 0) U.Draw.bubble(ctx, this.x, this.y - 44, this.shoutText, { size: 14, color: "#2c3e78" });
    }
  }

  class StormCloud extends Hazard {
    constructor(game, x, y) {
      super(game, "cloud", "Lightning Cloud");
      this.ground = false;
      this.x = x;
      this.y = y;
      this.vx = (Math.random() < 0.5 ? -1 : 1) * U.rand(20, 40);
      this.cycle = U.rand(0, 2);
      this.charging = false;
      this.striking = false;
      this.boltBottom = U.FEET_MAX;
      this.life = 30;
    }

    update(dt) {
      super.update(dt);
      this.life -= dt;
      this.alpha = U.clamp(Math.min(this.life, this.t) / 1.2, 0, 1);
      if (this.life <= 0) this.dead = true;
      const p = this.game.player;
      // Drifts slowly toward the saucer.
      const pull = Math.sign(p.x - this.x) * 18;
      this.x = U.clamp(this.x + (this.vx + pull) * this.speedMul * dt, 100, U.WORLD_W - 100);
      const period = 4.8 / this.rate;
      const wasStriking = this.striking;
      const wasCharging = this.charging;
      this.cycle = (this.cycle + dt) % (period + 0.45);
      this.striking = this.cycle >= period && this.alpha > 0.5;
      this.charging = !this.striking && this.cycle >= period - 1.0 && this.alpha > 0.5;
      if (this.charging && !wasCharging && this.onScreen()) this.game.audio.play("crackle");
      if (this.striking && !wasStriking) {
        if (this.onScreen(200)) this.game.audio.play("thunder");
        this.game.particles.burst(this.x, this.boltBottom, 14, { speed: 200, life: 0.5, size: 5, color: ["#fff36b", "#ffffff"], gravity: 300 });
        this.game.shakeScreen(5);
        for (const tg of this.game.targets) {
          if (tg.state === "roam" && Math.abs(tg.x - this.x) < 200) tg.startPanic(2);
        }
      }
      if (this.striking && C.ufoColumn(p, this.x, 24, this.y + 30, this.boltBottom)) p.fryBeam(5);
      else if (this.alpha > 0.6 && C.ufoCircle(p, this.x, this.y, 64)) p.fryBeam(3);
    }

    threat() {
      const p = this.game.player;
      return (this.charging || this.striking) && Math.abs(p.x - this.x) < 220;
    }

    warnY() {
      return this.y - 70;
    }

    draw(ctx, t) {
      ctx.globalAlpha = this.alpha;
      U.Art.hazards.cloud(ctx, this, t);
      ctx.globalAlpha = 1;
    }
  }

  class Eagle extends Hazard {
    constructor(game, x, y, variant) {
      super(game, "eagle", variant === "pelican" ? "Angry Pelican" : "Flying Eagle");
      this.variant = variant || "eagle";
      this.ground = false;
      this.x = x;
      this.y = y;
      this.homeY = y;
      this.facing = x < game.player.x ? 1 : -1;
      this.vx = this.facing * 150;
      this.vy = 0;
      this.tilt = 0;
      this.state = "patrol";
      this.stateT = 0;
      this.dives = 0;
      this.telegraph = 0;
      this.diving = false;
      this.cd = 1;
    }

    update(dt) {
      super.update(dt);
      const p = this.game.player;
      this.stateT += dt;
      this.telegraph = this.state === "telegraph" ? 1 : 0;
      this.diving = this.state === "dive";
      switch (this.state) {
        case "patrol": {
          this.vx = U.approach(this.vx, Math.sign(p.x - this.x || 1) * 150 * this.speedMul, 200 * dt);
          this.vy = (this.homeY - this.y) * 2 + Math.sin(this.t * 3) * 30;
          if (p.alive && this.cd <= 0 && Math.abs(p.x - this.x) < 480) {
            this.state = "telegraph";
            this.stateT = 0;
            if (this.onScreen()) this.game.audio.play("screech");
          }
          break;
        }
        case "telegraph":
          this.vx *= Math.pow(0.05, dt);
          this.vy = -40;
          if (this.stateT > 0.65) {
            this.state = "dive";
            this.stateT = 0;
            const a = Math.atan2(p.y - this.y, p.x - this.x);
            const s = 560 * this.speedMul;
            this.vx = Math.cos(a) * s;
            this.vy = Math.sin(a) * s;
          }
          break;
        case "dive":
          if (this.stateT > 1.1 || this.y > U.FEET_MIN - 40) {
            this.state = "climb";
            this.stateT = 0;
            this.dives++;
          }
          break;
        case "climb":
          this.vy = U.approach(this.vy, -240, 900 * dt);
          this.vx *= Math.pow(0.4, dt);
          if (this.y <= this.homeY) {
            this.state = this.dives >= 3 ? "leave" : "patrol";
            this.cd = 2.2 / this.rate;
            this.stateT = 0;
          }
          break;
        case "leave":
          this.vx = U.approach(this.vx, this.facing * 260, 300 * dt);
          this.vy = U.approach(this.vy, -60, 200 * dt);
          if (this.x < -150 || this.x > U.WORLD_W + 150 || this.y < -100) this.dead = true;
          if (!this.onScreen(400) && this.stateT > 2) this.dead = true;
          break;
        default:
          break;
      }
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (Math.abs(this.vx) > 5) this.facing = Math.sign(this.vx);
      this.tilt = this.state === "dive" ? Math.atan2(this.vy, Math.abs(this.vx)) * 0.8 : Math.sin(this.t * 3) * 0.08;
      if (this.state !== "leave" && C.ufoCircle(p, this.x, this.y, 26)) p.damage(this.name);
    }

    threat() {
      return this.state === "telegraph" || this.state === "dive";
    }

    warnY() {
      return this.y - 50;
    }

    draw(ctx, t) {
      U.Art.hazards.eagle(ctx, this, t);
    }
  }

  // ---------------------------------------------------------------- Projectiles

  class Projectiles {
    constructor(game) {
      this.game = game;
      this.pool = [];
      for (let i = 0; i < 80; i++) this.pool.push({ active: false });
    }

    spawn(o) {
      const p = this.pool.find((q) => !q.active);
      if (!p) return null;
      p.active = true;
      p.kind = o.kind;
      p.x = o.x;
      p.y = o.y;
      p.vx = o.vx;
      p.vy = o.vy;
      p.g = o.g || 0;
      p.r = o.r || 10;
      p.effect = o.effect || "damage";
      p.life = o.life || 4;
      p.homing = o.homing || 0;
      p.turn = o.turn || 0;
      p.owner = o.owner || "";
      return p;
    }

    clear() {
      for (const p of this.pool) p.active = false;
    }

    update(dt) {
      const g = this.game;
      const pl = g.player;
      for (const p of this.pool) {
        if (!p.active) continue;
        p.life -= dt;
        if (p.homing > 0 && pl.alive) {
          p.homing -= dt;
          const want = Math.atan2(pl.y - p.y, pl.x - p.x);
          const cur = Math.atan2(p.vy, p.vx);
          let diff = want - cur;
          while (diff > Math.PI) diff -= U.TAU;
          while (diff < -Math.PI) diff += U.TAU;
          const a = cur + U.clamp(diff, -p.turn * dt, p.turn * dt);
          const s = Math.hypot(p.vx, p.vy);
          p.vx = Math.cos(a) * s;
          p.vy = Math.sin(a) * s;
        }
        p.vy += p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === "rocket" && Math.random() < 0.6) g.particles.emit({ x: p.x, y: p.y, vx: -p.vx * 0.2, vy: -p.vy * 0.2, life: 0.4, size: 5, color: "rgba(255,200,120,0.8)", grow: 8, drag: 0.9 });
        if (p.kind === "shell" && Math.random() < 0.4) g.particles.emit({ x: p.x, y: p.y, life: 0.4, size: 4, color: "rgba(200,200,200,0.6)", grow: 10 });

        if (pl.alive && C.ufoCircle(pl, p.x, p.y, p.r)) {
          p.active = false;
          this.impact(p, true);
          if (p.effect === "stun") pl.stunFor(1.3);
          else pl.damage(p.owner);
          continue;
        }
        if (p.life <= 0 || p.y > U.VH + 20 || p.y < -200 || p.x < -200 || p.x > U.WORLD_W + 200) {
          p.active = false;
          continue;
        }
        // Lobbed things splat on the ground on the way down.
        if (p.vy > 0 && p.y > U.FEET_MAX && p.g > 0) {
          p.active = false;
          this.impact(p, false);
        }
      }
    }

    impact(p, hitUfo) {
      const fx = this.game.particles;
      const colors = {
        tomato: ["#ff3b3b", "#ff7a6b"], hay: ["#f2d06b", "#c9a336"], gnome: ["#ff3b3b", "#2d5bff", "#fff"],
        coconut: ["#7a4a22", "#fff"], dart: ["#ff8a1f"], stun: ["#bff4ff", "#2d8bff"], net: ["#fff"],
        rocket: ["#ffb02e", "#ff3b3b", "#fff36b"], shell: ["#555", "#ffb02e"], boot: ["#6b3b1f"],
      };
      fx.burst(p.x, p.y, hitUfo ? 14 : 8, { speed: 180, life: 0.5, size: 5, color: colors[p.kind] || ["#fff"], gravity: 400 });
      if (p.kind === "rocket" || p.kind === "shell") {
        fx.smoke(p.x, p.y, 6, "rgba(120,110,130,0.7)");
        this.game.texts.add(p.x, p.y - 10, p.kind === "rocket" ? "BOOM!" : "KA-POW!", { color: "#ffb02e", size: 24 });
        if (hitUfo || this.game.isVisible(p.x)) this.game.audio.play("boom");
      } else if (p.kind === "tomato") {
        this.game.texts.add(p.x, p.y - 10, "SPLAT!", { color: "#ff3b3b", size: 22 });
        this.game.audio.play("splat");
      } else if (!hitUfo && this.game.isVisible(p.x)) {
        this.game.audio.play("splat");
      }
    }

    draw(ctx, t) {
      for (const p of this.pool) if (p.active) U.Art.drawProjectile(ctx, p, t);
    }
  }

  // ---------------------------------------------------------------- Registry

  const HAZARDS = {
    bull: { name: "Angry Bull", air: false, make: (g, x, y) => new Bull(g, x, y), desc: "Charges and leaps at low-flying saucers." },
    tractor: { name: "Tractor", air: false, make: (g, x, y) => new Tractor(g, x, y), desc: "Tosses hay bales. Too heavy to beam." },
    fence: { name: "Electric Fence", air: false, static: true, make: (g, x) => new Fence(g, x, "farm"), desc: "Zaps upward every few seconds." },
    power: { name: "Power Lines", air: false, static: true, make: (g, x) => new Fence(g, x, "power"), desc: "Electric obstacles that spark upward." },
    rocket: { name: "Rocket Launcher", air: false, make: (g, x, y) => new RocketLauncher(g, x, y), desc: "Fires slow, homing rockets." },
    giantFarmer: { name: "Giant Angry Farmer", air: false, make: (g, x, y) => new GiantFarmer(g, x, y), desc: "Throws tomatoes, boots and hay." },
    tank: { name: "Military Tank", air: false, make: (g, x, y) => new Tank(g, x, y), desc: "Lobs cannonballs at you." },
    policeCar: { name: "Police Car", air: false, make: (g, x, y) => new PoliceCar(g, x, y), desc: "Fires stun nets straight up." },
    resident: { name: "Angry Resident", air: false, make: (g, x, y) => new Resident(g, x, y), desc: "Throws garden gnomes." },
    jeep: { name: "Military Patrol", air: false, make: (g, x, y) => new Jeep(g, x, y), desc: "Fires volleys of foam darts." },
    dustDevil: { name: "Desert Storm", air: false, make: (g, x, y) => new DustDevil(g, x, y), desc: "A whirlwind that knocks you around." },
    monkey: { name: "Angry Monkey", air: false, static: true, make: (g, x, y) => new Monkey(g, x, y), desc: "Hurls coconuts from palm trees." },
    helicopter: { name: "Police Helicopter", air: true, make: (g, x, y) => new Helicopter(g, x, y), desc: "Chases you and fires stun shots." },
    cloud: { name: "Lightning Cloud", air: true, make: (g, x, y) => new StormCloud(g, x, y), desc: "Its lightning fries your beam." },
    eagle: { name: "Flying Eagle", air: true, make: (g, x, y) => new Eagle(g, x, y, "eagle"), desc: "Swoops at the saucer." },
    pelican: { name: "Angry Pelican", air: true, make: (g, x, y) => new Eagle(g, x, y, "pelican"), desc: "Dive-bombs from the sky." },
  };

  U.HAZARDS = HAZARDS;
  U.Projectiles = Projectiles;
})(window.UFO);
