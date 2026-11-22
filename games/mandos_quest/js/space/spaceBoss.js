/*
 * The three space bosses. Each has three phases. Every attack winds up first with a
 * charging muzzle, or with a marked lane for beams, then leaves an opening.
 */
(function (MQ) {
  const { clamp, damp, glow, oval, line } = MQ.U;
  const { sin, cos, atan2, abs, max, min, PI } = Math;
  const TAU = MQ.TAU;

  const INTRO = 2.8;
  const PHASE_PAUSE = 1.4;
  const CONTACT = 20;
  const ESCORT_EVERY = 8;
  const LANES = 6;

  class Part {
    constructor(boss, id, ox, oy, rx, ry, hp, options = {}) {
      this.boss = boss;
      this.id = id;
      this.ox = ox;
      this.oy = oy;
      this.rx = rx;
      this.ry = ry;
      this.hp = this.maxHp = Math.round(hp * boss.world.bossHealth);
      this.name = options.name || "";
      this.core = !!options.core;
      this.weapon = !!options.weapon; // Must go before the core can be hurt.
      this.surface = false;
      this.flash = 0;
      this.x = boss.x + ox;
      this.y = boss.y + oy;
    }

    get active() {
      return this.hp > 0 && !this.boss.dead;
    }

    get shielded() {
      return this.core && !this.boss.exposed;
    }

    get hittable() {
      return this.active && this.x < MQ.VW + this.rx * 0.5;
    }

    hurt(amount) {
      return this.boss.damage(this, amount);
    }
  }

  class SpaceBoss {
    constructor(world, spec) {
      this.world = world;
      this.spec = spec;
      this.name = spec.name;
      this.x = MQ.VW + spec.halfWidth + 60;
      this.y = spec.y;
      this.time = 0;
      this.phase = 1;
      this.state = "intro";
      this.stateTime = 0;
      this.dead = false;
      this.attack = null;
      this.move = 0;
      this.ticks = 0;
      this.escortTime = ESCORT_EVERY * 0.5;
      this.escorts = 0;
      this.aimed = PI;
      this.lanes = Array.from({ length: LANES }, () => ({ active: false, on: false, y: 0, h: 0 }));
      this.parts = spec.parts.map(([id, ox, oy, rx, ry, hp, options]) => new Part(this, id, ox, oy, rx, ry, hp, options));
      this.core = this.parts.find((part) => part.core);
      this.weapons = this.parts.filter((part) => part.weapon);
    }

    get exposed() {
      for (let i = 0; i < this.weapons.length; i++) if (this.weapons[i].hp > 0) return false;
      return true;
    }

    get vulnerable() {
      return !this.dead && this.state !== "intro" && this.state !== "shift";
    }

    // For the health bar: the outer systems and the core together.
    get health() {
      let hp = 0;
      let total = 0;
      for (let i = 0; i < this.parts.length; i++) {
        hp += max(0, this.parts[i].hp);
        total += this.parts[i].maxHp;
      }
      return hp / total;
    }

    get status() {
      if (this.exposed) return `PHASE ${this.phase} OF 3`;
      let left = 0;
      for (let i = 0; i < this.weapons.length; i++) if (this.weapons[i].hp > 0) left++;
      return `${left} ${this.spec.systems} LEFT`;
    }

    alive(id) {
      for (let i = 0; i < this.parts.length; i++) if (this.parts[i].id === id) return this.parts[i].hp > 0;
      return false;
    }

    part(id) {
      for (let i = 0; i < this.parts.length; i++) if (this.parts[i].id === id) return this.parts[i];
      return this.core;
    }

    setState(state) {
      this.state = state;
      this.stateTime = 0;
    }

    skipIntro() {
      if (this.state === "intro" && this.stateTime > 0.5) this.stateTime = INTRO;
    }

    damage(part, amount) {
      if (!part.active) return false;
      const { world } = this;
      if (!this.vulnerable || part.shielded) {
        world.particles.sparks(part.x - part.rx, part.y, "#58d6c2", 3);
        world.sfx("shieldHit");
        return true;
      }
      let damage = amount;
      // One huge volley can't skip a phase.
      if (part.core) {
        const next = this.spec.thresholds[this.phase - 1];
        if (next) damage = min(damage, part.hp - part.maxHp * next + 1);
      }
      part.hp = max(0, part.hp - damage);
      part.flash = 0.07;
      world.sfx("enemyHit");

      if (part.core) {
        if (part.hp <= 0) this.die();
        else this.checkPhase();
      } else if (part.hp <= 0) {
        world.particles.explosion(part.x, part.y, 1.1);
        world.sfx("shipExplosion");
        world.shake(0.5);
        world.addPoints(1000, part.x, part.y);
        world.powerUps.drop(MQ.SpacePowerUps.CAPSULE, part.x - 60, part.y);
        if (this.exposed) this.nextPhase();
      }
      return true;
    }

    checkPhase() {
      const next = this.spec.thresholds[this.phase - 1];
      if (next && this.core.hp <= this.core.maxHp * next + 1) this.nextPhase();
    }

    nextPhase() {
      const { world } = this;
      this.phase++;
      this.move = 0;
      this.cancelAttack();
      this.setState("shift");
      world.projectiles.clearEnemy(true);
      world.banner(this.spec.phases[this.phase - 1]);
      world.particles.ring(this.core.x, this.core.y, 320, "#ffd45c", 0.6);
      world.shake(0.6);
      world.sfx("mechanism");
      world.powerUps.drop(MQ.SpacePowerUps.HEALTH, 900, 360);
    }

    cancelAttack() {
      this.attack = null;
      for (let i = 0; i < LANES; i++) this.lanes[i].active = false;
    }

    lane(index, y, height) {
      const lane = this.lanes[index];
      lane.active = true;
      lane.on = false;
      lane.y = y;
      lane.h = height;
    }

    choose() {
      const list = this.spec.moves[this.phase - 1];
      for (let i = 0; i < list.length; i++) {
        const name = list[this.move++ % list.length];
        const attack = this.spec.attacks[name];
        // A destroyed system takes its attack with it.
        if (attack.from && !this.alive(attack.from)) continue;
        this.attack = attack;
        this.ticks = 0;
        attack.begin?.(this);
        this.setState("wind");
        this.world.sfx("enemyWarn");
        return;
      }
      this.setState("rest");
    }

    // True every interval seconds through the attack.
    every(interval) {
      if (this.stateTime < this.ticks * interval) return false;
      this.ticks++;
      return true;
    }

    aimFrom(x, y) {
      return atan2(this.world.player.y - y, this.world.player.x - x);
    }

    update(dt) {
      this.time += dt;
      for (let i = 0; i < this.parts.length; i++) this.parts[i].flash -= dt;
      if (this.dead) {
        this.sinking(dt);
        return;
      }
      this.stateTime += dt;
      const { spec, world } = this;

      const still = this.attack?.still && (this.state === "wind" || this.state === "act");
      if (this.state === "intro") this.x = damp(this.x, spec.x, 2.2, dt);
      else this.x = damp(this.x, spec.x + sin(this.time * 0.45) * spec.driftX, 1.5, dt);
      if (!still) this.y = damp(this.y, spec.y + sin(this.time * spec.bob) * spec.driftY, 1.4, dt);
      spec.place?.(this);
      for (let i = 0; i < this.parts.length; i++) {
        this.parts[i].x = this.x + this.parts[i].ox;
        this.parts[i].y = this.y + this.parts[i].oy;
      }

      switch (this.state) {
        case "intro":
          if (this.stateTime >= INTRO) {
            this.setState("rest");
            world.bossReady();
          }
          return;
        case "shift":
          if (this.stateTime >= PHASE_PAUSE) this.choose();
          return;
        case "rest": {
          const pace = (this.phase === 3 ? 0.7 : 1) / world.aggression;
          if (this.stateTime >= (this.attack?.rest ?? 0.6) * pace && world.hostile && !world.player.dead) this.choose();
          break;
        }
        case "wind":
          if (this.stateTime >= this.attack.wind) {
            this.setState("act");
            let beams = false;
            for (let i = 0; i < LANES; i++) {
              if (!this.lanes[i].active) continue;
              this.lanes[i].on = true;
              beams = true;
            }
            world.sfx(beams ? "shipBeam" : "shipBossShot");
            if (beams) world.shake(0.25);
          }
          break;
        case "act":
          this.attack.tick?.(this);
          if (this.stateTime >= this.attack.time) {
            for (let i = 0; i < LANES; i++) this.lanes[i].active = false;
            this.setState("rest");
          }
          break;
      }
      this.callEscorts(dt);
    }

    // Escorts carry capsules, so losing upgrades in the fight isn't the end of it.
    callEscorts(dt) {
      if (!this.world.hostile) return;
      this.escortTime -= dt;
      if (this.escortTime > 0) return;
      this.escortTime = ESCORT_EVERY;
      const { enemies } = this.world;
      const high = this.escorts++ % 2 === 0;
      for (let i = 0; i < 2; i++) {
        const options = enemies.options;
        options.move = "swarm";
        options.offset = i * 2;
        options.capsule = i === 0;
        enemies.spawn(this.spec.escort, MQ.VW + 60 + i * 110, high ? 150 : 590, options);
        enemies.clearOptions();
      }
    }

    touch(x, y, rx, ry) {
      if (this.dead) return 0;
      const { hull } = this.spec;
      for (let i = 0; i < hull.length; i++) {
        const [ox, oy, hx, hy] = hull[i];
        const dx = (x - this.x - ox) / (hx + rx);
        const dy = (y - this.y - oy) / (hy + ry);
        if (dx * dx + dy * dy < 1) return CONTACT;
      }
      if (this.state !== "act") return 0;
      for (let i = 0; i < LANES; i++) {
        const lane = this.lanes[i];
        if (lane.active && lane.on && x < this.beamX() && abs(y - lane.y) < lane.h / 2 + ry * 0.7) return this.attack.damage || 22;
      }
      return 0;
    }

    beamX() {
      return this.x + this.spec.beamFrom;
    }

    die() {
      this.dead = true;
      this.stateTime = 0;
      this.cancelAttack();
      this.world.bossDefeated();
    }

    sinking(dt) {
      this.stateTime += dt;
      if (this.stateTime > 3) return;
      this.x += 22 * dt;
      this.y += 30 * dt;
      if (Math.random() > dt * 12) return;
      const x = this.x + (Math.random() - 0.5) * this.spec.halfWidth * 1.7;
      const y = this.y + (Math.random() - 0.5) * this.spec.halfHeight * 1.7;
      this.world.particles.explosion(x, y, 0.5 + Math.random() * 0.8);
      this.world.sfx("shipExplosion");
      this.world.shake(0.25);
    }

    draw(ctx, time) {
      if (this.dead && this.stateTime > 3.1) return;
      ctx.save();
      if (this.dead) ctx.globalAlpha = clamp((3.1 - this.stateTime) / 0.7, 0, 1);
      MQ.SpaceArt.boss(ctx, this, time);
      ctx.restore();
      if (this.dead) return;

      for (let i = 0; i < this.parts.length; i++) {
        const p = this.parts[i];
        if (p.hp <= 0) continue;
        if (p.shielded) {
          oval(ctx, p.x, p.y, p.rx + 16, p.ry + 16, "rgba(88,214,194,0.14)", "#58d6c2", 2.5 + sin(time * 9));
        } else if (this.vulnerable) {
          oval(ctx, p.x, p.y, p.rx + 7, p.ry + 7, null, p.flash > 0 ? "#ffffff" : "rgba(255,212,92,0.65)", 2);
          if (p.hp < p.maxHp && !p.core) line(ctx, p.x - 22, p.y - p.ry - 15, p.x - 22 + 44 * (p.hp / p.maxHp), p.y - p.ry - 15, "#ff6a5c", 4);
        }
      }
      this.drawAttack(ctx, time);
    }

    drawAttack(ctx, time) {
      const { attack, state } = this;
      if (!attack || (state !== "wind" && state !== "act")) return;
      const right = this.beamX();
      for (let i = 0; i < LANES; i++) {
        const lane = this.lanes[i];
        if (!lane.active) continue;
        const top = lane.y - lane.h / 2;
        if (lane.on) {
          ctx.fillStyle = "rgba(255,70,110,0.5)";
          ctx.fillRect(0, top, right, lane.h);
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.fillRect(0, lane.y - lane.h * 0.16, right, lane.h * 0.32);
          glow(ctx, right, lane.y, lane.h, "#ff467a", 0.9);
        } else {
          ctx.fillStyle = (time * 8) % 1 < 0.5 ? "rgba(255,83,72,0.24)" : "rgba(255,83,72,0.12)";
          ctx.fillRect(0, top, right, lane.h);
          line(ctx, 0, top, right, top, "rgba(255,120,110,0.6)", 1.5);
          line(ctx, 0, top + lane.h, right, top + lane.h, "rgba(255,120,110,0.6)", 1.5);
        }
      }
      if (state !== "wind") return;
      const muzzle = attack.from ? this.part(attack.from) : this.core;
      const k = this.stateTime / attack.wind;
      const x = muzzle.x - muzzle.rx;
      glow(ctx, x, muzzle.y, 20 + k * 55, attack.color || "#ff4f7d", 0.9);
      MQ.U.text(ctx, "!", x - 14, muzzle.y - muzzle.ry - 20, 34, "#ffd45c", "center", 800);
    }
  }

  /* ---------- 1. A fast, agile gunship with everything bolted to the front. ---------- */

  const warden = {
    name: "WARDEN GUNSHIP",
    art: "warden",
    sound: "Warden",
    escort: "drone",
    x: 1030,
    y: 360,
    driftX: 45,
    driftY: 150,
    bob: 0.75,
    halfWidth: 210,
    halfHeight: 115,
    beamFrom: -190,
    thresholds: [0.66, 0.33],
    phases: ["", "BOMB BAYS OPEN", "REACTOR OVERDRIVE"],
    hull: [[0, 0, 160, 52], [50, -62, 70, 26], [50, 62, 70, 26]],
    parts: [["core", -60, 0, 78, 48, 3400, { core: true }]],
    moves: [["fan", "burst", "fan", "cannon"], ["bombs", "fan", "cannon", "sweep"], ["ring", "cannon", "sweep", "bombs", "burst"]],
    attacks: {
      fan: {
        wind: 0.7, time: 1.3, rest: 0.9,
        tick(b) {
          if (b.every(0.5)) b.world.projectiles.fan(b.x - 150, b.y, b.aimFrom(b.x - 150, b.y), 5 + b.phase, 0.21, 270, 12);
        },
      },
      burst: {
        wind: 0.55, time: 1.1, rest: 0.8,
        tick(b) {
          if (!b.every(0.16)) return;
          const y = b.y + (b.ticks % 2 ? -58 : 58);
          b.world.projectiles.orb(b.x - 60, y, b.aimFrom(b.x - 60, y), 370, 11);
        },
      },
      cannon: {
        wind: 1.05, time: 0.8, rest: 0.9, still: true, damage: 22,
        begin(b) {
          b.lane(0, b.y, 78);
        },
      },
      bombs: {
        wind: 0.65, time: 1.2, rest: 1.1, color: "#ff9b38",
        tick(b) {
          if (b.every(0.4)) b.world.projectiles.bomb(b.x - 80, b.y + 40, PI + (b.ticks % 3 - 1) * 0.5, 430, 14, 1.35);
        },
      },
      sweep: {
        wind: 0.75, time: 1.6, rest: 0.9,
        begin(b) {
          b.aimed = b.world.player.y < b.y ? 1 : -1;
        },
        tick(b) {
          if (b.every(0.11)) b.world.projectiles.orb(b.x - 150, b.y, PI + (0.65 - (b.stateTime / 1.6) * 1.3) * b.aimed, 330, 11);
        },
      },
      ring: {
        wind: 0.8, time: 1.5, rest: 1,
        tick(b) {
          if (b.every(0.7)) b.world.projectiles.ring(b.x - 60, b.y, 26, 235, 12, b.time, b.aimFrom(b.x - 60, b.y) + (b.ticks % 2 ? 0.4 : -0.4));
        },
      },
    },
  };

  /* ---------- 2. A station behind four orbiting shield generators. ---------- */

  const bastion = {
    name: "ORBITAL BASTION",
    art: "bastion",
    sound: "Bastion",
    systems: "SHIELD GENERATORS",
    escort: "drone",
    x: 1010,
    y: 362,
    driftX: 20,
    driftY: 30,
    bob: 0.5,
    halfWidth: 220,
    halfHeight: 220,
    beamFrom: -80,
    thresholds: [0, 0.45],
    phases: ["", "SHIELD DOWN. HIT THE CORE", "CORE OVERLOAD"],
    hull: [[0, 0, 82, 82]],
    parts: [
      ["genA", 0, -190, 32, 32, 400, { weapon: true }],
      ["genB", 190, 0, 32, 32, 400, { weapon: true }],
      ["genC", 0, 190, 32, 32, 400, { weapon: true }],
      ["genD", -190, 0, 32, 32, 400, { weapon: true }],
      ["core", 0, 0, 70, 70, 3300, { core: true }],
    ],
    // The generators circle the station, so each comes round to the front.
    place(b) {
      for (let i = 0; i < b.weapons.length; i++) {
        const a = b.time * 0.42 + (i / b.weapons.length) * TAU;
        b.weapons[i].ox = cos(a) * 180;
        b.weapons[i].oy = sin(a) * 195;
      }
    },
    moves: [["volley", "ring", "missiles", "ring"], ["lance", "spiral", "missiles", "volley"], ["spiral", "twinLance", "ring", "missiles", "lance"]],
    attacks: {
      volley: {
        wind: 0.7, time: 1.3, rest: 1,
        tick(b) {
          if (b.every(0.42)) b.world.projectiles.fan(b.x - 90, b.y, b.aimFrom(b.x - 90, b.y), 5, 0.2, 300, 12);
        },
      },
      ring: {
        wind: 0.8, time: 1.4, rest: 1.1,
        tick(b) {
          if (b.every(0.7)) b.world.projectiles.ring(b.x, b.y, 22 + b.phase * 3, 225, 12, b.time, b.aimFrom(b.x, b.y) + (b.ticks % 2 ? 0.35 : -0.35), 0.5);
        },
      },
      missiles: {
        wind: 0.8, time: 1.2, rest: 1.2, color: "#ff6a3d",
        tick(b) {
          if (!b.every(0.4)) return;
          const up = b.ticks % 2 === 1;
          b.world.projectiles.guided(b.x - 50, b.y + (up ? -70 : 70), up ? -2.3 : 2.3, 250, 15);
        },
      },
      lance: {
        wind: 1.1, time: 0.85, rest: 1, still: true, damage: 24,
        begin(b) {
          b.lane(0, b.world.player.y, 96);
        },
      },
      twinLance: {
        wind: 1.2, time: 0.9, rest: 1, still: true, damage: 24,
        begin(b) {
          // One lane on the player, one on the other half of the field.
          const y = b.world.player.y;
          b.lane(0, y, 84);
          b.lane(1, y < 364 ? y + 260 : y - 260, 84);
        },
      },
      spiral: {
        wind: 0.75, time: 2.6, rest: 1.2, color: "#58d6c2",
        tick(b) {
          if (!b.every(0.14)) return;
          const a = b.ticks * 0.23;
          const { projectiles } = b.world;
          for (let i = 0; i < b.phase; i++) projectiles.orb(b.x, b.y, a + (i * TAU) / b.phase, 215, 11);
        },
      },
    },
  };

  /* ---------- 3. Gideon's command ship, filling the right of the screen. ---------- */

  const command = {
    name: "GIDEON'S COMMAND SHIP",
    art: "command",
    sound: "Command",
    systems: "WEAPON SYSTEMS",
    escort: "eliteInterceptor",
    x: 1075,
    y: 362,
    driftX: 12,
    driftY: 16,
    bob: 0.4,
    halfWidth: 250,
    halfHeight: 250,
    beamFrom: -90,
    thresholds: [0, 0.42],
    phases: ["", "DEFENSE CORE EXPOSED", "GIDEON'S LAST ORDER"],
    hull: [[60, 0, 120, 170], [110, -190, 110, 36], [110, 190, 110, 36]],
    parts: [
      ["upper", -40, -198, 42, 28, 560, { weapon: true }],
      ["missile", -105, -92, 38, 32, 540, { weapon: true }],
      ["lance", -105, 92, 38, 32, 540, { weapon: true }],
      ["lower", -40, 198, 42, 28, 560, { weapon: true }],
      ["core", -80, 0, 54, 54, 4300, { core: true }],
    ],
    moves: [["upperFan", "missiles", "lance", "lowerSweep", "pincer"], ["corridor", "spiral", "burst", "corridor", "rings"], ["spiral", "corridor", "storm", "rings", "burst"]],
    attacks: {
      upperFan: {
        from: "upper", wind: 0.65, time: 1.4, rest: 0.5,
        tick(b) {
          if (!b.every(0.45)) return;
          const p = b.part("upper");
          b.world.projectiles.fan(p.x - 40, p.y, b.aimFrom(p.x, p.y), 6, 0.17, 310, 12);
        },
      },
      missiles: {
        from: "missile", wind: 0.75, time: 1.5, rest: 0.6, color: "#ff6a3d",
        tick(b) {
          if (!b.every(0.38)) return;
          const p = b.part("missile");
          b.world.projectiles.guided(p.x - 30, p.y, PI + (b.ticks % 2 ? 0.8 : -0.8), 260, 15);
        },
      },
      lance: {
        from: "lance", wind: 1.05, time: 0.8, rest: 0.6, still: true, damage: 24,
        begin(b) {
          b.lane(0, b.world.player.y, 90);
        },
      },
      lowerSweep: {
        from: "lower", wind: 0.65, time: 1.5, rest: 0.6,
        tick(b) {
          if (!b.every(0.12)) return;
          const p = b.part("lower");
          b.world.projectiles.orb(p.x - 40, p.y, PI - 0.15 + (b.stateTime / 1.5) * 0.95, 330, 11);
        },
      },
      pincer: {
        wind: 0.7, time: 1, rest: 0.9,
        tick(b) {
          if (!b.every(0.45)) return;
          for (let i = 0; i < b.weapons.length; i++) {
            const p = b.weapons[i];
            if (p.hp > 0) b.world.projectiles.orb(p.x - 30, p.y, b.aimFrom(p.x, p.y), 290, 11);
          }
        },
      },
      // Beams fill the field except one corridor.
      corridor: {
        wind: 1.45, time: 0.9, rest: 0.8, still: true, damage: 22,
        begin(b) {
          const band = 100;
          const top = 120;
          const here = clamp(Math.round((b.world.player.y - top) / band), 0, 4);
          const step = b.move % 2 ? 1 : -1;
          const safe = here + step < 0 || here + step > 4 ? here - step : here + step;
          for (let i = 0; i < 5; i++) if (i !== safe) b.lane(i, top + 22 + i * band, band - 8);
        },
      },
      spiral: {
        wind: 0.7, time: 2.4, rest: 0.8, color: "#d24cff",
        tick(b) {
          if (!b.every(b.phase === 3 ? 0.11 : 0.15)) return;
          const { x, y } = b.core;
          const swing = sin(b.ticks * 0.28) * 0.8;
          b.world.projectiles.orb(x - 40, y, PI + swing, 280, 11);
          b.world.projectiles.orb(x - 40, y, PI - swing, 280, 11);
        },
      },
      burst: {
        wind: 0.55, time: 1, rest: 0.8,
        tick(b) {
          if (b.every(0.3)) b.world.projectiles.fan(b.core.x - 50, b.core.y, b.aimFrom(b.core.x, b.core.y), 5, 0.14, 380, 12);
        },
      },
      rings: {
        wind: 0.8, time: 1.6, rest: 0.9,
        tick(b) {
          if (b.every(0.6)) b.world.projectiles.ring(b.core.x - 30, b.core.y, 30, 235, 12, b.time, b.aimFrom(b.core.x, b.core.y) + (b.ticks % 2 ? 0.3 : -0.3), 0.42);
        },
      },
      storm: {
        wind: 0.8, time: 1.5, rest: 0.9, color: "#ff6a3d",
        tick(b) {
          if (!b.every(0.3)) return;
          b.world.projectiles.guided(b.core.x - 20, b.core.y, PI + (b.ticks % 2 ? 1.1 : -1.1), 280, 15);
          b.world.projectiles.orb(b.core.x - 50, b.core.y, b.aimFrom(b.core.x, b.core.y), 340, 11);
        },
      },
    },
  };

  const TYPES = { warden, bastion, command };

  MQ.createSpaceBoss = (world, kind) => new SpaceBoss(world, TYPES[kind]);
})(window.MQ);
