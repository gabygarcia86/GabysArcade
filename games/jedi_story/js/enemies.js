/*
 * Enemy: one reusable class driven by the TYPES table. To add an enemy, add a row
 * here. Stats: hp, speed, sight (px), and optional ranged/melee blocks. guard means
 * it blocks saber hits from the front until Force Push breaks its stance.
 */
(function (J) {
  const { clamp, approach, rand, overlap } = J.U;
  const { Art, Actor } = J;

  const bolt = (dmg, rate, opts = {}) => ({ dmg, rate, speed: 440, burst: 1, gap: 0.14, color: "#ff4040", ...opts });

  const TYPES = {
    training: { name: "Training Remote", fly: true, drawFly: (c, e, t) => Art.remote(c, e, t), w: 22, h: 22, scale: 1, hp: 10, speed: 110, sight: 420, droid: true, score: 50,
      ranged: bolt(4, 2.1, { speed: 300, color: "#58c8ff" }), hover: 80 },
    storm: { name: "Stormtrooper", skin: "storm", prop: "rifle", hp: 20, speed: 76, sight: 470, score: 100, ranged: bolt(8, 1.7), melee: { dmg: 8, range: 44 } },
    scout: { name: "Scout Trooper", skin: "scout", prop: "rifle", hp: 16, speed: 110, sight: 560, score: 100, ranged: bolt(7, 1.3, { speed: 500 }), melee: { dmg: 7, range: 44 } },
    snow: { name: "Snowtrooper", skin: "snow", prop: "rifle", hp: 24, speed: 62, sight: 470, score: 120, ranged: bolt(9, 1.7), melee: { dmg: 9, range: 44 } },
    sand: { name: "Sandtrooper", skin: "sand", prop: "rifle", hp: 22, speed: 70, sight: 500, score: 110, ranged: bolt(8, 1.5), melee: { dmg: 8, range: 44 } },
    heavy: { name: "Heavy Trooper", skin: "heavy", prop: "heavy", hp: 55, speed: 46, sight: 520, weight: 2.2, score: 240, ranged: bolt(7, 2.6, { burst: 4, gap: 0.12 }), melee: { dmg: 14, range: 46 } },
    imperial: { name: "Imperial Trooper", skin: "imperial", prop: "rifle", hp: 26, speed: 80, sight: 500, score: 130, ranged: bolt(8, 1.5, { burst: 2 }), melee: { dmg: 9, range: 44 } },
    sithtrooper: { name: "Sith Trooper", skin: "sithtrooper", prop: "rifle", hp: 38, speed: 92, sight: 540, score: 200, ranged: bolt(10, 1.5, { burst: 2 }), melee: { dmg: 13, range: 46 } },
    merc: { name: "Mercenary", skin: "merc", prop: "rifle", hp: 28, speed: 104, sight: 520, score: 160, ranged: bolt(8, 1.2, { burst: 2, color: "#ffa640" }), melee: { dmg: 10, range: 44 } },
    b1: { name: "B1 Battle Droid", skin: "b1", prop: "rifle", hp: 10, speed: 66, sight: 450, droid: true, score: 70, ranged: bolt(6, 2.0) },
    b2: { name: "B2 Super Battle Droid", skin: "b2", hp: 48, speed: 52, sight: 480, droid: true, weight: 2.4, score: 220, ranged: bolt(8, 2.2, { burst: 3, gap: 0.16 }), melee: { dmg: 14, range: 48 } },
    advanced: { name: "Advanced Battle Droid", skin: "b1red", prop: "rifle", hp: 32, speed: 98, sight: 540, droid: true, score: 190, ranged: bolt(9, 1.4, { burst: 3, gap: 0.1 }) },
    probe: { name: "Probe Droid", fly: true, drawFly: (c, e, t) => Art.probe(c, e, t), w: 30, h: 60, scale: 1, hp: 20, speed: 90, sight: 540, droid: true, score: 130, ranged: bolt(7, 1.8), hover: 150 },
    security: { name: "Security Droid", skin: "security", prop: "rifle", scale: 1.2, h: 74, hp: 38, speed: 86, sight: 500, droid: true, score: 180, ranged: bolt(8, 2.1), melee: { dmg: 14, range: 56 } },
    darktrooper: { name: "Imperial Combat Droid", skin: "darktrooper", prop: "heavy", scale: 1.16, h: 72, hp: 75, speed: 66, sight: 540, droid: true, weight: 2.6, score: 320, ranged: bolt(9, 2.3, { burst: 4, gap: 0.1 }), melee: { dmg: 18, range: 56 } },
    assassin: { name: "Assassin Droid", skin: "assassin", prop: "rifle", scale: 1.12, h: 70, hp: 34, speed: 130, sight: 620, droid: true, score: 260, ranged: bolt(11, 1.6, { speed: 620, color: "#ff8030" }), blink: true, melee: { dmg: 12, range: 48 } },
    sithguard: { name: "Sith Guard", skin: "sithguard", prop: "staff", staffColor: "#ff3a2a", hp: 44, speed: 102, sight: 480, score: 240, melee: { dmg: 15, range: 62 }, guard: true },
    royal: { name: "Royal Guard", skin: "royal", prop: "staff", staffColor: "#ff6a3a", scale: 1.06, h: 66, hp: 60, speed: 92, sight: 480, weight: 1.5, score: 300, melee: { dmg: 18, range: 66 }, guard: true },
    elite: { name: "Elite Imperial Guard", skin: "elite", prop: "staff", staffColor: "#ff2a50", scale: 1.1, h: 68, hp: 78, speed: 112, sight: 520, weight: 1.6, score: 380, melee: { dmg: 20, range: 68 }, guard: true },
    cultist: { name: "Sith Cultist", skin: "cultist", hp: 28, speed: 44, sight: 540, score: 190, caster: true,
      ranged: bolt(12, 2.5, { speed: 190, kind: "orb", color: "#8a4dff", homing: 1.4, life: 4 }) },
    // A shadow of the player from the Exegol vision. Its look comes from the player's own Jedi.
    shadow: { name: "Dark Reflection", prop: "saber", hp: 170, speed: 158, sight: 900, weight: 1.6, score: 1500, duelist: true, melee: { dmg: 13, range: 66 }, guard: true },
  };

  for (const type of Object.values(TYPES)) {
    type.w = type.w || 24;
    type.h = type.h || 60;
    type.scale = type.scale || 1;
    type.weight = type.weight || 1;
  }

  class Enemy extends Actor {
    constructor(game, typeId, x, y, opts = {}) {
      const config = TYPES[typeId];
      super(x, y, config.w, config.h);
      this.game = game;
      this.typeId = typeId;
      this.config = config;
      this.hp = Math.ceil(config.hp * game.difficulty.enemyHp);
      this.maxHp = this.hp;
      this.seed = rand(100);
      this.state = "patrol";
      this.timer = 0;
      this.shotTimer = rand(0.3, config.ranged ? config.ranged.rate : 1);
      this.burstLeft = 0;
      this.meleeCd = 0;
      this.stun = 0;
      this.flash = 0;
      this.alert = 0;
      this.dead = false;
      this.deadT = 0;
      this.dormant = true;
      this.animT = rand(5);
      this.left = opts.left !== undefined ? opts.left : x - 110;
      this.right = opts.right !== undefined ? opts.right : x + 110;
      this.facing = opts.facing || -1;
      this.dir = this.facing;
      this.guardBroken = 0;
      this.guardHits = 0;
      this.aimAngle = 0;
      this.struck = false;
      this.blinkCd = rand(2, 4);
      this.wave = opts.wave || null;
      this.noDrop = !!opts.noDrop;
      this.alwaysActive = !!opts.alwaysActive;
      if (opts.jedi) {
        this.skinOverride = Art.jediSkin(opts.jedi);
        this.saber = new J.Lightsaber("red", opts.jedi.saberType);
      }
      if (config.fly) {
        this.y = y - config.hover;
        this.homeY = this.y;
      }
    }

    get box() {
      if (this.config.fly) {
        const up = this.typeId === "probe" ? 44 : 19;
        return { x: this.x - this.w / 2, y: this.y - up, w: this.w, h: up + 8 };
      }
      return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
    }

    get cy() {
      if (this.config.fly) return this.y - (this.typeId === "probe" ? 30 : 8);
      return this.y - this.h / 2;
    }

    update(dt) {
      const { game, config } = this;
      const { camera, player, level } = game;
      this.animT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.guardBroken = Math.max(0, this.guardBroken - dt);
      this.meleeCd = Math.max(0, this.meleeCd - dt);
      this.alert = Math.max(0, this.alert - dt);

      if (this.dead) {
        this.deadT += dt;
        this.vx = approach(this.vx, 0, 320 * dt);
        if (!config.fly) this.physics(level, dt);
        return;
      }

      const margin = 180;
      this.dormant = !this.alwaysActive && (this.x < camera.x - margin || this.x > camera.x + J.VIEW_W + margin);
      if (this.dormant) return;

      if (this.stun > 0) {
        this.stun -= dt;
        this.state = "stun";
        if (config.fly) {
          this.vx = approach(this.vx, 0, 500 * dt);
          this.vy = approach(this.vy, 0, 500 * dt);
          this.x += this.vx * dt;
          this.y += this.vy * dt;
        } else {
          if (this.onGround) this.vx = approach(this.vx, 0, 620 * dt);
          this.physics(level, dt);
        }
        this.checkKill();
        if (this.stun <= 0) this.state = "engage";
        return;
      }

      if (config.fly) this.updateFlying(dt, player);
      else this.updateGround(dt, player);
      this.checkKill();

      // Bumping into a live enemy hurts a little, so they can't be walked through for free.
      if (!player.dead && !config.fly && player.invuln === 0 && overlap(this.box, player.box) && this.state !== "stun") {
        player.takeDamage(5, Math.sign(player.x - this.x) || 1, { knock: 150 });
      }
    }

    checkKill() {
      if (this.game.level.inKillZone(this)) this.kill(0, true);
    }

    canSee(player, range) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      if (Math.abs(dx) > range || Math.abs(dy) > 260) return false;
      if (Math.sign(dx) !== this.facing && Math.abs(dx) > 130 && this.state === "patrol") return false;
      return !this.game.level.lineBlocked(this.x, this.y - 45, player.x, player.y - 40);
    }

    updateGround(dt, player) {
      const { config, game } = this;
      const { level } = game;
      const dx = player.x - this.x;
      const dist = Math.abs(dx);
      const toward = Math.sign(dx) || 1;
      let walk = 0;

      if (this.state === "windup") {
        this.timer -= dt;
        this.facing = toward;
        if (config.duelist) this.vx = approach(this.vx, 0, 900 * dt);
        if (this.timer <= 0) {
          this.state = "strike";
          this.timer = 0.14;
          this.struck = false;
          this.vx = this.facing * (config.duelist ? 280 : 130);
          game.audio.play("swing", 0.6);
        }
      } else if (this.state === "strike") {
        this.timer -= dt;
        if (!this.struck) {
          const reach = config.melee.range + 8;
          const box = { x: this.facing > 0 ? this.x : this.x - reach, y: this.y - this.h, w: reach, h: this.h };
          if (overlap(box, player.box) && !player.dead) {
            this.struck = true;
            player.receiveMelee({ dmg: config.melee.dmg, dir: this.facing, source: this });
          }
        }
        if (this.timer <= 0) {
          this.state = "recover";
          this.timer = config.duelist ? 0.32 : 0.5;
        }
      } else if (this.state === "recover") {
        this.timer -= dt;
        if (this.timer <= 0) this.state = "engage";
      } else if (this.state === "aim") {
        this.timer -= dt;
        this.facing = toward;
        this.aimAngle = clamp(Math.atan2(-(player.cy - (this.y - 45)), dist), -0.6, 0.6);
        if (this.timer <= 0) this.fire(player);
      } else if (this.state === "patrol") {
        if (this.x <= this.left) this.dir = 1;
        else if (this.x >= this.right) this.dir = -1;
        walk = this.dir;
        this.facing = this.dir;
        if (this.canSee(player, config.sight)) {
          this.state = "engage";
          this.alert = 1;
          game.particles.text(this.x, this.y - this.h - 12, "!", "#ffd76a", 18);
        }
      } else {
        this.facing = toward;
        if (config.blink) this.tryBlink(dt, player);
        const melee = config.melee;
        if (melee && dist < melee.range + 12 && Math.abs(player.y - this.y) < 90 && this.meleeCd === 0) {
          this.state = "windup";
          this.timer = config.duelist ? 0.26 : 0.38;
          this.meleeCd = config.duelist ? 0.6 : 1.3;
        } else if (config.ranged) {
          const keep = melee ? 170 : 240;
          if (dist > config.sight * 0.8) walk = toward;
          else if (dist < keep - 70) walk = -toward;
          this.shotTimer -= dt;
          if (this.shotTimer <= 0 && dist < config.sight && !level.lineBlocked(this.x, this.y - 45, player.x, player.y - 40)) {
            this.state = "aim";
            this.timer = 0.34;
            this.burstLeft = config.ranged.burst;
            walk = 0;
          }
        } else if (dist > 30) {
          walk = toward;
        }
        if (dist > config.sight * 1.5) this.state = "patrol";
      }

      if (walk) {
        const ahead = this.x + walk * (this.w / 2 + 8);
        if (level.groundBelow(ahead, this.y)) {
          this.vx = approach(this.vx, walk * config.speed, 900 * dt);
        } else {
          this.vx = 0;
          if (this.state === "patrol") this.dir = -this.dir;
        }
      } else if (this.onGround && this.state !== "strike") {
        this.vx = approach(this.vx, 0, 800 * dt);
      }
      if (this.hitWall && this.state === "patrol") this.dir = -this.hitWall;
      this.physics(level, dt);
    }

    tryBlink(dt, player) {
      const { game } = this;
      this.blinkCd -= dt;
      if (this.blinkCd > 0) return;
      this.blinkCd = rand(3, 5);
      const side = Math.sign(this.x - player.x) || 1;
      const nx = player.x - side * rand(170, 240);
      const footing = game.level.groundBelow(nx, player.y);
      if (!footing || game.level.pointSolid(nx, player.y - 30)) return;
      game.particles.smoke(this.x, this.y - 30, 6, "rgba(255,120,60,.5)");
      this.x = nx;
      this.y = footing.y;
      this.vy = 0;
      this.ground = null;
      game.particles.smoke(this.x, this.y - 30, 6, "rgba(255,120,60,.5)");
      game.audio.play("switch", 0.5);
    }

    updateFlying(dt, player) {
      const { config, game } = this;
      const dx = player.x - this.x;
      const see = this.canSee(player, config.sight);
      if (see) this.alert = 1;
      if (this.state === "aim") {
        this.timer -= dt;
        this.vx = approach(this.vx, 0, 400 * dt);
        this.vy = approach(this.vy, 0, 400 * dt);
        if (this.timer <= 0) this.fire(player);
      } else if (see || this.state === "engage") {
        this.state = "engage";
        this.facing = Math.sign(dx) || 1;
        const wantX = player.x - this.facing * 210;
        const wantY = player.y - config.hover + Math.sin(this.animT * 2) * 22;
        this.vx = approach(this.vx, clamp(wantX - this.x, -1, 1) * config.speed, 300 * dt);
        this.vy = approach(this.vy, clamp((wantY - this.y) * 0.03, -1, 1) * config.speed, 300 * dt);
        this.shotTimer -= dt;
        if (this.shotTimer <= 0 && see) {
          this.state = "aim";
          this.timer = 0.3;
          this.burstLeft = config.ranged.burst;
        }
      } else {
        this.facing = this.dir;
        this.vx = this.dir * config.speed * 0.5;
        this.vy = Math.sin(this.animT * 1.6) * 16;
        if (this.x <= this.left) this.dir = 1;
        if (this.x >= this.right) this.dir = -1;
      }
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (game.level.pointSolid(this.x, this.y - 10)) {
        this.y -= 60 * dt;
        this.vy = -20;
      }
    }

    fire(player) {
      const { config, game } = this;
      const r = config.ranged;
      const muzzleY = config.fly ? this.cy : this.y - 44 * config.scale;
      const muzzleX = this.x + this.facing * 26;
      const a = Math.atan2(player.y - 40 - muzzleY, player.x - muzzleX) + rand(-0.03, 0.03);
      game.projectiles.fire({
        kind: r.kind || "bolt", x: muzzleX, y: muzzleY,
        vx: Math.cos(a) * r.speed, vy: Math.sin(a) * r.speed,
        dmg: r.dmg, color: r.color, owner: this, homing: r.homing, life: r.life, r: r.kind === "orb" ? 9 : 4,
      });
      if (r.kind === "orb") game.audio.play("deflect", 0.5);
      else game.audio.play("blaster", 0.7);
      game.particles.spawn(muzzleX, muzzleY, 0, 0, 0.09, 7, r.color, { glow: true });
      this.burstLeft--;
      if (this.burstLeft > 0) {
        this.timer = r.gap;
      } else {
        this.state = "engage";
        this.shotTimer = r.rate * rand(0.85, 1.25);
      }
    }

    // Saber, bolts and thrown crates all arrive here.
    takeHit({ dmg, dir, knock = 150, source = "saber", stun = 0.28, finisher = false }) {
      const { config, game } = this;
      const { player } = game;
      const fromFront = source === "saber" && Math.sign(player.x - this.x) === this.facing;
      const guardUp = config.guard && this.guardBroken === 0 && this.state !== "windup" && this.state !== "strike" && this.state !== "stun";
      if (guardUp && fromFront && !finisher) {
        game.particles.sparks(this.x + this.facing * 16, this.y - 44, config.staffColor || "#ff4040", 9, 200);
        game.particles.text(this.x, this.y - this.h - 8, "BLOCKED", "#ffa080", 11);
        game.audio.play("clash", 0.7);
        game.hitStop(0.03);
        player.vx = this.facing * 170;
        this.guardHits++;
        if (this.guardHits >= 3) {
          this.guardHits = 0;
          this.guardBroken = 1.4;
        }
        if (this.meleeCd > 0.2) this.meleeCd = 0.2;
        return;
      }
      this.hp -= dmg;
      this.flash = 0.1;
      const color = player.saber.fxPick();
      const hx = this.x - dir * 8;
      const hy = this.cy - 6;
      game.particles.sparks(hx, hy, color, 10, 240);
      game.particles.hitFlash(hx, hy, color);
      game.audio.play(config.droid ? "droidHit" : "enemyHit");
      game.audio.play("saberHit", 0.7);
      game.hitStop(finisher ? 0.07 : 0.035);
      game.camera.shake(finisher ? 5 : 2.5, 0.1);
      if (!config.droid && !config.fly) game.particles.blood(hx, hy, dir);
      if (this.hp <= 0) {
        this.kill(dir);
        return;
      }
      const resist = config.weight;
      this.vx = (dir * knock) / resist;
      if (!config.fly) this.vy = Math.min(this.vy, finisher ? -210 / resist : -60);
      this.stun = Math.max(this.stun, stun / Math.max(1, resist * 0.7));
      this.facing = -dir;
    }

    pushed(dir, stats) {
      const { config, game } = this;
      this.hp -= stats.dmg;
      this.flash = 0.1;
      this.guardBroken = stats.breakGuard ? 3 : 1.5;
      this.guardHits = 0;
      game.particles.sparks(this.cx, this.cy, game.player.saber.fxPick(), 6, 160);
      if (this.hp <= 0) {
        this.vx = dir * stats.power;
        this.kill(dir);
        return;
      }
      this.vx = (dir * stats.power) / config.weight;
      this.vy = config.fly ? -80 : -260 / config.weight;
      this.onGround = false;
      this.ground = null;
      this.stun = Math.max(this.stun, stats.stun);
      this.facing = -dir;
    }

    parried() { this.stagger(1.2); }

    stagger(seconds) {
      if (this.dead) return;
      this.stun = Math.max(this.stun, seconds);
      this.guardBroken = Math.max(this.guardBroken, seconds);
      this.vx = -this.facing * 110;
    }

    kill(dir, fell = false) {
      if (this.dead) return;
      const { config, game } = this;
      this.dead = true;
      this.deadT = 0;
      this.hp = 0;
      this.flash = 0;
      if (dir) this.vx = dir * 200;
      if (config.droid && !fell) {
        game.particles.explosion(this.cx, this.cy, config.fly ? 0.5 : 0.7);
        game.audio.play("explosion", 0.5);
        this.deadT = 10; // Droids blow apart, so there's no body to fall.
      } else if (fell) {
        this.deadT = 10;
      }
      if (!config.droid && !fell) this.vy = -180;
      game.onEnemyKilled(this, fell);
    }

    get gone() { return this.dead && this.deadT > 1.4; }

    pose(t) {
      if (this.dead) return Art.pose("dead", this.deadT);
      if (this.state === "stun") return Art.pose("hurt", t);
      const { config } = this;
      if (config.prop === "saber") {
        if (this.state === "windup") return Art.pose("slash3", 0.02);
        if (this.state === "strike") return Art.pose("slash3", 0.8);
        return Math.abs(this.vx) > 20 ? Art.pose("run", t) : Art.pose("ready", t);
      }
      if (this.state === "windup") return Art.pose("meleeUp", t);
      if (this.state === "strike") return Art.pose("meleeDown", t);
      if (config.caster) return this.state === "aim" ? Art.pose("cast", t) : Art.pose("castUp", t * 0.3);
      if (this.state === "aim" || this.state === "engage") {
        return Math.abs(this.vx) > 12 ? Art.pose("aimWalk", t * 0.8, this.aimAngle) : Art.pose("aim", this.aimAngle);
      }
      return Math.abs(this.vx) > 8 ? { ...Art.pose("walk", t), fArm: 1.0, fFore: 1.6, bArm: 0.7, bFore: 1.7 } : Art.pose("aim", 0);
    }

    draw(ctx, t) {
      if (this.dormant && !this.dead) return;
      if (this.dead && this.deadT >= 10) return;
      if (this.dead) ctx.globalAlpha = clamp(1.4 - this.deadT, 0, 1);
      Art.enemy(ctx, this, this.animT);
      ctx.globalAlpha = 1;
      if (this.flash > 0) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.65;
        const b = this.box;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.ellipse(this.x, b.y + b.h / 2, b.w * 0.75, b.h * 0.56, 0, 0, J.TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
      if (this.dead) return;
      if (this.state === "aim") {
        const x = this.x + this.facing * 28;
        const y = this.config.fly ? this.cy : this.y - 44 * this.config.scale;
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = this.config.ranged.color;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1, 3 + (0.34 - this.timer) * 12), 0, J.TAU);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }
      if (this.state === "windup") {
        ctx.fillStyle = "#ffd76a";
        ctx.font = `800 18px ${J.FONT}`;
        ctx.textAlign = "center";
        ctx.fillText("!", this.x, this.y - this.h - 8);
      }
      if (this.hp < this.maxHp && !this.config.fly) {
        const w = 34;
        const y = this.y - this.h - 16;
        ctx.fillStyle = "rgba(0,0,0,.6)";
        ctx.fillRect(this.x - w / 2, y, w, 4);
        ctx.fillStyle = "#ff6a50";
        ctx.fillRect(this.x - w / 2, y, w * (this.hp / this.maxHp), 4);
      }
    }
  }

  J.ENEMY_TYPES = TYPES;
  J.Enemy = Enemy;
})(window.JEDI);
