/*
 * The boss fights: Mudhorn, Reptavians, Krayt Dragon, Mythosaur and Moff Gideon, plus
 * the Imperial Guardian. Each has its own mechanics, warnings and openings.
 */
(function (MQ) {
  const { clamp, damp, approach, rand, pick, glow, oval, line, poly, text, lerp } = MQ.U;
  const { abs, sign, sin, cos, atan2, hypot, max, min } = Math;
  const ENEMY = 1;

  /* A hit box that forwards damage to its boss. */
  class Part {
    constructor(owner, boss = owner) {
      this.owner = owner;
      this.boss = boss;
      this.x = 0;
      this.y = 0;
      this.w = 0;
      this.h = 0;
      this.mult = 1;
      this.hittable = false;
      this.priority = 1;
      this.claimed = -1;
    }

    set(x, y, w, h, mult = 1, hittable = true) {
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.mult = mult;
      this.hittable = hittable;
    }

    hurt(amount, fromX, knock, kind) {
      return this.boss.damage(amount, this, fromX, kind);
    }
  }

  class Boss {
    constructor(world, arena, config) {
      this.world = world;
      this.arena = arena;
      Object.assign(this, config);
      this.isBoss = true;
      this.hp = this.maxHp;
      this.phase = 1;
      this.parts = [];
      this.strikes = Array.from({ length: 18 }, () => ({ active: false, kind: "", x: 0, width: 0, delay: 0, total: 1, time: 0, hit: false }));
      this.time = 0;
      this.flash = 0;
      this.staggerWait = 0;
      this.burned = -1;
      this.dead = false;
      this.active = false;
      this.facing = -1;
      this.x = (arena.x0 + arena.x1) / 2 + (arena.x1 - arena.x0) * 0.25;
      this.y = arena.floor;
      this.setState("idle");
    }

    setState(state) {
      this.state = state;
      this.stateTime = 0;
      this.hasHit = false;
      this.fired = 0;
    }

    get player() {
      return this.world.player;
    }

    get speed() {
      return 1 + (this.phase - 1) * 0.18;
    }

    get middle() {
      return (this.arena.x0 + this.arena.x1) / 2;
    }

    inArena(x, margin) {
      return clamp(x, this.arena.x0 + margin, this.arena.x1 - margin);
    }

    facePlayer() {
      this.facing = this.player.x < this.x ? -1 : 1;
    }

    roar() {
      this.world.sfx(`bossAttack${this.sound}`);
    }

    once(index, at, fn) {
      if (this.fired === index && this.stateTime >= at) {
        this.fired++;
        fn();
      }
    }

    update(dt) {
      this.time += dt;
      this.flash -= dt;
      this.staggerWait -= dt;
      this.stateTime += dt;
      this.updateStrikes(dt);
      if (this.dead) this.updateDefeat(dt);
      else this.think(dt);
      this.updateParts();
    }

    introUpdate(dt, progress) {
      this.time += dt;
      this.introPose?.(progress, dt);
      this.updateParts();
    }

    updateDefeat() {}

    damage(amount, part) {
      if (this.dead || !this.active) return false;
      this.flash = 0.08;
      this.hp = max(0, this.hp - amount * part.mult);
      if (part.mult >= 1.4 && Math.random() < 0.12) {
        this.world.particles.label(part.x, part.y - part.h - 10, "WEAK POINT", "#ffd45c", 15);
      }
      this.checkPhase();
      if (!this.hp) this.defeat();
      return true;
    }

    // Force Burst damage ignores armor.
    hurt(amount) {
      if (!this.parts.some((part) => part.hittable)) return;
      this.damage(amount, { mult: 0.6, x: this.x, y: this.y, h: 0 });
    }

    checkPhase() {
      let phase = 1;
      for (const threshold of this.thresholds) {
        if (this.hp <= this.maxHp * threshold) phase++;
      }
      while (this.phase < phase) {
        this.phase++;
        this.world.particles.ring(this.x, this.y - 90, 260, "#ff6a5c", 0.7);
        this.world.camera.shake(0.6);
        this.world.banner(this.phaseNames?.[this.phase - 1] || `PHASE ${this.phase}`);
        this.world.sfx(`bossIntro${this.sound}`);
        this.onPhase?.();
      }
    }

    defeat() {
      this.dead = true;
      this.active = false;
      for (const strike of this.strikes) strike.active = false;
      this.setState("defeated");
      this.world.bossDefeated();
    }

    // Retrying restarts the current phase.
    reset() {
      this.hp = this.phase === 1 ? this.maxHp : this.maxHp * this.thresholds[this.phase - 2];
      for (const strike of this.strikes) strike.active = false;
      this.staggerWait = 0;
      this.x = this.inArena(this.arena.x1 - 260, 160);
      this.y = this.arena.floor;
      this.onReset?.();
      this.setState("idle");
    }

    staggered(seconds = 5) {
      if (this.staggerWait > 0) {
        this.world.particles.label(this.x, this.y - 170, "RESISTED", "#b8c6d6", 16);
        return false;
      }
      this.staggerWait = seconds;
      this.world.particles.label(this.x, this.y - 170, "STAGGERED!", "#8fdcff", 24);
      this.world.camera.shake(0.4);
      return true;
    }

    hitArea(left, top, right, bottom, damage, knock = 360) {
      if (this.hasHit || !MQ.touches(this.player, left, top, right, bottom)) return;
      if (this.world.hurtPlayer(damage, (left + right) / 2, knock)) this.hasHit = true;
    }

    shockwaves(x, damage, speed = 420, height = 36, color = "#ffb36b") {
      for (const direction of [-1, 1]) {
        const p = this.world.projectiles.fire(ENEMY, "shock", x + direction * 30, this.arena.floor, direction * speed, 0, damage, color, 2.6);
        p.r = height;
      }
      this.world.camera.shake(0.55);
      this.world.particles.dust(x, this.arena.floor, "#b59c7c", 20, 280);
      this.world.sfx("explosion");
    }

    /* Warned attacks from above or below: rock, geyser or bolt. */
    strike(kind, x, delay, damage, width = 80) {
      const strike = this.strikes.find((s) => !s.active);
      if (!strike) return;
      strike.active = true;
      strike.kind = kind;
      strike.x = this.inArena(x, width / 2);
      strike.width = width;
      strike.delay = strike.total = delay;
      strike.time = kind === "rock" ? 0.32 : 0.4;
      strike.damage = damage;
      strike.hit = false;
    }

    updateStrikes(dt) {
      const { floor } = this.arena;
      const { world } = this;
      for (let i = 0; i < this.strikes.length; i++) {
        const s = this.strikes[i];
        if (!s.active) continue;
        if (s.delay > 0) {
          s.delay -= dt;
          if (s.delay <= 0 && s.kind !== "rock") {
            world.sfx("explosion");
            world.particles.dust(s.x, floor, "#8a7360", 8, 150);
          }
          continue;
        }
        s.time -= dt;
        const half = s.width / 2 - 6;
        let top = floor - (s.kind === "bolt" ? 560 : 220);
        let bottom = floor;
        if (s.kind === "rock") {
          bottom = lerp(floor - 520, floor, clamp(1 - s.time / 0.32, 0, 1));
          top = bottom - 60;
        }
        if (!s.hit && MQ.touches(world.player, s.x - half, top, s.x + half, bottom) && world.hurtPlayer(s.damage, s.x, 250)) s.hit = true;
        if (s.time <= 0) {
          s.active = false;
          if (s.kind === "rock") {
            world.particles.chunks(s.x, floor - 20, "#6e5848", 10);
            world.sfx("crumble");
          }
        }
      }
    }

    drawStrikes(ctx) {
      const { floor } = this.arena;
      for (let i = 0; i < this.strikes.length; i++) {
        const s = this.strikes[i];
        if (!s.active) continue;
        const color = s.kind === "bolt" ? "#e66bff" : s.kind === "geyser" ? "#ff8a3d" : "#ff5348";
        if (s.delay > 0) {
          const k = 1 - s.delay / s.total;
          ctx.globalAlpha = 0.25 + k * 0.5;
          oval(ctx, s.x, floor - 3, s.width / 2, 9, color);
          ctx.globalAlpha = 0.07 + k * 0.1;
          ctx.fillStyle = color;
          const height = s.kind === "geyser" ? 220 : 560;
          ctx.fillRect(s.x - s.width / 2, floor - height, s.width, height);
          ctx.globalAlpha = 1;
          text(ctx, "!", s.x, floor - 18, 26, "#ffd45c", "center", 800);
        } else if (s.kind === "rock") {
          const y = lerp(floor - 520, floor, clamp(1 - s.time / 0.32, 0, 1)) - 30;
          poly(ctx, [s.x - 30, y, s.x - 12, y - 28, s.x + 22, y - 22, s.x + 32, y + 6, s.x + 10, y + 28, s.x - 22, y + 22], "#7a6352", MQ.INK, 2.5);
        } else {
          const k = min(1, s.time / 0.15);
          const height = s.kind === "bolt" ? 560 : 220;
          ctx.globalAlpha = k;
          for (let y = 0; y < height; y += 42) glow(ctx, s.x + sin(y + this.time * 40) * 8, floor - y, s.width * 0.75, color, 0.8);
          line(ctx, s.x, floor, s.x, floor - height, "#fff4dc", 6);
          ctx.globalAlpha = 1;
        }
      }
    }

    warn(ctx, x, y, label) {
      text(ctx, "!", x, y, 42, "#ffd45c", "center", 800);
      if (label) text(ctx, label, x, y + 22, 15, "#ffd45c", "center", 800);
    }

    drawFlash(ctx, x, y, radius) {
      if (this.flash > 0) glow(ctx, x, y, radius, "#ffffff", 0.22);
    }
  }

  /* ---------- 1. Mudhorn: dodge the charge so it hits the wall. ---------- */

  class Mudhorn extends Boss {
    constructor(world, arena) {
      super(world, arena, {
        name: "MUDHORN", title: "Terror of the Valley", sound: "Mudhorn",
        maxHp: 1100, thresholds: [0.55, 0.25], phaseNames: [null, "THE MUDHORN IS ENRAGED", "FINAL STAMPEDE"],
      });
      this.parts.push(new Part(this), new Part(this));
      this.parts[1].priority = 1.5;
      this.view = { time: 0, gait: 0, moving: false };
      this.gait = 0;
      this.move = 0;
      this.charges = 0;
    }

    onReset() {
      this.charges = 0;
    }

    think(dt) {
      const { player, stateTime: t } = this;
      switch (this.state) {
        case "idle": {
          const distance = abs(player.x - this.x);
          this.facePlayer();
          if (distance > 170) this.walk(this.facing * 65 * this.speed, dt);
          if (t > 0.95 / this.speed) this.choose(distance);
          break;
        }
        case "paw":
          if (t >= 1.05 / this.speed) {
            this.setState("charge");
            this.roar();
          }
          break;
        case "charge": {
          const f = this.facing;
          this.walk(f * 600 * this.speed, dt, 2.5);
          this.hitArea(this.x + (f > 0 ? 20 : -200), this.y - 135, this.x + (f > 0 ? 200 : -20), this.y, 22, 440);
          this.world.level.smash(this.x + f * 120, this.y - 60, 110);
          if (Math.random() < dt * 25) this.world.particles.dust(this.x - f * 120, this.y, "#b58a5c", 3, 120);
          const wall = f > 0 ? this.arena.x1 - 205 : this.arena.x0 + 205;
          if ((wall - this.x) * f <= 0) this.crash(wall);
          break;
        }
        case "dazed":
          if (t > this.dazeTime) this.next();
          break;
        case "stomp":
          this.once(0, 0.85 / this.speed, () => {
            this.shockwaves(this.x + this.facing * 70, 16, 390 * this.speed);
            if (this.phase > 1) {
              this.strike("rock", player.x, 0.8, 15);
              this.strike("rock", player.x + pick([-170, 170]), 1.05, 15);
            }
          });
          if (t > 1.6) this.setState("idle");
          break;
        case "gore":
          if (t > 0.55 && t < 0.78) {
            this.walk(this.facing * 420, dt);
            this.hitArea(this.x + (this.facing > 0 ? 40 : -235), this.y - 150, this.x + (this.facing > 0 ? 235 : -40), this.y, 18);
          }
          if (t > 1.35) this.setState("idle");
          break;
        case "roar":
          this.once(0, 0.65, () => this.roar());
          if (t > 0.65 && t < 1) {
            this.hitArea(this.x - 235, this.y - 200, this.x + 235, this.y, 9, 620);
            if (Math.random() < dt * 14) this.world.particles.ring(this.x + this.facing * 120, this.y - 100, 190, "#e8c9a0", 0.35);
          }
          if (t > 1.4) this.setState("idle");
          break;
      }
    }

    choose(distance) {
      this.move++;
      this.facePlayer();
      if (distance < 130 && this.move % 2) this.setState("roar");
      else if (distance < 250 && this.move % 2) this.setState("gore");
      else if (this.move % 2 === 0) this.setState("stomp");
      else {
        this.charges = this.phase - 1;
        this.setState("paw");
      }
    }

    walk(velocity, dt, rate = 1) {
      this.x = this.inArena(this.x + velocity * dt, 200);
      this.gait += abs(velocity) * dt * 0.025 / rate;
    }

    crash(wall) {
      this.x = wall;
      this.setState("dazed");
      // Later phases only stay dazed after the last charge in the chain.
      this.dazeTime = this.charges > 0 ? 0.65 : 2.5;
      this.world.camera.shake(0.8);
      this.world.sfx("crumble");
      this.world.particles.chunks(wall + this.facing * 180, this.y - 100, "#86492f", 22, 420);
      for (let i = 0; i < 2 + this.phase; i++) this.strike("rock", rand(this.arena.x0 + 80, this.arena.x1 - 80), 0.8 + i * 0.22, 14);
    }

    next() {
      if (this.charges-- > 0) {
        this.facePlayer();
        this.setState("paw");
      } else {
        this.setState("idle");
      }
    }

    push() {
      if (this.state === "dazed" || !this.staggered(9)) return;
      this.setState("dazed");
      this.dazeTime = 2.3;
      this.charges = 0;
    }

    updateParts() {
      const open = this.state === "dazed";
      const alive = !this.dead;
      this.parts[0].set(this.x - this.facing * 45, this.y, 200, 150, open ? 1.5 : 0.45, alive);
      this.parts[1].set(this.x + this.facing * 112, this.y - 40, 100, 130, open ? 2 : 0.75, alive);
    }

    introPose(k) {
      this.roaring = k > 0.3 && k < 0.75;
    }

    draw(ctx) {
      const { view, state, stateTime: t } = this;
      view.time = this.time;
      view.gait = this.gait;
      view.moving = state === "charge" || (state === "idle" && abs(this.player.x - this.x) > 170);
      view.paw = state === "paw";
      view.snort = state === "paw" || state === "charge";
      view.dazed = state === "dazed";
      view.enraged = this.phase > 1;
      view.mouth = state === "roar" || (!this.active && this.roaring);
      view.rear = state === "stomp" ? (t < 0.85 / this.speed ? min(1, t * 1.8) : 0) : 0;
      view.head = {
        paw: 0.35,
        charge: 0.3,
        roar: -0.35,
        dazed: 0.3 + sin(this.time * 3) * 0.1,
        gore: t < 0.55 ? 0.4 : lerp(-0.5, 0, clamp((t - 0.7) * 2, 0, 1)),
        defeated: 0.5,
      }[state] || 0;

      if (state === "paw") {
        const end = this.facing > 0 ? this.arena.x1 : this.arena.x0;
        ctx.fillStyle = `rgba(255,83,72,${0.1 + min(1, t) * 0.14})`;
        ctx.fillRect(min(this.x, end), this.y - 120, abs(end - this.x), 120);
      }

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(this.facing, 1);
      if (state === "defeated") {
        ctx.translate(0, min(1, t) * 22);
        ctx.rotate(-min(1, t) * 0.12);
      }
      MQ.BossArt.mudhorn(ctx, view);
      ctx.restore();
      this.drawFlash(ctx, this.x, this.y - 100, 190);

      const head = this.x + this.facing * 110;
      if (state === "paw") this.warn(ctx, head, this.y - 230, "CHARGE");
      else if (state === "stomp" && t < 0.8) this.warn(ctx, head, this.y - 230, "JUMP");
      else if ((state === "gore" && t < 0.55) || (state === "roar" && t < 0.65)) this.warn(ctx, head, this.y - 230);
    }
  }

  /* ---------- 2. Reptavians: one leader at a time, with support dives. ---------- */

  const PACK_COLORS = [["#8c4038", "#a84b3c"], ["#6e4a68", "#8e5f82"], ["#8c6a38", "#b8843c"]];

  class Reptavian {
    constructor(pack, index) {
      this.pack = pack;
      this.index = index;
      this.isBoss = true;
      this.hp = this.maxHp = 550;
      this.part = new Part(this, pack);
      this.color = PACK_COLORS[index][0];
      this.view = { color: this.color, wing: PACK_COLORS[index][1], time: 0, flap: index, gait: 0 };
      this.x = pack.middle + (index - 1) * 260;
      this.y = pack.arena.floor - 360;
      this.vx = 0;
      this.vy = 0;
      this.facing = -1;
      this.dead = false;
      this.claimed = -1;
      this.burned = -1;
      this.lockX = this.x;
      this.lockY = this.y;
      this.setState("circle");
    }

    setState(state) {
      this.state = state;
      this.time = 0;
      this.hasHit = false;
    }

    get leader() {
      return this.pack.leader === this;
    }

    get grounded() {
      return this.state === "ground" || this.state === "crouch" || this.state === "lunge";
    }

    hurt(amount) {
      if (this.part.hittable) this.pack.damage(amount * 0.6, this.part);
    }

    push() {
      if (!this.leader || this.state === "fallen" || !this.pack.staggered(8)) return;
      this.setState("fallen");
      this.vx = 0;
    }
  }

  class Reptavians extends Boss {
    constructor(world, arena) {
      super(world, arena, {
        name: "NEVARRO REPTAVIANS", title: "Hunters of the Nest", sound: "Reptavians",
        maxHp: 1650, thresholds: [2 / 3, 1 / 3], phaseNames: [null, "A SECOND HUNTER DESCENDS", "THE MATRIARCH'S LAST STAND"],
      });
      this.pack = [0, 1, 2].map((i) => new Reptavian(this, i));
      for (const r of this.pack) this.parts.push(r.part);
      this.leader = this.pack[0];
      this.supportTime = 5;
      this.move = 0;
    }

    get ground() {
      return this.arena.floor - 70;
    }

    think(dt) {
      this.supportTime -= dt;
      if (this.supportTime <= 0) {
        this.supportTime = max(2.8, 5.2 - this.phase);
        // The others take turns, so attacks overlap but never all at once.
        const helper = this.pack.find((r) => !r.dead && !r.leader && r.state === "circle");
        if (helper) this.aimPass(helper);
        else if (this.phase === 3) {
          for (let i = -1; i <= 1; i++) this.strike("geyser", this.player.x + i * 180, 1.1 + abs(i) * 0.2, 14);
        }
      }
      for (const r of this.pack) this.updateOne(r, dt);
      this.x = this.leader.x;
      this.y = this.leader.y + 70;
    }

    updateOne(r, dt) {
      r.time += dt;
      r.view.time = this.time + r.index;
      r.view.flap += dt * (r.state === "dive" ? 4 : 9);

      if (r.dead) {
        r.y = min(this.ground + 25, r.y + dt * 420);
        return;
      }

      const { player, speed } = this;
      const reach = (damage) => {
        if (r.hasHit || !MQ.touches(player, r.x - 55, r.y - 34, r.x + 55, r.y + 50)) return;
        if (this.world.hurtPlayer(damage, r.x, 340)) r.hasHit = true;
      };

      switch (r.state) {
        case "circle": {
          const high = r.leader ? 250 : 400;
          const spin = this.time * (r.leader ? 0.9 : 0.6) + r.index * 2.1;
          const center = r.leader ? this.inArena(player.x, 260) : this.middle;
          const tx = center + cos(spin) * (r.leader ? 250 : 400);
          this.fly(r, tx, this.arena.floor - high + sin(spin * 2) * 30, dt);
          r.facing = sign(player.x - r.x) || 1;
          if (r.leader && r.time > 1.05 / speed) {
            const attack = ["dive", "lunge", "dive", "pass"][this.move++ % 4];
            if (attack === "dive") this.aimDive(r);
            else if (attack === "pass") this.aimPass(r);
            else r.setState("descend");
          }
          break;
        }
        case "aim":
          if (r.time < 0.5) r.lockX = this.inArena(player.x, 90);
          r.facing = sign(r.lockX - r.x) || 1;
          if (r.time > 0.8 / speed) {
            const distance = hypot(r.lockX - r.x, r.lockY - r.y) || 1;
            r.vx = ((r.lockX - r.x) / distance) * 780;
            r.vy = ((r.lockY - r.y) / distance) * 780;
            r.setState("dive");
            this.roar();
          }
          break;
        case "dive":
          r.x = this.inArena(r.x + r.vx * dt, 70);
          r.y += r.vy * dt;
          reach(19);
          if (r.y >= r.lockY) {
            r.y = r.lockY;
            r.setState(r.leader ? "ground" : "circle");
            this.world.particles.dust(r.x, this.arena.floor, "#9a7a6a", 14, 220);
            this.world.camera.shake(0.3);
          }
          break;
        case "descend":
          this.fly(r, this.inArena(player.x + (sign(r.x - player.x) || 1) * 260, 90), this.ground, dt, 3.5);
          if (r.time > 0.9) {
            r.y = this.ground;
            r.setState("crouch");
          }
          break;
        case "crouch":
          if (r.time < 0.3) r.facing = sign(player.x - r.x) || 1;
          if (r.time > 0.65 / speed) {
            r.setState("lunge");
            this.roar();
          }
          break;
        case "lunge":
          r.x = this.inArena(r.x + r.facing * 700 * dt, 70);
          r.y = this.ground - sin(min(1, r.time / 0.55) * Math.PI) * 50;
          reach(18);
          if (r.time > 0.55) {
            r.y = this.ground;
            r.setState("ground");
          }
          break;
        case "ground":
          r.y = damp(r.y, this.ground, 8, dt);
          if (r.time > 1.9 / speed) r.setState("circle");
          break;
        case "lane":
          this.fly(r, r.lockX, r.lockY, dt, 4);
          r.facing = r.lockX < this.middle ? 1 : -1;
          if (r.time > 1.15) {
            r.x = r.lockX;
            r.y = r.lockY;
            r.setState("pass");
            this.roar();
          }
          break;
        case "pass":
          r.x += r.facing * 720 * dt;
          reach(16);
          if ((r.x - this.middle) * r.facing > (this.arena.x1 - this.arena.x0) / 2 - 70) r.setState("circle");
          break;
        case "fallen":
          r.y = approach(r.y, this.ground + 15, 520 * dt);
          if (r.time > 2.4) r.setState("circle");
          break;
      }
      r.view.gait += abs(r.vx) * dt * 0.02;
    }

    fly(r, tx, ty, dt, rate = 2.2) {
      r.x = this.inArena(damp(r.x, tx, rate, dt), 60);
      r.y = damp(r.y, ty, rate, dt);
    }

    aimDive(r) {
      r.setState("aim");
      r.lockX = this.inArena(this.player.x, 90);
      r.lockY = this.ground;
    }

    aimPass(r) {
      r.setState("lane");
      r.lockX = this.player.x < this.middle ? this.arena.x1 - 70 : this.arena.x0 + 70;
      r.lockY = this.arena.floor - pick([62, 190]);
    }

    damage(amount, part) {
      if (this.dead || !this.active || part.owner !== this.leader) return false;
      const r = this.leader;
      const dealt = min(r.hp, amount * part.mult);
      r.hp -= dealt;
      this.flash = 0.08;
      if (r.hp <= 0.01) {
        r.hp = 0;
        r.dead = true;
        r.setState("dead");
        part.hittable = false;
        this.world.particles.ring(r.x, r.y, 160, "#ffb347");
        this.world.sfx("enemyDown");
        const next = this.pack.find((other) => !other.dead);
        if (next) {
          this.leader = next;
          next.setState("circle");
        }
      }
      this.hp = this.pack.reduce((sum, member) => sum + member.hp, 0);
      this.checkPhase();
      if (!this.hp) this.defeat();
      return true;
    }

    updateDefeat(dt) {
      for (const r of this.pack) this.updateOne(r, dt);
    }

    onReset() {
      for (const r of this.pack) {
        if (r.dead) continue;
        r.hp = r.maxHp;
        r.setState("circle");
        r.x = this.middle + (r.index - 1) * 260;
        r.y = this.arena.floor - 360;
      }
      this.hp = this.pack.reduce((sum, member) => sum + member.hp, 0);
      this.supportTime = 5;
    }

    introPose(k, dt) {
      for (const r of this.pack) {
        r.view.time = this.time;
        r.view.flap += dt * 9;
        r.y = this.arena.floor - 220 - sin(k * Math.PI + r.index) * 70;
      }
    }

    updateParts() {
      for (const r of this.pack) {
        const open = r.state === "ground" || r.state === "fallen";
        r.part.set(r.x + r.facing * 12, r.y + 45, 105, 95, open ? 1.5 : 0.6, !r.dead && r.leader);
        r.part.priority = r.leader ? 2 : 1;
      }
    }

    draw(ctx) {
      for (const r of this.pack) {
        if (r.state === "aim") {
          const k = min(1, r.time / 0.8);
          line(ctx, r.x, r.y, r.lockX, r.lockY, `rgba(255,83,72,${0.25 + k * 0.4})`, 3 + k * 4);
          oval(ctx, r.lockX, this.arena.floor - 3, 60, 9, "rgba(255,83,72,0.4)");
        } else if (r.state === "lane") {
          ctx.fillStyle = `rgba(255,83,72,${0.1 + min(1, r.time) * 0.15})`;
          ctx.fillRect(this.arena.x0, r.lockY - 34, this.arena.x1 - this.arena.x0, 84);
        }
      }
      for (const r of this.pack) {
        const { view } = r;
        view.flying = !r.grounded && !r.dead && r.state !== "fallen";
        view.mouth = r.state === "dive" || r.state === "lunge" || r.state === "pass" || r.state === "aim";
        view.dazed = r.state === "fallen";
        view.active = r.leader && !r.dead;
        view.head = r.state === "crouch" ? 0.3 : r.state === "dive" ? 0.25 : 0;

        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.scale(r.facing, 1);
        if (r.dead) {
          ctx.globalAlpha = max(0.35, 1 - r.time * 0.4);
          ctx.rotate(0.9);
        } else if (!r.leader) {
          ctx.scale(0.8, 0.8);
        }
        MQ.BossArt.reptavian(ctx, view);
        ctx.restore();

        if (r.state === "aim" || r.state === "crouch" || r.state === "lane") this.warn(ctx, r.x, r.y - 80);
        if (!r.leader || r.dead) continue;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(r.x - 45, r.y - 70, 90, 6);
        ctx.fillStyle = "#ffd45c";
        ctx.fillRect(r.x - 45, r.y - 70, 90 * (r.hp / r.maxHp), 6);
        this.drawFlash(ctx, r.x, r.y, 120);
      }
    }
  }

  /* ---------- 3. Krayt Dragon: read the ground, strike the open jaws. ---------- */

  class KraytDragon extends Boss {
    constructor(world, arena) {
      super(world, arena, {
        name: "KRAYT DRAGON", title: "The Devourer Below", sound: "Krayt",
        maxHp: 2700, thresholds: [0.66, 0.33], phaseNames: [null, "THE GROUND FRACTURES", "THE DRAGON'S FURY"],
      });
      this.parts.push(new Part(this), new Part(this));
      this.parts[0].priority = 1.6;
      this.view = {};
      this.headX = 140;
      this.headY = -220;
      this.mouth = 0;
      this.tilt = 0;
      this.depth = 0;
      this.move = 0;
      this.sweepX = 0;
    }

    think(dt) {
      const { player, stateTime: t, speed } = this;
      let hx = 120;
      let hy = -210 + sin(this.time * 2) * 14;
      let mouth = 0.1;
      let tilt = 0.1;
      let rate = 4;
      const rel = (player.x - this.x) * this.facing;

      switch (this.state) {
        case "idle":
          this.facePlayer();
          if (t > 1.2 / speed) this.choose();
          break;
        case "dive":
          hy = -60;
          tilt = 0.7;
          this.depth = approach(this.depth, 1, dt * 2.2);
          if (this.depth === 1) {
            this.setState("tunnel");
            this.world.sfx("crumble");
          }
          break;
        case "tunnel":
          // The mound tracks the player, then stops to give warning.
          if (t < 1.35 / speed) this.x = this.inArena(damp(this.x, player.x, 2.2 * speed, dt), 210);
          if (Math.random() < dt * 30) this.world.particles.dust(this.x + rand(-40, 40), this.arena.floor, "#b5814c", 2, 90);
          if (t > 2.05 / speed) {
            this.setState("erupt");
            this.facePlayer();
            this.roar();
            this.world.camera.shake(0.7);
            this.world.particles.chunks(this.x, this.arena.floor - 20, "#8a5a38", 26, 480);
            if (this.phase > 1) for (const side of [-1, 1]) this.strike("geyser", this.x + side * 240, 0.6, 16);
          }
          break;
        case "erupt":
          hx = 50;
          hy = -300;
          tilt = -0.7;
          mouth = 0.8;
          rate = 8;
          this.depth = approach(this.depth, 0, dt * 4);
          if (t < 0.45) this.hitArea(this.x - 95, this.y - 260, this.x + 95, this.y, 24, 420);
          if (t > 0.9) this.setState("idle");
          break;
        case "bite":
          if (t < 0.8 / speed) {
            hx = 20;
            hy = -230;
            mouth = 0.8;
            tilt = -0.2;
            if (t < 0.5) this.facePlayer();
          } else if (t < 0.8 / speed + 0.5) {
            this.once(0, 0, () => this.roar());
            hx = clamp(rel, 200, 360);
            hy = -55;
            mouth = t < 0.8 / speed + 0.3 ? 1 : 0.1;
            tilt = 0.2;
            rate = 12;
            this.hitHead(22);
          } else {
            hx = 250;
            hy = -70;
            mouth = 0.7;
            tilt = 0.25;
            rate = 2;
          }
          if (t > 0.8 / speed + 1.9) this.setState("idle");
          break;
        case "spit":
          hx = 90;
          hy = -250;
          mouth = 1;
          tilt = -0.15;
          for (let i = 0; i < 2 + this.phase; i++) this.once(i, 0.8 + i * 0.32, () => this.spit(i));
          if (t > 2.4) this.setState("idle");
          break;
        case "sweep": {
          const f = this.facing;
          if (t < 1) {
            hx = -90;
            hy = -55;
            mouth = 0.3;
            this.sweepX = -90;
          } else if (t < 1.7) {
            this.sweepX = lerp(-90, 430, (t - 1) / 0.7);
            hx = this.sweepX;
            hy = -46;
            mouth = 0.5;
            rate = 20;
            const x = this.x + f * this.sweepX;
            this.hitArea(x - 70, this.y - 88, x + 70, this.y, 20, 420);
            if (Math.random() < dt * 30) this.world.particles.dust(x, this.y, "#b5814c", 3, 130);
          } else {
            hx = 260;
            hy = -80;
            mouth = 0.6;
          }
          if (t > 2.7) this.setState("idle");
          break;
        }
        case "eruptions": {
          hx = 60;
          hy = -280;
          tilt = -0.6;
          mouth = 0.7;
          this.once(0, 0.5, () => {
            this.roar();
            const direction = Math.random() < 0.5 ? 1 : -1;
            const span = this.arena.x1 - this.arena.x0;
            const gap = Math.floor(rand(0, 6));
            for (let i = 0; i < 7; i++) {
              if (i === gap || i === gap + 1) continue;
              const k = direction > 0 ? i : 6 - i;
              this.strike("geyser", this.arena.x0 + ((k + 0.5) * span) / 7, 0.9 + i * 0.15, 17, 100);
            }
          });
          if (t > 2.4) this.setState("idle");
          break;
        }
        case "stunned":
          hx = 210;
          hy = -64;
          mouth = 0.85;
          tilt = 0.35 + sin(this.time * 3) * 0.1;
          if (t > 2.4) this.setState("idle");
          break;
      }

      this.headX = damp(this.headX, hx, rate, dt);
      this.headY = damp(this.headY, hy, rate, dt);
      this.mouth = damp(this.mouth, mouth, 9, dt);
      this.tilt = damp(this.tilt, tilt, 6, dt);
    }

    choose() {
      const cycle = [
        ["bite", "dive", "spit", "bite", "sweep", "dive"],
        ["sweep", "eruptions", "bite", "dive", "spit", "bite"],
        ["eruptions", "bite", "sweep", "dive", "bite", "spit"],
      ][this.phase - 1];
      let next = cycle[this.move++ % cycle.length];
      const distance = abs(this.player.x - this.x);
      // Burrow closer when the player is out of reach.
      if ((next === "bite" || next === "sweep") && distance > 480) next = "dive";
      this.facePlayer();
      this.setState(next);
    }

    hitHead(damage) {
      const x = this.x + this.facing * (this.headX + 55);
      const y = this.y + this.headY;
      this.hitArea(x - 75, y - 45, x + 75, y + 55, damage, 420);
    }

    spit(i) {
      const x = this.x + this.facing * (this.headX + 100);
      const y = this.y + this.headY + 20;
      const time = 0.9;
      const gravity = 800;
      const tx = this.player.x + (i - 1) * 90;
      const p = this.world.projectiles.fire(ENEMY, "spit", x, y, (tx - x) / time, (this.player.y - 30 - y) / time - 0.5 * gravity * time, 15, "#9cff57", 3);
      p.gravity = gravity;
      p.r = 13;
      this.roar();
    }

    onPhase() {
      for (let i = 0; i < 4; i++) this.strike("rock", rand(this.arena.x0, this.arena.x1), 0.9 + i * 0.2, 15);
    }

    push() {
      if (this.depth > 0.4 || this.state === "stunned" || !this.staggered(9)) return;
      this.setState("stunned");
      this.depth = 0;
    }

    onReset() {
      this.depth = 0;
      this.headX = 140;
      this.headY = -220;
    }

    introPose(k, dt) {
      this.depth = max(0, 1 - k * 3);
      this.mouth = damp(this.mouth, k > 0.35 ? 1 : 0, 6, dt);
      this.tilt = -0.3;
      this.headY = -250;
      if (k < 0.3 && Math.random() < dt * 20) this.world.particles.chunks(this.x, this.y - 10, "#8a5a38", 4);
    }

    updateDefeat(dt) {
      this.headX = damp(this.headX, 230, 2, dt);
      this.headY = damp(this.headY, -20, 2, dt);
      this.tilt = damp(this.tilt, 0.3, 2, dt);
    }

    updateParts() {
      const up = !this.dead && this.depth < 0.4;
      const open = this.mouth > 0.5;
      const sink = this.depth * 300;
      this.parts[0].set(this.x + this.facing * (this.headX + 40), this.y + this.headY + 55 + sink, 130, 110, open ? 1.6 : 0.75, up);
      this.parts[1].set(this.x - this.facing * 55, this.y, 115, clamp(-this.headY * 0.75, 80, 190), 0.45, up);
    }

    draw(ctx) {
      const { floor, x0, x1 } = this.arena;
      const { state, stateTime: t } = this;
      if (state === "sweep" && t < 1) {
        ctx.fillStyle = `rgba(255,83,72,${0.12 + t * 0.15})`;
        ctx.fillRect(this.facing > 0 ? this.x - 90 : this.x - 480, floor - 88, 570, 88);
      }
      if (this.depth < 0.99) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0 - 200, floor - 800, x1 - x0 + 400, 806);
        ctx.clip();
        ctx.translate(this.x, this.y + this.depth * 420);
        ctx.scale(this.facing, 1);
        const { view } = this;
        view.time = this.time;
        view.headX = this.headX;
        view.headY = this.headY;
        view.head = this.tilt;
        view.mouth = this.mouth;
        view.weak = this.mouth > 0.5;
        view.enraged = this.phase === 3;
        view.dazed = state === "stunned";
        MQ.BossArt.krayt(ctx, view);
        ctx.restore();
      }

      // The mound where it breaks the surface.
      for (let i = 0; i < 7; i++) {
        const lift = state === "tunnel" ? abs(sin(this.time * 16 + i)) * 12 : 4;
        oval(ctx, this.x - 75 + i * 25, floor, 26, 8 + lift, i % 2 ? "#8a5a38" : "#a06c42", "#553522", 1.5);
      }
      if (state === "tunnel") {
        glow(ctx, this.x, floor, 130, "#ff5348", clamp(t - 0.8, 0, 0.8));
        if (t > 1.35 / this.speed) this.warn(ctx, this.x, floor - 60, "MOVE");
        return;
      }
      const hx = this.x + this.facing * this.headX;
      const hy = this.y + this.headY;
      this.drawFlash(ctx, hx, hy, 130);
      if ((state === "bite" && t < 0.8 / this.speed) || (state === "spit" && t < 0.8)) this.warn(ctx, hx, hy - 90);
      else if (state === "sweep" && t < 1) this.warn(ctx, this.x, floor - 200, "JUMP");
    }
  }

  /* ---------- 4. Mythosaur: too strong to overpower, so strike when its head is low. ---------- */

  class Mythosaur extends Boss {
    constructor(world, arena) {
      super(world, arena, {
        name: "MYTHOSAUR", title: "The Living Legend", sound: "Mythosaur", barLabel: "RESOLVE",
        maxHp: 3000, thresholds: [0.66, 0.33], phaseNames: [null, "THE SANCTUARY TREMBLES", "THE LEGEND TESTS YOU"],
      });
      this.parts.push(new Part(this), new Part(this));
      this.parts[0].priority = 1.6;
      this.view = {};
      this.gait = 0;
      this.move = 0;
      this.headX = 190;
      this.headY = -185;
      this.tilt = 0;
    }

    think(dt) {
      const { stateTime: t, speed, player } = this;
      let hx = 190;
      let hy = -185;
      let tilt = 0;
      let rate = 4;
      const f = this.facing;

      switch (this.state) {
        case "idle": {
          this.facePlayer();
          if (abs(player.x - this.x) > 300) this.walk(this.facing * 70 * speed, dt);
          if (t > 1.3 / speed) this.choose();
          break;
        }
        case "stomp": {
          hy = -250;
          tilt = -0.2;
          const hit = 1.1 / speed;
          this.once(0, hit, () => {
            this.roar();
            this.shockwaves(this.x + f * 110, 19, 400 * speed, 42, "#58d6c2");
            this.world.level.collapse(this.arena.x0, this.arena.x1, this.phase);
          });
          if (this.phase > 1) this.once(1, hit + 0.55, () => this.shockwaves(this.x + f * 110, 19, 440 * speed, 42, "#58d6c2"));
          if (t > hit + 0.15) {
            hx = 215;
            hy = -80;
            tilt = 0.25;
            rate = 7;
          }
          if (t > hit + 1.9) this.setState("idle");
          break;
        }
        case "brace":
          hx = 200;
          hy = -95;
          tilt = 0.4;
          if (t > 1.2 / speed) {
            this.setState("charge");
            this.roar();
          }
          break;
        case "charge": {
          hx = 225;
          hy = -90;
          tilt = 0.4;
          rate = 10;
          this.walk(f * 580 * speed, dt, 2);
          this.hitArea(this.x + (f > 0 ? 100 : -330), this.y - 150, this.x + (f > 0 ? 330 : -100), this.y, 26, 480);
          if (Math.random() < dt * 25) this.world.particles.dust(this.x - f * 100, this.y, "#5f7c74", 3, 150);
          const wall = f > 0 ? this.arena.x1 - 310 : this.arena.x0 + 310;
          if ((wall - this.x) * f > 0) break;
          this.setState("rest");
          this.world.camera.shake(0.8);
          this.world.sfx("crumble");
          for (let i = 0; i < 2 + this.phase; i++) this.strike("rock", rand(this.arena.x0, this.arena.x1), 0.8 + i * 0.22, 16);
          break;
        }
        case "rest":
          hx = 225;
          hy = -74;
          tilt = 0.3;
          if (t > 2.3) this.setState("idle");
          break;
        case "sweep":
          if (t < 0.9 / speed) {
            hx = 170;
            hy = -120;
            tilt = 0.6;
          } else {
            hx = 240;
            hy = -75;
            tilt = -0.4;
            rate = 14;
            if (t < 0.9 / speed + 0.3) {
              this.once(0, 0, () => this.roar());
              this.hitArea(this.x + (f > 0 ? 90 : -420), this.y - 96, this.x + (f > 0 ? 420 : -90), this.y, 22, 460);
            }
          }
          if (t > 0.9 / speed + 1.2) this.setState("idle");
          break;
        case "bellow":
          hy = -240;
          tilt = -0.4;
          for (let i = 0; i < 3; i++) this.once(i, 0.9 + i * 0.55, () => this.bellowWave(i % 2 ? 130 : 36));
          if (t > 2.9) this.setState("idle");
          break;
      }

      this.headX = damp(this.headX, hx, rate, dt);
      this.headY = damp(this.headY, hy, rate, dt);
      this.tilt = damp(this.tilt, tilt, 6, dt);
    }

    choose() {
      const cycle = [
        ["stomp", "brace", "sweep"],
        ["brace", "stomp", "sweep", "bellow"],
        ["bellow", "stomp", "brace", "sweep"],
      ][this.phase - 1];
      let next = cycle[this.move++ % cycle.length];
      if (next === "sweep" && abs(this.player.x - this.x) > 450) next = "brace";
      this.facePlayer();
      this.setState(next);
    }

    // Waves alternate high and low.
    bellowWave(height) {
      const p = this.world.projectiles.fire(ENEMY, "slash", this.x + this.facing * 250, this.y - height, this.facing * 470, 0, 18, "#58d6c2", 3);
      p.r = 26;
      this.roar();
    }

    walk(velocity, dt, rate = 1) {
      this.x = this.inArena(this.x + velocity * dt, 305);
      this.gait += abs(velocity) * dt * 0.02 / rate;
    }

    push() {
      if (this.state === "sweep" || this.state === "bellow") {
        if (this.staggered(8)) this.setState("rest");
      } else {
        this.world.particles.label(this.x, this.y - 320, "Too powerful to push", "#b8c6d6", 18);
      }
    }

    // The head only counts as a weak point while the creature rests from an attack.
    get weak() {
      return this.headY > -125 && this.state !== "brace" && this.state !== "charge";
    }

    onReset() {
      this.x = this.inArena(this.arena.x1 - 340, 305);
      this.headY = -185;
    }

    introPose(k, dt) {
      this.headY = damp(this.headY, k < 0.35 ? -60 : -250, 4, dt);
      this.tilt = damp(this.tilt, k < 0.35 ? 0.4 : -0.35, 4, dt);
    }

    updateDefeat(dt) {
      // It yields rather than dying: a bow.
      this.headX = damp(this.headX, 225, 2, dt);
      this.headY = damp(this.headY, -50, 2, dt);
      this.tilt = damp(this.tilt, 0.5, 2, dt);
    }

    updateParts() {
      this.parts[0].set(this.x + this.facing * (this.headX + 30), this.y + this.headY + 75, 145, 150, this.weak ? 1.7 : 0.55, !this.dead);
      this.parts[1].set(this.x - this.facing * 30, this.y, 250, 230, 0.35, !this.dead);
    }

    draw(ctx) {
      const { view, state, stateTime: t } = this;
      const f = this.facing;
      if (state === "brace") {
        const end = f > 0 ? this.arena.x1 : this.arena.x0;
        ctx.fillStyle = `rgba(255,83,72,${0.1 + min(1, t) * 0.14})`;
        ctx.fillRect(min(this.x, end), this.y - 150, abs(end - this.x), 150);
      } else if (state === "sweep" && t < 0.9 / this.speed) {
        ctx.fillStyle = "rgba(255,83,72,0.2)";
        ctx.fillRect(f > 0 ? this.x + 90 : this.x - 420, this.y - 96, 330, 96);
      }

      view.time = this.time;
      view.gait = this.gait;
      view.headX = this.headX;
      view.headY = this.headY;
      view.head = this.tilt;
      view.moving = state === "charge" || (state === "idle" && abs(this.player.x - this.x) > 300);
      view.rear = state === "stomp" && t < 1.1 / this.speed ? min(1, t * 1.6) : 0;
      view.weak = this.weak && !this.dead;
      view.mouth = state === "bellow";
      view.enraged = this.phase === 3 && !this.dead;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(f, 1);
      MQ.BossArt.mythosaur(ctx, view);
      ctx.restore();
      this.drawFlash(ctx, this.x + f * this.headX, this.y + this.headY, 150);

      const hx = this.x + f * 200;
      if (state === "stomp" && t < 1.1 / this.speed) this.warn(ctx, hx, this.y - 310, "JUMP");
      else if (state === "brace") this.warn(ctx, hx, this.y - 280, "CHARGE");
      else if (state === "sweep" && t < 0.9 / this.speed) this.warn(ctx, hx, this.y - 280, "JUMP");
      else if (state === "bellow" && t < 0.9) this.warn(ctx, hx, this.y - 310);
    }
  }

  /* ---------- Imperial Guardian: armored until its reactor vents. ---------- */

  class Guardian extends Boss {
    constructor(world, arena) {
      super(world, arena, {
        name: "IMPERIAL GUARDIAN", title: "Fortress War Machine", sound: "Guardian",
        maxHp: 3400, thresholds: [0.66, 0.33], phaseNames: [null, "DRONE BAYS ONLINE", "REACTOR OVERLOAD"],
      });
      this.parts.push(new Part(this), new Part(this));
      this.view = {};
      this.gait = 0;
      this.move = 0;
      this.open = 0;
      this.aim = 0;
      this.slamAmount = 0;
    }

    think(dt) {
      const { stateTime: t, speed, player } = this;
      let open = 0;
      let slam = 0;

      switch (this.state) {
        case "idle":
          this.facePlayer();
          if (abs(player.x - this.x) > 280) this.walk(this.facing * 80 * speed, dt);
          this.aim = damp(this.aim, this.angleToPlayer(), 4, dt);
          if (t > 0.9 / speed) this.choose();
          break;
        case "volley":
          if (t < 0.6) {
            this.facePlayer();
            this.aim = damp(this.aim, this.angleToPlayer(), 9, dt);
          }
          for (let i = 0; i < 3 + this.phase; i++) this.once(i, 0.9 + i * 0.2, () => this.shot((i % 3) - 1));
          if (t > 2.3) this.setState("idle");
          break;
        case "slam": {
          const hit = 1.15 / speed;
          slam = t < hit ? min(0.5, t * 0.8) : 1;
          this.once(0, hit, () => {
            const x = this.x + this.facing * 118;
            this.roar();
            this.shockwaves(x, 19, 430 * speed, 40, "#ff9a5c");
            this.hitArea(x - 55, this.y - 150, x + 55, this.y, 24, 450);
          });
          if (t > hit + 0.9) this.setState("idle");
          break;
        }
        case "deploy":
          this.once(0, 0.8, () => this.deploy());
          if (t > 1.5) this.setState("idle");
          break;
        case "lanes":
          // Twin lanes, low then high.
          this.aim = damp(this.aim, 0, 6, dt);
          for (let i = 0; i < 6; i++) {
            this.once(i, 1 + i * 0.36, () => {
              const height = i % 2 ? 130 : 30;
              const p = this.world.projectiles.fire(ENEMY, "lance", this.x + this.facing * 90, this.y - height, this.facing * 620, 0, 17, "#ff5348", 3);
              p.r = 10;
              this.roar();
            });
          }
          if (t > 3.6) this.setState("idle");
          break;
        case "vent":
          open = 1;
          if (Math.random() < dt * 14) this.world.particles.smoke(this.x + rand(-40, 40), this.y - 220, "#9a9a9a", 1, 12);
          if (t > (this.phase === 3 ? 2.6 : 3.4)) this.setState("idle");
          break;
      }
      this.open = approach(this.open, open, dt * 4);
      this.slamAmount = approach(this.slamAmount, slam, dt * (slam === 1 ? 9 : 2.5));
    }

    choose() {
      const cycle = [
        ["volley", "slam", "vent"],
        ["deploy", "volley", "vent", "slam"],
        ["lanes", "slam", "vent", "deploy", "volley"],
      ][this.phase - 1];
      this.facePlayer();
      this.setState(cycle[this.move++ % cycle.length]);
    }

    walk(velocity, dt) {
      this.x = this.inArena(this.x + velocity * dt, 130);
      this.gait += abs(velocity) * dt * 0.03;
    }

    angleToPlayer() {
      return clamp(atan2(this.player.y - 45 - (this.y - 246), abs(this.player.x - this.x)), -0.6, 1.1);
    }

    shot(spread) {
      const a = this.aim + spread * 0.13;
      const f = this.facing;
      const x = this.x - f * 30 + f * cos(this.aim) * 84;
      const y = this.y - 246 + sin(this.aim) * 84;
      const p = this.world.projectiles.fire(ENEMY, "bolt", x, y, f * cos(a) * 590, sin(a) * 590, 15, "#ff5348", 2.5);
      p.r = 9;
      this.roar();
    }

    deploy() {
      const { world } = this;
      let drones = world.enemies.filter((e) => !e.dead).length;
      for (const side of [-1, 1]) {
        if (drones++ >= 3) break;
        world.spawn("probe", this.inArena(this.x + side * 80, 60), this.y - 230, { aggro: true, points: 0 });
      }
      this.roar();
    }

    push() {
      if (this.state === "vent" || !this.staggered(11)) return;
      this.setState("vent");
    }

    onReset() {
      this.open = 0;
      this.slamAmount = 0;
    }

    introPose(k) {
      this.slamAmount = k > 0.4 && k < 0.8 ? 0.5 : 0;
      this.aim = sin(k * 6) * 0.3;
    }

    updateDefeat(dt) {
      this.open = 1;
      this.slamAmount = approach(this.slamAmount, 1, dt);
      if (this.stateTime < 2.4 && Math.random() < dt * 5) {
        this.world.particles.explosion(this.x + rand(-80, 80), this.y - rand(30, 230), 0.8);
        this.world.sfx("explosion");
      }
    }

    updateParts() {
      const open = this.open > 0.5;
      const alive = !this.dead;
      this.parts[0].set(this.x + this.facing * 23, this.y - 130, 90, 92, open ? 2 : 0.3, alive);
      this.parts[0].priority = open ? 2 : 1;
      this.parts[1].set(this.x - this.facing * 20, this.y, 120, 245, open ? 0.6 : 0.3, alive);
    }

    draw(ctx) {
      const { view, state, stateTime: t } = this;
      if (state === "lanes" && t < 1) {
        const end = this.facing > 0 ? this.arena.x1 : this.arena.x0;
        ctx.fillStyle = "rgba(255,83,72,0.18)";
        for (const height of [30, 130]) ctx.fillRect(min(this.x, end), this.y - height - 10, abs(end - this.x), 20);
      }
      view.time = this.time;
      view.gait = this.gait;
      view.moving = state === "idle" && abs(this.player.x - this.x) > 280;
      view.open = this.open;
      view.slam = this.slamAmount;
      view.aim = this.aim;
      view.charge = (state === "volley" && t < 0.9) || (state === "lanes" && t < 1) ? min(1, t) : 0;
      view.dazed = this.dead;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(this.facing, 1);
      if (this.dead) ctx.rotate(min(1, t * 0.5) * 0.12);
      MQ.BossArt.guardian(ctx, view);
      ctx.restore();
      this.drawFlash(ctx, this.x, this.y - 170, 150);

      if (state === "slam" && t < 1.15 / this.speed) this.warn(ctx, this.x, this.y - 310, "JUMP");
      else if ((state === "volley" && t < 0.9) || (state === "lanes" && t < 1)) this.warn(ctx, this.x, this.y - 310);
      else if (state === "deploy" && t < 0.8) this.warn(ctx, this.x, this.y - 310, "DRONES");
    }
  }

  /* ---------- 5. Moff Gideon: three styles of fight. ---------- */

  class Gideon extends Boss {
    constructor(world, arena) {
      super(world, arena, {
        name: "MOFF GIDEON", title: "Wielder of the Darksaber", sound: "Gideon",
        maxHp: 6000, thresholds: [0.7, 0.35],
        phaseNames: ["IMPERIAL COMMANDER", "DARKSABER COMBAT", "FINAL SHOWDOWN"],
      });
      this.parts.push(new Part(this));
      this.actor = {
        pose: MQ.Anim.createPose(), time: 0, flow: 0, armed: "blaster",
        saber: MQ.DATA.saber("classic"), power: 0, rage: false,
      };
      this.w = 36;
      this.h = 92;
      this.resetMotion();
      this.lockX = this.x;
    }

    resetMotion() {
      this.vx = 0;
      this.vy = 0;
      this.grounded = true;
      this.gait = 0;
      this.move = 0;
      this.dodgeWait = 2;
      this.safe = 0;
      this.stormTime = 3;
    }

    get guarding() {
      return this.phase > 1 && this.state === "idle";
    }

    think(dt) {
      const { player, stateTime: t, speed } = this;
      this.dodgeWait -= dt;
      this.safe -= dt;
      let vx = 0;

      if (this.phase === 3) {
        this.stormTime -= dt;
        if (this.stormTime <= 0) {
          this.stormTime = 5.5;
          for (let i = 0; i < 3; i++) this.strike("bolt", player.x + (i - 1) * 210, 1.2 + i * 0.15, 17, 90);
        }
      }

      switch (this.state) {
        case "idle": {
          this.facePlayer();
          const distance = abs(player.x - this.x);
          if (this.phase === 1) {
            if (distance < 270) vx = -this.facing * 165;
            else if (distance > 480) vx = this.facing * 150;
            if (distance < 130 && this.dodgeWait <= 0) {
              this.escape();
              break;
            }
          } else if (distance > 170) {
            vx = this.facing * 190 * speed;
          }
          if (this.dodgeWait <= 0 && this.world.projectiles.threatens(this, 170) && Math.random() < (this.phase === 1 ? 0.6 : 0.3)) this.roll();
          else if (t > (this.phase === 1 ? 0.6 : 0.65) / speed) this.choose();
          break;
        }
        case "burst":
          for (let i = 0; i < 4; i++) this.once(i, 0.55 + i * 0.17, () => this.shootAtPlayer());
          if (t > 1.7) this.setState("idle");
          break;
        case "lanes":
          for (let i = 0; i < 4; i++) this.once(i, 0.75 + i * 0.36, () => this.shootFlat(i % 2 ? 78 : 26));
          if (t > 2.5) this.setState("idle");
          break;
        case "grenade":
          this.once(0, 0.65, () => this.throwGrenades());
          if (t > 1.4) this.setState("open");
          break;
        case "summon":
          this.once(0, 0.75, () => this.summon());
          if (t > 1.8) this.setState("idle");
          break;
        case "roll":
          vx = this.facing * -560;
          if (t > 0.36) this.setState("idle");
          break;
        case "leap":
          vx = this.vx;
          if (this.grounded && t > 0.15) this.setState("idle");
          break;
        case "combo": {
          const gap = 0.5 / speed;
          const start = 0.6 / speed;
          const index = Math.floor((t - start) / gap);
          if (t < start) {
            this.facePlayer();
          } else if (index < 3) {
            const local = t - start - index * gap;
            this.once(index, start + index * gap, () => {
              this.facePlayer();
              this.hasHit = false;
              this.roar();
            });
            if (local < 0.19) {
              vx = this.facing * 680;
              const reach = this.facing > 0 ? [-10, 125] : [-125, 10];
              this.hitArea(this.x + reach[0], this.y - 100, this.x + reach[1], this.y, 19, 320);
            }
          } else {
            this.setState("open");
          }
          break;
        }
        case "waves": {
          const count = this.phase + 1;
          for (let i = 0; i < count; i++) this.once(i, 0.7 / speed + i * 0.5, () => this.wave(i % 2 ? 94 : 26));
          if (t > 0.7 / speed + count * 0.5 + 0.2) this.setState("open");
          break;
        }
        case "slam":
          if (t < 0.4) this.lockX = player.x;
          this.once(0, 0.7 / speed, () => {
            this.vy = -850;
            this.vx = clamp((this.lockX - this.x) / 0.81, -850, 850);
            this.grounded = false;
            this.roar();
          });
          if (this.fired) {
            vx = this.vx;
            if (this.grounded && t > 0.7 / speed + 0.2) {
              this.hitArea(this.x - 85, this.y - 70, this.x + 85, this.y, 23, 420);
              this.shockwaves(this.x, 17, 460, 36, "#e8e8ff");
              this.setState("open");
            }
          }
          break;
        case "whirl":
          if (t < 0.75) this.facePlayer();
          else {
            vx = this.facing * 620;
            this.hitArea(this.x - 100, this.y - 92, this.x + 100, this.y, 22, 420);
            const atWall = this.x < this.arena.x0 + 70 || this.x > this.arena.x1 - 70;
            if (t > 1.6 || (atWall && t > 0.9)) this.setState("open");
          }
          break;
        case "starfall":
          this.once(0, 0.8, () => {
            const span = this.arena.x1 - this.arena.x0;
            const gap = Math.floor(rand(0, 6));
            for (let i = 0; i < 7; i++) {
              if (i !== gap && i !== gap + 1) this.strike("bolt", this.arena.x0 + ((i + 0.5) * span) / 7, 1.2, 18, 100);
            }
            this.roar();
          });
          this.once(1, 1.5, () => this.wave(26));
          if (t > 2.5) this.setState("open");
          break;
        case "open":
          if (t > (this.phase === 3 ? 1.15 : 1.4)) this.setState("idle");
          break;
        case "broken":
          if (t > 1.7) this.setState("idle");
          break;
        case "transition":
          if (t > 1.6) this.setState("idle");
          break;
      }

      this.vx = vx;
      this.physics(dt);
    }

    physics(dt) {
      this.vy = min(this.vy + MQ.DATA.PHYSICS.gravity * dt, 1050);
      this.x = this.inArena(this.x + this.vx * dt, 55);
      this.y += this.vy * dt;
      this.grounded = this.y >= this.arena.floor;
      if (this.grounded) {
        this.y = this.arena.floor;
        this.vy = 0;
      }
      this.gait += abs(this.vx) * dt * 0.034;
    }

    choose() {
      const cycle = [
        ["burst", "lanes", "grenade", "burst", "summon", "grenade"],
        ["combo", "waves", "slam"],
        ["whirl", "combo", "starfall", "slam", "waves", "combo"],
      ][this.phase - 1];
      this.facePlayer();
      this.setState(cycle[this.move++ % cycle.length]);
    }

    roll() {
      this.dodgeWait = 2.6;
      this.safe = 0.36;
      this.setState("roll");
      this.world.sfx("dodge");
    }

    escape() {
      const away = -this.facing;
      const room = away > 0 ? this.arena.x1 - this.x : this.x - this.arena.x0;
      if (room > 300) {
        this.roll();
        return;
      }
      // Cornered, so vault over the player.
      this.dodgeWait = 2;
      this.setState("leap");
      this.vy = -780;
      this.vx = this.facing * 520;
      this.grounded = false;
    }

    shootAtPlayer() {
      this.facePlayer();
      const x = this.x + this.facing * 42;
      const y = this.y - 72;
      const a = atan2(this.player.y - 45 - y, this.player.x - x) + rand(-0.05, 0.05);
      this.world.projectiles.fire(ENEMY, "bolt", x, y, cos(a) * 560, sin(a) * 560, 14, "#ff5348", 2.5);
      this.roar();
    }

    shootFlat(height) {
      const p = this.world.projectiles.fire(ENEMY, "bolt", this.x + this.facing * 40, this.y - height, this.facing * 540, 0, 15, "#ff8a3d", 3);
      p.r = 9;
      this.roar();
    }

    throwGrenades() {
      const gravity = 1000;
      for (let i = 0; i < 2; i++) {
        const time = 0.85 + i * 0.2;
        const x = this.x + this.facing * 20;
        const y = this.y - 75;
        const p = this.world.projectiles.fire(ENEMY, "grenade", x, y, (this.player.x + i * 110 - x) / time, (this.player.y - 10 - y) / time - 0.5 * gravity * time, 18, "#ff5348", 3);
        p.gravity = gravity;
        p.blast = 90;
      }
      this.roar();
    }

    summon() {
      const { world, arena } = this;
      if (world.enemies.filter((e) => !e.dead).length >= 2) return;
      world.spawn("stormtrooper", arena.x0 + 90, arena.floor, { aggro: true, points: 0 });
      world.spawn("stormtrooper", arena.x1 - 90, arena.floor, { aggro: true, points: 0 });
      world.sfx("transmission");
    }

    wave(height) {
      const p = this.world.projectiles.fire(ENEMY, "slash", this.x + this.facing * 60, this.y - height, this.facing * 560 * this.speed, 0, 18, "#ffffff", 3);
      p.r = 20;
      this.roar();
    }

    damage(amount, part, fromX, kind) {
      if (this.safe > 0 || this.state === "transition") return false;
      let dealt = amount;
      if (part.mult < 1) {
        const behind = fromX !== undefined && (fromX - this.x) * this.facing < 0;
        if (behind || kind === "blast" || kind === "force") dealt = amount * 2.5;
        else if (Math.random() < 0.35) {
          this.world.particles.sparks(this.x + this.facing * 30, this.y - 60, "#ffffff", 8);
          this.world.particles.label(this.x, this.y - 120, "BLOCKED", "#b8c6d6", 15);
        }
      }
      return super.damage(dealt, part);
    }

    onPhase() {
      this.setState("transition");
      this.move = 0;
      const { world } = this;
      for (const enemy of world.enemies) enemy.die(false);
      if (this.phase === 2) {
        world.sfx("saberOn");
        world.baby.release();
        world.say("Moff Gideon", "A blaster is for soldiers. You will fall to the Darksaber.");
        world.say("Baby G", "The cage is broken! Force Push can shatter Gideon's guard.");
      } else {
        world.say("Moff Gideon", "The Core will have the child, if I must burn this citadel to the ground!");
      }
    }

    push() {
      if (this.phase === 1) {
        if (this.staggered(7)) this.setState("open");
        return;
      }
      if (this.state === "transition" || this.state === "broken") return;
      if (this.staggered(this.phase === 3 ? 7.5 : 8)) this.setState("broken");
    }

    reset() {
      super.reset();
      this.resetMotion();
      if (this.phase === 1) this.world.cageBaby();
    }

    updateDefeat(dt) {
      this.vx = approach(this.vx, 0, 1200 * dt);
      this.physics(dt);
    }

    introPose(k) {
      this.actor.armed = k > 0.4 ? "saber" : null;
    }

    updateParts() {
      const open = this.state === "open" || this.state === "broken";
      const mult = this.guarding ? 0.3 : open ? 1.45 : 0.7;
      this.parts[0].set(this.x, this.y, 48, 96, mult, !this.dead);
    }

    draw(ctx) {
      const { actor, state, stateTime: t, speed } = this;
      const intro = !this.active && !this.dead;
      let anim = "idle";
      let action = null;
      let k = 0;
      let variant = 0;

      if (this.dead) anim = "dead";
      else if (state === "open" || state === "broken") anim = state === "open" ? "land" : "hurt";
      else if (state === "roll") anim = "dodge";
      else if (!this.grounded) anim = this.vy < 0 ? "jump" : "fall";
      else if (abs(this.vx) > 210) anim = "run";
      else if (abs(this.vx) > 20) anim = "walk";

      if (intro) {
        if (actor.armed) action = "point";
      } else if (!this.dead) {
        switch (state) {
          case "idle": action = this.phase === 1 ? "aim" : "guard"; break;
          case "burst":
          case "lanes": action = "aim"; break;
          case "grenade":
          case "waves":
            action = t < 0.6 ? "windup" : "swing";
            k = min(1, t / 0.6);
            break;
          case "summon":
          case "starfall":
          case "transition": action = "raise"; break;
          case "combo": {
            const local = t - 0.6 / speed;
            if (local < 0) action = "windup";
            else {
              action = "swing";
              variant = Math.floor(local / (0.5 / speed)) % 4;
              k = (local % (0.5 / speed)) / 0.28;
            }
            break;
          }
          case "slam":
            action = this.fired && this.vy > 0 ? "swing" : "windup";
            variant = 3;
            k = 0.7;
            break;
          case "whirl":
            action = t < 0.75 ? "windup" : "swing";
            k = (t * 4) % 1;
            break;
        }
      }

      actor.time = this.time;
      actor.flow = clamp((this.vx * this.facing) / 420, 0, 1);
      actor.rage = this.phase === 3;
      actor.power = this.phase === 3 ? 0.6 + sin(this.time * 9) * 0.2 : 0;
      if (!intro) actor.armed = this.phase > 1 ? "saber" : "blaster";
      MQ.Anim.human(actor.pose, anim, this.time, this.gait, t, action, clamp(k, 0, 1), variant, 0);

      if (state === "slam" && !this.fired) oval(ctx, this.lockX, this.arena.floor - 3, 85, 11, "rgba(255,83,72,0.4)");
      if ((state === "waves" && t < 0.7) || (state === "lanes" && t < 0.75)) {
        const end = this.facing > 0 ? this.arena.x1 : this.arena.x0;
        ctx.fillStyle = "rgba(255,83,72,0.16)";
        ctx.fillRect(min(this.x, end), this.y - 36, abs(end - this.x), 20);
      }
      if (state === "whirl" && t >= 0.75) oval(ctx, this.x, this.y - 50, 100, 18, null, "rgba(255,255,255,0.7)", 5);

      ctx.save();
      if (this.safe > 0) ctx.globalAlpha = 0.6;
      ctx.translate(this.x, this.y);
      ctx.scale(this.facing * 1.1, 1.1);
      MQ.CharacterArt.gideon(ctx, actor);
      ctx.restore();
      if (this.dead) return;

      this.drawFlash(ctx, this.x, this.y - 55, 80);
      const top = this.y - 120;
      if (state === "open" || state === "broken") {
        text(ctx, "OPENING!", this.x, top, 19, "#ffd45c", "center", 800);
        glow(ctx, this.x, this.y - 55, 80, "#ffd45c", 0.22 + sin(this.time * 14) * 0.1);
        return;
      }
      if (this.guarding) {
        ctx.beginPath();
        ctx.ellipse(this.x + this.facing * 20, this.y - 55, 32, 58, 0, this.facing > 0 ? -1.3 : Math.PI - 1.3, this.facing > 0 ? 1.3 : Math.PI + 1.3);
        ctx.strokeStyle = "rgba(220,235,255,0.5)";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      if (!intro) {
        const wind = { burst: 0.55, lanes: 0.75, grenade: 0.65, summon: 0.75, combo: 0.6 / speed, waves: 0.7 / speed, slam: 0.7 / speed, whirl: 0.75, starfall: 0.8 }[state];
        if (wind && t < wind) this.warn(ctx, this.x, top);
      }
    }
  }

  const TYPES = {
    mudhorn: Mudhorn,
    reptavians: Reptavians,
    krayt: KraytDragon,
    mythosaur: Mythosaur,
    guardian: Guardian,
    gideon: Gideon,
  };

  MQ.createBoss = (world, arena) => new TYPES[arena.boss](world, arena);
})(window.MQ);
