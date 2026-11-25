/*
 * The game: states, level loading, the crowd, scoring, getting caught, escaping, the
 * camera and the draw order. Screens and buttons live in ui.js; this file calls into it
 * when a level or the whole game ends.
 *
 * States: menu (an animated street behind the title screen), intro (level card), ready
 * (3-2-1), play, paused, escaping, timeup, levelEnd, gameover.
 */
(function (G) {
  "use strict";

  const Art = G.Art;

  const QUIPS = {
    start: ["MERRY CHRISTMAS? NOT ON MY WATCH!", "TIME TO STEAL CHRISTMAS!", "TIPTOE... TIPTOE...", "ALL THOSE PRESENTS... MINE!"],
    bigLoot: ["MY PRECIOUS CHRISTMAS LOOT!", "HEH HEH HEH!", "JACKPOT!", "OOH, SHINY!"],
    heavy: ["THAT'S A LOT OF PRESENTS!", "HEAVY... BUT WORTH IT!"],
    over: ["I NEED A BIGGER SACK!", "OOF... SO... HEAVY..."],
    spotted: ["THE WHOS ARE ON TO US!", "UH OH!", "YIKES! A WHO!", "RUN FOR IT!"],
    caught: ["CURSES!", "NOT MY LOOT!", "UNHAND ME, WHO!", "BAH! HUMBUG!"],
    dog: ["BAD DOGGY!", "SHOO! SHOO!", "MY LOOT!"],
    escape: ["SO LONG, WHOS!", "WHAT A HAUL!", "HEH HEH HEH!", "MERRY GRINCHMAS!"],
    max: ["MAX!!", "MAX! WATCH WHERE YOU'RE GOING!"],
    power: ["OOH, FANCY!", "NOW WE'RE TALKING!", "HEH, PERFECT!"],
    empty: ["STEAL SOMETHING FIRST!", "MY SACK IS EMPTY!"],
  };

  function newStats() {
    return { loot: 0, presents: 0, candy: 0, caught: 0, avoided: 0, escapes: 0, seconds: 0, points: 0 };
  }

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
      this.rightInset = 60;
      this.particles = new G.Particles();
      this.hud = new G.HUD(this);
      this.time = 0;
      this.camX = 0;
      this.camY = 0;
      this.shake = 0;
      this.flash = 0;
      this.state = "menu";
      this.mode = "menu";
      this.lives = 3;
      this.score = 0;
      this.stats = newStats();
      this.whos = [];
      this.dogs = [];
      this.markers = [];
      this.quip = null;
      this.multT = 0;
      this.timeLeft = G.ROUND_TIME;
      this.setupMenuScene();
    }

    // ---------------------------------------------------------------- Menu scene

    setupMenuScene() {
      this.mode = "menu";
      this.state = "menu";
      this.prepareLevel(1, true);
      this.timeLeft = G.ROUND_TIME;
      const p = this.player;
      const demo = { node: this.world.nearestNode(p.x, p.y), target: null, sneak: false, t: 0 };
      this.demo = demo;
      this.demoInput = {
        getMove: () => {
          if (!demo.target) return { x: 0, y: 0 };
          const dx = demo.target.x - p.x;
          const dy = demo.target.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          const k = demo.pause > 0 ? 0 : 1;
          return { x: (dx / d) * k, y: (dy / d) * k };
        },
        sneakHeld: () => demo.sneak,
        consumeBoost: () => false,
      };
      for (let i = 0; i < 5; i++) {
        const sack = G.pick(["small", "large", "candy", "ornament", "stocking"]);
        p.addLoot(sack, 10);
      }
      this.max.active = true;
      this.max.x = p.x - 60;
      this.max.y = p.y;
      this.max.setState("follow");
      this.max.taskData = 1e9;
      this.snapCamera();
    }

    updateMenuScene(dt) {
      const p = this.player;
      const demo = this.demo;
      const w = this.world;
      demo.t += dt;
      if (demo.pause > 0) demo.pause -= dt;
      if (!demo.target || G.dist(p.x, p.y, demo.target.x, demo.target.y) < 24) {
        const cur = w.nodes[demo.node];
        const next = G.pick(cur.n);
        demo.prev = demo.node;
        demo.node = next;
        demo.target = { x: w.nodes[next].x, y: w.nodes[next].y };
        demo.sneak = Math.random() < 0.45;
        if (Math.random() < 0.3) {
          demo.pause = 1.2;
          p.play(G.pick(["laugh", "celebrate"]), 1.2);
        }
      }
      p.update(dt, this.demoInput, w);
      for (const who of this.whos) who.update(dt);
      for (const d of this.dogs) d.update(dt);
      this.max.update(dt);
      if (this.max.state !== "follow") {
        this.max.active = true;
        this.max.setState("follow");
        this.max.taskData = 1e9;
      }
      this.hazards.update(dt);
      this.particles.update(dt);
      this.updateCamera(dt);
    }

    // ---------------------------------------------------------------- Starting

    startCampaign() {
      this.mode = "campaign";
      this.lives = 3;
      this.score = 0;
      this.nextLifeAt = 3000;
      this.stats = newStats();
      this.loadLevel(1);
    }

    startPractice(id) {
      this.mode = "practice";
      this.lives = 3;
      this.score = 0;
      this.nextLifeAt = 1e12;
      this.stats = newStats();
      this.loadLevel(id);
    }

    loadLevel(id) {
      this.prepareLevel(id, false);
      this.state = "intro";
      this.audio.playMusic("menu");
      if (this.ui) this.ui.showLevelIntro(this.L);
    }

    prepareLevel(id, menu) {
      this.L = G.LEVELS[id - 1];
      const L = this.L;
      this.world = new G.World(L);
      this.ground = this.world.renderGround();
      this.player = new G.Player(this, this.world.start.x, this.world.start.y);
      this.player.dir = "down";
      this.whos = [];
      this.dogs = [];
      this.markers = [];
      this.particles.clear();
      this.hud.reset();
      this.hazards = new G.Hazards(this);
      this.spawnCrowd(menu);
      this.max = new G.Max(this);
      this.loot = new G.Loot(this);
      if (!menu) this.loot.spawnLevel();
      this.events = new G.Events(this);
      this.timeLeft = G.ROUND_TIME;
      this.roundBonus = 0;
      this.roundCaught = 0;
      this.roundCounts = {};
      this.roundTime = 0;
      this.multT = 0;
      this.quip = null;
      this.flash = 0;
      this.shake = 0;
      this.readyT = 0;
      this.escapeT = 0;
      this.timeupT = 0;
      this.lastTick = 99;
      this.lastSpotT = -10;
      this.lastHitT = -10;
      this.lastEmptyT = -10;
      this.getawayArmed = !L.startAtGetaway;
      this.distMoved = 0;
      this.sneakTime = 0;
      this.boostsUsed = 0;
      this.chased = false;
      this.stageSeen = 1;
      this.snapCamera();
    }

    beginLevel() {
      this.state = "ready";
      this.readyT = 3;
      this.lastBeep = 4;
      this.input.enabled = true;
      this.input.release();
      this.audio.playMusic("play");
      if (this.ui) this.ui.enterPlay();
    }

    spawnCrowd(menu) {
      const L = this.L;
      const C = L.crowd;
      const w = this.world;
      const start = w.start;
      const farIdx = [];
      w.nodes.forEach((n, i) => {
        if (G.dist(n.x, n.y, start.x, start.y) > 480 && G.dist(n.x, n.y, w.getaway.x, w.getaway.y) > 220) farIdx.push(i);
      });
      if (!farIdx.length) w.nodes.forEach((n, i) => farIdx.push(i));
      const looks = Art.WHO_LOOKS;
      const jitter = () => G.rand(-20, 20);
      let li = Math.floor(Math.random() * looks.length);
      const nWander = menu ? 4 : C.wander;
      for (let i = 0; i < nWander; i++) {
        const ni = G.pick(farIdx);
        const n = w.nodes[ni];
        this.whos.push(new G.Who(this, { kind: "adult", role: "wander", look: looks[li++ % looks.length], x: n.x + jitter(), y: n.y + jitter(), node: ni }));
      }
      if (menu) return;

      // Patrols walk a loop around one block (two blocks wide on later levels).
      const cols = L.cols;
      for (let i = 0; i < C.patrol; i++) {
        let route = null;
        for (let tries = 0; tries < 20 && !route; tries++) {
          const r = G.randInt(0, L.rows - 1);
          const wide = L.id >= 6 && Math.random() < 0.5;
          const c = G.randInt(0, cols - (wide ? 2 : 1));
          if (w.paradeRow === r || w.paradeRow === r + 1) continue;
          const c2 = c + (wide ? 2 : 1);
          const idx = (ci, rj) => rj * (cols + 1) + ci;
          const loop = [];
          for (let k = c; k < c2; k++) loop.push(idx(k, r));
          loop.push(idx(c2, r));
          loop.push(idx(c2, r + 1));
          for (let k = c2 - 1; k >= c; k--) loop.push(idx(k, r + 1));
          if (Math.random() < 0.5) loop.reverse();
          // Start at the corner furthest from the Grinch.
          let best = 0;
          let bd = -1;
          loop.forEach((ni, k) => {
            const d = G.dist(w.nodes[ni].x, w.nodes[ni].y, start.x, start.y);
            if (d > bd) {
              bd = d;
              best = k;
            }
          });
          if (bd < 380) continue;
          route = loop.slice(best).concat(loop.slice(0, best));
        }
        if (!route) continue;
        const n = w.nodes[route[0]];
        const who = new G.Who(this, { kind: "adult", role: "patrol", look: looks[li++ % looks.length], x: n.x, y: n.y, route, node: route[0] });
        this.whos.push(who);
      }

      let prevKid = null;
      for (let i = 0; i < C.kids; i++) {
        const ni = G.pick(farIdx);
        const n = w.nodes[ni];
        const kid = new G.Who(this, { kind: "kid", role: "kid", look: Art.KID_LOOKS[i % Art.KID_LOOKS.length], x: n.x + jitter(), y: n.y + jitter(), node: ni });
        if (prevKid && !prevKid.leader && Math.random() < 0.6) {
          kid.leader = prevKid;
          kid.x = prevKid.x - 24;
          kid.y = prevKid.y + 12;
        }
        this.whos.push(kid);
        prevKid = kid;
      }

      for (let i = 0; i < C.dogs && w.dogHomes.length; i++) {
        const home = w.dogHomes[i % w.dogHomes.length];
        this.dogs.push(new G.Dog(this, { x: home.x, y: home.y }, Art.DOG_LOOKS[i % Art.DOG_LOOKS.length]));
      }

      const posts = w.guardPosts.filter((g) => G.dist(g.x, g.y, start.x, start.y) > 320);
      for (let i = 0; i < C.guards; i++) {
        let post = posts[i];
        if (!post) {
          const n = w.nodes[G.pick(farIdx)];
          post = { x: n.x, y: n.y, angle: Math.random() * G.TAU };
        }
        this.whos.push(new G.Who(this, { kind: "guard", role: "guard", look: Art.GUARD_LOOK, x: post.x, y: post.y, angle: post.angle, home: { x: post.x, y: post.y, angle: post.angle } }));
      }

      const faceAngle = (s) => (s.face === "up" ? -Math.PI / 2 : s.face === "down" ? Math.PI / 2 : Math.atan2(s.ty - s.y, s.tx - s.x));
      const idles = G.shuffle(w.idleSpots.filter((s) => G.dist(s.x, s.y, start.x, start.y) > 360));
      for (let i = 0; i < Math.min(C.idle || 0, idles.length); i++) {
        const s = idles[i];
        const a = faceAngle(s);
        this.whos.push(new G.Who(this, { kind: "adult", role: "idle", look: looks[li++ % looks.length], x: s.x, y: s.y, angle: a, home: { x: s.x, y: s.y, angle: a } }));
      }
      for (const s of w.spectatorSpots) {
        if (G.dist(s.x, s.y, start.x, start.y) < 300) continue;
        const a = faceAngle(s);
        const kid = Math.random() < 0.3;
        this.whos.push(
          new G.Who(this, {
            kind: kid ? "kid" : "adult",
            role: "idle",
            look: kid ? G.pick(Art.KID_LOOKS) : looks[li++ % looks.length],
            x: s.x,
            y: s.y,
            angle: a,
            home: { x: s.x, y: s.y, angle: a },
          }),
        );
      }
      if (w.parade && C.marchers && this.hazards.floats.length > 1) {
        const f = this.hazards.floats[1];
        for (let i = 0; i < C.marchers; i++) {
          const x = f.x - 40 - i * 46;
          const y = w.parade.laneY + (i % 2 ? 16 : -16);
          this.whos.push(new G.Who(this, { kind: "marcher", role: "march", look: Art.MARCHER_LOOK, x, y, home: { x, y }, speed: f.speed }));
        }
      }
    }

    spawnParty() {
      const w = this.world;
      const p = this.player;
      const options = w.nodes.filter((n) => {
        const d = G.dist(n.x, n.y, p.x, p.y);
        return d > 320 && d < 820 && G.dist(n.x, n.y, w.getaway.x, w.getaway.y) > 260;
      });
      if (!options.length) return false;
      const n = G.pick(options);
      const count = G.randInt(4, 5);
      for (let i = 0; i < count; i++) {
        const look = { ...G.pick(Art.WHO_LOOKS), style: "party", trim: G.pick(["#ff7ad9", "#ffd23f", "#5fd0ff", "#4cd964"]) };
        const who = new G.Who(this, { kind: "adult", role: "party", look, x: n.x + G.rand(-50, 50), y: n.y + G.rand(-40, 40), home: { x: n.x, y: n.y }, life: G.rand(13, 16) });
        this.whos.push(who);
        this.particles.confetti(who.x, who.y - 40, 10);
      }
      this.addMarker({ x: n.x, y: n.y }, "PARTY", "#ff7ad9", 4);
      return true;
    }

    // ---------------------------------------------------------------- Update

    update(dt) {
      this.time += dt;
      this.particles.updateSnow(dt, 0.004);
      if (this.state === "menu") {
        this.updateMenuScene(dt);
        return;
      }
      if (this.state === "paused" || this.state === "levelEnd" || this.state === "gameover") return;
      if (this.state === "intro") {
        for (const who of this.whos) who.update(dt);
        for (const d of this.dogs) d.update(dt);
        this.hazards.update(dt);
        this.particles.update(dt);
        return;
      }
      if (this.input.consumePause() && (this.state === "play" || this.state === "ready")) {
        this.pause();
        return;
      }

      if (this.state === "ready") {
        this.readyT -= dt;
        const n = Math.ceil(this.readyT);
        if (n < this.lastBeep) {
          this.lastBeep = n;
          this.audio.play("beep", { high: n <= 0 });
        }
        if (this.readyT <= 0) {
          this.state = "play";
          this.say(G.pick(QUIPS.start), 2.4);
          this.player.play("laugh", 0.9);
          this.audio.play("laugh");
        }
      }

      const p = this.player;
      if (this.state === "play") {
        this.timeLeft -= dt;
        this.roundTime += dt;
        if (this.timeLeft <= 10 && Math.ceil(this.timeLeft) < this.lastTick) {
          this.lastTick = Math.ceil(this.timeLeft);
          if (this.lastTick > 0) this.audio.play("tick");
        }
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          this.timeUp();
        }
      }

      const ox = p.x;
      const oy = p.y;
      if (this.state === "escaping") this.updateEscape(dt);
      else p.update(dt, this.state === "play" ? this.input : null, this.world);
      if (this.state === "play") {
        this.distMoved += G.dist(ox, oy, p.x, p.y);
        if (p.sneaking && p.speed01 > 0.05) this.sneakTime += dt;
        if (p.boostT > 1.05) this.boostsUsed++;
        this.checkGetaway();
      }

      for (const who of this.whos) who.update(dt);
      this.whos = this.whos.filter((w) => !w.dead);
      for (const d of this.dogs) d.update(dt);
      this.max.update(dt);
      this.loot.update(dt);
      this.hazards.update(dt);
      this.events.update(dt);

      for (const m of this.markers) m.t -= dt;
      this.markers = this.markers.filter((m) => m.t > 0 && !m.obj.collected && !(m.obj === this.max && !this.max.active));
      if (this.multT > 0) this.multT -= dt;
      if (this.quip) {
        this.quip.t -= dt;
        if (this.quip.t <= 0) this.quip = null;
      }
      this.chased = this.state === "play" && this.whos.some((w) => w.state === "chase");
      this.audio.setIntensity(this.chased, this.state === "play" && this.timeLeft <= 10);
      this.input.setBoostReady(p.boostReady);

      // Sack stage reactions.
      if (this.state === "play") {
        if (p.stage > this.stageSeen) {
          if (p.stage === 2) this.say(G.pick(QUIPS.heavy), 2);
          if (p.stage === 3) {
            this.say(G.pick(QUIPS.over), 2.2);
            this.hud.banner("OVERLOADED!", "You're slow now. Time to head for the getaway?", "#ff4d4d");
          }
        }
        this.stageSeen = p.stage;
      }

      if (this.state === "timeup") {
        this.timeupT += dt;
        if (this.timeupT > 2.4) this.finishLevel(false);
      }

      this.particles.update(dt);
      this.hud.update(dt);
      if (this.flash > 0) this.flash -= dt * 2.5;
      if (this.shake > 0) this.shake -= dt;
      this.updateCamera(dt);
    }

    checkGetaway() {
      const p = this.player;
      const w = this.world;
      const d = G.dist(p.x, p.y, w.getaway.x, w.getaway.y);
      if (!this.getawayArmed && d > 200) this.getawayArmed = true;
      if (!this.getawayArmed || d > 58 || p.stun > 0) return;
      if (p.sack.length > 0) this.escape();
      else if (this.time - this.lastEmptyT > 4) {
        this.lastEmptyT = this.time;
        this.say(G.pick(QUIPS.empty), 1.8);
      }
    }

    // ---------------------------------------------------------------- Camera

    snapCamera() {
      const p = this.player;
      const w = this.world;
      this.camX = G.clamp(p.x - this.VW / 2, 0, Math.max(0, w.W - this.VW));
      this.camY = G.clamp(p.y - G.VH / 2 - 30, 0, Math.max(0, w.H - G.VH));
      if (w.W < this.VW) this.camX = (w.W - this.VW) / 2;
      if (w.H < G.VH) this.camY = (w.H - G.VH) / 2;
    }

    updateCamera(dt) {
      const p = this.player;
      const w = this.world;
      let tx = p.x - this.VW / 2 + p.vx * 0.25;
      let ty = p.y - G.VH / 2 - 30 + p.vy * 0.2;
      tx = w.W < this.VW ? (w.W - this.VW) / 2 : G.clamp(tx, 0, w.W - this.VW);
      ty = w.H < G.VH ? (w.H - G.VH) / 2 : G.clamp(ty, 0, w.H - G.VH);
      this.camX = G.damp(this.camX, tx, 5, dt);
      this.camY = G.damp(this.camY, ty, 5, dt);
    }

    onScreen(x, y, margin = 40) {
      return x > this.camX - margin && x < this.camX + this.VW + margin && y > this.camY - margin && y < this.camY + G.VH + margin + 60;
    }

    // ---------------------------------------------------------------- Gameplay events

    displayScore() {
      if (!this.player || this.mode === "menu") return 0;
      return this.score + this.player.lootValue + (this.roundBonus || 0);
    }

    say(text, time = 2) {
      this.quip = { text, t: time, max: time };
    }

    banner(title, sub, color) {
      this.hud.banner(title, sub, color);
    }

    addMarker(obj, label, color, time) {
      this.markers.push({ obj, label, color, t: time });
    }

    grinchReact(anim, text) {
      this.player.play(anim, anim === "frustrated" ? 1.1 : 0.8);
      if (text) this.say(text, 2);
    }

    collect(it) {
      const p = this.player;
      it.collected = true;
      const def = G.ITEMS[it.type];
      let pts = it.pts != null ? it.pts : def.pts * (this.multT > 0 ? 2 : 1);
      if (it.dropped && it.pts == null) pts = def.pts;
      p.addLoot(it.type, pts);
      this.roundCounts[it.type] = (this.roundCounts[it.type] || 0) + 1;
      this.audio.play(def.sound, { gap: 0.02 });
      this.particles.sparkle(it.x, it.y - 16, it.type === "bell" || it.type === "golden" ? "#ffd23f" : "#ffffff");
      const col = pts >= 100 ? "#ffd23f" : pts >= 25 ? "#7dff8a" : "#ffffff";
      this.particles.text(p.x, p.y - 96, `+${pts}`, col, pts >= 100 ? 30 : 24);
      if (!p.anim || p.anim === "collect") p.play("collect", 0.35);
      if (pts >= 75) {
        p.play("laugh", 0.9);
        this.audio.play("laugh", { gap: 0.6 });
        if (Math.random() < 0.7) this.say(G.pick(QUIPS.bigLoot), 1.8);
      }
    }

    catchPlayer(who) {
      const p = this.player;
      if (p.stun > 0 || p.invuln > 0 || this.state !== "play") return;
      this.stats.caught++;
      this.roundCaught++;
      p.stun = 1.7;
      p.invuln = 4;
      p.vx = p.vy = 0;
      p.anim = null;
      this.flash = 0.9;
      this.shake = 0.5;
      this.audio.play("startled");
      this.audio.play("caught");
      const n = p.sack.length ? Math.min(6, Math.max(1, Math.ceil(p.sack.length * 0.3))) : 0;
      const dropped = p.dropLoot(n);
      if (dropped.length) {
        this.loot.scatter(dropped, p.x, p.y);
        this.audio.play("drop");
        const lost = dropped.reduce((a, e) => a + e.pts, 0);
        this.particles.text(p.x, p.y - 100, `-${lost}`, "#ff6b6b", 28);
      }
      this.particles.burst(p.x, p.y - 40, "star", 14, { speed: 200, life: 0.8, size: 6, colors: ["#ffd23f", "#ffffff"] });
      who.say(G.pick(["Gotcha, Grinch!", "And STAY OUT!", "Not so fast!", "Shoo, Grinch!"]), 1.8);
      who.setState("gloat");
      who.sus = 0;
      for (const w of this.whos) {
        if (w !== who && w.state === "chase") {
          w.setState("search");
          w.cool = 2;
        }
      }
      this.say(G.pick(QUIPS.caught), 2);
      this.hud.banner("CAUGHT!", dropped.length ? "Some loot fell out of your sack! Grab it back!" : "Lucky your sack was empty!", "#ff6b6b");
    }

    hazardHit(kind) {
      const p = this.player;
      if (p.stun > 0 || p.invuln > 0 || this.state !== "play") return;
      if (this.time - this.lastHitT < 0.8) return;
      this.lastHitT = this.time;
      const cfg = {
        snowball: { stun: 1.3, drop: 2, text: "SPLAT!" },
        press: { stun: 1.0, drop: 1, text: "BONK!" },
        tree: { stun: 1.0, drop: 1, text: "TIMBER!" },
        cart: { stun: 0.5, drop: 0, text: "OOF!" },
        float: { stun: 0.6, drop: 0, text: "OOF!" },
      }[kind] || { stun: 0.6, drop: 0, text: "OOF!" };
      p.stun = cfg.stun;
      p.invuln = cfg.stun + 1;
      p.vx = p.vy = 0;
      this.shake = 0.35;
      this.audio.play("bonk");
      this.particles.text(p.x, p.y - 100, cfg.text, "#ffffff", 26);
      this.particles.puff(p.x, p.y - 20, 10, 9);
      if (cfg.drop && p.sack.length) {
        const dropped = p.dropLoot(cfg.drop);
        this.loot.scatter(dropped, p.x, p.y);
        this.audio.play("drop");
      }
    }

    onSpotted() {
      this.stats.spotted = (this.stats.spotted || 0) + 1;
      if (this.time - this.lastSpotT > 4) {
        this.lastSpotT = this.time;
        if (this.player.stun <= 0) {
          this.player.play("startled", 0.5);
          this.audio.play("startled");
        }
        this.say(G.pick(QUIPS.spotted), 1.8);
      }
    }

    onShout() {
      this.onSpotted();
    }

    alertWhos(x, y, r, src) {
      for (const w of this.whos) {
        if (w === src) continue;
        if (G.dist(w.x, w.y, x, y) < r) w.investigate(x, y);
      }
    }

    dogBark(dog) {
      const p = this.player;
      const d = G.dist(dog.x, dog.y, p.x, p.y);
      if (d < 900) this.audio.play("bark", { pitch: 0.85 + (Art.DOG_LOOKS.indexOf(dog.look) % 3) * 0.15, gap: 0.2 });
      this.alertWhos(p.x, p.y, 380, null);
    }

    dogNip(dog) {
      const p = this.player;
      if (p.stun > 0 || p.invuln > 0 || this.state !== "play") return;
      p.stun = 0.45;
      p.invuln = 1.6;
      p.play("startled", 0.45);
      this.audio.play("bark", { pitch: 1.2, gap: 0 });
      const dropped = p.dropLoot(1);
      if (dropped.length) {
        this.loot.scatter(dropped, p.x, p.y);
        this.particles.text(p.x, p.y - 100, "GRR!", "#ffb52e", 24);
      }
      this.say(G.pick(QUIPS.dog), 1.6);
    }

    maxBump() {
      const p = this.player;
      if (this.state !== "play") return;
      p.stun = 0.8;
      p.invuln = Math.max(p.invuln, 1.4);
      p.vx = p.vy = 0;
      this.shake = 0.3;
      this.audio.play("bonk");
      this.audio.play("maxBark");
      const dropped = p.dropLoot(G.randInt(1, 2));
      if (dropped.length) {
        this.loot.scatter(dropped, p.x, p.y);
        this.audio.play("drop");
      }
      this.particles.text(p.x, p.y - 100, "OOF!", "#ffffff", 26);
      setTimeout(() => {
        if (this.state === "play") this.grinchReact("frustrated", G.pick(QUIPS.max));
      }, 450);
    }

    freeMax(max) {
      this.roundBonus += 50;
      this.particles.text(max.x, max.y - 60, "+50", "#ffd23f", 26);
      this.particles.confetti(max.x, max.y - 30, 16);
      this.audio.play("powerup");
      this.setMultiplier(5);
      this.say("THERE YOU GO, MAX.", 1.8);
      max.say("Arf! Arf!", 1);
      this.markers = this.markers.filter((m) => m.obj !== max);
    }

    spawnStash(x, y) {
      const types = ["small", "large", "stocking", "ornament", "small", "wreath", "large"];
      const n = 3;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * G.TAU;
        const it = this.loot.add(G.pick(types), x, y, { vx: Math.cos(a) * 90, vy: Math.sin(a) * 60, vz: 240, z: 4, pop: true, delay: 0.4 });
        it.fresh = true;
      }
      if (Math.random() < 0.35) this.loot.add("bell", x, y + 6, { vz: 300, z: 4, pop: true, delay: 0.4 });
      this.particles.sparkle(x, y - 20);
      this.particles.confetti(x, y - 10, 14);
      this.audio.play("present");
      this.hud.banner("MAX FOUND PRESENTS!", "", "#c98a4a");
      this.addMarker({ x, y }, "LOOT", "#c98a4a", 6);
    }

    maxDelivers(items) {
      const p = this.player;
      for (const it of items) {
        it.carriedBy = null;
        if (it.collected) continue;
        it.x = p.x;
        it.y = p.y;
        this.collect(it);
      }
      if (items.length) this.say("GOOD BOY, MAX!", 1.6);
    }

    setMultiplier(time) {
      this.multT = Math.max(this.multT, time);
      this.hud.banner("MAX BONUS x2!", "Double points for a while!", "#ffd23f");
      this.audio.play("powerup");
    }

    activatePower(type, x, y) {
      const p = this.player;
      const def = G.POWERUPS[type];
      this.audio.play("powerup");
      this.particles.sparkle(x, y - 26, Art.POWER_COLORS[type]);
      if (type === "golden") {
        this.roundBonus += 100;
        this.audio.play("golden");
        this.particles.text(p.x, p.y - 100, "+100", "#ffd23f", 30);
        this.hud.banner(def.name.toUpperCase(), def.desc, Art.POWER_COLORS[type]);
        return;
      }
      p.powers[type] = def.time;
      this.hud.banner(def.name.toUpperCase(), def.desc, Art.POWER_COLORS[type]);
      if (type === "maxdog") {
        this.max.appear("distractAll", true);
        for (const w of this.whos) if (G.dist(w.x, w.y, p.x, p.y) < 520) w.distract(def.time);
      }
      if (Math.random() < 0.5) this.say(G.pick(QUIPS.power), 1.5);
    }

    // ---------------------------------------------------------------- End of a level

    escape() {
      const p = this.player;
      this.state = "escaping";
      this.escapeT = 0;
      p.escaping = true;
      p.stun = 0;
      p.vx = p.vy = 0;
      p.play("celebrate", 3.2);
      this.escStart = { x: p.x, y: p.y };
      this.audio.play("getaway");
      this.audio.play("laugh");
      this.say(G.pick(QUIPS.escape), 2.4);
      this.particles.confetti(p.x, p.y - 40, 40);
      for (const w of this.whos) if (w.state === "chase") w.setState("search");
      this.input.enabled = false;
      this.input.release();
    }

    updateEscape(dt) {
      const p = this.player;
      const gw = this.world.getaway;
      this.escapeT += dt;
      p.t += dt;
      if (p.anim) {
        p.animT = Math.min(0.99, p.animT + dt / p.animDur);
      }
      const k = Math.min(1, this.escapeT / 0.6);
      p.x = G.lerp(this.escStart.x, gw.x, G.easeInOut(k));
      p.y = G.lerp(this.escStart.y, gw.y - 6, G.easeInOut(k));
      if (this.escapeT > 0.7 && Math.random() < dt * 30) this.particles.confetti(gw.x + this.getawayShift(), gw.y - 30, 1);
      if (this.escapeT > 2.8) this.finishLevel(true);
    }

    getawayShift() {
      if (this.state !== "escaping" || this.world.getaway.kind !== "sled") return 0;
      const k = Math.max(0, this.escapeT - 0.8);
      const dir = this.world.getaway.x < this.world.W / 2 ? -1 : 1;
      return dir * k * k * 420;
    }

    timeUp() {
      const p = this.player;
      this.state = "timeup";
      this.timeupT = 0;
      p.stun = 3;
      p.vx = p.vy = 0;
      this.input.enabled = false;
      this.input.release();
      this.audio.play("fail");
      this.hud.banner("TIME'S UP!", "The getaway left without you!", "#ff6b6b");
      this.say("NOOOO! MY GETAWAY!", 2.2);
    }

    finishLevel(escaped) {
      const L = this.L;
      const p = this.player;
      const loot = p.lootValue;
      const items = p.sack.length;
      const counts = {};
      let presents = 0;
      let candy = 0;
      for (const e of p.sack) {
        counts[e.type] = (counts[e.type] || 0) + 1;
        if (G.ITEMS[e.type].present) presents++;
        if (e.type === "candy") candy++;
      }
      const timeLeft = Math.max(0, Math.ceil(this.timeLeft));
      const escapeBonus = escaped ? 150 + L.id * 25 : 0;
      const timeBonus = escaped ? timeLeft * 5 : 0;
      const cleanBonus = escaped && this.roundCaught === 0 ? 150 : 0;
      const penalty = escaped ? 0 : Math.round(loot * 0.25);
      const extra = this.roundBonus;
      const total = Math.max(0, loot + escapeBonus + timeBonus + cleanBonus + extra - penalty);
      this.score += total;
      const ratio = this.loot.potential ? loot / this.loot.potential : 0;
      let stars = 0;
      if (escaped) stars = ratio >= 0.4 ? 3 : ratio >= 0.2 ? 2 : 1;
      const rating = ["Busted Getaway...", "Got Away!", "Sneaky Success!", "GRINCHTASTIC!"][stars];

      this.stats.loot += items;
      this.stats.presents += presents;
      this.stats.candy += candy;
      this.stats.seconds += Math.max(1, Math.round(this.roundTime));
      if (escaped) this.stats.escapes++;

      let lifeLost = false;
      let lifeGained = false;
      if (this.mode === "campaign") {
        if (!escaped) {
          this.lives--;
          lifeLost = true;
        }
        while (this.score >= this.nextLifeAt) {
          this.nextLifeAt += 3000;
          if (this.lives < 5 && this.lives > 0) {
            this.lives++;
            lifeGained = true;
          }
        }
      }
      const newBest = this.storage.recordLevel(L.id, total, stars, items, escaped);
      this.storage.addLoot(items, presents);

      this.state = "levelEnd";
      this.input.enabled = false;
      this.audio.playMusic("menu");
      if (escaped) this.audio.play("levelComplete");
      if (lifeGained) setTimeout(() => this.audio.play("lifeUp"), 900);

      const result = {
        level: L,
        escaped,
        loot,
        items,
        counts,
        presents,
        candy,
        escapeBonus,
        timeBonus,
        cleanBonus,
        extra,
        penalty,
        total,
        stars,
        rating,
        timeLeft,
        caught: this.roundCaught,
        lives: this.lives,
        lifeLost,
        lifeGained,
        newBest,
        score: this.score,
        campaign: this.mode === "campaign",
        last: L.id === G.LEVELS.length,
        gameOver: this.mode === "campaign" && this.lives <= 0,
      };
      this.lastResult = result;
      if (this.ui) this.ui.showLevelEnd(result);
    }

    // Called by the level-end screen's Continue button.
    continueCampaign() {
      const r = this.lastResult;
      if (!r) return;
      if (r.gameOver) this.gameOver(false);
      else if (r.last) this.gameOver(true);
      else this.loadLevel(r.level.id + 1);
    }

    retryLevel() {
      if (this.mode === "campaign") return;
      this.loadLevel(this.L.id);
    }

    restartLevel() {
      // From the pause menu: replay this level from the start (campaign keeps score from earlier levels).
      this.loadLevel(this.L.id);
    }

    gameOver(victory) {
      const newBest = this.storage.recordGame(this.score);
      this.state = "gameover";
      this.input.enabled = false;
      this.audio.playMusic("menu");
      if (victory) this.audio.play("levelComplete");
      else this.audio.play("fail");
      const result = {
        victory,
        score: this.score,
        level: this.L.id,
        loot: this.stats.loot,
        presents: this.stats.presents,
        candy: this.stats.candy,
        avoided: this.stats.avoided,
        caught: this.stats.caught,
        escapes: this.stats.escapes,
        seconds: this.stats.seconds,
        best: this.storage.data.bestScore,
        newBest,
      };
      this.finalResult = result;
      if (this.ui) this.ui.showGameOver(result);
    }

    pause() {
      if (this.state !== "play" && this.state !== "ready") return;
      this.prevState = this.state;
      this.state = "paused";
      this.input.release();
      this.input.enabled = false;
      if (this.ui) this.ui.showPause();
    }

    resume() {
      if (this.state !== "paused") return;
      this.state = this.prevState || "play";
      this.input.enabled = true;
      this.input.release();
      if (this.ui) this.ui.enterPlay();
    }

    quitToMenu() {
      this.input.enabled = false;
      this.input.release();
      this.setupMenuScene();
      this.audio.playMusic("menu");
    }

    // ---------------------------------------------------------------- Rendering

    render() {
      const ctx = this.ctx;
      const s = this.pxScale;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#1a2346";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      if (!this.world) return;
      ctx.setTransform(s, 0, 0, s, 0, 0);
      const VW = this.VW;
      const VH = G.VH;
      let sx = 0;
      let sy = 0;
      if (this.shake > 0) {
        sx = G.rand(-1, 1) * this.shake * 14;
        sy = G.rand(-1, 1) * this.shake * 14;
      }
      const camX = this.camX + sx;
      const camY = this.camY + sy;
      ctx.save();
      ctx.translate(-camX, -camY);
      const view = { x: camX, y: camY, w: VW, h: VH };
      this.drawWorld(ctx, view);
      ctx.restore();

      // Screen space.
      this.particles.drawSnow(ctx, VW, VH);
      if (this.state === "menu") {
        ctx.fillStyle = "rgba(14, 20, 48, 0.35)";
        ctx.fillRect(0, 0, VW, VH);
        return;
      }
      // The HUD only shows during a heist; result screens have their own numbers.
      const s2 = this.state;
      const heist = s2 === "ready" || s2 === "play" || s2 === "escaping" || s2 === "timeup" || (s2 === "paused" && this.prevState);
      if (heist) this.hud.draw(ctx, VW, VH);
    }

    drawWorld(ctx, view) {
      const w = this.world;
      const t = this.time;
      const p = this.player;

      // Ground layer.
      const gx = Math.max(0, Math.floor(view.x));
      const gy = Math.max(0, Math.floor(view.y));
      const gw = Math.min(this.ground.width - gx, Math.ceil(view.w) + 2);
      const gh = Math.min(this.ground.height - gy, Math.ceil(view.h) + 2);
      if (gw > 0 && gh > 0) ctx.drawImage(this.ground, gx, gy, gw, gh, gx, gy, gw, gh);

      // Moving ground details: belts, tangled lights, presses, getaway ring.
      for (const b of w.belts) {
        if (!G.rectsOverlap(b, view)) continue;
        ctx.save();
        ctx.beginPath();
        ctx.rect(b.x, b.y, b.w, b.h);
        ctx.clip();
        ctx.fillStyle = "rgba(255,255,255,0.22)";
        const off = ((t * b.speed * b.dir) % 40 + 40) % 40;
        for (let x = b.x - 40 + off; x < b.x + b.w + 40; x += 40) {
          ctx.beginPath();
          const d = b.dir;
          ctx.moveTo(x, b.y + 6);
          ctx.lineTo(x + 12 * d, b.y + b.h / 2);
          ctx.lineTo(x, b.y + b.h - 6);
          ctx.lineTo(x + 8 * d, b.y + b.h - 6);
          ctx.lineTo(x + 20 * d, b.y + b.h / 2);
          ctx.lineTo(x + 8 * d, b.y + 6);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
      for (const z of w.lights) {
        if (!G.rectsOverlap(z, view)) continue;
        this.drawLights(ctx, z, t);
      }
      this.hazards.drawGround(ctx, view);

      // Vision cones and dog rings.
      if (this.state !== "menu") {
        for (const who of this.whos) {
          if (who.x < view.x - 300 || who.x > view.x + view.w + 300 || who.y < view.y - 300 || who.y > view.y + view.h + 300) continue;
          who.drawCone(ctx);
        }
        for (const d of this.dogs) if (G.dist(d.x, d.y, p.x, p.y) < 460) d.drawCone(ctx);
      }

      // Everything that stands up, in depth order.
      const list = [];
      for (const pr of w.props) {
        if (pr.tree && pr.tree.hiddenProp) continue;
        if (pr.bounds && !G.rectsOverlap(pr.bounds, view)) continue;
        list.push(pr);
      }
      this.loot.drawables(list, view);
      this.hazards.drawables(list, view);
      for (const who of this.whos) {
        if (who.x < view.x - 60 || who.x > view.x + view.w + 60 || who.y < view.y - 40 || who.y > view.y + view.h + 120) continue;
        list.push({ sortY: who.y, draw: (c) => who.draw(c) });
      }
      for (const d of this.dogs) {
        if (d.x < view.x - 60 || d.x > view.x + view.w + 60 || d.y < view.y - 40 || d.y > view.y + view.h + 100) continue;
        list.push({ sortY: d.y, draw: (c) => d.draw(c) });
      }
      if (this.max.active) list.push({ sortY: this.max.y, draw: (c) => this.max.draw(c) });
      const ga = w.getaway;
      list.push({ sortY: ga.y + 8, draw: (c) => this.drawGetaway(c) });
      const hideGrinch = this.state === "escaping" && this.escapeT > 0.7;
      if (!hideGrinch) list.push({ sortY: p.y, draw: (c) => p.draw(c), player: true });
      list.sort((a, b) => a.sortY - b.sortY);

      for (const d of list) {
        const fade = d.fade || d.fadeRect;
        if (fade && p.y < d.sortY && G.pointInRect(p.x, p.y - 30, fade)) {
          ctx.globalAlpha = 0.42;
          d.draw(ctx, t);
          ctx.globalAlpha = 1;
        } else {
          d.draw(ctx, t);
        }
      }

      // Overlays.
      this.particles.draw(ctx);
      for (const who of this.whos) {
        if (who.x < view.x - 60 || who.x > view.x + view.w + 60 || who.y < view.y - 40 || who.y > view.y + view.h + 140) continue;
        who.drawOverlay(ctx);
      }
      for (const d of this.dogs) d.drawOverlay(ctx);
      this.max.drawOverlay(ctx);
      this.hazards.drawOverlay(ctx, view);
      if (this.state === "play" && !p.boostReady) {
        ctx.strokeStyle = "rgba(255,255,255,0.75)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + 4, 22, 8, 0, Math.PI * 0.1, Math.PI * 0.1 + Math.PI * 1.8 * p.boost01);
        ctx.stroke();
      }
      if (this.quip && !hideGrinch && this.state !== "menu") {
        // Keep the bubble on screen when the Grinch is near an edge.
        ctx.font = "800 14px Oxanium, sans-serif";
        const half = ctx.measureText(this.quip.text).width / 2 + 14;
        const bx = G.clamp(p.x, view.x + half + 6, view.x + view.w - half - 6);
        const by = Math.max(p.y - 104, view.y + 150);
        G.drawBubble(ctx, bx, by, this.quip.text, "#ffffff", Math.min(1, this.quip.t / this.quip.max + 0.15));
      }
      this.particles.drawTexts(ctx);
    }

    drawGetaway(ctx) {
      const ga = this.world.getaway;
      const t = this.time;
      const shift = this.getawayShift();
      ctx.save();
      ctx.translate(shift, 0);
      Art.getaway(ctx, ga, t, this.state === "play" && this.getawayArmed && this.player.sack.length > 0);
      ctx.restore();
      if (this.state === "escaping" && this.escapeT > 0.7) {
        const k = this.escapeT - 0.7;
        ctx.save();
        if (ga.kind === "sled") {
          ctx.translate(ga.x + shift - 6, ga.y - 22);
          ctx.scale(0.8, 0.8);
        } else {
          const s = Math.max(0, 1 - k / 0.7);
          ctx.translate(ga.x, ga.y - 4 + (1 - s) * 6);
          ctx.scale(s, s);
          if (s <= 0) {
            ctx.restore();
            return;
          }
        }
        Art.grinch(ctx, { dir: "down", t, phase: 0, speed01: 0, mode: "idle", anim: "celebrate", animT: 0.5, sack: Math.min(1.45, this.player.weight / G.SACK_OVER), overloaded: false });
        ctx.restore();
      }
    }

    drawLights(ctx, z, t) {
      ctx.save();
      ctx.strokeStyle = "#1f5f2a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 30; i++) {
        const k = i / 30;
        const x = z.x + 6 + k * (z.w - 12) + Math.sin(i * 1.9 + z.seed) * 8;
        const y = z.y + z.h / 2 + Math.sin(i * 1.3 + z.seed * 0.7) * (z.h / 2 - 6);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      const cols = ["#ff4d4d", "#ffd23f", "#4cd964", "#5fd0ff", "#ff7ad9"];
      for (let i = 0; i < 14; i++) {
        const k = i / 14;
        const x = z.x + 6 + k * (z.w - 12) + Math.sin(i * 4.1 + z.seed) * 8;
        const y = z.y + z.h / 2 + Math.sin(i * 2.7 + z.seed * 0.7) * (z.h / 2 - 6);
        const on = Math.sin(t * 5 + i * 1.7) > -0.2;
        if (on) Art.glow(ctx, x, y, 8, cols[i % 5], 0.6);
        ctx.fillStyle = on ? cols[i % 5] : "#555";
        ctx.beginPath();
        ctx.ellipse(x, y, 2.6, 3.4, i, 0, G.TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  G.Game = Game;
})(window.GH);
