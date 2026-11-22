/* Mando's gunship: flight, hull, both shields, and losing a life. */
(function (MQ) {
  const S = MQ.SPACE;
  const SHIP = S.SHIP;
  const { clamp, approach, damp, glow, oval } = MQ.U;
  const { hypot, sin, max, min } = Math;

  class SpacePlayer {
    constructor(world) {
      this.world = world;
      this.stats = world.stats;
      this.rx = SHIP.rx;
      this.ry = SHIP.ry;
      this.x = SHIP.startX;
      this.y = SHIP.startY;
      this.vx = 0;
      this.vy = 0;
      this.maxHp = this.stats.maxHp;
      this.hp = this.maxHp;
      this.energyMax = this.stats.shield;
      this.energy = 0;
      this.deflector = 0;
      this.deflectorTime = 0;
      this.charges = S.DEFLECTOR.charges;
      this.chargeTime = 0;
      this.safeTime = 2;
      this.warpTime = SHIP.warpIn;
      this.deadTime = 0;
      this.dead = false;
      this.tilt = 0;
      this.flash = 0;
      this.time = 0;
      this.mood = "idle";
      this.moodTime = 0;
      this.view = { time: 0, thrust: 1, hp: 1, flash: false, mood: "idle", look: null, levels: null, vanguard: false, muzzle: false };
      this.weapons = new MQ.SpaceWeaponManager(world, this);
    }

    get controllable() {
      return !this.dead && this.warpTime <= 0 && !this.world.frozen;
    }

    get invulnerable() {
      return this.dead || this.safeTime > 0 || this.warpTime > 0 || this.world.protected;
    }

    get speed() {
      return this.stats.speed + this.weapons.levels.speed * SHIP.speedStep;
    }

    react(mood, seconds) {
      this.mood = mood;
      this.moodTime = seconds;
    }

    raiseEnergyShield() {
      this.energy = this.energyMax;
    }

    update(input, dt) {
      this.time += dt;
      this.safeTime -= dt;
      this.warpTime -= dt;
      this.flash -= dt;
      this.moodTime -= dt;
      if (this.moodTime <= 0) this.mood = this.hp < this.maxHp * 0.25 ? "worried" : "idle";

      // Queued presses are always consumed, so none fire late.
      const secondary = input.take("force");
      const upgrade = input.take("switch");
      const shield = input.take("dodge");
      input.take("attack");
      input.take("jump");
      input.take("up");
      input.take("down");
      input.takeTapDodge();

      if (this.dead) {
        this.deadTime += dt;
        return;
      }

      const active = this.controllable;
      this.fly(active ? input : null, dt);
      if (active) {
        if (shield) this.deflect();
        if (upgrade) this.world.activateUpgrade();
      }
      this.weapons.update(active && (input.held.attack || input.held.jump), active && secondary, dt);

      this.deflectorTime -= dt;
      if (this.deflectorTime <= 0) this.deflector = 0;
      if (this.charges < S.DEFLECTOR.charges) {
        this.chargeTime += dt;
        if (this.chargeTime >= S.DEFLECTOR.recharge) {
          this.chargeTime = 0;
          this.charges++;
        }
      }
      this.trail(dt);
    }

    fly(input, dt) {
      let ax = 0;
      let ay = 0;
      if (input) {
        ax = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0) + input.stick.x;
        ay = (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0) + input.stick.y;
        const length = hypot(ax, ay);
        if (length > 1) {
          ax /= length;
          ay /= length;
        }
      }
      const { speed } = this;
      this.vx = approach(this.vx, ax * speed, (ax ? SHIP.accel : SHIP.brake) * dt);
      this.vy = approach(this.vy, ay * speed, (ay ? SHIP.accel : SHIP.brake) * dt);

      const x = this.x + this.vx * dt;
      const y = this.y + this.vy * dt;
      this.x = clamp(x, SHIP.minX, SHIP.maxX);
      this.y = clamp(y, SHIP.minY, SHIP.maxY);
      if (this.x !== x) this.vx = 0;
      if (this.y !== y) this.vy = 0;
      this.tilt = damp(this.tilt, (this.vy / speed) * 0.2, 10, dt);
    }

    trail(dt) {
      const { particles } = this.world;
      if (Math.random() < dt * 40) particles.exhaust(this.x - 62, this.y + (Math.random() < 0.5 ? -16 : 12), "#8fe6ff");
      const health = this.hp / this.maxHp;
      if (health < 0.5 && Math.random() < dt * (health < 0.25 ? 26 : 10)) {
        particles.smoke(this.x - 30, this.y - 8, health < 0.25 ? "#5a4038" : "#4b4b55", 1, 7);
        if (health < 0.25) particles.sparks(this.x - 20, this.y, "#ffb04d", 2, 180);
      }
    }

    deflect() {
      if (this.deflector > 0) return;
      if (!this.charges) {
        this.world.sfx("empty");
        return;
      }
      this.charges--;
      this.deflector = S.DEFLECTOR.absorb;
      this.deflectorTime = S.DEFLECTOR.time;
      this.react("force", 1.2);
      this.world.particles.ring(this.x, this.y, 110, "#7fd4ff", 0.35);
      this.world.sfx("shieldUp");
    }

    hurt(amount) {
      if (this.invulnerable) return false;
      let left = Math.max(1, Math.round(amount * this.world.difficulty.hurt * this.world.threat));
      let shielded = false;

      if (this.deflector > 0) {
        const taken = min(this.deflector, left);
        this.deflector -= taken;
        left -= taken;
        shielded = true;
      }
      if (left > 0 && this.energy > 0) {
        const taken = min(this.energy, left);
        this.energy -= taken;
        left -= taken;
        shielded = true;
        if (!this.energy) this.weapons.levels.shield = 0;
      }

      const { particles } = this.world;
      if (left <= 0) {
        this.safeTime = SHIP.shieldSafe;
        particles.sparks(this.x + 30, this.y, "#9fd8ff", 10);
        this.world.sfx("shieldHit");
        return true;
      }

      this.hp = max(0, this.hp - left);
      this.safeTime = SHIP.hitSafe;
      this.flash = 0.16;
      particles.sparks(this.x, this.y, shielded ? "#9fd8ff" : "#ff8a70", 16);
      particles.label(this.x, this.y - 52, `-${left}`, "#ff8a70");
      this.world.shake(0.3);
      this.world.sfx("shipHit");
      this.react("worried", 1.6);
      if (!this.hp) this.die();
      return true;
    }

    die() {
      this.dead = true;
      this.deadTime = 0;
      this.deflector = 0;
      this.energy = 0;
      this.vx = this.vy = 0;
      this.world.particles.explosion(this.x, this.y, 1.5);
      this.world.particles.chunks(this.x, this.y, "#9da5ab", 18, 380);
      this.world.shake(0.8);
      this.world.sfx("shipDown");
      this.world.playerDied();
    }

    respawn() {
      this.dead = false;
      this.x = SHIP.startX;
      this.y = SHIP.startY;
      this.hp = this.maxHp;
      this.tilt = 0;
      this.energy = 0;
      this.charges = S.DEFLECTOR.charges;
      this.warpTime = SHIP.warpIn;
      this.safeTime = SHIP.respawnSafe;
      this.weapons.loseLife(S.KEEP_ON_DEATH[this.world.difficultyId]);
      this.weapons.levels.shield = 0;
      this.react("happy", 1.5);
    }

    heal(amount) {
      const gained = Math.round(min(amount, this.maxHp - this.hp));
      this.hp += gained;
      return gained;
    }

    draw(ctx) {
      if (this.dead) return;
      const { view, weapons, world } = this;
      const warp = max(0, this.warpTime / SHIP.warpIn);
      view.time = this.time;
      view.thrust = 0.75 + max(0, this.vx / this.speed) * 0.5;
      view.hp = this.hp / this.maxHp;
      view.flash = this.flash > 0;
      view.mood = world.victory ? "victory" : this.mood;
      view.look = world.look;
      view.levels = weapons.levels;
      view.vanguard = this.stats.vanguard;
      view.muzzle = weapons.muzzle > 0;

      const blink = this.safeTime > 0 && !warp && (this.time * 12) % 1 < 0.35;
      ctx.save();
      ctx.globalAlpha = (1 - warp) * (blink ? 0.45 : 1);
      ctx.translate(this.x, this.y);
      ctx.rotate(this.tilt);
      ctx.scale(1 + warp * 1.2, 1 - warp * 0.6);
      MQ.SpaceArt.player(ctx, view);
      ctx.restore();
      if (warp) glow(ctx, this.x, this.y, 150 * warp, "#8fe6ff", 0.9);

      if (this.energy > 0) {
        const k = this.energy / this.energyMax;
        oval(ctx, this.x + 6, this.y - 4, 82, 46, `rgba(150,170,255,${0.06 + k * 0.1})`, "rgba(190,205,255,0.75)", 1 + k * 2.5);
      }
      if (this.deflector > 0) {
        const fading = this.deflectorTime < 0.8 && (this.time * 10) % 1 < 0.5;
        if (!fading) {
          oval(ctx, this.x + 6, this.y - 4, 92 + sin(this.time * 16) * 2, 54, "rgba(110,220,255,0.14)", "#8fe6ff", 3);
        }
      }
      if (weapons.beam > 0) this.drawBeam(ctx);
    }

    drawBeam(ctx) {
      const { levels, beam } = this.weapons;
      if (!levels.laser) return;
      const x = this.x + 70;
      const half = S.PRIMARY.laserWidth[levels.laser - 1] * clamp(beam / S.PRIMARY.laserTime, 0.25, 1);
      ctx.fillStyle = "rgba(190,120,255,0.4)";
      ctx.fillRect(x, this.y - half * 1.6, MQ.VW - x, half * 3.2);
      ctx.fillStyle = "#d9b3ff";
      ctx.fillRect(x, this.y - half * 0.7, MQ.VW - x, half * 1.4);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, this.y - half * 0.25, MQ.VW - x, half * 0.5);
      glow(ctx, x, this.y, 34, "#c58cff", 0.9);
    }
  }

  MQ.SpacePlayer = SpacePlayer;
})(window.MQ);
