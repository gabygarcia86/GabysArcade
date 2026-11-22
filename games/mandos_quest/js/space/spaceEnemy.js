/*
 * Space enemies, from one fixed pool. A move decides where an enemy flies and its type
 * in spaceData.js decides how it attacks.
 */
(function (MQ) {
  const S = MQ.SPACE;
  const { clamp, approach, damp, glow, box, oval, line } = MQ.U;
  const { sin, cos, atan2, abs, min, PI } = Math;

  const MAX = 96;
  const WIND = 0.4; // The muzzle glows this long before every attack.
  const HOLD_FIRE = 160; // No attacks from closer than this.
  const ARMOR = 0.35;
  const TOP = 112;
  const BOTTOM = 612;

  // Each returns false once the enemy has left.
  const MOVES = {
    line(e, dt) {
      e.x -= e.speed * dt;
    },
    sine(e, dt) {
      e.x -= e.speed * dt;
      e.y = clamp(e.baseY + sin(e.age * e.freq) * e.amp, TOP, BOTTOM);
    },
    diagonal(e, dt) {
      e.x -= e.speed * dt;
      e.y += e.vy * dt;
      if ((e.y < TOP && e.vy < 0) || (e.y > BOTTOM && e.vy > 0)) e.vy *= -1;
    },
    // A turning wheel of ships.
    circle(e, dt) {
      e.anchor -= e.speed * 0.6 * dt;
      const a = e.offset + e.age * 1.5;
      e.x = e.anchor + cos(a) * e.amp;
      e.y = e.baseY + sin(a) * e.amp;
      return e.anchor > -e.amp - 80;
    },
    swarm(e, dt, world) {
      e.x -= e.speed * dt;
      const { player } = world;
      const goal = e.x > player.x + 140 ? player.y + sin(e.age * 2.4 + e.offset) * 85 : e.y;
      e.vy = damp(e.vy, clamp((goal - e.y) * 1.8, -190, 190), 3, dt);
      e.y = clamp(e.y + e.vy * dt, TOP, BOTTOM);
    },
    dive(e, dt, world) {
      if (e.step === 0) {
        e.x -= e.speed * 0.8 * dt;
        if (e.x < e.stopX) {
          e.step = 1;
          e.wait = 0.45;
          e.lockY = clamp(world.player.y, TOP, BOTTOM);
        }
      } else if (e.step === 1) {
        // A pause with a warning line, then the dive.
        e.x -= 30 * dt;
        e.wait -= dt;
        if (e.wait <= 0) e.step = 2;
      } else {
        e.x -= e.speed * 1.5 * dt;
        e.y = damp(e.y, e.lockY, 5, dt);
      }
    },
    retreat(e, dt, world) {
      if (e.step === 0) {
        e.x -= e.speed * 1.6 * dt;
        if (e.x <= e.stopX) e.step = 1;
      } else if (e.step === 1) {
        e.wait -= dt;
        e.y = approach(e.y, clamp(world.player.y + e.offset, TOP, BOTTOM), e.speed * 0.4 * dt);
        if (e.wait <= 0) e.step = 2;
      } else {
        e.x += e.speed * 2 * dt;
        return e.x < MQ.VW + e.rx + 20;
      }
    },
    // Passes along an edge, attacks from behind, then leaves the way it came.
    loop(e, dt, world) {
      const high = e.baseY < 360;
      if (e.step === 0) {
        e.x -= e.speed * 1.4 * dt;
        if (e.x <= e.stopX) {
          e.step = 1;
          e.face = 1;
        }
      } else if (e.step === 1) {
        e.wait -= dt;
        const limit = high ? min(world.player.y, 440) : Math.max(world.player.y, 280);
        e.y = approach(e.y, clamp(limit, TOP, BOTTOM), 120 * dt);
        if (e.wait <= 0) e.step = 2;
      } else {
        e.y = approach(e.y, e.baseY, 420 * dt);
        if (abs(e.y - e.baseY) < 30) e.x += e.speed * 1.6 * dt;
        return e.x < MQ.VW + e.rx + 20;
      }
    },
    // Big ships: arrive, hold their ground, and leave if not destroyed in time.
    station(e, dt) {
      if (e.step === 0) {
        e.x -= e.speed * 2.6 * dt;
        if (e.x <= e.stopX) e.step = 1;
      } else if (e.step === 1) {
        e.wait -= dt;
        e.y = e.baseY + sin(e.age * 0.7) * e.amp;
        if (e.wait <= 0) e.step = 2;
      } else {
        e.y -= 120 * dt;
        return e.y > -e.ry - 40;
      }
    },
    surface(e, dt, world) {
      e.x -= world.speed * dt;
    },
    orbit(e, dt) {
      if (!e.parent.active || e.parent.serial !== e.parentSerial) return false;
      const a = e.offset + e.age * e.freq;
      e.x = e.parent.x + cos(a) * e.amp;
      e.y = e.parent.y + sin(a) * e.amp;
      return true;
    },
  };

  const FIRE = {
    aim(e, world) {
      world.projectiles.orb(e.muzzle, e.y, e.aim(world.player), e.shot, e.damage);
    },
    burst(e, world) {
      world.projectiles.orb(e.muzzle, e.y, e.aim(world.player), e.shot, e.damage);
      if (++e.volley < 3) e.cooldown = 0.13;
      else e.volley = 0;
    },
    fan(e, world) {
      world.projectiles.fan(e.muzzle, e.y, e.aim(world.player), world.tier > 2 ? 5 : 3, 0.22, e.shot, e.damage);
    },
    bomb(e, world) {
      world.projectiles.bomb(e.x - 20, e.y + 12, e.aim(world.player), e.shot, e.damage);
    },
    seeker(e, world) {
      world.projectiles.guided(e.muzzle, e.y, e.aim(world.player), e.shot, e.damage);
    },
    ring(e, world) {
      e.volley++;
      world.projectiles.ring(e.x, e.y, 12 + world.tier * 2, e.shot, e.damage, e.volley * 0.3, e.aim(world.player) + (e.volley % 2 ? 0.45 : -0.45));
    },
    launch(e, world) {
      e.volley++;
      if (e.volley % 2) {
        const options = world.enemies.options;
        options.move = "swarm";
        options.offset = e.volley;
        options.capsule = e.volley % 4 === 1;
        world.enemies.spawn("drone", e.x - 60, e.y + e.ry, options);
        world.enemies.clearOptions();
      } else {
        world.projectiles.fan(e.muzzle, e.y, e.aim(world.player), 5, 0.2, e.shot, e.damage);
      }
    },
    broadside(e, world) {
      e.volley++;
      const top = e.volley % 2 === 1;
      const y = e.y + (top ? -e.ry : e.ry) * 0.65;
      if (e.volley % 4 === 0) {
        world.projectiles.guided(e.x - 90, y, top ? -2.5 : 2.5, 230, e.damage);
        world.projectiles.guided(e.x - 60, e.y, PI, 230, e.damage);
      } else {
        world.projectiles.fan(e.x - 120, y, e.aim(world.player), 5, 0.19, e.shot, e.damage);
      }
    },
  };

  class SpaceEnemy {
    constructor() {
      this.active = false;
      this.serial = 0;
      this.def = S.ENEMIES.fighter;
      this.x = this.y = this.vy = this.rx = this.ry = 0;
    }

    reset(world, kind, x, y, options) {
      const def = S.ENEMIES[kind];
      this.world = world;
      this.active = true;
      this.serial++;
      this.kind = kind;
      this.def = def;
      this.x = this.anchor = x;
      this.y = this.baseY = y;
      this.rx = def.rx;
      this.ry = def.ry;
      this.move = options.move || "line";
      this.speed = (options.speed || def.speed) * world.enemyPace;
      this.vy = options.vy ?? 0;
      this.amp = options.amp ?? 70;
      this.freq = options.freq ?? 2.2;
      this.offset = options.offset ?? 0;
      this.stopX = options.stopX ?? 900;
      this.wait = options.hold ?? 3;
      this.hp = this.maxHp = options.hp || Math.round(def.hp * world.enemyHealth);
      this.shot = def.shot * world.shotPace;
      this.damage = def.damage;
      this.capsule = !!options.capsule;
      this.ceiling = !!options.ceiling;
      this.group = options.group || 0;
      this.boss = options.boss || "";
      this.parent = options.parent || null;
      this.parentSerial = this.parent?.serial ?? 0;
      this.step = 0;
      this.age = 0;
      this.face = -1;
      this.flash = 0;
      this.volley = 0;
      this.lockY = y;
      this.winding = 0;
      this.shielded = false;
      this.entered = false;
      this.cooldown = (0.5 + Math.random() * 0.8) * (def.every / 2.2);
    }

    get hittable() {
      return this.active && this.x - this.rx < MQ.VW - 8;
    }

    get surface() {
      return this.def.surface;
    }

    get muzzle() {
      return this.x + this.face * this.rx * 0.8;
    }

    aim(player) {
      return atan2(player.y - this.y, player.x - this.x);
    }

    update(dt) {
      const { world, def } = this;
      this.age += dt;
      this.flash -= dt;
      const alive = MOVES[this.move](this, dt, world);
      if (alive === false || (alive !== true && this.x < -this.rx - 40)) {
        this.active = false;
        return;
      }
      this.shielded = !!this.group && this.kind !== "generator" && world.enemies.generatorsLeft(this.group) > 0;
      if (def.fire) this.attack(dt);
    }

    attack(dt) {
      const { world, def } = this;
      const { player } = world;
      if (this.winding > 0) {
        this.winding -= dt;
        if (this.winding <= 0) {
          this.cooldown = (def.every * (0.85 + Math.random() * 0.3)) / world.aggression;
          FIRE[def.fire](this, world);
          world.sfx("enemyShot");
        }
        return;
      }
      this.cooldown -= dt;
      if (this.cooldown > 0) return;
      const onScreen = this.x > 30 && this.x < MQ.VW - 20 && this.y > S.FIELD.top;
      if (!onScreen || !world.hostile || player.dead) return;
      const tooClose = !def.heavy && abs(player.x - this.x) < HOLD_FIRE && abs(player.y - this.y) < HOLD_FIRE;
      // Straight fliers don't shoot back once they're past.
      const passed = this.face < 0 && !def.heavy && !def.surface && this.x < player.x;
      if (tooClose || passed) return;
      // The rest of a burst needs no second warning.
      this.winding = this.volley && def.fire === "burst" ? 0.01 : WIND;
    }

    hurt(amount, kind, fromX = -Infinity) {
      if (!this.hittable) return false;
      const { world } = this;
      if (this.shielded) {
        world.particles.sparks(this.x - this.rx, this.y, "#58d6c2", 4);
        world.sfx("shieldHit");
        return true;
      }
      let damage = amount;
      if (this.def.armored && kind === "bolt" && fromX < this.x) {
        damage *= ARMOR;
        world.particles.sparks(this.x - this.rx, this.y, "#d5dde6", 3);
      }
      this.hp -= damage;
      this.flash = 0.07;
      if (this.hp <= 0) this.destroy();
      else world.sfx("enemyHit");
      return true;
    }

    destroy(reward = true) {
      if (!this.active) return;
      this.active = false;
      const { world, def } = this;
      world.particles.explosion(this.x, this.y, clamp(this.rx / 45, 0.5, 2.2));
      if (def.heavy) {
        world.particles.chunks(this.x, this.y, "#6a737d", 14, 300);
        world.shake(this.rx > 100 ? 0.8 : 0.3);
      }
      world.sfx(def.heavy ? "shipExplosion" : "shipPop");
      if (reward) world.enemyDestroyed(this);
    }

    draw(ctx, time) {
      const { def, x, y } = this;
      if (this.move === "dive" && this.step === 1) line(ctx, x - this.rx, y, 0, this.lockY, "rgba(255,90,90,0.4)", 2);
      if (this.move === "orbit" && this.parent.active) line(ctx, x, y, this.parent.x, this.parent.y, "rgba(88,214,194,0.35)", 3);

      if (this.capsule) glow(ctx, x, y, this.rx + 26, "#ffc84d", 0.5 + sin(time * 8) * 0.25);
      MQ.SpaceArt.enemy(ctx, def.art, x, y, this.face, this.flash > 0, this.ceiling, this.move === "circle" ? 0 : clamp(this.vy / 900, -0.2, 0.2));
      if (this.capsule) oval(ctx, x, y - this.ry - 9, 4, 4, "#ffc84d", "#3a2708", 1.5);

      if (this.shielded) oval(ctx, x, y, this.rx + 16, this.ry + 16, "rgba(88,214,194,0.12)", "#58d6c2", 2 + sin(time * 10));
      if (this.winding > 0) glow(ctx, this.muzzle, y, 12 + (1 - this.winding / WIND) * 20, "#ff4f7d", 0.95);
      if (def.heavy && !this.boss && this.hp < this.maxHp) {
        box(ctx, x - 26, y - this.ry - 14, 52, 5, 2, "rgba(6,9,16,0.8)");
        box(ctx, x - 25, y - this.ry - 13, 50 * Math.max(0, this.hp / this.maxHp), 3, 1, "#ff6a5c");
      }
    }
  }

  class SpaceEnemyPool {
    constructor(world) {
      this.world = world;
      this.items = Array.from({ length: MAX }, () => new SpaceEnemy());
      // Reused whenever game code spawns an enemy mid-fight.
      this.options = {};
      this.clearOptions();
    }

    clearOptions() {
      const o = this.options;
      o.move = "line";
      o.offset = 0;
      o.capsule = false;
      o.stopX = 900;
      o.hold = 3;
      o.amp = 70;
      o.speed = 0;
    }

    spawn(kind, x, y, options) {
      for (let i = 0; i < MAX; i++) {
        const e = this.items[i];
        if (e.active) continue;
        e.reset(this.world, kind, x, y, options || this.options);
        return e;
      }
      return null;
    }

    generatorsLeft(group) {
      let count = 0;
      for (let i = 0; i < MAX; i++) {
        const e = this.items[i];
        if (e.active && e.group === group && e.kind === "generator") count++;
      }
      return count;
    }

    count() {
      let count = 0;
      for (let i = 0; i < MAX; i++) if (this.items[i].active) count++;
      return count;
    }

    // Everything left bursts, as when a boss goes down.
    destroyAll() {
      for (let i = 0; i < MAX; i++) this.items[i].destroy?.(false);
    }

    clear() {
      for (let i = 0; i < MAX; i++) this.items[i].active = false;
    }

    update(dt) {
      for (let i = 0; i < MAX; i++) if (this.items[i].active) this.items[i].update(dt);
    }

    draw(ctx, time) {
      for (let i = 0; i < MAX; i++) if (this.items[i].active) this.items[i].draw(ctx, time);
    }
  }

  MQ.SpaceEnemy = SpaceEnemy;
  MQ.SpaceEnemyPool = SpaceEnemyPool;
})(window.MQ);
