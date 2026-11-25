/*
 * The game itself: the state machine, a stage's world, spawning, scoring events, the
 * camera and the draw order. Rendering is kept apart from updating, and every update is
 * driven by delta time so the game plays the same at any frame rate.
 *
 * States:
 *   menu           attract mode behind the title screen (a demo saucer beams up animals)
 *   intro          a level's title card; you can fly, the clock waits
 *   playing        the clock runs
 *   timeup         a classic level's clock hit zero
 *   crash          out of hull points; the saucer is falling
 *   paused, levelComplete, gameOver   frozen behind a menu
 */
(function (U) {
  "use strict";

  const INTRO_TIME = 2.6;
  const TIMEUP_TIME = 1.8;
  const CRASH_TIME = 2.2;

  class Game {
    constructor(canvas, storage, audio, input) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.storage = storage;
      this.audio = audio;
      this.input = input;
      this.ui = null;

      this.VW = 1280;
      this.pxScale = 1;
      this.rightInset = 66;
      this.camX = 0;
      this.shake = 0;
      this.time = 0;

      this.particles = new U.Particles();
      this.texts = new U.FloatTexts();
      this.scoring = new U.Scoring();
      this.player = new U.Player(this);
      this.beam = new U.TractorBeam(this);
      this.projectiles = new U.Projectiles(this);
      this.powerups = new U.PowerUpManager(this);
      this.rescue = new U.RescueManager(this);
      this.hud = new U.HUD(this);

      this.targets = [];
      this.hazards = [];
      this.spawners = [];
      this.mode = "demo";
      this.state = "menu";
      this.diff = { targetSpeed: 1, hazardRate: 1, hazardSpeed: 1 };
      this.reunion = null;
      this.reunionPending = 0;
      this.levelIndex = 0;
      this.zone = 0;
      this.playSeconds = 0;
      this.timeLeft = 0;
      this.stageTime = 0;
      this.drawList = [];
      this.startDemo();
    }

    get celebrating() {
      return !!this.reunion;
    }

    get inLevel() {
      return this.state === "intro" || this.state === "playing" || this.state === "timeup" || this.state === "crash";
    }

    // ---------------------------------------------------------------- Runs and stages

    startRun(mode) {
      this.mode = mode;
      this.audio.sfxOff = false;
      this.scoring.reset();
      this.player.reset();
      this.rescue.startRun(mode === "endless");
      this.levelIndex = 0;
      this.zone = 0;
      this.playSeconds = 0;
      this.reunion = null;
      this.reunionPending = 0;
      this.storage.data.totals.games++;
      this.storage.save();
      this.startLevel();
    }

    startLevel() {
      const def = this.mode === "classic" ? U.LEVELS[this.levelIndex] : U.endlessStage(this.zone);
      this.loadStage(def);
      this.player.placeForStage(U.clamp(this.player.x || 640, 400, U.WORLD_W - 400));
      this.camX = U.clamp(this.player.x - this.VW / 2, 0, U.WORLD_W - this.VW);
      this.state = "intro";
      this.introT = INTRO_TIME;
      this.hud.reset();
      const title = this.mode === "classic" ? `LEVEL ${this.levelIndex + 1}` : `ZONE ${this.zone + 1}`;
      this.hud.bigText(title, `${this.env.name}: ${def.tip}`, INTRO_TIME + 0.2);
      this.audio.playMusic(def.music);
      this.input.enabled = true;
      this.input.release();
      if (this.ui) this.ui.enterPlay();
    }

    loadStage(def) {
      this.stage = def;
      // Each time a level loads, it's daytime or nighttime at random.
      this.scene = U.Scenery.build(def.env, Math.random() < 0.5);
      this.env = this.scene.env;
      this.diff = def.diff;
      this.targets = [];
      this.hazards = [];
      this.projectiles.clear();
      this.particles.clear();
      this.texts.clear();
      this.beam.reset();
      this.stageTime = 0;
      this.timeLeft = def.duration;
      this.zoneTwenty = false;
      this.scoring.startStage();
      this.spawners = def.hazards.map((h) => ({ ...h, timer: h.first }));
      this.targetTimer = def.targetEvery;
      this.powerups.reset(def.powerEvery);
      this.rescue.startStage(def.rescues, def.duration);
      for (const s of def.statics) this.placeStatic(s);
      const start = Math.round(def.targetCap * 0.8);
      for (let i = 0; i < start; i++) this.spawnTarget(true);
    }

    placeStatic(s) {
      const def = U.HAZARDS[s.type];
      if (s.type === "monkey") {
        for (const px of s.palms) {
          const perch = this.scene.perches.find((p) => p.prop === "palm" && Math.abs(p.x - px - 34) < 2);
          if (perch) this.hazards.push(def.make(this, perch.x, perch.y + 4));
        }
      } else {
        this.hazards.push(def.make(this, s.x));
      }
    }

    // A perch is unsafe for an alien when a hazard is sitting on it.
    blockedPerch(perch) {
      return this.hazards.some((h) => h.key === "monkey" && Math.abs(h.x - perch.x) < 40);
    }

    // ---------------------------------------------------------------- Attract mode

    startDemo() {
      this.mode = "demo";
      this.state = "menu";
      this.audio.sfxOff = true;
      this.audio.silenceLoops();
      const idx = Math.floor(Math.random() * U.LEVELS.length);
      const lv = U.LEVELS[idx];
      this.loadStage({ ...lv, hazards: [], statics: [], rescues: 0, powerEvery: 9999, targetCap: 14, targetEvery: 1.2, duration: 9999, diff: { targetSpeed: 1, hazardRate: 1, hazardSpeed: 1 } });
      this.player.reset();
      this.player.x = U.rand(800, U.WORLD_W - 800);
      this.player.y = 250;
      this.camX = U.clamp(this.player.x - this.VW / 2, 0, U.WORLD_W - this.VW);
      this.demo = { target: null, retarget: 0 };
      this.input.enabled = false;
    }

    demoControl(dt) {
      const d = this.demo;
      const p = this.player;
      d.retarget -= dt;
      if (!d.target || d.target.dead || !d.target.capturable || d.retarget <= 0) {
        if (!this.targets.some((t) => t.state === "lifting")) {
          let best = null;
          let bestD = Infinity;
          for (const t of this.targets) {
            if (!t.capturable) continue;
            const dist = Math.abs(t.x - p.x) + U.rand(0, 200);
            if (dist < bestD) {
              bestD = dist;
              best = t;
            }
          }
          d.target = best;
          d.retarget = 6;
        }
      }
      const lifting = this.targets.some((t) => t.state === "lifting");
      if (!d.target) return { move: { x: 0, y: (300 - p.y) / 200 }, beam: lifting };
      const dx = d.target.x - p.x;
      const dy = 370 - p.y;
      const len = Math.hypot(dx, dy);
      const k = Math.min(1, len / 140) * 0.75;
      const move = len > 4 ? { x: (dx / len) * k, y: (dy / len) * k } : { x: 0, y: 0 };
      return { move, beam: lifting || (Math.abs(dx) < 30 && p.y > 330) };
    }

    // ---------------------------------------------------------------- Pause and flow

    pause() {
      if (!this.inLevel || this.state === "paused") return;
      this.prevState = this.state;
      this.state = "paused";
      this.audio.silenceLoops();
      this.input.release();
      if (this.ui) this.ui.showPause();
    }

    resume() {
      if (this.state !== "paused") return;
      this.state = this.prevState;
      this.input.release();
      if (this.ui) this.ui.enterPlay();
    }

    restart() {
      this.startRun(this.mode === "demo" ? "classic" : this.mode);
    }

    toMenu() {
      this.startDemo();
      this.audio.playMusic("menu");
      if (this.ui) this.ui.showTitle();
    }

    finishLevel() {
      const s = this.scoring;
      const level = this.levelIndex + 1;
      const bonuses = s.levelBonuses(level);
      for (const b of bonuses) s.add(b.points);
      this.rescue.endStage();
      this.state = "levelComplete";
      this.input.enabled = false;
      this.audio.silenceLoops();
      this.audio.play("levelClear");
      const last = this.levelIndex >= U.LEVELS.length - 1;
      const repaired = !last && this.player.health < this.player.maxHealth;
      if (this.ui) {
        this.ui.showLevelComplete({
          level,
          name: this.env.name,
          stageScore: s.stageScore,
          abductions: s.stageAbductions,
          rescues: s.stageRescues,
          bonuses,
          score: s.score,
          last,
          repaired,
        });
      }
    }

    continueAfterLevel() {
      if (this.levelIndex >= U.LEVELS.length - 1) {
        this.gameOver(true);
        return;
      }
      this.levelIndex++;
      // The repair crew patches one hull point between levels.
      this.player.health = Math.min(this.player.maxHealth, this.player.health + 1);
      this.startLevel();
    }

    gameOver(completed) {
      this.state = "gameOver";
      this.input.enabled = false;
      this.audio.silenceLoops();
      this.audio.play(completed ? "levelClear" : "gameOver");
      const s = this.scoring;
      const result = {
        mode: this.mode,
        completed,
        score: s.score,
        level: this.mode === "classic" ? this.levelIndex + 1 : this.zone + 1,
        abductions: s.abductions,
        rescues: s.rescues,
        bestCombo: s.bestCombo,
        seconds: Math.max(1, Math.floor(this.playSeconds)),
        finished: this.mode === "classic" && completed,
        reunions: this.rescue.reunions,
      };
      const totals = this.storage.data.totals;
      totals.abductions += s.abductions;
      result.newBest = this.storage.addHighScore(this.mode, {
        score: result.score,
        level: result.level,
        rescues: result.rescues,
        abductions: result.abductions,
        seconds: result.seconds,
      });
      this.storage.save();
      if (this.ui) this.ui.showGameOver(result);
    }

    // ---------------------------------------------------------------- Spawning

    spawnTarget(anywhere) {
      const key = U.weighted(this.stage.targets);
      if (!key) return;
      let x = U.rand(60, U.WORLD_W - 60);
      if (!anywhere) {
        for (let i = 0; i < 12; i++) {
          x = U.rand(60, U.WORLD_W - 60);
          if (x < this.camX - 80 || x > this.camX + this.VW + 80) break;
        }
      }
      const y = U.rand(U.FEET_MIN, U.FEET_MAX);
      if (key === "duck") {
        const leader = new U.Target(this, key, x, y);
        this.targets.push(leader);
        const n = U.randInt(2, 3);
        for (let i = 0; i < n; i++) {
          const d = new U.Target(this, key, U.clamp(x - (i + 1) * 30, 40, U.WORLD_W - 40), U.clamp(y + U.rand(-15, 15), U.FEET_MIN, U.FEET_MAX));
          d.leader = leader;
          d.offX = -(i + 1) * 30;
          d.offY = U.rand(-14, 14);
          this.targets.push(d);
        }
      } else {
        this.targets.push(new U.Target(this, key, x, y));
      }
    }

    spawnHazard(type) {
      const def = U.HAZARDS[type];
      if (!def) return;
      const p = this.player;
      const left = this.camX - 140;
      const right = this.camX + this.VW + 140;
      const sides = [];
      if (left > 80) sides.push(left);
      if (right < U.WORLD_W - 80) sides.push(right);
      let x = sides.length ? U.pick(sides) : p.x < U.WORLD_W / 2 ? U.WORLD_W - 120 : 120;
      if (def.air) {
        let y = 130;
        if (type === "eagle" || type === "pelican") y = U.rand(130, 230);
        if (type === "cloud") {
          y = U.rand(105, 165);
          x = U.clamp(x, 140, U.WORLD_W - 140);
        }
        this.hazards.push(def.make(this, x, y));
      } else {
        let y = U.rand(610, U.FEET_MAX);
        if (type === "bull" || type === "resident") y = U.rand(U.FEET_MIN + 8, U.FEET_MAX);
        if (type === "giantFarmer") y = U.FEET_MIN + 16;
        this.hazards.push(def.make(this, x, y));
      }
    }

    // ---------------------------------------------------------------- Events

    onAbduct(target) {
      const p = this.player;
      this.particles.sparkle(this.beam.ox, this.beam.oy, 14);
      p.cheer = 0.7;
      if (this.mode === "demo") {
        this.texts.add(this.beam.ox, this.beam.oy - 20, `+${target.type.points}`, { color: "#ffe36b" });
        return;
      }
      const res = this.scoring.abduct(target.type.points, p.power.double > 0);
      const colors = ["#ffe36b", "#8dff5a", "#5fd0ff", "#ff5fb4", "#ffd23f"];
      this.texts.add(this.beam.ox, this.beam.oy - 20, `+${res.gained}`, { color: colors[res.mult - 1], size: 24 + res.mult * 3 });
      this.audio.play("abduct", { combo: this.scoring.combo });
      if (res.streak) {
        this.hud.banner(res.label, { color: "#ff5fb4", size: 36, sub: `+${U.formatScore(res.streak)} BONUS`, time: 2 });
        this.audio.play("streak");
      } else if (res.multUp) {
        this.hud.banner(`x${res.mult} COMBO!`, { color: colors[res.mult - 1], size: 40, time: 1.2 });
        this.audio.play("combo", { level: res.mult });
      }
      if (this.scoring.stageAbductions === 20) {
        if (this.mode === "endless" && !this.zoneTwenty) {
          this.zoneTwenty = true;
          this.scoring.addBonus(U.BONUS.twentyAbductions);
          this.hud.banner("20 ABDUCTIONS!", { color: "#8dff5a", sub: "+2,000 BONUS", time: 2 });
        } else if (this.mode === "classic") {
          this.hud.banner("20 ABDUCTIONS!", { color: "#8dff5a", sub: "+2,000 AT LEVEL END", time: 2 });
        }
      }
    }

    onRescue(alien) {
      const m = alien.member;
      this.particles.confetti(this.beam.ox, this.beam.oy, 36);
      this.player.cheer = 1.6;
      this.scoring.rescue(m.points);
      this.storage.rescue(m.id);
      this.storage.save();
      const complete = this.rescue.markRescued(m.id);
      this.hud.banner(`${m.name.toUpperCase()} RESCUED!`, { color: "#8dff5a", size: 34, sub: `+${U.formatScore(m.points)}   "${m.quote}"`, time: 2.8 });
      this.texts.add(this.beam.ox, this.beam.oy - 30, `+${U.formatScore(m.points)}`, { color: "#8dff5a", size: 34 });
      this.audio.play("rescue");
      if (complete) this.reunionPending = 1.2;
    }

    startReunion() {
      this.reunion = new U.Reunion(this);
      this.scoring.addBonus(U.BONUS.reunion);
      this.storage.data.reunions++;
      this.storage.save();
      this.audio.play("reunion");
      this.audio.duck(5);
      this.audio.silenceLoops();
      this.input.release();
    }

    endReunion() {
      this.reunion = null;
      if (this.mode === "endless") {
        this.rescue.newRound();
        this.hud.banner("A NEW ROUND OF RESCUES BEGINS!", { color: "#c08cff", size: 24, time: 2 });
      } else {
        this.rescue.reunions++;
      }
    }

    onPlayerDamaged(label) {
      const p = this.player;
      this.scoring.tookDamage();
      p.overload = Math.max(p.overload, 0.5);
      this.hud.flash = 1;
      this.hud.healthFlash = 1.2;
      this.shakeScreen(14);
      this.audio.play("hit");
      this.audio.play("alarm");
      this.texts.add(p.x, p.y - 60, U.pick(["OUCH!", "BONK!", "YIKES!", "OOF!"]), { color: "#ff5f6b", size: 30 });
      this.particles.burst(p.x, p.y, 18, { speed: 260, life: 0.6, size: 5, color: ["#ffd23f", "#ff5f6b", "#ffffff"], gravity: 300 });
      if (p.health === 1) this.hud.banner("HULL CRITICAL! FIND A REPAIR KIT!", { color: "#ff5f6b", size: 26, time: 2 });
      else if (label) this.hud.banner(`HIT BY ${label.toUpperCase()}!`, { color: "#ff8a8a", size: 22, time: 1.2 });
    }

    onPlayerStunned() {
      const p = this.player;
      this.audio.play("stun");
      this.texts.add(p.x, p.y - 60, "STUNNED!", { color: "#9fe7ff", size: 28 });
      this.shakeScreen(6);
    }

    onBeamFried() {
      const p = this.player;
      this.audio.play("fried");
      this.texts.add(p.x, p.y - 60, "BEAM FRIED!", { color: "#fff36b", size: 28 });
      this.hud.banner("TRACTOR BEAM OFFLINE!", { color: "#fff36b", size: 26, time: 1.4 });
      this.particles.burst(p.x, p.y + 20, 16, { speed: 200, life: 0.5, size: 4, color: ["#fff36b", "#ffffff"] });
    }

    blocked(x, y) {
      this.audio.play("shieldBlock");
      this.texts.add(x, y - 70, "BLOCKED!", { color: "#9fe7ff", size: 24 });
      this.particles.sparkle(x, y, 10, ["#bff4ff", "#ffffff"]);
    }

    beamPenalty(h) {
      const p = this.player;
      p.overload = 1.4;
      h.onBeamed();
      this.audio.play("nope");
      const y = h.ground ? (h.bodyRect() ? h.bodyRect().y : h.groundY - 100) - 20 : h.y - 40;
      this.texts.add(h.x, y, "DON'T BEAM THAT!", { color: "#ff5f6b", size: 24, life: 1.4 });
      this.particles.burst(this.beam.ox, this.beam.oy + 40, 16, { speed: 220, life: 0.5, size: 4, color: ["#ff5f6b", "#ffffff"] });
      p.damage(h.name);
    }

    onCrashLanded(x, y) {
      this.audio.play("boom");
      this.shakeScreen(22);
      this.particles.burst(x, y, 40, { speed: 380, life: 0.9, size: 7, color: ["#ffd23f", "#ff8a3d", "#ff5f6b", "#ffffff"], gravity: 400 });
      this.particles.smoke(x, y, 14, "rgba(90, 80, 100, 0.8)");
      this.texts.add(x, y - 80, "KA-BLOOEY!", { color: "#ffb02e", size: 40, life: 1.6 });
    }

    shakeScreen(amount) {
      if (this.storage.data.settings.shake) this.shake = Math.max(this.shake, amount);
    }

    isVisible(x, margin = 60) {
      return x > this.camX - margin && x < this.camX + this.VW + margin;
    }

    // ---------------------------------------------------------------- Update

    update(dt) {
      const frozen = this.state === "paused" || this.state === "levelComplete" || this.state === "gameOver";
      if (frozen) return;
      this.time += dt;

      if (this.inLevel && this.input.consumePause()) {
        this.pause();
        return;
      }
      this.input.consumePause();

      if (this.reunion) {
        this.reunion.update(dt);
        this.particles.update(dt);
        this.texts.update(dt);
        this.hud.update(dt);
        if (this.reunion.done) this.endReunion();
        return;
      }

      const p = this.player;
      let move = { x: 0, y: 0 };
      let wantBeam = false;
      if (this.mode === "demo") {
        const d = this.demoControl(dt);
        move = d.move;
        wantBeam = d.beam;
      } else if (this.state === "intro" || this.state === "playing") {
        move = this.input.getMove();
        wantBeam = this.input.beamHeld();
      }

      p.update(dt, move);
      this.beam.update(dt, wantBeam);
      if (this.mode !== "demo") this.input.setBeamDisabled(!this.beam.usable());

      const live = this.state === "playing";
      this.beamDanger = false;
      for (const t of this.targets) t.update(dt, this);
      if (live) this.rescue.update(dt, this.stageTime);
      for (const h of this.hazards) {
        h.update(dt);
        this.checkBeamOnHazard(h, dt);
        this.checkWarning(h);
      }
      this.projectiles.update(dt);
      if (live || this.state === "intro") this.powerups.update(dt);
      if (live) this.scoring.update(dt);

      this.targets = this.targets.filter((t) => !t.dead);
      this.hazards = this.hazards.filter((h) => !h.dead);

      // Keep the fields busy.
      this.targetTimer -= dt;
      if (this.targetTimer <= 0) {
        this.targetTimer = this.stage.targetEvery * U.rand(0.8, 1.2);
        const free = this.targets.filter((t) => t.state !== "abducted").length;
        if (free < this.stage.targetCap) this.spawnTarget(false);
      }
      if (live) {
        for (const s of this.spawners) {
          s.timer -= dt;
          if (s.timer <= 0) {
            s.timer = s.every * U.rand(0.85, 1.15);
            const count = this.hazards.filter((h) => h.key === s.type || (s.type === "pelican" && h.key === "eagle")).length;
            if (count < s.cap) this.spawnHazard(s.type);
          }
        }
      }

      this.updateClock(dt);

      if (this.reunionPending > 0) {
        this.reunionPending -= dt;
        if (this.reunionPending <= 0 && this.inLevel && p.alive) this.startReunion();
      }

      this.particles.update(dt);
      this.texts.update(dt);
      this.hud.update(dt);
      U.Scenery.update(this.scene, dt);

      // Camera: follow the saucer, looking a little ahead of where it's going.
      const want = U.clamp(p.x - this.VW / 2 + p.vx * 0.35, 0, Math.max(0, U.WORLD_W - this.VW));
      this.camX = U.damp(this.camX, want, 5, dt);
      this.camX = U.clamp(this.camX, 0, Math.max(0, U.WORLD_W - this.VW));
      this.shake = Math.max(0, this.shake - dt * 40);

      if (this.mode !== "demo" && (this.state === "intro" || this.state === "playing")) {
        this.audio.setEngine(Math.min(1, Math.hypot(p.vx, p.vy) / 420) * 0.7 + 0.3);
      } else {
        this.audio.setEngine(0);
      }
    }

    updateClock(dt) {
      const p = this.player;
      if (this.state === "intro") {
        this.introT -= dt;
        if (this.introT <= 0) {
          this.state = "playing";
          this.hud.banner("GO GO GO!", { color: "#8dff5a", size: 46, time: 1 });
          this.audio.play("go");
        }
        return;
      }
      if (this.state === "playing") {
        this.stageTime += dt;
        this.playSeconds += dt;
        if (this.mode === "classic") {
          const before = Math.ceil(this.timeLeft);
          this.timeLeft -= dt;
          const after = Math.ceil(this.timeLeft);
          if (before !== after) {
            if (after === 10) this.hud.banner("10 SECONDS LEFT!", { color: "#ff5f6b", size: 30, time: 1.5 });
            if (after <= 5 && after > 0) this.audio.play("tick");
          }
          if (this.timeLeft <= 0 && !this.reunionPending) {
            this.timeLeft = 0;
            this.state = "timeup";
            this.timeupT = TIMEUP_TIME;
            this.hud.bigText("TIME'S UP!", "", TIMEUP_TIME, "#ffd23f");
            this.audio.play("timeUp");
          }
        } else if (this.stageTime >= U.ZONE_TIME) {
          this.nextZone();
        }
        if (!p.alive) {
          this.state = "crash";
          this.crashT = CRASH_TIME;
        }
        return;
      }
      if (this.state === "timeup") {
        this.timeupT -= dt;
        if (this.timeupT <= 0) this.finishLevel();
        return;
      }
      if (this.state === "crash") {
        this.crashT -= dt;
        if (this.crashT <= 0) this.gameOver(false);
      }
    }

    nextZone() {
      if (this.scoring.stageDamage === 0) {
        this.scoring.addBonus(U.BONUS.noDamage);
        this.hud.banner("ZONE CLEAR WITH NO DAMAGE!", { color: "#8dff5a", sub: "+2,500 BONUS", time: 2.2 });
      }
      this.zone++;
      const def = U.endlessStage(this.zone);
      const keepX = this.player.x;
      this.loadStage(def);
      this.player.x = keepX;
      this.hud.bigText(`ZONE ${this.zone + 1}`, this.env.name, 2.2, "#c08cff");
      this.audio.playMusic(def.music);
      this.particles.burst(this.VW / 2, 360, 50, { speed: 500, life: 0.7, size: 6, color: ["#ffffff", "#c08cff", "#8dff5a"], screen: true });
    }

    checkBeamOnHazard(h, dt) {
      if (h.beamContact < 0) {
        h.beamContact = Math.min(0, h.beamContact + dt);
        return;
      }
      if (!h.beamable || !this.beam.active || this.mode === "demo") {
        h.beamContact = Math.max(0, h.beamContact - dt * 2);
        return;
      }
      const r = h.bodyRect();
      if (r && this.beam.touchesRect(r.x, r.y, r.w, r.h)) {
        // The beam turns red and the hazard shouts first, so there's time to let go.
        if (h.beamContact === 0) {
          this.audio.play("warn");
          this.texts.add(h.x, r.y - 16, "LET GO!", { color: "#ff5f6b", size: 22, life: 0.8 });
        }
        h.beamContact += dt;
        this.beamDanger = true;
        if (h.beamContact >= h.beamGrace) {
          h.beamContact = -1.2;
          this.beamPenalty(h);
        }
      } else {
        h.beamContact = Math.max(0, h.beamContact - dt * 2);
      }
    }

    checkWarning(h) {
      const threat = this.state === "playing" && h.threat() && this.isVisible(h.x, 0);
      if (threat && !h.warned) {
        h.warned = true;
        this.audio.play("warn");
      } else if (!threat) {
        h.warned = false;
      }
      h.warning = threat;
    }

    // ---------------------------------------------------------------- Render

    render() {
      const ctx = this.ctx;
      const t = this.time;
      ctx.setTransform(this.pxScale, 0, 0, this.pxScale, 0, 0);
      ctx.save();
      if (this.shake > 0) ctx.translate(U.rand(-this.shake, this.shake) * 0.5, U.rand(-this.shake, this.shake) * 0.5);

      U.Scenery.drawBackground(ctx, this.scene, this.camX, this.VW, t);

      ctx.save();
      ctx.translate(-this.camX, 0);
      const x0 = this.camX - 200;
      const x1 = this.camX + this.VW + 200;

      // Aliens up on perches sit on the props, behind everyone on the ground.
      for (const a of this.rescue.aliens) {
        if (!a.perch.ground && (a.state === "hiding" || a.state === "waving" || a.state === "falling")) a.draw(ctx, t);
      }
      for (const h of this.hazards) if (h.key === "monkey" && h.x > x0 && h.x < x1) h.draw(ctx, t);

      // Everything on the ground, back to front.
      const list = this.drawList;
      list.length = 0;
      for (const tg of this.targets) {
        if (tg.x < x0 || tg.x > x1) continue;
        if (tg.state === "lifting" || tg.state === "abducted") continue;
        list.push(tg);
      }
      for (const h of this.hazards) if (h.ground && h.key !== "monkey" && h.x > x0 - 200 && h.x < x1 + 200) list.push(h);
      for (const a of this.rescue.aliens) if (a.perch.ground && (a.state === "hiding" || a.state === "waving" || a.state === "falling")) list.push(a);
      list.sort((a, b) => (a.groundY !== undefined ? a.groundY : a.baseY) - (b.groundY !== undefined ? b.groundY : b.baseY));
      for (const e of list) e.draw(ctx, t);

      this.beam.draw(ctx, t);
      for (const tg of this.targets) if (tg.state === "lifting" || tg.state === "abducted") tg.draw(ctx, t);
      for (const a of this.rescue.aliens) if (a.state === "lifting" || a.state === "rescued") a.draw(ctx, t);

      for (const h of this.hazards) if (!h.ground && h.key !== "monkey" && h.x > x0 - 300 && h.x < x1 + 300) h.draw(ctx, t);
      this.powerups.draw(ctx, t);
      this.projectiles.draw(ctx, t);
      this.player.draw(ctx, t);
      this.particles.draw(ctx, false);
      this.texts.draw(ctx);
      for (const h of this.hazards) if (h.warning) U.Draw.warning(ctx, h.x, h.warnY(), t);
      ctx.restore();
      ctx.restore();

      if (this.mode !== "demo") this.hud.draw(ctx, t);
      if (this.reunion) this.reunion.draw(ctx, this.VW, t);
      this.particles.draw(ctx, true);
    }
  }

  U.Game = Game;
})(window.UFO);
