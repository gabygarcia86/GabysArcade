/*
 * Enemies: the roster (Sentinels, Reavers, mutants and level-specific foes), shared
 * behaviors (walker, gunner, heavy, flyer, laser, leaper, flamer, creature, turret,
 * guardian, thrower, elite, disguised, prop) and procedural art for each.
 * Stats are for Level 1; world.js scales health and damage with the level number.
 */
(function (XM) {
  "use strict";
  const U = XM.U;
  const A = XM.Art;
  const T = XM.T;

  const PAL = {
    sentinel: { main: "#7a3fa0", dark: "#3e1f5a", accent: "#c33b7a", face: "#aab2c2", glow: "#ff3b6a" },
    sentinelHeavy: { main: "#5a2f7a", dark: "#2a1440", accent: "#8a2a5a", face: "#8a93a4", glow: "#ff6a3b" },
    sentinelAdv: { main: "#3a3f58", dark: "#1a1d2a", accent: "#7a5af0", face: "#c8cfdc", glow: "#7affff" },
    sentinelEnergy: { main: "#2a6a8a", dark: "#123448", accent: "#3affd0", face: "#bfe6ee", glow: "#3affd0" },
    sentinelCorrupt: { main: "#3a1a4a", dark: "#16081e", accent: "#ff3ad0", face: "#5a4a6a", glow: "#ff3ad0" },
    reaver: { main: "#2a2c33", dark: "#16171b", accent: "#c4252c", metal: "#9aa3b2", skin: "#d8a888", glow: "#ff3030" },
    reaverElite: { main: "#3a1a1e", dark: "#1a0b0d", accent: "#ffb020", metal: "#c9ced8", skin: "#d8a888", glow: "#ffb020" },
    soldier: { main: "#4a5a3a", dark: "#2a3322", accent: "#c9b26a", skin: "#e0b08a", visor: "#2a3a4a", glow: "#ffcf5a" },
    guard: { main: "#2a3e6a", dark: "#16223a", accent: "#e0e4ea", skin: "#d8a888", visor: "#1a1a1a", glow: "#ffcf5a" },
    hunter: { main: "#3a3a42", dark: "#1e1e24", accent: "#ff7a1a", skin: "#c89a78", visor: "#ff7a1a", glow: "#ff7a1a" },
    miner: { main: "#7a5a2a", dark: "#4a3418", accent: "#f2c230", skin: "#d8a888", visor: "#f2c230", glow: "#ffe07a" },
    merc: { main: "#5a5240", dark: "#33301f", accent: "#8a3a2a", skin: "#c89a78", visor: "#1a1a1a", glow: "#ffcf5a" },
    apoc: { main: "#2a4a8a", dark: "#16284a", accent: "#e0b840", skin: "#8a7a9a", visor: "#e0b840", glow: "#7ab0ff" },
    acolyte: { main: "#8a1a2a", dark: "#4a0a14", accent: "#7a3aa0", skin: "#d8a888", visor: "#7a3aa0", glow: "#c08aff" },
    energyWarrior: { main: "#1a2a5a", dark: "#0a1230", accent: "#5affff", skin: "#5affff", visor: "#5affff", glow: "#5affff" },
    rogue: { main: "#5a2a6a", dark: "#2e1238", accent: "#3affb0", skin: "#c89a78", visor: "#3affb0", glow: "#3affb0" },
    ice: { main: "#4a7a9a", dark: "#24445a", accent: "#bff0ff", skin: "#a8d8f0", visor: "#bff0ff", glow: "#bff0ff" },
    cyber: { main: "#2a2c33", dark: "#16171b", accent: "#3affff", skin: "#c8ccd4", visor: "#3affff", glow: "#3affff" },
    creature: { main: "#5affd0", dark: "#1a8a7a", accent: "#ffffff", glow: "#5affd0" },
    dimensional: { main: "#d05aff", dark: "#5a1a8a", accent: "#ffffff", glow: "#d05aff" },
    corrupted: { main: "#ff5a3a", dark: "#8a1a0a", accent: "#ffe07a", glow: "#ff5a3a" },
    beast: { main: "#6a8a3a", dark: "#3a4a1a", accent: "#e0d0a0", glow: "#c0ff5a" },
    jungle: { main: "#8a5a2a", dark: "#4a2e12", accent: "#f0e0b0", glow: "#ffb05a" },
    crystal: { main: "#8a5aff", dark: "#3a1a8a", accent: "#e0d0ff", glow: "#b08aff" },
    guardian: { main: "#a08a5a", dark: "#5a4a2a", accent: "#e0b840", glow: "#ffd05a" },
    nexusGuard: { main: "#3a3a6a", dark: "#16163a", accent: "#ff5aff", glow: "#ff5aff" },
    drone: { main: "#4a5060", dark: "#22262e", accent: "#ff3b3b", glow: "#ff3b3b" },
    bot: { main: "#c8ccd4", dark: "#6a707a", accent: "#2a8aff", glow: "#2a8aff" },
    milbot: { main: "#6a6a4a", dark: "#3a3a24", accent: "#ff7a1a", glow: "#ff7a1a" },
    toad: { main: "#6a8a2a", dark: "#3a4a12", accent: "#a06a3a", skin: "#8aa83a", glow: "#c0ff5a" },
    pyro: { main: "#d8762a", dark: "#7a3a10", accent: "#f2c230", skin: "#e0b08a", glow: "#ff7a1a" },
    civilian: { main: "#5a4a3a", dark: "#2e241a", accent: "#8a7a6a", skin: "#e0b08a", glow: "#3a6aff" },
    shifter: { main: "#2a4aa8", dark: "#142454", accent: "#e0b840", skin: "#3a5ad0", glow: "#ffcf3a" },
  };

  // id: [name, behavior, art, palette, hp, dmg, speed, w, h, score, xp, extras]
  const DEF = (name, beh, art, pal, hp, dmg, spd, w, h, score, xp, x = {}) => Object.assign({ name, beh, art, pal: PAL[pal], hp, dmg, spd, w, h, score, xp }, x);

  const TYPES = {
    sentinel: DEF("Sentinel", "gunner", "sentinel", "sentinel", 95, 14, 70, 44, 96, 400, 14, { sentinel: true, kbResist: 0.75, shot: "laser", fireRate: 2.4, range: 520, keep: 300 }),
    sentinelHeavy: DEF("Heavy Sentinel", "heavy", "sentinel", "sentinelHeavy", 170, 20, 55, 54, 112, 650, 22, { sentinel: true, kbResist: 0.92, scale: 1.15 }),
    sentinelFlying: DEF("Flying Sentinel", "flyer", "sentinel", "sentinel", 70, 12, 120, 40, 84, 450, 14, { sentinel: true, flying: true, shot: "laser", fireRate: 2.2, kbResist: 0.5, pose: "fly" }),
    sentinelLaser: DEF("Laser Sentinel", "laser", "sentinel", "sentinelAdv", 105, 18, 40, 44, 96, 500, 16, { sentinel: true, kbResist: 0.85, fireRate: 3.2 }),
    sentinelAdvanced: DEF("Advanced Sentinel", "elite", "sentinel", "sentinelAdv", 150, 17, 115, 44, 96, 700, 24, { sentinel: true, kbResist: 0.8, shot: "plasma", fireRate: 2.0, reach: 52 }),
    sentinelEnergy: DEF("Energy Sentinel", "gunner", "sentinel", "sentinelEnergy", 120, 16, 75, 44, 96, 550, 18, { sentinel: true, kbResist: 0.8, shot: "plasma", fireRate: 2.0, range: 540, keep: 300, burst: 3 }),
    sentinelCorrupt: DEF("Corrupted Sentinel", "elite", "sentinel", "sentinelCorrupt", 170, 19, 110, 44, 96, 750, 26, { sentinel: true, kbResist: 0.85, shot: "plasma", fireRate: 1.8, reach: 52 }),
    reaverGrunt: DEF("Reaver Grunt", "walker", "reaver", "reaver", 42, 10, 120, 28, 58, 150, 6, { reach: 34 }),
    reaverGunner: DEF("Reaver Gunner", "gunner", "reaver", "reaver", 36, 9, 100, 28, 58, 180, 7, { shot: "bullet", fireRate: 1.7, range: 480, keep: 240, gun: true }),
    reaverHeavy: DEF("Reaver Heavy", "heavy", "reaver", "reaver", 115, 18, 70, 38, 66, 350, 14, { kbResist: 0.7, scale: 1.15, bigArm: true }),
    reaverCyber: DEF("Cybernetic Reaver", "leaper", "reaver", "cyber", 62, 13, 150, 28, 58, 260, 10, { blade: true }),
    reaverElite: DEF("Elite Reaver", "elite", "reaver", "reaverElite", 95, 15, 150, 30, 60, 420, 16, { shot: "bullet", fireRate: 2.0, reach: 38, gun: true }),
    toad: DEF("Toad", "leaper", "toad", "toad", 160, 13, 140, 34, 44, 800, 30, { tongue: true, kbResist: 0.4, named: true }),
    pyro: DEF("Pyro", "flamer", "pyro", "pyro", 160, 6, 110, 28, 60, 800, 30, { kbResist: 0.4, named: true }),
    mutantHunter: DEF("Mutant Hunter", "gunner", "soldier", "hunter", 55, 10, 110, 28, 60, 260, 10, { shot: "net", fireRate: 2.2, range: 460, keep: 230, gun: true, helmet: "visor" }),
    rogueSoldier: DEF("Rogue Mutant Soldier", "elite", "soldier", "rogue", 62, 12, 140, 28, 60, 300, 12, { shot: "plasma", fireRate: 2.6, reach: 36, helmet: "none", glowFists: true }),
    experimental: DEF("Experimental Mutant", "leaper", "beast", "beast", 58, 12, 160, 40, 40, 260, 10, {}),
    energyCreature: DEF("Mutant Energy Creature", "creature", "creature", "creature", 46, 11, 70, 34, 34, 240, 10, { flying: true, ghost: true }),
    drone: DEF("Surveillance Drone", "flyer", "drone", "drone", 26, 8, 140, 30, 22, 120, 5, { flying: true, shot: "laser", fireRate: 2.6, swoop: true }),
    securityBot: DEF("Security Unit", "gunner", "bot", "bot", 50, 10, 80, 30, 40, 200, 8, { shot: "laser", fireRate: 2.0, range: 420, keep: 200 }),
    militaryRobot: DEF("Military Robot", "gunner", "bot", "milbot", 120, 14, 70, 40, 56, 450, 16, { shot: "bullet", fireRate: 1.4, range: 520, keep: 260, burst: 3, scale: 1.3, kbResist: 0.7 }),
    clone: DEF("Mutant Clone", "elite", "clone", "reaver", 72, 12, 160, 26, 60, 320, 12, { reach: 36 }),
    crystalCreature: DEF("Crystal Creature", "thrower", "crystal", "crystal", 85, 13, 60, 40, 54, 320, 12, { shot: "crystal", fireRate: 2.4, kbResist: 0.6 }),
    miner: DEF("Mutant Miner", "walker", "soldier", "miner", 55, 11, 110, 28, 60, 200, 8, { reach: 40, helmet: "lamp", tool: "pick" }),
    iceMutant: DEF("Ice Mutant", "thrower", "soldier", "ice", 62, 11, 90, 28, 60, 260, 10, { shot: "iceball", fireRate: 2.2, helmet: "none", spikes: true }),
    guard: DEF("Prison Guard", "gunner", "soldier", "guard", 48, 10, 110, 28, 60, 200, 8, { shot: "bullet", fireRate: 1.8, range: 440, keep: 220, gun: true, helmet: "cap" }),
    securityOfficer: DEF("Mutant Security Officer", "elite", "soldier", "guard", 80, 13, 140, 28, 60, 320, 12, { shot: "net", fireRate: 2.4, reach: 38, helmet: "visor", baton: true }),
    guardian: DEF("Ancient Guardian", "guardian", "guardian", "guardian", 150, 16, 60, 44, 78, 500, 18, { kbResist: 0.9, shielded: true }),
    nexusGuardian: DEF("Nexus Guardian", "guardian", "guardian", "nexusGuard", 175, 18, 70, 44, 78, 650, 22, { kbResist: 0.9, shielded: true, shot: "plasma", fireRate: 2.8 }),
    disguised: DEF("Disguised Agent", "disguised", "civilian", "civilian", 65, 13, 150, 26, 58, 320, 12, { reach: 38 }),
    dimensional: DEF("Dimensional Creature", "creature", "creature", "dimensional", 62, 13, 85, 38, 38, 300, 12, { flying: true, ghost: true, tentacles: true, burst: true }),
    corruptedBeing: DEF("Corrupted Energy Being", "creature", "creature", "corrupted", 55, 13, 90, 36, 36, 280, 11, { flying: true, ghost: true, burst: true }),
    apocSoldier: DEF("Apocalypse Soldier", "walker", "soldier", "apoc", 72, 13, 120, 30, 64, 280, 11, { reach: 52, helmet: "crest", tool: "spear" }),
    mutantWarrior: DEF("Mutant Warrior", "elite", "soldier", "apoc", 92, 15, 150, 30, 64, 360, 14, { reach: 40, helmet: "crest", glowFists: true, shot: "plasma", fireRate: 2.8 }),
    mercenary: DEF("Mutant Mercenary", "gunner", "soldier", "merc", 55, 11, 115, 28, 60, 240, 9, { shot: "bullet", fireRate: 1.5, range: 480, keep: 230, gun: true, helmet: "beret", burst: 2 }),
    eliteHunter: DEF("Elite Mutant Hunter", "elite", "soldier", "hunter", 95, 15, 160, 28, 60, 380, 15, { shot: "net", fireRate: 2.0, reach: 40, gun: true, helmet: "visor" }),
    acolyte: DEF("Magneto's Elite Guard", "elite", "soldier", "acolyte", 110, 17, 150, 30, 62, 450, 18, { shot: "metal", fireRate: 1.9, reach: 40, helmet: "magneto" }),
    energyWarrior: DEF("Energy Warrior", "elite", "soldier", "energyWarrior", 110, 17, 160, 30, 62, 450, 18, { shot: "plasma", fireRate: 1.8, reach: 40, helmet: "none", glowFists: true, energyBody: true }),
    jungleBeast: DEF("Mutant Creature", "leaper", "beast", "jungle", 60, 12, 170, 42, 40, 260, 10, {}),
    turret: DEF("Security Turret", "turret", "turret", "drone", 60, 9, 0, 34, 28, 200, 8, { shot: "laser", fireRate: 1.6, range: 520 }),
    barrel: DEF("Explosive Barrel", "prop", "barrel", "drone", 1, 0, 0, 26, 34, 50, 0, { prop: true, explodes: true }),
    machine: DEF("Extraction Machine", "prop", "machine", "drone", 140, 0, 0, 60, 80, 1000, 30, { prop: true, objective: true }),
    nexusNode: DEF("Nexus Node", "prop", "node", "nexusGuard", 180, 0, 0, 50, 70, 1200, 30, { prop: true, objective: true, pulses: true }),
  };

  // ---------------- Enemy ----------------
  class Enemy {
    constructor(world, typeId, x, y, scale = 0) {
      const d = TYPES[typeId];
      this.world = world;
      this.type = typeId;
      this.def = d;
      this.name = d.name;
      this.w = d.w;
      this.h = d.h;
      this.x = x - d.w / 2;
      this.y = d.flying ? y - d.h - 120 : y - d.h;
      this.vx = 0;
      this.vy = 0;
      this.facing = -1;
      const lvl = world.levelIndex;
      this.maxHp = this.hp = Math.round(d.hp * (1 + 0.11 * lvl) * (1 + scale));
      this.dmg = d.dmg * (1 + 0.075 * lvl);
      this.spd = d.spd * (1 + Math.min(0.25, lvl * 0.012));
      this.state = d.beh === "disguised" ? "disguised" : "idle";
      this.stateT = U.rand(0, 1);
      this.cd = U.rand(0.6, 1.6);
      this.stun = 0;
      this.freeze = 0;
      this.slow = 0;
      this.confuse = 0;
      this.flash = 0;
      this.dead = false;
      this.deathT = 0;
      this.flying = !!d.flying;
      this.noGravity = this.flying;
      this.prop = !!d.prop;
      this.objective = !!d.objective;
      this.homeX = this.x;
      this.homeY = this.y;
      this.t = Math.random() * 10;
      this.aggro = false;
      this.wanderDir = Math.random() < 0.5 ? -1 : 1;
      this.sentinel = !!d.sentinel;
      this.touchCd = 0;
      this.anim = 0;
      this.shotsLeft = 0;
      this.arena = null;
    }

    get cx() {
      return this.x + this.w / 2;
    }
    get cy() {
      return this.y + this.h / 2;
    }

    takeDamage(dmg, opts, srcX) {
      if (this.dead) return null;
      let blocked = false;
      if (this.state === "disguised") this.reveal();
      if (this.def.shielded && !opts.power) {
        const fromFront = (srcX - this.cx) * this.facing > 0;
        if (fromFront && this.stun <= 0 && this.freeze <= 0) {
          dmg *= 0.25;
          blocked = true;
          if (Math.random() < 0.5) XM.FX.text(this.cx, this.y - 16, "BLOCKED", "#c9ced8", 12, 0.5);
        }
      }
      const dealt = Math.max(1, Math.round(dmg));
      this.hp -= dealt;
      this.flash = 0.12;
      this.aggro = true;
      if (opts.stun) this.stun = Math.max(this.stun, opts.stun);
      if (opts.freeze) this.freeze = Math.max(this.freeze, opts.freeze);
      if (opts.slow) this.slow = Math.max(this.slow, opts.slow);
      if (opts.confuse) this.confuse = Math.max(this.confuse, opts.confuse);
      const resist = this.def.kbResist || 0;
      if (opts.kb && !this.prop && this.def.beh !== "turret") {
        const dir = this.cx >= srcX ? 1 : -1;
        this.vx = dir * opts.kb * (1 - resist);
        if (!this.flying && (opts.kb * (1 - resist) > 120 || opts.launch)) {
          this.vy = -(opts.launch || Math.min(220, opts.kb * 0.5)) * (1 - resist * 0.7);
          this.onGround = false;
        }
        if (opts.kb * (1 - resist) > 140 && this.state === "windup") {
          this.state = "idle";
          this.stateT = 0;
          this.cd = 0.5;
        }
      }
      if (this.hp <= 0) {
        this.hp = 0;
        this.die();
        return { dealt, killed: true, blocked };
      }
      XM.Audio.sfx("enemyHurt");
      return { dealt, killed: false, blocked };
    }

    die() {
      this.dead = true;
      this.deathT = 0;
      this.vy = this.flying ? 0 : -200;
      const pal = this.def.pal;
      XM.FX.burst(this.cx, this.cy, { count: 16, colors: [pal.glow || "#fff", pal.main || "#888", "#ffffff"], speed: 260, life: 0.6 });
      if (this.def.explodes) {
        const w = this.world;
        XM.FX.burst(this.cx, this.cy, { count: 30, colors: ["#ff7a1a", "#ffd23f", "#ffffff"], speed: 380, life: 0.6 });
        XM.FX.smoke(this.cx, this.cy, 8, "#3a3a3a");
        XM.FX.ring(this.cx, this.cy, 110, "#ffb03a", 0.4, 8);
        XM.FX.shake(6, 0.3);
        XM.Audio.sfx("explosion");
        for (const e of w.enemies) if (e !== this && !e.dead && XM.Collide.circleRect(this.cx, this.cy, 110, e)) w.combat.hitEnemy(e, 60 + w.levelIndex * 6, { kb: 300, noMult: true, power: true }, this.cx);
        if (w.player && XM.Collide.circleRect(this.cx, this.cy, 90, w.player)) w.player.hurt(12, this.cx);
        w.combat.breakTiles({ x: this.cx - 70, y: this.cy - 70, w: 140, h: 140 }, true);
      } else if (this.sentinel || this.def.art === "bot" || this.def.art === "drone" || this.objective) {
        XM.FX.smoke(this.cx, this.cy, 6, "#4a4a50");
        XM.Audio.sfx("explosion");
      } else XM.Audio.sfx("enemyDie");
    }

    reveal() {
      if (this.state !== "disguised") return;
      this.state = "idle";
      this.cd = 0.6;
      this.def = Object.assign({}, this.def, { art: "soldier", pal: PAL.shifter, helmet: "none", beh: "elite", glowFists: true });
      XM.FX.smoke(this.cx, this.cy, 10, "#3a5ad0");
      XM.Audio.sfx("teleport");
      XM.FX.text(this.cx, this.y - 10, "A TRAP!", "#ffcf3a", 14, 0.8);
    }

    update(dt, w) {
      this.t += dt;
      this.anim += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.touchCd = Math.max(0, this.touchCd - dt);
      if (this.dead) {
        this.deathT += dt;
        if (!this.flying) XM.Physics.move(this, dt, w.level, w.platforms, w.gravityScale);
        else this.y += 80 * dt;
        this.vx *= 0.92;
        return;
      }
      const p = w.player;
      if (this.freeze > 0) {
        this.freeze -= dt;
        this.vx *= 0.8;
        if (!this.flying) XM.Physics.move(this, dt, w.level, w.platforms, w.gravityScale);
        return;
      }
      if (this.stun > 0) {
        this.stun -= dt;
        this.vx = U.approach(this.vx, 0, 900 * dt);
        if (!this.flying) XM.Physics.move(this, dt, w.level, w.platforms, w.gravityScale);
        else this.move(dt, w);
        if (this.state === "windup" || this.state === "attack") this.state = "idle";
        return;
      }
      this.slow = Math.max(0, this.slow - dt);
      const spdMul = this.slow > 0 ? 0.5 : 1;
      this.stateT += dt;
      this.cd -= dt * spdMul;
      const dx = p.cx - this.cx;
      const dy = p.y + p.h - (this.y + this.h);
      const dist = Math.abs(dx);
      if (!this.aggro && dist < (this.def.range || 400) && Math.abs(dy) < 220 && !p.dead) this.aggro = true;
      if (p.dead || p.victory) this.aggro = false;

      if (this.confuse > 0) {
        this.confuse -= dt;
        if (this.stateT > 0.6) {
          this.stateT = 0;
          this.wanderDir = Math.random() < 0.5 ? -1 : 1;
        }
        this.vx = this.wanderDir * this.spd * 0.5;
        this.facing = this.wanderDir;
        if (this.state !== "idle") this.state = "idle";
        this.move(dt, w);
        return;
      }

      const B = BEHAVIORS[this.def.beh];
      if (B) B(this, w, dt, p, dx, dy, dist, spdMul);
      this.move(dt, w);

      // Touching an enemy hurts (except props and disguised agents).
      if (!this.prop && this.state !== "disguised" && this.touchCd <= 0 && U.overlap(this, p) && this.def.beh !== "turret") {
        if (p.hurt(this.dmg * (this.state === "leap" || this.state === "charge" ? 1 : 0.5), this.cx)) this.touchCd = 0.8;
      }
    }

    move(dt, w) {
      if (this.prop || this.def.beh === "turret") return;
      if (this.flying) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (!this.def.ghost) {
          if (XM.Physics.solidAt(w.level, this.cx + Math.sign(this.vx) * this.w / 2, this.cy)) {
            this.x -= this.vx * dt;
            this.vx = -this.vx * 0.3;
          }
        }
        this.y = U.clamp(this.y, 20, w.level.H * T - this.h - 40);
        return;
      }
      XM.Physics.move(this, dt, w.level, w.platforms, w.gravityScale);
      if (this.y > w.level.H * T + 100) {
        // Fell into a pit.
        this.hp = 0;
        this.dead = true;
        this.deathT = 10;
        w.onEnemyKilled(this, { pit: true });
      }
    }

    // Stop at ledges so walkers don't run off cliffs.
    ledgeAhead(w, dir) {
      if (!this.onGround) return false;
      const fx = dir > 0 ? this.x + this.w + 6 : this.x - 6;
      const fy = this.y + this.h + 8;
      const t = XM.Physics.tile(w.level, Math.floor(fx / T), Math.floor(fy / T));
      return !(XM.Physics.solid(t) || t === XM.TILE.ONEWAY);
    }

    walkToward(w, dir, speed) {
      if (this.ledgeAhead(w, dir) || (this.hitWall && Math.sign(this.hitWall) === dir)) {
        this.vx = U.approach(this.vx, 0, 1600 / 60);
        return false;
      }
      this.vx = U.approach(this.vx, dir * speed, 1200 / 60);
      return true;
    }

    patrol(w, spdMul) {
      if (Math.abs(this.x - this.homeX) > 110) this.wanderDir = this.x > this.homeX ? -1 : 1;
      if (!this.walkToward(w, this.wanderDir, this.spd * 0.35 * spdMul)) this.wanderDir *= -1;
      this.facing = this.wanderDir;
    }

    melee(w, reach, dmgMul = 1, h = 0.8) {
      const r = { x: this.facing > 0 ? this.cx : this.cx - reach, y: this.y + this.h * (1 - h), w: reach, h: this.h * h };
      if (U.overlap(r, w.player)) w.player.hurt(this.dmg * dmgMul, this.cx);
    }

    shoot(w, kind, dx, dy, speed = 420) {
      const p = w.player;
      const sx = this.cx + this.facing * this.w * 0.45;
      const sy = this.y + this.h * (this.sentinel ? 0.3 : 0.38);
      let ang = Math.atan2(p.cy - sy, p.cx - sx);
      if (!this.flying && this.def.beh !== "turret") {
        // Ground shooters aim roughly level so heroes can jump over shots.
        const base = this.facing > 0 ? 0 : Math.PI;
        let d = ang - base;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        ang = base + U.clamp(d, -0.45, 0.45);
      }
      const o = { x: sx, y: sy, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, dmg: this.dmg * 0.8, life: 2.2 };
      switch (kind) {
        case "laser":
          Object.assign(o, { kind: "laser", r: 5, color: this.def.pal.glow || "#ff3b3b", vx: o.vx * 1.4, vy: o.vy * 1.4 });
          XM.Audio.sfx("laser");
          break;
        case "plasma":
          Object.assign(o, { kind: "plasma", r: 8, color: this.def.pal.glow || "#7affff" });
          XM.Audio.sfx("shoot");
          break;
        case "bullet":
          Object.assign(o, { kind: "bullet", r: 4, color: "#ffcf5a", vx: o.vx * 1.5, vy: o.vy * 1.5, dmg: this.dmg * 0.6 });
          XM.Audio.sfx("shoot");
          break;
        case "net":
          Object.assign(o, { kind: "plasma", r: 9, color: "#ff9a3a", slow: 2.5 });
          XM.Audio.sfx("shoot");
          break;
        case "crystal":
          Object.assign(o, { kind: "crystal", r: 7, color: "#c8a8ff", grav: 600, vy: -380, vx: U.clamp(dx * 0.9, -420, 420) });
          XM.Audio.sfx("ice");
          break;
        case "iceball":
          Object.assign(o, { kind: "crystal", r: 7, color: "#bff0ff", grav: 600, vy: -360, vx: U.clamp(dx * 0.9, -420, 420), slow: 2 });
          XM.Audio.sfx("ice");
          break;
        case "metal":
          Object.assign(o, { kind: "metal", r: 9, color: "#9aa3b2", homing: 1.2 });
          XM.Audio.sfx("magnet");
          break;
        case "fire":
          Object.assign(o, { kind: "fire", r: 10, color: "#ff7a1a", life: 0.45, pierce: true, ghost: false });
          break;
      }
      w.combat.enemyShoot(o);
    }

    draw(ctx, w) {
      const fade = this.dead ? Math.max(0, 1 - this.deathT / 0.5) : 1;
      if (fade <= 0) return;
      ctx.globalAlpha = fade;
      if (!this.flying && !this.dead && this.onGround) {
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath();
        ctx.ellipse(this.cx, this.y + this.h, this.w * 0.6, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      const art = ART[this.def.art];
      if (art) art(ctx, this, w);
      if (this.flash > 0) A.glow(ctx, this.cx, this.cy, Math.max(this.w, this.h) * 0.8, "#ffffff", this.flash * 6);
      if (this.freeze > 0) {
        ctx.fillStyle = "rgba(190,240,255,0.45)";
        A.roundRect(ctx, this.x - 4, this.y - 4, this.w + 8, this.h + 8, 6);
        ctx.fill();
        ctx.strokeStyle = "#e8fbff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (this.stun > 0 && !this.dead) {
        for (let i = 0; i < 3; i++) {
          const a = this.t * 5 + (i * Math.PI * 2) / 3;
          XM.Art.text(ctx, "★", this.cx + Math.cos(a) * 14, this.y - 8 + Math.sin(a) * 4, 10, "#ffe14a", "center", false);
        }
      }
      if (this.confuse > 0 && !this.dead) XM.Art.text(ctx, "?", this.cx, this.y - 12 + Math.sin(this.t * 6) * 3, 16, "#7fd0ff", "center");
      if (this.state === "windup" && !this.dead) {
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.t * 40);
        XM.Art.text(ctx, "!", this.cx, this.y - 14, 18, "#ff4a3a", "center");
        ctx.globalAlpha = fade;
      }
      if (!this.dead && this.hp < this.maxHp && !this.prop) {
        const bw = Math.max(26, this.w);
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(this.cx - bw / 2, this.y - 8, bw, 4);
        ctx.fillStyle = this.def.named ? "#ffb020" : "#ff4a3a";
        ctx.fillRect(this.cx - bw / 2, this.y - 8, (bw * this.hp) / this.maxHp, 4);
      }
      if (this.prop && this.objective && !this.dead) {
        const bw = this.w;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(this.cx - bw / 2, this.y - 10, bw, 5);
        ctx.fillStyle = "#3affd0";
        ctx.fillRect(this.cx - bw / 2, this.y - 10, (bw * this.hp) / this.maxHp, 5);
      }
      ctx.globalAlpha = 1;
    }
  }

  // ---------------- Behaviors ----------------
  function startWindup(e, time, next) {
    e.state = "windup";
    e.stateT = 0;
    e.windTime = time;
    e.next = next;
  }

  const BEHAVIORS = {
    walker(e, w, dt, p, dx, dy, dist, sm) {
      const reach = e.def.reach || 34;
      if (e.state === "windup") {
        e.vx = U.approach(e.vx, 0, 1400 * dt);
        if (e.stateT >= e.windTime) {
          e.state = "attack";
          e.stateT = 0;
          e.melee(w, reach + 10);
          XM.Audio.sfx("slash");
        }
        return;
      }
      if (e.state === "attack") {
        if (e.stateT > 0.3) {
          e.state = "idle";
          e.cd = 0.9 + Math.random() * 0.5;
        }
        return;
      }
      if (e.aggro) {
        e.facing = dx > 0 ? 1 : -1;
        if (dist < reach + 14 && Math.abs(dy) < 60) {
          e.vx = U.approach(e.vx, 0, 1400 * dt);
          if (e.cd <= 0) startWindup(e, 0.38);
        } else e.walkToward(w, e.facing, e.spd * sm);
      } else e.patrol(w, sm);
    },

    gunner(e, w, dt, p, dx, dy, dist, sm) {
      if (e.state === "windup") {
        e.vx = U.approach(e.vx, 0, 1400 * dt);
        if (e.stateT >= e.windTime) {
          e.shotsLeft = e.def.burst || 1;
          e.state = "attack";
          e.stateT = 0.2;
        }
        return;
      }
      if (e.state === "attack") {
        if (e.stateT >= 0.18 && e.shotsLeft > 0) {
          e.stateT = 0;
          e.shotsLeft--;
          e.shoot(w, e.def.shot, dx, dy);
        }
        if (e.shotsLeft <= 0 && e.stateT > 0.25) {
          e.state = "idle";
          e.cd = e.def.fireRate * (0.8 + Math.random() * 0.4);
        }
        return;
      }
      if (e.aggro) {
        e.facing = dx > 0 ? 1 : -1;
        const keep = e.def.keep || 240;
        if (dist < keep - 70) e.walkToward(w, -e.facing, e.spd * 0.8 * sm);
        else if (dist > keep + 90) e.walkToward(w, e.facing, e.spd * sm);
        else e.vx = U.approach(e.vx, 0, 1200 * dt);
        if (e.cd <= 0 && dist < (e.def.range || 480) && Math.abs(dy) < 200) startWindup(e, 0.45);
      } else e.patrol(w, sm);
    },

    heavy(e, w, dt, p, dx, dy, dist, sm) {
      if (e.state === "windup") {
        e.vx = U.approach(e.vx, 0, 1400 * dt);
        if (e.stateT >= e.windTime) {
          e.state = "attack";
          e.stateT = 0;
          // Ground slam with a shockwave on both sides.
          const r = { x: e.cx - 90, y: e.y + e.h - 40, w: 180, h: 44 };
          if (U.overlap(r, p) && p.onGround !== false) p.hurt(e.dmg, e.cx);
          else if (U.overlap({ x: e.cx - 50, y: e.y, w: 100, h: e.h }, p)) p.hurt(e.dmg, e.cx);
          XM.FX.ring(e.cx, e.y + e.h, 90, "#e0d0b0", 0.35, 6);
          XM.FX.burst(e.cx, e.y + e.h, { count: 12, color: "#b8a68a", speed: 220, life: 0.4, type: XM.FX.T.DOT, angle: -Math.PI / 2, spread: 2.4, grav: 700 });
          XM.FX.shake(4, 0.2);
          XM.Audio.sfx("stomp");
        }
        return;
      }
      if (e.state === "attack") {
        if (e.stateT > 0.5) {
          e.state = "idle";
          e.cd = 1.4 + Math.random() * 0.6;
        }
        return;
      }
      if (e.aggro) {
        e.facing = dx > 0 ? 1 : -1;
        if (dist < 90 && Math.abs(dy) < 80) {
          e.vx = U.approach(e.vx, 0, 1400 * dt);
          if (e.cd <= 0) startWindup(e, 0.6);
        } else e.walkToward(w, e.facing, e.spd * sm);
      } else e.patrol(w, sm);
    },

    flyer(e, w, dt, p, dx, dy, dist, sm) {
      const t = e.t;
      if (e.state === "swoop") {
        e.vx = e.swoopVx;
        e.vy = U.approach(e.vy, e.stateT < 0.4 ? 420 : -360, 1800 * dt);
        if (e.stateT > 1.1) {
          e.state = "idle";
          e.cd = 2;
        }
        return;
      }
      if (e.state === "windup") {
        e.vx *= 0.9;
        e.vy *= 0.9;
        if (e.stateT >= e.windTime) {
          e.state = "idle";
          if (e.def.swoop && Math.random() < 0.45) {
            e.state = "swoop";
            e.stateT = 0;
            e.swoopVx = Math.sign(dx) * 260;
            e.vy = 0;
          } else {
            e.shoot(w, e.def.shot, dx, dy);
            e.cd = e.def.fireRate * (0.8 + Math.random() * 0.5);
          }
        }
        return;
      }
      if (e.aggro) {
        e.facing = dx > 0 ? 1 : -1;
        const tx = p.cx - e.facing * 160 + Math.sin(t * 0.8) * 60;
        const ty = p.y - 130 + Math.sin(t * 1.7) * 26;
        e.vx = U.approach(e.vx, U.clamp((tx - e.cx) * 2, -e.spd, e.spd) * sm, 600 * dt);
        e.vy = U.approach(e.vy, U.clamp((ty - e.cy) * 2, -e.spd, e.spd) * sm, 600 * dt);
        if (e.cd <= 0 && dist < 520) startWindup(e, 0.4);
      } else {
        e.vx = Math.sin(t * 0.7) * 50;
        e.vy = Math.sin(t * 1.3) * 30;
      }
    },

    laser(e, w, dt, p, dx, dy, dist, sm) {
      if (e.state === "windup") {
        e.vx = 0;
        if (e.stateT >= 0.9) {
          e.state = "attack";
          e.stateT = 0;
          XM.Audio.sfx("beam");
        }
        return;
      }
      if (e.state === "attack") {
        // Eye beam straight ahead.
        const y = e.y + e.h * 0.16;
        const r = { x: e.facing > 0 ? e.cx : e.cx - 520, y: y - 9, w: 520, h: 18 };
        if (U.overlap(r, p)) p.hurt(e.dmg, e.cx);
        if (e.stateT > 0.45) {
          e.state = "idle";
          e.cd = e.def.fireRate;
        }
        return;
      }
      if (e.aggro) {
        e.facing = dx > 0 ? 1 : -1;
        if (dist > 300) e.walkToward(w, e.facing, e.spd * sm);
        else e.vx = U.approach(e.vx, 0, 900 * dt);
        if (e.cd <= 0 && dist < 520 && Math.abs(dy) < 140) {
          startWindup(e, 0.9);
          XM.Audio.sfx("charge");
        }
      } else e.patrol(w, sm);
    },

    leaper(e, w, dt, p, dx, dy, dist, sm) {
      if (e.state === "leap") {
        if (e.onGround && e.stateT > 0.15) {
          e.state = "idle";
          e.cd = 1.0 + Math.random() * 0.6;
          e.vx = 0;
        }
        return;
      }
      if (e.state === "tongue") {
        if (e.stateT > 0.18 && !e.tongueHit) {
          e.tongueHit = true;
          e.melee(w, 150, 0.9, 0.5);
          XM.Audio.sfx("slash");
        }
        if (e.stateT > 0.45) {
          e.state = "idle";
          e.cd = 1.2;
        }
        return;
      }
      if (e.state === "windup") {
        e.vx = U.approach(e.vx, 0, 1400 * dt);
        if (e.stateT >= e.windTime) {
          if (e.next === "tongue") {
            e.state = "tongue";
            e.stateT = 0;
            e.tongueHit = false;
            return;
          }
          e.state = "leap";
          e.stateT = 0;
          e.vy = -560;
          e.vx = U.clamp(dx * 1.6, -360, 360);
          e.onGround = false;
          XM.Audio.sfx("jump");
        }
        return;
      }
      if (e.aggro) {
        e.facing = dx > 0 ? 1 : -1;
        if (e.cd <= 0 && e.onGround) {
          if (e.def.tongue && dist < 150 && Math.abs(dy) < 50) startWindup(e, 0.3, "tongue");
          else if (dist < 300) startWindup(e, 0.32);
          else e.walkToward(w, e.facing, e.spd * sm);
        } else if (dist > 120) e.walkToward(w, e.facing, e.spd * 0.7 * sm);
        else e.vx = U.approach(e.vx, 0, 900 * dt);
      } else e.patrol(w, sm);
    },

    flamer(e, w, dt, p, dx, dy, dist, sm) {
      if (e.state === "attack") {
        e.vx = U.approach(e.vx, 0, 1400 * dt);
        if (Math.random() < 0.7) {
          const sx = e.cx + e.facing * 18;
          const sy = e.y + e.h * 0.42;
          w.combat.enemyShoot({ kind: "fire", x: sx, y: sy, vx: e.facing * U.rand(260, 380), vy: U.rand(-60, 40), r: 10, dmg: e.dmg, life: 0.5, pierce: true, color: "#ff7a1a" });
        }
        if (e.stateT > 1.2) {
          e.state = "idle";
          e.cd = 1.8;
        }
        return;
      }
      if (e.state === "windup") {
        if (e.stateT >= e.windTime) {
          e.state = "attack";
          e.stateT = 0;
          XM.Audio.sfx("fire");
        }
        return;
      }
      if (e.aggro) {
        e.facing = dx > 0 ? 1 : -1;
        if (dist > 170) e.walkToward(w, e.facing, e.spd * sm);
        else e.vx = U.approach(e.vx, 0, 900 * dt);
        if (e.cd <= 0 && dist < 240 && Math.abs(dy) < 80) startWindup(e, 0.4);
      } else e.patrol(w, sm);
    },

    creature(e, w, dt, p, dx, dy, dist, sm) {
      const t = e.t;
      if (e.aggro) {
        const ang = Math.atan2(p.cy - e.cy, p.cx - e.cx);
        e.vx = U.approach(e.vx, Math.cos(ang) * e.spd * sm, 300 * dt);
        e.vy = U.approach(e.vy, Math.sin(ang) * e.spd * sm + Math.sin(t * 3) * 40, 300 * dt);
        e.facing = dx > 0 ? 1 : -1;
        if (e.def.burst && e.cd <= 0 && dist < 380) {
          e.cd = 3;
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + t;
            w.combat.enemyShoot({ kind: "plasma", x: e.cx, y: e.cy, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, r: 6, dmg: e.dmg * 0.7, life: 1.6, color: e.def.pal.glow, ghost: true });
          }
          XM.Audio.sfx("blast");
        }
      } else {
        e.vx = Math.sin(t * 0.8) * 40;
        e.vy = Math.cos(t * 1.1) * 30;
      }
    },

    turret(e, w, dt, p, dx, dy, dist) {
      e.facing = dx > 0 ? 1 : -1;
      if (e.state === "windup") {
        if (e.stateT >= 0.5) {
          e.state = "idle";
          e.shoot(w, e.def.shot, dx, dy);
          e.cd = e.def.fireRate;
        }
        return;
      }
      if (e.cd <= 0 && dist < (e.def.range || 500) && w.cam.visible(e.x, e.y, e.w, e.h, 0)) startWindup(e, 0.5);
    },

    guardian(e, w, dt, p, dx, dy, dist, sm) {
      if (e.state === "windup") {
        e.vx = U.approach(e.vx, 0, 1400 * dt);
        if (e.stateT >= e.windTime) {
          e.state = "attack";
          e.stateT = 0;
          if (e.next === "shoot") e.shoot(w, e.def.shot, dx, dy);
          else {
            e.melee(w, 60, 1.1);
            XM.Audio.sfx("stomp");
            XM.FX.shake(3, 0.15);
          }
        }
        return;
      }
      if (e.state === "attack") {
        if (e.stateT > 0.5) {
          e.state = "idle";
          e.cd = 1.3;
        }
        return;
      }
      if (e.aggro) {
        // Turns slowly, so heroes can get behind the shield.
        const want = dx > 0 ? 1 : -1;
        if (want !== e.facing) {
          e.turnT = (e.turnT || 0) + dt;
          if (e.turnT > 0.9) {
            e.facing = want;
            e.turnT = 0;
          }
        } else e.turnT = 0;
        if (dist < 70) {
          e.vx = U.approach(e.vx, 0, 900 * dt);
          if (e.cd <= 0) startWindup(e, 0.55);
        } else {
          e.walkToward(w, e.facing, e.spd * sm);
          if (e.def.shot && e.cd <= 0 && dist < 420) startWindup(e, 0.6, "shoot");
        }
      } else e.patrol(w, sm);
    },

    thrower(e, w, dt, p, dx, dy, dist, sm) {
      if (e.state === "windup") {
        e.vx = U.approach(e.vx, 0, 1400 * dt);
        if (e.stateT >= e.windTime) {
          e.state = "idle";
          e.shoot(w, e.def.shot, dx, dy);
          e.cd = e.def.fireRate * (0.8 + Math.random() * 0.4);
        }
        return;
      }
      if (e.aggro) {
        e.facing = dx > 0 ? 1 : -1;
        if (dist < 150) e.walkToward(w, -e.facing, e.spd * sm);
        else if (dist > 380) e.walkToward(w, e.facing, e.spd * sm);
        else e.vx = U.approach(e.vx, 0, 900 * dt);
        if (e.cd <= 0 && dist < 460) startWindup(e, 0.5);
      } else e.patrol(w, sm);
    },

    elite(e, w, dt, p, dx, dy, dist, sm) {
      const reach = e.def.reach || 38;
      if (e.state === "dash") {
        if (e.stateT > 0.22) e.state = "idle";
        return;
      }
      if (e.state === "windup") {
        e.vx = U.approach(e.vx, 0, 1400 * dt);
        if (e.stateT >= e.windTime) {
          e.state = "attack";
          e.stateT = 0;
          if (e.next === "shoot") e.shoot(w, e.def.shot, dx, dy);
          else {
            e.melee(w, reach + 12);
            XM.Audio.sfx("slash");
            e.combo = (e.combo || 0) + 1;
          }
        }
        return;
      }
      if (e.state === "attack") {
        if (e.stateT > 0.25) {
          e.state = "idle";
          // Chains a second strike sometimes.
          if (e.combo === 1 && dist < reach + 20 && Math.random() < 0.5) {
            startWindup(e, 0.2);
            return;
          }
          e.combo = 0;
          e.cd = 0.8 + Math.random() * 0.5;
        }
        return;
      }
      if (e.aggro) {
        e.facing = dx > 0 ? 1 : -1;
        // Sidestep when the hero swings close by.
        if (p.lockT > 0 && dist < 70 && e.onGround && Math.random() < 0.04) {
          e.state = "dash";
          e.stateT = 0;
          e.vx = -e.facing * 360;
          e.vy = -220;
          return;
        }
        if (dist < reach + 14 && Math.abs(dy) < 60) {
          e.vx = U.approach(e.vx, 0, 1400 * dt);
          if (e.cd <= 0) startWindup(e, 0.32);
        } else {
          e.walkToward(w, e.facing, e.spd * sm);
          if (e.def.shot && e.cd <= 0 && dist > 160 && dist < 460 && Math.abs(dy) < 160) startWindup(e, 0.4, "shoot");
        }
      } else e.patrol(w, sm);
    },

    disguised(e, w, dt, p, dx, dy, dist, sm) {
      if (e.state === "disguised") {
        e.vx = Math.sin(e.t * 0.6) * 20;
        e.facing = e.vx > 0 ? 1 : -1;
        if (dist < 130 && Math.abs(dy) < 60) e.reveal();
        return;
      }
      BEHAVIORS.elite(e, w, dt, p, dx, dy, dist, sm);
    },

    prop(e) {
      e.vx = 0;
    },
  };

  // ---------------- Art ----------------
  const L = U.lerp;
  function legsWalk(e) {
    const moving = Math.abs(e.vx) > 10 && e.onGround;
    return moving ? Math.sin(e.anim * 9) : 0;
  }

  const ART = {
    sentinel(ctx, e) {
      const p = e.def.pal;
      const s = e.def.scale || 1;
      const fly = e.def.pose === "fly";
      ctx.save();
      ctx.translate(e.cx, e.y + e.h);
      ctx.scale(e.facing * s * (e.w / 44 / s), s * (e.h / 96 / s));
      const sw = legsWalk(e);
      const wind = e.state === "windup";
      // Legs
      if (fly) {
        A.limb(ctx, -6, -40, -12, -10, 11, p.dark);
        A.limb(ctx, 6, -40, 2, -12, 11, p.main);
        A.glow(ctx, -12, -4, 16, "#7ab0ff", 0.8);
        A.glow(ctx, 2, -6, 16, "#7ab0ff", 0.8);
      } else {
        A.limb(ctx, -5, -44, -5 - sw * 8, -6, 12, p.dark);
        A.limb(ctx, 6, -44, 6 + sw * 8, -6, 12, p.main);
        A.box(ctx, -14 - sw * 8, -10, 18, 10, p.dark, true, 2);
        A.box(ctx, -2 + sw * 8, -10, 18, 10, p.main, true, 2);
      }
      // Back arm
      A.limb(ctx, -10, -82, -16, -52, 9, p.dark);
      // Torso
      A.poly(ctx, [-16, -44, 16, -44, 20, -86, -18, -86], p.main, true, 2.5);
      A.poly(ctx, [-12, -60, 14, -60, 16, -84, -14, -84], p.accent, true, 1.5);
      A.circle(ctx, 2, -72, 5, p.glow, true, 1.5);
      ctx.fillStyle = p.dark;
      ctx.fillRect(-15, -48, 30, 5);
      // Head
      A.poly(ctx, [-12, -86, 12, -86, 14, -100, 6, -108, -10, -108, -14, -98], p.main, true, 2);
      A.poly(ctx, [-2, -88, 13, -88, 14, -100, 4, -104], p.face, true, 1.5);
      const eyeGlow = wind || e.state === "attack";
      A.glow(ctx, 9, -97, eyeGlow ? 14 : 6, p.glow, eyeGlow ? 1 : 0.6);
      ctx.fillStyle = p.glow;
      ctx.fillRect(5, -98, 8, 2.5);
      // Front arm: raised palm while shooting
      const shooting = wind || e.state === "attack";
      if (shooting) {
        A.limb(ctx, 10, -80, 30, -78, 10, p.main);
        A.circle(ctx, 34, -78, 6, p.face, true, 1.5);
        A.glow(ctx, 38, -78, wind ? 12 + Math.sin(e.t * 30) * 4 : 18, p.glow, 0.9);
      } else {
        A.limb(ctx, 10, -80, 16 + sw * 4, -50, 10, p.main);
        A.circle(ctx, 16 + sw * 4, -48, 6, p.face, true, 1.5);
      }
      ctx.restore();
      // Laser Sentinel eye beam
      if (e.def.beh === "laser" && (e.state === "windup" || e.state === "attack")) {
        const y = e.y + e.h * 0.16;
        const x0 = e.cx + e.facing * 10;
        if (e.state === "windup") {
          ctx.globalAlpha = 0.3 + 0.3 * Math.sin(e.t * 30);
          ctx.strokeStyle = p.glow;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x0, y);
          ctx.lineTo(x0 + e.facing * 520, y);
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = p.glow;
          ctx.globalAlpha = 0.6;
          ctx.fillRect(Math.min(x0, x0 + e.facing * 520), y - 9, 520, 18);
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(Math.min(x0, x0 + e.facing * 520), y - 3, 520, 6);
        }
      }
    },

    reaver(ctx, e) {
      const p = e.def.pal;
      const s = e.def.scale || 1;
      ctx.save();
      ctx.translate(e.cx, e.y + e.h);
      ctx.scale(e.facing * s, s);
      const sw = legsWalk(e);
      const atk = e.state === "attack" ? 1 : e.state === "windup" ? -0.5 : 0;
      A.limb2(ctx, { x: -2, y: -30 }, { x: -2 - sw * 6, y: -16 }, { x: -4 - sw * 8, y: -2 }, 6, 6, p.dark);
      A.ellipse(ctx, -1 - sw * 8, -2, 6, 3, 0, "#1a1a1a", true, 1);
      A.limb(ctx, -4, -48, -8, -30, 6, p.dark);
      A.poly(ctx, [-9, -30, 9, -30, 11, -52, -9, -52], p.main, true, 2);
      ctx.fillStyle = p.accent;
      ctx.fillRect(-9, -44, 20, 4);
      A.limb2(ctx, { x: 2, y: -30 }, { x: 3 + sw * 6, y: -16 }, { x: 3 + sw * 8, y: -2 }, 6, 6, p.main);
      A.ellipse(ctx, 6 + sw * 8, -2, 6, 3, 0, "#1a1a1a", true, 1);
      // Head with a cybernetic eye
      A.circle(ctx, 2, -59, 7, p.skin, true, 2);
      A.poly(ctx, [-6, -63, 8, -66, 9, -58, -5, -60], p.dark, true, 1);
      A.glow(ctx, 6, -60, 6, p.glow, 0.9);
      ctx.fillStyle = p.glow;
      ctx.fillRect(4, -61, 4, 2);
      // Robotic arm
      const big = e.def.bigArm ? 1.5 : 1;
      if (e.def.gun) {
        A.limb(ctx, 4, -48, 18, -44 - (atk > 0 ? 2 : 0), 7, p.metal);
        A.box(ctx, 14, -48, 16, 6, "#2a2a2a", true, 1);
      } else if (e.def.blade) {
        A.limb(ctx, 4, -48, 12 + atk * 10, -40 - atk * 4, 7, p.metal);
        A.limb(ctx, 12 + atk * 10, -40 - atk * 4, 30 + atk * 12, -50 + atk * 6, 3, "#e8f0ff");
        A.glow(ctx, 30 + atk * 12, -50 + atk * 6, 8, p.glow, 0.7);
      } else {
        A.limb(ctx, 4, -48, 12 + atk * 12, -36 - atk * 6, 8 * big, p.metal);
        A.circle(ctx, 14 + atk * 12, -35 - atk * 6, 5.5 * big, p.metal, true, 1.5);
      }
      ctx.restore();
    },

    soldier(ctx, e) {
      const d = e.def;
      const p = d.pal;
      ctx.save();
      ctx.translate(e.cx, e.y + e.h);
      ctx.scale(e.facing * (e.h / 60), e.h / 60);
      const sw = legsWalk(e);
      const atk = e.state === "attack" ? 1 : e.state === "windup" ? -0.6 : 0;
      if (d.energyBody) A.glow(ctx, 0, -34, 40, p.glow, 0.4);
      A.limb2(ctx, { x: -2, y: -30 }, { x: -2 - sw * 6, y: -16 }, { x: -4 - sw * 8, y: -2 }, 6, 6, A.shade(p.main, -0.25));
      A.ellipse(ctx, -1 - sw * 8, -2, 6, 3, 0, p.dark, true, 1);
      A.limb(ctx, -3, -48, -7 - atk * 2, -32, 5.5, A.shade(p.main, -0.25));
      A.poly(ctx, [-8, -30, 8, -30, 10, -52, -9, -52], p.main, true, 2);
      ctx.fillStyle = p.accent;
      ctx.fillRect(-8, -34, 17, 3);
      if (d.helmet === "magneto") {
        A.poly(ctx, [-9, -52, 10, -52, 6, -40, -6, -40], p.accent, true, 1);
      }
      if (d.spikes) A.poly(ctx, [-8, -52, -14, -60, -6, -50, -4, -60, 0, -51], "#e8fbff", true, 1);
      A.limb2(ctx, { x: 2, y: -30 }, { x: 3 + sw * 6, y: -16 }, { x: 3 + sw * 8, y: -2 }, 6, 6, p.main);
      A.ellipse(ctx, 6 + sw * 8, -2, 6, 3, 0, p.dark, true, 1);
      // Head and helmet
      A.circle(ctx, 1, -59, 7, p.skin, true, 2);
      switch (d.helmet) {
        case "visor":
          A.poly(ctx, [-7, -60, -5, -67, 6, -68, 8, -60], p.dark, true, 1.5);
          ctx.fillStyle = p.visor;
          ctx.fillRect(1, -62, 7, 3);
          break;
        case "lamp":
          A.poly(ctx, [-8, -60, -6, -68, 7, -68, 9, -60], p.accent, true, 1.5);
          A.glow(ctx, 9, -64, 12, "#fff6a0", 0.8);
          break;
        case "cap":
          A.poly(ctx, [-8, -62, -5, -68, 7, -68, 13, -63], p.main, true, 1.5);
          break;
        case "beret":
          A.ellipse(ctx, -1, -66, 8, 3.5, -0.2, p.accent, true, 1.5);
          break;
        case "crest":
          A.poly(ctx, [-8, -58, -6, -68, 7, -68, 9, -60], p.main, true, 1.5);
          A.poly(ctx, [-4, -68, -10, -80, 4, -70], p.accent, true, 1.5);
          ctx.fillStyle = p.visor;
          ctx.fillRect(2, -62, 6, 2);
          break;
        case "magneto":
          A.poly(ctx, [-8, -56, -7, -68, 2, -71, 9, -66, 9, -58, 4, -60, 3, -56], p.main, true, 1.5);
          ctx.fillStyle = p.accent;
          ctx.fillRect(-7, -66, 4, 8);
          break;
        default:
          ctx.fillStyle = "#1a1a1a";
          ctx.fillRect(3, -61, 2, 3);
      }
      // Weapon arm
      if (d.gun) {
        A.limb(ctx, 3, -48, 14, -44, 5.5, p.main);
        A.box(ctx, 10, -48, 18, 5, "#2a2a2a", true, 1, 1.5);
        if (e.state === "windup") A.glow(ctx, 30, -46, 8, p.glow, 0.8);
      } else if (d.tool === "pick") {
        const a = L(-2.4, 0.4, atk > 0 ? 1 : 0) + (atk < 0 ? -0.5 : 0);
        A.limb(ctx, 3, -48, 12, -40, 5.5, p.main);
        ctx.save();
        ctx.translate(12, -40);
        ctx.rotate(a + 1.2);
        A.limb(ctx, 0, 0, 0, -20, 2.5, "#7a5a3a");
        A.poly(ctx, [-9, -20, 9, -22, 0, -18], "#9aa3b2", true, 1.5);
        ctx.restore();
      } else if (d.tool === "spear") {
        const thrust = atk > 0 ? 14 : atk < 0 ? -6 : 0;
        A.limb(ctx, 3, -48, 12 + thrust * 0.4, -42, 5.5, p.main);
        A.limb(ctx, -10 + thrust, -42, 40 + thrust, -44, 2.5, p.accent);
        A.poly(ctx, [40 + thrust, -48, 50 + thrust, -44, 40 + thrust, -40], "#e8f0ff", true, 1.2);
      } else {
        const reach = atk > 0 ? 18 : atk < 0 ? -4 : 6;
        A.limb(ctx, 3, -48, 8 + reach, -42 + (atk > 0 ? -2 : 6), 5.5, p.main);
        A.circle(ctx, 9 + reach, -41 + (atk > 0 ? -2 : 6), 4, d.glowFists ? p.glow : p.skin, true, 1.2);
        if (d.glowFists) A.glow(ctx, 9 + reach, -41, 10, p.glow, 0.8);
        if (d.baton) A.limb(ctx, 9 + reach, -41, 18 + reach, -54, 2.5, "#1a1a1a");
      }
      ctx.restore();
    },

    beast(ctx, e) {
      const p = e.def.pal;
      ctx.save();
      ctx.translate(e.cx, e.y + e.h);
      ctx.scale(e.facing, 1);
      const sw = legsWalk(e);
      const crouch = e.state === "windup" ? 6 : 0;
      const leap = e.state === "leap";
      A.limb(ctx, -12, -18 + crouch, -16 - sw * 6, -2, 6, A.shade(p.main, -0.25));
      A.limb(ctx, 10, -18 + crouch, 14 + sw * 6, -2, 6, A.shade(p.main, -0.25));
      A.ellipse(ctx, 0, -22 + crouch, 20, 12, leap ? -0.3 : 0, p.main, true, 2);
      ctx.fillStyle = p.dark;
      for (let i = 0; i < 4; i++) ctx.fillRect(-12 + i * 6, -33 + crouch, 3, 5);
      A.limb(ctx, -8, -18 + crouch, -10 + sw * 6, -2, 6, p.main);
      A.limb(ctx, 12, -18 + crouch, 16 - sw * 6, -2, 6, p.main);
      A.circle(ctx, 20, -28 + crouch, 9, p.main, true, 2);
      A.poly(ctx, [24, -24 + crouch, 34, -22 + crouch, 24, -18 + crouch], p.accent, true, 1);
      A.glow(ctx, 23, -31 + crouch, 5, p.glow, 0.9);
      ctx.fillStyle = p.glow;
      ctx.fillRect(21, -32 + crouch, 4, 2);
      ctx.restore();
    },

    toad(ctx, e) {
      const p = e.def.pal;
      ctx.save();
      ctx.translate(e.cx, e.y + e.h);
      ctx.scale(e.facing, 1);
      const sw = legsWalk(e);
      const crouch = e.state === "windup" ? 4 : 0;
      A.limb2(ctx, { x: -6, y: -16 + crouch }, { x: 6, y: -12 }, { x: -2 - sw * 4, y: -2 }, 6, 5, p.dark);
      A.ellipse(ctx, 0, -2, 8, 3, 0, p.dark, true, 1);
      A.poly(ctx, [-12, -14 + crouch, 10, -14 + crouch, 14, -32 + crouch, -6, -38 + crouch], p.accent, true, 2);
      A.limb2(ctx, { x: 4, y: -16 + crouch }, { x: 16, y: -12 }, { x: 8 + sw * 4, y: -2 }, 6, 5, p.main);
      A.ellipse(ctx, 10 + sw * 4, -2, 8, 3, 0, p.main, true, 1);
      A.limb(ctx, 8, -30 + crouch, 18, -18 + crouch, 5, p.skin);
      A.ellipse(ctx, 12, -40 + crouch, 11, 8, 0, p.skin, true, 2);
      A.circle(ctx, 14, -46 + crouch, 3.5, "#ffe680", true, 1);
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(15, -47 + crouch, 2, 2);
      if (e.state === "tongue") {
        const k = Math.min(1, e.stateT / 0.18) * (e.stateT > 0.3 ? Math.max(0, 1 - (e.stateT - 0.3) / 0.15) : 1);
        A.limb(ctx, 20, -38 + crouch, 20 + 140 * k, -36, 4, "#e0607a");
        A.circle(ctx, 20 + 140 * k, -36, 4, "#e0607a", true, 1);
      }
      ctx.restore();
    },

    pyro(ctx, e) {
      const p = e.def.pal;
      ctx.save();
      ctx.translate(e.cx, e.y + e.h);
      ctx.scale(e.facing, 1);
      const sw = legsWalk(e);
      A.box(ctx, -16, -52, 9, 22, "#9aa3b2", true, 3);
      A.limb2(ctx, { x: -2, y: -30 }, { x: -2 - sw * 6, y: -16 }, { x: -4 - sw * 8, y: -2 }, 6, 6, A.shade(p.main, -0.25));
      A.poly(ctx, [-8, -30, 8, -30, 10, -52, -9, -52], p.main, true, 2);
      ctx.fillStyle = p.accent;
      ctx.fillRect(-8, -40, 17, 3);
      A.limb2(ctx, { x: 2, y: -30 }, { x: 3 + sw * 6, y: -16 }, { x: 3 + sw * 8, y: -2 }, 6, 6, p.main);
      A.circle(ctx, 1, -59, 7, p.main, true, 2);
      A.box(ctx, -1, -63, 9, 5, "#2a2a2a", true, 2, 1);
      ctx.fillStyle = "#ff9a3a";
      ctx.fillRect(1, -62, 6, 3);
      A.limb(ctx, 3, -48, 16, -44, 5.5, p.main);
      A.box(ctx, 14, -47, 10, 6, "#6a6a72", true, 1, 1.5);
      if (e.state === "windup" || e.state === "attack") A.glow(ctx, 26, -44, 12, "#ff7a1a", 0.9);
      ctx.restore();
    },

    creature(ctx, e) {
      const p = e.def.pal;
      const t = e.t;
      const r = e.w * 0.48;
      A.glow(ctx, e.cx, e.cy, r * 2.6, p.glow, 0.5 + 0.2 * Math.sin(t * 4));
      if (e.def.tentacles) {
        ctx.strokeStyle = p.dark;
        ctx.lineWidth = 3;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI + 0.3;
          ctx.beginPath();
          ctx.moveTo(e.cx, e.cy);
          ctx.quadraticCurveTo(e.cx + Math.cos(a) * r * 1.6 + Math.sin(t * 3 + i) * 6, e.cy + r, e.cx + Math.cos(a) * r * 1.2, e.cy + r * 2 + Math.sin(t * 4 + i) * 5);
          ctx.stroke();
        }
      }
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const rr = r * (0.85 + 0.18 * Math.sin(t * 5 + i * 1.7));
        pts.push(e.cx + Math.cos(a) * rr, e.cy + Math.sin(a) * rr);
      }
      A.poly(ctx, pts, p.main, true, 2);
      A.circle(ctx, e.cx, e.cy, r * 0.5, p.accent, false);
      A.circle(ctx, e.cx + e.facing * r * 0.2, e.cy - 2, r * 0.22, p.dark, false);
    },

    drone(ctx, e) {
      const p = e.def.pal;
      const t = e.t;
      ctx.save();
      ctx.translate(e.cx, e.cy);
      ctx.rotate(U.clamp(e.vx / 600, -0.3, 0.3));
      A.limb(ctx, -18, -6, 18, -6, 2, "#22262e");
      ctx.fillStyle = "rgba(200,220,255,0.5)";
      ctx.fillRect(-22 + Math.sin(t * 60) * 2, -9, 10, 2);
      ctx.fillRect(12 - Math.sin(t * 60) * 2, -9, 10, 2);
      A.ellipse(ctx, 0, 0, 15, 8, 0, p.main, true, 2);
      A.ellipse(ctx, 0, 3, 10, 4, 0, p.dark, false);
      A.circle(ctx, e.facing * 6, 2, 3.5, "#111", true, 1);
      A.glow(ctx, e.facing * 6, 2, e.state === "windup" ? 12 : 6, p.glow, 0.9);
      ctx.restore();
    },

    bot(ctx, e) {
      const p = e.def.pal;
      const s = e.def.scale || 1;
      ctx.save();
      ctx.translate(e.cx, e.y + e.h);
      ctx.scale(e.facing * s, s);
      const sw = legsWalk(e);
      A.limb(ctx, -6, -14, -8 - sw * 4, -2, 5, p.dark);
      A.limb(ctx, 6, -14, 8 + sw * 4, -2, 5, p.dark);
      A.box(ctx, -12, -34, 24, 22, p.main, true, 4);
      ctx.fillStyle = p.dark;
      ctx.fillRect(-10, -18, 20, 3);
      A.box(ctx, -8, -44, 18, 11, p.main, true, 3);
      A.box(ctx, 0, -42, 9, 6, "#111", true, 1, 1);
      A.glow(ctx, 5, -39, e.state === "windup" ? 10 : 5, p.glow, 0.9);
      A.box(ctx, 8, -30, 12, 5, p.dark, true, 1, 1.5);
      ctx.restore();
    },

    clone(ctx, e, w) {
      const id = e.disguiseOf || w.player.id;
      if (!e.look && e.disguiseOf) e.look = XM.Outfits.get(id, 0);
      if (!e.look) {
        const base = XM.Outfits.get(id, 0);
        e.look = { pal: Object.assign({}, base.pal, { suit: "#2a2a30", suit2: "#5a1a2a", accent: "#ff3b3b", glow: "#ff3b3b", cape: "#1a1a20", coat: "#2a2a30", boots: "#1a1a20", gloves: "#3a1a1a", mask: "#2a2a30" }), flags: Object.assign({}, base.flags, { stealth: true, aura: false, ultimate: false }) };
      }
      const st = e.state === "windup" ? "attack" : e.state === "attack" ? "attack" : Math.abs(e.vx) > 20 ? "run" : "idle";
      if (!e.disguiseOf) A.glow(ctx, e.cx, e.cy, 40, "#ff3b3b", 0.25);
      XM.CharArt.draw(ctx, id, e.look, { state: st, t: e.t, phase: e.anim * 9, kind: "punch", prog: e.state === "attack" ? 0.5 : 0.1, speed: e.vx }, e.cx, e.y + e.h, e.facing, e.h / XM.CHAR[id].size.h, 0.92);
    },

    crystal(ctx, e) {
      const p = e.def.pal;
      ctx.save();
      ctx.translate(e.cx, e.y + e.h);
      ctx.scale(e.facing, 1);
      const sw = legsWalk(e);
      A.glow(ctx, 0, -28, 34, p.glow, 0.35);
      A.poly(ctx, [-12 - sw * 3, 0, -6, -18, -2, 0], p.dark, true, 1.5);
      A.poly(ctx, [4 + sw * 3, 0, 8, -18, 14, 0], p.main, true, 1.5);
      A.poly(ctx, [-16, -16, 16, -16, 20, -40, 0, -52, -18, -40], p.main, true, 2);
      A.poly(ctx, [-6, -40, 2, -52, 10, -34], p.accent, false);
      A.poly(ctx, [-18, -38, -26, -56, -12, -44], p.accent, true, 1.5);
      A.poly(ctx, [12, -42, 18, -62, 22, -40], p.main, true, 1.5);
      A.circle(ctx, 8, -32, 3, "#ffffff", false);
      const arm = e.state === "windup" ? -10 : 0;
      A.poly(ctx, [12, -30, 28, -26 + arm, 22, -20], p.main, true, 1.5);
      ctx.restore();
    },

    guardian(ctx, e) {
      const p = e.def.pal;
      ctx.save();
      ctx.translate(e.cx, e.y + e.h);
      ctx.scale(e.facing, 1);
      const sw = legsWalk(e);
      const atk = e.state === "attack" ? 1 : e.state === "windup" ? -1 : 0;
      A.box(ctx, -14 - sw * 4, -24, 11, 24, p.dark, true, 2);
      A.box(ctx, 3 + sw * 4, -24, 11, 24, p.main, true, 2);
      A.poly(ctx, [-18, -22, 18, -22, 22, -62, -20, -62], p.main, true, 2.5);
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(-12, -54, 24, 24);
      A.glow(ctx, 0, -42, 10, p.glow, 0.8);
      A.box(ctx, -10, -78, 20, 16, p.main, true, 3);
      ctx.fillStyle = p.glow;
      ctx.fillRect(0, -72, 9, 3);
      // Shield
      A.poly(ctx, [18, -70, 30, -66, 30, -18, 18, -14], p.accent, true, 2);
      A.circle(ctx, 24, -42, 4, p.glow, true, 1);
      // Hammer arm behind
      A.limb(ctx, -16, -58, -24 + atk * 20, -66 - atk * 14, 7, p.dark);
      ctx.restore();
    },

    civilian(ctx, e) {
      const p = e.def.pal;
      ctx.save();
      ctx.translate(e.cx, e.y + e.h);
      ctx.scale(e.facing, 1);
      const sw = legsWalk(e);
      A.limb(ctx, -2, -28, -3 - sw * 5, -2, 6, "#2a2a30");
      A.limb(ctx, 3, -28, 4 + sw * 5, -2, 6, "#2a2a30");
      A.poly(ctx, [-9, -50, 9, -50, 12, -16, -12, -16], p.main, true, 2);
      A.circle(ctx, 1, -57, 7, p.skin, true, 2);
      A.ellipse(ctx, 0, -63, 10, 3, 0, p.dark, true, 1.5);
      A.box(ctx, -6, -70, 12, 7, p.dark, true, 2, 1.5);
      ctx.restore();
    },

    turret(ctx, e) {
      const p = e.def.pal;
      A.box(ctx, e.x, e.y + e.h - 10, e.w, 10, "#3a3f4a", true, 2);
      A.ellipse(ctx, e.cx, e.y + e.h - 12, 13, 10, 0, p.main, true, 2);
      const ang = Math.atan2(e.world.player.cy - e.cy, e.world.player.cx - e.cx);
      ctx.save();
      ctx.translate(e.cx, e.y + e.h - 14);
      ctx.rotate(ang);
      A.box(ctx, 0, -3, 20, 6, "#22262e", true, 1, 1.5);
      ctx.restore();
      A.glow(ctx, e.cx, e.y + e.h - 14, e.state === "windup" ? 12 : 5, p.glow, 0.9);
    },

    barrel(ctx, e) {
      A.box(ctx, e.x, e.y, e.w, e.h, "#c4252c", true, 4);
      ctx.fillStyle = "#f2c230";
      ctx.fillRect(e.x + 2, e.y + 8, e.w - 4, 4);
      ctx.fillRect(e.x + 2, e.y + e.h - 12, e.w - 4, 4);
      A.text(ctx, "!", e.cx, e.cy, 12, "#ffffff", "center");
    },

    machine(ctx, e) {
      const t = e.t;
      A.box(ctx, e.x, e.y + 20, e.w, e.h - 20, "#4a5060", true, 4);
      A.box(ctx, e.x + 8, e.y, e.w - 16, 26, "#6a7080", true, 4);
      const g = 0.6 + 0.3 * Math.sin(t * 5);
      A.glow(ctx, e.cx, e.y + 48, 30, "#3affd0", g);
      A.circle(ctx, e.cx, e.y + 48, 12, "#bffff0", true, 2);
      ctx.strokeStyle = "#3affd0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(e.x + 6, e.y + 30);
      ctx.lineTo(e.x + e.w - 6, e.y + 30);
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = Math.sin(t * 4 + i) > 0 ? "#ff3b3b" : "#3a0a0a";
        ctx.fillRect(e.x + 10 + i * 12, e.y + 8, 6, 6);
      }
    },

    node(ctx, e) {
      const t = e.t;
      const p = e.def.pal;
      A.poly(ctx, [e.x, e.y + e.h, e.x + 10, e.y + 20, e.cx, e.y, e.x + e.w - 10, e.y + 20, e.x + e.w, e.y + e.h], "#2a2a4a", true, 2);
      A.glow(ctx, e.cx, e.cy, 40 + Math.sin(t * 6) * 6, p.glow, 0.7);
      A.poly(ctx, [e.cx, e.y + 12, e.cx + 12, e.cy, e.cx, e.y + e.h - 12, e.cx - 12, e.cy], "#ffd0ff", true, 2);
    },
  };

  XM.ENEMY_TYPES = TYPES;
  XM.ENEMY_PAL = PAL;
  XM.Enemy = Enemy;
  XM.EnemyArt = ART;
  XM.EnemyBehaviors = BEHAVIORS;
})(window.XM);
