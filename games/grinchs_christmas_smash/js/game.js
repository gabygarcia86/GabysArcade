/*
 * The game itself: loads levels, runs the physics, turns bumps into damage and smashes,
 * handles the snowballs, aiming, explosions, bells and light strings, decides when a level
 * is over, keeps the run's totals, and draws everything.
 *
 * States: menu (title scene behind the menus), intro (level banner), play, paused,
 * result (level complete or failed screen) and over (game over screen).
 */
(function (G) {
  "use strict";

  const { World, Body } = G.Physics;
  const Art = G.Art;
  const STEP = 1 / 120;
  const MAX_STEPS = 6;
  const IMPACT_ALLOWANCE = 90; // speed changes below this (px/s) do no damage
  const LAUNCH_MIN = 380;
  const LAUNCH_RANGE = 1300;
  const MAX_PULL = 108; // how far the pouch stretches (world units)
  const FART_GREENS = ["rgba(160, 205, 70, 0.8)", "rgba(125, 175, 45, 0.75)", "rgba(195, 225, 100, 0.75)"];
  const SNEEZE_WHITES = ["rgba(255, 255, 255, 0.9)", "rgba(220, 240, 255, 0.85)", "rgba(200, 230, 250, 0.8)"];

  // ---------------------------------------------------------------- Snowball types

  G.SNOWBALLS = {
    normal: { name: "Snowball", r: 20, density: 0.004, restitution: 0.25, friction: 0.5, dmg: 1, desc: "Good old-fashioned snowball." },
    mega: { name: "Mega Snowball", r: 33, density: 0.0055, restitution: 0.12, friction: 0.6, dmg: 1.5, desc: "Huge and heavy. Bulldozes big structures." },
    bouncy: { name: "Bouncy Snowball", r: 20, density: 0.0035, restitution: 0.86, friction: 0.15, dmg: 0.9, desc: "Boings all over the place. Hits lots of things." },
    explosive: { name: "Explosive Snowball", r: 22, density: 0.0038, restitution: 0.2, friction: 0.5, dmg: 1, desc: "KABOOM on impact! Tap mid-flight to blow it early." },
    split: { name: "Split Snowball", r: 20, density: 0.004, restitution: 0.25, friction: 0.5, dmg: 1, desc: "Tap mid-flight to split it into three." },
    rainbow: { name: "Rainbow Snowball", r: 22, density: 0.0045, restitution: 0.4, friction: 0.4, dmg: 1.25, desc: "Every different thing it hits adds a growing bonus!" },
  };

  let shotGroup = 1000;

  class Projectile {
    constructor(type, body) {
      this.isProjectile = true;
      this.type = type;
      this.body = body;
      body.owner = this;
      this.age = 0;
      this.rest = 0;
      this.hits = new Set();
      this.dmg = G.SNOWBALLS[type].dmg;
      this.split = false;
      this.exploded = false;
      this.dead = false;
      this.px = body.x;
      this.py = body.y;
      this.spin = 0;
      this.trailT = 0;
      this.touched = false;
    }
  }

  // ---------------------------------------------------------------- Game

  class Game {
    constructor(canvas, storage, audio) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.storage = storage;
      this.audio = audio;
      this.ui = null;
      this.particles = new G.Particles();
      this.hud = new G.HUD();
      this.scoring = new G.Scoring();
      this.grinch = new G.Grinch();
      this.events = new G.Events(this);
      this.state = "menu";
      this.mode = "campaign";
      this.time = 0;
      this.acc = 0;
      this.timeScale = 1;
      this.slowT = 0;
      this.shakeAmt = 0;
      this.flashAmt = 0;
      this.safe = { l: 0, r: 0, t: 0, b: 0 };
      this.cam = { scale: 1, ox: 0, oy: 0 };
      this.run = null;
      this.level = null;
      this.levelIndex = 0;
      this.things = [];
      this.lights = [];
      this.statics = [];
      this.projectiles = [];
      this.ammo = [];
      this.selected = 0;
      this.aim = null;
      this.shot = "ready";
      this.target = 1;
      this.star2 = 2;
      this.star3 = 3;
      this.theme = "day";
      this.impacts = [];
      this.booms = [];
      this.menuQuipT = 0;
      this.hintShots = 0;
      this.scoring.onCombo = (text, n, mult) => this.onCombo(text, n, mult);
      this.scoring.onChainEnd = (n, bonus) => this.onChainEnd(n, bonus);
      this.world = new World({ gravity: G.GRAVITY });
      this.setupMenuScene();
    }

    // ---------------------------------------------------------------- Scenes

    newWorld() {
      this.world = new World({ gravity: G.GRAVITY, iterations: 10, posIterations: 4 });
      this.world.onImpact = (m) => {
        const p = m.points[0];
        this.impacts.push({ a: m.a, b: m.b, J: m.impulse, approach: m.approach, x: p ? p.x : m.a.x, y: p ? p.y : m.a.y });
      };
      this.world.onRopeBreak = (rope) => {
        const light = rope.owner;
        if (light && light.alive) this.snapLight(light, null, true);
      };
    }

    // The title screen shows a little decorated scene that the Grinch is eyeing up.
    setupMenuScene() {
      this.newWorld();
      const scene = G.buildScene(0);
      this.statics = scene.statics;
      this.things = scene.things;
      this.lights = scene.lights;
      this.projectiles = [];
      this.theme = ["day", "dusk", "night", "aurora"][Math.floor(Math.random() * 4)];
      this.grinch.reset();
      this.grinch.anim = "hold";
      this.grinch.rest = "hold";
      this.grinch.onSilly = (ev) => this.sillyEvent(ev);
      this.menuQuipT = 1.2;
      this.particles.clear();
      this.hud.reset();
    }

    showMenu() {
      this.state = "menu";
      this.setupMenuScene();
      this.audio.music("menu");
    }

    // ---------------------------------------------------------------- Title-screen Grinch

    // Is the CSS-pixel point (x, y) on the Grinch (or his snowball) on the title screen?
    grinchAt(x, y) {
      if (this.state !== "menu") return false;
      const w = this.screenToWorld(x, y);
      const g = this.grinch;
      return w.x > g.x - 90 && w.x < g.x + 160 && w.y > g.y - 340 && w.y < g.y + 12;
    }

    // Clicked on the title screen: he does something silly (and smelly).
    pokeGrinch() {
      const g = this.grinch;
      if (this.state !== "menu") return;
      // Let each bit get going before another click can cut it off.
      if (g.isSilly && g.at < 0.6) return;
      g.silly();
      this.menuQuipT = Math.max(this.menuQuipT, 5);
    }

    // A cloud of puffs blown out of part of the Grinch ("butt" or "nose").
    sillyCloud(part, power, colors, speed, gravity) {
      const at = Art.grinchPoint(this.grinch.look(null), this.time, part);
      const n = Math.round(3 + power * 7);
      for (let i = 0; i < n; i++) {
        const s = G.rand(speed * 0.25, speed) * power;
        this.particles.add({
          x: at.x + G.rand(-8, 8),
          y: at.y + G.rand(-8, 8),
          vx: at.dx * s + G.rand(-50, 50),
          vy: at.dy * s + G.rand(-90, 40),
          rot: 0,
          vr: 0,
          life: G.rand(1, 1.9),
          size: G.rand(12, 26) * (0.6 + power * 0.4),
          color: G.pick(colors),
          shape: "puff",
          g: gravity,
          drag: 2.4,
        });
      }
      return at;
    }

    sillyEvent(ev) {
      const g = this.grinch;
      if (ev.fart || ev.puff) {
        const power = ev.fart || ev.puff;
        const b = this.sillyCloud("butt", power, FART_GREENS, 240, -40);
        if (ev.fart) this.audio.play(ev.sound || "fart", ev.fart);
        if (ev.text) this.particles.text(b.x + b.dx * 40, b.y - 30, ev.text, { color: "#b8ef5a", size: ev.fart ? 26 + ev.fart * 8 : 24, life: 1.3 });
      } else if (ev.sneeze) {
        const n = this.sillyCloud("nose", ev.sneeze, SNEEZE_WHITES, 520, 120);
        this.particles.burst("snow", n.x + n.dx * 30, n.y, { power: 0.6, count: 8 });
        if (ev.text) this.particles.text(n.x + n.dx * 60, n.y - 40, ev.text, { color: "#ffffff", size: 44, life: 1.3 });
      } else if (ev.text) {
        this.particles.text(g.x + 40 + G.rand(-30, 30), g.y - 300, ev.text, { color: ev.color || "#b8ef5a", size: 30, life: 1.3 });
      }
      if (ev.sound && !ev.fart) this.audio.play(ev.sound, ev.power || 1);
      if (ev.say) g.say(Array.isArray(ev.say) ? G.pick(ev.say) : ev.say, ev.dur || 2);
      if (ev.snow) this.particles.burst("snow", g.x, g.y - 4, { power: 0.7, count: 10 });
      if (ev.shake) this.shake(ev.shake);
    }

    // ---------------------------------------------------------------- Runs

    startCampaign() {
      this.run = { score: 0, lives: 3, completed: 0, smashed: 0, chains: 0, bestCombo: 0, golden: 0, seconds: 0, reached: 1, pending: null };
      this.loadLevel(0, "campaign");
    }

    startPractice(index) {
      this.run = null;
      this.loadLevel(index, "practice");
    }

    loadLevel(index, mode = this.mode) {
      this.mode = mode;
      this.levelIndex = index;
      if (this.run) this.run.reached = Math.max(this.run.reached, index + 1);
      this.newWorld();
      const scene = G.buildScene(index);
      this.level = scene.level;
      this.statics = scene.statics;
      this.things = scene.things;
      this.lights = scene.lights;
      for (const b of scene.fixed) this.world.add(b);
      for (const t of this.things) this.world.add(t.body);
      for (const l of this.lights) if (l.rope) this.world.addRope(l.rope);
      // Hanging things start asleep and stay put until bumped.
      for (const l of this.lights) {
        if (l.rope) {
          if (l.a) l.a.body.sleep();
          if (l.b) l.b.body.sleep();
        }
      }
      this.theme = this.level.sky;
      this.projectiles = [];
      this.impacts = [];
      this.booms = [];
      this.particles.clear();
      this.hud.reset();

      let totalPoints = 0;
      for (const t of this.things) totalPoints += t.points + (t.def.bonus || 0);
      for (const l of this.lights) totalPoints += l.points;
      const totalCount = this.things.length + this.lights.length;
      const frac = this.level.goal || (index < 5 ? 0.45 : index < 12 ? 0.5 : 0.55);
      const r50 = (v) => Math.max(50, Math.round(v / 50) * 50);
      this.target = r50(totalPoints * frac);
      this.star2 = r50(totalPoints * 0.85);
      this.star3 = r50(totalPoints * 1.4);
      this.scoring.reset(totalPoints, totalCount);

      this.ammo = this.level.ammo.map((t) => (this.storage.isUnlocked(t) ? t : "normal"));
      this.selected = 0;
      this.aim = null;
      this.shot = "ready";
      this.shotT = 0;
      this.shotSmashes = 0;
      this.shotDamage = 0;
      this.sinceLast = 0;
      this.goalReached = false;
      this.levelEnding = false;
      this.endT = 0;
      this.finishRequested = false;
      this.levelTime = 0;
      this.timeScale = 1;
      this.slowT = 0;
      this.events.reset(index);
      this.grinch.reset();
      this.grinch.play("load", true);
      this.state = "intro";
      this.introT = 0;
      this.hud.banner(`LEVEL ${index + 1}`, this.level.name, "#ffd23f", 2.4);
      setTimeout(() => {
        if (this.state === "intro" || this.state === "play") this.grinch.quip("start", 1, 2.6);
      }, 700);
      this.audio.music("play");
      if (this.ui) {
        this.ui.showHud();
        this.ui.updateAmmo();
      }
    }

    restartLevel() {
      if (this.state === "menu" || this.state === "over") return;
      this.loadLevel(this.levelIndex, this.mode);
    }

    nextLevel() {
      this.commitPending();
      if (this.levelIndex + 1 >= G.LEVELS.length) {
        if (this.mode === "campaign") this.gameOver(true);
        else this.ui.showLevels();
        return;
      }
      this.loadLevel(this.levelIndex + 1, this.mode);
    }

    retryLevel() {
      if (this.run) this.run.pending = null;
      this.loadLevel(this.levelIndex, this.mode);
    }

    commitPending() {
      const r = this.run;
      if (!r || !r.pending) return;
      r.score += r.pending.score;
      r.completed += 1;
      this.addRunStats(r.pending);
      r.pending = null;
    }

    addRunStats(st) {
      const r = this.run;
      r.smashed += st.smashed;
      r.chains += st.chains;
      r.bestCombo = Math.max(r.bestCombo, st.combo);
    }

    endRun() {
      this.commitPending();
      this.gameOver(false);
    }

    gameOver(victory) {
      const r = this.run;
      this.state = "over";
      this.aim = null;
      const score = r ? r.score : 0;
      const newBest = this.storage.recordGame(score);
      this.audio.music("menu");
      const result = {
        victory,
        score,
        completed: r ? r.completed : 0,
        reached: r ? Math.min(20, r.reached) : 1,
        smashed: r ? r.smashed : 0,
        chains: r ? r.chains : 0,
        bestCombo: r ? r.bestCombo : 0,
        seconds: r ? r.seconds : 0,
        best: this.storage.data.bestScore,
        newBest,
      };
      if (this.ui) this.ui.showGameOver(result);
    }

    quitToMenu() {
      this.run = null;
      this.showMenu();
    }

    pause() {
      if (this.state !== "play" && this.state !== "intro") return;
      this.pausedFrom = this.state;
      this.state = "paused";
      this.aim = null;
      if (this.grinch.anim === "aim") this.grinch.play("idle", true);
      if (this.ui) this.ui.showPause();
    }

    resume() {
      if (this.state !== "paused") return;
      this.state = this.pausedFrom || "play";
      if (this.ui) this.ui.showHud();
    }

    // ---------------------------------------------------------------- Things

    spawnThing(key, x, y, opts = {}) {
      const t = G.Objects.create(key, x, 0, { ...opts, y });
      this.things.push(t);
      this.world.add(t.body);
      if (!t.bonus) this.scoring.totalCount += 1;
      return t;
    }

    // Some damage to a thing. `proj` is the snowball that did it, if any.
    damageThing(t, dmg, dv, proj) {
      if (!t.alive) return;
      const d = t.def;
      if (d.special === "explode" && (proj || dv > 240 || dmg > 60)) {
        this.destroy(t, "boom");
        return;
      }
      if (d.special === "ring" && dv > 70) this.ring(t);
      if (dmg <= 0) return;
      t.hp -= dmg;
      t.flash = Math.min(1, t.flash + dmg / 260);
      t.shake = Math.min(1, t.shake + dmg / 500);
      this.shotDamage += dmg;
      if ((d.face || d.kind === "snowman") && dmg > 60) {
        t.mood = "dizzy";
        t.moodT = 1.4;
      }
      if (t.hp <= 0) this.destroy(t, proj ? "hit" : "crash");
    }

    destroy(t, cause) {
      if (!t.alive) return;
      t.alive = false;
      const b = t.body;
      const d = t.def;
      const x = b.x;
      const y = b.y;
      this.world.remove(b);
      const pts = this.scoring.smash(t.points, !t.bonus);
      this.shotSmashes++;
      const mult = this.scoring.multiplier;
      const col = mult >= 5 ? "#ff7ad9" : mult >= 3 ? "#ff9f1c" : mult >= 2 ? "#ffd23f" : "#ffffff";
      this.particles.text(x, y - 20, mult > 1 ? `+${G.fmt(pts)} x${mult}` : `+${G.fmt(pts)}`, { color: col, size: 26 + Math.min(16, pts / 60) });
      if (cause === "off") this.particles.text(G.clamp(x, 80, G.WORLD_W - 80), G.clamp(y, 200, G.GROUND_Y - 60), "KNOCKED OFF!", { color: "#9fe6ff", size: 22, life: 1.2 });
      // Burst and sound by material.
      const mat = G.MATERIALS[d.mat];
      const power = G.clamp(b.bound / 30, 0.6, 2.2);
      this.particles.burst(mat.burst, x, y, { color: t.color, power, count: 12 });
      if (d.kind === "snowman") this.particles.burst("snow", x, y, { power: power * 1.2, count: 18 });
      const sound = {
        glass: "smashGlass",
        present: "smashPaper",
        gold: "smashPaper",
        wood: "smashWood",
        ice: "smashIce",
        snow: "smashSnow",
        ginger: "smashCrunch",
        candy: "smashCandy",
        metal: "smashBell",
        cloth: "smashCloth",
        tree: "smashWood",
      }[d.mat];
      this.audio.play(sound || "smashPaper");
      this.shake(Math.min(10, 2 + b.bound / 12));
      // Light strings tied to it come down too.
      for (const l of this.lights) {
        if (l.alive && (l.a === t || l.b === t)) {
          if (l.tangle) l.alive = false;
          else this.snapLight(l, null, true);
        }
      }
      // Specials.
      if (d.golden) {
        this.scoring.golden += 1;
        const unlocked = this.storage.data.unlocked.filter((k) => k !== "normal");
        const type = unlocked.length ? G.pick(unlocked) : "normal";
        this.ammo.push(type);
        if (this.ui) this.ui.updateAmmo();
        this.particles.text(x, y - 70, "BONUS SNOWBALL!", { color: "#ffd23f", size: 30, life: 1.6 });
        this.audio.play("bonus");
        this.grinch.play("celebrate");
        this.grinch.quip("golden", 0.9);
      }
      if (d.kind === "tree") {
        this.audio.play("timber");
        this.particles.text(x, y - 90, d.mega ? "MEGA TIMBER!" : "TIMBER!", { color: "#7dff9a", size: d.mega ? 54 : 40, life: 1.6 });
        this.grinch.play("dance");
        this.grinch.quip("tree", 0.8);
        this.shake(d.mega ? 22 : 12);
        if (d.mega) this.slowMo(1.1);
      }
      if (d.bonus) {
        this.scoring.add(d.bonus);
        this.hud.banner("MEGA TREE BONUS!", `+${G.fmt(d.bonus)} points`, "#7dff9a", 2.4);
        this.audio.play("bonus");
      }
      if (d.kind === "snowman" && Math.random() < 0.3) this.grinch.quip("snowman", 1, 1.6);
      if (d.special === "split") {
        // The giant gingerbread man crumbles into smaller pieces.
        for (let i = 0; i < 4; i++) {
          const piece = this.spawnThing("gingerBit", x + (i - 1.5) * 22, y - 20 - (i % 2) * 24, { bonus: true, awake: true });
          piece.body.vx = (i - 1.5) * 120 + b.vx * 0.5;
          piece.body.vy = -220 - Math.random() * 160;
          piece.body.w = (Math.random() - 0.5) * 12;
          piece.color = G.pick(["#e0303a", "#2fbf71", "#2f7de1"]);
        }
        this.particles.text(x, y - 60, "CRUMBLE!", { color: "#ffcf8a", size: 28 });
      }
      if (d.special === "explode") this.booms.push({ x, y, t: 0.05, radius: 250, power: 820 });
      if (d.special === "ring") this.ring(t, true);
    }

    // The golden bell rings out and makes light things nearby jump.
    ring(t, final = false) {
      if (!final && t.ringCD > 0) return;
      t.ringCD = 0.9;
      t.ringGlow = 1;
      const x = t.body.x;
      const y = t.body.y;
      this.audio.play("ring");
      this.particles.ring(x, y, 20, 320, "rgba(255, 220, 90, 0.9)", 0.7, 12);
      this.particles.ring(x, y, 10, 220, "rgba(255, 255, 255, 0.7)", 0.5, 6);
      this.particles.text(x, y - 90, "DING DONG!", { color: "#ffd23f", size: 34 });
      for (const o of this.things) {
        if (!o.alive || o === t) continue;
        const b = o.body;
        const d = Math.hypot(b.x - x, b.y - y);
        if (d > 320 || b.mass > 6) continue;
        const k = 1 - d / 320;
        b.wake();
        b.vy -= 300 + 360 * k;
        b.vx += (b.x - x) * 1.4 * k + (Math.random() - 0.5) * 120;
        b.w += (Math.random() - 0.5) * 10;
        if (o.def.mat === "glass") this.damageThing(o, 140 * k, 0, null);
      }
      this.grinch.quip("bell", 0.4, 1.6);
    }

    // An explosion of snow that throws things around and damages them.
    boom(x, y, radius, power) {
      const hits = this.world.explode(x, y, radius, power);
      this.particles.burst("boom", x, y, { power: radius / 240 });
      this.particles.burst("snow", x, y, { power: 1.6, count: 20 });
      this.audio.play("boom");
      this.shake(18);
      this.flashAmt = Math.max(this.flashAmt, 0.35);
      for (const h of hits) {
        const o = h.body.owner;
        if (o && !o.isProjectile && o.alive) this.damageThing(o, h.dv * 0.85, h.dv, null);
      }
      for (const l of this.lights) {
        if (!l.alive || l.tangle) continue;
        const pts = l.path(6);
        if (pts.some((p) => Math.hypot(p.x - x, p.y - y) < radius * 0.8)) this.snapLight(l, { x, y }, false);
      }
      this.grinch.play("surprised");
      this.grinch.quip("boom", 0.45, 1.6);
    }

    // A light string snaps (worth points) and tangles up the decorations around it.
    snapLight(l, at, quiet) {
      if (!l.alive) return;
      l.alive = false;
      if (l.tangle) {
        // Tangles just fizzle out: they're not decorations, so they score nothing.
        const p = l.path(2)[1];
        this.particles.burst("sparks", p.x, p.y, { count: 6 });
        return;
      }
      if (l.rope) {
        l.rope.broken = true;
        this.world.ropes = this.world.ropes.filter((r) => r !== l.rope);
        if (l.rope.a) l.rope.a.wake();
        if (l.rope.b) l.rope.b.wake();
      }
      const pts = l.path(6);
      const mid = at || pts[3];
      const got = this.scoring.smash(l.points, !l.bonus);
      this.shotSmashes++;
      this.particles.burst("sparks", mid.x, mid.y, { count: 16 });
      this.particles.text(mid.x, mid.y - 30, `+${G.fmt(got)}`, { color: "#ffd23f", size: 26 });
      this.audio.play("snap");
      if (quiet || !at) return;
      // Tangle: tie nearby decorations together with short strings that pull them in.
      const near = this.things.filter((t) => t.alive && !t.body.isStatic && t.body.mass < 25 && Math.hypot(t.body.x - mid.x, t.body.y - mid.y) < 280);
      G.shuffle(near);
      let made = 0;
      for (let i = 0; i + 1 < near.length && made < 3; i += 2) {
        const A = near[i];
        const B = near[i + 1];
        const d = Math.hypot(A.body.x - B.body.x, A.body.y - B.body.y);
        if (d < 30) continue;
        const L = new G.LightString({ a: A, b: B, la: { x: 0, y: 0 }, lb: { x: 0, y: 0 }, tangle: true, points: 0 });
        L.len = d;
        L.rope = new G.Physics.Rope({ a: A.body, b: B.body, len: d * 0.9, breakImpulse: 220, pull: 220, minLen: Math.max(30, d * 0.35), owner: L });
        this.world.addRope(L.rope);
        this.lights.push(L);
        made++;
      }
      if (made) {
        this.particles.text(mid.x, mid.y - 70, "TANGLED!", { color: "#7dff9a", size: 32 });
        this.audio.play("swing");
      }
    }

    // ---------------------------------------------------------------- Combos

    onCombo(text, n, mult) {
      const colors = ["#ffffff", "#ffd23f", "#7dff9a", "#ff9f1c", "#ff7ad9", "#5fd0ff", "#ffd23f"];
      const i = [3, 5, 8, 10, 15, 20, 30].indexOf(n);
      this.hud.banner(text, mult > 1 ? `${n} in a row! x${mult} points` : `${n} in a row!`, colors[Math.max(0, i)], 1.4);
      this.audio.play("combo", n / 5);
      if (n >= 15) {
        this.grinch.play("fallback");
        this.grinch.quip("fallback", 1);
        this.audio.play("laugh");
      } else if (n >= 10) {
        this.grinch.play("laugh");
        this.grinch.quip("laugh", 0.9);
        this.audio.play("laugh");
        this.slowMo(0.8);
      } else if (n >= 5) {
        this.audio.play("heh");
        this.grinch.play("celebrate");
      }
    }

    onChainEnd(n, bonus) {
      const last = this.lastProjectilePos || { x: 1300, y: 600 };
      this.particles.text(G.clamp(last.x, 600, 1700), G.clamp(last.y - 80, 220, 800), `CHAIN BONUS +${G.fmt(bonus)}`, { color: "#7dff9a", size: 32, life: 1.6 });
    }

    slowMo(dur) {
      this.slowT = Math.max(this.slowT, dur);
    }

    shake(amount) {
      this.shakeAmt = Math.max(this.shakeAmt, amount);
    }

    banner(title, sub, color, dur) {
      this.hud.banner(title, sub, color, dur || 2.2);
    }

    // ---------------------------------------------------------------- Shooting

    get pouchRest() {
      return { x: G.LAUNCH.x, y: G.LAUNCH.y + 12 };
    }

    // The pull as the player drags: direction, power (0..1), and where the pouch sits.
    aimInfo() {
      const rest = this.pouchRest;
      if (!this.aim) return { power: 0, dir: { x: 1, y: 0 }, pouch: rest };
      const k = this.cssToWorld;
      let dx = (this.aim.cx - this.aim.sx) * k;
      let dy = (this.aim.cy - this.aim.sy) * k;
      const len = Math.hypot(dx, dy);
      const maxDrag = G.clamp(230 * k, 170, 520);
      const power = G.clamp(len / maxDrag, 0, 1);
      if (len < 1) {
        dx = -1;
        dy = 0;
      }
      const nx = dx / (len || 1);
      const ny = dy / (len || 1);
      return {
        power,
        dir: { x: -nx, y: -ny },
        pouch: { x: rest.x + nx * MAX_PULL * power, y: rest.y + ny * MAX_PULL * power },
      };
    }

    canAim() {
      return (this.state === "play" || (this.state === "intro" && this.introT > 0.4)) && this.shot === "ready" && this.ammo.length > 0 && !this.levelEnding;
    }

    // Pointer handlers (CSS pixel coordinates relative to the canvas).
    pointerDown(id, x, y) {
      if (this.state === "intro" && this.introT > 0.4) this.state = "play";
      if (this.state !== "play") return;
      if (this.shot === "flying") {
        this.triggerSpecial();
        return;
      }
      if (!this.canAim() || this.aim) return;
      this.aim = { id, sx: x, sy: y, cx: x, cy: y, lastPow: 0 };
      this.grinch.play("aim", true);
      this.audio.play("stretch", 0.2);
    }

    pointerMove(id, x, y) {
      if (!this.aim || this.aim.id !== id) return;
      this.aim.cx = x;
      this.aim.cy = y;
      const info = this.aimInfo();
      this.grinch.power = info.power;
      const step = Math.floor(info.power * 5);
      if (step > this.aim.lastPow) this.audio.play("stretch", info.power);
      this.aim.lastPow = step;
    }

    pointerUp(id) {
      if (!this.aim || this.aim.id !== id) return;
      const info = this.aimInfo();
      this.aim = null;
      this.grinch.power = 0;
      if (info.power < 0.08 || this.state !== "play") {
        this.grinch.play("idle", true);
        return;
      }
      this.launch(info);
    }

    cancelAim() {
      if (!this.aim) return;
      this.aim = null;
      this.grinch.play("idle", true);
    }

    selectAmmo(i) {
      if (i < 0 || i >= this.ammo.length || this.aim) return;
      this.selected = i;
      this.audio.play("click");
      if (this.ui) this.ui.updateAmmo();
    }

    launch(info) {
      const type = this.ammo[this.selected] || "normal";
      this.ammo.splice(this.selected, 1);
      this.selected = Math.min(this.selected, Math.max(0, this.ammo.length - 1));
      const speed = LAUNCH_MIN + info.power * LAUNCH_RANGE;
      const frenzy = this.events.useFrenzy();
      const p = this.makeProjectile(type, info.pouch.x, info.pouch.y, info.dir.x * speed, info.dir.y * speed, ++shotGroup, frenzy);
      this.projectiles.push(p);
      this.shot = "flying";
      this.shotT = 0;
      this.shotSmashes = 0;
      this.shotDamage = 0;
      this.sinceLast = 0;
      this.hintShots++;
      this.grinch.play("throw", true);
      this.grinch.quip("launch", 0.3, 1.4);
      this.audio.play("launch", info.power + 0.3);
      if (type === "rainbow") this.audio.play("rainbow");
      this.particles.burst("snow", info.pouch.x, info.pouch.y, { count: 6, power: 0.6 });
      if (this.ui) this.ui.updateAmmo();
    }

    makeProjectile(type, x, y, vx, vy, group, frenzy, radiusScale = 1) {
      const s = G.SNOWBALLS[type];
      const body = new Body({
        x,
        y,
        radius: s.r * radiusScale,
        density: s.density,
        restitution: frenzy ? 0.9 : s.restitution,
        friction: frenzy ? 0.15 : s.friction,
        vx,
        vy,
        group,
        angularDamping: 0.4,
        linearDamping: 0.01,
      });
      body.noSleep = true;
      body.ignoreCalm = true;
      this.world.add(body);
      const p = new Projectile(type, body);
      p.frenzy = frenzy;
      return p;
    }

    // Tapping while a snowball flies: split snowballs split, explosive ones go off.
    triggerSpecial() {
      for (const p of this.projectiles) {
        if (p.dead || p.age < 0.08) continue;
        if (p.type === "split" && !p.split) {
          this.splitProjectile(p);
          return;
        }
        if (p.type === "explosive" && !p.exploded) {
          this.explodeProjectile(p);
          return;
        }
      }
    }

    splitProjectile(p) {
      p.split = true;
      const b = p.body;
      const speed = Math.hypot(b.vx, b.vy);
      const ang = Math.atan2(b.vy, b.vx);
      for (const da of [-0.2, 0, 0.2]) {
        const q = this.makeProjectile("split", b.x, b.y, Math.cos(ang + da) * speed, Math.sin(ang + da) * speed, b.group, p.frenzy, 0.72);
        q.split = true;
        q.dmg = 0.85;
        this.projectiles.push(q);
      }
      this.removeProjectile(p, false);
      this.particles.burst("snow", b.x, b.y, { count: 10, power: 0.8 });
      this.particles.text(b.x, b.y - 40, "SPLIT!", { color: "#9fe6ff", size: 26 });
      this.audio.play("split");
    }

    explodeProjectile(p) {
      if (p.exploded) return;
      p.exploded = true;
      const b = p.body;
      this.removeProjectile(p, false);
      this.booms.push({ x: b.x, y: b.y, t: 0, radius: 260, power: 860 });
      this.particles.text(b.x, b.y - 60, "KABOOM!", { color: "#ff7a3a", size: 44 });
    }

    removeProjectile(p, poof = true) {
      if (p.dead) return;
      p.dead = true;
      this.world.remove(p.body);
      if (poof) {
        this.particles.burst("snow", p.body.x, p.body.y, { count: 8, power: 0.6 });
        this.audio.play("poof");
      }
    }

    // ---------------------------------------------------------------- Update

    update(dt) {
      this.time += dt;
      if (this.state === "menu") {
        this.updateMenu(dt);
        return;
      }
      if (this.state === "paused" || this.state === "over") {
        this.particles.update(dt * 0.5);
        return;
      }
      // Slow motion for the biggest moments.
      if (this.slowT > 0) {
        this.slowT -= dt;
        this.timeScale = G.damp(this.timeScale, 0.35, 10, dt);
      } else {
        this.timeScale = G.damp(this.timeScale, 1, 6, dt);
      }
      const sdt = dt * this.timeScale;
      if (this.state === "intro") {
        this.introT += dt;
        if (this.introT > 1.4) this.state = "play";
      }
      if ((this.state === "play" || this.state === "intro") && this.run) this.run.seconds += dt;
      this.levelTime += dt;

      // Physics at a fixed rate.
      this.acc += sdt;
      let steps = 0;
      while (this.acc >= STEP && steps < MAX_STEPS) {
        this.physicsStep();
        this.acc -= STEP;
        steps++;
      }
      if (steps === MAX_STEPS) this.acc = 0;

      this.updateThings(sdt);
      this.scoring.update(sdt);
      this.events.update(sdt);
      this.grinch.update(dt, !!this.aim);
      this.particles.update(sdt);
      this.hud.update(dt, this.scoring.score);
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 40);
      this.flashAmt = Math.max(0, this.flashAmt - dt * 1.5);
      // Pending explosions (chained ones go off one after another).
      for (const bm of this.booms) bm.t -= sdt;
      const ready = this.booms.filter((b) => b.t <= 0);
      if (ready.length) {
        this.booms = this.booms.filter((b) => b.t > 0);
        for (const bm of ready) this.boom(bm.x, bm.y, bm.radius, bm.power);
      }
      if (!this.goalReached && this.scoring.score >= this.target && this.state !== "result") {
        this.goalReached = true;
        this.hud.banner("GOAL REACHED!", "Keep smashing for stars, or tap FINISH", "#7dff9a", 2.6);
        this.audio.play("bonus");
        this.grinch.quip("goal", 0.6);
        if (this.ui) this.ui.updateAmmo();
      }
      this.updateShot(sdt);
      if (this.state === "play" || this.state === "intro") this.checkEnd(dt);
    }

    updateMenu(dt) {
      this.grinch.update(dt, false);
      this.particles.update(dt);
      this.hud.update(dt, 0);
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 40);
      if (this.grinch.isSilly) this.menuQuipT = Math.max(this.menuQuipT, 2.5);
      this.menuQuipT -= dt;
      if (this.menuQuipT <= 0) {
        this.menuQuipT = 4.6;
        this.grinch.quip("title", 1, 3.6);
        if (Math.random() < 0.3) this.audio.play("heh");
      }
      for (const t of this.things) {
        t.flash = Math.max(0, t.flash - dt * 3);
      }
    }

    physicsStep() {
      // Remember where each snowball was, to catch light strings it passes through.
      for (const p of this.projectiles) {
        p.px = p.body.x;
        p.py = p.body.y;
      }
      this.world.step(STEP);
      const impacts = this.impacts;
      this.impacts = [];
      for (const im of impacts) this.handleImpact(im);
      for (const p of this.projectiles) if (!p.dead) this.updateProjectile(p);
      this.projectiles = this.projectiles.filter((p) => !p.dead);
    }

    handleImpact(im) {
      const sides = [
        [im.a, im.b],
        [im.b, im.a],
      ];
      let loudest = 0;
      let loudMat = null;
      for (const [body, other] of sides) {
        const own = body.owner;
        const oth = other.owner;
        if (own && own.isProjectile) {
          this.projectileHit(own, other, im);
          continue;
        }
        if (!own || !own.alive || body.isStatic) continue;
        const dv = im.J * body.im;
        const proj = oth && oth.isProjectile ? oth : null;
        let mult = G.MATERIALS[own.def.mat] === G.MATERIALS.glass ? 1.3 : 1;
        if (proj) {
          mult *= proj.dmg * 1.4;
          own.hitBySnowball = true;
          if (proj.type === "rainbow" && !proj.hits.has(own)) {
            proj.hits.add(own);
            const n = proj.hits.size;
            if (n >= 2) {
              const bonus = 150 * (n - 1);
              this.scoring.add(bonus);
              this.particles.text(im.x, im.y - 50, `RAINBOW x${n}! +${bonus}`, { color: G.pick(["#ff4b5c", "#ffd23f", "#4be37a", "#3fb7ff", "#ff7ad9"]), size: 28 });
              this.particles.burst("rainbow", im.x, im.y, { count: 10 });
              this.audio.play("rainbow");
            }
          }
        }
        this.damageThing(own, Math.max(0, dv - IMPACT_ALLOWANCE) * mult, dv, proj);
        if (dv > loudest) {
          loudest = dv;
          loudMat = own.def.mat;
        }
      }
      if (loudMat && loudest > 110) this.audio.play(G.MATERIALS[loudMat].sound, loudest / 500);
    }

    projectileHit(p, other, im) {
      if (p.dead) return;
      const oth = other.owner;
      if (oth && oth.isProjectile) return;
      if (p.type === "explosive" && !p.exploded && p.age > 0.04) {
        this.explodeProjectile(p);
        return;
      }
      p.touched = true;
      if (im.approach > 200) {
        this.particles.burst("snow", im.x, im.y, { count: 6, power: G.clamp(im.approach / 900, 0.4, 1.2) });
        this.audio.play(p.type === "bouncy" || p.frenzy ? "candy" : "snow", im.approach / 700);
      }
      this.lastProjectilePos = { x: p.body.x, y: p.body.y };
    }

    updateProjectile(p) {
      const b = p.body;
      p.age += STEP;
      p.spin += b.w * STEP;
      // Light strings the snowball passed through snap.
      for (const l of this.lights) {
        if (!l.alive || l.tangle) continue;
        const pts = l.path(8);
        for (let i = 0; i < pts.length - 1; i++) {
          const d = G.segSegDist(p.px, p.py, b.x, b.y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
          if (d < b.r + 5) {
            this.snapLight(l, { x: b.x, y: b.y }, false);
            break;
          }
        }
      }
      // Split snowballs split by themselves at the top of their arc.
      if (p.type === "split" && !p.split && p.age > 0.3 && b.vy > 0) this.splitProjectile(p);
      if (p.dead) return;
      // Trails.
      p.trailT -= STEP;
      if (p.trailT <= 0 && Math.hypot(b.vx, b.vy) > 300) {
        p.trailT = 0.03;
        const col = p.type === "rainbow" ? G.pick(["#ff4b5c", "#ffd23f", "#4be37a", "#3fb7ff", "#9b4dff"]) : p.frenzy ? "#ffb8ea" : "rgba(255,255,255,0.85)";
        this.particles.trail(b.x, b.y, col, b.r * 0.45);
      }
      // Nervous faces watch it fly by.
      // Resting or old snowballs melt away with a poof.
      if (b.speed < 35) p.rest += STEP;
      else p.rest = 0;
      const maxAge = p.type === "bouncy" || p.frenzy ? 10 : 8;
      if (p.rest > 0.9 || p.age > maxAge) this.removeProjectile(p, true);
      else if (b.x < -250 || b.x > G.WORLD_W + 250 || b.y > G.GROUND_Y + 300 || b.y < -2500) this.removeProjectile(p, false);
      if (!p.dead) this.lastProjectilePos = { x: b.x, y: b.y };
    }

    updateThings(dt) {
      const fly = this.projectiles.find((p) => !p.dead);
      for (const t of this.things) {
        if (!t.alive) continue;
        const b = t.body;
        t.flash = Math.max(0, t.flash - dt * 3);
        t.shake = Math.max(0, t.shake - dt * 3);
        t.ringCD = Math.max(0, t.ringCD - dt);
        t.ringGlow = Math.max(0, (t.ringGlow || 0) - dt * 1.5);
        // Moods for things with faces.
        if (t.def.face || t.def.kind === "snowman") {
          t.moodT = Math.max(0, t.moodT - dt);
          if (t.moodT <= 0) {
            if (!b.sleeping && b.speed > 180) t.mood = "dizzy";
            else if (fly && Math.hypot(fly.body.x - b.x, fly.body.y - b.y) < 520) {
              t.mood = "worried";
              t.look = { x: Math.sign(fly.body.x - b.x) * 0.9, y: G.clamp((fly.body.y - b.y) / 300, -1, 1) };
            } else {
              t.mood = "calm";
              t.look = null;
            }
          }
        }
        // Knocked over counts as smashed for snowmen, trees and gingerbread men.
        if (t.def.topple) {
          const a = Math.abs(Math.atan2(Math.sin(b.a), Math.cos(b.a)));
          if (a > t.def.topple) {
            t.toppleT += dt;
            if (t.toppleT > 0.3) this.destroy(t, "topple");
          } else {
            t.toppleT = 0;
          }
        }
        // Off the edge of the world.
        if (t.alive && (b.y > G.GROUND_Y + 260 || b.x < -160 || b.x > G.WORLD_W + 160)) this.destroy(t, "off");
      }
      // Tidy up dead things and broken strings every so often.
      if (this.things.length > 0 && this.things.some((t) => !t.alive) && Math.random() < 0.05) {
        this.things = this.things.filter((t) => t.alive);
      }
      for (const l of this.lights) if (l.alive && l.rope && l.rope.broken) l.alive = false;
    }

    // Moves the shot along: waiting for the snowball to finish, then reloading.
    updateShot(dt) {
      if (this.shot !== "flying") return;
      this.shotT += dt;
      const flying = this.projectiles.filter((p) => !p.dead);
      const slow = flying.every((p) => p.body.speed < 120);
      const done = flying.length === 0 || (this.shotT > 3 && slow) || this.shotT > 6;
      if (!done) return;
      // How did that go?
      if (this.shotSmashes === 0 && this.shotDamage < 40 && !this.scoring.chainActive) {
        this.grinch.play("frustrated");
        this.grinch.quip("miss", 0.85);
        this.audio.play("grr");
      }
      if (this.ammo.length > 0) {
        this.shot = "ready";
        this.selected = Math.min(this.selected, this.ammo.length - 1);
        this.grinch.play("load");
        this.events.onShotReady();
      } else {
        this.shot = "empty";
      }
      if (this.ui) this.ui.updateAmmo();
    }

    countLeft() {
      let n = 0;
      for (const t of this.things) if (t.alive && !t.bonus) n++;
      for (const l of this.lights) if (l.alive && !l.tangle && !l.bonus) n++;
      return n;
    }

    requestFinish() {
      if (!this.goalReached || this.levelEnding || this.state !== "play") return;
      this.levelEnding = true;
      this.endT = 0.5;
      this.cancelAim();
    }

    checkEnd(dt) {
      if (this.levelEnding) {
        this.endT -= dt;
        if (this.endT <= 0 && !this.scoring.chainActive && this.booms.length === 0) this.finishLevel();
        else if (this.endT < -4) this.finishLevel();
        return;
      }
      if (this.countLeft() === 0) {
        this.levelEnding = true;
        this.endT = 1.6;
        this.hud.banner("TOTAL DESTRUCTION!", "Every last decoration smashed!", "#ff7ad9", 2.4);
        this.audio.play("bonus");
        this.grinch.play("dance", true);
        this.cancelAim();
        return;
      }
      if (this.ammo.length === 0 && this.shot !== "aiming" && !this.aim) {
        const alive = this.projectiles.some((p) => !p.dead);
        if (alive) return;
        this.sinceLast += dt;
        const calm = this.world.isCalm(30);
        if (!this.scoring.chainActive && this.booms.length === 0 && ((calm && this.sinceLast > 1.0) || this.sinceLast > 7)) {
          this.levelEnding = true;
          this.endT = 0.3;
        }
      }
    }

    finishLevel() {
      if (this.state === "result") return;
      if (this.scoring.chainActive) this.scoring.endChain();
      const s = this.scoring;
      const bonuses = [];
      const unused = this.ammo.length;
      const success0 = s.score >= this.target;
      if (unused > 0 && success0) bonuses.push(["Unused snowballs", unused * 750, `${unused} x 750`]);
      const clean = this.countLeft() === 0;
      if (clean) bonuses.push(["Total destruction", 2000, "every decoration smashed"]);
      for (const [, pts] of bonuses) s.add(pts);
      const score = s.score;
      const success = score >= this.target;
      const stars = success ? (score >= this.star3 ? 3 : score >= this.star2 ? 2 : 1) : 0;
      this.state = "result";
      this.aim = null;
      const result = {
        level: this.levelIndex + 1,
        name: this.level.name,
        score,
        success,
        stars,
        smashed: s.smashed,
        counted: s.counted,
        total: s.totalCount,
        percent: s.percent,
        bestCombo: s.bestChain,
        chains: s.chains,
        unused,
        bonuses,
        target: this.target,
        mode: this.mode,
        unlocked: [],
        last: this.levelIndex + 1 >= G.LEVELS.length,
      };
      this.storage.addStats(s.smashed, s.chains, s.bestChain, s.golden);
      // A failed attempt's smashes count towards the run straight away; a completed
      // level's count once the player moves on (a retry replaces it).
      const stats = { smashed: s.smashed, chains: s.chains, combo: s.bestChain };
      if (success) {
        const prev = this.storage.data.levels[this.levelIndex + 1];
        result.newBest = !prev || score > prev.score;
        result.unlocked = this.storage.recordLevel(this.levelIndex + 1, score, stars);
        if (this.run) {
          this.run.pending = { score, ...stats };
          result.runTotal = this.run.score + score;
        }
        this.audio.play("complete");
        this.grinch.play("celebrate", true);
        this.grinch.quip("win", 1, 3);
        if (result.unlocked.length) setTimeout(() => this.audio.play("unlock"), 900);
        if (this.ui) this.ui.showLevelComplete(result);
      } else {
        this.audio.play("fail");
        this.audio.play("hmph");
        this.grinch.play("disappointed", true);
        this.grinch.quip("fail", 1, 3);
        if (this.run) {
          this.addRunStats(stats);
          this.run.lives -= 1;
          result.lives = this.run.lives;
          result.runTotal = this.run.score;
          if (this.run.lives <= 0) {
            setTimeout(() => {
              if (this.state === "result") this.gameOver(false);
            }, 1800);
            if (this.ui) this.ui.showLevelFailed(result, true);
            return;
          }
        }
        if (this.ui) this.ui.showLevelFailed(result, false);
      }
    }

    // ---------------------------------------------------------------- Camera

    // The whole 1920 x 1080 stage always fits, centred; extra room shows more sky and snow.
    resize(cssW, cssH, dpr, safe) {
      const w = Math.max(1, Math.round(cssW * dpr));
      const h = Math.max(1, Math.round(cssH * dpr));
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }
      this.dpr = dpr;
      this.cssW = cssW;
      this.cssH = cssH;
      this.safe = safe;
      // Leave room at the top for the HUD on short screens.
      const topPad = Math.min(60, cssH * 0.06) * dpr;
      const scale = Math.min(w / G.WORLD_W, (h - topPad * 0.5) / G.WORLD_H);
      this.cam.scale = scale;
      this.cam.ox = (w - G.WORLD_W * scale) / 2;
      this.cam.oy = Math.max(topPad * 0.5, (h - G.WORLD_H * scale) / 2 + topPad * 0.25);
      this.cssToWorld = dpr / scale;
      // On small screens the stage is drawn small, so its text is enlarged to stay readable.
      this.textScale = G.clamp(0.62 / (scale / dpr), 1, 2.2);
      Art.setSpriteScale(scale);
    }

    screenToWorld(x, y) {
      return { x: (x * this.dpr - this.cam.ox) / this.cam.scale, y: (y * this.dpr - this.cam.oy) / this.cam.scale };
    }

    // ---------------------------------------------------------------- Render

    render() {
      const ctx = this.ctx;
      const W = this.canvas.width;
      const H = this.canvas.height;
      const { scale, ox, oy } = this.cam;
      let sx = 0;
      let sy = 0;
      if (this.shakeAmt > 0) {
        sx = (Math.random() - 0.5) * this.shakeAmt * 2 * scale;
        sy = (Math.random() - 0.5) * this.shakeAmt * 2 * scale;
      }
      ctx.setTransform(scale, 0, 0, scale, ox + sx, oy + sy);
      const view = { x: (-ox - 40) / scale, y: (-oy - 40) / scale, w: (W + 80) / scale, h: (H + 80) / scale };
      const time = this.time;
      Art.drawSky(ctx, this.theme, view, time);
      Art.drawBackdrop(ctx, this.theme);
      Art.drawGround(ctx, view, this.theme);
      for (const s of this.statics) if (s.kind === "pillar") Art.drawStatic(ctx, s, time);
      for (const s of this.statics) if (s.kind !== "pillar") Art.drawStatic(ctx, s, time);
      Art.drawHill(ctx, time);

      // Launcher, the loaded snowball and the Grinch.
      const info = this.aimInfo();
      const pouch = info.pouch;
      Art.drawLauncherBack(ctx, pouch);
      const loaded = this.state !== "menu" && (this.shot === "ready" || this.aim) && this.ammo.length > 0 && !(this.grinch.anim === "load" && this.grinch.at < 0.35);
      if (loaded) {
        const type = this.ammo[this.selected] || "normal";
        const r = G.SNOWBALLS[type].r;
        Art.drawSnowball(ctx, pouch.x, pouch.y - 2, r, type, 0, time, true, 1);
      }
      Art.drawLauncherFront(ctx, pouch, loaded);
      this.grinch.draw(ctx, time, this.state === "menu" ? null : pouch);

      // Light strings, then the decorations.
      for (const l of this.lights) if (l.alive) Art.drawLights(ctx, l, time);
      for (const t of this.things) {
        if (!t.alive) continue;
        if (t.parachute) this.drawParachute(ctx, t);
        Art.drawThing(ctx, t, time, t.look);
      }
      for (const p of this.projectiles) {
        if (p.dead) continue;
        const b = p.body;
        Art.drawSnowball(ctx, b.x, b.y, b.r, p.type, p.spin, time, true, b.vx);
      }
      this.events.draw(ctx, time);
      this.particles.draw(ctx);
      if (this.aim) this.drawAim(ctx, info);
      if (this.state === "play" || this.state === "intro") this.drawHint(ctx, time);
      this.particles.drawTexts(ctx, this.textScale || 1);
      this.grinch.drawBubble(ctx, this.textScale || 1);
      this.particles.drawSnow(ctx);

      // Screen space.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (this.flashAmt > 0) {
        ctx.fillStyle = `rgba(255,255,255,${this.flashAmt})`;
        ctx.fillRect(0, 0, W, H);
      }
      if (this.timeScale < 0.9) {
        // A gentle vignette during slow motion.
        const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, `rgba(20, 10, 40, ${(1 - this.timeScale) * 0.5})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      this.hud.draw(ctx, this, W, H, this.dpr || 1);
    }

    drawParachute(ctx, t) {
      const b = t.body;
      const top = b.y - 120;
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(b.x - 50, top);
      ctx.lineTo(b.x - 18, b.y - 22);
      ctx.moveTo(b.x + 50, top);
      ctx.lineTo(b.x + 18, b.y - 22);
      ctx.moveTo(b.x, top - 30);
      ctx.lineTo(b.x, b.y - 22);
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? "#ffffff" : "#e0303a";
        ctx.beginPath();
        ctx.moveTo(b.x, top - 34);
        ctx.arc(b.x, top + 4, 54, Math.PI + (i * Math.PI) / 4, Math.PI + ((i + 1) * Math.PI) / 4);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Trajectory dots and the power meter while aiming.
    drawAim(ctx, info) {
      const type = this.ammo[this.selected] || "normal";
      const speed = LAUNCH_MIN + info.power * LAUNCH_RANGE;
      let x = info.pouch.x;
      let y = info.pouch.y;
      let vx = info.dir.x * speed;
      let vy = info.dir.y * speed;
      const col = info.power < 0.45 ? "#4be37a" : info.power < 0.8 ? "#ffd23f" : "#ff4b5c";
      const full = this.storage.data.settings.aimGuide;
      const dots = full ? 26 : 9;
      const dt = 1 / 24;
      for (let i = 0; i < dots; i++) {
        for (let k = 0; k < 3; k++) {
          vy += (G.GRAVITY * dt) / 3;
          x += (vx * dt) / 3;
          y += (vy * dt) / 3;
        }
        if (y > G.GROUND_Y || x > G.WORLD_W + 50) break;
        const a = 1 - i / dots;
        ctx.globalAlpha = 0.25 + a * 0.75;
        Art.circle(ctx, x, y, 3 + a * 4, i % 2 ? "#ffffff" : col);
      }
      ctx.globalAlpha = 1;
      // Power meter beside the launcher.
      const mx = 470;
      const my = 650;
      const mh = 150;
      Art.roundRect(ctx, mx - 13, my - 4, 26, mh + 8, 12);
      ctx.fillStyle = "rgba(16, 26, 60, 0.75)";
      ctx.fill();
      const g = ctx.createLinearGradient(0, my + mh, 0, my);
      g.addColorStop(0, "#4be37a");
      g.addColorStop(0.5, "#ffd23f");
      g.addColorStop(1, "#ff4b5c");
      Art.roundRect(ctx, mx - 8, my + mh * (1 - info.power), 16, mh * info.power, 8);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 16px Oxanium, 'Trebuchet MS', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(info.power * 100)}%`, mx, my - 16);
      if (type === "split" || type === "explosive") {
        ctx.font = "800 15px Oxanium, 'Trebuchet MS', sans-serif";
        ctx.fillText(type === "split" ? "TAP IN FLIGHT TO SPLIT" : "TAP IN FLIGHT TO DETONATE", 360, 860);
      }
    }

    // First level: show how to aim with a hand that drags back.
    drawHint(ctx, time) {
      if (this.levelIndex !== 0 || this.hintShots > 0 || this.aim || this.shot !== "ready") return;
      const k = (time % 1.8) / 1.8;
      const e = G.easeOutCubic(Math.min(1, k * 1.4));
      const rest = this.pouchRest;
      const hx = rest.x - e * 90;
      const hy = rest.y + e * 60;
      ctx.save();
      ctx.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 1;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.setLineDash([8, 8]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(rest.x, rest.y);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.setLineDash([]);
      // A pointing glove.
      Art.circle(ctx, hx, hy + 14, 15, "#ffffff");
      Art.ellipse(ctx, hx + 2, hy - 6, 6, 13, "#ffffff");
      ctx.strokeStyle = "#1d2a4a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hx, hy + 14, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      const ts = this.textScale || 1;
      ctx.font = `900 ${Math.round(26 * ts)}px Oxanium, 'Trebuchet MS', sans-serif`;
      ctx.textAlign = "center";
      ctx.lineWidth = 6 * ts;
      ctx.strokeStyle = "#1d2a4a";
      ctx.strokeText("DRAG BACK, THEN LET GO!", 520 + 60 * (ts - 1), 520);
      ctx.fillStyle = "#ffd23f";
      ctx.fillText("DRAG BACK, THEN LET GO!", 520 + 60 * (ts - 1), 520);
    }
  }

  G.Game = Game;
})(window.GS);
