/*
 * The Grinch: movement (walk, sneak, boost), the loot sack and its three weight stages,
 * power-up timers, and how easy he is to spot and hear.
 */
(function (G) {
  "use strict";

  const BASE_SPEED = 235;
  const BOOST_TIME = 1.1;
  const BOOST_COOLDOWN = 3.2;

  class Player {
    constructor(game, x, y) {
      this.game = game;
      this.x = x;
      this.y = y;
      this.r = 15;
      this.vx = 0;
      this.vy = 0;
      this.dir = "down";
      this.phase = 0;
      this.speed01 = 0;
      this.mode = "idle";
      this.anim = null;
      this.animT = 0;
      this.animDur = 0;
      this.t = 0;
      this.sack = [];
      this.weight = 0;
      this.stun = 0;
      this.invuln = 0;
      this.boostT = 0;
      this.boostCd = 0;
      this.tangledT = 0; // the Christmas Light Chaos event
      this.inLights = false;
      this.onIce = false;
      this.belt = null;
      this.sneaking = false;
      this.powers = { slippers: 0, coat: 0, magnet: 0, maxdog: 0, sugar: 0 };
      this.slipT = 0;
    }

    get stage() {
      if (this.weight >= G.SACK_OVER) return 3;
      if (this.weight >= G.SACK_HEAVY) return 2;
      return 1;
    }

    get lootValue() {
      let v = 0;
      for (const e of this.sack) v += e.pts;
      return v;
    }

    addLoot(type, pts) {
      this.sack.push({ type, pts });
      this.weight += G.ITEMS[type].weight;
    }

    // Removes up to n random entries from the sack and returns them.
    dropLoot(n) {
      const out = [];
      for (let i = 0; i < n && this.sack.length; i++) {
        const k = Math.floor(Math.random() * this.sack.length);
        const e = this.sack.splice(k, 1)[0];
        this.weight -= G.ITEMS[e.type].weight;
        out.push(e);
      }
      this.weight = Math.max(0, this.weight);
      return out;
    }

    play(anim, dur) {
      this.anim = anim;
      this.animT = 0;
      this.animDur = dur;
    }

    // Undetectable: wearing the coat, or the short grace period after being caught.
    get hidden() {
      return this.powers.coat > 0 || this.invuln > 0;
    }

    // How far Whos can see him, as a multiple of their normal range.
    get rangeMult() {
      let m = 1;
      if (this.sneaking) m *= 0.55;
      else if (this.speed01 < 0.05) m *= 0.85;
      if (this.powers.slippers > 0) m *= 0.65;
      if (this.stage === 3) m *= 1.12;
      return m;
    }

    get susMult() {
      let m = 1;
      if (this.sneaking) m *= 0.5;
      if (this.powers.slippers > 0) m *= 0.6;
      return m;
    }

    // Whos hear him within this distance, even from behind.
    get noise() {
      if (this.hidden || this.sneaking) return 0;
      if (this.boostT > 0 || this.powers.sugar > 0) return 150;
      if (this.speed01 < 0.05) return 0;
      return this.stage === 3 ? 95 : 55;
    }

    update(dt, input, world) {
      this.t += dt;
      for (const k in this.powers) if (this.powers[k] > 0) this.powers[k] = Math.max(0, this.powers[k] - dt);
      if (this.invuln > 0) this.invuln -= dt;
      if (this.boostT > 0) this.boostT -= dt;
      if (this.boostCd > 0) this.boostCd -= dt;
      if (this.tangledT > 0) this.tangledT -= dt;
      if (this.slipT > 0) this.slipT -= dt;
      if (this.anim) {
        this.animT += dt / this.animDur;
        if (this.animT >= 1) {
          this.anim = null;
          this.animT = 0;
        }
      }

      this.inLights = !!world.zoneAt(world.lights, this.x, this.y);
      const wasIce = this.onIce;
      this.onIce = !!world.zoneAt(world.ice, this.x, this.y);
      if (this.onIce && !wasIce && this.speed01 > 0.4 && this.slipT <= 0) {
        this.game.audio.play("slip");
        this.slipT = 1.5;
      }
      this.belt = world.zoneAt(world.belts, this.x, this.y);

      let move = { x: 0, y: 0 };
      let sneakHeld = false;
      if (this.stun > 0) {
        this.stun -= dt;
      } else if (input) {
        move = input.getMove();
        sneakHeld = input.sneakHeld();
        if (input.consumeBoost()) this.tryBoost();
      }
      this.sneaking = sneakHeld && this.boostT <= 0 && this.powers.sugar <= 0;

      let speed = BASE_SPEED;
      if (this.sneaking) speed *= 0.55;
      if (this.boostT > 0) speed *= 1.65;
      if (this.powers.slippers > 0) speed *= 1.3;
      if (this.powers.sugar > 0) speed *= 2;
      if (this.stage === 2) speed *= 0.9;
      else if (this.stage === 3) speed *= 0.8;
      if (this.inLights) speed *= 0.5;
      if (this.tangledT > 0) speed *= 0.5;
      speed = Math.min(speed, BASE_SPEED * 2.3);

      const tx = move.x * speed;
      const ty = move.y * speed;
      const accel = this.onIce ? 1.6 : this.stun > 0 ? 5 : 16;
      const k = 1 - Math.exp(-accel * dt);
      this.vx += (tx - this.vx) * k;
      this.vy += (ty - this.vy) * k;

      let dx = this.vx * dt;
      let dy = this.vy * dt;
      if (this.belt) dx += this.belt.dir * this.belt.speed * dt;
      const hit = world.move(this, dx, dy);
      if (hit && this.onIce) {
        // Bounce gently off things while sliding.
        this.vx *= 0.5;
        this.vy *= 0.5;
      }

      const sp = Math.hypot(this.vx, this.vy);
      this.speed01 = sp / BASE_SPEED;
      if (sp > 25 && (Math.abs(tx) + Math.abs(ty) > 1 || this.onIce)) {
        const ax = Math.abs(tx) + Math.abs(ty) > 1 ? tx : this.vx;
        const ay = Math.abs(tx) + Math.abs(ty) > 1 ? ty : this.vy;
        this.dir = G.dirFromAngle(Math.atan2(ay, ax));
      }
      this.phase += dt * (sp / 9 + (this.stage === 3 ? 1 : 0)) * (this.stage === 3 ? 0.8 : 1);
      if (this.speed01 < 0.05) this.mode = "idle";
      else if (this.boostT > 0 || this.powers.sugar > 0) this.mode = "run";
      else if (this.sneaking) this.mode = "sneak";
      else this.mode = "walk";
      if (this.sneaking && this.speed01 < 0.05) this.mode = "sneak";

      // Dust behind a running Grinch.
      if (this.mode === "run" && Math.random() < dt * 20) this.game.particles.puff(this.x - this.vx * 0.05, this.y, 1, 5);
    }

    tryBoost() {
      if (this.boostCd > 0 || this.stun > 0) return false;
      this.boostT = BOOST_TIME;
      this.boostCd = BOOST_COOLDOWN;
      this.game.audio.play("boost");
      this.game.particles.puff(this.x, this.y, 8, 8);
      return true;
    }

    get boostReady() {
      return this.boostCd <= 0;
    }

    get boost01() {
      return this.boostCd <= 0 ? 1 : 1 - this.boostCd / BOOST_COOLDOWN;
    }

    draw(ctx) {
      let alpha = 1;
      if (this.powers.coat > 0) alpha = 0.35 + Math.sin(this.t * 10) * 0.1;
      if (this.invuln > 0 && this.stun <= 0) alpha *= Math.sin(this.t * 30) > 0 ? 1 : 0.35;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.globalAlpha = alpha;
      const full = Math.min(1.45, this.weight / G.SACK_OVER);
      G.Art.grinch(ctx, {
        dir: this.dir,
        t: this.t,
        phase: this.phase,
        speed01: this.stun > 0 ? 0 : this.speed01,
        mode: this.mode,
        anim: this.anim || (this.stun > 0 ? "caught" : null),
        animT: this.animT,
        sack: full,
        overloaded: this.stage === 3,
        tangled: this.inLights || this.tangledT > 0,
      });
      ctx.restore();
      // Sugar rush and slippers sparkle trail.
      if ((this.powers.sugar > 0 || this.powers.slippers > 0) && this.speed01 > 0.2 && Math.random() < 0.5) {
        this.game.particles.add({
          x: this.x + G.rand(-10, 10),
          y: this.y - G.rand(0, 30),
          kind: "star",
          size: 4,
          life: 0.5,
          color: this.powers.sugar > 0 ? "#ff7ad9" : "#c77dff",
        });
      }
    }
  }

  G.Player = Player;
})(window.GH);
